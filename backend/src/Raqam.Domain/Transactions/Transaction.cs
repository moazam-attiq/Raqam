using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Common;

namespace Raqam.Domain.Transactions;

/// <summary>
/// One ledger entry (spec §3.2, §6.2). The rules, for every create and every edit:
/// <list type="bullet">
/// <item>Income: one account and an income category.</item>
/// <item>Expense: one account and an expense category.</item>
/// <item>Transfer: a source and a different destination account, and no category; it is
/// neither income nor expense (rule 3). A transfer is a single row (D023).</item>
/// <item>The amount is always positive; the type gives the direction (D005).</item>
/// <item>Every account and category belongs to the same owner as the transaction.</item>
/// <item>A newly referenced account or category must not be archived (D024).</item>
/// </list>
/// </summary>
public class Transaction
{
    public const int DescriptionMaxLength = 500;
    public const int MerchantMaxLength = 200;

    // Required by EF Core.
    private Transaction() { }

    public Guid Id { get; private set; }

    /// <summary>The owner. Always taken from the authenticated user, never from a payload.</summary>
    public Guid UserId { get; private set; }

    public TransactionType Type { get; private set; }

    /// <summary>Always positive (D005, D030).</summary>
    public decimal Amount { get; private set; }

    /// <summary>A plain date, so it cannot shift with timezone conversion (D022).</summary>
    public DateOnly TransactionDate { get; private set; }

    /// <summary>The account money leaves (expense, transfer) or arrives in (income).</summary>
    public Guid SourceAccountId { get; private set; }

    /// <summary>Only for transfers: the account money arrives in.</summary>
    public Guid? DestinationAccountId { get; private set; }

    /// <summary>Only for income and expense; always null for a transfer.</summary>
    public Guid? CategoryId { get; private set; }

    /// <summary>May be empty, never null.</summary>
    public string Description { get; private set; } = string.Empty;

    public string? Merchant { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    /// <summary>Optimistic-concurrency token, mapped to PostgreSQL's <c>xmin</c> (D027).</summary>
    public uint Version { get; private set; }

    /// <param name="destinationAccount">Required for a transfer, must be null otherwise.</param>
    /// <param name="category">Required for income and expense, must be null for a transfer.</param>
    public static Transaction Create(
        Guid userId,
        TransactionType type,
        decimal amount,
        DateOnly transactionDate,
        Account sourceAccount,
        Account? destinationAccount,
        Category? category,
        string? description,
        string? merchant,
        DateTime utcNow)
    {
        Guard.NotEmpty(userId, "Owner");

        var transaction = new Transaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CreatedAtUtc = utcNow,
        };

        transaction.Apply(
            type, amount, transactionDate, sourceAccount, destinationAccount, category,
            description, merchant, utcNow);

        return transaction;
    }

    /// <summary>
    /// Replaces the editable fields, re-checking every rule (so the type can change, for
    /// example expense to transfer). An account or category that is already on the
    /// transaction may be archived, so an old entry can still be edited; only a
    /// <em>newly</em> referenced one must be active.
    /// </summary>
    public void Update(
        TransactionType type,
        decimal amount,
        DateOnly transactionDate,
        Account sourceAccount,
        Account? destinationAccount,
        Category? category,
        string? description,
        string? merchant,
        DateTime utcNow)
    {
        Apply(
            type, amount, transactionDate, sourceAccount, destinationAccount, category,
            description, merchant, utcNow);
    }

    /// <summary>
    /// The signed effect this transaction has on one account's balance: income and
    /// transfer-in add, expense and transfer-out subtract, anything else is zero. This is
    /// the single definition of balance direction (spec §6.4); the SQL balance query must
    /// agree with it, which the integration tests check.
    /// </summary>
    public decimal SignedEffectOn(Guid accountId)
    {
        var effect = 0m;

        switch (Type)
        {
            case TransactionType.Income:
                if (SourceAccountId == accountId) effect += Amount;
                break;

            case TransactionType.Expense:
                if (SourceAccountId == accountId) effect -= Amount;
                break;

            case TransactionType.Transfer:
                if (SourceAccountId == accountId) effect -= Amount;
                if (DestinationAccountId == accountId) effect += Amount;
                break;
        }

        return effect;
    }

    private void Apply(
        TransactionType type,
        decimal amount,
        DateOnly transactionDate,
        Account sourceAccount,
        Account? destinationAccount,
        Category? category,
        string? description,
        string? merchant,
        DateTime utcNow)
    {
        ArgumentNullException.ThrowIfNull(sourceAccount);

        if (!Enum.IsDefined(type))
            throw new DomainException("Transaction type is not valid.");

        // Validate everything before assigning anything, so a failed edit leaves the
        // entity unchanged.
        var validAmount = MoneyRules.EnsurePositiveAmount(amount);
        var validDescription = Guard.OptionalText(description, DescriptionMaxLength, "Description") ?? string.Empty;
        var validMerchant = Guard.OptionalText(merchant, MerchantMaxLength, "Merchant");

        // A transaction records something that has happened, so it cannot be dated in the future
        // (D051). The server only knows its own UTC date, and anyone ahead of UTC (Pakistan is
        // UTC+5) is already on the next day for part of it, so one day beyond UTC "today" is
        // allowed; the app itself limits the picker to the person's own today.
        if (transactionDate > DateOnly.FromDateTime(utcNow).AddDays(1))
            throw new DomainException("Transaction date cannot be in the future.");

        EnsureUsableAccount(sourceAccount, SourceAccountId, "Source account");

        Guid? validDestinationId = null;
        Guid? validCategoryId = null;

        if (type == TransactionType.Transfer)
        {
            if (destinationAccount is null)
                throw new DomainException("A transfer needs a destination account.");

            if (category is not null)
                throw new DomainException("A transfer cannot have a category.");

            if (destinationAccount.Id == sourceAccount.Id)
                throw new DomainException("A transfer needs two different accounts.");

            EnsureUsableAccount(destinationAccount, DestinationAccountId, "Destination account");
            validDestinationId = destinationAccount.Id;
        }
        else
        {
            if (destinationAccount is not null)
                throw new DomainException("Only a transfer can have a destination account.");

            var requiredCategoryType = type == TransactionType.Income ? CategoryType.Income : CategoryType.Expense;
            var wrongCategoryMessage = type == TransactionType.Income
                ? "An income transaction needs an income category."
                : "An expense transaction needs an expense category.";

            if (category is null)
                throw new DomainException(wrongCategoryMessage);

            // Ownership first, with the same message as a missing category, so a caller
            // cannot tell whether another user's category id exists.
            if (category.UserId != UserId)
                throw new DomainException("Category was not found.");

            if (category.Type != requiredCategoryType)
                throw new DomainException(wrongCategoryMessage);

            if (category.IsArchived && category.Id != CategoryId)
                throw new DomainException("Cannot use an archived category for a new transaction.");

            validCategoryId = category.Id;
        }

        Type = type;
        Amount = validAmount;
        TransactionDate = transactionDate;
        SourceAccountId = sourceAccount.Id;
        DestinationAccountId = validDestinationId;
        CategoryId = validCategoryId;
        Description = validDescription;
        Merchant = validMerchant;
        UpdatedAtUtc = utcNow;
    }

    private void EnsureUsableAccount(Account account, Guid? currentAccountId, string label)
    {
        // Same message as a missing account, so a caller cannot tell whether another
        // user's account id exists.
        if (account.UserId != UserId)
            throw new DomainException($"{label} was not found.");

        if (account.IsArchived && account.Id != currentAccountId)
            throw new DomainException($"Cannot use an archived account for a new transaction ({label.ToLowerInvariant()}).");
    }
}
