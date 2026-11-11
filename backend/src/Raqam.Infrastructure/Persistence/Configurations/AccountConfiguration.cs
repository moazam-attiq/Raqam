using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Raqam.Domain.Accounts;
using Raqam.Infrastructure.Identity;

namespace Raqam.Infrastructure.Persistence.Configurations;

public class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("Accounts", table =>
        {
            table.HasCheckConstraint(
                "CK_Accounts_AccountType_Valid",
                "\"AccountType\" IN ('Cash', 'BankAccount', 'DigitalWallet', 'SavingsAccount')");
            table.HasCheckConstraint(
                "CK_Accounts_Name_NotBlank",
                "length(btrim(\"Name\")) > 0");
        });

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Name).HasMaxLength(Account.NameMaxLength).IsRequired();
        builder.Property(a => a.AccountType).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.OpeningBalance).HasPrecision(18, 2);
        builder.Property(a => a.CurrencyCode).HasMaxLength(3).IsRequired();
        builder.Property(a => a.InstitutionName).HasMaxLength(Account.InstitutionNameMaxLength);

        // PostgreSQL's xmin system column is the concurrency token (D027): no extra column,
        // the database changes it on every update.
        builder.Property(a => a.Version).IsRowVersion();

        // Owner. Restrict, never cascade: deleting a user must not silently erase financial
        // history (spec §6.3).
        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // (UserId, Id) is unique so other tables can reference an account together with its
        // owner. That makes "a transaction only uses its own owner's accounts" a database
        // rule, not just an application check (spec §4 rule 14).
        builder.HasAlternateKey(a => new { a.UserId, a.Id });

        builder.HasIndex(a => new { a.UserId, a.Name }).IsUnique();
    }
}
