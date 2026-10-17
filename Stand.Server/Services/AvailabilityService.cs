using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Public;
using Stand.Server.Options;

namespace Stand.Server.Services;

public sealed class AvailabilityService(
    StandDbContext db,
    IKyivClock clock,
    IOptions<BookingOptions> options,
    CurrentPublicUser currentUser) : IAvailabilityService
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
            .Where(d => d.IsActive && d.Date >= min && d.Date <= max &&
                (!d.UseCustomSchedule || db.ScheduleSlots.Any(s => s.Date == d.Date && s.Location.IsActive)))
            .OrderBy(d => d.Date)
            .Select(d => d.Date)
            .ToListAsync(ct);

        var pastDates = await db.AvailableDates
            .Where(d => d.IsActive && d.Date < min)
            .Select(d => d.Date)
            .Union(db.Bookings
                .Where(b => b.Date < min && b.IsBooked)
                .Select(b => b.Date))
            .OrderBy(d => d)
            .ToListAsync(ct);

        var readOnlyDates = new List<string>();
        // Closed days with bookings remain visible for reviewing existing shifts.
        var bookedDates = await db.Bookings.Where(b => b.Date >= min && b.Date <= max && b.IsBooked)
            .Select(b => b.Date).Distinct().ToListAsync(ct);
        readOnlyDates.AddRange(bookedDates.Except(dates).Select(d => d.ToString("yyyy-MM-dd")));
        if (dates.Contains(min))
        {
            var hasBookableSlot = await GetBookableLocationsQuery(min).AnyAsync(ct);

            if (!hasBookableSlot)
            {
                dates.Remove(min);
                readOnlyDates.Add(min.ToString("yyyy-MM-dd"));
            }
        }

        return new CalendarDto(
            dates.Select(d => d.ToString("yyyy-MM-dd")).ToList(),
            min.ToString("yyyy-MM-dd"),
            max.ToString("yyyy-MM-dd"),
            pastDates.Select(d => d.ToString("yyyy-MM-dd")).ToList(),
            readOnlyDates);
    }

    public async Task<List<LocationDto>> GetActiveLocationsAsync(CancellationToken ct, DateOnly? date = null)
    {
        var bookableLocationIds = date is null ? [] :
            await GetBookableLocationsQuery(date.Value).Select(location => location.Id).ToListAsync(ct);
        return await db.Locations
            .Where(l => date == null ? l.IsActive :
                (l.IsActive && (!db.AvailableDates.Any(d => d.Date == date && d.UseCustomSchedule) ||
                    db.ScheduleSlots.Any(s => s.Date == date && s.LocationId == l.Id))) ||
                l.Bookings.Any(b => b.Date == date && b.IsBooked))
            .OrderBy(l => l.SortOrder)
            .ThenBy(l => l.Name)
            .Select(l => new LocationDto(l.Id, l.Name, l.Address, l.Capacity,
                date == null ? (bool?)null : bookableLocationIds.Contains(l.Id)))
            .ToListAsync(ct);
    }

    // The calendar and location list use the same cutoff, exceptions and capacity rules.
    private IQueryable<Location> GetBookableLocationsQuery(DateOnly date)
    {
        var (min, max) = GetBookableWindow();
        var nowLocal = clock.NowLocal;
        var earliestStart = nowLocal.AddMinutes(_options.MinLeadTimeMinutes);
        var earliestDate = DateOnly.FromDateTime(earliestStart);
        var earliestTime = TimeOnly.FromDateTime(earliestStart);
        var currentTime = TimeOnly.FromDateTime(nowLocal);

        return db.Locations.Where(location => location.IsActive && date >= min && date <= max &&
            db.AvailableDates.Any(day => day.Date == date && day.IsActive) &&
            db.TimeSlots.Any(slot =>
                (db.AvailableDates.Any(day => day.Date == date && day.UseCustomSchedule)
                    ? db.ScheduleSlots.Any(s => s.Date == date && s.LocationId == location.Id && s.TimeSlotId == slot.Id)
                    : slot.IsActive && !slot.IsScheduleOnly && !db.DateTimeSlotExceptions.Any(exception =>
                        exception.Date == date && exception.TimeSlotId == slot.Id && exception.IsBlocked)) &&
                (date > earliestDate || (date == earliestDate && slot.StartTime >= earliestTime)) &&
                (date > min || slot.EndTime > currentTime) &&
                db.Bookings.Count(booking => booking.Date == date && booking.TimeSlotId == slot.Id &&
                    booking.LocationId == location.Id &&
                    booking.IsBooked) < location.Capacity));
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

        var location = await db.Locations.Where(l => l.Id == locationId)
            .Select(l => new { l.IsActive, l.Capacity }).FirstOrDefaultAsync(ct);
        if (location is null)
        {
            throw new NotFoundAppException(ErrorCodes.LocationNotFound, "Локацію не знайдено.");
        }

        if (!location.IsActive && !(
            await db.Bookings.AnyAsync(b => b.Date == date && b.LocationId == locationId && b.IsBooked, ct)))
        {
            throw new ValidationAppException("Ця локація зараз недоступна.", ErrorCodes.LocationInactive);
        }

        var timeSlots = await db.TimeSlots
            .Where(t => (db.AvailableDates.Any(d => d.Date == date && d.UseCustomSchedule)
                ? db.ScheduleSlots.Any(s => s.Date == date && s.LocationId == locationId && s.TimeSlotId == t.Id)
                : t.IsActive && !t.IsScheduleOnly) ||
                t.Bookings.Any(b => b.Date == date && b.LocationId == locationId && b.IsBooked))
            .OrderBy(t => t.StartTime).ThenBy(t => t.EndTime)
            .Select(t => new
            {
                t.Id, t.StartTime, t.EndTime, t.IsActive,
                IsBlocked = db.AvailableDates.Any(d => d.Date == date && d.UseCustomSchedule)
                    ? !db.ScheduleSlots.Any(s => s.Date == date && s.LocationId == locationId && s.TimeSlotId == t.Id)
                    : !t.IsActive || t.IsScheduleOnly || db.DateTimeSlotExceptions.Any(e => e.Date == date && e.IsBlocked && e.TimeSlotId == t.Id),
            })
            .ToListAsync(ct);

        var profile = authorizedUserId is null ? null : await currentUser.GetAsync(authorizedUserId.Value, ct);
        var currentPhone = profile is null ? null : PhoneNormalizer.TryNormalize(profile.Phone);
        var activeBookings = await db.Bookings
            .Where(b => b.Date == date && b.LocationId == locationId &&
                b.IsBooked)
            .OrderBy(b => b.LastName).ThenBy(b => b.FirstName).ThenBy(b => b.Id)
            .Select(b => new { b.TimeSlotId, b.Phone, b.FirstName, b.LastName })
            .ToListAsync(ct);
        var participantsBySlot = activeBookings
            .Where(b => currentPhone == null || b.Phone != currentPhone)
            .ToLookup(b => b.TimeSlotId);
        var bookedCounts = activeBookings.GroupBy(b => b.TimeSlotId).ToDictionary(g => g.Key, g => g.Count());

        var result = new List<SlotAvailabilityDto>(timeSlots.Count);
        foreach (var slot in timeSlots)
        {
            var isBlocked = slot.IsBlocked;
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
                IsBookable: isDateBookable && location.IsActive && !isBlocked && !isTooSoon && remaining > 0,
                Participants: participantsBySlot[slot.Id]
                    .Select(b => new ShiftParticipantDto(b.FirstName, b.LastName)).ToList()));
        }

        return result;
    }
}
