using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Data;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize]
public sealed class AdminDashboardController(StandDbContext db, IKyivClock clock) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var today = clock.TodayLocal;
        var horizonEnd = today.AddDays(14);
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

    private async Task<List<LocationFillRateDto>> FillRateByLocationAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var now = clock.UtcNow;

        var locations = await db.Locations.Where(l => l.IsActive).OrderBy(l => l.SortOrder).ToListAsync(ct);

        var counts = await db.Bookings
            .Where(b => b.Date >= from && b.Date <= to &&
                        (b.Status == "Confirmed" || (b.Status == "Held" && b.HoldExpiresAtUtc > now)))
            .GroupBy(b => new { b.LocationId, b.Status })
            .Select(g => new { g.Key.LocationId, g.Key.Status, Count = g.Count() })
            .ToListAsync(ct);

        var result = new List<LocationFillRateDto>();
        foreach (var loc in locations)
        {
            var confirmed = counts.Where(c => c.LocationId == loc.Id && c.Status == "Confirmed").Sum(c => c.Count);
            var held = counts.Where(c => c.LocationId == loc.Id && c.Status == "Held").Sum(c => c.Count);

            // Capacity is per time slot; use location.Capacity as the basis for a single slot's
            // fill rate (sufficient for a simple v1 dashboard indicator).
            var fillRate = loc.Capacity <= 0 ? 0 : (int)Math.Round(100.0 * (confirmed + held) / loc.Capacity);

            result.Add(new LocationFillRateDto(loc.Id, loc.Name, loc.Capacity, confirmed, held, Math.Min(100, fillRate)));
        }

        return result;
    }
}
