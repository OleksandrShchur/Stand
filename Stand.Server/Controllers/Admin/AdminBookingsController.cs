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
        [FromQuery] bool? isBooked,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] TimeOnly? timeFrom = null,
        [FromQuery] TimeOnly? timeTo = null,
        CancellationToken ct = default)
    {
        var query = BuildFilteredQuery(date, locationId, timeSlotId, phone, isBooked, search, timeFrom, timeTo);

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

        if (!booking.IsBooked)
        {
            return NoContent();
        }

        booking.IsBooked = false;
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
        [FromQuery] bool? isBooked,
        CancellationToken ct = default,
        [FromQuery] string? search = null,
        [FromQuery] TimeOnly? timeFrom = null,
        [FromQuery] TimeOnly? timeTo = null)
    {
        var query = BuildFilteredQuery(date, locationId, timeSlotId, phone, isBooked, search, timeFrom, timeTo);

        var entities = await query
            .OrderBy(b => b.Date).ThenBy(b => b.TimeSlot.SortOrder)
            .ToListAsync(ct);

        var items = entities.Select(ToDto).ToList();

        var sb = new StringBuilder();
        sb.AppendLine("PublicNumber,Date,Location,TimeStart,TimeEnd,FirstName,LastName,Phone,Comment,IsBooked,CreatedAtUtc");
        foreach (var b in items)
        {
            sb.AppendLine(string.Join(',', new[]
            {
                Csv(b.PublicNumber), Csv(b.Date), Csv(b.LocationName), Csv(b.StartTime), Csv(b.EndTime),
                Csv(b.FirstName), Csv(b.LastName), Csv(b.Phone), Csv(b.Comment), Csv(b.IsBooked ? "true" : "false"), Csv(b.CreatedAtUtc),
            }));
        }

        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv", $"bookings-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv");
    }

    private IQueryable<Data.Entities.Booking> BuildFilteredQuery(
        string? date, int? locationId, int? timeSlotId, string? phone, bool? isBooked, string? search,
        TimeOnly? timeFrom, TimeOnly? timeTo)
    {
        if (timeFrom.HasValue && timeTo.HasValue && timeFrom.Value >= timeTo.Value)
            throw new ValidationAppException("Час «Від» має бути раніше часу «До».");

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

        // Require actual overlap: touching the range boundary alone is not enough.
        if (timeFrom.HasValue)
            query = query.Where(b => b.TimeSlot.EndTime > timeFrom.Value);
        if (timeTo.HasValue)
            query = query.Where(b => b.TimeSlot.StartTime < timeTo.Value);

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var normalized = Services.PhoneNormalizer.TryNormalize(phone) ?? phone.Trim();
            query = query.Where(b => b.Phone != null && b.Phone.Contains(normalized));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            if (search.Any(char.IsLetter))
            {
                // Every word must match the participant's first name or surname,
                // so full names work in either order, including partial names.
                foreach (var word in search.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
                {
                    var term = word.ToLowerInvariant();
                    query = query.Where(b =>
                        (b.FirstName != null && b.FirstName.ToLower().Contains(term)) ||
                        (b.LastName != null && b.LastName.ToLower().Contains(term)));
                }
            }
            else
            {
                var digits = new string(search.Where(char.IsAsciiDigit).ToArray());
                if (digits.Length > 0)
                {
                    var normalized = Services.PhoneNormalizer.TryNormalize(digits) ?? digits;
                    query = query.Where(b => b.Phone != null && b.Phone.Contains(normalized));
                }
            }
        }

        if (isBooked.HasValue)
        {
            query = query.Where(b => b.IsBooked == isBooked.Value);
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
            b.IsBooked,
            b.CreatedAtUtc.ToString("O"),
            b.BookedAtUtc.HasValue ? b.BookedAtUtc.Value.ToString("O") : null,
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
