using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;

namespace Raqam.Domain.Tests;

internal static class TestData
{
    public static readonly DateTime Now = new(2026, 11, 11, 12, 0, 0, DateTimeKind.Utc);
    public static readonly DateTime Later = Now.AddHours(1);
    public static readonly DateOnly Today = new(2026, 11, 11);

    public static Guid NewUserId() => Guid.NewGuid();

    public static Account NewAccount(Guid userId, string name = "Cash", decimal openingBalance = 0m) =>
        Account.Create(userId, name, AccountType.Cash, openingBalance, null, Now);

    public static Category NewCategory(Guid userId, CategoryType type, string name = "Category", Category? parent = null) =>
        Category.Create(userId, name, type, parent, null, null, Now);

    /// <summary>Test amounts are written as text because C# attributes cannot take decimal constants.</summary>
    public static decimal Amount(string text) =>
        decimal.Parse(text, System.Globalization.CultureInfo.InvariantCulture);
}
