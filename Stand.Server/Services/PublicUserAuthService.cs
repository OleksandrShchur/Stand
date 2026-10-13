using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;

namespace Stand.Server.Services;

public sealed class PublicUserAuthService(StandDbContext db) : IPublicUserAuthService
{
    public async Task<AuthorizedUser?> ValidatePhoneAsync(string phone, CancellationToken ct)
    {
        var normalized = NormalizeOrThrow(phone);
        return await db.AuthorizedUsers
            .FirstOrDefaultAsync(u => u.Phone == normalized && u.IsActive, ct);
    }

    public async Task TouchLastLoginAsync(int authorizedUserId, CancellationToken ct)
    {
        await db.AuthorizedUsers.Where(u => u.Id == authorizedUserId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastLoginAtUtc, DateTime.UtcNow), ct);
    }

    public async Task<AuthorizedUser> CreateAsync(string phone, string firstName, string lastName, CancellationToken ct)
    {
        var normalized = NormalizeOrThrow(phone);
        var names = ValidateNames(firstName, lastName);
        var exists = await db.AuthorizedUsers.AnyAsync(u => u.Phone == normalized, ct);
        if (exists)
        {
            throw new ConflictAppException(ErrorCodes.PhoneTaken, "Такий номер телефону вже додано.");
        }

        var user = new AuthorizedUser { Phone = normalized, FirstName = names.FirstName, LastName = names.LastName, IsActive = true };
        db.AuthorizedUsers.Add(user);
        await db.SaveChangesAsync(ct);
        return user;
    }

    public async Task<AuthorizedUser> UpdateAsync(int id, string phone, string firstName, string lastName, CancellationToken ct)
    {
        var normalized = NormalizeOrThrow(phone);
        var names = ValidateNames(firstName, lastName);
        var user = await db.AuthorizedUsers.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Користувача не знайдено.");
        if (await db.AuthorizedUsers.AnyAsync(u => u.Phone == normalized && u.Id != id, ct))
            throw new ConflictAppException(ErrorCodes.PhoneTaken, "Такий номер телефону вже додано.");

        user.Phone = normalized;
        user.FirstName = names.FirstName;
        user.LastName = names.LastName;
        await db.SaveChangesAsync(ct);
        return user;
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var user = await db.AuthorizedUsers.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Користувача не знайдено.");
        db.AuthorizedUsers.Remove(user);
        await db.SaveChangesAsync(ct);
    }

    private static (string FirstName, string LastName) ValidateNames(string? firstName, string? lastName)
    {
        firstName = firstName?.Trim();
        lastName = lastName?.Trim();
        if (string.IsNullOrEmpty(firstName) || firstName.Length > 100)
            throw new ValidationAppException("Введіть ім'я (до 100 символів).");
        if (string.IsNullOrEmpty(lastName) || lastName.Length > 100)
            throw new ValidationAppException("Введіть прізвище (до 100 символів).");
        return (firstName, lastName);
    }

    public async Task<AuthorizedUser> SetActiveAsync(int authorizedUserId, bool isActive, CancellationToken ct)
    {
        var user = await db.AuthorizedUsers.FirstOrDefaultAsync(u => u.Id == authorizedUserId, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Користувача не знайдено.");

        user.IsActive = isActive;
        await db.SaveChangesAsync(ct);
        return user;
    }

    public async Task<List<AuthorizedUser>> ListAsync(CancellationToken ct) =>
        await db.AuthorizedUsers.OrderBy(u => u.Phone).ToListAsync(ct);

    private static string NormalizeOrThrow(string phone) =>
        PhoneNormalizer.TryNormalize(phone)
        ?? throw new ValidationAppException("Введіть коректний український мобільний номер.", ErrorCodes.InvalidPhone);
}
