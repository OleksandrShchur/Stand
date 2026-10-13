using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stand.Server.Auth;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Public;

[ApiController]
[Route("api/locations")]
[Authorize(AuthenticationSchemes = PublicAuthConstants.AuthenticationScheme)]
public sealed class LocationsController(IAvailabilityService availability) : ControllerBase
{
    /// <summary>Active locations, plus locations with confirmed bookings on a requested past date.</summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct, [FromQuery] DateOnly? date = null)
    {
        var result = await availability.GetActiveLocationsAsync(ct, date);
        return Ok(result);
    }
}
