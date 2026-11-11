using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Raqam.Api.ErrorHandling;
using Raqam.Api.HealthChecks;
using Raqam.Api.Startup;
using Raqam.Api.Validation;
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
    .AddControllers(options => options.Filters.Add<ValidationFilter>());

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
