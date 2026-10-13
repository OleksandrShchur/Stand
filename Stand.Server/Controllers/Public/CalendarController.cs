using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stand.Server.Auth;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Public;

[ApiController]
[Route("api/calendar")]
[Authorize(AuthenticationSchemes = PublicAuthConstants.AuthenticationScheme)]
public sealed class CalendarController(IAvailabilityService availability) : ControllerBase
{
    /// <summary>Admin-enabled bookable dates within the today..+horizon window.</summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await availability.GetCalendarAsync(ct);
        return Ok(result);
    }
}
