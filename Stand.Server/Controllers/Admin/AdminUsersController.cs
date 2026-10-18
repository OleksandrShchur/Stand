using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stand.Server.Common;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/users")]
[Authorize]
public sealed class AdminUsersController(IAdminAuthService authService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var users = await authService.ListAsync(ct);
        return Ok(users.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAdminUserDto dto, CancellationToken ct)
    {
        var user = await authService.CreateAsync(dto.Login, dto.Password, ct);
        return Ok(ToDto(user));
    }

    [HttpPost("{id:int}/disable")]
    public async Task<IActionResult> Disable(int id, CancellationToken ct)
    {
        EnsureNotSelf(id, "Неможливо вимкнути власний акаунт.");
        var user = await authService.SetActiveAsync(id, false, ct);
        return Ok(ToDto(user));
    }

    [HttpPut("{id:int}/password")]
    public async Task<IActionResult> ChangePassword(int id, [FromBody] ChangeAdminPasswordDto dto, CancellationToken ct)
    {
        await authService.ChangePasswordAsync(id, dto.Password, dto.ConfirmPassword, ct);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var currentId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await authService.DeleteAsync(id, currentId, ct);
        return NoContent();
    }

    [HttpPost("{id:int}/enable")]
    public async Task<IActionResult> Enable(int id, CancellationToken ct)
    {
        var user = await authService.SetActiveAsync(id, true, ct);
        return Ok(ToDto(user));
    }

    private void EnsureNotSelf(int id, string message)
    {
        var currentId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (currentId == id)
        {
            throw new ValidationAppException(message);
        }
    }

    private static AdminUserDto ToDto(Data.Entities.AdminUser u) =>
        new(u.Id, u.Login, u.IsActive, u.CreatedAtUtc.ToString("O"), u.LastLoginAtUtc?.ToString("O"));
}
