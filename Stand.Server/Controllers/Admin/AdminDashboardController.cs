using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stand.Server.Data;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;
using Stand.Server.Options;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize]
public sealed class AdminDashboardController(StandDbContext db, IKyivClock clock, IOptions<BookingOptions> options) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var today = clock.TodayLocal;
        var horizonEnd = today.AddDays(options.Value.HorizonDays);
        var now = clock.UtcNow;

        var todayConfirmed = await db.Bookings.CountAsync(b => b.Date == today && b.Status == "Confirmed", ct);

        var upcomingConfirmed = await db.Bookings.CountAsync(
            b => b.Date > today && b.Date <= horizonEnd && b.Status == "Confirmed", ct);

        var upcomingHeld = await db.Bookings.CountAsync(
            b => b.Date >= today && b.Date <= horizonEnd && b.Status == "Held" && b.HoldExpiresAtUtc > now, ct);

        var todayByLocation = await FillRateByLocationAsync(today, today, ct);
        var upcomingByLocation = await FillRateByLocationAsync(today, horizonEnd, ct);

        return Ok(new DashboardDto(todayConfirmed, upcomingConfirmed, upcomingHeld, todayByLocation, upcomingByLocation));
    }

    private async Task<List<LocationFillRateDto>> FillRateByLocationAsync(DateOnly fromDate, DateOnly toDate, CancellationToken ct)
    {
        var now = clock.UtcNow;

        var locations = await db.Locations.Where(l => l.IsActive || l.Bookings.Any(b => b.Date >= fromDate && b.Date <= toDate && b.Status == "Confirmed"))
            .OrderBy(l => l.SortOrder).ToListAsync(ct);

        var scheduled = await (from location in db.Locations
            where location.IsActive
            from day in db.AvailableDates
            where day.IsActive && day.Date >= fromDate && day.Date <= toDate
            from slot in db.TimeSlots
            where day.UseCustomSchedule
                ? db.ScheduleSlots.Any(s => s.Date == day.Date && s.LocationId == location.Id && s.TimeSlotId == slot.Id)
                : slot.IsActive && !slot.IsScheduleOnly && !db.DateTimeSlotExceptions.Any(e => e.Date == day.Date && e.TimeSlotId == slot.Id && e.IsBlocked)
            select location.Id).GroupBy(id => id).Select(g => new { Id = g.Key, Slots = g.Count() }).ToDictionaryAsync(g => g.Id, g => g.Slots, ct);

        var counts = await db.Bookings
            .Where(b => b.Date >= fromDate && b.Date <= toDate &&
                        (b.Status == "Confirmed" || (b.Status == "Held" && b.HoldExpiresAtUtc > now)))
            .GroupBy(b => new { b.LocationId, b.Status })
            .Select(g => new { g.Key.LocationId, g.Key.Status, Count = g.Count() })
            .ToListAsync(ct);

        var result = new List<LocationFillRateDto>();
        foreach (var loc in locations)
        {
            var confirmed = counts.Where(c => c.LocationId == loc.Id && c.Status == "Confirmed").Sum(c => c.Count);
            var held = counts.Where(c => c.LocationId == loc.Id && c.Status == "Held").Sum(c => c.Count);

            var capacity = loc.Capacity * scheduled.GetValueOrDefault(loc.Id);
            var fillRate = capacity <= 0 ? (confirmed + held > 0 ? 100 : 0) : (int)Math.Round(100.0 * (confirmed + held) / capacity);

            result.Add(new LocationFillRateDto(loc.Id, loc.Name, loc.Capacity, confirmed, held, Math.Min(100, fillRate)));
        }

        return result;
    }
}
