using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Stand.Server.Auth;
using Stand.Server.Common;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/auth")]
public sealed class AdminAuthController(IAdminAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Login) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new ValidationAppException("Введіть логін і пароль.");
        }

        var user = await authService.ValidateCredentialsAsync(request.Login.Trim(), request.Password, ct);
        if (user is null)
        {
            throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Невірний логін або пароль.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Login),
            new(AdminClaimTypes.IssuedAtUtcTicks, DateTime.UtcNow.Ticks.ToString()),
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

        await authService.TouchLastLoginAsync(user.Id, ct);

        return Ok(new AdminMeDto(user.Id, user.Login));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var login = User.FindFirstValue(ClaimTypes.Name)!;
        return Ok(new AdminMeDto(id, login));
    }
}
