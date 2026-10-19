using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Auth;
using Stand.Server.Common;
using Stand.Server.Data;
using Stand.Server.Options;
using Stand.Server.Services;

var builder = WebApplication.CreateBuilder(args);

// ---- Options ----
builder.Services.Configure<BookingOptions>(builder.Configuration.GetSection(BookingOptions.SectionName));
builder.Services.Configure<AdminAuthOptions>(builder.Configuration.GetSection(AdminAuthOptions.SectionName));

// ---- Data ----
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Missing ConnectionStrings:Default configuration.");
builder.Services.AddDbContext<StandDbContext>(options => options.UseSqlServer(connectionString));

// ---- Domain services ----
builder.Services.AddSingleton<IKyivClock, KyivClock>();
builder.Services.AddScoped<IAvailabilityService, AvailabilityService>();
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddScoped<IAdminAuthService, AdminAuthService>();
builder.Services.AddScoped<IPublicUserAuthService, PublicUserAuthService>();
builder.Services.AddScoped<CurrentPublicUser>();
builder.Services.AddScoped<FeedbackService>();

// ---- MVC / API ----
builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// ---- OpenAPI / Swagger (Development only) ----
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.OpenApiInfo
    {
        Title = "Стенд API",
        Version = "v1",
        Description = "Public booking + admin API for volunteer duty sign-up.",
    });
});

// ---- Cookie authentication for /api/admin/** ----
var adminAuthSection = builder.Configuration.GetSection(AdminAuthOptions.SectionName).Get<AdminAuthOptions>()
    ?? new AdminAuthOptions();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
    {
        options.Cookie.Name = "stand_admin";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(adminAuthSection.SlidingExpirationHours);
        options.SlidingExpiration = true;

        // JSON API, not a browser login redirect flow: return status codes instead of redirects.
        options.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };

        // Enforce an absolute session cap on top of the sliding expiration.
        var absoluteLifetime = TimeSpan.FromDays(adminAuthSection.AbsoluteExpirationDays);
        options.Events.OnValidatePrincipal = async ctx =>
        {
            var idRaw = ctx.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var db = ctx.HttpContext.RequestServices.GetRequiredService<StandDbContext>();
            if (!int.TryParse(idRaw, out var adminId) ||
                !await db.AdminUsers.AnyAsync(user => user.Id == adminId && user.IsActive, ctx.HttpContext.RequestAborted))
            {
                ctx.RejectPrincipal();
                await ctx.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return;
            }
            var issuedAtRaw = ctx.Principal?.FindFirst(AdminClaimTypes.IssuedAtUtcTicks)?.Value;
            if (issuedAtRaw is not null && long.TryParse(issuedAtRaw, out var ticks))
            {
                var issuedAt = new DateTime(ticks, DateTimeKind.Utc);
                if (DateTime.UtcNow - issuedAt > absoluteLifetime)
                {
                    ctx.RejectPrincipal();
                    await ctx.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                }
            }
        };
    })
    .AddCookie(PublicAuthConstants.AuthenticationScheme, options =>
    {
        options.Cookie.Name = "stand_user";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(12);
        options.SlidingExpiration = true;

        options.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };

        options.Events.OnValidatePrincipal = async ctx =>
        {
            var idRaw = ctx.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(idRaw, out var id))
            {
                ctx.RejectPrincipal();
                await ctx.HttpContext.SignOutAsync(PublicAuthConstants.AuthenticationScheme);
                return;
            }

            var currentUser = ctx.HttpContext.RequestServices.GetRequiredService<CurrentPublicUser>();
            if (await currentUser.GetAsync(id, ctx.HttpContext.RequestAborted) is null)
            {
                ctx.RejectPrincipal();
                await ctx.HttpContext.SignOutAsync(PublicAuthConstants.AuthenticationScheme);
            }
        };
    });

builder.Services.AddAuthorization();

// ---- Basic login rate limiting ----
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
    options.AddPolicy("phone-login", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(5),
            QueueLimit = 0,
        }));
});

var app = builder.Build();

app.UseExceptionHandler();

app.UseDefaultFiles();
app.MapStaticAssets();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Стенди API v1"));
}

app.UseHttpsRedirection();

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
