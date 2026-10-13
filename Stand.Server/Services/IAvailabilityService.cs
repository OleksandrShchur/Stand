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

    Task<List<LocationDto>> GetActiveLocationsAsync(CancellationToken ct, DateOnly? date = null);

    /// <summary>
    /// Returns shift availability and confirmed participants for any date + location.
    /// Booking eligibility is reported separately; browsing does not require a bookable date.
    /// Inactive locations remain viewable for past dates with confirmed bookings.
    /// Throws AppException if the location is not found or is unavailable for browsing.
    /// </summary>
    Task<List<SlotAvailabilityDto>> GetSlotsAsync(DateOnly date, int locationId, CancellationToken ct);

    /// <summary>Throws if the date is outside the bookable window or not admin-enabled.</summary>
    Task EnsureDateBookableAsync(DateOnly date, CancellationToken ct);
}
