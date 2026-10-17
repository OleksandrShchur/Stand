namespace Stand.Server.Options;

/// <summary>Business rule configuration for the booking flow.</summary>
public sealed class BookingOptions
{
    public const string SectionName = "Booking";

    /// <summary>How many days ahead (from today, inclusive) a date may be enabled for booking.</summary>
    public int HorizonDays { get; set; } = 14;

    /// <summary>
    /// Minimum minutes from now until a slot's start time for it to be bookable.
    /// Applies especially to same-day bookings (e.g. 60 = at least +1 hour).
    /// </summary>
    public int MinLeadTimeMinutes { get; set; } = 60;

    /// <summary>IANA time zone id used to compute "today" civil dates and local "now".</summary>
    public string TimeZoneId { get; set; } = "Europe/Kyiv";
}
