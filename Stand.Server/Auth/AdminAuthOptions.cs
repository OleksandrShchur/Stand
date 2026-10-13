namespace Stand.Server.Auth;

/// <summary>Admin cookie-authentication tuning.</summary>
public sealed class AdminAuthOptions
{
    public const string SectionName = "AdminAuth";

    /// <summary>Sliding expiration window; the cookie refreshes while the admin is active.</summary>
    public int SlidingExpirationHours { get; set; } = 12;

    /// <summary>Hard cap on session lifetime regardless of activity.</summary>
    public int AbsoluteExpirationDays { get; set; } = 7;
}

public static class AdminClaimTypes
{
    public const string IssuedAtUtcTicks = "iat";
}
