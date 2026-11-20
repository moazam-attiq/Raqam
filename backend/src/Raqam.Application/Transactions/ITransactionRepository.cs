using Raqam.Domain.Transactions;

namespace Raqam.Application.Transactions;

/// <summary>
/// Persistence for transactions (D025). Every method takes the owner's id and only ever
/// sees that owner's rows (D026). The balance and totals queries aggregate in the
/// database; they never load rows into memory (spec §6.4, rule 15).
/// </summary>
public interface ITransactionRepository
{
    /// <summary>The owner's transaction, tracked for changes; null if missing or someone else's.</summary>
    Task<Transaction?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken);

    /// <summary>One filtered, sorted page (read-only) plus the total number of matches.</summary>
    Task<TransactionPage> SearchAsync(Guid userId, TransactionQuery query, CancellationToken cancellationToken);

    /// <summary>Everything that moved one account, optionally only up to and including a date.</summary>
    Task<AccountMovements> GetMovementsAsync(Guid userId, Guid accountId, DateOnly? asOf, CancellationToken cancellationToken);

    /// <summary>Income and expense totals, transfers excluded, optionally for one account and a date range.</summary>
    Task<IncomeExpenseTotals> GetTotalsAsync(
        Guid userId, DateOnly? from, DateOnly? to, Guid? accountId, CancellationToken cancellationToken);

    /// <summary>
    /// Expense totals per category for an inclusive date range (transfers and income excluded),
    /// aggregated in the database. Budgets and the dashboard's category breakdown build on it.
    /// </summary>
    Task<IReadOnlyList<CategoryTotal>> GetExpenseTotalsByCategoryAsync(
        Guid userId, DateOnly from, DateOnly to, CancellationToken cancellationToken);

    /// <summary>Income and expense per calendar month inside a date range (transfers excluded); months with no rows are absent.</summary>
    Task<IReadOnlyList<MonthlyTotal>> GetMonthlyTotalsAsync(
        Guid userId, DateOnly from, DateOnly to, CancellationToken cancellationToken);

    void Add(Transaction transaction);

    void Remove(Transaction transaction);

    /// <summary>Makes the next save fail with a conflict if the row changed since the client read it (D027).</summary>
    void ExpectVersion(Transaction transaction, uint version);
}

public sealed record TransactionPage(IReadOnlyList<Transaction> Items, int TotalCount);

/// <summary>Sums of what moved one account, split the way the balance formula needs (spec §6.4).</summary>
public sealed record AccountMovements(decimal Income, decimal Expense, decimal TransfersIn, decimal TransfersOut)
{
    public static AccountMovements None { get; } = new(0m, 0m, 0m, 0m);
}

public sealed record CategoryTotal(Guid CategoryId, decimal Total);

public sealed record IncomeExpenseTotals(decimal Income, decimal Expense, int TransactionCount)
{
    public static IncomeExpenseTotals None { get; } = new(0m, 0m, 0);
}

public sealed record MonthlyTotal(int Year, int Month, decimal Income, decimal Expense);
