using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/timeslots")]
[Authorize]
public sealed class AdminTimeSlotsController(StandDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var items = await db.TimeSlots
            .OrderBy(t => t.SortOrder)
            .ToListAsync(ct);

        return Ok(items.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertTimeSlotDto dto, CancellationToken ct)
    {
        var (start, end) = ValidateAndParse(dto);

        var entity = new TimeSlot { StartTime = start, EndTime = end, SortOrder = dto.SortOrder, IsActive = dto.IsActive };
        db.TimeSlots.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(ToDto(entity));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpsertTimeSlotDto dto, CancellationToken ct)
    {
        var (start, end) = ValidateAndParse(dto);

        var entity = await db.TimeSlots.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Час не знайдено.");

        entity.StartTime = start;
        entity.EndTime = end;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Ok(ToDto(entity));
    }

    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct) => await SetActive(id, true, ct);

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct) => await SetActive(id, false, ct);

    private async Task<IActionResult> SetActive(int id, bool isActive, CancellationToken ct)
    {
        var entity = await db.TimeSlots.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Час не знайдено.");

        entity.IsActive = isActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(entity));
    }

    private static (TimeOnly Start, TimeOnly End) ValidateAndParse(UpsertTimeSlotDto dto)
    {
        if (!TimeOnly.TryParse(dto.StartTime, out var start) || !TimeOnly.TryParse(dto.EndTime, out var end))
        {
            throw new ValidationAppException("Некоректний формат часу (ГГ:ХХ).");
        }

        if (start >= end)
        {
            throw new ValidationAppException("Час початку має бути раніше за час завершення.");
        }

        return (start, end);
    }

    private static TimeSlotAdminDto ToDto(TimeSlot t) =>
        new(t.Id, t.StartTime.ToString("HH:mm"), t.EndTime.ToString("HH:mm"), t.SortOrder, t.IsActive);
}
