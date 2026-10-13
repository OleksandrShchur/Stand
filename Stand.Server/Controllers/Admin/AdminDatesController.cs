using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/dates")]
[Authorize]
public sealed class AdminDatesController(StandDbContext db) : ControllerBase
{
    /// <summary>Lists whitelist entries within [from, to] (defaults to today..+60 days for the admin UI).</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
    {
        var fromDate = DateOnly.TryParse(from, out var f) ? f : DateOnly.FromDateTime(DateTime.UtcNow);
        var toDate = DateOnly.TryParse(to, out var t) ? t : fromDate.AddDays(60);

        var entities = await db.AvailableDates
            .Where(d => d.Date >= fromDate && d.Date <= toDate)
            .OrderBy(d => d.Date)
            .ToListAsync(ct);

        var items = entities
            .Select(d => new AvailableDateAdminDto(d.Id, d.Date.ToString("yyyy-MM-dd"), d.IsActive))
            .ToList();

        return Ok(items);
    }

    /// <summary>Enables or disables a single date (creates the whitelist row if missing).</summary>
    [HttpPut]
    public async Task<IActionResult> Set([FromBody] SetDateDto dto, CancellationToken ct)
    {
        if (!DateOnly.TryParse(dto.Date, out var date))
        {
            throw new ValidationAppException("Некоректна дата.");
        }

        var entity = await db.AvailableDates.FirstOrDefaultAsync(d => d.Date == date, ct);
        if (entity is null)
        {
            entity = new AvailableDate { Date = date, IsActive = dto.IsActive };
            db.AvailableDates.Add(entity);
        }
        else
        {
            entity.IsActive = dto.IsActive;
            entity.UpdatedAtUtc = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Ok(new AvailableDateAdminDto(entity.Id, entity.Date.ToString("yyyy-MM-dd"), entity.IsActive));
    }

    /// <summary>Bulk-enable/disable all matching weekdays within a given month (e.g. "all weekdays in June").</summary>
    [HttpPost("bulk")]
    public async Task<IActionResult> Bulk([FromBody] BulkEnableDatesDto dto, CancellationToken ct)
    {
        if (dto.Month is < 1 or > 12)
        {
            throw new ValidationAppException("Некоректний місяць.");
        }

        var weekdays = (dto.Weekdays is { Count: > 0 } ? dto.Weekdays : Enumerable.Range(0, 7).ToList())
            .Select(w => (DayOfWeek)w)
            .ToHashSet();

        var daysInMonth = DateTime.DaysInMonth(dto.Year, dto.Month);
        var dates = Enumerable.Range(1, daysInMonth)
            .Select(d => new DateOnly(dto.Year, dto.Month, d))
            .Where(d => weekdays.Contains(d.DayOfWeek))
            .ToList();

        var existing = await db.AvailableDates
            .Where(a => dates.Contains(a.Date))
            .ToDictionaryAsync(a => a.Date, ct);

        var now = DateTime.UtcNow;
        foreach (var date in dates)
        {
            if (existing.TryGetValue(date, out var row))
            {
                row.IsActive = dto.IsActive;
                row.UpdatedAtUtc = now;
            }
            else
            {
                db.AvailableDates.Add(new AvailableDate { Date = date, IsActive = dto.IsActive });
            }
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { updated = dates.Count });
    }
}
