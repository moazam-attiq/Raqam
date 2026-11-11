using Raqam.Application.Common;
using Raqam.Domain.Categories;

namespace Raqam.Application.Categories;

/// <summary>
/// Category use cases. The owner is always <see cref="ICurrentUser"/>, never a request
/// field (business rules 4 and 5); a category that is not the owner's is "not found" (D026).
/// </summary>
public class CategoryService(
    ICategoryRepository categories,
    IUnitOfWork unitOfWork,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<CategoryResponse>> ListAsync(
        bool includeArchived, CategoryType? type, CancellationToken cancellationToken)
    {
        var list = await categories.ListAsync(currentUser.UserId, includeArchived, type, cancellationToken);
        return list.Select(c => c.ToResponse()).ToList();
    }

    public async Task<CategoryResponse> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await FindOrThrowAsync(id, "Category was not found.", cancellationToken);
        return category.ToResponse();
    }

    public async Task<CategoryResponse> CreateAsync(CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        var type = request.Type!.Value;
        var name = request.Name.Trim();

        Category? parent = null;
        if (request.ParentCategoryId is { } parentId)
        {
            parent = await FindOrThrowAsync(parentId, "Parent category was not found.", cancellationToken);
        }

        await EnsureNameFreeAsync(parent?.Id, type, name, null, cancellationToken);

        var category = Category.Create(
            currentUser.UserId, name, type, parent, request.Colour, request.Icon, Now());

        categories.Add(category);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return category.ToResponse();
    }

    public async Task<CategoryResponse> UpdateAsync(Guid id, UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await FindOrThrowAsync(id, "Category was not found.", cancellationToken);

        var name = request.Name.Trim();
        await EnsureNameFreeAsync(category.ParentCategoryId, category.Type, name, category.Id, cancellationToken);

        categories.ExpectVersion(category, request.Version);
        category.Update(name, request.Colour, request.Icon, Now());

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return category.ToResponse();
    }

    /// <summary>
    /// History is kept; the category stops accepting new transactions (D024). Archiving a
    /// category also archives its subcategories in the same save (D028). Safe to repeat.
    /// </summary>
    public async Task<CategoryResponse> ArchiveAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await FindOrThrowAsync(id, "Category was not found.", cancellationToken);
        var children = await categories.ListChildrenAsync(currentUser.UserId, category.Id, cancellationToken);

        var now = Now();
        category.Archive(now);
        foreach (var child in children)
        {
            child.Archive(now);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return category.ToResponse();
    }

    private async Task<Category> FindOrThrowAsync(Guid id, string notFoundMessage, CancellationToken cancellationToken)
    {
        return await categories.FindAsync(currentUser.UserId, id, cancellationToken)
            ?? throw new NotFoundException(notFoundMessage);
    }

    private async Task EnsureNameFreeAsync(
        Guid? parentId, CategoryType type, string name, Guid? exceptId, CancellationToken cancellationToken)
    {
        if (await categories.NameTakenAsync(currentUser.UserId, parentId, type, name, exceptId, cancellationToken))
        {
            throw new ConflictException($"You already have a {type.ToString().ToLowerInvariant()} category named '{name}' here.");
        }
    }

    private DateTime Now() => clock.GetUtcNow().UtcDateTime;
}
