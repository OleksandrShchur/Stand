using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

namespace Stand.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/locations")]
[Authorize]
public sealed class AdminLocationsController(StandDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var items = await db.Locations
            .OrderBy(l => l.SortOrder).ThenBy(l => l.Name)
            .Select(l => new LocationAdminDto(l.Id, l.Name, l.Address, l.Capacity, l.SortOrder, l.IsActive))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertLocationDto dto, CancellationToken ct)
    {
        Validate(dto);

        var entity = new Location
        {
            Name = dto.Name.Trim(),
            Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim(),
            Capacity = dto.Capacity,
            SortOrder = dto.SortOrder,
            IsActive = dto.IsActive,
        };
        db.Locations.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(new LocationAdminDto(entity.Id, entity.Name, entity.Address, entity.Capacity, entity.SortOrder, entity.IsActive));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpsertLocationDto dto, CancellationToken ct)
    {
        Validate(dto);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await ScheduleLock.AcquireLocationAsync(db, id, true, ct);
        var entity = await db.Locations.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Локацію не знайдено.");

        if (dto.Capacity < entity.Capacity && await db.Bookings
            .Where(b => b.LocationId == id && b.IsBooked &&
                !db.AvailableDates.Any(d => d.Date == b.Date && d.UseCustomSchedule))
            .GroupBy(b => new { b.Date, b.TimeSlotId }).AnyAsync(g => g.Count() > dto.Capacity, ct))
            throw new ConflictAppException(ErrorCodes.Conflict,
                "У спільному розкладі вже є більше записів, ніж вказана місткість. Спочатку користувач або адміністратор має скасувати зайві записи.");

        entity.Name = dto.Name.Trim();
        entity.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
        entity.Capacity = dto.Capacity;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Ok(new LocationAdminDto(entity.Id, entity.Name, entity.Address, entity.Capacity, entity.SortOrder, entity.IsActive));
    }

    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct) => await SetActive(id, true, ct);

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct) => await SetActive(id, false, ct);

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        const string hasBookings = "Локація має записи, зокрема історію скасованих записів, тому її не можна видалити. Вимкніть її через «Редагувати», щоб закрити нові записи та зберегти наявні.";
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await ScheduleLock.AcquireCatalogAsync(db, ct);
        var entity = await db.Locations.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Локацію не знайдено.");
        if (await db.Bookings.AnyAsync(b => b.LocationId == id, ct))
            throw new ConflictAppException(ErrorCodes.Conflict, hasBookings);

        await db.ScheduleSlots.Where(s => s.LocationId == id).ExecuteDeleteAsync(ct);
        db.Locations.Remove(entity);
        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is SqlException { Number: 547 })
        {
            // A booking may have been created after the check. Roll back the schedule removal too.
            throw new ConflictAppException(ErrorCodes.Conflict, hasBookings);
        }
        return NoContent();
    }

    private async Task<IActionResult> SetActive(int id, bool isActive, CancellationToken ct)
    {
        var entity = await db.Locations.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Локацію не знайдено.");

        entity.IsActive = isActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(new LocationAdminDto(entity.Id, entity.Name, entity.Address, entity.Capacity, entity.SortOrder, entity.IsActive));
    }

    private static void Validate(UpsertLocationDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || dto.Name.Trim().Length > 200)
        {
            throw new ValidationAppException("Назва локації обов'язкова (до 200 символів).");
        }

        if (dto.Capacity <= 0)
        {
            throw new ValidationAppException("Місткість має бути більшою за 0.");
        }
    }
}
