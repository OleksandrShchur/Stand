using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Data;
using Stand.Server.Dtos.Admin;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/feedback")]
[Authorize(AuthenticationSchemes = CookieAuthenticationDefaults.AuthenticationScheme)]
public sealed class AdminFeedbackController(StandDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken ct = default)
    {
        var query = db.Feedback.AsNoTracking();
        var total = await query.CountAsync(ct);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var pageCount = Math.Max(1, (int)Math.Ceiling((double)total / pageSize));
        page = Math.Clamp(page, 1, pageCount);

        var feedback = await query.OrderByDescending(f => f.CreatedAtUtc).ThenByDescending(f => f.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var items = feedback.Select(f => new FeedbackAdminDto(f.Id, f.FirstName, f.LastName, f.Phone,
            f.Comment, DateTime.SpecifyKind(f.CreatedAtUtc, DateTimeKind.Utc).ToString("O"))).ToList();
        return Ok(new FeedbackListResultDto(items, total, page, pageSize));
    }
}
