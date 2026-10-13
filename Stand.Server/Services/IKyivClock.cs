namespace Stand.Server.Services;

/// <summary>Provides the current instant and the current civil date in Europe/Kyiv time.</summary>
public interface IKyivClock
{
    DateTime UtcNow { get; }

    /// <summary>Current local wall-clock time in Europe/Kyiv (Kind = Unspecified).</summary>
    DateTime NowLocal { get; }

    /// <summary>Today's civil date in Europe/Kyiv.</summary>
    DateOnly TodayLocal { get; }

    DateTime ToUtc(DateTime localTime);
}
