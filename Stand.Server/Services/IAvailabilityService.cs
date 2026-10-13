using Stand.Server.Dtos.Public;

namespace Stand.Server.Services;

public interface IAvailabilityService
{
    /// <summary>The inclusive bookable window: today .. today+HorizonDays (local civil dates).</summary>
    (DateOnly MinDate, DateOnly MaxDate) GetBookableWindow();

    /// <summary>
    /// True when the slot's local start (date + start time) is earlier than now + MinLeadTimeMinutes.
    /// </summary>
    bool IsSlotTooSoon(DateOnly date, TimeOnly startTime);

    Task<CalendarDto> GetCalendarAsync(CancellationToken ct);

    Task<List<LocationDto>> GetActiveLocationsAsync(CancellationToken ct);

    /// <summary>
    /// Returns the admin-enabled bookable dates, the active locations and the slot
    /// availability for a specific date + location. Throws AppException if the date is not
    /// bookable or the location is not found/active.
    /// </summary>
    Task<List<SlotAvailabilityDto>> GetSlotsAsync(DateOnly date, int locationId, CancellationToken ct);

    /// <summary>Throws if the date is outside the bookable window or not admin-enabled.</summary>
    Task EnsureDateBookableAsync(DateOnly date, CancellationToken ct);
}
