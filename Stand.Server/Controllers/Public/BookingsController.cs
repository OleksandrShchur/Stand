using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stand.Server.Auth;
using Stand.Server.Common;
using Stand.Server.Dtos.Public;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Public;

[ApiController]
[Route("api/bookings")]
[Authorize(AuthenticationSchemes = PublicAuthConstants.AuthenticationScheme)]
public sealed class BookingsController(IBookingService bookings) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine(CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");

        return Ok(await bookings.GetMyUpcomingShiftsAsync(userId, ct));
    }

    /// <summary>Books a shift immediately, checking capacity within the insert transaction.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBookingRequestDto request, CancellationToken ct)
    {
        if (!DateOnly.TryParse(request.Date, out var date))
        {
            throw new ValidationAppException("Некоректна дата.");
        }

        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");

        var result = await bookings.BookAsync(date, request.LocationId, request.TimeSlotId, userId, ct, ReadRequestId());
        return Ok(result);
    }

    /// <summary>Books a continuous range of shifts together in one transaction.</summary>
    [HttpPost("batch")]
    public async Task<IActionResult> CreateMany([FromBody] CreateBookingsRequestDto request, CancellationToken ct)
    {
        if (!DateOnly.TryParse(request.Date, out var date))
            throw new ValidationAppException("Некоректна дата.");
        if (request.TimeSlotIds is null || request.TimeSlotIds.Count == 0)
            throw new ValidationAppException("Оберіть час.");
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");

        return Ok(await bookings.BookManyAsync(date, request.LocationId, request.TimeSlotIds, userId, ct, ReadRequestId()));
    }

    /// <summary>Fetches a booking summary by its cancel token (success / cancel pages).</summary>
    [HttpGet("{cancelToken:guid}")]
    public async Task<IActionResult> GetByToken(Guid cancelToken, CancellationToken ct)
    {
        var result = await bookings.GetByCancelTokenAsync(cancelToken, ct);
        return Ok(result);
    }

    /// <summary>Cancels a booking using its cancel token (no account required).</summary>
    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel([FromBody] CancelRequestDto request, CancellationToken ct)
    {
        if (!Guid.TryParse(request.CancelToken, out var token))
        {
            throw new ValidationAppException("Некоректний код скасування.");
        }

        var result = await bookings.CancelAsync(token, ct);
        return Ok(result);
    }

    private Guid? ReadRequestId()
    {
        if (!Request.Headers.TryGetValue("Idempotency-Key", out var value)) return null;
        if (value.Count != 1 || !Guid.TryParse(value[0], out var key) || key == Guid.Empty)
            throw new ValidationAppException("Некоректний ключ запиту.");
        return key;
    }
}
