using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;

namespace Stand.Server.Services;

public sealed class AdminAuthService(StandDbContext db) : IAdminAuthService
{
    private readonly PasswordHasher<AdminUser> _hasher = new();

    public async Task<AdminUser?> ValidateCredentialsAsync(string login, string password, CancellationToken ct)
    {
        var user = await db.AdminUsers.FirstOrDefaultAsync(u => u.Login == login, ct);
        if (user is null || !user.IsActive)
        {
            return null;
        }

        var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded
            ? user
            : null;
    }

    public async Task TouchLastLoginAsync(int adminUserId, CancellationToken ct)
    {
        await db.AdminUsers.Where(u => u.Id == adminUserId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastLoginAtUtc, DateTime.UtcNow), ct);
    }

    public async Task<AdminUser> CreateAsync(string login, string password, CancellationToken ct)
    {
        login = login.Trim();
        if (login.Length is < 3 or > 50)
        {
            throw new ValidationAppException("Логін має містити від 3 до 50 символів.");
        }

        if (password.Length < 8)
        {
            throw new ValidationAppException("Пароль має містити щонайменше 8 символів.");
        }

        var exists = await db.AdminUsers.AnyAsync(u => u.Login == login, ct);
        if (exists)
        {
            throw new ConflictAppException(ErrorCodes.LoginTaken, "Такий логін вже зайнятий.");
        }

        var user = new AdminUser { Login = login, IsActive = true, PasswordHash = string.Empty };
        user.PasswordHash = _hasher.HashPassword(user, password);

        db.AdminUsers.Add(user);
        await db.SaveChangesAsync(ct);
        return user;
    }

    public async Task<AdminUser> SetActiveAsync(int adminUserId, bool isActive, CancellationToken ct)
    {
        var user = await db.AdminUsers.FirstOrDefaultAsync(u => u.Id == adminUserId, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Адміністратора не знайдено.");

        user.IsActive = isActive;
        await db.SaveChangesAsync(ct);
        return user;
    }

    public async Task<List<AdminUser>> ListAsync(CancellationToken ct) =>
        await db.AdminUsers.OrderBy(u => u.Login).ToListAsync(ct);
}
