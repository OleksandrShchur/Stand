using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Options;
using Stand.Server.Services;

static class AdjacentShiftChecks
{
    public static async Task Run(string connection)
    {
        await using var db = new StandDbContext(new DbContextOptionsBuilder<StandDbContext>()
            .UseSqlServer(connection).Options);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var date = new DateOnly(2035, 1, 10);
        var clock = new FixedClock(date.ToDateTime(new TimeOnly(11, 30)));
        var location = new Location { Name = "Adjacent shifts " + Guid.NewGuid(), Capacity = 10, IsActive = true };
        var foreign = new Location { Name = "Other location " + Guid.NewGuid(), Capacity = 10, IsActive = true };
        var user = new AuthorizedUser
        {
            Phone = "+38068" + Random.Shared.Next(1000000, 9999999),
            FirstName = "Current", LastName = "User", IsActive = true,
        };
        db.Add(user);
        await db.SaveChangesAsync();
        async Task<Booking> Add(string start, string end, string? firstName, string? lastName,
            bool booked = true, string? phone = null, Location? at = null, DateOnly? on = null)
        {
            var from = TimeOnly.Parse(start);
            var to = TimeOnly.Parse(end);
            var slot = await db.TimeSlots.FirstOrDefaultAsync(s => s.StartTime == from && s.EndTime == to)
                ?? new TimeSlot { StartTime = from, EndTime = to, IsActive = false, IsScheduleOnly = true };
            var booking = new Booking
            {
                PublicNumber = Guid.NewGuid().ToString("N")[..20], CancelToken = Guid.NewGuid(),
                Location = at ?? location, TimeSlot = slot, Date = on ?? date, IsBooked = booked,
                FirstName = firstName, LastName = lastName, Phone = phone,
            };
            db.Add(booking);
            await db.SaveChangesAsync();
            return booking;
        }
        var mine = await Add("11:00", "12:00", user.FirstName, user.LastName, phone: user.Phone);
        await Add("11:00", "12:00", "Same", "Partner");
        var previous = await Add("10:00", "11:00", "Olena", "B");
        var previousFirst = await Add("10:00", "11:00", "Andrii", "A");
        var next = await Add("12:00", "13:00", "Iryna", "C");
        await Add("10:00", "11:00", "Cancelled", "Previous", booked: false);
        await Add("12:00", "13:00", "Cancelled", "Next", booked: false);
        var ownPrevious = await Add("10:00", "11:00", user.FirstName, user.LastName, phone: user.Phone);
        var ownNext = await Add("12:00", "13:00", user.FirstName, user.LastName, phone: user.Phone);
        await Add("08:00", "09:00", "Gap", "Before");
        await Add("14:00", "15:00", "Gap", "After");
        await Add("10:30", "11:30", "Overlap", "Before");
        await Add("11:30", "12:30", "Overlap", "After");
        await Add("10:00", "11:00", "Foreign", "Before", at: foreign);
        await Add("12:00", "13:00", "Foreign", "After", at: foreign);
        await Add("10:00", "11:00", "Other day", "Before", on: date.AddDays(1));
        await Add("12:00", "13:00", "Other day", "After", on: date.AddDays(1));
        var current = new CurrentPublicUser(db);
        var service = new BookingService(db, clock,
            new AvailabilityService(db, clock, Options.Create(new BookingOptions()), current),
            NullLogger<BookingService>.Instance, current);
        async Task<Stand.Server.Dtos.Public.MyShiftDto> Read(Booking? booking = null) =>
            (await service.GetMyUpcomingShiftsAsync(user.Id, default)).Single(s => s.Id == (booking ?? mine).Id);
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
            Console.WriteLine("PASS " + message);
        }
        var shift = await Read();
        Check(!shift.IsFirstShift, "The user's first upcoming card is not the day's first shift when earlier bookings exist");
        Check(!shift.IsLastShift, "The user's card is not the day's last shift when later bookings exist");
        Check(shift.Participants.Select(p => p.FirstName).SequenceEqual(["Current", "Same"]),
            "The user's own slot includes their name first, followed by their partners");
        Check(shift.PreviousShifts.Count == 1 && shift.PreviousShifts[0].StartTime == "10:00" &&
            shift.PreviousShifts[0].EndTime == "11:00" &&
            shift.PreviousShifts[0].Participants.Select(p => p.FirstName).SequenceEqual(["Current", "Andrii", "Olena"]),
            "A finished adjoining shift includes the user first and other active participants in name order");
        Check(shift.NextShifts.Count == 1 && shift.NextShifts[0].StartTime == "12:00" &&
            shift.NextShifts[0].EndTime == "13:00" &&
            shift.NextShifts[0].Participants.Select(p => p.FirstName).SequenceEqual(["Current", "Iryna"]),
            "The next adjoining shift includes self but excludes cancelled, overlapping, gap, other-location and other-day bookings");
        var json = JsonSerializer.Serialize(shift.PreviousShifts, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Check(!json.Contains("phone", StringComparison.OrdinalIgnoreCase) &&
            !json.Contains("cancelToken", StringComparison.OrdinalIgnoreCase), "Adjacent shifts expose only times and participant names");
        previous.IsBooked = previousFirst.IsBooked = false;
        await db.SaveChangesAsync();
        shift = await Read();
        Check(shift.PreviousShifts.Single().Participants.Single().FirstName == "Current",
            "An adjoining shift with only the user still displays their name");
        ownPrevious.IsBooked = false;
        await db.SaveChangesAsync();
        shift = await Read();
        Check(shift.PreviousShifts.Count == 0 && shift.NextShifts.Count == 1,
            "A side with only cancelled bookings is empty without skipping to a distant occupied slot");
        next.IsBooked = ownNext.IsBooked = false;
        await db.SaveChangesAsync();
        shift = await Read();
        Check(shift.PreviousShifts.Count == 0 && shift.NextShifts.Count == 0, "Both empty sides are omitted independently");

        var customDate = date.AddDays(2);
        var day = await db.AvailableDates.SingleOrDefaultAsync(d => d.Date == customDate);
        if (day is null) db.Add(day = new AvailableDate { Date = customDate, IsActive = true });
        day.UseCustomSchedule = true;
        var first = await Add("09:00", "10:00", user.FirstName, user.LastName, phone: user.Phone, on: customDate);
        var later = await Add("10:00", "11:00", user.FirstName, user.LastName, phone: user.Phone, on: customDate);
        var earlierCancelled = await Add("07:00", "08:00", "Cancelled", "Earlier", booked: false, on: customDate);
        var elsewhere = await Add("08:00", "09:00", "Elsewhere", "Earlier", at: foreign, on: customDate);
        var laterCancelled = await Add("18:00", "19:00", "Cancelled", "Later", booked: false, on: customDate);
        var elsewhereLater = await Add("20:00", "21:00", "Elsewhere", "Later", at: foreign, on: customDate);
        db.AddRange(
            new ScheduleSlot { Date = customDate, LocationId = location.Id, TimeSlotId = first.TimeSlotId, Capacity = 10 },
            new ScheduleSlot { Date = customDate, LocationId = location.Id, TimeSlotId = later.TimeSlotId, Capacity = 10 },
            new ScheduleSlot { Date = customDate, LocationId = foreign.Id, TimeSlotId = elsewhere.TimeSlotId, Capacity = 10 },
            new ScheduleSlot { Date = customDate, LocationId = foreign.Id, TimeSlotId = elsewhereLater.TimeSlotId, Capacity = 10 });
        await db.SaveChangesAsync();
        Check((await Read(first)).IsFirstShift && !(await Read(later)).IsFirstShift,
            "The first custom interval is labelled by date and location, ignoring other locations, dates and cancelled history");
        Check(!(await Read(first)).IsLastShift && (await Read(later)).IsLastShift,
            "The last custom interval ignores later slots at other locations, dates and cancelled history");
        var emptyEarlier = new ScheduleSlot { Date = customDate, LocationId = location.Id, TimeSlotId = elsewhere.TimeSlotId, Capacity = 10 };
        db.Add(emptyEarlier);
        await db.SaveChangesAsync();
        shift = await Read(first);
        Check(!shift.IsFirstShift && shift.PreviousShifts.Count == 0,
            "An empty scheduled interval before the user prevents a false first-shift label");
        db.Remove(emptyEarlier);
        earlierCancelled.IsBooked = true;
        await db.SaveChangesAsync();
        Check(!(await Read(first)).IsFirstShift, "A preserved active booking before a custom schedule still counts as an earlier shift");
        earlierCancelled.IsBooked = false;
        await db.SaveChangesAsync();
        Check((await Read(first)).IsFirstShift, "Removing the empty interval and cancelling earlier bookings restores the first-shift label");

        var emptyLater = new ScheduleSlot { Date = customDate, LocationId = location.Id, TimeSlotId = laterCancelled.TimeSlotId, Capacity = 10 };
        db.Add(emptyLater);
        await db.SaveChangesAsync();
        shift = await Read(later);
        Check(!shift.IsLastShift && shift.NextShifts.Count == 0,
            "An empty later scheduled interval prevents a false last-shift label even across a gap");
        db.Remove(emptyLater);
        laterCancelled.IsBooked = true;
        await db.SaveChangesAsync();
        Check(!(await Read(later)).IsLastShift, "Preserved active bookings after a custom schedule still count as later shifts");
        laterCancelled.IsBooked = false;
        await db.SaveChangesAsync();
        Check((await Read(later)).IsLastShift, "Removing the empty interval and cancelling later bookings restores the last-shift label");

        var singleDate = date.AddDays(4);
        var singleDay = await db.AvailableDates.SingleOrDefaultAsync(d => d.Date == singleDate);
        if (singleDay is null) db.Add(singleDay = new AvailableDate { Date = singleDate, IsActive = true });
        singleDay.UseCustomSchedule = true;
        var single = await Add("09:00", "10:00", user.FirstName, user.LastName, phone: user.Phone, on: singleDate);
        db.Add(new ScheduleSlot { Date = singleDate, LocationId = location.Id, TimeSlotId = single.TimeSlotId, Capacity = 10 });
        await db.SaveChangesAsync();
        shift = await Read(single);
        Check(shift.IsFirstShift && shift.IsLastShift, "A location's only stand of the day is both first and last");
        Check(shift.Participants.Single().FirstName == "Current", "A stand with no partners still shows the user's own name");

        var legacyDate = date.AddDays(3);
        var defaultSlots = await db.TimeSlots.Where(s => s.IsActive && !s.IsScheduleOnly).OrderBy(s => s.StartTime).ToListAsync();
        var secondTime = defaultSlots.Select(s => s.StartTime).Distinct().Skip(1).First();
        var secondSlot = defaultSlots.First(s => s.StartTime == secondTime);
        var legacy = await Add(secondSlot.StartTime.ToString("HH:mm"), secondSlot.EndTime.ToString("HH:mm"),
            user.FirstName, user.LastName, phone: user.Phone, on: legacyDate);
        Check(!(await Read(legacy)).IsFirstShift, "Empty earlier default intervals also prevent a first-shift label");
        Check(!(await Read(legacy)).IsLastShift, "Empty later default intervals also prevent a last-shift label");
        foreach (var slot in defaultSlots.Where(s => s.StartTime < secondTime))
        {
            var exception = await db.DateTimeSlotExceptions.SingleOrDefaultAsync(e => e.Date == legacyDate && e.TimeSlotId == slot.Id);
            if (exception is null) db.Add(exception = new DateTimeSlotException { Date = legacyDate, TimeSlotId = slot.Id });
            exception.IsBlocked = true;
        }
        await db.SaveChangesAsync();
        Check((await Read(legacy)).IsFirstShift, "Blocked default intervals without active bookings do not count as earlier shifts");
        foreach (var slot in defaultSlots.Where(s => s.EndTime > secondSlot.EndTime))
        {
            var exception = await db.DateTimeSlotExceptions.SingleOrDefaultAsync(e => e.Date == legacyDate && e.TimeSlotId == slot.Id);
            if (exception is null) db.Add(exception = new DateTimeSlotException { Date = legacyDate, TimeSlotId = slot.Id });
            exception.IsBlocked = true;
        }
        await db.SaveChangesAsync();
        Check((await Read(legacy)).IsLastShift, "Blocked default intervals without active bookings do not count as later shifts");
        await transaction.RollbackAsync();
    }

    private sealed class FixedClock(DateTime now) : IKyivClock
    {
        public DateOnly TodayLocal => DateOnly.FromDateTime(now);
        public DateTime NowLocal => now;
        public DateTime UtcNow => now.AddHours(-2);
        public DateTime ToUtc(DateTime localDateTime) => DateTime.SpecifyKind(localDateTime.AddHours(-2), DateTimeKind.Utc);
    }
}
