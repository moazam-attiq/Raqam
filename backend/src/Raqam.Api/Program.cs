using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Raqam.Api.ErrorHandling;
using Raqam.Api.HealthChecks;
using Raqam.Api.Services;
using Raqam.Api.Startup;
using Raqam.Api.Validation;
using Raqam.Application.Common;
using Raqam.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Structured console logging: single-line with timestamps while developing (readable in a
// terminal), JSON lines once hosted (easy for Render/any log collector to parse). No extra
// package needed — both formatters ship with the ASP.NET Core SDK.
builder.Logging.ClearProviders();
if (builder.Environment.IsDevelopment())
{
    builder.Logging.AddSimpleConsole(options =>
    {
        options.SingleLine = true;
        options.TimestampFormat = "HH:mm:ss ";
    });
}
else
{
    builder.Logging.AddJsonConsole();
}

builder.Services
    .AddControllers(options =>
    {
        options.Filters.Add<ValidationFilter>();

        // The cookie-based session (D016) needs SameSite=None to work cross-site with the
        // Vercel frontend, which rules out SameSite as a CSRF defense on its own — every
        // unsafe-verb action needs a validated antiforgery token unless it opts out
        // explicitly with [SkipCsrfValidation] (D018). A project-written filter, not the
        // built-in AutoValidateAntiforgeryTokenAttribute — that one needs MVC's view-engine
        // DI registrations (AddControllersWithViews), which this API-only project doesn't
        // have, and throws at request time without them. See CsrfFilter for details.
        options.Filters.Add<CsrfFilter>();
    });

// Scans this assembly for FluentValidation validators. There are none yet (no DTOs exist
// before Phase 3), but the wiring is ready for when controllers gain request models.
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Everything requires authentication unless explicitly marked [AllowAnonymous] or
// .AllowAnonymous() (business rule 4: every financial endpoint is owner-scoped, and an
// owner can only be established once someone is signed in).
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());

// Frontend (Vercel) and API (Render) are expected to be on different domains, and the
// cookie-based auth (D016) needs the browser to send credentials cross-site.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Resolves the authenticated owner for the current request (business rules 4 and 5).
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

// Double-submit CSRF token: the frontend reads the token cookie, sends it back in the
// X-CSRF-TOKEN header on unsafe requests, and CsrfFilter above checks the two match
// (D018). Same SameSite/Secure settings as the auth cookie (D016), since both cross the
// same cross-site boundary.
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "XSRF-TOKEN";
    options.Cookie.SameSite = SameSiteMode.None;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
});

// Slows down brute-force login attempts (spec §8.1), on top of Identity's per-account
// lockout (AddInfrastructure) which only kicks in after a known account is targeted —
// this also covers guessing against emails that don't exist. Keyed by IP rather than
// email so an attacker can't dodge it by cycling through addresses.
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
});

builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database");

builder.Services.AddOpenApi();

var app = builder.Build();

// Converts unhandled exceptions to a ProblemDetails response (see GlobalExceptionHandler).
app.UseExceptionHandler();

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

app.MapControllers();

// The fallback policy above would otherwise require a login just to check whether the
// API itself is up — exempt health reporting.
app.MapHealthChecks("/health").AllowAnonymous();

using (var scope = app.Services.CreateScope())
{
    await DatabaseSeeder.SeedAsync(scope.ServiceProvider, app.Logger);
}

app.Run();

// Exposes the implicit top-level Program class to the test project so
// WebApplicationFactory<Program> can boot the app in-process.
public partial class Program;
