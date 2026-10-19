using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;

namespace Stand.Server.Services;

public sealed class FeedbackService(StandDbContext db, CurrentPublicUser currentUser)
{
    public const int MaxCommentLength = 500;

    public async Task SubmitAsync(int userId, string? comment, CancellationToken ct)
    {
        var user = await currentUser.GetAsync(userId, ct)
            ?? throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");
        if (string.IsNullOrWhiteSpace(comment))
            throw new ValidationAppException("Напишіть відгук перед надсиланням.");
        if (comment.Length > MaxCommentLength)
            throw new ValidationAppException($"Відгук має містити не більше {MaxCommentLength} символів.");

        db.Feedback.Add(new Feedback
        {
            AuthorizedUserId = user.Id,
            Phone = user.Phone,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Comment = comment.Trim(),
        });
        await db.SaveChangesAsync(ct);
    }
}
