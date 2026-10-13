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
    /// <summary>The global, active list of duty locations (same for every date/time).</summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await availability.GetActiveLocationsAsync(ct);
        return Ok(result);
    }
}
