using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Dtos.Admin;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/bookings")]
[Authorize]
public sealed class AdminBookingsController(StandDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? date,
        [FromQuery] int? locationId,
        [FromQuery] int? timeSlotId,
        [FromQuery] string? phone,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = BuildFilteredQuery(date, locationId, timeSlotId, phone, status);

        var total = await query.CountAsync(ct);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 500);

        var entities = await query
            .OrderByDescending(b => b.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = entities.Select(ToDto).ToList();

        return Ok(new BookingListResultDto(items, total, page, pageSize));
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Запис не знайдено.");

        if (booking.Status == "Cancelled")
        {
            return NoContent();
        }

        booking.Status = "Cancelled";
        booking.CancelledAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] string? date,
        [FromQuery] int? locationId,
        [FromQuery] int? timeSlotId,
        [FromQuery] string? phone,
        [FromQuery] string? status,
        CancellationToken ct = default)
    {
        var query = BuildFilteredQuery(date, locationId, timeSlotId, phone, status);

        var entities = await query
            .OrderBy(b => b.Date).ThenBy(b => b.TimeSlot.SortOrder)
            .ToListAsync(ct);

        var items = entities.Select(ToDto).ToList();

        var sb = new StringBuilder();
        sb.AppendLine("PublicNumber,Date,Location,TimeStart,TimeEnd,FirstName,LastName,Phone,Comment,Status,CreatedAtUtc");
        foreach (var b in items)
        {
            sb.AppendLine(string.Join(',', new[]
            {
                Csv(b.PublicNumber), Csv(b.Date), Csv(b.LocationName), Csv(b.StartTime), Csv(b.EndTime),
                Csv(b.FirstName), Csv(b.LastName), Csv(b.Phone), Csv(b.Comment), Csv(b.Status), Csv(b.CreatedAtUtc),
            }));
        }

        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv", $"bookings-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv");
    }

    private IQueryable<Data.Entities.Booking> BuildFilteredQuery(
        string? date, int? locationId, int? timeSlotId, string? phone, string? status)
    {
        var query = db.Bookings.Include(b => b.Location).Include(b => b.TimeSlot).AsQueryable();

        if (DateOnly.TryParse(date, out var parsedDate))
        {
            query = query.Where(b => b.Date == parsedDate);
        }

        if (locationId is > 0)
        {
            query = query.Where(b => b.LocationId == locationId);
        }

        if (timeSlotId is > 0)
        {
            query = query.Where(b => b.TimeSlotId == timeSlotId);
        }

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var normalized = Services.PhoneNormalizer.TryNormalize(phone) ?? phone.Trim();
            query = query.Where(b => b.Phone != null && b.Phone.Contains(normalized));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(b => b.Status == status);
        }

        return query;
    }

    private static BookingAdminDto ToDto(Data.Entities.Booking b) =>
        new(
            b.Id,
            b.PublicNumber,
            b.Date.ToString("yyyy-MM-dd"),
            b.LocationId,
            b.Location.Name,
            b.TimeSlotId,
            b.TimeSlot.StartTime.ToString("HH:mm"),
            b.TimeSlot.EndTime.ToString("HH:mm"),
            b.FirstName,
            b.LastName,
            b.Phone,
            b.Comment,
            b.Status,
            b.CreatedAtUtc.ToString("O"),
            b.ConfirmedAtUtc.HasValue ? b.ConfirmedAtUtc.Value.ToString("O") : null,
            b.CancelledAtUtc.HasValue ? b.CancelledAtUtc.Value.ToString("O") : null);

    private static string Csv(string? value)
    {
        value ??= string.Empty;
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }
}
