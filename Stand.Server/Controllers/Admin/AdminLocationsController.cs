using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;

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

        var entity = await db.Locations.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Локацію не знайдено.");

        entity.Name = dto.Name.Trim();
        entity.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
        entity.Capacity = dto.Capacity;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Ok(new LocationAdminDto(entity.Id, entity.Name, entity.Address, entity.Capacity, entity.SortOrder, entity.IsActive));
    }

    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct) => await SetActive(id, true, ct);

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct) => await SetActive(id, false, ct);

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
