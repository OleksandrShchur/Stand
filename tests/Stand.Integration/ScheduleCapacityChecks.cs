using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Controllers.Admin;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;
using Stand.Server.Dtos.Public;
using Stand.Server.Options;
using Stand.Server.Services;

internal static class ScheduleCapacityChecks
{
    public static async Task Run(string connection)
    {
        var options = Options.Create(new BookingOptions());
        var clock = new KyivClock(new ConfigurationBuilder().Build());
        var date = clock.TodayLocal.AddDays(4);
        var next = date.AddDays(1);
        var days = new[] { date, next };
        var dateText = date.ToString("yyyy-MM-dd");
        var nextText = next.ToString("yyyy-MM-dd");
        var dbOptions = new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(connection).Options;
        await using var setup = new StandDbContext(dbOptions);
        var oldDates = await setup.AvailableDates.AsNoTracking().Where(d => days.Contains(d.Date)).ToListAsync();
        var oldSlots = await setup.ScheduleSlots.AsNoTracking().Where(s => days.Contains(s.Date)).ToListAsync();
        var originalSlotIds = await setup.TimeSlots.Select(s => s.Id).ToListAsync();
        var place = new Location { Name = "Slot capacity " + Guid.NewGuid(), IsActive = true };
        var other = new Location { Name = "Default capacity " + Guid.NewGuid(), IsActive = true, Capacity = 4 };
        var users = Enumerable.Range(0, 4).Select(i => new AuthorizedUser
        {
            Phone = "+38066" + Random.Shared.Next(1000000, 9999999), FirstName = "Capacity", LastName = "Check" + i, IsActive = true,
        }).ToArray();
        setup.AddRange(place, other);
        setup.AddRange(users);
        await setup.SaveChangesAsync();
        void Check(bool condition, string description)
        {
            if (!condition) throw new Exception(description);
            Console.WriteLine("PASS " + description);
        }
        AvailabilityService Availability(StandDbContext db) => new(db, clock, options, new CurrentPublicUser(db));
        BookingService Bookings(StandDbContext db) => new(db, clock, Availability(db), options, NullLogger<BookingService>.Instance, new CurrentPublicUser(db));
        SaveScheduleDto Plan(List<string> dates, int middleCapacity = 3) => new(dates, true,
            [new(place.Id, [new("09:00", "10:00", 1), new("10:00", "11:00", middleCapacity), new("11:00", "12:00", 4)]),
             new(other.Id, [new("09:00", "10:00")])], true);
        async Task Write(SaveScheduleDto dto, bool preview = false)
        {
            await using var db = new StandDbContext(dbOptions);
            var controller = new AdminScheduleController(db, options);
            if (preview) await controller.Preview(dto, default);
            else await controller.Save(dto, default);
        }
        async Task ExpectConflict(SaveScheduleDto dto, bool preview = false)
        {
            try { await Write(dto, preview); throw new Exception("Accepted capacity below the booking count"); }
            catch (ConflictAppException) { }
        }
        try
        {
            Check(place.Capacity == 2, "New locations default to two places in SQL and EF");
            await Write(Plan([dateText, nextText]));
            List<SlotAvailabilityDto> slots;
            await using (var db = new StandDbContext(dbOptions))
            {
                slots = await Availability(db).GetSlotsAsync(date, place.Id, default);
                Check(slots.Select(s => s.Capacity).SequenceEqual([1, 3, 4]), "Public slots expose independent capacities on the same day and location");
                var copied = await Availability(db).GetSlotsAsync(next, place.Id, default);
                Check(copied.Select(s => s.Capacity).SequenceEqual([1, 3, 4]), "Copying to another date preserves each interval's capacity");
                var day = (await new AdminScheduleController(db, options).Get(dateText, default)).Value!;
                Check(day.Locations.Single(l => l.LocationId == place.Id).Slots.Select(s => s.Capacity).SequenceEqual(new int?[] { 1, 3, 4 }),
                    "Admin schedule round-trips per-interval capacities");
                Check((await Availability(db).GetSlotsAsync(date, other.Id, default)).Single().Capacity == 4,
                    "An omitted capacity uses that location's default when saving");
                await new AdminLocationsController(db).Update(place.Id, new(place.Name, null, 5, 0, true), default);
                Check((await Availability(db).GetSlotsAsync(date, place.Id, default)).Select(s => s.Capacity).SequenceEqual([1, 3, 4]),
                    "Changing the location default does not change saved interval capacities");
            }
            async Task<BookingSummaryDto?> Attempt(int userId, int slotId)
            {
                await using var db = new StandDbContext(dbOptions);
                try { return await Bookings(db).BookAsync(date, place.Id, slotId, userId, default); }
                catch (ConflictAppException e) when (e.ErrorCode == ErrorCodes.SlotFull) { return null; }
            }
            var first = await Task.WhenAll(users.Select(u => Attempt(u.Id, slots[0].TimeSlotId)));
            var middle = await Task.WhenAll(users.Select(u => Attempt(u.Id, slots[1].TimeSlotId)));
            Check(first.Count(b => b is not null) == 1 && middle.Count(b => b is not null) == 3,
                "Concurrent bookings enforce capacities one and three rather than the location default five");
            await using (var db = new StandDbContext(dbOptions))
            {
                var available = await Availability(db).GetSlotsAsync(date, place.Id, default);
                Check(available[0].IsFull && available[1].IsFull && available[2].Remaining == 4,
                    "Availability and remaining places use each interval's capacity");
                var dashboard = (DashboardDto)((OkObjectResult)await new AdminDashboardController(db, new ScheduleClock(clock, date),
                    Options.Create(new BookingOptions { HorizonDays = 1 })).Get(default)).Value!;
                Check(dashboard.UpcomingByLocation.Single(l => l.LocationId == place.Id).FillRatePercent == 25,
                    "Dashboard sums interval capacities across dates instead of multiplying the location default");
                var unbookedUser = users[Array.FindIndex(first, b => b is null)];
                try
                {
                    await Bookings(db).BookManyAsync(date, place.Id, slots.Select(s => s.TimeSlotId).ToArray(), unbookedUser.Id, default);
                    throw new Exception("Accepted a batch containing full intervals");
                }
                catch (ConflictAppException e) when (e.ErrorCode == ErrorCodes.SlotFull) { }
                Check(!await db.Bookings.AnyAsync(b => b.LocationId == place.Id && b.Date == date && b.TimeSlotId == slots[2].TimeSlotId),
                    "A batch containing a full interval creates no partial bookings");
            }
            await Write(new SaveScheduleDto([dateText], true, [new(place.Id, [new("09:00", "10:00", 1)])], true));
            await using (var db = new StandDbContext(dbOptions))
            {
                var todayAvailability = new AvailabilityService(db, new ScheduleClock(clock, date), options, new CurrentPublicUser(db));
                Check((await todayAvailability.GetActiveLocationsAsync(default, date)).Single(l => l.Id == place.Id).HasAvailableBookings == false,
                    "A location with full custom intervals is unavailable even when its default capacity is higher");
                var calendar = await todayAvailability.GetCalendarAsync(default);
                Check(!calendar.BookableDates.Contains(dateText) && calendar.ReadOnlyDates.Contains(dateText),
                    "Today's calendar uses custom interval capacity when every interval is full");
            }
            await Write(Plan([dateText]));
            await ExpectConflict(Plan([dateText], 2), true);
            await ExpectConflict(Plan([dateText], 2));
            await ExpectConflict(Plan([nextText, dateText], 2));
            await using (var db = new StandDbContext(dbOptions))
                Check((await db.ScheduleSlots.Where(s => days.Contains(s.Date) && s.LocationId == place.Id && s.TimeSlotId == slots[1].TimeSlotId)
                    .Select(s => s.Capacity).ToListAsync()).SequenceEqual([3, 3]),
                    "Preview, acknowledged save and multi-date copy reject capacity below bookings without partial changes");

            var booked = middle.Where(b => b is not null).Select(b => b!).ToArray();
            await using (var db = new StandDbContext(dbOptions))
                await Bookings(db).CancelAsync(Guid.Parse(booked[0].CancelToken), default);
            await Write(Plan([dateText], 2));
            await using (var db = new StandDbContext(dbOptions))
            {
                var slot = (await Availability(db).GetSlotsAsync(date, place.Id, default)).Single(s => s.TimeSlotId == slots[1].TimeSlotId);
                Check(slot.Capacity == 2 && slot.Booked == 2 && slot.Remaining == 0,
                    "User cancellation allows reducing capacity to the remaining booking count");
                var bookingId = await db.Bookings.Where(b => b.CancelToken == Guid.Parse(booked[1].CancelToken)).Select(b => b.Id).SingleAsync();
                await new AdminBookingsController(db).Cancel(bookingId, default);
            }
            await Write(Plan([dateText], 1));
            await using (var db = new StandDbContext(dbOptions))
            {
                var slot = (await Availability(db).GetSlotsAsync(date, place.Id, default)).Single(s => s.TimeSlotId == slots[1].TimeSlotId);
                Check(slot.Capacity == 1 && slot.Booked == 1,
                    "Admin cancellation also permits reducing capacity; cancelled history does not count");
            }
            await Write(Plan([dateText], 4));
            await using (var db = new StandDbContext(dbOptions))
                Check((await Availability(db).GetSlotsAsync(date, place.Id, default)).Single(s => s.TimeSlotId == slots[1].TimeSlotId).Remaining == 3,
                    "Increasing an interval capacity immediately offers the new places");

            foreach (var invalid in new[] { 0, -1 })
            {
                try { await Write(Plan([dateText], invalid)); throw new Exception("Accepted nonpositive capacity"); }
                catch (ValidationAppException) { }
            }
            Console.WriteLine("PASS Server rejects zero and negative interval capacities");
            // Legacy dates still use the location default; that edit must follow the same rule.
            var legacyBookings = users.Take(2).Select(user => new Booking
            {
                PublicNumber = Guid.NewGuid().ToString("N")[..20], Date = date.AddYears(-10), LocationId = other.Id,
                TimeSlotId = slots[0].TimeSlotId, IsBooked = true, Phone = user.Phone, FirstName = user.FirstName, LastName = user.LastName,
            }).ToArray();
            setup.AddRange(legacyBookings);
            await setup.SaveChangesAsync();
            await using (var db = new StandDbContext(dbOptions))
            {
                try { await new AdminLocationsController(db).Update(other.Id, new(other.Name, null, 1, 0, true), default); throw new Exception("Lowered the legacy capacity below bookings"); }
                catch (ConflictAppException) { }
            }
            await using (var db = new StandDbContext(dbOptions))
                await Bookings(db).CancelAsync(legacyBookings[0].CancelToken, default);
            await using (var db = new StandDbContext(dbOptions))
            {
                await new AdminLocationsController(db).Update(other.Id, new(other.Name, null, 1, 0, true), default);
                Check((await Availability(db).GetSlotsAsync(date, other.Id, default)).Single().Capacity == 4,
                    "Legacy default reductions require cancellation and leave custom interval capacities unchanged");
            }
            // Saving must revalidate after a preview, including bookings already in flight.
            await Write(Plan([dateText], 1), true);
            await using (var locked = new StandDbContext(dbOptions))
            {
                await using var tx = await locked.Database.BeginTransactionAsync();
                await ScheduleLock.AcquireAsync(locked, date, false, default);
                var existingPhones = await locked.Bookings.Where(b => b.LocationId == place.Id && b.Date == date && b.TimeSlotId == slots[1].TimeSlotId && b.IsBooked)
                    .Select(b => b.Phone).ToListAsync();
                var user = users.First(u => !existingPhones.Contains(u.Phone));
                locked.Bookings.Add(new Booking { PublicNumber = Guid.NewGuid().ToString("N")[..20], Date = date, LocationId = place.Id,
                    TimeSlotId = slots[1].TimeSlotId, IsBooked = true, Phone = user.Phone, FirstName = user.FirstName, LastName = user.LastName });
                await locked.SaveChangesAsync();
                var writing = ExpectConflict(Plan([dateText], 1));
                await Task.Delay(150);
                Check(!writing.IsCompleted, "Capacity changes wait for an in-flight booking transaction");
                await tx.CommitAsync();
                await writing;
                Console.WriteLine("PASS Saving rechecks bookings committed after the preview");
            }
        }
        finally
        {
            await using var cleanup = new StandDbContext(dbOptions);
            await cleanup.Bookings.Where(b => b.LocationId == place.Id || b.LocationId == other.Id).ExecuteDeleteAsync();
            await cleanup.ScheduleSlots.Where(s => days.Contains(s.Date)).ExecuteDeleteAsync();
            foreach (var old in oldDates)
                await cleanup.AvailableDates.Where(d => d.Date == old.Date).ExecuteUpdateAsync(s => s.SetProperty(d => d.IsActive, old.IsActive).SetProperty(d => d.UseCustomSchedule, old.UseCustomSchedule));
            var existingDays = oldDates.Select(d => d.Date).ToArray();
            await cleanup.AvailableDates.Where(d => days.Contains(d.Date) && !existingDays.Contains(d.Date)).ExecuteDeleteAsync();
            cleanup.ScheduleSlots.AddRange(oldSlots);
            await cleanup.SaveChangesAsync();
            await cleanup.TimeSlots.Where(s => !originalSlotIds.Contains(s.Id) && s.IsScheduleOnly && !s.Bookings.Any() && !cleanup.ScheduleSlots.Any(row => row.TimeSlotId == s.Id)).ExecuteDeleteAsync();
            await cleanup.Locations.Where(l => l.Id == place.Id || l.Id == other.Id).ExecuteDeleteAsync();
            var userIds = users.Select(u => u.Id).ToArray();
            await cleanup.AuthorizedUsers.Where(u => userIds.Contains(u.Id)).ExecuteDeleteAsync();
        }
    }

    private sealed class ScheduleClock(IKyivClock clock, DateOnly day) : IKyivClock
    {
        public DateTime NowLocal => day.ToDateTime(TimeOnly.MinValue);
        public DateTime UtcNow => clock.ToUtc(NowLocal);
        public DateOnly TodayLocal => day;
        public DateTime ToUtc(DateTime localTime) => clock.ToUtc(localTime);
    }
}
