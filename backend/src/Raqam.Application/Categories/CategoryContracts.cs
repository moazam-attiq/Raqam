using Raqam.Domain.Categories;

namespace Raqam.Application.Categories;

// No UserId in any request: the owner always comes from ICurrentUser (business rule 5).
// The type is nullable only so that "left out" is caught as an error instead of silently
// becoming the first enum value. Type and parent cannot be changed after creation.

/// <param name="ParentCategoryId">Set to create a subcategory of that (top-level) category.</param>
public sealed record CreateCategoryRequest(
    string Name,
    CategoryType? Type,
    Guid? ParentCategoryId,
    string? Colour,
    string? Icon);

/// <param name="Version">The <see cref="CategoryResponse.Version"/> the client last saw; a stale one is rejected with 409.</param>
public sealed record UpdateCategoryRequest(
    string Name,
    string? Colour,
    string? Icon,
    uint Version);

public sealed record CategoryResponse(
    Guid Id,
    string Name,
    CategoryType Type,
    Guid? ParentCategoryId,
    string? Colour,
    string? Icon,
    bool IsArchived,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    uint Version);

public static class CategoryMappings
{
    public static CategoryResponse ToResponse(this Category category) => new(
        category.Id,
        category.Name,
        category.Type,
        category.ParentCategoryId,
        category.Colour,
        category.Icon,
        category.IsArchived,
        category.CreatedAtUtc,
        category.UpdatedAtUtc,
        category.Version);
}
