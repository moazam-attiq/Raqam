using FluentValidation;
using Raqam.Domain.Common;

namespace Raqam.Application.Common;

/// <summary>
/// FluentValidation rules for money in request bodies, so field errors name the field
/// (the domain re-checks the same limits as the last line of defence, D030).
/// </summary>
public static class MoneyValidation
{
    /// <summary>A transaction amount: greater than zero, at most 2 decimal places, within range (D005, D030).</summary>
    public static IRuleBuilderOptions<T, decimal> PositiveAmount<T>(this IRuleBuilder<T, decimal> rule)
    {
        return rule
            .GreaterThan(0m)
            .Must(value => decimal.Round(value, 2) == value)
                .WithMessage("'{PropertyName}' can have at most 2 decimal places.")
            .Must(value => value <= MoneyRules.MaxAmount)
                .WithMessage("'{PropertyName}' is too large.");
    }

    /// <summary>At most 2 decimal places and within what <c>numeric(18,2)</c> holds. Zero and negatives are allowed.</summary>
    public static IRuleBuilderOptions<T, decimal> ValidBalance<T>(this IRuleBuilder<T, decimal> rule)
    {
        return rule
            .Must(value => decimal.Round(value, 2) == value)
                .WithMessage("'{PropertyName}' can have at most 2 decimal places.")
            .Must(value => Math.Abs(value) <= MoneyRules.MaxAmount)
                .WithMessage("'{PropertyName}' is too large.");
    }
}
