using Raqam.Domain.Common;

namespace Raqam.Domain.Categories;

/// <summary>
/// A way to classify income or expenses (spec §3.4, §6.2). A category is either top-level
/// or a direct subcategory of a top-level category — never deeper — and a subcategory has
/// the same <see cref="Type"/> as its parent (D028). Categories are archived, never
/// deleted (D029).
/// </summary>
public class Category
{
    public const int NameMaxLength = 100;
    public const int ColourMaxLength = 20;
    public const int IconMaxLength = 50;

    // Required by EF Core.
    private Category() { }

    public Guid Id { get; private set; }

    /// <summary>The owner. Always taken from the authenticated user, never from a payload.</summary>
    public Guid UserId { get; private set; }

    public string Name { get; private set; } = null!;

    /// <summary>Fixed at creation: changing it would reclassify historical transactions.</summary>
    public CategoryType Type { get; private set; }

    /// <summary>Null for a top-level category.</summary>
    public Guid? ParentCategoryId { get; private set; }

    public string? Colour { get; private set; }
    public string? Icon { get; private set; }
    public bool IsArchived { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    /// <summary>Optimistic-concurrency token, mapped to PostgreSQL's <c>xmin</c> (D027).</summary>
    public uint Version { get; private set; }

    /// <param name="parent">The parent category for a subcategory, or null for a top-level one.</param>
    public static Category Create(
        Guid userId,
        string name,
        CategoryType type,
        Category? parent,
        string? colour,
        string? icon,
        DateTime utcNow)
    {
        Guard.NotEmpty(userId, "Owner");

        if (!Enum.IsDefined(type))
            throw new DomainException("Category type is not valid.");

        if (parent is not null)
        {
            if (parent.UserId != userId)
                throw new DomainException("Parent category was not found.");

            if (parent.ParentCategoryId is not null)
                throw new DomainException("A subcategory cannot have its own subcategories.");

            if (parent.Type != type)
                throw new DomainException("A subcategory must have the same type as its parent category.");

            if (parent.IsArchived)
                throw new DomainException("Cannot add a subcategory to an archived category.");
        }

        return new Category
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = Guard.RequiredText(name, NameMaxLength, "Category name"),
            Type = type,
            ParentCategoryId = parent?.Id,
            Colour = Guard.OptionalText(colour, ColourMaxLength, "Colour"),
            Icon = Guard.OptionalText(icon, IconMaxLength, "Icon"),
            CreatedAtUtc = utcNow,
            UpdatedAtUtc = utcNow,
        };
    }

    /// <summary>
    /// Edits the display fields. Type and parent are fixed once created; moving a category
    /// is not part of M3.
    /// </summary>
    public void Update(string name, string? colour, string? icon, DateTime utcNow)
    {
        Name = Guard.RequiredText(name, NameMaxLength, "Category name");
        Colour = Guard.OptionalText(colour, ColourMaxLength, "Colour");
        Icon = Guard.OptionalText(icon, IconMaxLength, "Icon");
        UpdatedAtUtc = utcNow;
    }

    /// <summary>
    /// Archives this category only. Archiving a parent must also archive its subcategories
    /// (D028); the application service loads them and calls this on each, in one save.
    /// Safe to call twice.
    /// </summary>
    public void Archive(DateTime utcNow)
    {
        if (IsArchived)
            return;

        IsArchived = true;
        UpdatedAtUtc = utcNow;
    }
}
