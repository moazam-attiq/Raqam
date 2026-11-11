using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Raqam.Domain.Categories;
using Raqam.Infrastructure.Identity;

namespace Raqam.Infrastructure.Persistence.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories", table =>
        {
            table.HasCheckConstraint(
                "CK_Categories_Type_Valid",
                "\"Type\" IN ('Income', 'Expense')");
            table.HasCheckConstraint(
                "CK_Categories_Name_NotBlank",
                "length(btrim(\"Name\")) > 0");
            table.HasCheckConstraint(
                "CK_Categories_NotOwnParent",
                "\"ParentCategoryId\" IS NULL OR \"ParentCategoryId\" <> \"Id\"");
        });

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name).HasMaxLength(Category.NameMaxLength).IsRequired();
        builder.Property(c => c.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(c => c.Colour).HasMaxLength(Category.ColourMaxLength);
        builder.Property(c => c.Icon).HasMaxLength(Category.IconMaxLength);

        // PostgreSQL's xmin system column is the concurrency token (D027).
        builder.Property(c => c.Version).IsRowVersion();

        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // See AccountConfiguration: lets other tables reference a category together with
        // its owner.
        builder.HasAlternateKey(c => new { c.UserId, c.Id });

        // A subcategory must belong to the same owner as its parent, enforced by the
        // composite foreign key. Restrict: a parent with children cannot be deleted
        // (categories are archived, never deleted — D029).
        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(c => new { c.UserId, c.ParentCategoryId })
            .HasPrincipalKey(c => new { c.UserId, c.Id })
            .OnDelete(DeleteBehavior.Restrict);

        // One name per owner, per parent, per type. Top-level categories have a NULL
        // parent; NULLS NOT DISTINCT makes two top-level "Food" expense categories clash
        // (plain unique indexes treat NULLs as different). Needs PostgreSQL 15 or newer.
        builder.HasIndex(c => new { c.UserId, c.ParentCategoryId, c.Type, c.Name })
            .IsUnique()
            .AreNullsDistinct(false);
    }
}
