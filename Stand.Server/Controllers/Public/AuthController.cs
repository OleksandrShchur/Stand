using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Stand.Server.Auth;
using Stand.Server.Common;
using Stand.Server.Dtos.Public;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Public;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IPublicUserAuthService authService, CurrentPublicUser currentUser) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("phone-login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] PublicLoginRequestDto request, CancellationToken ct)
    {
        var user = await authService.ValidatePhoneAsync(request.Phone, ct);
        if (user is null)
        {
            throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Номер не знайдено в системі.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.MobilePhone, user.Phone),
            new(PublicAuthConstants.IssuedAtUtcTicksClaim, DateTime.UtcNow.Ticks.ToString()),
        };
        var identity = new ClaimsIdentity(claims, PublicAuthConstants.AuthenticationScheme);
        await HttpContext.SignInAsync(PublicAuthConstants.AuthenticationScheme, new ClaimsPrincipal(identity));

        await authService.TouchLastLoginAsync(user.Id, ct);

        return Ok(new PublicUserMeDto(user.Id, user.Phone));
    }

    [HttpPost("logout")]
    [Authorize(AuthenticationSchemes = PublicAuthConstants.AuthenticationScheme)]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(PublicAuthConstants.AuthenticationScheme);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize(AuthenticationSchemes = PublicAuthConstants.AuthenticationScheme)]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var profile = await currentUser.GetAsync(id, ct)
            ?? throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");
        return Ok(new PublicUserMeDto(id, profile.Phone));
    }
}
