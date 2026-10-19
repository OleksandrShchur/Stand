namespace Stand.Server.Dtos.Public;

// ---- Auth ----
public sealed record PublicLoginRequestDto(string Phone);
public sealed record PublicUserMeDto(int Id, string Phone);

public sealed record LocationDto(int Id, string Name, string? Address, int Capacity, bool? HasAvailableBookings = null);

public sealed record TimeSlotDto(int Id, string StartTime, string EndTime);

public sealed record ShiftParticipantDto(string? FirstName, string? LastName);

/// <summary>A time slot's availability for a specific date + location.</summary>
public sealed record SlotAvailabilityDto(
    int TimeSlotId,
    string StartTime,
    string EndTime,
    int Capacity,
    int Booked,
    int Remaining,
    bool IsFull,
    bool IsBlocked,
    /// <summary>True when the slot starts sooner than the configured min lead time from now.</summary>
    bool IsTooSoon,
    bool IsBookable,
    List<ShiftParticipantDto> Participants,
    bool IsBookedByMe = false);

public sealed record CalendarDto(
    List<string> BookableDates, // yyyy-MM-dd, within today..+horizon and admin-enabled
    string EarliestBookableDate,
    string LatestBookableDate,
    List<string> PastDates,
    List<string> ReadOnlyDates);

public sealed record BookingSummaryDto(
    string PublicNumber,
    string CancelToken,
    bool IsBooked,
    string Date,
    string LocationName,
    string? LocationAddress,
    string StartTime,
    string EndTime,
    string? FirstName,
    string? LastName,
    string? Phone,
    string? Comment,
    string CreatedAtUtc,
    string? BookedAtUtc,
    string? CancelledAtUtc,
    List<ShiftParticipantDto> Participants);

public sealed record CancelRequestDto(string CancelToken);

public sealed record CreateBookingRequestDto(
    string Date, int LocationId, int TimeSlotId);

public sealed record CreateBookingsRequestDto(
    string Date, int LocationId, List<int>? TimeSlotIds);

public sealed record MyShiftDto(
    int Id,
    string Date,
    string LocationName,
    string? LocationAddress,
    string StartTime,
    string EndTime,
    string CancelToken,
    List<ShiftParticipantDto> Participants);
