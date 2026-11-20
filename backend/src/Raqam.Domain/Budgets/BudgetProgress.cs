namespace Raqam.Domain.Budgets;

/// <summary>
/// What has been spent against a budget (spec §3.5). Pure arithmetic with no database:
/// the caller decides which expenses count (D053) and passes their sum.
/// </summary>
/// <param name="Remaining">Amount minus spent; negative once the budget is exceeded.</param>
/// <param name="PercentUsed">Truncated, never rounded up, to 2 decimals, so it reads 80.00 or more only when the 80% threshold is really reached.</param>
public readonly record struct BudgetProgress(decimal Spent, decimal Remaining, decimal PercentUsed, BudgetStatus Status)
{
    /// <summary>The first alert: 80% of the budget used.</summary>
    public const decimal WarningPercent = 80m;

    /// <summary>The second alert: 100% of the budget used (or more).</summary>
    public const decimal LimitPercent = 100m;

    public static BudgetProgress Calculate(decimal amount, decimal spent)
    {
        if (amount <= 0)
            throw new ArgumentOutOfRangeException(nameof(amount), "A budget amount is always above zero.");

        // Compare exactly (no division), so the status never depends on rounding.
        var status = spent * 100m >= amount * LimitPercent ? BudgetStatus.LimitReached
            : spent * 100m >= amount * WarningPercent ? BudgetStatus.NearLimit
            : BudgetStatus.OnTrack;

        var percent = decimal.Round(spent * 100m / amount, 2, MidpointRounding.ToZero);

        return new BudgetProgress(spent, amount - spent, percent, status);
    }
}
