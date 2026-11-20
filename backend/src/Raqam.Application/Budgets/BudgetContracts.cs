using Raqam.Domain.Budgets;

namespace Raqam.Application.Budgets;

// No UserId in any request: the owner always comes from ICurrentUser (business rule 5).
// Month, year and category cannot be changed after creation; only the amount can.

/// <param name="CategoryId">An expense category, or null for the overall budget.</param>
public sealed record CreateBudgetRequest(int Year, int Month, decimal Amount, Guid? CategoryId);

/// <param name="Version">The <see cref="BudgetResponse.Version"/> the client last saw; a stale one is rejected with 409.</param>
public sealed record UpdateBudgetRequest(decimal Amount, uint Version);

/// <summary>The month whose budgets are listed.</summary>
public sealed record BudgetQuery(int Year, int Month);

/// <summary>A budget together with how much of it is used (spec §3.5). <see cref="Remaining"/> goes negative once exceeded.</summary>
public sealed record BudgetResponse(
    Guid Id,
    int Year,
    int Month,
    Guid? CategoryId,
    decimal Amount,
    decimal Spent,
    decimal Remaining,
    decimal PercentUsed,
    BudgetStatus Status,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    uint Version);

public static class BudgetMappings
{
    public static BudgetResponse ToResponse(this Budget budget, decimal spent)
    {
        var progress = BudgetProgress.Calculate(budget.Amount, spent);
        return new BudgetResponse(
            budget.Id,
            budget.Year,
            budget.Month,
            budget.CategoryId,
            budget.Amount,
            progress.Spent,
            progress.Remaining,
            progress.PercentUsed,
            progress.Status,
            budget.CreatedAtUtc,
            budget.UpdatedAtUtc,
            budget.Version);
    }
}
