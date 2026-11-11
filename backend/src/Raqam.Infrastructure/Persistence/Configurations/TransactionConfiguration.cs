using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Raqam.Infrastructure.Identity;

namespace Raqam.Infrastructure.Persistence.Configurations;

public class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.ToTable("Transactions", table =>
        {
            // Money is always positive; the type gives the direction (D005).
            table.HasCheckConstraint(
                "CK_Transactions_Amount_Positive",
                "\"Amount\" > 0");

            table.HasCheckConstraint(
                "CK_Transactions_Type_Valid",
                "\"Type\" IN ('Income', 'Expense', 'Transfer')");

            // The shape of each type (spec §6.2). A transfer has a different destination
            // account and no category; income and expense have a category and no
            // destination. The category's own type (income vs expense) cannot be checked
            // here because it lives in another table; the domain and the tests cover it.
            table.HasCheckConstraint(
                "CK_Transactions_Shape",
                "(\"Type\" = 'Transfer' AND \"DestinationAccountId\" IS NOT NULL " +
                "AND \"CategoryId\" IS NULL AND \"DestinationAccountId\" <> \"SourceAccountId\") " +
                "OR (\"Type\" <> 'Transfer' AND \"DestinationAccountId\" IS NULL " +
                "AND \"CategoryId\" IS NOT NULL)");
        });

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(t => t.Amount).HasPrecision(18, 2);
        builder.Property(t => t.TransactionDate).HasColumnType("date");
        builder.Property(t => t.Description).HasMaxLength(Transaction.DescriptionMaxLength).IsRequired();
        builder.Property(t => t.Merchant).HasMaxLength(Transaction.MerchantMaxLength);

        // PostgreSQL's xmin system column is the concurrency token (D027).
        builder.Property(t => t.Version).IsRowVersion();

        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Every reference pairs the id with UserId, so the database itself refuses a
        // transaction that points at another owner's account or category (rule 14). All
        // Restrict: financial history is never cascade-deleted (spec §6.3). The
        // destination and category keys are nullable; a NULL part skips the check, which
        // is what a non-transfer or a transfer needs.
        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(t => new { t.UserId, t.SourceAccountId })
            .HasPrincipalKey(a => new { a.UserId, a.Id })
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(t => new { t.UserId, t.DestinationAccountId })
            .HasPrincipalKey(a => new { a.UserId, a.Id })
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(t => new { t.UserId, t.CategoryId })
            .HasPrincipalKey(c => new { c.UserId, c.Id })
            .OnDelete(DeleteBehavior.Restrict);

        // Lists and filters are always owner-scoped (D026), so every index starts with
        // UserId. EF also creates an index per foreign key above, i.e.
        // (UserId, SourceAccountId), (UserId, DestinationAccountId), (UserId, CategoryId).
        builder.HasIndex(t => new { t.UserId, t.TransactionDate });
    }
}
