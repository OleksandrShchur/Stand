namespace Stand.Server.Services;

public sealed class KyivClock : IKyivClock
{
    private readonly TimeZoneInfo _timeZone;

    public KyivClock(IConfiguration configuration)
    {
        var tzId = configuration["Booking:TimeZoneId"] ?? "Europe/Kyiv";
        _timeZone = ResolveTimeZone(tzId);
    }

    public DateTime UtcNow => DateTime.UtcNow;

    public DateTime NowLocal => TimeZoneInfo.ConvertTimeFromUtc(UtcNow, _timeZone);

    public DateOnly TodayLocal => DateOnly.FromDateTime(NowLocal);

    public DateTime ToUtc(DateTime localTime) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(localTime, DateTimeKind.Unspecified), _timeZone);

    private static TimeZoneInfo ResolveTimeZone(string ianaOrWindowsId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(ianaOrWindowsId);
        }
        catch (TimeZoneNotFoundException)
        {
            // Fallback for environments without ICU/IANA mapping data (older Windows configs).
            return TimeZoneInfo.FindSystemTimeZoneById("FLE Standard Time");
        }
    }
}
