using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Options;
using Stand.Server.Services;

internal static class BookingStartChecks
{
    public static void RunBoundaries()
    {
        var date = new DateOnly(2035, 1, 15);
        var clock = new TestClock(date.ToDateTime(new TimeOnly(9, 30)));
        var availability = new AvailabilityService(null!, clock, Options.Create(new BookingOptions()), null!);
        foreach (var secondsBefore in new[] { 3600, 1800, 60, 1, 0, -1, -3600 })
        {
            clock.NowLocal = date.ToDateTime(new TimeOnly(10, 0)).AddSeconds(-secondsBefore);
            Check(availability.IsSlotTooSoon(date, new TimeOnly(10, 0)) == (secondsBefore <= 0),
                $"Booking cutoff at {secondsBefore} seconds before start");
        }
        clock.NowLocal = date.ToDateTime(new TimeOnly(23, 59, 59));
        Check(!availability.IsSlotTooSoon(date.AddDays(1), TimeOnly.MinValue),
            "Tomorrow's midnight slot is bookable one second before start");
        Check(availability.IsSlotTooSoon(date.AddDays(-1), new TimeOnly(10, 0)),
            "Past slots remain closed");
    }

    public static async Task Run(string connection)
    {
        var dbOptions = new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(connection).Options;
        await using var setup = new StandDbContext(dbOptions);
        // Use unused dates so these checks never replace an existing schedule.
        var date = new DateOnly(2035, 1, 15);
        while (await setup.AvailableDates.AnyAsync(d => d.Date == date || d.Date == date.AddDays(1)))
            date = date.AddDays(2);
        var days = new[] { date, date.AddDays(1) };
        var location = new Location { Name = "Booking start " + Guid.NewGuid(), Capacity = 2, IsActive = true };
        var user = new AuthorizedUser { FirstName = "Booking", LastName = "Start", IsActive = true,
            Phone = "+38069" + Random.Shared.Next(1000000, 9999999) };
        var slots = new[]
        {
            new TimeSlot { StartTime = new(10, 0), EndTime = new(11, 0), IsActive = true, IsScheduleOnly = true },
            new TimeSlot { StartTime = new(0, 0), EndTime = new(1, 0), IsActive = true, IsScheduleOnly = true },
        };
        // Reuse ranges if they already exist, without changing their configuration.
        var createdSlots = new List<TimeSlot>();
        for (var i = 0; i < slots.Length; i++)
        {
            var start = slots[i].StartTime;
            var end = slots[i].EndTime;
            var existing = await setup.TimeSlots.SingleOrDefaultAsync(s => s.StartTime == start && s.EndTime == end);
            if (existing is not null) slots[i] = existing;
            else createdSlots.Add(slots[i]);
        }
        setup.AddRange(location, user);
        setup.AddRange(createdSlots);
        await setup.SaveChangesAsync();
        var clock = new TestClock(date.ToDateTime(new TimeOnly(9, 30)));
        var options = Options.Create(new BookingOptions());
        try
        {
            setup.AddRange(days.Select(day => new AvailableDate { Date = day, IsActive = true, UseCustomSchedule = true }));
            setup.AddRange(days.Select((day, i) => new ScheduleSlot
                { Date = day, LocationId = location.Id, TimeSlotId = slots[i].Id, Capacity = 2 }));
            await setup.SaveChangesAsync();

            async Task CheckAvailability(bool bookable)
            {
                await using var db = new StandDbContext(dbOptions);
                var availability = new AvailabilityService(db, clock, options, new CurrentPublicUser(db));
                var slot = (await availability.GetSlotsAsync(date, location.Id, default)).Single();
                Check(slot.IsBookable == bookable && slot.IsTooSoon != bookable,
                    $"Slot availability at {clock.NowLocal:HH:mm:ss}");
                var locations = await availability.GetActiveLocationsAsync(default, date);
                Check(locations.Single(l => l.Id == location.Id).HasAvailableBookings == bookable,
                    $"Location availability at {clock.NowLocal:HH:mm:ss}");
                var calendar = await availability.GetCalendarAsync(default);
                Check(calendar.BookableDates.Contains(date.ToString("yyyy-MM-dd")) == bookable,
                    $"Calendar availability at {clock.NowLocal:HH:mm:ss}");
            }
            foreach (var secondsBefore in new[] { 1800, 60, 1, 0, -1 })
            {
                clock.NowLocal = date.ToDateTime(new TimeOnly(10, 0)).AddSeconds(-secondsBefore);
                await CheckAvailability(secondsBefore > 0);
            }
            async Task Book(int slotIndex, DateOnly day)
            {
                await using var db = new StandDbContext(dbOptions);
                var current = new CurrentPublicUser(db);
                var availability = new AvailabilityService(db, clock, options, current);
                var service = new BookingService(db, clock, availability, NullLogger<BookingService>.Instance, current);
                var booking = await service.BookAsync(day, location.Id, slots[slotIndex].Id, user.Id, default);
                Check(booking.IsBooked, "Direct booking succeeds one second before slot start");
                await service.CancelAsync(Guid.Parse(booking.CancelToken), default);
            }
            clock.NowLocal = date.ToDateTime(new TimeOnly(9, 59, 59));
            await Book(0, date);
            clock.NowLocal = date.ToDateTime(new TimeOnly(10, 0));
            try
            {
                await Book(0, date);
                throw new Exception("Direct booking accepted a started slot");
            }
            catch (ValidationAppException e) when (e.ErrorCode == ErrorCodes.SlotTooSoon)
            { Console.WriteLine("PASS Direct booking rejects a slot exactly at start"); }
            clock.NowLocal = date.ToDateTime(new TimeOnly(23, 59, 59));
            await Book(1, date.AddDays(1));
        }
        finally
        {
            await setup.Bookings.Where(b => b.LocationId == location.Id).ExecuteDeleteAsync();
            await setup.ScheduleSlots.Where(s => s.LocationId == location.Id).ExecuteDeleteAsync();
            await setup.AvailableDates.Where(d => days.Contains(d.Date)).ExecuteDeleteAsync();
            await setup.Locations.Where(l => l.Id == location.Id).ExecuteDeleteAsync();
            await setup.AuthorizedUsers.Where(u => u.Id == user.Id).ExecuteDeleteAsync();
            var createdIds = createdSlots.Select(s => s.Id).ToArray();
            await setup.TimeSlots.Where(s => createdIds.Contains(s.Id)).ExecuteDeleteAsync();
        }
    }

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
        Console.WriteLine("PASS " + message);
    }

    private sealed class TestClock(DateTime now) : IKyivClock
    {
        public DateTime NowLocal { get; set; } = now;
        public DateOnly TodayLocal => DateOnly.FromDateTime(NowLocal);
        public DateTime UtcNow => ToUtc(NowLocal);
        // Fixtures use January dates, when Kyiv is UTC+2. Keep the fake clock
        // independent of the host's installed IANA/Windows time zone mappings.
        public DateTime ToUtc(DateTime localTime) => DateTime.SpecifyKind(localTime.AddHours(-2), DateTimeKind.Utc);
    }
}
