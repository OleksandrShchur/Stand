using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Controllers.Admin;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

internal static class StatisticsChecks
{
    public static void RunBoundaries()
    {
        Check(StatisticsPeriod.GetRange("month", 2040, 2, null) == (new DateOnly(2040, 2, 1), new DateOnly(2040, 2, 29)), "Statistics include leap day");
        Check(StatisticsPeriod.GetRange("quarter", 2040, null, 1) == (new DateOnly(2040, 1, 1), new DateOnly(2040, 3, 31)), "Quarter boundaries are inclusive");
        Check(StatisticsPeriod.GetRange("quarter", 2040, null, 4) == (new DateOnly(2040, 10, 1), new DateOnly(2040, 12, 31)), "Quarter four ends in the selected year");
        foreach (var args in new (string, int, int?, int?)[] {
            ("week", 2040, null, null), ("year", 0, null, null), ("year", 9999, null, null),
            ("month", 2040, null, null), ("month", 2040, 13, null), ("month", 2040, 1, 2),
            ("quarter", 2040, null, 0), ("quarter", 2040, null, 5), ("year", 2040, 1, null),
        })
        {
            try { StatisticsPeriod.GetRange(args.Item1, args.Item2, args.Item3, args.Item4); }
            catch (ValidationAppException) { continue; }
            throw new Exception("Accepted an invalid statistics period");
        }
        Console.WriteLine("PASS Invalid statistics periods are rejected");
    }

    public static async Task Run(string connection)
    {
        await using var db = new StandDbContext(new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(connection).Options);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var controller = new AdminDashboardController(db, new FixedClock());
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var person = new AuthorizedUser { FirstName = "Олена" + suffix, LastName = "Тестова", Phone = "+38068" + Random.Shared.Next(1000000, 9999999), IsActive = false };
        var other = new AuthorizedUser { FirstName = person.FirstName, LastName = person.LastName, Phone = "+38067" + Random.Shared.Next(1000000, 9999999), IsActive = true };
        var location = new Location { Name = "Statistics " + suffix, IsActive = true, Capacity = 99 };
        var archived = new Location { Name = "Archived statistics " + suffix, IsActive = false };
        var slots = new[] {
            new TimeSlot { StartTime = new(8, 15), EndTime = new(9, 45), IsScheduleOnly = true },
            new TimeSlot { StartTime = new(10, 0), EndTime = new(10, 45), IsScheduleOnly = true },
        };
        // Time ranges are immutable and unique; reuse one if already present in the fixture.
        for (var i = 0; i < slots.Length; i++)
        {
            var start = slots[i].StartTime; var end = slots[i].EndTime;
            slots[i] = await db.TimeSlots.SingleOrDefaultAsync(s => s.StartTime == start && s.EndTime == end) ?? slots[i];
        }
        db.AddRange(person, other, location, archived);
        foreach (var slot in slots) if (slot.Id == 0) db.Add(slot);
        await db.SaveChangesAsync();

        async Task Add(DateOnly date, AuthorizedUser user, Location place, int slot = 0, bool booked = true)
        {
            db.Add(new Booking { PublicNumber = Guid.NewGuid().ToString("N")[..20], CancelToken = Guid.NewGuid(),
                Date = date, LocationId = place.Id, TimeSlotId = slots[slot].Id, Phone = user.Phone,
                FirstName = user.FirstName, LastName = user.LastName, IsBooked = booked, CreatedAtUtc = new(2026, 11, 6),
            });
            await db.SaveChangesAsync();
        }
        var leap = new DateOnly(2040, 2, 29);
        await Add(leap, person, location);
        await Add(leap, person, location, 1);
        await Add(leap, other, location);
        await Add(new(2040, 3, 31), person, archived);
        await Add(new(2040, 4, 1), person, location);
        await Add(new(2040, 12, 31), person, location);
        await Add(new(2041, 1, 1), person, location);
        await Add(new(2039, 7, 1), person, location, booked: false);
        await Add(leap, person, location, booked: false);
        var day = await db.AvailableDates.SingleOrDefaultAsync(d => d.Date == leap);
        if (day is null) { day = new AvailableDate { Date = leap }; db.Add(day); }
        day.IsActive = true; day.UseCustomSchedule = true;
        await db.SaveChangesAsync();
        db.ScheduleSlots.AddRange(
            new ScheduleSlot { Date = leap, LocationId = location.Id, TimeSlotId = slots[0].Id, Capacity = 4 },
            new ScheduleSlot { Date = leap, LocationId = location.Id, TimeSlotId = slots[1].Id, Capacity = 2 });
        await db.SaveChangesAsync();

        T Value<T>(IActionResult result) => (T)((OkObjectResult)result).Value!;
        var months = Value<StatisticsPeriodsDto>(await controller.Periods(person.Id, default));
        Check(months.Today == "2041-05-15" && months.Months.SequenceEqual(new StatisticsMonthDto[] {
            new(2041, 1), new(2040, 12), new(2040, 4), new(2040, 3), new(2040, 2),
        }), "Personal periods exclude empty months and cancelled-only years, ordered newest first");
        var monthly = Value<StatisticsDto>(await controller.Get("month", 2040, month: 2, personId: person.Id));
        Check(monthly.Summary.Booked == 2 && monthly.Summary.BookedHours == 2.25m && monthly.Summary.ActiveDays == 1,
            "Personal totals use scheduled dates and exact shift durations, excluding cancellations and same-name users");
        Check(monthly.Summary.FillRatePercent is null && monthly.Trend.Count == 29 && monthly.Trend[^1].Booked == 2 && monthly.Trend[0].Booked == 0,
            "Daily trends retain zero days and leap day; personal reports do not show location occupancy");
        var quarter = Value<StatisticsDto>(await controller.Get("quarter", 2040, quarter: 1, personId: person.Id));
        Check(quarter.Summary.Booked == 3 && quarter.Summary.BookedHours == 3.75m && quarter.Trend.Count == 3 && quarter.ByLocation.Any(l => l.LocationId == archived.Id),
            "Quarter one includes March 31, excludes April 1, and retains inactive locations");
        var annual = Value<StatisticsDto>(await controller.Get("year", 2040, personId: person.Id));
        Check(annual.Summary.Booked == 5 && annual.Summary.BookedHours == 6.75m && annual.Trend.Count == 12 && annual.Summary.LocationCount == 2,
            "Annual statistics include December 31 and exclude January 1 of the next year");
        var global = Value<StatisticsDto>(await controller.Get("month", 2040, month: 2));
        var row = global.ByLocation.Single(l => l.LocationId == location.Id);
        Check(row.Booked == 3 && row.BookedHours == 3.75m && row.ScheduledPlaces == 6 && row.FillRatePercent == 50,
            "Location statistics use saved per-interval capacities, not the current location default");
        Check(Value<StatisticsPersonDto[]>(await controller.People("Ол", default)).Length == 0, "Person search requires three characters");
        var matches = Value<List<StatisticsPersonDto>>(await controller.People("тестова " + person.FirstName.ToLowerInvariant(), default));
        Check(matches.Any(p => p.Id == person.Id) && matches.Any(p => p.Id == other.Id), "Name search matches either word order, case, and inactive site users");
        matches = Value<List<StatisticsPersonDto>>(await controller.People(person.Phone.Insert(6, " "), default));
        Check(matches.Single().Id == person.Id, "Phone search accepts formatting and returns the correct person");
        try { await controller.Get("year", 2039, personId: person.Id); throw new Exception("Accepted a cancelled-only period"); }
        catch (ValidationAppException) { Console.WriteLine("PASS A direct request for a cancelled-only period is rejected"); }
        try { await controller.Periods(-1, default); throw new Exception("Accepted missing person"); }
        catch (NotFoundAppException) { Console.WriteLine("PASS A missing person is rejected"); }
        // The complete fixture is rolled back on disposal.
    }

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
        Console.WriteLine("PASS " + message);
    }

    private sealed class FixedClock : IKyivClock
    {
        public DateOnly TodayLocal => new(2041, 5, 15);
        public DateTime NowLocal => TodayLocal.ToDateTime(TimeOnly.MinValue);
        public DateTime UtcNow => NowLocal.AddHours(-3);
        public DateTime ToUtc(DateTime localTime) => localTime.AddHours(-3);
    }
}
