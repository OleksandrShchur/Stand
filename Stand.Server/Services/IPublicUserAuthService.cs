using Stand.Server.Data.Entities;

namespace Stand.Server.Services;

public interface IPublicUserAuthService
{
    Task<AuthorizedUser?> ValidatePhoneAsync(string phone, CancellationToken ct);

    Task TouchLastLoginAsync(int authorizedUserId, CancellationToken ct);

    Task<AuthorizedUser> CreateAsync(string phone, string firstName, string lastName, CancellationToken ct);

    Task<AuthorizedUser> UpdateAsync(int id, string phone, string firstName, string lastName, CancellationToken ct);

    Task DeleteAsync(int id, CancellationToken ct);

    Task<AuthorizedUser> SetActiveAsync(int authorizedUserId, bool isActive, CancellationToken ct);

    Task<List<AuthorizedUser>> ListAsync(CancellationToken ct);
}
