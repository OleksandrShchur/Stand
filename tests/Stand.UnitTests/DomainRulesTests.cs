using Microsoft.Extensions.Configuration;
using Stand.Server.Common;
using Stand.Server.Services;

namespace Stand.UnitTests;

public class PhoneNormalizerTests
{
    [Theory]
    [InlineData("0671234567")]
    [InlineData("671234567")]
    [InlineData("380671234567")]
    [InlineData("+380671234567")]
    [InlineData("  +38 (067) 123-45-67  ")]
    public void CommonFormatsNormalizeToOneIdentity(string input) =>
        Assert.Equal("+380671234567", PhoneNormalizer.TryNormalize(input));

    [Theory]
    [InlineData(null)] [InlineData("")] [InlineData(" \t")]
    [InlineData("+441234567890")] [InlineData("0123456789")]
    [InlineData("067123456")] [InlineData("06712345678")]
    [InlineData("+0671234567")] [InlineData("38067123456")]
    public void InvalidNumbersCannotBecomeBookingIdentities(string? input) =>
        Assert.Null(PhoneNormalizer.TryNormalize(input));

    [Theory]
    [InlineData('3')] [InlineData('5')] [InlineData('6')] [InlineData('7')] [InlineData('9')]
    public void SupportedMobilePrefixesAreAccepted(char prefix) =>
        Assert.Equal($"+380{prefix}71234567", PhoneNormalizer.TryNormalize($"0{prefix}71234567"));
}

public class StatisticsPeriodTests
{
    [Theory]
    [InlineData(2024, 2, "2024-02-29")]
    [InlineData(2025, 2, "2025-02-28")]
    [InlineData(2026, 12, "2026-12-31")]
    public void MonthsIncludeTheirActualLastDay(int year, int month, string end)
    {
        var range = StatisticsPeriod.GetRange("month", year, month, null);
        Assert.Equal(new DateOnly(year, month, 1), range.From);
        Assert.Equal(DateOnly.Parse(end), range.To);
    }

    [Theory]
    [InlineData(1, "2026-01-01", "2026-03-31")]
    [InlineData(2, "2026-04-01", "2026-06-30")]
    [InlineData(3, "2026-07-01", "2026-09-30")]
    [InlineData(4, "2026-10-01", "2026-12-31")]
    public void QuartersSpanExactlyThreeMonths(int quarter, string start, string end) =>
        Assert.Equal((DateOnly.Parse(start), DateOnly.Parse(end)), StatisticsPeriod.GetRange("quarter", 2026, null, quarter));

    [Theory]
    [InlineData("year", 0, null, null)] [InlineData("year", 9999, null, null)]
    [InlineData("month", 2026, 0, null)] [InlineData("month", 2026, 13, null)]
    [InlineData("month", 2026, 1, 1)] [InlineData("quarter", 2026, null, 0)]
    [InlineData("quarter", 2026, null, 5)] [InlineData("quarter", 2026, 1, 1)]
    [InlineData("year", 2026, 1, null)] [InlineData("unknown", 2026, null, null)]
    public void InvalidOrAmbiguousPeriodsAreRejected(string period, int year, int? month, int? quarter) =>
        Assert.Throws<ValidationAppException>(() => StatisticsPeriod.GetRange(period, year, month, quarter));

    [Theory]
    [InlineData(1)] [InlineData(2024)] [InlineData(9998)]
    public void YearBoundsRemainRepresentable(int year) =>
        Assert.Equal((new DateOnly(year, 1, 1), new DateOnly(year, 12, 31)), StatisticsPeriod.GetRange("year", year, null, null));
}

public class ScheduleArchiveTests
{
    private readonly DateOnly today = new(2026, 11, 6);

    [Fact]
    public void TodayAndFutureCanBeEdited() => ScheduleArchive.EnsureEditable([today, today.AddDays(1)], today);

    [Fact]
    public void APreviousDayRejectsTheEntireSelection() =>
        Assert.Throws<ValidationAppException>(() => ScheduleArchive.EnsureEditable([today.AddDays(1), today.AddDays(-1)], today));

    [Fact]
    public void EmptySelectionHasNoArchivedDates() => ScheduleArchive.EnsureEditable([], today);
}

public class ClockAndBookingNumberTests
{
    [Theory]
    [InlineData("2026-07-01T12:00:00", "2026-07-01T09:00:00Z")]
    [InlineData("2026-12-31T00:00:00", "2026-12-30T22:00:00Z")]
    public void LocalTimesUseKyivSeasonalOffset(string local, string utc)
    {
        var clock = new KyivClock(new ConfigurationBuilder().Build());
        Assert.Equal(DateTime.Parse(utc).ToUniversalTime(), clock.ToUtc(DateTime.Parse(local)));
    }

    [Theory]
    [InlineData("UTC")] [InlineData("missing-zone")]
    public void ConfiguredZonesAndFallbackProduceUtc(string zone)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Booking:TimeZoneId"] = zone }).Build();
        var clock = new KyivClock(config);
        Assert.Equal(DateTimeKind.Utc, clock.ToUtc(new DateTime(2026, 11, 6, 12, 0, 0)).Kind);
        Assert.InRange(clock.UtcNow, DateTime.UtcNow.AddSeconds(-2), DateTime.UtcNow.AddSeconds(2));
        Assert.Equal(DateOnly.FromDateTime(clock.NowLocal), clock.TodayLocal);
    }

    [Fact]
    public void BookingNumbersContainDateAndReadableRandomSuffix()
    {
        var numbers = Enumerable.Range(0, 100).Select(_ => BookingNumberGenerator.Generate(new DateOnly(2026, 11, 6))).ToArray();
        Assert.All(numbers, n => Assert.Matches("^STD-20261106-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$", n));
        Assert.True(numbers.Distinct().Count() > 1);
    }
}
