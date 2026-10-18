using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Controllers.Admin;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;

static class BookingSearchChecks
{
    public static async Task Run(string connection)
    {
        await using var db = new StandDbContext(new DbContextOptionsBuilder<StandDbContext>()
            .UseSqlServer(connection).Options);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var location = new Location { Name = "Booking search " + Guid.NewGuid(), Capacity = 10, IsActive = true };
        var slotId = await db.TimeSlots.Select(s => s.Id).FirstAsync();
        var date = new DateOnly(2030, 1, 1);
        Booking Row(string? firstName, string? lastName, string phone, bool booked = true) => new()
        {
            PublicNumber = Guid.NewGuid().ToString("N")[..20], CancelToken = Guid.NewGuid(),
            Location = location, TimeSlotId = slotId, Date = date, IsBooked = booked,
            FirstName = firstName, LastName = lastName, Phone = phone,
        };
        var expected = Row("Василь", "Пупкін", "+380670000001");
        var other = Row("Олена", "Коваль", "+380680000002");
        db.AddRange(expected, other, Row("Василь", "Пупкін", "+380690000003", false),
            Row(null, null, "+380660000004"));
        await db.SaveChangesAsync();
        var controller = new AdminBookingsController(db);

        async Task<BookingListResultDto> Search(string search, int page = 1, int pageSize = 50) =>
            (BookingListResultDto)((OkObjectResult)await controller.List(null, location.Id, slotId, null, true,
                page, pageSize, search)).Value!;
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
            Console.WriteLine("PASS " + message);
        }

        foreach (var term in new[] { "вас", "ПУПК", "Василь Пупкін", "  пупк\t ВАС  ", "67", "(067) 000-00-01" })
        {
            var result = await Search(term);
            Check(result.TotalCount == 1 && result.Items.Single().Id == expected.Id,
                $"Booking search matches '{term}' and retains location, time and booked filters");
        }
        Check((await Search("Василь Коваль")).TotalCount == 0, "Full-name words must match the same participant");
        Check((await Search("Невідомий")).TotalCount == 0, "Unknown names return no bookings");
        var paged = await Search("00000", page: 2, pageSize: 1);
        Check(paged.TotalCount == 3 && paged.Items.Count == 1 && paged.Page == 2,
            "Search counts all matches before pagination and tolerates missing names");
        var legacy = (BookingListResultDto)((OkObjectResult)await controller.List(null, location.Id, slotId,
            "0670000001", true)).Value!;
        Check(legacy.Items.Single().Id == expected.Id, "Existing phone API filter remains compatible");
        var csv = (FileContentResult)await controller.ExportCsv(null, location.Id, slotId, null, true, search: "ПУПК ВАС");
        var text = System.Text.Encoding.UTF8.GetString(csv.FileContents);
        Check(text.Contains(expected.PublicNumber) && !text.Contains(other.PublicNumber),
            "CSV uses the same name search as the bookings list");
        await transaction.RollbackAsync();
    }
}
