using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;
using Stand.Server.Options;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/schedule")]
[Authorize]
public sealed class AdminScheduleController(StandDbContext db, IOptions<BookingOptions> options) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DayScheduleDto>> Get([FromQuery] string date, CancellationToken ct)
    {
        var day = ParseDate(date);
        var entry = await db.AvailableDates.AsNoTracking().SingleOrDefaultAsync(d => d.Date == day, ct);
        var custom = entry?.UseCustomSchedule == true;
        List<ScheduleLocationDto> locations;
        if (custom)
        {
            var rows = await db.ScheduleSlots.AsNoTracking().Where(s => s.Date == day)
                .OrderBy(s => s.TimeSlot.StartTime)
                .Select(s => new { s.LocationId, s.TimeSlot.StartTime, s.TimeSlot.EndTime }).ToListAsync(ct);
            locations = rows.GroupBy(s => s.LocationId).Select(g => new ScheduleLocationDto(g.Key,
                g.Select(s => Range(s.StartTime, s.EndTime)).ToList())).ToList();
        }
        else
        {
            var slots = await db.TimeSlots.AsNoTracking().Where(s => s.IsActive && !s.IsScheduleOnly &&
                !db.DateTimeSlotExceptions.Any(e => e.Date == day && e.TimeSlotId == s.Id && e.IsBlocked))
                .OrderBy(s => s.StartTime).ToListAsync(ct);
            // A new day starts empty; migrated dates retain exactly their previous settings.
            locations = entry is null ? [] : (await db.Locations.AsNoTracking().Where(l => l.IsActive)
                .Select(l => l.Id).ToListAsync(ct)).Select(id => new ScheduleLocationDto(id,
                    slots.Select(s => Range(s.StartTime, s.EndTime)).ToList())).ToList();
        }
        var bookings = await db.Bookings.AsNoTracking().Where(b => b.Date == day && b.Status != "Cancelled" &&
            (b.Status == "Confirmed" || b.HoldExpiresAtUtc > DateTime.UtcNow))
            .Select(b => new { b.Id, b.LocationId, b.Location.Name, b.TimeSlot.StartTime, b.TimeSlot.EndTime }).ToListAsync(ct);
        return new DayScheduleDto(date, entry?.IsActive == true, custom, locations,
            bookings.Select(b => new ScheduleBookingDto(b.Id, b.LocationId, b.Name,
                b.StartTime.ToString("HH:mm"), b.EndTime.ToString("HH:mm"))).ToList(),
            options.Value.HorizonDays, options.Value.MinLeadTimeMinutes);
    }

    [HttpPut]
    public Task<IActionResult> Save([FromBody] SaveScheduleDto dto, CancellationToken ct) => Write(dto, false, ct);

    [HttpPost("preview")]
    public Task<IActionResult> Preview([FromBody] SaveScheduleDto dto, CancellationToken ct) => Write(dto, true, ct);

    private async Task<IActionResult> Write(SaveScheduleDto dto, bool preview, CancellationToken ct)
    {
        if (dto.Dates is not { Count: > 0 and <= 366 } || dto.Locations is null || dto.Locations.Count > 100)
            throw new ValidationAppException("Оберіть від 1 до 366 дат та не більше 100 локацій.");
        var dates = dto.Dates.Select(ParseDate).Distinct().Order().ToList();
        var locationIds = dto.Locations.Select(l => l.LocationId).ToList();
        if (locationIds.Distinct().Count() != locationIds.Count)
            throw new ValidationAppException("Локації не можуть повторюватися.");
        var ranges = new Dictionary<int, List<(TimeOnly Start, TimeOnly End)>>();
        foreach (var location in dto.Locations)
        {
            if (location.Slots is not { Count: > 0 and <= 144 })
                throw new ValidationAppException("Додайте від 1 до 144 інтервалів для кожної локації або вимкніть її.");
            var parsed = location.Slots.Select(s => ParseRange(s)).OrderBy(s => s.Start).ToList();
            for (var i = 1; i < parsed.Count; i++)
                if (parsed[i].Start < parsed[i - 1].End)
                    throw new ValidationAppException("Часові інтервали однієї локації не можуть перетинатися.");
            ranges[location.LocationId] = parsed;
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        if (!preview) await ScheduleLock.AcquireCatalogAsync(db, ct);
        foreach (var date in dates) await ScheduleLock.AcquireAsync(db, date, true, ct);
        var locations = await db.Locations.Where(l => locationIds.Contains(l.Id)).ToListAsync(ct);
        if (locations.Count != locationIds.Count || (dto.IsActive && locations.Any(l => !l.IsActive)))
            throw new ValidationAppException("Оберіть наявні активні локації. Неактивну локацію спочатку увімкніть у довіднику.");
        var bookings = await db.Bookings.Where(b => dates.Contains(b.Date) &&
            (b.Status == "Confirmed" || (b.Status == "Held" && b.HoldExpiresAtUtc > DateTime.UtcNow)))
            .Select(b => new { b.LocationId, b.TimeSlot.StartTime, b.TimeSlot.EndTime }).ToListAsync(ct);
        var affected = bookings.Count(b => !dto.IsActive || !ranges.TryGetValue(b.LocationId, out var slots) ||
            !slots.Contains((b.StartTime, b.EndTime)));
        if (preview) return Ok(new ScheduleSaveResultDto(dates.Count, affected));
        if (affected > 0 && !dto.AcknowledgeExistingBookings)
            throw new ConflictAppException(ErrorCodes.Conflict,
                $"Зміни зачіпають {affected} наявних записів. Вони залишаться чинними на початковий час. Перегляньте попередження та підтвердьте збереження.");

        var entries = await db.AvailableDates.Where(d => dates.Contains(d.Date)).ToDictionaryAsync(d => d.Date, ct);
        foreach (var date in dates)
        {
            if (!entries.TryGetValue(date, out var entry))
            {
                entry = new AvailableDate { Date = date };
                db.AvailableDates.Add(entry);
            }
            entry.IsActive = dto.IsActive;
            entry.UseCustomSchedule = true;
            entry.UpdatedAtUtc = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        // Never mutate a TimeSlot: existing booking references keep their original time.
        var catalog = await db.TimeSlots.OrderBy(s => s.Id).ToListAsync(ct);
        var slotMap = catalog.GroupBy(s => (s.StartTime, s.EndTime)).ToDictionary(g => g.Key, g => g.First());
        foreach (var range in ranges.Values.SelectMany(s => s).Distinct())
        {
            if (slotMap.ContainsKey(range)) continue;
            var slot = new TimeSlot { StartTime = range.Start, EndTime = range.End, SortOrder = range.Start.Hour * 60 + range.Start.Minute,
                IsActive = true, IsScheduleOnly = true };
            db.TimeSlots.Add(slot);
            slotMap[range] = slot;
        }
        await db.SaveChangesAsync(ct);
        await db.ScheduleSlots.Where(s => dates.Contains(s.Date)).ExecuteDeleteAsync(ct);
        foreach (var date in dates)
            foreach (var (locationId, slots) in ranges)
                foreach (var range in slots)
                    db.ScheduleSlots.Add(new ScheduleSlot { Date = date, LocationId = locationId, TimeSlotId = slotMap[range].Id });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Ok(new ScheduleSaveResultDto(dates.Count, affected));
    }

    private static DateOnly ParseDate(string value) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? date : throw new ValidationAppException("Некоректна дата (РРРР-ММ-ДД).");
    private static (TimeOnly Start, TimeOnly End) ParseRange(ScheduleRangeDto dto)
    {
        if (!TimeOnly.TryParseExact(dto.StartTime, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start) ||
            !TimeOnly.TryParseExact(dto.EndTime, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end) || start >= end)
            throw new ValidationAppException("Вкажіть час у форматі ГГ:ХХ. Початок має бути раніше завершення в межах одного дня.");
        return (start, end);
    }
    private static ScheduleRangeDto Range(TimeOnly start, TimeOnly end) => new(start.ToString("HH:mm"), end.ToString("HH:mm"));
}
