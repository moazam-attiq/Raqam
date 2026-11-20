using Raqam.Domain.Accounts;
using Raqam.Domain.Common;
using Xunit;

namespace Raqam.Domain.Tests;

public class AccountTests
{
    [Fact]
    public void Create_sets_the_fields_and_defaults_to_PKR()
    {
        var userId = TestData.NewUserId();

        var account = Account.Create(userId, "  Main wallet  ", AccountType.DigitalWallet, 250.75m, "  Easypaisa ", TestData.Now);

        Assert.NotEqual(Guid.Empty, account.Id);
        Assert.Equal(userId, account.UserId);
        Assert.Equal("Main wallet", account.Name);
        Assert.Equal(AccountType.DigitalWallet, account.AccountType);
        Assert.Equal(250.75m, account.OpeningBalance);
        Assert.Equal("PKR", account.CurrencyCode);
        Assert.Equal("Easypaisa", account.InstitutionName);
        Assert.False(account.IsArchived);
        Assert.Equal(TestData.Now, account.CreatedAtUtc);
        Assert.Equal(TestData.Now, account.UpdatedAtUtc);
    }

    // D049 reverses D031: an account never starts below zero.
    [Fact]
    public void Create_rejects_a_negative_opening_balance()
    {
        Assert.Throws<DomainException>(() => TestData.NewAccount(TestData.NewUserId(), openingBalance: -1500m));
    }

    [Fact]
    public void Update_rejects_a_negative_opening_balance_and_changes_nothing()
    {
        var account = TestData.NewAccount(TestData.NewUserId(), openingBalance: 100m);

        Assert.Throws<DomainException>(() =>
            account.Update("Renamed", AccountType.Cash, -1m, null, TestData.Later));

        Assert.Equal("Cash", account.Name);
        Assert.Equal(100m, account.OpeningBalance);
        Assert.Equal(TestData.Now, account.UpdatedAtUtc);
    }

    [Fact]
    public void Touch_sets_the_update_time_only()
    {
        var account = TestData.NewAccount(TestData.NewUserId(), openingBalance: 100m);

        account.Touch(TestData.Later);

        Assert.Equal(TestData.Later, account.UpdatedAtUtc);
        Assert.Equal(TestData.Now, account.CreatedAtUtc);
        Assert.Equal(100m, account.OpeningBalance);
    }

    [Fact]
    public void Create_turns_a_blank_institution_into_null()
    {
        var account = Account.Create(TestData.NewUserId(), "Cash", AccountType.Cash, 0m, "   ", TestData.Now);

        Assert.Null(account.InstitutionName);
    }

    [Fact]
    public void Create_rejects_an_empty_owner()
    {
        Assert.Throws<DomainException>(() => TestData.NewAccount(Guid.Empty));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_rejects_a_blank_name(string name)
    {
        Assert.Throws<DomainException>(() =>
            Account.Create(TestData.NewUserId(), name, AccountType.Cash, 0m, null, TestData.Now));
    }

    [Fact]
    public void Create_rejects_a_name_longer_than_the_limit()
    {
        var name = new string('a', Account.NameMaxLength + 1);

        Assert.Throws<DomainException>(() =>
            Account.Create(TestData.NewUserId(), name, AccountType.Cash, 0m, null, TestData.Now));
    }

    [Fact]
    public void Create_accepts_a_name_at_exactly_the_limit()
    {
        var name = new string('a', Account.NameMaxLength);

        var account = Account.Create(TestData.NewUserId(), name, AccountType.Cash, 0m, null, TestData.Now);

        Assert.Equal(name, account.Name);
    }

    [Fact]
    public void Create_rejects_an_unknown_account_type()
    {
        Assert.Throws<DomainException>(() =>
            Account.Create(TestData.NewUserId(), "Cash", (AccountType)99, 0m, null, TestData.Now));
    }

    [Theory]
    [InlineData("10.001")]
    [InlineData("10000000000000000.00")]
    public void Create_rejects_an_invalid_opening_balance(string text)
    {
        Assert.Throws<DomainException>(() =>
            Account.Create(TestData.NewUserId(), "Cash", AccountType.Cash, TestData.Amount(text), null, TestData.Now));
    }

    [Fact]
    public void Update_changes_the_fields_and_the_update_time()
    {
        var account = TestData.NewAccount(TestData.NewUserId());

        account.Update("Savings", AccountType.SavingsAccount, 99m, "HBL", TestData.Later);

        Assert.Equal("Savings", account.Name);
        Assert.Equal(AccountType.SavingsAccount, account.AccountType);
        Assert.Equal(99m, account.OpeningBalance);
        Assert.Equal("HBL", account.InstitutionName);
        Assert.Equal(TestData.Now, account.CreatedAtUtc);
        Assert.Equal(TestData.Later, account.UpdatedAtUtc);
    }

    [Fact]
    public void Update_with_invalid_input_throws()
    {
        var account = TestData.NewAccount(TestData.NewUserId());

        Assert.Throws<DomainException>(() => account.Update("", AccountType.Cash, 0m, null, TestData.Later));
    }

    [Fact]
    public void Archive_marks_the_account_archived()
    {
        var account = TestData.NewAccount(TestData.NewUserId());

        account.Archive(TestData.Later);

        Assert.True(account.IsArchived);
        Assert.Equal(TestData.Later, account.UpdatedAtUtc);
    }

    [Fact]
    public void Archive_twice_is_safe_and_does_not_change_the_update_time()
    {
        var account = TestData.NewAccount(TestData.NewUserId());
        account.Archive(TestData.Later);

        account.Archive(TestData.Later.AddHours(5));

        Assert.True(account.IsArchived);
        Assert.Equal(TestData.Later, account.UpdatedAtUtc);
    }
}
