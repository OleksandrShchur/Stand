namespace Stand.Server.Dtos.Admin;

// ---- Auth ----
public sealed record LoginRequestDto(string Login, string Password);
public sealed record AdminMeDto(int Id, string Login);
public sealed record AdminUserDto(int Id, string Login, bool IsActive, string CreatedAtUtc, string? LastLoginAtUtc);
public sealed record CreateAdminUserDto(string Login, string Password);
public sealed record SetAdminActiveDto(bool IsActive);
public sealed record AuthorizedUserAdminDto(int Id, string Phone, string FirstName, string LastName, bool IsActive, string CreatedAtUtc, string? LastLoginAtUtc);
public sealed record CreateAuthorizedUserDto(string Phone, string FirstName, string LastName);

// ---- Locations ----
public sealed record LocationAdminDto(
    int Id, string Name, string? Address, int Capacity, int SortOrder, bool IsActive);
public sealed record UpsertLocationDto(string Name, string? Address, int Capacity, int SortOrder, bool IsActive);

// ---- Time slots ----
public sealed record TimeSlotAdminDto(
    int Id, string StartTime, string EndTime, int SortOrder, bool IsActive);
public sealed record UpsertTimeSlotDto(string StartTime, string EndTime, int SortOrder, bool IsActive);

// ---- Available dates (whitelist calendar) ----
public sealed record AvailableDateAdminDto(int Id, string Date, bool IsActive);
public sealed record SetDateDto(string Date, bool IsActive);
public sealed record BulkEnableDatesDto(
    int Year, int Month, List<int> Weekdays /* 0=Sun..6=Sat */, bool IsActive);

// ---- Date -> location -> immutable time ranges ----
public sealed record ScheduleRangeDto(string StartTime, string EndTime);
public sealed record ScheduleLocationInputDto(int LocationId, List<ScheduleRangeDto> Slots);
public sealed record SaveScheduleDto(List<string> Dates, bool IsActive, List<ScheduleLocationInputDto> Locations,
    bool AcknowledgeExistingBookings = false);
public sealed record ScheduleBookingDto(int Id, int LocationId, string LocationName, string StartTime, string EndTime);
public sealed record ScheduleLocationDto(int LocationId, List<ScheduleRangeDto> Slots);
public sealed record DayScheduleDto(string Date, bool IsActive, bool IsCustom, List<ScheduleLocationDto> Locations,
    List<ScheduleBookingDto> Bookings, int HorizonDays, int MinLeadTimeMinutes);
public sealed record ScheduleSaveResultDto(int UpdatedDates, int PreservedBookings);

// ---- Per-date time exceptions ----
public sealed record DateTimeSlotExceptionAdminDto(
    int Id, string Date, int TimeSlotId, string StartTime, string EndTime, bool IsBlocked, string? Note);
public sealed record UpsertExceptionDto(string Date, int TimeSlotId, bool IsBlocked, string? Note);

// ---- Bookings ----
public sealed record BookingAdminDto(
    int Id,
    string PublicNumber,
    string Date,
    int LocationId,
    string LocationName,
    int TimeSlotId,
    string StartTime,
    string EndTime,
    string? FirstName,
    string? LastName,
    string? Phone,
    string? Comment,
    bool IsBooked,
    string CreatedAtUtc,
    string? BookedAtUtc,
    string? CancelledAtUtc);

public sealed record BookingListResultDto(List<BookingAdminDto> Items, int TotalCount, int Page, int PageSize);

// ---- Dashboard ----
public sealed record LocationFillRateDto(
    int LocationId, string LocationName, int Capacity, int Booked, int FillRatePercent);

public sealed record DashboardDto(
    int TodayBookedCount,
    int UpcomingBookedCount,
    List<LocationFillRateDto> TodayByLocation,
    List<LocationFillRateDto> UpcomingByLocation);
