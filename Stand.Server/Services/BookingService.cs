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

    public async Task<HoldResponseDto> HoldAsync(DateOnly date, int locationId, int timeSlotId, CancellationToken ct)
    {
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

        // Serialize concurrent hold attempts for the same (date, location, timeSlot) using a
        // row-level lock held for the duration of the transaction, so the capacity check and
        // the insert are atomic across concurrent requests.
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var now = clock.UtcNow;
        var activeCount = await CountActiveWithLockAsync(date, locationId, timeSlotId, now, ct);

        if (activeCount >= location.Capacity)
        {
            await tx.RollbackAsync(ct);
            throw new ConflictAppException(ErrorCodes.SlotFull, "На цей час вже немає вільних місць (Зайнято).");
        }

        var holdExpiresAt = now.AddMinutes(_options.HoldDurationMinutes);
        var booking = new Booking
        {
            PublicNumber = BookingNumberGenerator.Generate(date),
            LocationId = locationId,
            Date = date,
            TimeSlotId = timeSlotId,
            Status = "Held",
            HoldExpiresAtUtc = holdExpiresAt,
        };

        db.Bookings.Add(booking);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new HoldResponseDto(
            booking.CancelToken.ToString(),
            holdExpiresAt.ToString("O"),
            SecondsRemaining: (int)Math.Max(0, (holdExpiresAt - now).TotalSeconds),
            date.ToString("yyyy-MM-dd"),
            location.Id,
            location.Name,
            location.Address,
            timeSlot.Id,
            timeSlot.StartTime.ToString("HH:mm"),
            timeSlot.EndTime.ToString("HH:mm"));
    }

    public async Task<BookingSummaryDto> ConfirmAsync(
        Guid holdToken, string firstName, string lastName, string phoneRaw, string? comment, CancellationToken ct)
    {
        var fn = (firstName ?? string.Empty).Trim();
        var ln = (lastName ?? string.Empty).Trim();
        var cm = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();

        if (fn.Length is < 1 or > 100)
        {
            throw new ValidationAppException("Вкажіть коректне ім'я (до 100 символів).");
        }

        if (ln.Length is < 1 or > 100)
        {
            throw new ValidationAppException("Вкажіть коректне прізвище (до 100 символів).");
        }

        if (cm is { Length: > 500 })
        {
            throw new ValidationAppException("Коментар не повинен перевищувати 500 символів.");
        }

        var phone = Services.PhoneNormalizer.TryNormalize(phoneRaw)
            ?? throw new ValidationAppException(
                "Введіть коректний український номер телефону у форматі +380XXXXXXXXX.", ErrorCodes.InvalidPhone);

        var booking = await db.Bookings
            .Include(b => b.Location)
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.CancelToken == holdToken, ct)
            ?? throw new NotFoundAppException(ErrorCodes.HoldNotFound, "Утримання місця не знайдено. Почніть спочатку.");

        if (booking.Status == "Confirmed")
        {
            // Double-submit protection: return the existing confirmation idempotently.
            return ToSummary(booking);
        }

        if (booking.Status == "Cancelled")
        {
            throw new ConflictAppException(ErrorCodes.HoldExpired, "Час утримання місця минув. Оберіть час ще раз.");
        }

        var now = clock.UtcNow;
        if (booking.HoldExpiresAtUtc is null || booking.HoldExpiresAtUtc <= now)
        {
            booking.Status = "Cancelled";
            booking.CancelledAtUtc = now;
            await db.SaveChangesAsync(ct);
            throw new ConflictAppException(ErrorCodes.HoldExpired, "Час утримання місця минув. Оберіть час ще раз.");
        }

        var duplicate = await db.Bookings.AnyAsync(b =>
            b.Id != booking.Id &&
            b.Phone == phone &&
            b.Date == booking.Date &&
            b.LocationId == booking.LocationId &&
            b.TimeSlotId == booking.TimeSlotId &&
            b.Status != "Cancelled", ct);
        if (duplicate)
        {
            throw new ConflictAppException(
                ErrorCodes.DuplicatePhoneSlot, "З цим номером телефону вже є запис на цю дату, локацію та час.");
        }

        booking.FirstName = fn;
        booking.LastName = ln;
        booking.Phone = phone;
        booking.Comment = cm;
        booking.Status = "Confirmed";
        booking.ConfirmedAtUtc = now;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new ConflictAppException(
                ErrorCodes.DuplicatePhoneSlot, "З цим номером телефону вже є запис на цю дату, локацію та час.");
        }

        return ToSummary(booking);
    }

    public async Task<BookingSummaryDto> GetByCancelTokenAsync(Guid cancelToken, CancellationToken ct)
    {
        var booking = await db.Bookings
            .Include(b => b.Location)
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.CancelToken == cancelToken, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Запис не знайдено.");

        return ToSummary(booking);
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

        return ToSummary(booking);
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

    private static BookingSummaryDto ToSummary(Booking b) => new(
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
        b.CancelledAtUtc?.ToString("O"));
}
