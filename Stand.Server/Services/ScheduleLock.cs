using Microsoft.EntityFrameworkCore;
using Stand.Server.Data;

namespace Stand.Server.Services;

public static class ScheduleLock
{
    // Coordinate changes to the default capacity of dates using the legacy schedule.
    public static Task AcquireLocationAsync(StandDbContext db, int locationId, bool exclusive, CancellationToken ct)
    {
        var resource = $"stand:location:{locationId}";
        var mode = exclusive ? "Exclusive" : "Shared";
        return db.Database.ExecuteSqlInterpolatedAsync($"""
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock @Resource = {resource}, @LockMode = {mode},
                @LockOwner = 'Transaction', @LockTimeout = 15000;
            IF @result < 0 THROW 51000, 'Location is busy. Please retry.', 1;
            """, ct);
    }

    public static Task AcquireCatalogAsync(StandDbContext db, CancellationToken ct) => db.Database.ExecuteSqlRawAsync("""
        DECLARE @result int;
        EXEC @result = sys.sp_getapplock @Resource = 'stand:schedule:catalog', @LockMode = 'Exclusive',
            @LockOwner = 'Transaction', @LockTimeout = 15000;
        IF @result < 0 THROW 51000, 'Schedule is busy. Please retry.', 1;
        """, ct);

    // Both the availability check and booking INSERT run under the shared date lock.
    // A schedule replacement waits for those bookings before assessing its warnings.
    public static Task AcquireAsync(StandDbContext db, DateOnly date, bool exclusive, CancellationToken ct)
    {
        var resource = $"stand:schedule:{date:yyyy-MM-dd}";
        var mode = exclusive ? "Exclusive" : "Shared";
        return db.Database.ExecuteSqlInterpolatedAsync($"""
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock @Resource = {resource}, @LockMode = {mode},
                @LockOwner = 'Transaction', @LockTimeout = 15000;
            IF @result < 0 THROW 51000, 'Schedule is busy. Please retry.', 1;
            """, ct);
    }
}
