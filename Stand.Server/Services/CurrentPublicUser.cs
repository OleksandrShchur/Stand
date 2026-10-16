using Microsoft.EntityFrameworkCore;
using Stand.Server.Data;

namespace Stand.Server.Services;

public sealed record PublicUserProfile(int Id, string Phone, string FirstName, string LastName);

// Scoped to one HTTP request: admin changes are still checked on every request.
public sealed class CurrentPublicUser(StandDbContext db)
{
    private readonly Dictionary<int, Task<PublicUserProfile?>> _users = new();

    public Task<PublicUserProfile?> GetAsync(int id, CancellationToken ct)
    {
        if (!_users.TryGetValue(id, out var user))
        {
            user = db.AuthorizedUsers.Where(u => u.Id == id && u.IsActive)
                .Select(u => new PublicUserProfile(u.Id, u.Phone, u.FirstName, u.LastName))
                .SingleOrDefaultAsync(ct);
            _users.Add(id, user);
        }
        return user;
    }
}
