using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Controllers.Admin;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

[Collection(SqlDatabaseCollection.Name)]
public sealed class DateManagementTests
{
    [Fact]
    public async Task SingleAndBulkChangesIncludeOnlySelectedWeekdaysAndPersistUpdates()
    {
        await using var factory = new ApiFactory();
        await using var db = factory.NewDb();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var controller = new AdminDatesController(db, new FixedClock());
        // The entire test is rolled back, including existing rows if the test database has any.
        await db.AvailableDates.Where(d => d.Date.Year == 2044).ExecuteDeleteAsync();
        var created = (AvailableDateAdminDto)((OkObjectResult)await controller.Set(new("2044-02-01", true), default)).Value!;
        var updated = (AvailableDateAdminDto)((OkObjectResult)await controller.Set(new("2044-02-01", false), default)).Value!;
        Assert.Equal(created.Id, updated.Id);
        Assert.False(updated.IsActive);
        Assert.NotNull((await db.AvailableDates.SingleAsync(d => d.Id == created.Id)).UpdatedAtUtc);
        await controller.Bulk(new(2044, 2, [1, 3], true), default);
        var rows = (IEnumerable<AvailableDateAdminDto>)((OkObjectResult)await controller.List("2044-02-01", "2044-02-29", default)).Value!;
        var enabled = rows.Where(d => d.IsActive).ToArray();
        Assert.NotEmpty(enabled);
        Assert.All(enabled, d => Assert.Contains(DateOnly.Parse(d.Date).DayOfWeek, new[] { DayOfWeek.Monday, DayOfWeek.Wednesday }));
        await controller.Bulk(new(2044, 2, [], false), default);
        Assert.Equal(29, await db.AvailableDates.CountAsync(d => d.Date.Year == 2044 && d.Date.Month == 2));
        Assert.False(await db.AvailableDates.AnyAsync(d => d.Date.Year == 2044 && d.IsActive));
        var defaults = (IEnumerable<AvailableDateAdminDto>)((OkObjectResult)await controller.List(null, null, default)).Value!;
        Assert.Equal(29, defaults.Count());
    }

    private sealed class FixedClock : IKyivClock
    {
        public DateOnly TodayLocal => new(2044, 2, 1);
        public DateTime NowLocal => TodayLocal.ToDateTime(TimeOnly.MinValue);
        public DateTime UtcNow => NowLocal.AddHours(-2);
        public DateTime ToUtc(DateTime localTime) => localTime.AddHours(-2);
    }
}
