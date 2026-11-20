using Raqam.Application.Categories;
using Raqam.Application.Common;
using Raqam.Application.Transactions;

namespace Raqam.Application.Dashboard;

/// <summary>
/// Read-only dashboard figures (D054). Everything is aggregated in the database from the ledger
/// and nothing is stored, so the numbers always agree with the transaction list for the same
/// filters. Only income and expense transactions count; transfers never do (rule 3).
/// </summary>
public class DashboardService(
    ITransactionRepository transactions,
    ICategoryRepository categories,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    public async Task<DashboardSummaryResponse> GetSummaryAsync(
        DashboardSummaryQuery query, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        var (previousFrom, previousTo) = PreviousPeriod(query.From, query.To);

        var current = await TotalsAsync(query.From, query.To, cancellationToken);
        var previous = await TotalsAsync(previousFrom, previousTo, cancellationToken);

        var expenses = await transactions.GetExpenseTotalsByCategoryAsync(userId, query.From, query.To, cancellationToken);
        var allCategories = await categories.ListAsync(userId, true, null, cancellationToken);

        return new DashboardSummaryResponse(current, previous, RollUp(expenses, allCategories, current.Expense));
    }

    /// <summary>The same number of days immediately before the period: 1–30 Nov is compared with 2–31 Oct.</summary>
    public static (DateOnly From, DateOnly To) PreviousPeriod(DateOnly from, DateOnly to)
    {
        var days = to.DayNumber - from.DayNumber + 1;
        var previousTo = from.AddDays(-1);
        return (previousTo.AddDays(-(days - 1)), previousTo);
    }

    /// <summary>Every month in the window, oldest first, with zeros for months that had no transactions.</summary>
    public async Task<IReadOnlyList<MonthlyTotalsResponse>> GetMonthlyAsync(
        MonthlyQuery query, CancellationToken cancellationToken)
    {
        var last = query.To ?? DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var lastMonth = new DateOnly(last.Year, last.Month, 1);
        var firstMonth = lastMonth.AddMonths(-(query.Months - 1));

        var rows = await transactions.GetMonthlyTotalsAsync(
            currentUser.UserId, firstMonth, lastMonth.AddMonths(1).AddDays(-1), cancellationToken);
        var byMonth = rows.ToDictionary(r => (r.Year, r.Month));

        var result = new List<MonthlyTotalsResponse>(query.Months);
        for (var month = firstMonth; month <= lastMonth; month = month.AddMonths(1))
        {
            var (income, expense) = byMonth.TryGetValue((month.Year, month.Month), out var row)
                ? (row.Income, row.Expense)
                : (0m, 0m);
            result.Add(new MonthlyTotalsResponse(month.Year, month.Month, income, expense, income - expense));
        }

        return result;
    }

    private async Task<PeriodTotalsResponse> TotalsAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var totals = await transactions.GetTotalsAsync(currentUser.UserId, from, to, null, cancellationToken);
        return new PeriodTotalsResponse(
            from, to, totals.Income, totals.Expense, totals.Income - totals.Expense, totals.TransactionCount);
    }

    /// <summary>
    /// Groups expense totals by top-level category (a subcategory counts toward its parent), largest
    /// first. Archived categories are included: the money was spent. Percent is truncated to 2 decimals.
    /// </summary>
    private static IReadOnlyList<CategorySpendingResponse> RollUp(
        IReadOnlyList<CategoryTotal> totals, IReadOnlyList<Raqam.Domain.Categories.Category> allCategories, decimal expense)
    {
        var byId = allCategories.ToDictionary(c => c.Id);

        return totals
            .GroupBy(t => byId.TryGetValue(t.CategoryId, out var c) ? c.ParentCategoryId ?? c.Id : t.CategoryId)
            .Select(g => new
            {
                Id = g.Key,
                Name = byId.TryGetValue(g.Key, out var top) ? top.Name : "Other",
                Amount = g.Sum(t => t.Total),
            })
            .OrderByDescending(x => x.Amount)
            .ThenBy(x => x.Name, StringComparer.CurrentCultureIgnoreCase)
            .Select(x => new CategorySpendingResponse(
                x.Id,
                x.Name,
                x.Amount,
                expense == 0m ? 0m : decimal.Round(x.Amount * 100m / expense, 2, MidpointRounding.ToZero)))
            .ToList();
    }
}
