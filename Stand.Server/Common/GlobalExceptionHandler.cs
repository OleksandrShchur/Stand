using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Stand.Server.Common;

/// <summary>
/// Converts <see cref="AppException"/>s (and anything unexpected) into RFC 7807 ProblemDetails
/// responses with a machine-readable "errorCode" extension the SPA can switch on, while
/// keeping human-readable messages in Ukrainian for direct display when convenient.
/// </summary>
public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, errorCode, title) = exception switch
        {
            AppException app => (app.StatusCode, app.ErrorCode, app.Message),
            _ => (StatusCodes.Status500InternalServerError, ErrorCodes.Conflict, "Виникла непередбачена помилка. Спробуйте ще раз."),
        };

        if (exception is not AppException)
        {
            logger.LogError(exception, "Unhandled exception while processing {Path}", httpContext.Request.Path);
        }

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Type = $"https://stand.local/errors/{errorCode}",
        };
        problem.Extensions["errorCode"] = errorCode;

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
