using Microsoft.AspNetCore.Mvc;
using Raqam.Application.Dashboard;

namespace Raqam.Api.Controllers;

[ApiController]
[Route("api/v1/dashboard")]
public class DashboardController(DashboardService dashboard) : ControllerBase
{
    /// <summary>Income, expense and net for a period and the one before it, plus expenses by category: <c>?from=&amp;to=</c>.</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryResponse>> Summary(
        [FromQuery] DashboardSummaryQuery query, CancellationToken cancellationToken) =>
        Ok(await dashboard.GetSummaryAsync(query, cancellationToken));

    /// <summary>Income and expense for each of the last N months for the comparison chart: <c>?months=6&amp;to=</c>.</summary>
    [HttpGet("monthly")]
    public async Task<ActionResult<IReadOnlyList<MonthlyTotalsResponse>>> Monthly(
        [FromQuery] MonthlyQuery query, CancellationToken cancellationToken) =>
        Ok(await dashboard.GetMonthlyAsync(query, cancellationToken));
}
