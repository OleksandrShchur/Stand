using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Public;
using Stand.Server.Options;

namespace Stand.Server.Services;

public sealed class BookingService(
    StandDbContext db,
    IKyivClock clock,
    IAvailabilityService availability,
    IOptions<BookingOptions> options,
    ILogger<BookingService> logger) : IBookingService
{
    private const int UniqueConstraintViolationSqlError = 2601;
    private const int UniqueIndexViolationSqlError = 2627;

    private readonly BookingOptions _options = options.Value;

    public async Task<List<MyShiftDto>> GetMyUpcomingShiftsAsync(int authorizedUserId, CancellationToken ct)
    {
        var user = await db.AuthorizedUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == authorizedUserId && u.IsActive, ct)
            ?? throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");
        var phone = PhoneNormalizer.TryNormalize(user.Phone)
            ?? throw new ValidationAppException("Зверніться до адміністратора, щоб виправити номер телефону у вашому профілі.", ErrorCodes.InvalidPhone);

        var now = clock.NowLocal;
        var today = DateOnly.FromDateTime(now);
        var time = TimeOnly.FromDateTime(now);
        var shifts = await db.Bookings.AsNoTracking()
            .Where(b => b.Phone == phone && b.Status == "Confirmed" &&
                (b.Date > today || (b.Date == today && b.TimeSlot.EndTime > time)))
            .OrderBy(b => b.Date)
            .ThenBy(b => b.TimeSlot.StartTime)
            .ThenBy(b => b.Id)
            .Select(b => new
            {
                b.Id,
                b.Date,
                LocationName = b.Location.Name,
                LocationAddress = b.Location.Address,
                b.TimeSlot.StartTime,
                b.TimeSlot.EndTime,
                b.CancelToken,
                Participants = db.Bookings
                    .Where(other => other.Date == b.Date && other.LocationId == b.LocationId &&
                        other.TimeSlotId == b.TimeSlotId && other.Status == "Confirmed" && other.Phone != phone)
                    .OrderBy(other => other.LastName).ThenBy(other => other.FirstName).ThenBy(other => other.Id)
                    .Select(other => new ShiftParticipantDto(other.FirstName, other.LastName)).ToList(),
            })
            .ToListAsync(ct);

        return shifts.Select(b => new MyShiftDto(
            b.Id,
            b.Date.ToString("yyyy-MM-dd"),
            b.LocationName,
            b.LocationAddress,
            b.StartTime.ToString("HH:mm"),
            b.EndTime.ToString("HH:mm"),
            b.CancelToken.ToString(),
            b.Participants)).ToList();
    }

    public async Task<BookingSummaryDto> BookAsync(
        DateOnly date, int locationId, int timeSlotId,
        int authorizedUserId, CancellationToken ct)
    {
        var user = await db.AuthorizedUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == authorizedUserId && u.IsActive, ct)
            ?? throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");
        var fn = user.FirstName.Trim();
        var ln = user.LastName.Trim();
        if (fn.Length is < 1 or > 100 || ln.Length is < 1 or > 100)
            throw new ValidationAppException("Зверніться до адміністратора, щоб заповнити ім'я та прізвище у вашому профілі.");
        var phone = PhoneNormalizer.TryNormalize(user.Phone)
            ?? throw new ValidationAppException("Зверніться до адміністратора, щоб виправити номер телефону у вашому профілі.", ErrorCodes.InvalidPhone);

        await availability.EnsureDateBookableAsync(date, ct);

        var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == locationId, ct)
            ?? throw new NotFoundAppException(ErrorCodes.LocationNotFound, "Локацію не знайдено.");
        if (!location.IsActive)
        {
            throw new ValidationAppException("Ця локація зараз недоступна.", ErrorCodes.LocationInactive);
        }

        var timeSlot = await db.TimeSlots.FirstOrDefaultAsync(t => t.Id == timeSlotId, ct)
            ?? throw new NotFoundAppException(ErrorCodes.TimeSlotNotFound, "Час не знайдено.");
        if (!timeSlot.IsActive)
        {
            throw new ValidationAppException("Цей час зараз недоступний.", ErrorCodes.TimeSlotBlocked);
        }

        var isBlocked = await db.DateTimeSlotExceptions
            .AnyAsync(e => e.Date == date && e.TimeSlotId == timeSlotId && e.IsBlocked, ct);
        if (isBlocked)
        {
            throw new ValidationAppException("Цей час недоступний для обраної дати.", ErrorCodes.TimeSlotBlocked);
        }

        if (availability.IsSlotTooSoon(date, timeSlot.StartTime))
        {
            throw new ValidationAppException(
                $"Запис можливий лише не раніше ніж за {_options.MinLeadTimeMinutes} хв до початку чергування.",
                ErrorCodes.SlotTooSoon);
        }

        // The capacity check and confirmed insert share a lock to prevent overbooking.
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var now = clock.UtcNow;
        var activeCount = await CountActiveWithLockAsync(date, locationId, timeSlotId, now, ct);

        if (await db.Bookings.AnyAsync(b => b.Date == date && b.LocationId == locationId &&
            b.TimeSlotId == timeSlotId && b.Phone == phone && b.Status != "Cancelled", ct))
            throw new ConflictAppException(ErrorCodes.DuplicatePhoneSlot,
                "З цим номером телефону вже є запис на цю дату, локацію та час.");

        if (activeCount >= location.Capacity)
        {
            await tx.RollbackAsync(ct);
            throw new ConflictAppException(ErrorCodes.SlotFull, "На цей час вже немає вільних місць (Зайнято).");
        }

        var booking = new Booking
        {
            PublicNumber = BookingNumberGenerator.Generate(date),
            LocationId = locationId,
            Date = date,
            TimeSlotId = timeSlotId,
            Status = "Confirmed",
            FirstName = fn,
            LastName = ln,
            Phone = phone,
            ConfirmedAtUtc = now,
            Location = location,
            TimeSlot = timeSlot,
        };

        db.Bookings.Add(booking);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new ConflictAppException(ErrorCodes.DuplicatePhoneSlot,
                "З цим номером телефону вже є запис на цю дату, локацію та час.");
        }
        await tx.CommitAsync(ct);

        return await ToSummaryAsync(booking, ct);
    }

    public async Task<BookingSummaryDto> GetByCancelTokenAsync(Guid cancelToken, CancellationToken ct)
    {
        var booking = await db.Bookings
            .Include(b => b.Location)
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.CancelToken == cancelToken, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Запис не знайдено.");

        return await ToSummaryAsync(booking, ct);
    }

    public async Task<BookingSummaryDto> CancelAsync(Guid cancelToken, CancellationToken ct)
    {
        var booking = await db.Bookings
            .Include(b => b.Location)
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.CancelToken == cancelToken, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Запис не знайдено.");

        if (booking.Status == "Cancelled")
        {
            throw new ConflictAppException(ErrorCodes.AlreadyCancelled, "Цей запис вже скасовано.");
        }

        booking.Status = "Cancelled";
        booking.CancelledAtUtc = clock.UtcNow;
        await db.SaveChangesAsync(ct);

        return await ToSummaryAsync(booking, ct);
    }

    private async Task<int> CountActiveWithLockAsync(DateOnly date, int locationId, int timeSlotId, DateTime now, CancellationToken ct)
    {
        try
        {
            return await db.Database.SqlQuery<int>($"""
                SELECT COUNT(*) AS Value
                FROM dbo.Bookings WITH (UPDLOCK, HOLDLOCK)
                WHERE [Date] = {date}
                  AND LocationId = {locationId}
                  AND TimeSlotId = {timeSlotId}
                  AND (Status = 'Confirmed' OR (Status = 'Held' AND HoldExpiresAtUtc > {now}))
                """).SingleAsync(ct);
        }
        catch (SqlException ex)
        {
            logger.LogError(ex, "Locked capacity count failed for {Date} / {LocationId} / {TimeSlotId}", date, locationId, timeSlotId);
            throw;
        }
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is SqlException sqlEx &&
        (sqlEx.Number == UniqueConstraintViolationSqlError || sqlEx.Number == UniqueIndexViolationSqlError);

    private async Task<BookingSummaryDto> ToSummaryAsync(Booking b, CancellationToken ct)
    {
        var participants = await db.Bookings.AsNoTracking()
            .Where(other => other.Date == b.Date && other.LocationId == b.LocationId &&
                other.TimeSlotId == b.TimeSlotId && other.Status == "Confirmed" &&
                other.Id != b.Id && (b.Phone == null || other.Phone != b.Phone))
            .OrderBy(other => other.LastName).ThenBy(other => other.FirstName).ThenBy(other => other.Id)
            .Select(other => new ShiftParticipantDto(other.FirstName, other.LastName))
            .ToListAsync(ct);

        return new(
            b.PublicNumber,
            b.CancelToken.ToString(),
            b.Status,
            b.Date.ToString("yyyy-MM-dd"),
            b.Location.Name,
            b.Location.Address,
            b.TimeSlot.StartTime.ToString("HH:mm"),
            b.TimeSlot.EndTime.ToString("HH:mm"),
            b.FirstName,
            b.LastName,
            b.Phone,
            b.Comment,
            b.CreatedAtUtc.ToString("O"),
            b.ConfirmedAtUtc?.ToString("O"),
            b.CancelledAtUtc?.ToString("O"),
            participants);
    }
}
