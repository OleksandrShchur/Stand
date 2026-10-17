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
using Stand.Server.Options;
using Stand.Server.Services;

internal static class ScheduleChecks
{
    public static async Task Run(string connection)
    {
        var options = Options.Create(new BookingOptions());
        var clock = new KyivClock(new ConfigurationBuilder().Build());
        var date = clock.TodayLocal.AddDays(2);
        var nextDate = date.AddDays(1);
        var dateText = date.ToString("yyyy-MM-dd");
        var nextText = nextDate.ToString("yyyy-MM-dd");
        var dbOptions = new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(connection).Options;
        await using var setup = new StandDbContext(dbOptions);
        var oldDates = await setup.AvailableDates.AsNoTracking().Where(d => d.Date == date || d.Date == nextDate).ToListAsync();
        var oldSchedule = await setup.ScheduleSlots.AsNoTracking().Where(s => s.Date == date || s.Date == nextDate).ToListAsync();
        var originalSlotIds = await setup.TimeSlots.Select(s => s.Id).ToListAsync();
        var place = new Location { Name = "Schedule check " + Guid.NewGuid(), IsActive = true, Capacity = 2 };
        var other = new Location { Name = "Other schedule check " + Guid.NewGuid(), IsActive = true, Capacity = 2 };
        var user = new AuthorizedUser { Phone = "+38067" + Random.Shared.Next(1000000, 9999999), FirstName = "Schedule", LastName = "Check", IsActive = true };
        setup.AddRange(place, other, user);
        await setup.SaveChangesAsync();
        void Check(bool condition, string description)
        {
            if (!condition) throw new Exception(description);
            Console.WriteLine("PASS " + description);
        }
        async Task<ScheduleSaveResultDto> Write(SaveScheduleDto dto, bool preview = false)
        {
            await using var db = new StandDbContext(dbOptions);
            var controller = new AdminScheduleController(db, options);
            var result = preview ? await controller.Preview(dto, default) : await controller.Save(dto, default);
            return (ScheduleSaveResultDto)((OkObjectResult)result).Value!;
        }
        AvailabilityService Availability(StandDbContext db) => new(db, clock, options, new CurrentPublicUser(db));
        BookingService Bookings(StandDbContext db) => new(db, clock, Availability(db), options, NullLogger<BookingService>.Instance, new CurrentPublicUser(db));
        SaveScheduleDto Plan(List<string> days, bool active = true, bool acknowledge = false) => new(days, active,
            [new(place.Id, [new("09:00", "12:00"), new("12:00", "13:00"), new("14:00", "17:00")]), new(other.Id, [new("10:15", "11:45")])], acknowledge);
        try
        {
            List<int> legacySlotIds;
            await using (var db = new StandDbContext(dbOptions))
                legacySlotIds = (await Availability(db).GetSlotsAsync(date.AddDays(2), place.Id, default)).Select(s => s.TimeSlotId).ToList();
            var result = await Write(Plan([dateText, nextText], acknowledge: true));
            Check(result.UpdatedDates == 2, "Bulk day copy saves every target atomically");
            int firstId;
            await using (var db = new StandDbContext(dbOptions))
            {
                var locations = await Availability(db).GetActiveLocationsAsync(default, date);
                Check(locations.Where(l => l.Id == place.Id || l.Id == other.Id).Count(l => l.HasAvailableBookings == true) == 2 &&
                    locations.Where(l => l.Id != place.Id && l.Id != other.Id).All(l => l.HasAvailableBookings == false), "Public locations match the selected date schedule");
                var slots = await Availability(db).GetSlotsAsync(date, place.Id, default);
                firstId = slots[0].TimeSlotId;
                Check(slots.Count == 3 && slots[0].StartTime == "09:00" && slots[0].EndTime == "12:00" && slots[2].StartTime == "14:00",
                    "Custom unequal ranges and breaks appear unchanged in the public flow");
                var otherSlots = await Availability(db).GetSlotsAsync(date, other.Id, default);
                Check(otherSlots.Count == 1 && otherSlots[0].StartTime == "10:15", "Each location has independent times");
                Check((await Availability(db).GetSlotsAsync(date.AddDays(2), place.Id, default)).Select(s => s.TimeSlotId).SequenceEqual(legacySlotIds),
                    "Custom ranges do not leak into unchanged legacy dates");
                try { await Bookings(db).BookAsync(date, other.Id, firstId, user.Id, default); throw new Exception("Accepted wrong-location slot"); }
                catch (ValidationAppException e) when (e.ErrorCode == ErrorCodes.TimeSlotBlocked) { Console.WriteLine("PASS Direct booking rejects a slot absent from the location schedule"); }
            }
            string token;
            await using (var db = new StandDbContext(dbOptions))
                token = (await Bookings(db).BookAsync(date, place.Id, firstId, user.Id, default)).CancelToken;
            await Write(Plan([dateText], acknowledge: true));
            await using (var db = new StandDbContext(dbOptions))
            {
                Check((await Availability(db).GetSlotsAsync(date, place.Id, default)).Single(s => s.TimeSlotId == firstId).Booked == 1,
                    "Saving an unchanged range preserves its slot ID and occupied capacity");
                var dashboard = (Stand.Server.Dtos.Admin.DashboardDto)((OkObjectResult)await new AdminDashboardController(db, clock, options).Get(default)).Value!;
                Check(dashboard.UpcomingByLocation.Single(l => l.LocationId == place.Id).FillRatePercent is > 0 and <= 8,
                    "Dashboard capacity includes the actual configured slots across copied dates");
            }
            var changed = new SaveScheduleDto([dateText], true, [new(other.Id, [new("10:15", "11:45")])]);
            var preview = await Write(changed, true);
            Check(preview.PreservedBookings >= 1, "Preview warns about existing bookings outside the new schedule");
            try { await Write(changed); throw new Exception("Saved affected bookings without acknowledgement"); }
            catch (ConflictAppException) { Console.WriteLine("PASS Schedule replacement requires acknowledging existing bookings"); }
            await using (var db = new StandDbContext(dbOptions))
                Check(await db.ScheduleSlots.AnyAsync(s => s.Date == date && s.LocationId == place.Id), "Rejected save leaves the previous schedule intact");
            await Write(changed with { AcknowledgeExistingBookings = true });
            await using (var db = new StandDbContext(dbOptions))
            {
                var summary = await Bookings(db).GetByCancelTokenAsync(Guid.Parse(token), default);
                Check(summary.Status == "Confirmed" && summary.StartTime == "09:00" && summary.EndTime == "12:00", "Closing a location preserves booking status and original times");
                var slots = await Availability(db).GetSlotsAsync(date, place.Id, default);
                Check(slots.Count == 1 && slots[0].IsBlocked && !slots[0].IsBookable && slots[0].Booked == 1,
                    "Preserved bookings remain viewable while removed slots reject new bookings");
                var locations = await Availability(db).GetActiveLocationsAsync(default, date);
                Check(locations.Single(l => l.Id == place.Id).HasAvailableBookings == false, "Closed booked location remains visible as unavailable");
                Check((await Availability(db).GetSlotsAsync(nextDate, place.Id, default)).Count == 3, "Editing one date does not change a copied date");
            }
            await Write(changed with { IsActive = false, AcknowledgeExistingBookings = true });
            await using (var db = new StandDbContext(dbOptions))
            {
                var calendar = await Availability(db).GetCalendarAsync(default);
                Check(!calendar.BookableDates.Contains(dateText) && calendar.ReadOnlyDates.Contains(dateText), "Closing a booked date preserves read-only calendar access");
                Check((await Availability(db).GetSlotsAsync(date, other.Id, default)).All(s => !s.IsBookable), "A closed date blocks all new bookings");
                var admin = new AdminBookingsController(db);
                var bookingId = await db.Bookings.Where(b => b.CancelToken == Guid.Parse(token)).Select(b => b.Id).SingleAsync();
                await admin.Cancel(bookingId, default);
                await admin.Cancel(bookingId, default);
                Check((await Bookings(db).GetByCancelTokenAsync(Guid.Parse(token), default)).Status == "Cancelled", "Admin cancellation is safe to retry");
            }
            var invalid = changed with { Locations = [new(place.Id, [new("09:00", "12:00"), new("11:00", "13:00")])] };
            try { await Write(invalid); throw new Exception("Accepted overlapping ranges"); }
            catch (ValidationAppException) { Console.WriteLine("PASS Server rejects overlapping ranges before changing data"); }
            try { await Write(changed with { Locations = [new(place.Id, [new("17:00", "09:00")])] }); throw new Exception("Accepted overnight range"); }
            catch (ValidationAppException) { Console.WriteLine("PASS Server rejects reversed and overnight ranges"); }
            await Write(new SaveScheduleDto([dateText], true, [], true));
            await using (var db = new StandDbContext(dbOptions))
                Check(!(await Availability(db).GetCalendarAsync(default)).BookableDates.Contains(dateText),
                    "An enabled custom day without available locations is not offered for new bookings");
            // A running booking holds a shared date lock; a schedule write must wait.
            await using (var locked = new StandDbContext(dbOptions))
            {
                await using var tx = await locked.Database.BeginTransactionAsync();
                await ScheduleLock.AcquireAsync(locked, nextDate, false, default);
                var writing = Write(Plan([nextText], acknowledge: true));
                await Task.Delay(150);
                Check(!writing.IsCompleted, "Schedule writes wait for in-flight booking checks");
                await tx.CommitAsync();
                await writing;
            }
        }
        finally
        {
            await using var cleanup = new StandDbContext(dbOptions);
            await cleanup.Database.ExecuteSqlInterpolatedAsync($"DELETE dbo.BookingRequests WHERE AuthorizedUserId = {user.Id}");
            await cleanup.Bookings.Where(b => b.LocationId == place.Id || b.LocationId == other.Id).ExecuteDeleteAsync();
            await cleanup.ScheduleSlots.Where(s => s.Date == date || s.Date == nextDate).ExecuteDeleteAsync();
            foreach (var old in oldDates)
                await cleanup.AvailableDates.Where(d => d.Date == old.Date).ExecuteUpdateAsync(s => s.SetProperty(d => d.IsActive, old.IsActive).SetProperty(d => d.UseCustomSchedule, old.UseCustomSchedule));
            var existingDays = oldDates.Select(d => d.Date).ToList();
            await cleanup.AvailableDates.Where(d => (d.Date == date || d.Date == nextDate) && !existingDays.Contains(d.Date)).ExecuteDeleteAsync();
            cleanup.ScheduleSlots.AddRange(oldSchedule);
            await cleanup.SaveChangesAsync();
            await cleanup.TimeSlots.Where(s => !originalSlotIds.Contains(s.Id) && s.IsScheduleOnly && !s.Bookings.Any() && !cleanup.ScheduleSlots.Any(row => row.TimeSlotId == s.Id)).ExecuteDeleteAsync();
            await cleanup.Locations.Where(l => l.Id == place.Id || l.Id == other.Id).ExecuteDeleteAsync();
            await cleanup.AuthorizedUsers.Where(u => u.Id == user.Id).ExecuteDeleteAsync();
        }
    }
}
