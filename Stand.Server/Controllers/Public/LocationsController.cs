using Microsoft.AspNetCore.Mvc;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Public;

[ApiController]
[Route("api/locations")]
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
