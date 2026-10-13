namespace Stand.Server.Common;

/// <summary>
/// Machine-readable error codes returned in the ProblemDetails "errorCode" extension so the
/// frontend can branch on them without parsing human-readable (Ukrainian) messages.
/// </summary>
public static class ErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string InvalidPhone = "INVALID_PHONE";
    public const string NotFound = "NOT_FOUND";
    public const string DateNotBookable = "DATE_NOT_BOOKABLE";
    public const string LocationNotFound = "LOCATION_NOT_FOUND";
    public const string LocationInactive = "LOCATION_INACTIVE";
    public const string TimeSlotNotFound = "TIME_SLOT_NOT_FOUND";
    public const string TimeSlotBlocked = "TIME_SLOT_BLOCKED";
    public const string SlotTooSoon = "SLOT_TOO_SOON";
    public const string SlotFull = "SLOT_FULL";
    public const string HoldNotFound = "HOLD_NOT_FOUND";
    public const string HoldExpired = "HOLD_EXPIRED";
    public const string AlreadyConfirmed = "ALREADY_CONFIRMED";
    public const string AlreadyCancelled = "ALREADY_CANCELLED";
    public const string DuplicatePhoneSlot = "DUPLICATE_PHONE_SLOT";
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
    public const string AccountDisabled = "ACCOUNT_DISABLED";
    public const string LoginTaken = "LOGIN_TAKEN";
    public const string Conflict = "CONFLICT";
}
