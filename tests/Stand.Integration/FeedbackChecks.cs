using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Controllers.Public;
using Stand.Server.Controllers.Admin;
using Stand.Server.Dtos.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.Cookies;
using Stand.Server.Data;
using Stand.Server.Data.Entities;
using Stand.Server.Services;

internal static class FeedbackChecks
{
    public static async Task Run(string connection)
    {
        var options = new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(connection).Options;
        await using var setup = new StandDbContext(options);
        var script = await File.ReadAllTextAsync(Path.Combine("db", "scripts", "0017_CreateFeedbackTable.sql"));
        async Task Migrate()
        {
            foreach (var batch in Regex.Split(script, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase))
                if (!string.IsNullOrWhiteSpace(batch)) await setup.Database.ExecuteSqlRawAsync(batch);
        }
        await Migrate();
        var users = Enumerable.Range(0, 2).Select(i => new AuthorizedUser
        {
            Phone = "+38065" + Random.Shared.Next(1000000, 9999999),
            FirstName = "Відгук", LastName = "Тест" + i, IsActive = true,
        }).ToArray();
        setup.AddRange(users);
        await setup.SaveChangesAsync();
        var phones = users.Select(u => u.Phone).ToArray();
        var ids = users.Select(u => u.Id).ToArray();
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
            Console.WriteLine("PASS " + message);
        }
        async Task Submit(int userId, string? comment)
        {
            await using var db = new StandDbContext(options);
            await new FeedbackService(db, new CurrentPublicUser(db)).SubmitAsync(userId, comment, default);
        }
        try
        {
            foreach (var invalid in new string?[] { null, "", " \t\r\n", "\u00a0", new string('а', 501), new string(' ', 500) + "а" })
            {
                try { await Submit(users[0].Id, invalid); throw new Exception("Invalid feedback accepted"); }
                catch (ValidationAppException) { }
            }
            Check(!await setup.Feedback.AnyAsync(f => phones.Contains(f.Phone)), "Empty, whitespace-only and over-500 feedback is rejected without storing rows");
            var before = DateTime.UtcNow.AddSeconds(-1);
            await Submit(users[0].Id, "  Дякую!\nЗручний сайт.  ");
            var saved = await setup.Feedback.AsNoTracking().SingleAsync(f => f.Phone == users[0].Phone);
            Check(saved.Comment == "Дякую!\nЗручний сайт." && saved.AuthorizedUserId == users[0].Id &&
                saved.FirstName == users[0].FirstName && saved.LastName == users[0].LastName && saved.CreatedAtUtc >= before,
                "General feedback stores trimmed text, server-derived author identity and UTC time without a booking");
            await Migrate();
            Check(await setup.Feedback.AnyAsync(f => f.Id == saved.Id), "Reapplying the feedback migration preserves submitted feedback");
            await Submit(users[1].Id, new string('а', 500));
            Check(await setup.Feedback.AnyAsync(f => f.Phone == users[1].Phone && f.Comment.Length == 500), "The server accepts exactly 500 characters");

            await using (var db = new StandDbContext(options))
            {
                var controller = new FeedbackController(new FeedbackService(db, new CurrentPublicUser(db)))
                {
                    ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
                };
                try { await controller.Create(new("Без авторизації"), default); throw new Exception("Anonymous feedback accepted"); }
                catch (UnauthorizedAppException) { }
                controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, users[1].Id.ToString())], "test"));
                Check(await controller.Create(new("Від другого користувача"), default) is NoContentResult,
                    "Feedback POST uses the authenticated identity and returns no stored comment or history");
            }
            await setup.AuthorizedUsers.Where(u => u.Id == users[1].Id).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false));
            foreach (var id in new[] { users[1].Id, int.MaxValue })
            {
                try { await Submit(id, "Не має зберегтися"); throw new Exception("Inactive or missing user accepted"); }
                catch (UnauthorizedAppException) { }
            }
            Check(await setup.Feedback.CountAsync(f => phones.Contains(f.Phone)) == 3, "Inactive and nonexistent users cannot submit feedback");
            await setup.AuthorizedUsers.Where(u => u.Id == users[0].Id).ExecuteDeleteAsync();
            var retained = await setup.Feedback.AsNoTracking().SingleAsync(f => f.Id == saved.Id);
            Check(retained.AuthorizedUserId is null && retained.Phone == saved.Phone && retained.FirstName == saved.FirstName,
                "Account deletion remains possible and feedback retains its original author identity");

            // Use tied timestamps later than ordinary feedback to verify deterministic page boundaries.
            var testDate = new DateTime(2099, 1, 2, 12, 30, 0, DateTimeKind.Utc);
            await setup.Feedback.Where(f => phones.Contains(f.Phone)).ExecuteUpdateAsync(s => s.SetProperty(f => f.CreatedAtUtc, testDate));
            await using (var db = new StandDbContext(options))
            {
                var admin = new AdminFeedbackController(db);
                async Task<FeedbackListResultDto> List(int page, int size) =>
                    (FeedbackListResultDto)((OkObjectResult)await admin.List(page, size)).Value!;
                var firstPage = await List(1, 2);
                var secondPage = await List(2, 2);
                Check(firstPage.Items.Count == 2 && firstPage.TotalCount >= 3 && firstPage.Page == 1 && firstPage.PageSize == 2 &&
                    firstPage.Items[0].Id > firstPage.Items[1].Id &&
                    firstPage.Items.All(f => phones.Contains(f.Phone)) && secondPage.Items[0].Id == saved.Id,
                    "Admin feedback uses server pagination with newest-first ordering and stable ID ordering for tied dates");
                Check(firstPage.Items.All(a => secondPage.Items.All(b => a.Id != b.Id)), "Adjacent feedback pages do not repeat records");
                var original = secondPage.Items[0];
                Check(original.FirstName == saved.FirstName && original.LastName == saved.LastName && original.Phone == saved.Phone &&
                    original.Comment == saved.Comment && original.CreatedAtUtc.EndsWith('Z') && DateTimeOffset.Parse(original.CreatedAtUtc).UtcDateTime == testDate,
                    "Admin feedback includes the complete original identity, multiline comment and explicit UTC date after account deletion");
                var lowerBounds = await List(0, 0);
                var upperBounds = await List(int.MaxValue, int.MaxValue);
                Check(lowerBounds.Page == 1 && lowerBounds.PageSize == 1 && upperBounds.PageSize == 100 &&
                    upperBounds.Page == Math.Max(1, (int)Math.Ceiling(upperBounds.TotalCount / 100d)),
                    "Feedback pagination normalizes invalid values and caps the page size without integer overflow");
                var auth = (AuthorizeAttribute)Attribute.GetCustomAttribute(typeof(AdminFeedbackController), typeof(AuthorizeAttribute))!;
                Check(auth.AuthenticationSchemes == CookieAuthenticationDefaults.AuthenticationScheme,
                    "Reading feedback requires the admin authentication scheme rather than a public-user session");
                var endpoints = typeof(AdminFeedbackController).GetMethods().SelectMany(method => method.GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.Routing.HttpMethodAttribute), true))
                    .Cast<Microsoft.AspNetCore.Mvc.Routing.HttpMethodAttribute>().ToArray();
                Check(endpoints.Length == 1 && endpoints[0].HttpMethods.SequenceEqual(new[] { "GET" }),
                    "The admin feedback API exposes reading only, with no delete or update action");
            }
        }
        finally
        {
            await setup.Feedback.Where(f => phones.Contains(f.Phone)).ExecuteDeleteAsync();
            await setup.AuthorizedUsers.Where(u => ids.Contains(u.Id)).ExecuteDeleteAsync();
        }
    }
}
