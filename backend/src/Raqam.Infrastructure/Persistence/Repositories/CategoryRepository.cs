using Microsoft.EntityFrameworkCore;
using Raqam.Application.Categories;
using Raqam.Domain.Categories;

namespace Raqam.Infrastructure.Persistence.Repositories;

public class CategoryRepository(RaqamDbContext db) : ICategoryRepository
{
    public Task<Category?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Categories.FirstOrDefaultAsync(c => c.UserId == userId && c.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Category>> ListAsync(
        Guid userId, bool includeArchived, CategoryType? type, CancellationToken cancellationToken) =>
        await db.Categories
            .AsNoTracking()
            .Where(c => c.UserId == userId
                && (includeArchived || !c.IsArchived)
                && (type == null || c.Type == type))
            .OrderBy(c => c.Type)
            .ThenBy(c => c.Name)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Category>> ListChildrenAsync(
        Guid userId, Guid parentId, CancellationToken cancellationToken) =>
        await db.Categories
            .Where(c => c.UserId == userId && c.ParentCategoryId == parentId)
            .ToListAsync(cancellationToken);

    public Task<bool> NameTakenAsync(
        Guid userId, Guid? parentId, CategoryType type, string name, Guid? exceptId,
        CancellationToken cancellationToken) =>
        db.Categories.AnyAsync(
            c => c.UserId == userId
                && c.ParentCategoryId == parentId
                && c.Type == type
                && c.Name == name
                && (exceptId == null || c.Id != exceptId),
            cancellationToken);

    public void Add(Category category) => db.Categories.Add(category);

    public void ExpectVersion(Category category, uint version) =>
        db.Entry(category).Property(c => c.Version).OriginalValue = version;
}
