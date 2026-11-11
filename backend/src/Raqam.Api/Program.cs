using FluentValidation;
using Raqam.Api.ErrorHandling;
using Raqam.Api.HealthChecks;
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

builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database");

builder.Services.AddOpenApi();

var app = builder.Build();

// Converts unhandled exceptions to a ProblemDetails response (see GlobalExceptionHandler).
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

// Exposes the implicit top-level Program class to the test project so
// WebApplicationFactory<Program> can boot the app in-process.
public partial class Program;
