using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/exceptions")]
[Authorize]
public sealed class AdminExceptionsController(StandDbContext db, IKyivClock clock) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? date, CancellationToken ct)
    {
        var query = db.DateTimeSlotExceptions.Include(e => e.TimeSlot).AsQueryable();

        if (DateOnly.TryParse(date, out var parsed))
        {
            query = query.Where(e => e.Date == parsed);
        }

        var entities = await query
            .OrderBy(e => e.Date).ThenBy(e => e.TimeSlot.SortOrder)
            .ToListAsync(ct);

        var items = entities
            .Select(e => new DateTimeSlotExceptionAdminDto(
                e.Id, e.Date.ToString("yyyy-MM-dd"), e.TimeSlotId,
                e.TimeSlot.StartTime.ToString("HH:mm"), e.TimeSlot.EndTime.ToString("HH:mm"),
                e.IsBlocked, e.Note))
            .ToList();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertExceptionDto dto, CancellationToken ct)
    {
        if (!DateOnly.TryParse(dto.Date, out var date))
        {
            throw new ValidationAppException("Некоректна дата.");
        }

        ScheduleArchive.EnsureEditable([date], clock.TodayLocal);
        var timeSlot = await db.TimeSlots.FirstOrDefaultAsync(t => t.Id == dto.TimeSlotId, ct)
            ?? throw new NotFoundAppException(ErrorCodes.TimeSlotNotFound, "Час не знайдено.");

        var entity = await db.DateTimeSlotExceptions
            .FirstOrDefaultAsync(e => e.Date == date && e.TimeSlotId == dto.TimeSlotId, ct);

        if (entity is null)
        {
            entity = new DateTimeSlotException { Date = date, TimeSlotId = dto.TimeSlotId };
            db.DateTimeSlotExceptions.Add(entity);
        }

        entity.IsBlocked = dto.IsBlocked;
        entity.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();

        ScheduleArchive.EnsureEditable([date], clock.TodayLocal);
        await db.SaveChangesAsync(ct);

        return Ok(new DateTimeSlotExceptionAdminDto(
            entity.Id, date.ToString("yyyy-MM-dd"), entity.TimeSlotId,
            timeSlot.StartTime.ToString("HH:mm"), timeSlot.EndTime.ToString("HH:mm"),
            entity.IsBlocked, entity.Note));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var entity = await db.DateTimeSlotExceptions.FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Виняток не знайдено.");

        ScheduleArchive.EnsureEditable([entity.Date], clock.TodayLocal);
        db.DateTimeSlotExceptions.Remove(entity);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
