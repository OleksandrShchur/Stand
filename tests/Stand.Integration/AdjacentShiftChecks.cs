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
        await Add("10:00", "11:00", user.FirstName, user.LastName, phone: user.Phone);
        await Add("12:00", "13:00", user.FirstName, user.LastName, phone: user.Phone);
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
        async Task<Stand.Server.Dtos.Public.MyShiftDto> Read() =>
            (await service.GetMyUpcomingShiftsAsync(user.Id, default)).Single(s => s.Id == mine.Id);
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
            Console.WriteLine("PASS " + message);
        }
        var shift = await Read();
        Check(shift.Participants.Single().FirstName == "Same", "Partners in the user's own slot remain separate");
        Check(shift.PreviousShifts.Count == 1 && shift.PreviousShifts[0].StartTime == "10:00" &&
            shift.PreviousShifts[0].EndTime == "11:00" &&
            shift.PreviousShifts[0].Participants.Select(p => p.FirstName).SequenceEqual(["Andrii", "Olena"]),
            "A finished adjoining shift shows all other active participants in name order");
        Check(shift.NextShifts.Count == 1 && shift.NextShifts[0].StartTime == "12:00" &&
            shift.NextShifts[0].EndTime == "13:00" && shift.NextShifts[0].Participants.Single().FirstName == "Iryna",
            "The next adjoining shift excludes self, cancelled, overlapping, gap, other-location and other-day bookings");
        var json = JsonSerializer.Serialize(shift.PreviousShifts, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Check(!json.Contains("phone", StringComparison.OrdinalIgnoreCase) &&
            !json.Contains("cancelToken", StringComparison.OrdinalIgnoreCase), "Adjacent shifts expose only times and participant names");
        previous.IsBooked = previousFirst.IsBooked = false;
        await db.SaveChangesAsync();
        shift = await Read();
        Check(shift.PreviousShifts.Count == 0 && shift.NextShifts.Count == 1,
            "A side with only self or cancelled bookings is empty without skipping to a distant occupied slot");
        next.IsBooked = false;
        await db.SaveChangesAsync();
        shift = await Read();
        Check(shift.PreviousShifts.Count == 0 && shift.NextShifts.Count == 0, "Both empty sides are omitted independently");
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
