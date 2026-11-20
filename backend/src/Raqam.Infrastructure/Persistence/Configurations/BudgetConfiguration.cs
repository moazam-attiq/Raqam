using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Raqam.Domain.Budgets;
using Raqam.Domain.Categories;
using Raqam.Infrastructure.Identity;

namespace Raqam.Infrastructure.Persistence.Configurations;

public class BudgetConfiguration : IEntityTypeConfiguration<Budget>
{
    public void Configure(EntityTypeBuilder<Budget> builder)
    {
        builder.ToTable("Budgets", table =>
        {
            table.HasCheckConstraint("CK_Budgets_Amount_Positive", "\"Amount\" > 0");
            table.HasCheckConstraint("CK_Budgets_Month_Valid", "\"Month\" BETWEEN 1 AND 12");
            table.HasCheckConstraint("CK_Budgets_Year_Valid", "\"Year\" BETWEEN 2000 AND 2100");
        });

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Amount).HasPrecision(18, 2);

        // PostgreSQL's xmin system column is the concurrency token (D027).
        builder.Property(b => b.Version).IsRowVersion();

        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // The budget's category must belong to the same owner, enforced by the database
        // (see TransactionConfiguration). A NULL category is the overall budget, which skips
        // the check. Restrict: a category with a budget is archived, never deleted (D029).
        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(b => new { b.UserId, b.CategoryId })
            .HasPrincipalKey(c => new { c.UserId, c.Id })
            .OnDelete(DeleteBehavior.Restrict);

        // One budget per owner, month and category. The overall budget has a NULL category;
        // NULLS NOT DISTINCT makes two overall budgets for one month clash (plain unique
        // indexes treat NULLs as different). Needs PostgreSQL 15 or newer, as for categories.
        builder.HasIndex(b => new { b.UserId, b.Year, b.Month, b.CategoryId })
            .IsUnique()
            .AreNullsDistinct(false);
    }
}
