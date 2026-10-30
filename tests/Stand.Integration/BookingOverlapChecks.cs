using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Controllers.Admin;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Public;
using Stand.Server.Options;
using Stand.Server.Services;

internal static class BookingOverlapChecks
{
    public static async Task Run(string connection)
    {
        var dbOptions = new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(connection).Options;
        var clock = new KyivClock(new ConfigurationBuilder().Build());
        var options = Options.Create(new BookingOptions());
        var date = clock.TodayLocal.AddDays(4);
        var days = new[] { date, date.AddDays(1) };
        await using var setup = new StandDbContext(dbOptions);
        var oldDays = await setup.AvailableDates.AsNoTracking().Where(d => days.Contains(d.Date)).ToListAsync();
        var places = new[] { "Overlap A ", "Overlap B " }.Select(name => new Location { Name = name + Guid.NewGuid(), Capacity = 20, IsActive = true }).ToArray();
        var users = Enumerable.Range(0, 3).Select(index => new AuthorizedUser {
            Phone = "+38069" + Random.Shared.Next(1000000, 9999999), FirstName = "Overlap", LastName = "User" + index, IsActive = true,
        }).ToArray();
        setup.AddRange(places); setup.AddRange(users); await setup.SaveChangesAsync();
        var createdSlotIds = new List<int>();
        var slots = new Dictionary<string, int>();
        BookingService Service(StandDbContext db) => new(db, clock, new AvailabilityService(db, clock, options, new CurrentPublicUser(db)),
            NullLogger<BookingService>.Instance, new CurrentPublicUser(db));
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
            Console.WriteLine("PASS " + message);
        }
        async Task<BookingSummaryDto> Book(int user, int place, string range, DateOnly? day = null, Guid? key = null)
        {
            await using var db = new StandDbContext(dbOptions);
            return await Service(db).BookAsync(day ?? date, places[place].Id, slots[range], users[user].Id, default, key);
        }
        async Task Reject(Func<Task> action)
        {
            try { await action(); throw new Exception("Overlapping booking was accepted"); }
            catch (ConflictAppException e) when (e.ErrorCode == ErrorCodes.BookingTimeConflict)
            {
                Check(e.Message.Contains(places[0].Name) && e.Message.Contains("09:00–10:00") && e.Message.Contains(date.ToString("dd.MM.yyyy")),
                    "Overlap rejection identifies the existing date, time and location");
            }
        }
        try
        {
            foreach (var range in new[] { "09:00-10:00", "09:30-10:30", "08:30-09:30", "08:00-11:00", "09:15-09:45", "10:00-11:00", "08:00-09:00" })
            {
                var bounds = range.Split('-').Select(TimeOnly.Parse).ToArray();
                var slot = await setup.TimeSlots.FirstOrDefaultAsync(s => s.StartTime == bounds[0] && s.EndTime == bounds[1]);
                if (slot is null)
                {
                    slot = new TimeSlot { StartTime = bounds[0], EndTime = bounds[1], IsActive = true, IsScheduleOnly = true };
                    setup.Add(slot); await setup.SaveChangesAsync(); createdSlotIds.Add(slot.Id);
                }
                slots[range] = slot.Id;
            }
            foreach (var day in days)
            {
                var entry = await setup.AvailableDates.SingleOrDefaultAsync(d => d.Date == day);
                if (entry is null) { entry = new AvailableDate { Date = day }; setup.Add(entry); }
                entry.IsActive = true; entry.UseCustomSchedule = true;
                foreach (var place in places)
                    foreach (var slot in slots.Values)
                        setup.ScheduleSlots.Add(new ScheduleSlot { Date = day, LocationId = place.Id, TimeSlotId = slot, Capacity = 20 });
            }
            await setup.SaveChangesAsync();
            var key = Guid.NewGuid();
            var first = await Book(0, 0, "09:00-10:00", key: key);
            var replay = await Book(0, 0, "09:00-10:00", key: key);
            Check(first.CancelToken == replay.CancelToken, "Idempotent retries still replay the original booking");
            foreach (var range in new[] { "09:00-10:00", "09:30-10:30", "08:30-09:30", "08:00-11:00", "09:15-09:45" })
                await Reject(() => Book(0, 1, range));
            await using (var db = new StandDbContext(dbOptions))
            {
                await Reject(() => Service(db).BookManyAsync(date, places[1].Id, [slots["08:00-09:00"], slots["09:00-10:00"]], users[0].Id, default));
                Check(!await db.Bookings.AnyAsync(b => b.Phone == users[0].Phone && b.LocationId == places[1].Id), "An overlapping batch creates no partial bookings");
            }
            await Book(0, 1, "10:00-11:00");
            await Book(0, 1, "08:00-09:00");
            await Book(0, 1, "09:00-10:00", days[1]);
            await Book(1, 1, "09:30-10:30");
            Console.WriteLine("PASS Adjacent times, other dates and other participants remain bookable");
            await using (var db = new StandDbContext(dbOptions)) await Service(db).CancelAsync(Guid.Parse(first.CancelToken), default);
            var replacement = await Book(0, 1, "09:00-10:00");
            Console.WriteLine("PASS User cancellation frees the overlapping time at another location");
            await using (var db = new StandDbContext(dbOptions))
            {
                var id = await db.Bookings.Where(b => b.CancelToken == Guid.Parse(replacement.CancelToken)).Select(b => b.Id).SingleAsync();
                await new AdminBookingsController(db).Cancel(id, default);
            }
            await Book(0, 0, "09:00-10:00");
            Console.WriteLine("PASS Admin cancellation also frees the overlapping time");
            async Task<bool> Race(int place, string range)
            {
                try { await Book(2, place, range, key: Guid.NewGuid()); return true; }
                catch (ConflictAppException e) when (e.ErrorCode == ErrorCodes.BookingTimeConflict) { return false; }
            }
            var results = await Task.WhenAll(Race(0, "09:00-10:00"), Race(1, "09:30-10:30"));
            await using (var db = new StandDbContext(dbOptions))
                Check(results.Count(success => success) == 1 && await db.Bookings.CountAsync(b => b.Phone == users[2].Phone && b.Date == date && b.IsBooked) == 1,
                    "Concurrent requests at different locations cannot create overlapping bookings for one person");
        }
        finally
        {
            await using var cleanup = new StandDbContext(dbOptions);
            var userIds = users.Select(user => user.Id).ToArray();
            foreach (var id in userIds) await cleanup.Database.ExecuteSqlInterpolatedAsync($"DELETE dbo.BookingRequests WHERE AuthorizedUserId = {id}");
            var placeIds = places.Select(place => place.Id).ToArray();
            await cleanup.Bookings.Where(b => placeIds.Contains(b.LocationId)).ExecuteDeleteAsync();
            await cleanup.ScheduleSlots.Where(s => placeIds.Contains(s.LocationId)).ExecuteDeleteAsync();
            await cleanup.Locations.Where(l => placeIds.Contains(l.Id)).ExecuteDeleteAsync();
            await cleanup.AuthorizedUsers.Where(u => userIds.Contains(u.Id)).ExecuteDeleteAsync();
            await cleanup.TimeSlots.Where(s => createdSlotIds.Contains(s.Id) && !s.Bookings.Any() && !cleanup.ScheduleSlots.Any(row => row.TimeSlotId == s.Id)).ExecuteDeleteAsync();
            foreach (var old in oldDays)
                await cleanup.AvailableDates.Where(d => d.Date == old.Date).ExecuteUpdateAsync(s => s.SetProperty(d => d.IsActive, old.IsActive).SetProperty(d => d.UseCustomSchedule, old.UseCustomSchedule));
            var existingDays = oldDays.Select(day => day.Date).ToArray();
            await cleanup.AvailableDates.Where(d => days.Contains(d.Date) && !existingDays.Contains(d.Date)).ExecuteDeleteAsync();
        }
    }
}
