using Raqam.Domain.Budgets;

namespace Raqam.Application.Budgets;

/// <summary>
/// Persistence for budgets (D025). Every method takes the owner's id and only ever sees that
/// owner's rows (D026), so a missing result means "not found for this user".
/// </summary>
public interface IBudgetRepository
{
    /// <summary>The owner's budget, tracked for changes; null if missing or someone else's.</summary>
    Task<Budget?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken);

    /// <summary>The owner's budgets for one month (read-only).</summary>
    Task<IReadOnlyList<Budget>> ListAsync(Guid userId, int year, int month, CancellationToken cancellationToken);

    /// <summary>Whether the owner already has a budget for this month and category (null category means the overall budget).</summary>
    Task<bool> ExistsAsync(Guid userId, int year, int month, Guid? categoryId, CancellationToken cancellationToken);

    void Add(Budget budget);

    /// <summary>A budget is a plan, not financial history, so it is really deleted.</summary>
    void Remove(Budget budget);

    /// <summary>Makes the next save fail with a conflict if the row changed since the client read it (D027).</summary>
    void ExpectVersion(Budget budget, uint version);
}
