namespace Raqam.Domain.Budgets;

/// <summary>Where a budget stands against its two alert thresholds (spec §3.5: 80% and 100%).</summary>
public enum BudgetStatus
{
    OnTrack,
    NearLimit,
    LimitReached,
}
