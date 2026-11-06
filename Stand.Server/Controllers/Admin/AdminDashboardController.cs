using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize]
public sealed class AdminDashboardController(StandDbContext db, IKyivClock clock) : ControllerBase
{
    [HttpGet("people")]
    public async Task<IActionResult> People([FromQuery] string? search, CancellationToken ct)
    {
        var term = search?.Trim() ?? "";
        if (term.Length < 3) return Ok(Array.Empty<StatisticsPersonDto>());
        if (term.Length > 250) throw new ValidationAppException("Скоротіть пошуковий запит до 250 символів.");

        var query = db.AuthorizedUsers.AsNoTracking();
        if (!term.Any(char.IsLetter))
        {
            var digits = new string(term.Where(char.IsDigit).ToArray());
            if (digits.Length == 0) return Ok(Array.Empty<StatisticsPersonDto>());
            query = query.Where(u => u.Phone.Contains(digits));
        }
        else
        {
            // Each word can match either name or phone, in any order.
            foreach (var word in term.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
            {
                var part = word.ToLowerInvariant();
                query = query.Where(u => u.FirstName.ToLower().Contains(part) ||
                    u.LastName.ToLower().Contains(part) || u.Phone.Contains(part));
            }
        }

        return Ok(await query.OrderBy(u => u.LastName).ThenBy(u => u.FirstName).ThenBy(u => u.Id)
            .Take(50).Select(u => new StatisticsPersonDto(u.Id, u.FirstName, u.LastName, u.Phone))
            .ToListAsync(ct));
    }

    [HttpGet("periods")]
    public async Task<IActionResult> Periods([FromQuery] int? personId, CancellationToken ct)
    {
        var bookings = await BookingsForPersonAsync(personId, ct);
        var months = await bookings.Select(b => new { Year = b.Date.Year, Month = b.Date.Month })
            .Distinct().OrderByDescending(p => p.Year).ThenByDescending(p => p.Month).ToListAsync(ct);
        return Ok(new StatisticsPeriodsDto(clock.TodayLocal.ToString("yyyy-MM-dd"),
            months.Select(p => new StatisticsMonthDto(p.Year, p.Month)).ToList()));
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string period, [FromQuery] int year,
        [FromQuery] int? month = null, [FromQuery] int? quarter = null, [FromQuery] int? personId = null,
        CancellationToken ct = default)
    {
        var (from, to) = StatisticsPeriod.GetRange(period, year, month, quarter);
        var query = (await BookingsForPersonAsync(personId, ct)).Where(b => b.Date >= from && b.Date <= to);
        var bookings = await query.Select(b => new
        {
            b.Date, b.LocationId, LocationName = b.Location.Name, b.Location.SortOrder,
            b.TimeSlot.StartTime, b.TimeSlot.EndTime,
        }).ToListAsync(ct);
        if (bookings.Count == 0)
            throw new ValidationAppException("У цьому періоді немає нескасованих записів. Оберіть інший період.");

        // A personal report counts only that person's bookings, never location occupancy.
        var capacities = personId.HasValue ? new Dictionary<int, int>() : await ScheduledPlacesAsync(from, to, ct);
        var scheduledLocationIds = capacities.Keys.ToArray();
        var locations = personId.HasValue
            ? bookings.Select(b => new { Id = b.LocationId, Name = b.LocationName, b.SortOrder }).Distinct().ToList()
            : await db.Locations.AsNoTracking()
                .Where(l => l.IsActive || scheduledLocationIds.Contains(l.Id) || l.Bookings.Any(b => b.IsBooked && b.Date >= from && b.Date <= to))
                .Select(l => new { l.Id, l.Name, l.SortOrder }).ToListAsync(ct);
        var byLocation = bookings.ToLookup(b => b.LocationId);
        var rows = locations.OrderBy(l => l.SortOrder).ThenBy(l => l.Name).Select(location =>
        {
            var entries = byLocation[location.Id].ToList();
            int? capacity = personId.HasValue ? null : capacities.GetValueOrDefault(location.Id);
            return new LocationStatisticsDto(location.Id, location.Name, entries.Count,
                Hours(entries.Sum(b => Minutes(b.StartTime, b.EndTime))), capacity, FillRate(entries.Count, capacity));
        }).ToList();

        var totalCapacity = personId.HasValue ? (int?)null : rows.Sum(l => l.ScheduledPlaces ?? 0);
        var summary = new StatisticsSummaryDto(bookings.Count,
            Hours(bookings.Sum(b => Minutes(b.StartTime, b.EndTime))),
            bookings.Select(b => b.Date).Distinct().Count(), bookings.Select(b => b.LocationId).Distinct().Count(),
            totalCapacity, FillRate(bookings.Count, totalCapacity));

        // Empty buckets within a selected period keep gaps visible in trends.
        var byBucket = bookings.ToLookup(b => period == "month" ? b.Date : new DateOnly(b.Date.Year, b.Date.Month, 1));
        var trend = new List<StatisticsTrendDto>();
        for (var date = from; date <= to; date = period == "month" ? date.AddDays(1) : date.AddMonths(1))
        {
            var entries = byBucket[date].ToList();
            trend.Add(new StatisticsTrendDto(date.ToString("yyyy-MM-dd"), entries.Count,
                Hours(entries.Sum(b => Minutes(b.StartTime, b.EndTime)))));
        }

        return Ok(new StatisticsDto(from.ToString("yyyy-MM-dd"), to.ToString("yyyy-MM-dd"), summary, rows, trend));
    }

    private async Task<IQueryable<Booking>> BookingsForPersonAsync(int? personId, CancellationToken ct)
    {
        var query = db.Bookings.AsNoTracking().Where(b => b.IsBooked);
        if (personId.HasValue)
        {
            var person = await db.AuthorizedUsers.AsNoTracking().SingleOrDefaultAsync(u => u.Id == personId, ct)
                ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Користувача не знайдено.");
            // Matches the site's existing ownership rule for a user's shifts.
            var phone = PhoneNormalizer.TryNormalize(person.Phone) ?? person.Phone;
            query = query.Where(b => b.Phone == phone);
        }
        return query;
    }

    private async Task<Dictionary<int, int>> ScheduledPlacesAsync(DateOnly fromDate, DateOnly toDate, CancellationToken ct)
    {
        // Saved custom capacities remain available for historical and inactive locations.
        var custom = await db.ScheduleSlots.AsNoTracking()
            .Where(s => s.Date >= fromDate && s.Date <= toDate && s.AvailableDate.IsActive && s.AvailableDate.UseCustomSchedule)
            .Select(s => new { s.LocationId, s.Capacity }).ToListAsync(ct);
        var legacy = await (from location in db.Locations
            where location.IsActive
            from day in db.AvailableDates
            where day.IsActive && !day.UseCustomSchedule && day.Date >= fromDate && day.Date <= toDate
            from slot in db.TimeSlots
            where slot.IsActive && !slot.IsScheduleOnly &&
                !db.DateTimeSlotExceptions.Any(e => e.Date == day.Date && e.TimeSlotId == slot.Id && e.IsBlocked)
            select new { LocationId = location.Id, location.Capacity }).ToListAsync(ct);
        return custom.Concat(legacy).GroupBy(s => s.LocationId).ToDictionary(g => g.Key, g => g.Sum(s => s.Capacity));
    }

    private static int Minutes(TimeOnly start, TimeOnly end) => (int)(end - start).TotalMinutes;
    private static decimal Hours(int minutes) => Math.Round(minutes / 60m, 2);
    private static int? FillRate(int booked, int? capacity) => capacity is > 0
        ? (int)Math.Round(100m * booked / capacity.Value) : null;
}
