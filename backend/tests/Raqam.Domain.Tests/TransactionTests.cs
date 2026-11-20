using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Common;
using Raqam.Domain.Transactions;
using Xunit;

namespace Raqam.Domain.Tests;

public class TransactionTests
{
    private readonly Guid _userId = TestData.NewUserId();

    private Account NewAcc(string name = "Cash") => TestData.NewAccount(_userId, name);
    private Category NewCat(CategoryType type, string name = "Category") => TestData.NewCategory(_userId, type, name);

    private Transaction Create(
        TransactionType type,
        decimal amount,
        Account source,
        Account? destination = null,
        Category? category = null,
        string? description = null,
        string? merchant = null) =>
        Transaction.Create(_userId, type, amount, TestData.Today, source, destination, category, description, merchant, TestData.Now);

    // ---- The three valid shapes ------------------------------------------------------

    [Fact]
    public void Income_with_an_income_category_is_created()
    {
        var account = NewAcc();
        var category = NewCat(CategoryType.Income, "Salary");

        var tx = Create(TransactionType.Income, 2500m, account, category: category, description: " Pay ", merchant: " Acme ");

        Assert.NotEqual(Guid.Empty, tx.Id);
        Assert.Equal(_userId, tx.UserId);
        Assert.Equal(TransactionType.Income, tx.Type);
        Assert.Equal(2500m, tx.Amount);
        Assert.Equal(TestData.Today, tx.TransactionDate);
        Assert.Equal(account.Id, tx.SourceAccountId);
        Assert.Null(tx.DestinationAccountId);
        Assert.Equal(category.Id, tx.CategoryId);
        Assert.Equal("Pay", tx.Description);
        Assert.Equal("Acme", tx.Merchant);
        Assert.Equal(TestData.Now, tx.CreatedAtUtc);
        Assert.Equal(TestData.Now, tx.UpdatedAtUtc);
    }

    [Fact]
    public void Expense_with_an_expense_category_is_created()
    {
        var tx = Create(TransactionType.Expense, 150.50m, NewAcc(), category: NewCat(CategoryType.Expense));

        Assert.Equal(TransactionType.Expense, tx.Type);
        Assert.Equal(150.50m, tx.Amount);
    }

    [Fact]
    public void Transfer_between_two_different_accounts_is_created_as_a_single_row()
    {
        var from = NewAcc("From");
        var to = NewAcc("To");

        var tx = Create(TransactionType.Transfer, 300m, from, to);

        Assert.Equal(TransactionType.Transfer, tx.Type);
        Assert.Equal(from.Id, tx.SourceAccountId);
        Assert.Equal(to.Id, tx.DestinationAccountId);
        Assert.Null(tx.CategoryId);
    }

    // ---- Income and expense rules ----------------------------------------------------

    [Theory]
    [InlineData(TransactionType.Income)]
    [InlineData(TransactionType.Expense)]
    public void Income_and_expense_need_a_category(TransactionType type)
    {
        Assert.Throws<DomainException>(() => Create(type, 10m, NewAcc()));
    }

    [Fact]
    public void Income_rejects_an_expense_category()
    {
        Assert.Throws<DomainException>(() =>
            Create(TransactionType.Income, 10m, NewAcc(), category: NewCat(CategoryType.Expense)));
    }

    [Fact]
    public void Expense_rejects_an_income_category()
    {
        Assert.Throws<DomainException>(() =>
            Create(TransactionType.Expense, 10m, NewAcc(), category: NewCat(CategoryType.Income)));
    }

    [Theory]
    [InlineData(TransactionType.Income, CategoryType.Income)]
    [InlineData(TransactionType.Expense, CategoryType.Expense)]
    public void Income_and_expense_reject_a_destination_account(TransactionType type, CategoryType categoryType)
    {
        Assert.Throws<DomainException>(() =>
            Create(type, 10m, NewAcc("A"), NewAcc("B"), NewCat(categoryType)));
    }

    // ---- Transfer rules --------------------------------------------------------------

    [Fact]
    public void Transfer_needs_a_destination_account()
    {
        Assert.Throws<DomainException>(() => Create(TransactionType.Transfer, 10m, NewAcc()));
    }

    [Fact]
    public void Transfer_rejects_a_category()
    {
        Assert.Throws<DomainException>(() =>
            Create(TransactionType.Transfer, 10m, NewAcc("A"), NewAcc("B"), NewCat(CategoryType.Expense)));
    }

    [Fact]
    public void Transfer_rejects_the_same_account_on_both_sides()
    {
        var account = NewAcc();

        Assert.Throws<DomainException>(() => Create(TransactionType.Transfer, 10m, account, account));
    }

    // ---- Amount ----------------------------------------------------------------------

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("10.001")]
    [InlineData("10000000000000000.00")]
    public void Invalid_amounts_are_rejected(string text)
    {
        Assert.Throws<DomainException>(() =>
            Create(TransactionType.Expense, TestData.Amount(text), NewAcc(), category: NewCat(CategoryType.Expense)));
    }

    [Theory]
    [InlineData("0.01")]
    [InlineData("9999999999999999.99")]
    public void Boundary_amounts_are_accepted(string text)
    {
        var tx = Create(TransactionType.Expense, TestData.Amount(text), NewAcc(), category: NewCat(CategoryType.Expense));

        Assert.Equal(TestData.Amount(text), tx.Amount);
    }

    // ---- Type, owner, text fields ----------------------------------------------------

    [Fact]
    public void Unknown_transaction_type_is_rejected()
    {
        Assert.Throws<DomainException>(() => Create((TransactionType)99, 10m, NewAcc()));
    }

    [Fact]
    public void Empty_owner_is_rejected()
    {
        Assert.Throws<DomainException>(() =>
            Transaction.Create(Guid.Empty, TransactionType.Expense, 10m, TestData.Today, NewAcc(), null,
                NewCat(CategoryType.Expense), null, null, TestData.Now));
    }

    [Fact]
    public void Description_is_never_null_and_is_trimmed()
    {
        var withNull = Create(TransactionType.Expense, 1m, NewAcc(), category: NewCat(CategoryType.Expense), description: null);
        var withSpaces = Create(TransactionType.Expense, 1m, NewAcc(), category: NewCat(CategoryType.Expense), description: "   ");

        Assert.Equal(string.Empty, withNull.Description);
        Assert.Equal(string.Empty, withSpaces.Description);
    }

    [Fact]
    public void Blank_merchant_becomes_null()
    {
        var tx = Create(TransactionType.Expense, 1m, NewAcc(), category: NewCat(CategoryType.Expense), merchant: "  ");

        Assert.Null(tx.Merchant);
    }

    [Fact]
    public void Description_and_merchant_have_length_limits()
    {
        var account = NewAcc();
        var category = NewCat(CategoryType.Expense);

        Assert.Throws<DomainException>(() =>
            Create(TransactionType.Expense, 1m, account, category: category, description: new string('d', Transaction.DescriptionMaxLength + 1)));
        Assert.Throws<DomainException>(() =>
            Create(TransactionType.Expense, 1m, account, category: category, merchant: new string('m', Transaction.MerchantMaxLength + 1)));

        var atLimit = Create(TransactionType.Expense, 1m, account, category: category,
            description: new string('d', Transaction.DescriptionMaxLength), merchant: new string('m', Transaction.MerchantMaxLength));
        Assert.Equal(Transaction.DescriptionMaxLength, atLimit.Description.Length);
        Assert.Equal(Transaction.MerchantMaxLength, atLimit.Merchant!.Length);
    }

    // ---- Same owner ------------------------------------------------------------------

    [Fact]
    public void Another_owners_account_is_rejected_with_a_not_found_message()
    {
        var foreign = TestData.NewAccount(TestData.NewUserId(), "Theirs");

        var asSource = Assert.Throws<DomainException>(() =>
            Create(TransactionType.Expense, 1m, foreign, category: NewCat(CategoryType.Expense)));
        var asDestination = Assert.Throws<DomainException>(() =>
            Create(TransactionType.Transfer, 1m, NewAcc(), foreign));

        Assert.Contains("not found", asSource.Message);
        Assert.Contains("not found", asDestination.Message);
    }

    [Fact]
    public void Another_owners_category_is_rejected_with_a_not_found_message()
    {
        var foreign = TestData.NewCategory(TestData.NewUserId(), CategoryType.Expense, "Theirs");

        var exception = Assert.Throws<DomainException>(() =>
            Create(TransactionType.Expense, 1m, NewAcc(), category: foreign));

        Assert.Equal("Category was not found.", exception.Message);
    }

    // ---- Archived references (D024) --------------------------------------------------

    [Fact]
    public void An_archived_account_cannot_be_used_for_a_new_transaction()
    {
        var archived = NewAcc();
        archived.Archive(TestData.Later);

        Assert.Throws<DomainException>(() =>
            Create(TransactionType.Expense, 1m, archived, category: NewCat(CategoryType.Expense)));
        Assert.Throws<DomainException>(() =>
            Create(TransactionType.Transfer, 1m, NewAcc("Live"), archived));
    }

    [Fact]
    public void An_archived_category_cannot_be_used_for_a_new_transaction()
    {
        var archived = NewCat(CategoryType.Expense);
        archived.Archive(TestData.Later);

        Assert.Throws<DomainException>(() =>
            Create(TransactionType.Expense, 1m, NewAcc(), category: archived));
    }

    [Fact]
    public void A_transaction_can_still_be_edited_after_its_account_and_category_are_archived()
    {
        var account = NewAcc();
        var category = NewCat(CategoryType.Expense);
        var tx = Create(TransactionType.Expense, 10m, account, category: category);
        account.Archive(TestData.Later);
        category.Archive(TestData.Later);

        tx.Update(TransactionType.Expense, 25m, TestData.Today, account, null, category, "fixed", null, TestData.Later);

        Assert.Equal(25m, tx.Amount);
        Assert.Equal("fixed", tx.Description);
    }

    [Fact]
    public void Editing_cannot_move_a_transaction_to_an_archived_account_or_category()
    {
        var tx = Create(TransactionType.Expense, 10m, NewAcc("A"), category: NewCat(CategoryType.Expense, "Food"));
        var archivedAccount = NewAcc("Old");
        archivedAccount.Archive(TestData.Later);
        var archivedCategory = NewCat(CategoryType.Expense, "Old");
        archivedCategory.Archive(TestData.Later);
        var live = NewAcc("Live");
        var liveCategory = NewCat(CategoryType.Expense, "Live");

        Assert.Throws<DomainException>(() =>
            tx.Update(TransactionType.Expense, 10m, TestData.Today, archivedAccount, null, liveCategory, null, null, TestData.Later));
        Assert.Throws<DomainException>(() =>
            tx.Update(TransactionType.Expense, 10m, TestData.Today, live, null, archivedCategory, null, null, TestData.Later));
    }

    // ---- Update ----------------------------------------------------------------------

    [Fact]
    public void Update_can_turn_an_expense_into_a_transfer()
    {
        var from = NewAcc("From");
        var to = NewAcc("To");
        var tx = Create(TransactionType.Expense, 10m, from, category: NewCat(CategoryType.Expense));

        tx.Update(TransactionType.Transfer, 40m, TestData.Today.AddDays(1), from, to, null, "moved", null, TestData.Later);

        Assert.Equal(TransactionType.Transfer, tx.Type);
        Assert.Equal(40m, tx.Amount);
        Assert.Equal(to.Id, tx.DestinationAccountId);
        Assert.Null(tx.CategoryId);
        Assert.Equal(TestData.Today.AddDays(1), tx.TransactionDate);
        Assert.Equal(TestData.Later, tx.UpdatedAtUtc);
        Assert.Equal(TestData.Now, tx.CreatedAtUtc);
    }

    [Fact]
    public void Update_can_turn_a_transfer_into_an_income()
    {
        var from = NewAcc("From");
        var tx = Create(TransactionType.Transfer, 10m, from, NewAcc("To"));
        var category = NewCat(CategoryType.Income);

        tx.Update(TransactionType.Income, 10m, TestData.Today, from, null, category, null, null, TestData.Later);

        Assert.Equal(TransactionType.Income, tx.Type);
        Assert.Null(tx.DestinationAccountId);
        Assert.Equal(category.Id, tx.CategoryId);
    }

    [Fact]
    public void A_failed_update_leaves_the_transaction_unchanged()
    {
        var account = NewAcc();
        var category = NewCat(CategoryType.Expense);
        var tx = Create(TransactionType.Expense, 10m, account, category: category, description: "original");

        Assert.Throws<DomainException>(() =>
            tx.Update(TransactionType.Expense, -5m, TestData.Today.AddDays(9), account, null, category, "changed", "shop", TestData.Later));

        Assert.Equal(10m, tx.Amount);
        Assert.Equal(TestData.Today, tx.TransactionDate);
        Assert.Equal("original", tx.Description);
        Assert.Null(tx.Merchant);
        Assert.Equal(TestData.Now, tx.UpdatedAtUtc);
    }

    // ---- Balance direction (the single definition the SQL must agree with) ------------

    [Fact]
    public void Income_adds_to_its_account_only()
    {
        var account = NewAcc();
        var tx = Create(TransactionType.Income, 100m, account, category: NewCat(CategoryType.Income));

        Assert.Equal(100m, tx.SignedEffectOn(account.Id));
        Assert.Equal(0m, tx.SignedEffectOn(Guid.NewGuid()));
    }

    [Fact]
    public void Expense_subtracts_from_its_account_only()
    {
        var account = NewAcc();
        var tx = Create(TransactionType.Expense, 40m, account, category: NewCat(CategoryType.Expense));

        Assert.Equal(-40m, tx.SignedEffectOn(account.Id));
        Assert.Equal(0m, tx.SignedEffectOn(Guid.NewGuid()));
    }

    [Fact]
    public void Transfer_subtracts_from_the_source_adds_to_the_destination_and_nets_to_zero()
    {
        var from = NewAcc("From");
        var to = NewAcc("To");
        var tx = Create(TransactionType.Transfer, 75.25m, from, to);

        Assert.Equal(-75.25m, tx.SignedEffectOn(from.Id));
        Assert.Equal(75.25m, tx.SignedEffectOn(to.Id));
        Assert.Equal(0m, tx.SignedEffectOn(from.Id) + tx.SignedEffectOn(to.Id));
        Assert.Equal(0m, tx.SignedEffectOn(Guid.NewGuid()));
    }

    // ---- The date (D051) -------------------------------------------------------------

    [Fact]
    public void A_date_in_the_future_is_refused_on_create_and_on_update()
    {
        var account = NewAcc();
        var category = NewCat(CategoryType.Expense);
        var tooLate = TestData.Today.AddDays(2);

        var created = Assert.Throws<DomainException>(() =>
            Transaction.Create(_userId, TransactionType.Expense, 10m, tooLate, account, null, category, null, null, TestData.Now));
        Assert.Equal("Transaction date cannot be in the future.", created.Message);

        var tx = Create(TransactionType.Expense, 10m, account, category: category);
        Assert.Throws<DomainException>(() =>
            tx.Update(TransactionType.Expense, 10m, tooLate, account, null, category, null, null, TestData.Later));
        Assert.Equal(TestData.Today, tx.TransactionDate);
    }

    [Fact]
    public void Today_and_the_next_day_are_allowed_for_people_ahead_of_UTC()
    {
        var account = NewAcc();
        var category = NewCat(CategoryType.Expense);

        var today = Transaction.Create(_userId, TransactionType.Expense, 10m, TestData.Today, account, null, category, null, null, TestData.Now);
        var next = Transaction.Create(_userId, TransactionType.Expense, 10m, TestData.Today.AddDays(1), account, null, category, null, null, TestData.Now);

        Assert.Equal(TestData.Today, today.TransactionDate);
        Assert.Equal(TestData.Today.AddDays(1), next.TransactionDate);
    }

    [Fact]
    public void Any_past_date_is_allowed()
    {
        var tx = Transaction.Create(
            _userId, TransactionType.Expense, 10m, new DateOnly(1999, 1, 1), NewAcc(), null, NewCat(CategoryType.Expense), null, null, TestData.Now);

        Assert.Equal(new DateOnly(1999, 1, 1), tx.TransactionDate);
    }
}
