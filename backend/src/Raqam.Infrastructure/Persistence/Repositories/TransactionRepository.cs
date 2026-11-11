using Microsoft.EntityFrameworkCore;
using Raqam.Application.Transactions;
using Raqam.Domain.Transactions;

namespace Raqam.Infrastructure.Persistence.Repositories;

public class TransactionRepository(RaqamDbContext db) : ITransactionRepository
{
    public Task<Transaction?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Transactions.FirstOrDefaultAsync(t => t.UserId == userId && t.Id == id, cancellationToken);

    public async Task<TransactionPage> SearchAsync(
        Guid userId, TransactionQuery filter, CancellationToken cancellationToken)
    {
        var query = db.Transactions.AsNoTracking().Where(t => t.UserId == userId);

        if (filter.From is { } from)
            query = query.Where(t => t.TransactionDate >= from);

        if (filter.To is { } to)
            query = query.Where(t => t.TransactionDate <= to);

        if (filter.Type is { } type)
            query = query.Where(t => t.Type == type);

        // Either side of a transfer counts, so an account's history shows money in and out.
        if (filter.AccountId is { } accountId)
            query = query.Where(t => t.SourceAccountId == accountId || t.DestinationAccountId == accountId);

        // A top-level category also matches its subcategories (D036).
        if (filter.CategoryId is { } categoryId)
        {
            var childIds = db.Categories
                .Where(c => c.UserId == userId && c.ParentCategoryId == categoryId)
                .Select(c => c.Id);

            query = query.Where(t =>
                t.CategoryId == categoryId ||
                (t.CategoryId != null && childIds.Contains(t.CategoryId.Value)));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            // The escape character is stated explicitly (ESCAPE '\') rather than relying on
            // PostgreSQL's default, so the escaping in EscapeLike is guaranteed to apply.
            var pattern = $"%{EscapeLike(filter.Search.Trim())}%";
            query = query.Where(t =>
                EF.Functions.ILike(t.Description, pattern, "\\") ||
                (t.Merchant != null && EF.Functions.ILike(t.Merchant, pattern, "\\")));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        // The final Id tie-break keeps paging stable when sort keys are equal.
        var ordered = filter.Sort switch
        {
            TransactionSort.DateAsc => query.OrderBy(t => t.TransactionDate).ThenBy(t => t.CreatedAtUtc),
            TransactionSort.AmountDesc => query.OrderByDescending(t => t.Amount).ThenByDescending(t => t.TransactionDate),
            TransactionSort.AmountAsc => query.OrderBy(t => t.Amount).ThenByDescending(t => t.TransactionDate),
            _ => query.OrderByDescending(t => t.TransactionDate).ThenByDescending(t => t.CreatedAtUtc),
        };

        var items = await ordered
            .ThenBy(t => t.Id)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(cancellationToken);

        return new TransactionPage(items, totalCount);
    }

    public async Task<AccountMovements> GetMovementsAsync(
        Guid userId, Guid accountId, DateOnly? asOf, CancellationToken cancellationToken)
    {
        var query = db.Transactions
            .AsNoTracking()
            .Where(t => t.UserId == userId && (t.SourceAccountId == accountId || t.DestinationAccountId == accountId));

        if (asOf is { } date)
            query = query.Where(t => t.TransactionDate <= date);

        // One aggregate query. These four sums are the SQL form of Transaction.SignedEffectOn.
        var movements = await query
            .GroupBy(t => t.UserId)
            .Select(g => new AccountMovements(
                g.Sum(t => t.Type == TransactionType.Income && t.SourceAccountId == accountId ? t.Amount : 0m),
                g.Sum(t => t.Type == TransactionType.Expense && t.SourceAccountId == accountId ? t.Amount : 0m),
                g.Sum(t => t.Type == TransactionType.Transfer && t.DestinationAccountId == accountId ? t.Amount : 0m),
                g.Sum(t => t.Type == TransactionType.Transfer && t.SourceAccountId == accountId ? t.Amount : 0m)))
            .SingleOrDefaultAsync(cancellationToken);

        return movements ?? AccountMovements.None;
    }

    public async Task<IncomeExpenseTotals> GetTotalsAsync(
        Guid userId, DateOnly? from, DateOnly? to, Guid? accountId, CancellationToken cancellationToken)
    {
        // Transfers are neither income nor expense, so they are left out here (rule 3).
        var query = db.Transactions
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.Type != TransactionType.Transfer);

        if (from is { } fromDate)
            query = query.Where(t => t.TransactionDate >= fromDate);

        if (to is { } toDate)
            query = query.Where(t => t.TransactionDate <= toDate);

        // Income and expense have only a source account.
        if (accountId is { } id)
            query = query.Where(t => t.SourceAccountId == id);

        var totals = await query
            .GroupBy(t => t.UserId)
            .Select(g => new IncomeExpenseTotals(
                g.Sum(t => t.Type == TransactionType.Income ? t.Amount : 0m),
                g.Sum(t => t.Type == TransactionType.Expense ? t.Amount : 0m),
                g.Count()))
            .SingleOrDefaultAsync(cancellationToken);

        return totals ?? IncomeExpenseTotals.None;
    }

    public void Add(Transaction transaction) => db.Transactions.Add(transaction);

    public void Remove(Transaction transaction) => db.Transactions.Remove(transaction);

    public void ExpectVersion(Transaction transaction, uint version) =>
        db.Entry(transaction).Property(t => t.Version).OriginalValue = version;

    /// <summary>Escapes LIKE wildcards so a search for "50%" matches the text, not everything.</summary>
    private static string EscapeLike(string text) =>
        text.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
