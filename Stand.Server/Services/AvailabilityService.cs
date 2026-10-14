using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Dtos.Public;
using Stand.Server.Options;

namespace Stand.Server.Services;

public sealed class AvailabilityService(
    StandDbContext db,
    IKyivClock clock,
    IOptions<BookingOptions> options) : IAvailabilityService
{
    private readonly BookingOptions _options = options.Value;

    public (DateOnly MinDate, DateOnly MaxDate) GetBookableWindow()
    {
        var today = clock.TodayLocal;
        return (today, today.AddDays(_options.HorizonDays));
    }

    public bool IsSlotTooSoon(DateOnly date, TimeOnly startTime)
    {
        var slotStartLocal = date.ToDateTime(startTime);
        var earliestAllowed = clock.NowLocal.AddMinutes(_options.MinLeadTimeMinutes);
        return slotStartLocal < earliestAllowed;
    }

    public async Task<CalendarDto> GetCalendarAsync(CancellationToken ct)
    {
        var (min, max) = GetBookableWindow();

        var dates = await db.AvailableDates
            .Where(d => d.IsActive && d.Date >= min && d.Date <= max)
            .OrderBy(d => d.Date)
            .Select(d => d.Date)
            .ToListAsync(ct);

        var pastDates = await db.AvailableDates
            .Where(d => d.IsActive && d.Date < min)
            .Select(d => d.Date)
            .Union(db.Bookings
                .Where(b => b.Date < min && b.Status == "Confirmed")
                .Select(b => b.Date))
            .OrderBy(d => d)
            .ToListAsync(ct);

        return new CalendarDto(
            dates.Select(d => d.ToString("yyyy-MM-dd")).ToList(),
            min.ToString("yyyy-MM-dd"),
            max.ToString("yyyy-MM-dd"),
            pastDates.Select(d => d.ToString("yyyy-MM-dd")).ToList());
    }

    public async Task<List<LocationDto>> GetActiveLocationsAsync(CancellationToken ct, DateOnly? date = null)
    {
        return await db.Locations
            .Where(l => l.IsActive || (date != null && date < clock.TodayLocal &&
                l.Bookings.Any(b => b.Date == date && b.Status == "Confirmed")))
            .OrderBy(l => l.SortOrder)
            .ThenBy(l => l.Name)
            .Select(l => new LocationDto(l.Id, l.Name, l.Address, l.Capacity))
            .ToListAsync(ct);
    }

    public async Task EnsureDateBookableAsync(DateOnly date, CancellationToken ct)
    {
        var (min, max) = GetBookableWindow();
        if (date < min || date > max)
        {
            throw new ValidationAppException(
                "Обрана дата недоступна для запису.", ErrorCodes.DateNotBookable);
        }

        var enabled = await db.AvailableDates.AnyAsync(d => d.Date == date && d.IsActive, ct);
        if (!enabled)
        {
            throw new ValidationAppException(
                "Обрана дата недоступна для запису.", ErrorCodes.DateNotBookable);
        }
    }

    public async Task<List<SlotAvailabilityDto>> GetSlotsAsync(DateOnly date, int locationId, CancellationToken ct, int? authorizedUserId = null)
    {
        var (min, max) = GetBookableWindow();
        var isDateBookable = date >= min && date <= max &&
            await db.AvailableDates.AnyAsync(d => d.Date == date && d.IsActive, ct);

        var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == locationId, ct);
        if (location is null)
        {
            throw new NotFoundAppException(ErrorCodes.LocationNotFound, "Локацію не знайдено.");
        }

        if (!location.IsActive && !(date < min &&
            await db.Bookings.AnyAsync(b => b.Date == date && b.LocationId == locationId && b.Status == "Confirmed", ct)))
        {
            throw new ValidationAppException("Ця локація зараз недоступна.", ErrorCodes.LocationInactive);
        }

        var timeSlots = await db.TimeSlots
            .Where(t => t.IsActive || t.Bookings.Any(b => b.Date == date && b.LocationId == locationId && b.Status == "Confirmed"))
            .OrderBy(t => t.SortOrder)
            .ToListAsync(ct);

        var blockedTimeSlotIds = await db.DateTimeSlotExceptions
            .Where(e => e.Date == date && e.IsBlocked)
            .Select(e => e.TimeSlotId)
            .ToListAsync(ct);
        var blockedSet = blockedTimeSlotIds.ToHashSet();

        var now = clock.UtcNow;
        var currentPhone = authorizedUserId is null ? null : PhoneNormalizer.TryNormalize(
            await db.AuthorizedUsers.Where(u => u.Id == authorizedUserId)
                .Select(u => u.Phone).FirstOrDefaultAsync(ct) ?? "");
        var participants = await db.Bookings
            .Where(b => b.Date == date && b.LocationId == locationId && b.Status == "Confirmed" &&
                (currentPhone == null || b.Phone != currentPhone))
            .OrderBy(b => b.LastName).ThenBy(b => b.FirstName).ThenBy(b => b.Id)
            .Select(b => new { b.TimeSlotId, b.FirstName, b.LastName })
            .ToListAsync(ct);
        var participantsBySlot = participants.ToLookup(b => b.TimeSlotId);
        var bookedCounts = await db.Bookings
            .Where(b => b.Date == date && b.LocationId == locationId &&
                        (b.Status == "Confirmed" || (b.Status == "Held" && b.HoldExpiresAtUtc > now)))
            .GroupBy(b => b.TimeSlotId)
            .Select(g => new { TimeSlotId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.TimeSlotId, g => g.Count, ct);

        var result = new List<SlotAvailabilityDto>(timeSlots.Count);
        foreach (var slot in timeSlots)
        {
            var isBlocked = blockedSet.Contains(slot.Id);
            var isTooSoon = IsSlotTooSoon(date, slot.StartTime);
            var booked = bookedCounts.GetValueOrDefault(slot.Id, 0);
            var remaining = Math.Max(0, location.Capacity - booked);

            result.Add(new SlotAvailabilityDto(
                slot.Id,
                slot.StartTime.ToString("HH:mm"),
                slot.EndTime.ToString("HH:mm"),
                location.Capacity,
                booked,
                remaining,
                IsFull: isBlocked || isTooSoon || remaining <= 0,
                IsBlocked: isBlocked,
                IsTooSoon: isTooSoon,
                IsBookable: isDateBookable && location.IsActive && slot.IsActive && !isBlocked && !isTooSoon && remaining > 0,
                Participants: participantsBySlot[slot.Id]
                    .Select(b => new ShiftParticipantDto(b.FirstName, b.LastName)).ToList()));
        }

        return result;
    }
}
