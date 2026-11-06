using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Controllers.Admin;
using Stand.Server.Data;
using Stand.Server.Dtos.Admin;
using Stand.Server.Options;
using Stand.Server.Services;

namespace Stand.UnitTests;

public sealed class ValidationTests
{
    // No provider is configured: invalid input must fail before touching persistence.
    private static StandDbContext NoDatabase() => new(new Microsoft.EntityFrameworkCore.DbContextOptions<StandDbContext>());

    public static TheoryData<string, int> InvalidLocations => new()
    {
        { "", 2 }, { "  ", 2 }, { new string('x', 201), 2 }, { "Name", 0 }, { "Name", -1 },
    };

    [Theory, MemberData(nameof(InvalidLocations))]
    public async Task InvalidLocationsNeverReachPersistence(string name, int capacity)
    {
        await using var db = NoDatabase();
        var controller = new AdminLocationsController(db);
        await Assert.ThrowsAsync<ValidationAppException>(() => controller.Create(new(name, null, capacity, 0, true), default));
        await Assert.ThrowsAsync<ValidationAppException>(() => controller.Update(1, new(name, null, capacity, 0, true), default));
    }

    [Theory]
    [InlineData("bad", "10:00")] [InlineData("09:00", "bad")]
    [InlineData("10:00", "10:00")] [InlineData("11:00", "10:00")]
    public async Task InvalidTimeRangesNeverReachPersistence(string start, string end)
    {
        await using var db = NoDatabase();
        var controller = new AdminTimeSlotsController(db);
        await Assert.ThrowsAsync<ValidationAppException>(() => controller.Create(new(start, end, 0, true), default));
        await Assert.ThrowsAsync<ValidationAppException>(() => controller.Update(1, new(start, end, 0, true), default));
    }

    [Theory]
    [InlineData("ab", "long-password")] [InlineData("   ", "long-password")]
    [InlineData("valid", "short")]
    public async Task InvalidAdminCredentialsNeverReachPersistence(string login, string password)
    {
        await using var db = NoDatabase();
        var service = new AdminAuthService(db);
        await Assert.ThrowsAsync<ValidationAppException>(() => service.CreateAsync(login, password, default));
        await Assert.ThrowsAsync<ValidationAppException>(() => service.CreateAsync(new string('a', 51), "long-password", default));
    }

    public static TheoryData<string, string, string> InvalidPeople => new()
    {
        { "bad", "First", "Last" }, { "0671234567", " ", "Last" }, { "0671234567", "First", " " },
        { "0671234567", new string('x', 101), "Last" }, { "0671234567", "First", new string('x', 101) },
    };

    [Theory, MemberData(nameof(InvalidPeople))]
    public async Task InvalidPeopleNeverReachPersistence(string phone, string first, string last)
    {
        await using var db = NoDatabase();
        var service = new PublicUserAuthService(db);
        await Assert.ThrowsAsync<ValidationAppException>(() => service.CreateAsync(phone, first, last, default));
        await Assert.ThrowsAsync<ValidationAppException>(() => service.UpdateAsync(1, phone, first, last, default));
    }

    public static IEnumerable<object[]> InvalidSchedules()
    {
        var day = new List<string> { "2030-01-15" };
        yield return [new SaveScheduleDto([], true, [])];
        yield return [new SaveScheduleDto(Enumerable.Repeat(day[0], 367).ToList(), true, [])];
        yield return [new SaveScheduleDto(day, true, null!)];
        yield return [new SaveScheduleDto(day, true, Enumerable.Range(1, 101).Select(id => new ScheduleLocationInputDto(id, [])).ToList())];
        yield return [new SaveScheduleDto(["invalid"], true, [])];
        yield return [new SaveScheduleDto(["2029-12-31"], true, [])];
        yield return [new SaveScheduleDto(day, true, [new(1, []), new(1, [])])];
        yield return [new SaveScheduleDto(day, true, [new(1, [])])];
        yield return [new SaveScheduleDto(day, true, [new(1, null!)])];
        yield return [new SaveScheduleDto(day, true, [new(1, Enumerable.Repeat(new ScheduleRangeDto("09:00", "10:00"), 145).ToList())])];
        foreach (var range in new[] { new ScheduleRangeDto("bad", "10:00"), new("09:00", "bad"), new("10:00", "09:00"), new("09:00", "09:00") })
            yield return [new SaveScheduleDto(day, true, [new(1, [range])])];
        yield return [new SaveScheduleDto(day, true, [new(1, [new("09:00", "11:00"), new("10:00", "12:00")])])];
    }

    [Theory, MemberData(nameof(InvalidSchedules))]
    public async Task InvalidSchedulesRejectPreviewAndSaveBeforeTransactions(SaveScheduleDto schedule)
    {
        await using var db = NoDatabase();
        var controller = new AdminScheduleController(db, Options.Create(new BookingOptions()), new FixedClock());
        await Assert.ThrowsAsync<ValidationAppException>(() => controller.Preview(schedule, default));
        await Assert.ThrowsAsync<ValidationAppException>(() => controller.Save(schedule, default));
    }

    [Theory]
    [InlineData(-1)] [InlineData(15)]
    public async Task DatesOutsideTheBookingHorizonRejectWithoutDatabaseAccess(int offset)
    {
        await using var db = NoDatabase();
        var clock = new FixedClock();
        var service = new AvailabilityService(db, clock, Options.Create(new BookingOptions { HorizonDays = 14 }), new CurrentPublicUser(db));
        var error = await Assert.ThrowsAsync<ValidationAppException>(() => service.EnsureDateBookableAsync(clock.TodayLocal.AddDays(offset), default));
        Assert.Equal(ErrorCodes.DateNotBookable, error.ErrorCode);
    }

    private sealed class FixedClock : IKyivClock
    {
        public DateOnly TodayLocal => new(2030, 1, 1);
        public DateTime NowLocal => TodayLocal.ToDateTime(new TimeOnly(9, 30));
        public DateTime UtcNow => NowLocal.AddHours(-2);
        public DateTime ToUtc(DateTime localTime) => localTime.AddHours(-2);
    }
}
