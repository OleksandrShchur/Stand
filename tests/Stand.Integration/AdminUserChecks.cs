using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Controllers.Admin;
using Stand.Server.Data;
using Stand.Server.Dtos.Admin;
using Stand.Server.Services;

internal static class AdminUserChecks
{
    public static async Task Run(string connection)
    {
        await using var db = new StandDbContext(new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(connection).Options);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var service = new AdminAuthService(db);
        const string original = "Before-test-password-123";
        const string replacement = "After-test-password-456";
        var self = await service.CreateAsync("self-" + Guid.NewGuid().ToString("N"), original, default);
        var other = await service.CreateAsync("other-" + Guid.NewGuid().ToString("N"), original, default);
        var controller = new AdminUsersController(service)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, self.Id.ToString())], "Test")),
            } },
        };
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
            Console.WriteLine("PASS " + message);
        }
        async Task Reject(Func<Task> action, string message)
        {
            try { await action(); throw new Exception("Invalid admin operation was accepted"); }
            catch (ValidationAppException) { Console.WriteLine("PASS " + message); }
        }
        await Reject(() => controller.ChangePassword(self.Id, new("short", "short"), default), "Server rejects passwords below eight characters");
        await Reject(() => controller.ChangePassword(self.Id, new(replacement, original), default), "Server rejects mismatched password confirmation");
        Check(await service.ValidateCredentialsAsync(self.Login, original, default) is not null, "Invalid password changes preserve the existing credentials");
        await controller.ChangePassword(self.Id, new ChangeAdminPasswordDto(replacement, replacement), default);
        Check(await service.ValidateCredentialsAsync(self.Login, original, default) is null
            && await service.ValidateCredentialsAsync(self.Login, replacement, default) is not null
            && self.PasswordHash != replacement, "An administrator can change their own password; old credentials fail and the replacement is hashed");
        await controller.ChangePassword(other.Id, new ChangeAdminPasswordDto(replacement, replacement), default);
        Check(await service.ValidateCredentialsAsync(other.Login, original, default) is null
            && await service.ValidateCredentialsAsync(other.Login, replacement, default) is not null, "An administrator can change another administrator's password");
        await Reject(() => controller.Delete(self.Id, default), "Server refuses self-deletion even when called directly");
        Check(await db.AdminUsers.AnyAsync(user => user.Id == self.Id), "Self-deletion leaves the account intact");
        await controller.Delete(other.Id, default);
        Check(!await db.AdminUsers.AnyAsync(user => user.Id == other.Id)
            && await db.AdminUsers.AnyAsync(user => user.Id == self.Id)
            && await service.ValidateCredentialsAsync(other.Login, replacement, default) is null, "Deletion removes only the selected administrator and prevents future logins");
        try
        {
            await controller.ChangePassword(other.Id, new(replacement, replacement), default);
            throw new Exception("Missing administrator was accepted");
        }
        catch (NotFoundAppException) { Console.WriteLine("PASS Password changes for a deleted administrator return not found"); }
        await transaction.RollbackAsync();
    }
}
