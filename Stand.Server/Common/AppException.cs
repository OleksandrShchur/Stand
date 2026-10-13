namespace Stand.Server.Common;

/// <summary>
/// Base class for exceptions that carry a machine-readable error code and an HTTP status,
/// so the global exception handler can translate them into a ProblemDetails response.
/// </summary>
public abstract class AppException(string errorCode, int statusCode, string message) : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
    public int StatusCode { get; } = statusCode;
}

public sealed class NotFoundAppException(string errorCode, string message)
    : AppException(errorCode, StatusCodes.Status404NotFound, message);

public sealed class ValidationAppException(string message, string errorCode = ErrorCodes.ValidationError)
    : AppException(errorCode, StatusCodes.Status400BadRequest, message);

public sealed class ConflictAppException(string errorCode, string message)
    : AppException(errorCode, StatusCodes.Status409Conflict, message);

public sealed class UnauthorizedAppException(string errorCode, string message)
    : AppException(errorCode, StatusCodes.Status401Unauthorized, message);
