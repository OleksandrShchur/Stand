using Stand.Server.Data.Entities;

namespace Stand.Server.Services;

public interface IAdminAuthService
{
    Task<AdminUser?> ValidateCredentialsAsync(string login, string password, CancellationToken ct);

    Task TouchLastLoginAsync(int adminUserId, CancellationToken ct);

    Task<AdminUser> CreateAsync(string login, string password, CancellationToken ct);

    Task<AdminUser> SetActiveAsync(int adminUserId, bool isActive, CancellationToken ct);

    Task<List<AdminUser>> ListAsync(CancellationToken ct);
}
