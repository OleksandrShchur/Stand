using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stand.Server.Auth;
using Stand.Server.Common;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Public;

[ApiController]
[Route("api/slots")]
[Authorize(AuthenticationSchemes = PublicAuthConstants.AuthenticationScheme)]
public sealed class SlotsController(IAvailabilityService availability) : ControllerBase
{
    /// <summary>Time slots for a given date + location, with remaining capacity.</summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string date, [FromQuery] int locationId, CancellationToken ct)
    {
        if (!DateOnly.TryParse(date, out var parsedDate))
        {
            throw new ValidationAppException("Некоректна дата.");
        }

        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");

        var result = await availability.GetSlotsAsync(parsedDate, locationId, ct, userId);
        return Ok(result);
    }
}
