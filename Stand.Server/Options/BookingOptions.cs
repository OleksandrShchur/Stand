namespace Stand.Server.Options;

/// <summary>Business rule configuration for the booking flow.</summary>
public sealed class BookingOptions
{
    public const string SectionName = "Booking";

    /// <summary>How many days ahead (from today, inclusive) a date may be enabled for booking.</summary>
    public int HorizonDays { get; set; } = 14;

    /// <summary>IANA time zone id used to compute "today" civil dates and local "now".</summary>
    public string TimeZoneId { get; set; } = "Europe/Kyiv";
}
