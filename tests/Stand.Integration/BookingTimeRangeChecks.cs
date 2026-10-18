using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Controllers.Admin;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;

static class BookingTimeRangeChecks
{
    public static async Task Run(string connection)
    {
        await using var db = new StandDbContext(new DbContextOptionsBuilder<StandDbContext>()
            .UseSqlServer(connection).Options);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var location = new Location { Name = "Time filter " + Guid.NewGuid(), Capacity = 10, IsActive = true };
        var date = new DateOnly(2030, 1, 1);
        async Task<Booking> Row(string start, string end, bool booked = true, DateOnly? onDate = null)
        {
            var from = TimeOnly.Parse(start);
            var to = TimeOnly.Parse(end);
            var slot = await db.TimeSlots.FirstOrDefaultAsync(s => s.StartTime == from && s.EndTime == to)
                ?? new TimeSlot { StartTime = from, EndTime = to, IsActive = true, IsScheduleOnly = true };
            var booking = new Booking
            {
                PublicNumber = Guid.NewGuid().ToString("N")[..20], CancelToken = Guid.NewGuid(),
                Location = location, TimeSlot = slot, Date = onDate ?? date, IsBooked = booked,
                FirstName = "Василь", LastName = "Пупкін",
            };
            db.Add(booking);
            await db.SaveChangesAsync();
            return booking;
        }
        var morning = await Row("09:00", "11:00");
        var afternoon = await Row("12:00", "15:00");
        var spanning = await Row("10:30", "12:30");
        var early = await Row("08:00", "09:00");
        var late = await Row("15:00", "16:00");
        await Row("10:00", "14:00", false);
        var controller = new AdminBookingsController(db);
        async Task<BookingListResultDto> Search(string? from = null, string? to = null, int page = 1, int pageSize = 50) =>
            (BookingListResultDto)((OkObjectResult)await controller.List(date.ToString("yyyy-MM-dd"), location.Id,
                null, null, true, page, pageSize, search: "пупк", timeFrom: from is null ? null : TimeOnly.Parse(from),
                timeTo: to is null ? null : TimeOnly.Parse(to))).Value!;
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
            Console.WriteLine("PASS " + message);
        }
        async Task Matches(string? from, string? to, params Booking[] expected)
        {
            var result = await Search(from, to);
            Check(result.TotalCount == expected.Length && result.Items.Select(b => b.Id).Order()
                .SequenceEqual(expected.Select(b => b.Id).Order()), $"Time overlap {from ?? "any"}–{to ?? "any"}");
        }
        await Matches(null, null, morning, afternoon, spanning, early, late);
        await Matches("10:00", null, morning, afternoon, spanning, late);
        await Matches(null, "13:00", morning, afternoon, spanning, early);
        await Matches(null, "09:00", early);
        await Matches("10:00", "13:00", morning, afternoon, spanning);
        await Matches("11:00", "12:00", spanning);
        await Matches("09:15", "09:45", morning);
        await Matches("00:00", "23:59", morning, afternoon, spanning, early, late);
        await Matches(null, "00:00");
        await Matches("23:59", null);
        var page = await Search("10:00", "13:00", page: 2, pageSize: 1);
        Check(page.TotalCount == 3 && page.Items.Count == 1 && page.Page == 2, "Time overlap applies before pagination");
        var csv = (FileContentResult)await controller.ExportCsv(null, location.Id, null, null, true,
            timeFrom: new TimeOnly(11, 0), timeTo: new TimeOnly(12, 0));
        var text = System.Text.Encoding.UTF8.GetString(csv.FileContents);
        Check(text.Contains(spanning.PublicNumber) && !text.Contains(morning.PublicNumber) && !text.Contains(afternoon.PublicNumber),
            "CSV uses actual overlap and excludes boundary-only matches");
        foreach (var (from, to) in new[] { ("13:00", "10:00"), ("10:00", "10:00") })
        {
            try { await Search(from, to); throw new Exception("Invalid range was accepted"); }
            catch (ValidationAppException) { Console.WriteLine("PASS Empty or reversed time range is rejected"); }
        }
        var tomorrow = await Row("09:00", "11:00", onDate: date.AddDays(1));
        var lastDay = await Row("09:00", "11:00", onDate: date.AddDays(14));
        var past = await Row("09:00", "11:00", onDate: date.AddDays(-1));
        var beyondHorizon = await Row("09:00", "11:00", onDate: date.AddDays(15));
        var cancelled = await Row("09:00", "11:00", false, date.AddDays(1));
        var foreign = await Row("09:00", "11:00", onDate: date.AddDays(1));
        foreign.Location = new Location { Name = "Other dashboard location " + Guid.NewGuid(), Capacity = 2, IsActive = true };
        await db.SaveChangesAsync();
        var range = (BookingListResultDto)((OkObjectResult)await controller.List(null, location.Id, null, null, true,
            dateFrom: date, dateTo: date.AddDays(14))).Value!;
        Check(range.TotalCount == 7 && range.Items.Any(b => b.Id == morning.Id) && range.Items.Any(b => b.Id == lastDay.Id)
            && !range.Items.Any(b => new[] { past.Id, beyondHorizon.Id, cancelled.Id, foreign.Id }.Contains(b.Id)),
            "Dashboard period includes both boundary dates and only active bookings at the chosen location");
        var rangePage = (BookingListResultDto)((OkObjectResult)await controller.List(null, location.Id, null, null, true,
            page: 2, pageSize: 2, dateFrom: date, dateTo: date.AddDays(14))).Value!;
        Check(rangePage.TotalCount == 7 && rangePage.Items.Count == 2, "Date range applies before pagination");
        var singleDay = (BookingListResultDto)((OkObjectResult)await controller.List(date.ToString("yyyy-MM-dd"), location.Id, null, null, true)).Value!;
        Check(singleDay.TotalCount == 5 && !singleDay.Items.Any(b => b.Id == tomorrow.Id), "Today's dashboard link excludes other dates");
        var rangeCsv = (FileContentResult)await controller.ExportCsv(null, location.Id, null, null, true,
            dateFrom: date, dateTo: date.AddDays(14));
        var rangeText = System.Text.Encoding.UTF8.GetString(rangeCsv.FileContents);
        Check(rangeText.Contains(lastDay.PublicNumber) && !rangeText.Contains(beyondHorizon.PublicNumber)
            && !rangeText.Contains(past.PublicNumber) && !rangeText.Contains(cancelled.PublicNumber), "CSV honors the dashboard date range");
        try
        {
            await controller.List(null, location.Id, null, null, true, dateFrom: date.AddDays(1), dateTo: date);
            throw new Exception("Reversed date range was accepted");
        }
        catch (ValidationAppException) { Console.WriteLine("PASS Reversed date range is rejected"); }
        await transaction.RollbackAsync();
    }
}
