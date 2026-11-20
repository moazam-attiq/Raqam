using Raqam.Domain.Common;

namespace Raqam.Domain.Accounts;

/// <summary>
/// A place money is held (spec §3.3, §6.2). There is deliberately no current-balance
/// property: the balance is derived from <see cref="OpeningBalance"/> plus the ledger
/// (D006). Accounts are archived, never deleted (D029).
/// </summary>
public class Account
{
    public const int NameMaxLength = 100;
    public const int InstitutionNameMaxLength = 100;

    /// <summary>The only currency in the first release (D004, D031).</summary>
    public const string DefaultCurrencyCode = "PKR";

    // Required by EF Core.
    private Account() { }

    public Guid Id { get; private set; }

    /// <summary>The owner. Always taken from the authenticated user, never from a payload.</summary>
    public Guid UserId { get; private set; }

    public string Name { get; private set; } = null!;
    public AccountType AccountType { get; private set; }

    /// <summary>Zero or more; editable at any time (D031). A negative opening balance is no longer allowed (D049).</summary>
    public decimal OpeningBalance { get; private set; }

    public string CurrencyCode { get; private set; } = DefaultCurrencyCode;
    public string? InstitutionName { get; private set; }
    public bool IsArchived { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    /// <summary>
    /// Optimistic-concurrency token, mapped to PostgreSQL's <c>xmin</c> system column
    /// (D027). Set by the database, never by application code.
    /// </summary>
    public uint Version { get; private set; }

    public static Account Create(
        Guid userId,
        string name,
        AccountType accountType,
        decimal openingBalance,
        string? institutionName,
        DateTime utcNow)
    {
        return new Account
        {
            Id = Guid.NewGuid(),
            UserId = Guard.NotEmpty(userId, "Owner"),
            Name = Guard.RequiredText(name, NameMaxLength, "Account name"),
            AccountType = EnsureDefined(accountType),
            OpeningBalance = MoneyRules.EnsureValidBalance(openingBalance),
            CurrencyCode = DefaultCurrencyCode,
            InstitutionName = Guard.OptionalText(institutionName, InstitutionNameMaxLength, "Institution name"),
            CreatedAtUtc = utcNow,
            UpdatedAtUtc = utcNow,
        };
    }

    public void Update(
        string name,
        AccountType accountType,
        decimal openingBalance,
        string? institutionName,
        DateTime utcNow)
    {
        // Validate everything before assigning anything, so a rejected edit leaves the account unchanged.
        var validName = Guard.RequiredText(name, NameMaxLength, "Account name");
        var validType = EnsureDefined(accountType);
        var validBalance = MoneyRules.EnsureValidBalance(openingBalance);
        var validInstitution = Guard.OptionalText(institutionName, InstitutionNameMaxLength, "Institution name");

        Name = validName;
        AccountType = validType;
        OpeningBalance = validBalance;
        InstitutionName = validInstitution;
        UpdatedAtUtc = utcNow;
    }

    /// <summary>
    /// Archives the account. History is kept and still counts toward balances and reports,
    /// but new transactions can no longer use it (D024). Safe to call twice.
    /// </summary>
    public void Archive(DateTime utcNow)
    {
        if (IsArchived)
            return;

        IsArchived = true;
        UpdatedAtUtc = utcNow;
    }

    /// <summary>
    /// Records that something able to lower this account's balance is being saved with it.
    /// The changed row makes a second, simultaneous change to the same account fail with a
    /// conflict instead of both passing the "not below zero" check against the same balance (D049).
    /// </summary>
    public void Touch(DateTime utcNow) => UpdatedAtUtc = utcNow;

    private static AccountType EnsureDefined(AccountType accountType)
    {
        if (!Enum.IsDefined(accountType))
            throw new DomainException("Account type is not valid.");

        return accountType;
    }
}
