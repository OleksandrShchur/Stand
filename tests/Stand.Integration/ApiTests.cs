using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Data.Entities;
using Stand.Server.Dtos.Admin;
using Stand.Server.Dtos.Public;
using Stand.Server.Services;

[Collection(SqlDatabaseCollection.Name)]
public sealed class ApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "Integration-password-123";

    [Theory]
    [InlineData("/api/admin/users")]
    [InlineData("/api/admin/bookings")]
    [InlineData("/api/admin/schedule?date=2026-11-06")]
    [InlineData("/api/admin/authorized-users")]
    [InlineData("/api/bookings/mine")]
    [InlineData("/api/calendar")]
    [InlineData("/api/locations")]
    [InlineData("/api/slots?date=2026-11-06&locationId=1")]
    public async Task ProtectedEndpointsChallengeWithoutRedirect(string path)
    {
        using var client = factory.NewClient();
        var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    [Fact]
    public async Task HealthEndpointNeedsNoSession()
    {
        using var client = factory.NewClient();
        (await client.GetAsync("/api/health")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task AdminSessionAndManagementRoundTripThroughRealRoutes()
    {
        await using var db = factory.NewDb();
        var root = await new AdminAuthService(db).CreateAsync("api-" + Guid.NewGuid().ToString("N"), Password, default);
        var login = "child-" + Guid.NewGuid().ToString("N");
        var phone = "+38067" + Random.Shared.Next(1000000, 9999999);
        var locationName = "API " + Guid.NewGuid();
        int slotId = 0;
        try
        {
            using var client = factory.NewClient();
            await Expect(await client.PostAsJsonAsync("/api/admin/auth/login", new { login = " ", password = " " }), HttpStatusCode.BadRequest);
            await Expect(await client.PostAsJsonAsync("/api/admin/auth/login", new { login = root.Login, password = "wrong" }), HttpStatusCode.Unauthorized);
            var signedIn = await client.PostAsJsonAsync("/api/admin/auth/login", new { login = " " + root.Login + " ", password = Password });
            signedIn.EnsureSuccessStatusCode();
            Assert.Contains(signedIn.Headers.GetValues("Set-Cookie"), c => c.Contains("stand_admin=") && c.Contains("httponly", StringComparison.OrdinalIgnoreCase));
            Assert.Equal(root.Id, (await client.GetFromJsonAsync<AdminMeDto>("/api/admin/auth/me"))!.Id);
            await db.Entry(root).ReloadAsync();
            Assert.NotNull(root.LastLoginAtUtc);

            var child = await Post<AdminUserDto>(client, "/api/admin/users", new { login, password = Password });
            Assert.True(child.IsActive);
            Assert.Contains((await client.GetFromJsonAsync<AdminUserDto[]>("/api/admin/users"))!, x => x.Id == child.Id);
            await Post<AdminUserDto>(client, $"/api/admin/users/{child.Id}/disable", new { });
            await Post<AdminUserDto>(client, $"/api/admin/users/{child.Id}/enable", new { });
            await Expect(await client.PostAsJsonAsync($"/api/admin/users/{root.Id}/disable", new { }), HttpStatusCode.BadRequest);
            await Expect(await client.DeleteAsync($"/api/admin/users/{root.Id}"), HttpStatusCode.BadRequest);
            await Expect(await client.PutAsJsonAsync($"/api/admin/users/{child.Id}/password", new { password = "Replacement-password", confirmPassword = "Replacement-password" }), HttpStatusCode.NoContent);
            await Expect(await client.DeleteAsync($"/api/admin/users/{child.Id}"), HttpStatusCode.NoContent);
            await Expect(await client.DeleteAsync($"/api/admin/users/{child.Id}"), HttpStatusCode.NotFound);

            var person = await Post<AuthorizedUserAdminDto>(client, "/api/admin/authorized-users", new { phone, firstName = " Олена ", lastName = " Тестова " });
            Assert.Equal("Олена", person.FirstName);
            var updated = await client.PutAsJsonAsync($"/api/admin/authorized-users/{person.Id}", new { phone, firstName = "Нове", lastName = "Ім’я" });
            updated.EnsureSuccessStatusCode();
            Assert.Equal("Нове", (await updated.Content.ReadFromJsonAsync<AuthorizedUserAdminDto>())!.FirstName);
            Assert.Contains((await client.GetFromJsonAsync<AuthorizedUserAdminDto[]>("/api/admin/authorized-users"))!, x => x.Id == person.Id);
            await Post<AuthorizedUserAdminDto>(client, $"/api/admin/authorized-users/{person.Id}/disable", new { });
            await Post<AuthorizedUserAdminDto>(client, $"/api/admin/authorized-users/{person.Id}/enable", new { });
            await Expect(await client.DeleteAsync($"/api/admin/authorized-users/{person.Id}"), HttpStatusCode.NoContent);

            var location = await Post<LocationAdminDto>(client, "/api/admin/locations", new { name = locationName, address = "  Площа  ", capacity = 2, sortOrder = 3, isActive = true });
            Assert.Equal("Площа", location.Address);
            Assert.Contains((await client.GetFromJsonAsync<LocationAdminDto[]>("/api/admin/locations"))!, x => x.Id == location.Id);
            await Post<LocationAdminDto>(client, $"/api/admin/locations/{location.Id}/deactivate", new { });
            await Post<LocationAdminDto>(client, $"/api/admin/locations/{location.Id}/activate", new { });
            await Expect(await client.DeleteAsync($"/api/admin/locations/{location.Id}"), HttpStatusCode.NoContent);

            // Use an unused immutable range, and remove only the row owned by this test.
            var ranges = await db.TimeSlots.Select(s => s.StartTime).ToListAsync();
            var start = Enumerable.Range(0, 180).Select(m => new TimeOnly(0, 0).AddMinutes(m)).First(t => !ranges.Contains(t));
            var slot = await Post<TimeSlotAdminDto>(client, "/api/admin/timeslots", new { startTime = start.ToString("HH:mm"), endTime = start.AddMinutes(1).ToString("HH:mm"), sortOrder = 999, isActive = true });
            slotId = slot.Id;
            await Post<TimeSlotAdminDto>(client, $"/api/admin/timeslots/{slotId}/deactivate", new { });
            await Post<TimeSlotAdminDto>(client, $"/api/admin/timeslots/{slotId}/activate", new { });
            var slotUpdate = await client.PutAsJsonAsync($"/api/admin/timeslots/{slotId}", new { startTime = slot.StartTime, endTime = slot.EndTime, sortOrder = 1000, isActive = true });
            slotUpdate.EnsureSuccessStatusCode();
            Assert.Equal(1000, (await slotUpdate.Content.ReadFromJsonAsync<TimeSlotAdminDto>())!.SortOrder);
            Assert.Contains((await client.GetFromJsonAsync<TimeSlotAdminDto[]>("/api/admin/timeslots?includeScheduleOnly=true"))!, x => x.Id == slotId);

            var date = new KyivClock(new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build()).TodayLocal.AddDays(70).ToString("yyyy-MM-dd");
            var exception = await Post<DateTimeSlotExceptionAdminDto>(client, "/api/admin/exceptions", new { date, timeSlotId = slotId, isBlocked = true, note = "API test" });
            var changed = await Post<DateTimeSlotExceptionAdminDto>(client, "/api/admin/exceptions", new { date, timeSlotId = slotId, isBlocked = false, note = "updated" });
            Assert.Equal(exception.Id, changed.Id);
            Assert.False(changed.IsBlocked);
            Assert.Contains((await client.GetFromJsonAsync<DateTimeSlotExceptionAdminDto[]>($"/api/admin/exceptions?date={date}"))!, x => x.Id == exception.Id);
            await Expect(await client.DeleteAsync($"/api/admin/exceptions/{exception.Id}"), HttpStatusCode.NoContent);
            await Expect(await client.DeleteAsync($"/api/admin/exceptions/{exception.Id}"), HttpStatusCode.NotFound);

            await Expect(await client.PostAsJsonAsync("/api/admin/auth/logout", new { }), HttpStatusCode.NoContent);
            await Expect(await client.GetAsync("/api/admin/users"), HttpStatusCode.Unauthorized);
        }
        finally
        {
            await db.DateTimeSlotExceptions.Where(e => e.TimeSlotId == slotId).ExecuteDeleteAsync();
            await db.TimeSlots.Where(s => s.Id == slotId).ExecuteDeleteAsync();
            await db.AuthorizedUsers.Where(u => u.Phone == phone).ExecuteDeleteAsync();
            await db.Locations.Where(l => l.Name == locationName).ExecuteDeleteAsync();
            await db.AdminUsers.Where(a => a.Id == root.Id || a.Login == login).ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task PublicSessionValidatesRequestsAndRevokesDisabledAccounts()
    {
        await using var db = factory.NewDb();
        var phone = "+38068" + Random.Shared.Next(1000000, 9999999);
        var user = await new PublicUserAuthService(db).CreateAsync(phone, "API", "Participant", default);
        try
        {
            using var client = factory.NewClient();
            await Expect(await client.PostAsJsonAsync("/api/auth/login", new { phone = "invalid" }), HttpStatusCode.BadRequest);
            var login = await client.PostAsJsonAsync("/api/auth/login", new { phone });
            login.EnsureSuccessStatusCode();
            Assert.Equal(user.Id, (await login.Content.ReadFromJsonAsync<PublicUserMeDto>())!.Id);
            Assert.Equal(phone, (await client.GetFromJsonAsync<PublicUserMeDto>("/api/auth/me"))!.Phone);
            await Expect(await client.GetAsync("/api/admin/users"), HttpStatusCode.Unauthorized);
            (await client.GetAsync("/api/calendar")).EnsureSuccessStatusCode();
            (await client.GetAsync("/api/locations")).EnsureSuccessStatusCode();
            await Expect(await client.GetAsync("/api/slots?date=bad&locationId=1"), HttpStatusCode.BadRequest);
            await Expect(await client.PostAsJsonAsync("/api/bookings", new { date = "bad", locationId = 1, timeSlotId = 1 }), HttpStatusCode.BadRequest);
            await Expect(await client.PostAsJsonAsync("/api/bookings/batch", new { date = "2026-11-06", locationId = 1, timeSlotIds = Array.Empty<int>() }), HttpStatusCode.BadRequest);
            await Expect(await client.PostAsJsonAsync("/api/bookings/cancel", new { cancelToken = "bad" }), HttpStatusCode.BadRequest);
            await Expect(await client.GetAsync($"/api/bookings/{Guid.NewGuid()}"), HttpStatusCode.NotFound);
            var empty = await client.GetFromJsonAsync<MyShiftDto[]>("/api/bookings/mine");
            Assert.Empty(empty!);
            await Expect(await client.PostAsJsonAsync("/api/feedback", new { comment = "HTTP integration feedback" }), HttpStatusCode.NoContent);
            Assert.Equal(user.Phone, (await db.Feedback.SingleAsync(f => f.AuthorizedUserId == user.Id)).Phone);
            await Expect(await client.PostAsJsonAsync("/api/auth/logout", new { }), HttpStatusCode.NoContent);
            await Expect(await client.GetAsync("/api/auth/me"), HttpStatusCode.Unauthorized);
            (await client.PostAsJsonAsync("/api/auth/login", new { phone })).EnsureSuccessStatusCode();
            await db.AuthorizedUsers.Where(u => u.Id == user.Id).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false));
            await Expect(await client.GetAsync("/api/auth/me"), HttpStatusCode.Unauthorized);
        }
        finally
        {
            await db.Feedback.Where(f => f.AuthorizedUserId == user.Id).ExecuteDeleteAsync();
            await db.AuthorizedUsers.Where(u => u.Id == user.Id).ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task BookingJourneyChecksHeadersPersistsParticipantsAndReplaysCancellations()
    {
        await using var db = factory.NewDb();
        var user = await new PublicUserAuthService(db).CreateAsync("+38069" + Random.Shared.Next(1000000, 9999999), "HTTP", "Booking", default);
        var place = new Location { Name = "HTTP booking " + Guid.NewGuid(), Capacity = 2, IsActive = true };
        db.Add(place);
        await db.SaveChangesAsync();
        var date = new KyivClock(new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build()).TodayLocal.AddDays(1);
        var day = await db.AvailableDates.SingleOrDefaultAsync(d => d.Date == date);
        var old = day is null ? ((bool Active, bool Custom)?)null : (day.IsActive, day.UseCustomSchedule);
        if (day is null) { day = new AvailableDate { Date = date }; db.Add(day); }
        day.IsActive = true;
        day.UseCustomSchedule = false;
        await db.SaveChangesAsync();
        try
        {
            using var client = factory.NewClient();
            (await client.PostAsJsonAsync("/api/auth/login", new { phone = user.Phone })).EnsureSuccessStatusCode();
            var dateText = date.ToString("yyyy-MM-dd");
            var slots = await client.GetFromJsonAsync<SlotAvailabilityDto[]>($"/api/slots?date={dateText}&locationId={place.Id}");
            var ordered = slots!.Where(s => s.IsBookable).OrderBy(s => s.StartTime).ToArray();
            var index = Enumerable.Range(0, ordered.Length - 1).First(i => ordered[i].EndTime == ordered[i + 1].StartTime);
            int[] ids = [ordered[index].TimeSlotId, ordered[index + 1].TimeSlotId];
            var payload = new { date = dateText, locationId = place.Id, timeSlotIds = ids };
            client.DefaultRequestHeaders.Add("Idempotency-Key", "bad-key");
            await Expect(await client.PostAsJsonAsync("/api/bookings/batch", payload), HttpStatusCode.BadRequest);
            client.DefaultRequestHeaders.Remove("Idempotency-Key");
            client.DefaultRequestHeaders.Add("Idempotency-Key", Guid.Empty.ToString());
            await Expect(await client.PostAsJsonAsync("/api/bookings/batch", payload), HttpStatusCode.BadRequest);
            client.DefaultRequestHeaders.Remove("Idempotency-Key");
            client.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
            var booked = await Post<BookingSummaryDto[]>(client, "/api/bookings/batch", payload);
            Assert.Equal(2, booked.Length);
            Assert.All(booked, b => { Assert.True(b.IsBooked); Assert.Equal(user.FirstName, b.Participants.Single().FirstName); });
            var replay = await Post<BookingSummaryDto[]>(client, "/api/bookings/batch", payload);
            Assert.Equal(booked.Select(b => b.CancelToken), replay.Select(b => b.CancelToken));
            var summary = await client.GetFromJsonAsync<BookingSummaryDto>("/api/bookings/" + booked[0].CancelToken);
            Assert.Equal(booked[0].PublicNumber, summary!.PublicNumber);
            var cancelled = await Post<BookingSummaryDto>(client, "/api/bookings/cancel", new { cancelToken = booked[0].CancelToken });
            Assert.False(cancelled.IsBooked);
            Assert.Empty(cancelled.Participants);
            var mine = await client.GetFromJsonAsync<MyShiftDto[]>("/api/bookings/mine");
            Assert.Single(mine!);
            var cancelledReplay = await Post<BookingSummaryDto[]>(client, "/api/bookings/batch", payload);
            Assert.False(cancelledReplay[0].IsBooked);
            client.DefaultRequestHeaders.Remove("Idempotency-Key");
            var single = await Post<BookingSummaryDto>(client, "/api/bookings", new { date = dateText, locationId = place.Id, timeSlotId = ids[0] });
            Assert.True(single.IsBooked);
            Assert.NotEqual(booked[0].CancelToken, single.CancelToken);
        }
        finally
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"DELETE dbo.BookingRequests WHERE AuthorizedUserId = {user.Id}");
            await db.Bookings.Where(b => b.LocationId == place.Id).ExecuteDeleteAsync();
            await db.Locations.Where(l => l.Id == place.Id).ExecuteDeleteAsync();
            await db.AuthorizedUsers.Where(u => u.Id == user.Id).ExecuteDeleteAsync();
            if (old is { } state)
                await db.AvailableDates.Where(d => d.Date == date).ExecuteUpdateAsync(s => s.SetProperty(d => d.IsActive, state.Active).SetProperty(d => d.UseCustomSchedule, state.Custom));
            else
                await db.AvailableDates.Where(d => d.Date == date).ExecuteDeleteAsync();
        }
    }

    private static async Task<T> Post<T>(HttpClient client, string path, object body)
    {
        var response = await client.PostAsJsonAsync(path, body);
        Assert.True(response.IsSuccessStatusCode, $"{path}: {(int)response.StatusCode} {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    private static async Task Expect(HttpResponseMessage response, HttpStatusCode status)
    {
        Assert.Equal(status, response.StatusCode);
        if (status is HttpStatusCode.BadRequest or HttpStatusCode.NotFound)
        {
            var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal((int)status, problem.GetProperty("status").GetInt32());
            Assert.True(problem.TryGetProperty("errorCode", out _));
        }
    }
}
