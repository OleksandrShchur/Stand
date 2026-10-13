namespace Stand.Server.Dtos.Public;

// ---- Auth ----
public sealed record PublicLoginRequestDto(string Phone);
public sealed record PublicUserMeDto(int Id, string Phone);

public sealed record LocationDto(int Id, string Name, string? Address, int Capacity);

public sealed record TimeSlotDto(int Id, string StartTime, string EndTime);

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
    bool IsTooSoon);

public sealed record CalendarDto(
    List<string> BookableDates, // yyyy-MM-dd, within today..+horizon and admin-enabled
    string EarliestBookableDate,
    string LatestBookableDate);

public sealed record HoldRequestDto(string Date, int LocationId, int TimeSlotId);

public sealed record HoldResponseDto(
    string HoldToken,
    string ExpiresAtUtc,
    int SecondsRemaining,
    string Date,
    int LocationId,
    string LocationName,
    string? LocationAddress,
    int TimeSlotId,
    string StartTime,
    string EndTime);

public sealed record ConfirmRequestDto(
    string HoldToken,
    string FirstName,
    string LastName,
    string Phone,
    string? Comment);

public sealed record BookingSummaryDto(
    string PublicNumber,
    string CancelToken,
    string Status,
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
    string? ConfirmedAtUtc,
    string? CancelledAtUtc);

public sealed record CancelRequestDto(string CancelToken);
