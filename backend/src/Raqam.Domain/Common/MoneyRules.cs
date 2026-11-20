namespace Raqam.Domain.Common;

/// <summary>
/// Money rules shared by every entity that stores an amount (D005, D030). Amounts are
/// <c>decimal</c>, stored as <c>numeric(18,2)</c>; extra decimal places are rejected,
/// never rounded.
/// </summary>
public static class MoneyRules
{
    /// <summary>Largest value <c>numeric(18,2)</c> can hold: 16 integer digits, 2 decimals.</summary>
    public const decimal MaxAmount = 9_999_999_999_999_999.99m;

    /// <summary>A transaction amount: greater than zero, at most 2 decimals, within range.</summary>
    public static decimal EnsurePositiveAmount(decimal amount, string fieldName = "Amount")
    {
        if (amount <= 0)
            throw new DomainException($"{fieldName} must be greater than zero.");

        return EnsureValidScaleAndRange(amount, fieldName);
    }

    /// <summary>
    /// An opening balance: zero or more (an account never starts below zero, D049), at most
    /// 2 decimals, within range.
    /// </summary>
    public static decimal EnsureValidBalance(decimal amount, string fieldName = "Opening balance")
    {
        if (amount < 0)
            throw new DomainException($"{fieldName} cannot be negative.");

        return EnsureValidScaleAndRange(amount, fieldName);
    }

    private static decimal EnsureValidScaleAndRange(decimal amount, string fieldName)
    {
        if (decimal.Round(amount, 2) != amount)
            throw new DomainException($"{fieldName} can have at most 2 decimal places.");

        if (Math.Abs(amount) > MaxAmount)
            throw new DomainException($"{fieldName} is too large.");

        return amount;
    }
}
