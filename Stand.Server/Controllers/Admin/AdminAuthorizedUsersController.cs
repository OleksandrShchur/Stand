using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/authorized-users")]
[Authorize]
public sealed class AdminAuthorizedUsersController(IPublicUserAuthService authService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var users = await authService.ListAsync(ct);
        return Ok(users.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAuthorizedUserDto dto, CancellationToken ct)
    {
        var user = await authService.CreateAsync(dto.Phone, dto.FirstName, dto.LastName, ct);
        return Ok(ToDto(user));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateAuthorizedUserDto dto, CancellationToken ct)
    {
        var user = await authService.UpdateAsync(id, dto.Phone, dto.FirstName, dto.LastName, ct);
        return Ok(ToDto(user));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await authService.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:int}/disable")]
    public async Task<IActionResult> Disable(int id, CancellationToken ct)
    {
        var user = await authService.SetActiveAsync(id, false, ct);
        return Ok(ToDto(user));
    }

    [HttpPost("{id:int}/enable")]
    public async Task<IActionResult> Enable(int id, CancellationToken ct)
    {
        var user = await authService.SetActiveAsync(id, true, ct);
        return Ok(ToDto(user));
    }

    private static AuthorizedUserAdminDto ToDto(Data.Entities.AuthorizedUser u) =>
        new(u.Id, u.Phone, u.FirstName, u.LastName, u.IsActive, u.CreatedAtUtc.ToString("O"), u.LastLoginAtUtc?.ToString("O"));
}
