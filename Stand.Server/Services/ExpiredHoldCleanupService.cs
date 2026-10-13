using Microsoft.EntityFrameworkCore;
using Stand.Server.Data;

namespace Stand.Server.Services;

/// <summary>
/// Periodically marks expired 'Held' bookings as 'Cancelled' so capacity counts and the admin
/// dashboard stay accurate even without a fresh availability request triggering the filter.
/// This is a convenience cleanup only: availability/booking queries already independently
/// filter out expired holds, so overbooking cannot occur even if this service is delayed.
/// </summary>
public sealed class ExpiredHoldCleanupService(
    IServiceScopeFactory scopeFactory, ILogger<ExpiredHoldCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(20);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await CleanupOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Expired hold cleanup iteration failed");
            }
        }
    }

    private async Task CleanupOnceAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StandDbContext>();
        var now = DateTime.UtcNow;

        var affected = await db.Bookings
            .Where(b => b.Status == "Held" && b.HoldExpiresAtUtc != null && b.HoldExpiresAtUtc < now)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(b => b.Status, "Cancelled")
                .SetProperty(b => b.CancelledAtUtc, now), ct);

        if (affected > 0)
        {
            logger.LogInformation("Expired {Count} stale hold(s)", affected);
        }
    }
}
