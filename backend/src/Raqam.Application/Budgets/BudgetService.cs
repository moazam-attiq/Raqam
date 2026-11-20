using System.Globalization;
using Raqam.Application.Categories;
using Raqam.Application.Common;
using Raqam.Application.Transactions;
using Raqam.Domain.Budgets;
using Raqam.Domain.Categories;

namespace Raqam.Application.Budgets;

/// <summary>
/// Budget use cases. The owner is always <see cref="ICurrentUser"/>; a budget or category that
/// is not the owner's is "not found" (D026). What counts as spending is decided in one place,
/// <see cref="SpentAsync"/> (D053).
/// </summary>
public class BudgetService(
    IBudgetRepository budgets,
    ICategoryRepository categories,
    ITransactionRepository transactions,
    IUnitOfWork unitOfWork,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    /// <summary>One month's budgets, the overall budget first and then by category name.</summary>
    public async Task<IReadOnlyList<BudgetResponse>> ListAsync(BudgetQuery query, CancellationToken cancellationToken)
    {
        var list = await budgets.ListAsync(currentUser.UserId, query.Year, query.Month, cancellationToken);
        if (list.Count == 0)
        {
            return [];
        }

        var allCategories = await categories.ListAsync(currentUser.UserId, true, null, cancellationToken);
        var spent = await SpentAsync(list, query.Year, query.Month, allCategories, cancellationToken);
        var names = allCategories.ToDictionary(c => c.Id, c => c.Name);

        return list
            .OrderBy(b => b.CategoryId is null ? 0 : 1)
            .ThenBy(b => b.CategoryId is { } id ? names.GetValueOrDefault(id, "") : "", StringComparer.CurrentCultureIgnoreCase)
            .Select(b => b.ToResponse(spent[b.Id]))
            .ToList();
    }

    public async Task<BudgetResponse> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var budget = await FindOrThrowAsync(id, cancellationToken);
        return await RespondAsync(budget, cancellationToken);
    }

    public async Task<BudgetResponse> CreateAsync(CreateBudgetRequest request, CancellationToken cancellationToken)
    {
        Category? category = null;
        if (request.CategoryId is { } categoryId)
        {
            category = await categories.FindAsync(currentUser.UserId, categoryId, cancellationToken)
                ?? throw new NotFoundException("Category was not found.");
        }

        var budget = Budget.Create(currentUser.UserId, request.Year, request.Month, request.Amount, category, Now());

        if (await budgets.ExistsAsync(currentUser.UserId, request.Year, request.Month, budget.CategoryId, cancellationToken))
        {
            var month = new DateTime(request.Year, request.Month, 1).ToString("MMMM yyyy", CultureInfo.InvariantCulture);
            throw new ConflictException(category is null
                ? $"You already have an overall budget for {month}."
                : $"You already have a budget for {category.Name} in {month}.");
        }

        budgets.Add(budget);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return await RespondAsync(budget, cancellationToken);
    }

    public async Task<BudgetResponse> UpdateAsync(Guid id, UpdateBudgetRequest request, CancellationToken cancellationToken)
    {
        var budget = await FindOrThrowAsync(id, cancellationToken);

        budgets.ExpectVersion(budget, request.Version);
        budget.Update(request.Amount, Now());

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return await RespondAsync(budget, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var budget = await FindOrThrowAsync(id, cancellationToken);

        budgets.Remove(budget);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<Budget> FindOrThrowAsync(Guid id, CancellationToken cancellationToken) =>
        await budgets.FindAsync(currentUser.UserId, id, cancellationToken)
            ?? throw new NotFoundException("Budget was not found.");

    private async Task<BudgetResponse> RespondAsync(Budget budget, CancellationToken cancellationToken)
    {
        var allCategories = await categories.ListAsync(currentUser.UserId, true, null, cancellationToken);
        var spent = await SpentAsync([budget], budget.Year, budget.Month, allCategories, cancellationToken);
        return budget.ToResponse(spent[budget.Id]);
    }

    /// <summary>
    /// What each budget has used in its month (D053). Only expenses count, so transfers (and,
    /// later, debts and savings, which are not expenses) never inflate spending. An overall
    /// budget counts every expense; a category budget counts that category's expenses and
    /// those of its subcategories. A subcategory budget counts only itself. Archived
    /// categories and accounts still count: the money was spent.
    /// </summary>
    private async Task<Dictionary<Guid, decimal>> SpentAsync(
        IReadOnlyList<Budget> list, int year, int month, IReadOnlyList<Category> allCategories,
        CancellationToken cancellationToken)
    {
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);
        var totals = await transactions.GetExpenseTotalsByCategoryAsync(currentUser.UserId, from, to, cancellationToken);

        var result = new Dictionary<Guid, decimal>();
        foreach (var budget in list)
        {
            result[budget.Id] = budget.CategoryId is not { } categoryId
                ? totals.Sum(t => t.Total)
                : totals
                    .Where(t => t.CategoryId == categoryId
                        || allCategories.Any(c => c.Id == t.CategoryId && c.ParentCategoryId == categoryId))
                    .Sum(t => t.Total);
        }

        return result;
    }

    private DateTime Now() => clock.GetUtcNow().UtcDateTime;
}
