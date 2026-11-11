using Raqam.Domain.Categories;

namespace Raqam.Application.Categories;

/// <summary>
/// Persistence for categories (D025). Every method takes the owner's id and only ever sees
/// that owner's rows (D026), so a missing result means "not found for this user".
/// </summary>
public interface ICategoryRepository
{
    /// <summary>The owner's category, tracked for changes; null if missing or someone else's.</summary>
    Task<Category?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken);

    /// <summary>Flat list, parents and subcategories together; clients build the tree from <c>ParentCategoryId</c>.</summary>
    Task<IReadOnlyList<Category>> ListAsync(
        Guid userId, bool includeArchived, CategoryType? type, CancellationToken cancellationToken);

    /// <summary>The direct subcategories of a category, tracked so they can be archived with it (D028).</summary>
    Task<IReadOnlyList<Category>> ListChildrenAsync(Guid userId, Guid parentId, CancellationToken cancellationToken);

    /// <summary>Exact-name check against the unique (owner, parent, type, name) index, optionally ignoring one category.</summary>
    Task<bool> NameTakenAsync(
        Guid userId, Guid? parentId, CategoryType type, string name, Guid? exceptId,
        CancellationToken cancellationToken);

    void Add(Category category);

    /// <summary>Makes the next save fail with a conflict if the row changed since the client read it (D027).</summary>
    void ExpectVersion(Category category, uint version);
}
