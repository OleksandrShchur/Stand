using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stand.Server.Auth;
using Stand.Server.Common;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Public;

public sealed record CreateFeedbackRequestDto(string? Comment);

[ApiController]
[Route("api/feedback")]
[Authorize(AuthenticationSchemes = PublicAuthConstants.AuthenticationScheme)]
public sealed class FeedbackController(FeedbackService feedback) : ControllerBase
{
    // Submission only: feedback history is never exposed to public users.
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFeedbackRequestDto request, CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");
        await feedback.SubmitAsync(userId, request.Comment, ct);
        return NoContent();
    }
}
