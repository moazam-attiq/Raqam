namespace Raqam.Application.Dashboard;

/// <summary>
/// <c>?from=2026-11-01&amp;to=2026-11-30</c>, both required and inclusive. The previous period is the
/// same number of days immediately before <c>From</c> (D054).
/// </summary>
public sealed record DashboardSummaryQuery(DateOnly From = default, DateOnly To = default)
{
    public const int MaxDays = 3660;
    public static readonly DateOnly MinDate = new(2000, 1, 1);
}

/// <summary>
/// <c>?months=6&amp;to=2026-11-20</c>: the calendar months ending with the month of <c>To</c>
/// (the person's own today; the server's UTC today when omitted), oldest first.
/// </summary>
public sealed record MonthlyQuery(int Months = MonthlyQuery.DefaultMonths, DateOnly? To = null)
{
    public const int DefaultMonths = 6;
    public const int MaxMonths = 24;
}

/// <summary>Income and expense for a date range. Transfers are never counted (business rule 3).</summary>
public sealed record PeriodTotalsResponse(
    DateOnly From, DateOnly To, decimal Income, decimal Expense, decimal Net, int TransactionCount);

/// <summary>What one top-level category took from the period's expenses, subcategories included.</summary>
public sealed record CategorySpendingResponse(Guid CategoryId, string Name, decimal Amount, decimal PercentOfExpense);

public sealed record DashboardSummaryResponse(
    PeriodTotalsResponse Current,
    PeriodTotalsResponse Previous,
    IReadOnlyList<CategorySpendingResponse> ExpenseByCategory);

public sealed record MonthlyTotalsResponse(int Year, int Month, decimal Income, decimal Expense, decimal Net);
