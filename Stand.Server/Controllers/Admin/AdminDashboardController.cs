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
        var todayBooked = await db.Bookings.CountAsync(b => b.Date == today && b.IsBooked, ct);

        var upcomingBooked = await db.Bookings.CountAsync(
            b => b.Date > today && b.Date <= horizonEnd && b.IsBooked, ct);

        var todayByLocation = await FillRateByLocationAsync(today, today, ct);
        var upcomingByLocation = await FillRateByLocationAsync(today, horizonEnd, ct);

        return Ok(new DashboardDto(todayBooked, upcomingBooked, todayByLocation, upcomingByLocation));
    }

    private async Task<List<LocationFillRateDto>> FillRateByLocationAsync(DateOnly fromDate, DateOnly toDate, CancellationToken ct)
    {
        var locations = await db.Locations.Where(l => l.IsActive || l.Bookings.Any(b => b.Date >= fromDate && b.Date <= toDate && b.IsBooked))
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
                        b.IsBooked)
            .GroupBy(b => b.LocationId)
            .Select(g => new { LocationId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.LocationId, g => g.Count, ct);

        var result = new List<LocationFillRateDto>();
        foreach (var loc in locations)
        {
            var booked = counts.GetValueOrDefault(loc.Id);

            var capacity = loc.Capacity * scheduled.GetValueOrDefault(loc.Id);
            var fillRate = capacity <= 0 ? (booked > 0 ? 100 : 0) : (int)Math.Round(100.0 * booked / capacity);

            result.Add(new LocationFillRateDto(loc.Id, loc.Name, loc.Capacity, booked, Math.Min(100, fillRate)));
        }

        return result;
    }
}
