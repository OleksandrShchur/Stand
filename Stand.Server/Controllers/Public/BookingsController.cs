using Microsoft.AspNetCore.Mvc;
using Stand.Server.Common;
using Stand.Server.Dtos.Public;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Public;

[ApiController]
[Route("api/bookings")]
public sealed class BookingsController(IBookingService bookings) : ControllerBase
{
    /// <summary>
    /// Soft-holds a seat for the given date/location/time for <see cref="Options.BookingOptions.HoldDurationMinutes"/>
    /// minutes. Returns a hold token used to confirm the booking with contact details.
    /// </summary>
    [HttpPost("hold")]
    public async Task<IActionResult> Hold([FromBody] HoldRequestDto request, CancellationToken ct)
    {
        if (!DateOnly.TryParse(request.Date, out var date))
        {
            throw new ValidationAppException("Некоректна дата.");
        }

        var result = await bookings.HoldAsync(date, request.LocationId, request.TimeSlotId, ct);
        return Ok(result);
    }

    /// <summary>Confirms a held booking by attaching contact details before the hold expires.</summary>
    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm([FromBody] ConfirmRequestDto request, CancellationToken ct)
    {
        if (!Guid.TryParse(request.HoldToken, out var holdToken))
        {
            throw new ValidationAppException("Некоректний токен утримання.", ErrorCodes.HoldNotFound);
        }

        var result = await bookings.ConfirmAsync(
            holdToken, request.FirstName, request.LastName, request.Phone, request.Comment, ct);
        return Ok(result);
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
}
