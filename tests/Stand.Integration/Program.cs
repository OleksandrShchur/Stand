using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Options;
using Stand.Server.Services;

// Intentionally fixed to the disposable database. Never uses appsettings credentials.
const string connection = "Server=(localdb)\\MSSQLLocalDB;Database=StandPerfTest;Trusted_Connection=True;TrustServerCertificate=True";
var clock = new KyivClock(new ConfigurationBuilder().Build());
var date = clock.TodayLocal.AddDays(1);
var options = Options.Create(new BookingOptions());
var counter = new CommandCounter();
DbContextOptions<StandDbContext> DbOptions(CommandCounter? interceptor = null)
{
    var builder = new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(connection);
    if (interceptor is not null) builder.AddInterceptors(interceptor);
    return builder.Options;
}
BookingService Service(StandDbContext db) => new(db, clock,
    new AvailabilityService(db, clock, options, new CurrentPublicUser(db)), options,
    NullLogger<BookingService>.Instance, new CurrentPublicUser(db));
void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
    Console.WriteLine("PASS " + message);
}

await using var setup = new StandDbContext(DbOptions());
var location = new Location { Name = "Integration " + Guid.NewGuid(), Capacity = 3, IsActive = true };
var users = Enumerable.Range(0, 4).Select(i => new AuthorizedUser
{
    Phone = "+38068" + Random.Shared.Next(1000000, 9999999),
    FirstName = "Integration", LastName = "User" + i, IsActive = true,
}).ToArray();
setup.Add(location);
setup.AddRange(users);
await setup.SaveChangesAsync();
var slotIds = await setup.TimeSlots.Where(s => s.IsActive && !s.IsScheduleOnly).OrderBy(s => s.StartTime).Select(s => s.Id).ToArrayAsync();
if (slotIds.Length < 5) throw new Exception("Seed at least five active slots before running integration checks.");
await setup.Database.ExecuteSqlInterpolatedAsync($"""
    IF NOT EXISTS (SELECT 1 FROM dbo.AvailableDates WHERE [Date] = {date})
        INSERT dbo.AvailableDates ([Date], IsActive) VALUES ({date}, 1)
    """);
var userIds = users.Select(u => u.Id).ToArray();
try
{
    await BookingStateMigrationChecks.Run(connection);
    await using (var db = new StandDbContext(DbOptions(counter)))
    {
        var current = new CurrentPublicUser(db);
        await current.GetAsync(users[0].Id, default); // Authentication middleware equivalent.
        var availability = new AvailabilityService(db, clock, options, current);
        var slots = await availability.GetSlotsAsync(date, location.Id, default, users[0].Id);
        Check(counter.Reads == 5, "Authenticated slots request uses five SQL reads (previously eight)");
        Check(slots.Count >= 5 && slots.All(s => s.Remaining == 3), "Empty-slot capacity is preserved");
        Check(counter.UserReads == 1, "Validated user is loaded only once in the request");
        var bookings = new BookingService(db, clock, availability, options, NullLogger<BookingService>.Instance, current);
        await bookings.GetMyUpcomingShiftsAsync(users[0].Id, default);
        Check(counter.UserReads == 1, "Upcoming shifts reuse the validated profile");
        await setup.AuthorizedUsers.Where(u => u.Id == users[0].Id).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false));
        await using var next = new StandDbContext(DbOptions());
        Check(await new CurrentPublicUser(next).GetAsync(users[0].Id, default) is null, "Disabled users are rejected on the next request");
        await setup.AuthorizedUsers.Where(u => u.Id == users[0].Id).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, true));
    }

    var history = new[]
    {
        new Booking { PublicNumber = Guid.NewGuid().ToString("N")[..20], LocationId = location.Id, Date = date, TimeSlotId = slotIds[4], IsBooked = false, Phone = users[2].Phone, FirstName = "Inactive", LastName = "History" },
        new Booking { PublicNumber = Guid.NewGuid().ToString("N")[..20], LocationId = location.Id, Date = date, TimeSlotId = slotIds[4], IsBooked = false, Phone = users[2].Phone, FirstName = "Inactive", LastName = "History" },
        new Booking { PublicNumber = Guid.NewGuid().ToString("N")[..20], LocationId = location.Id, Date = date, TimeSlotId = slotIds[4], IsBooked = true, Phone = users[3].Phone, FirstName = "Booked", LastName = "Participant" },
    };
    setup.AddRange(history);
    await setup.SaveChangesAsync();
    await using (var db = new StandDbContext(DbOptions()))
    {
        var slots = await new AvailabilityService(db, clock, options, new CurrentPublicUser(db))
            .GetSlotsAsync(date, location.Id, default, users[0].Id);
        var slot = slots.Single(s => s.TimeSlotId == slotIds[4]);
        Check(slot.Booked == 1 && slot.Remaining == 2 && slot.Participants.Count == 1 && slot.Participants[0].FirstName == "Booked",
            "Only booked rows consume capacity or appear as participants; inactive history is ignored");
        var booking = await Service(db).BookAsync(date, location.Id, slotIds[4], users[0].Id, default);
        Check(booking.IsBooked, "A booking is immediately booked without any pending or held state");
        await Service(db).CancelAsync(Guid.Parse(booking.CancelToken), default);
        var afterCancel = await new AvailabilityService(db, clock, options, new CurrentPublicUser(db)).GetSlotsAsync(date, location.Id, default, users[0].Id);
        Check(afterCancel.Single(s => s.TimeSlotId == slotIds[4]).Remaining == 2, "Cancellation frees the place immediately");
        var rebooked = await Service(db).BookAsync(date, location.Id, slotIds[4], users[0].Id, default);
        Check(rebooked.IsBooked && rebooked.CancelToken != booking.CancelToken, "The same participant can book again after cancellation");
        var admin = new Stand.Server.Controllers.Admin.AdminBookingsController(db);
        var inactive = (Stand.Server.Dtos.Admin.BookingListResultDto)((Microsoft.AspNetCore.Mvc.OkObjectResult)
            await admin.List(date.ToString("yyyy-MM-dd"), location.Id, slotIds[4], null, false, ct: default)).Value!;
        Check(inactive.Items.Count == 3 && inactive.Items.All(item => !item.IsBooked), "The admin false filter returns only inactive history");
        var csv = (Microsoft.AspNetCore.Mvc.FileContentResult)await admin.ExportCsv(date.ToString("yyyy-MM-dd"), location.Id, slotIds[4], null, false, default);
        var csvText = System.Text.Encoding.UTF8.GetString(csv.FileContents);
        Check(csvText.Contains(",IsBooked,") && !csvText.Contains(",Status,"), "CSV exposes only the binary booking flag");
    }

    var attempts = await Task.WhenAll(users.Select(async user =>
    {
        await using var db = new StandDbContext(DbOptions());
        try { await Service(db).BookAsync(date, location.Id, slotIds[0], user.Id, default); return true; }
        catch (ConflictAppException ex) when (ex.ErrorCode == ErrorCodes.SlotFull) { return false; }
    }));
    Check(attempts.Count(x => x) == 3, "Concurrent writers cannot exceed capacity three");

    var key = Guid.NewGuid();
    async Task<List<Stand.Server.Dtos.Public.BookingSummaryDto>> BookBatch(int userId, int[] ids, Guid requestId)
    {
        await using var db = new StandDbContext(DbOptions());
        return await Service(db).BookManyAsync(date, location.Id, ids, userId, default, requestId);
    }
    var pair = slotIds.Skip(1).Take(2).ToArray();
    var repeated = await Task.WhenAll(BookBatch(users[0].Id, pair, key), BookBatch(users[0].Id, pair.Reverse().ToArray(), key));
    Check(repeated[0].Select(b => b.CancelToken).SequenceEqual(repeated[1].Select(b => b.CancelToken)),
        "Concurrent identical request keys return the same batch tokens");
    Check(await setup.Bookings.CountAsync(b => b.LocationId == location.Id && pair.Contains(b.TimeSlotId)) == 2,
        "Idempotent retries insert a batch only once");
    var replay = await BookBatch(users[0].Id, pair, key);
    Check(replay.Select(b => b.CancelToken).SequenceEqual(repeated[0].Select(b => b.CancelToken)), "Committed responses replay across request scopes");
    var binaryJson = "\"isBooked\":true";
    var legacyJson = "\"status\":\"Confirmed\"";
    await setup.Database.ExecuteSqlInterpolatedAsync($"UPDATE dbo.BookingRequests SET ResponseJson = REPLACE(ResponseJson, {binaryJson}, {legacyJson}) WHERE AuthorizedUserId = {users[0].Id} AND RequestId = {key}");
    Check((await BookBatch(users[0].Id, pair, key)).All(b => b.IsBooked), "Legacy replay JSON resolves to the current booked state");
    try { await BookBatch(users[0].Id, [slotIds[3]], key); throw new Exception("Reused key accepted changed payload"); }
    catch (ConflictAppException ex) when (ex.ErrorCode == ErrorCodes.Conflict) { Console.WriteLine("PASS Changed payload rejects reused key"); }
    await BookBatch(users[1].Id, [slotIds[3]], key);
    Console.WriteLine("PASS Request keys are scoped to the authenticated user");

    await using (var db = new StandDbContext(DbOptions()))
    {
        var slots = await new AvailabilityService(db, clock, options, new CurrentPublicUser(db)).GetSlotsAsync(date, location.Id, default, users[0].Id);
        Check(slots.Single(s => s.TimeSlotId == pair[0]).Participants.Count == 0,
            "Own bookings count toward capacity while own names remain excluded");
        var token = Guid.Parse(replay[0].CancelToken);
        var first = await Service(db).CancelAsync(token, default);
        var second = await Service(db).CancelAsync(token, default);
        Check(!first.IsBooked && !second.IsBooked, "Cancellation retries succeed idempotently");
        var replayAfterCancel = await BookBatch(users[0].Id, pair, key);
        Check(!replayAfterCancel[0].IsBooked && replayAfterCancel[1].IsBooked, "Replay keeps cancelled bookings inactive instead of resurrecting them");
    }

    var failure = new CommandCounter { FailParticipantRead = true };
    var failedKey = Guid.NewGuid();
    await using (var db = new StandDbContext(DbOptions(failure)))
    {
        try { await Service(db).BookManyAsync(date, location.Id, [slotIds[3]], users[2].Id, default, failedKey); throw new Exception("Fault injection did not run"); }
        catch (InvalidOperationException ex) when (ex.Message == "Injected participant failure") { }
    }
    Check(!await setup.Bookings.AnyAsync(b => b.LocationId == location.Id && b.TimeSlotId == slotIds[3] && b.Phone == users[2].Phone),
        "A response-query failure rolls back the booking before commit");
    Check(await setup.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM dbo.BookingRequests WHERE RequestId = {failedKey}").SingleAsync() == 0,
        "A failed booking leaves no replay record");

    // Capture a genuine error 1205 using only this test's user rows. Then inject
    // that error after the booking INSERT to exercise full rollback and replay.
    async Task<SqlException> DeadlockErrorAsync()
    {
        await using var a = new SqlConnection(connection);
        await using var b = new SqlConnection(connection);
        await a.OpenAsync(); await b.OpenAsync();
        using var at = a.BeginTransaction();
        using var bt = b.BeginTransaction();
        async Task Read(SqlConnection conn, SqlTransaction tx, int id)
        {
            using var command = new SqlCommand("SELECT Id FROM dbo.AuthorizedUsers WITH (UPDLOCK,HOLDLOCK,ROWLOCK) WHERE Id=@id", conn, tx);
            command.Parameters.AddWithValue("@id", id);
            await command.ExecuteScalarAsync();
        }
        await Read(a, at, users[2].Id);
        await Read(b, bt, users[3].Id);
        async Task<SqlException?> Wait(SqlConnection conn, SqlTransaction tx, int id)
        {
            try { await Read(conn, tx, id); return null; }
            catch (SqlException ex) when (ex.Number == 1205) { return ex; }
        }
        var victims = await Task.WhenAll(Wait(a, at, users[3].Id), Wait(b, bt, users[2].Id));
        return victims.Single(e => e is not null)!;
    }
    var deadlock = await DeadlockErrorAsync();
    var retryFault = new CommandCounter { ParticipantException = deadlock, ExceptionsRemaining = 1 };
    var retryKey = Guid.NewGuid();
    await using (var db = new StandDbContext(DbOptions(retryFault)))
        await Service(db).BookManyAsync(date, location.Id, [slotIds[3]], users[2].Id, default, retryKey);
    Check(retryFault.Injected == 1 && await setup.Bookings.CountAsync(b => b.LocationId == location.Id && b.Phone == users[2].Phone && b.TimeSlotId == slotIds[3]) == 1,
        "A deadlock after INSERT retries the complete transaction without duplicating the booking");
    var exhausted = new CommandCounter { ParticipantException = deadlock, ExceptionsRemaining = 3 };
    await using (var db = new StandDbContext(DbOptions(exhausted)))
    {
        try { await Service(db).BookManyAsync(date, location.Id, [slotIds[3]], users[3].Id, default, Guid.NewGuid()); throw new Exception("Retry limit was not enforced"); }
        catch (InvalidOperationException ex) when (ex.InnerException is SqlException { Number: 1205 }) { }
    }
    Check(exhausted.Injected == 3 && !await setup.Bookings.AnyAsync(b => b.LocationId == location.Id && b.Phone == users[3].Phone && b.TimeSlotId == slotIds[3]),
        "Deadlock retries stop after three attempts and leave no partial booking");
    await ScheduleChecks.Run(connection);
    await LocationChecks.Run(connection);
    Console.WriteLine("All integration checks passed.");
}
finally
{
    await using var cleanup = new StandDbContext(DbOptions());
    foreach (var userId in userIds)
        await cleanup.Database.ExecuteSqlInterpolatedAsync($"DELETE dbo.BookingRequests WHERE AuthorizedUserId = {userId}");
    await cleanup.Bookings.Where(b => b.LocationId == location.Id).ExecuteDeleteAsync();
    await cleanup.Locations.Where(l => l.Id == location.Id).ExecuteDeleteAsync();
    await cleanup.AuthorizedUsers.Where(u => userIds.Contains(u.Id)).ExecuteDeleteAsync();
}

sealed class CommandCounter : DbCommandInterceptor
{
    public int Reads, UserReads;
    public bool FailParticipantRead;
    public Exception? ParticipantException;
    public int ExceptionsRemaining, Injected;
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        Reads++;
        if (command.CommandText.Contains("FROM [AuthorizedUsers]")) UserReads++;
        if ((FailParticipantRead || ExceptionsRemaining > 0) && command.CommandText.Contains("FROM [Bookings] AS [b]") &&
            command.CommandText.Contains("[FirstName]") && !command.CommandText.Contains("INSERT"))
        {
            if (ExceptionsRemaining > 0)
            {
                ExceptionsRemaining--;
                Injected++;
                throw ParticipantException!;
            }
            FailParticipantRead = false;
            throw new InvalidOperationException("Injected participant failure");
        }
        return ValueTask.FromResult(result);
    }
}
