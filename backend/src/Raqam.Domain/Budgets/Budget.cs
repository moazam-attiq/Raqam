using Raqam.Domain.Categories;
using Raqam.Domain.Common;

namespace Raqam.Domain.Budgets;

/// <summary>
/// A spending limit for one month (spec §3.5, §6.2): either for one expense category or, when
/// <see cref="CategoryId"/> is null, for everything the owner spends that month. The month,
/// year and category are fixed once created (to change one, delete the budget and create
/// another); only the amount can be edited. One budget per owner, month and category (D053).
/// </summary>
public class Budget
{
    public const int MinYear = 2000;
    public const int MaxYear = 2100;

    // Required by EF Core.
    private Budget() { }

    public Guid Id { get; private set; }

    /// <summary>The owner. Always taken from the authenticated user, never from a payload.</summary>
    public Guid UserId { get; private set; }

    /// <summary>Null for the overall budget.</summary>
    public Guid? CategoryId { get; private set; }

    public decimal Amount { get; private set; }
    public int Year { get; private set; }
    public int Month { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    /// <summary>Optimistic-concurrency token, mapped to PostgreSQL's <c>xmin</c> (D027).</summary>
    public uint Version { get; private set; }

    /// <param name="category">The expense category to budget, or null for the overall budget.</param>
    public static Budget Create(Guid userId, int year, int month, decimal amount, Category? category, DateTime utcNow)
    {
        Guard.NotEmpty(userId, "Owner");
        EnsureValidPeriod(year, month);
        var validAmount = MoneyRules.EnsurePositiveAmount(amount, "Budget amount");

        if (category is not null)
        {
            if (category.UserId != userId)
                throw new DomainException("Category was not found.");

            if (category.Type != CategoryType.Expense)
                throw new DomainException("A budget can only be set on an expense category.");

            if (category.IsArchived)
                throw new DomainException("Cannot set a budget on an archived category.");
        }

        return new Budget
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CategoryId = category?.Id,
            Amount = validAmount,
            Year = year,
            Month = month,
            CreatedAtUtc = utcNow,
            UpdatedAtUtc = utcNow,
        };
    }

    public void Update(decimal amount, DateTime utcNow)
    {
        Amount = MoneyRules.EnsurePositiveAmount(amount, "Budget amount");
        UpdatedAtUtc = utcNow;
    }

    public static void EnsureValidPeriod(int year, int month)
    {
        if (year < MinYear || year > MaxYear)
            throw new DomainException($"Year must be between {MinYear} and {MaxYear}.");

        if (month < 1 || month > 12)
            throw new DomainException("Month must be between 1 and 12.");
    }
}
