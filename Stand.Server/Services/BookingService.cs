using Microsoft.Data.SqlClient;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
    ILogger<BookingService> logger,
    CurrentPublicUser currentUser) : IBookingService
{
    private const int UniqueConstraintViolationSqlError = 2601;
    private const int UniqueIndexViolationSqlError = 2627;

    private readonly BookingOptions _options = options.Value;
    private static readonly JsonSerializerOptions ReplayJson = new(JsonSerializerDefaults.Web);

    public async Task<List<MyShiftDto>> GetMyUpcomingShiftsAsync(int authorizedUserId, CancellationToken ct)
    {
        var user = await currentUser.GetAsync(authorizedUserId, ct)
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
        int authorizedUserId, CancellationToken ct, Guid? requestId = null)
        => (await BookManyAsync(date, locationId, [timeSlotId], authorizedUserId, ct, requestId)).Single();

    public Task<List<BookingSummaryDto>> BookManyAsync(
        DateOnly date, int locationId, IReadOnlyList<int> timeSlotIds,
        int authorizedUserId, CancellationToken ct, Guid? requestId = null)
        => RetryDeadlocksAsync(() => BookManyCoreAsync(date, locationId, timeSlotIds, authorizedUserId, ct, requestId), ct);

    private async Task<List<BookingSummaryDto>> BookManyCoreAsync(
        DateOnly date, int locationId, IReadOnlyList<int> timeSlotIds,
        int authorizedUserId, CancellationToken ct, Guid? requestId)
    {
        if (timeSlotIds.Count == 0 || timeSlotIds.Distinct().Count() != timeSlotIds.Count)
            throw new ValidationAppException("Оберіть одну або кілька послідовних записів без повторів.");

        var user = await currentUser.GetAsync(authorizedUserId, ct)
            ?? throw new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Увійдіть у систему.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            date = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            locationId,
            timeSlotIds = timeSlotIds.Order().ToArray(),
        }))));
        if (requestId is Guid key)
        {
            // Concurrent retries wait for the original transaction, then replay.
            var replay = await db.Database.SqlQuery<BookingRequestReplay>($"""
                SELECT Fingerprint, ResponseJson FROM dbo.BookingRequests WITH (UPDLOCK, HOLDLOCK)
                WHERE AuthorizedUserId = {authorizedUserId} AND RequestId = {key}
                """).SingleOrDefaultAsync(ct);
            if (replay is not null)
            {
                if (replay.Fingerprint != fingerprint)
                    throw new ConflictAppException(ErrorCodes.Conflict, "Ключ запиту вже використано для іншого запису.");
                var response = JsonSerializer.Deserialize<List<BookingSummaryDto>>(replay.ResponseJson, ReplayJson)
                    ?? throw new InvalidOperationException("Invalid stored booking response.");
                await tx.CommitAsync(ct);
                return response;
            }
        }

        var fn = user.FirstName.Trim();
        var ln = user.LastName.Trim();
        if (fn.Length is < 1 or > 100 || ln.Length is < 1 or > 100)
            throw new ValidationAppException("Зверніться до адміністратора, щоб заповнити ім'я та прізвище у вашому профілі.");
        var phone = PhoneNormalizer.TryNormalize(user.Phone)
            ?? throw new ValidationAppException("Зверніться до адміністратора, щоб виправити номер телефону у вашому профілі.", ErrorCodes.InvalidPhone);

        await ScheduleLock.AcquireAsync(db, date, false, ct);
        await availability.EnsureDateBookableAsync(date, ct);

        var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == locationId, ct)
            ?? throw new NotFoundAppException(ErrorCodes.LocationNotFound, "Локацію не знайдено.");
        if (!location.IsActive)
        {
            throw new ValidationAppException("Ця локація зараз недоступна.", ErrorCodes.LocationInactive);
        }

        var timeSlots = await db.TimeSlots.Where(t => timeSlotIds.Contains(t.Id))
            .OrderBy(t => t.StartTime).ThenBy(t => t.Id).ToListAsync(ct);
        if (timeSlots.Count != timeSlotIds.Count)
            throw new NotFoundAppException(ErrorCodes.TimeSlotNotFound, "Час не знайдено.");
        for (var index = 0; index < timeSlots.Count; index++)
        {
            if (timeSlots[index].StartTime >= timeSlots[index].EndTime ||
                (index > 0 && timeSlots[index - 1].EndTime != timeSlots[index].StartTime))
                throw new ValidationAppException("Оберіть послідовні записи без перерв та накладань.");
        }

        var blockedIds = await db.DateTimeSlotExceptions
            .Where(e => e.Date == date && timeSlotIds.Contains(e.TimeSlotId) && e.IsBlocked)
            .Select(e => e.TimeSlotId).ToListAsync(ct);
        var isCustomSchedule = await db.AvailableDates.AnyAsync(d => d.Date == date && d.UseCustomSchedule, ct);
        var scheduledIds = isCustomSchedule ? await db.ScheduleSlots
            .Where(s => s.Date == date && s.LocationId == locationId && timeSlotIds.Contains(s.TimeSlotId))
            .Select(s => s.TimeSlotId).ToListAsync(ct) : [];
        foreach (var timeSlot in timeSlots)
        {
            if (isCustomSchedule ? !scheduledIds.Contains(timeSlot.Id) : (!timeSlot.IsActive || timeSlot.IsScheduleOnly))
            {
                throw new ValidationAppException("Цей час зараз недоступний.", ErrorCodes.TimeSlotBlocked);
            }

            if (!isCustomSchedule && blockedIds.Contains(timeSlot.Id))
            {
                throw new ValidationAppException("Цей час недоступний для обраної дати.", ErrorCodes.TimeSlotBlocked);
            }

            if (availability.IsSlotTooSoon(date, timeSlot.StartTime))
            {
                throw new ValidationAppException(
                    $"Запис можливий лише не раніше ніж за {_options.MinLeadTimeMinutes} хв до початку чергування.",
                    ErrorCodes.SlotTooSoon);
            }

        }

        // Lock every selected slot in a consistent order, then save all bookings together.
        var now = clock.UtcNow;
        foreach (var timeSlot in timeSlots.OrderBy(t => t.Id))
        {
            var activeCount = await CountActiveWithLockAsync(date, locationId, timeSlot.Id, now, ct);

            if (await db.Bookings.AnyAsync(b => b.Date == date && b.LocationId == locationId &&
                b.TimeSlotId == timeSlot.Id && b.Phone == phone && b.Status != "Cancelled", ct))
                throw new ConflictAppException(ErrorCodes.DuplicatePhoneSlot,
                    "З цим номером телефону вже є запис на цю дату, локацію та час.");

            if (activeCount >= location.Capacity)
            {
                await tx.RollbackAsync(ct);
                throw new ConflictAppException(ErrorCodes.SlotFull, "На цей час вже немає вільних місць (Зайнято).");
            }

        }

        var created = new List<Booking>();
        foreach (var timeSlot in timeSlots)
        {
            var booking = new Booking
            {
                PublicNumber = BookingNumberGenerator.Generate(date),
                LocationId = locationId,
                Date = date,
                TimeSlotId = timeSlot.Id,
                Status = "Confirmed",
                FirstName = fn,
                LastName = ln,
                Phone = phone,
                ConfirmedAtUtc = now,
                Location = location,
                TimeSlot = timeSlot,
            };

            db.Bookings.Add(booking);
            created.Add(booking);
        }
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new ConflictAppException(ErrorCodes.DuplicatePhoneSlot,
                "З цим номером телефону вже є запис на цю дату, локацію та час.");
        }
        // Build the response before commit, with one participant query for the batch.
        // A failed response query can no longer leave a committed booking behind.
        var participants = await db.Bookings
            .Where(b => b.Date == date && b.LocationId == locationId && timeSlotIds.Contains(b.TimeSlotId) &&
                b.Status == "Confirmed" && b.Phone != phone)
            .OrderBy(b => b.LastName).ThenBy(b => b.FirstName).ThenBy(b => b.Id)
            .Select(b => new { b.TimeSlotId, b.FirstName, b.LastName }).ToListAsync(ct);
        var summaries = created.Select(booking => ToSummary(booking, participants
            .Where(p => p.TimeSlotId == booking.TimeSlotId)
            .Select(p => new ShiftParticipantDto(p.FirstName, p.LastName)).ToList())).ToList();
        if (requestId is Guid completedKey)
        {
            var json = JsonSerializer.Serialize(summaries, ReplayJson);
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT dbo.BookingRequests (AuthorizedUserId, RequestId, Fingerprint, ResponseJson)
                VALUES ({authorizedUserId}, {completedKey}, {fingerprint}, {json})
                """, ct);
        }
        await tx.CommitAsync(ct);
        return summaries;
    }

    public async Task<BookingSummaryDto> GetByCancelTokenAsync(Guid cancelToken, CancellationToken ct)
    {
        var booking = await db.Bookings.AsNoTracking()
            .Include(b => b.Location)
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.CancelToken == cancelToken, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Запис не знайдено.");

        return await ToSummaryAsync(booking, ct);
    }

    public Task<BookingSummaryDto> CancelAsync(Guid cancelToken, CancellationToken ct)
        => RetryDeadlocksAsync(() => CancelCoreAsync(cancelToken, ct), ct);

    private async Task<BookingSummaryDto> CancelCoreAsync(Guid cancelToken, CancellationToken ct)
    {
        var booking = await db.Bookings
            .Include(b => b.Location)
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.CancelToken == cancelToken, ct)
            ?? throw new NotFoundAppException(ErrorCodes.NotFound, "Запис не знайдено.");

        var summary = await ToSummaryAsync(booking, ct);
        if (booking.Status == "Cancelled") return summary;

        booking.Status = "Cancelled";
        booking.CancelledAtUtc = clock.UtcNow;
        await db.SaveChangesAsync(ct);

        return summary with { Status = booking.Status, CancelledAtUtc = booking.CancelledAtUtc?.ToString("O") };
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

        return ToSummary(b, participants);
    }

    private static BookingSummaryDto ToSummary(Booking b, List<ShiftParticipantDto> participants) => new(
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

    private async Task<T> RetryDeadlocksAsync<T>(Func<Task<T>> operation, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            try { return await operation(); }
            catch (Exception ex) when (attempt < 2 && IsDeadlock(ex))
            {
                db.ChangeTracker.Clear();
                logger.LogWarning("Retrying booking operation after SQL deadlock, attempt {Attempt}", attempt + 1);
                await Task.Delay(TimeSpan.FromMilliseconds(Random.Shared.Next(25, 100) * (attempt + 1)), ct);
            }
        }
    }

    private static bool IsDeadlock(Exception ex)
    {
        for (Exception? current = ex; current is not null; current = current.InnerException)
            if (current is SqlException sql && sql.Errors.Cast<SqlError>().Any(e => e.Number == 1205)) return true;
        return false;
    }
}

public sealed class BookingRequestReplay
{
    public string Fingerprint { get; set; } = "";
    public string ResponseJson { get; set; } = "";
}
