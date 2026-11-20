using Microsoft.EntityFrameworkCore;
using Raqam.Application.Budgets;
using Raqam.Domain.Budgets;

namespace Raqam.Infrastructure.Persistence.Repositories;

public class BudgetRepository(RaqamDbContext db) : IBudgetRepository
{
    public Task<Budget?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Budgets.FirstOrDefaultAsync(b => b.UserId == userId && b.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Budget>> ListAsync(
        Guid userId, int year, int month, CancellationToken cancellationToken) =>
        await db.Budgets
            .AsNoTracking()
            .Where(b => b.UserId == userId && b.Year == year && b.Month == month)
            .ToListAsync(cancellationToken);

    public Task<bool> ExistsAsync(
        Guid userId, int year, int month, Guid? categoryId, CancellationToken cancellationToken) =>
        db.Budgets.AnyAsync(
            b => b.UserId == userId && b.Year == year && b.Month == month && b.CategoryId == categoryId,
            cancellationToken);

    public void Add(Budget budget) => db.Budgets.Add(budget);

    public void Remove(Budget budget) => db.Budgets.Remove(budget);

    public void ExpectVersion(Budget budget, uint version) =>
        db.Entry(budget).Property(b => b.Version).OriginalValue = version;
}
