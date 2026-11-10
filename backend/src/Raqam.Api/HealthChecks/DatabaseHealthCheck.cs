using Microsoft.Extensions.Diagnostics.HealthChecks;
using Raqam.Infrastructure.Persistence;

namespace Raqam.Api.HealthChecks;

public class DatabaseHealthCheck(RaqamDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        return await db.Database.CanConnectAsync(cancellationToken)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("Cannot connect to the database.");
    }
}
