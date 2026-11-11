using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>
/// The database refuses bad data on its own, whatever the application does (D033, spec
/// §6.2). Valid rows are saved through the domain, then raw SQL tries to break them.
/// PostgreSQL error codes: 23514 check violation, 23503 foreign-key violation,
/// 23505 unique violation.
/// </summary>
public class DatabaseConstraintTests(ApiFactory factory)
    : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const string CheckViolation = "23514";
    private const string ForeignKeyViolation = "23503";
    private const string UniqueViolation = "23505";

    private static readonly DateTime Now = new(2026, 11, 11, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = new(2026, 11, 11);

    private Guid _ownerId;
    private Guid _otherId;

    private Account _cash = null!;
    private Account _bank = null!;
    private Account _otherAccount = null!;
    private Category _expenseCategory = null!;
    private Category _incomeCategory = null!;
    private Category _otherCategory = null!;
    private Transaction _expense = null!;
    private Transaction _income = null!;
    private Transaction _transfer = null!;

    public async Task InitializeAsync()
    {
        _ownerId = (await TestDatabase.CreateUserAsync(factory, "owner")).Id;
        _otherId = (await TestDatabase.CreateUserAsync(factory, "other")).Id;

        _cash = Account.Create(_ownerId, "Cash", AccountType.Cash, 0m, null, Now);
        _bank = Account.Create(_ownerId, "Bank", AccountType.BankAccount, 0m, null, Now);
        _otherAccount = Account.Create(_otherId, "Other cash", AccountType.Cash, 0m, null, Now);
        _expenseCategory = Category.Create(_ownerId, "Food", CategoryType.Expense, null, null, null, Now);
        _incomeCategory = Category.Create(_ownerId, "Salary", CategoryType.Income, null, null, null, Now);
        _otherCategory = Category.Create(_otherId, "Their food", CategoryType.Expense, null, null, null, Now);

        _expense = Transaction.Create(_ownerId, TransactionType.Expense, 10m, Today, _cash, null, _expenseCategory, null, null, Now);
        _income = Transaction.Create(_ownerId, TransactionType.Income, 20m, Today, _cash, null, _incomeCategory, null, null, Now);
        _transfer = Transaction.Create(_ownerId, TransactionType.Transfer, 30m, Today, _cash, _bank, null, null, null, Now);

        await TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Accounts.AddRange(_cash, _bank, _otherAccount);
            db.Categories.AddRange(_expenseCategory, _incomeCategory, _otherCategory);
            await db.SaveChangesAsync();

            db.Transactions.AddRange(_expense, _income, _transfer);
            await db.SaveChangesAsync();
        });
    }

    public async Task DisposeAsync()
    {
        await TestDatabase.DeleteUserAsync(factory, _ownerId);
        await TestDatabase.DeleteUserAsync(factory, _otherId);
    }

    private Task<string> RunAsync(Func<Microsoft.EntityFrameworkCore.Infrastructure.DatabaseFacade, Task> sql) =>
        TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, db => sql(db.Database)));

    // ---- Check constraints -----------------------------------------------------------

    [Theory]
    [InlineData("0")]
    [InlineData("-5")]
    public async Task Amount_must_be_positive(string amount)
    {
        var value = decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture);

        var state = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "Amount" = {value} WHERE "Id" = {_expense.Id}"""));

        Assert.Equal(CheckViolation, state);
    }

    [Fact]
    public async Task Type_must_be_one_of_the_known_values()
    {
        var state = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "Type" = 'Loan' WHERE "Id" = {_expense.Id}"""));

        Assert.Equal(CheckViolation, state);
    }

    [Fact]
    public async Task A_transfer_cannot_have_a_category()
    {
        var state = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "CategoryId" = {_expenseCategory.Id} WHERE "Id" = {_transfer.Id}"""));

        Assert.Equal(CheckViolation, state);
    }

    [Fact]
    public async Task A_transfer_needs_two_different_accounts()
    {
        var sameAccount = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "DestinationAccountId" = "SourceAccountId" WHERE "Id" = {_transfer.Id}"""));
        var noDestination = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "DestinationAccountId" = NULL WHERE "Id" = {_transfer.Id}"""));

        Assert.Equal(CheckViolation, sameAccount);
        Assert.Equal(CheckViolation, noDestination);
    }

    [Fact]
    public async Task Income_and_expense_need_a_category_and_cannot_have_a_destination()
    {
        var expenseWithoutCategory = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "CategoryId" = NULL WHERE "Id" = {_expense.Id}"""));
        var incomeWithoutCategory = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "CategoryId" = NULL WHERE "Id" = {_income.Id}"""));
        var expenseWithDestination = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "DestinationAccountId" = {_bank.Id} WHERE "Id" = {_expense.Id}"""));

        Assert.Equal(CheckViolation, expenseWithoutCategory);
        Assert.Equal(CheckViolation, incomeWithoutCategory);
        Assert.Equal(CheckViolation, expenseWithDestination);
    }

    // ---- Same-owner foreign keys (D033) ----------------------------------------------

    [Fact]
    public async Task A_transaction_cannot_point_at_another_owners_account()
    {
        var asSource = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "SourceAccountId" = {_otherAccount.Id} WHERE "Id" = {_expense.Id}"""));
        var asDestination = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "DestinationAccountId" = {_otherAccount.Id} WHERE "Id" = {_transfer.Id}"""));

        Assert.Equal(ForeignKeyViolation, asSource);
        Assert.Equal(ForeignKeyViolation, asDestination);
    }

    [Fact]
    public async Task A_transaction_cannot_point_at_another_owners_category()
    {
        var state = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Transactions" SET "CategoryId" = {_otherCategory.Id} WHERE "Id" = {_expense.Id}"""));

        Assert.Equal(ForeignKeyViolation, state);
    }

    [Fact]
    public async Task A_subcategory_cannot_have_another_owners_category_as_its_parent()
    {
        var child = Category.Create(_ownerId, "Child", CategoryType.Expense, _expenseCategory, null, null, Now);
        await TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Categories.Add(child);
            await db.SaveChangesAsync();
        });

        var state = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Categories" SET "ParentCategoryId" = {_otherCategory.Id} WHERE "Id" = {child.Id}"""));

        Assert.Equal(ForeignKeyViolation, state);
    }

    [Fact]
    public async Task A_row_cannot_be_handed_to_another_owner_while_it_is_referenced()
    {
        // Changing an account's owner would orphan the (UserId, AccountId) reference.
        var state = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Accounts" SET "UserId" = {_otherId} WHERE "Id" = {_cash.Id}"""));

        Assert.Equal(ForeignKeyViolation, state);
    }

    // ---- History is never cascade-deleted (spec §6.3) --------------------------------

    [Fact]
    public async Task An_account_or_category_with_transactions_cannot_be_deleted()
    {
        var account = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""DELETE FROM "Accounts" WHERE "Id" = {_cash.Id}"""));
        var category = await RunAsync(db => db.ExecuteSqlInterpolatedAsync(
            $"""DELETE FROM "Categories" WHERE "Id" = {_expenseCategory.Id}"""));

        Assert.Equal(ForeignKeyViolation, account);
        Assert.Equal(ForeignKeyViolation, category);
    }

    // ---- Unique indexes --------------------------------------------------------------

    [Fact]
    public async Task Account_names_are_unique_per_owner_only()
    {
        var duplicate = await TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Accounts.Add(Account.Create(_ownerId, "Cash", AccountType.Cash, 0m, null, Now));
            await db.SaveChangesAsync();
        }));

        var otherOwner = await TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, async db =>
        {
            // "Other cash" exists for the other owner; the owner may use that name.
            db.Accounts.Add(Account.Create(_ownerId, "Other cash", AccountType.Cash, 0m, null, Now));
            await db.SaveChangesAsync();
        }));

        Assert.Equal(UniqueViolation, duplicate);
        Assert.Equal("none", otherOwner);
    }

    [Fact]
    public async Task Category_names_are_unique_per_owner_parent_and_type()
    {
        // Same name, same type, both top-level: the NULLS NOT DISTINCT index catches it.
        var topLevel = await TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Categories.Add(Category.Create(_ownerId, "Food", CategoryType.Expense, null, null, null, Now));
            await db.SaveChangesAsync();
        }));

        // Same name but the other type is a different category.
        var otherType = await TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Categories.Add(Category.Create(_ownerId, "Food", CategoryType.Income, null, null, null, Now));
            await db.SaveChangesAsync();
        }));

        // The same subcategory name under one parent twice is refused; under two parents it is fine.
        var secondParent = Category.Create(_ownerId, "Second parent", CategoryType.Expense, null, null, null, Now);
        await TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Categories.Add(secondParent);
            await db.SaveChangesAsync();
        });
        await TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Categories.Add(Category.Create(_ownerId, "Snacks", CategoryType.Expense, _expenseCategory, null, null, Now));
            await db.SaveChangesAsync();
        });
        var sameParent = await TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Categories.Add(Category.Create(_ownerId, "Snacks", CategoryType.Expense, _expenseCategory, null, null, Now));
            await db.SaveChangesAsync();
        }));
        var otherParent = await TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Categories.Add(Category.Create(_ownerId, "Snacks", CategoryType.Expense, secondParent, null, null, Now));
            await db.SaveChangesAsync();
        }));

        // Another owner may use the same top-level name.
        var otherOwner = await TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Categories.Add(Category.Create(_otherId, "Food", CategoryType.Expense, null, null, null, Now));
            await db.SaveChangesAsync();
        }));

        Assert.Equal(UniqueViolation, topLevel);
        Assert.Equal("none", otherType);
        Assert.Equal(UniqueViolation, sameParent);
        Assert.Equal("none", otherParent);
        Assert.Equal("none", otherOwner);
    }

    // ---- Concurrency token -----------------------------------------------------------

    [Fact]
    public async Task The_version_token_changes_when_a_row_changes()
    {
        var before = await TestDatabase.WithDbAsync(factory, db =>
            db.Accounts.AsNoTracking().Where(a => a.Id == _bank.Id).Select(a => a.Version).SingleAsync());

        await TestDatabase.WithDbAsync(factory, db => db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "Accounts" SET "Name" = 'Bank renamed' WHERE "Id" = {_bank.Id}"""));

        var after = await TestDatabase.WithDbAsync(factory, db =>
            db.Accounts.AsNoTracking().Where(a => a.Id == _bank.Id).Select(a => a.Version).SingleAsync());

        Assert.NotEqual(before, after);
    }
}
