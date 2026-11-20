using Microsoft.AspNetCore.Mvc;
using Raqam.Application.Budgets;

namespace Raqam.Api.Controllers;

[ApiController]
[Route("api/v1/budgets")]
public class BudgetsController(BudgetService budgets) : ControllerBase
{
    /// <summary>One month's budgets with what has been spent against each: <c>?year=2026&amp;month=11</c>.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BudgetResponse>>> List(
        [FromQuery] BudgetQuery query, CancellationToken cancellationToken) =>
        Ok(await budgets.ListAsync(query, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<BudgetResponse>> Create(
        CreateBudgetRequest request, CancellationToken cancellationToken)
    {
        var budget = await budgets.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = budget.Id }, budget);
    }

    /// <summary>The budget and its progress; this is also the spec's <c>/budgets/{id}/progress</c> (D053).</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BudgetResponse>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await budgets.GetAsync(id, cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<BudgetResponse>> Update(
        Guid id, UpdateBudgetRequest request, CancellationToken cancellationToken) =>
        Ok(await budgets.UpdateAsync(id, request, cancellationToken));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await budgets.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
