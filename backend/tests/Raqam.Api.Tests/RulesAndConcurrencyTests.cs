using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Raqam.Application.Accounts;
using Raqam.Application.Categories;
using Raqam.Application.Common;
using Raqam.Application.Transactions;
using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>
/// Over HTTP: optimistic concurrency (D027), the transaction rules, the list filters and
/// paging (D036), and that nothing works without signing in.
/// </summary>
public class RulesAndConcurrencyTests(ApiFactory factory)
    : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private static readonly DateOnly Date = new(2025, 4, 15);

    private TestApiClient _user = null!;
    private AccountResponse _cash = null!;
    private AccountResponse _bank = null!;
    private CategoryResponse _food = null!;
    private CategoryResponse _pay = null!;

    public async Task InitializeAsync()
    {
        _user = await TestApiClient.CreateAsync(factory, "rules");
        _cash = await _user.CreateAccountAsync("Rules cash", 1000m);
        _bank = await _user.CreateAccountAsync("Rules bank", 0m, AccountType.BankAccount);
        _food = await _user.CreateCategoryAsync("Rules food", CategoryType.Expense);
        _pay = await _user.CreateCategoryAsync("Rules pay", CategoryType.Income);
    }

    public async Task DisposeAsync() => await _user.DisposeAsync();

    // ---- Authentication --------------------------------------------------------------

    [Theory]
    [InlineData("/api/v1/accounts")]
    [InlineData("/api/v1/categories")]
    [InlineData("/api/v1/transactions")]
    public async Task Endpoints_require_a_signed_in_user(string url)
    {
        var anonymous = factory.CreateClient();

        var response = await anonymous.GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---- Optimistic concurrency ------------------------------------------------------

    [Fact]
    public async Task Updating_an_account_with_a_stale_version_returns_409_and_keeps_the_newer_data()
    {
        var account = await _user.CreateAccountAsync("Concurrent account", 10m);

        var first = await _user.SendAsync<AccountResponse>(
            HttpMethod.Put, $"/api/v1/accounts/{account.Id}",
            new UpdateAccountRequest("Concurrent account", AccountType.Cash, 20m, "First", account.Version),
            HttpStatusCode.OK);
        Assert.NotEqual(account.Version, first.Version);

        var stale = await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/accounts/{account.Id}",
            new UpdateAccountRequest("Concurrent account", AccountType.Cash, 99m, "Second", account.Version));
        Assert.Equal(HttpStatusCode.Conflict, stale);

        var current = await _user.GetAsync<AccountResponse>($"/api/v1/accounts/{account.Id}");
        Assert.Equal(20m, current.OpeningBalance);
        Assert.Equal("First", current.InstitutionName);

        // Retrying with the version the client just received succeeds.
        var retried = await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/accounts/{account.Id}",
            new UpdateAccountRequest("Concurrent account", AccountType.Cash, 99m, "Second", current.Version));
        Assert.Equal(HttpStatusCode.OK, retried);
    }

    [Fact]
    public async Task Updating_a_transaction_with_a_stale_version_returns_409()
    {
        var tx = await _user.CreateTransactionAsync(TransactionType.Expense, 10m, Date, _cash.Id, categoryId: _food.Id);

        var updated = await _user.SendAsync<TransactionResponse>(
            HttpMethod.Put, $"/api/v1/transactions/{tx.Id}",
            new UpdateTransactionRequest(TransactionType.Expense, 11m, Date, _cash.Id, null, _food.Id, null, null, tx.Version),
            HttpStatusCode.OK);

        var stale = await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/transactions/{tx.Id}",
            new UpdateTransactionRequest(TransactionType.Expense, 12m, Date, _cash.Id, null, _food.Id, null, null, tx.Version));
        Assert.Equal(HttpStatusCode.Conflict, stale);

        var current = await _user.GetAsync<TransactionResponse>($"/api/v1/transactions/{tx.Id}");
        Assert.Equal(11m, current.Amount);
        Assert.Equal(updated.Version, current.Version);
    }

    [Fact]
    public async Task Updating_a_category_with_a_stale_version_returns_409()
    {
        var category = await _user.CreateCategoryAsync("Concurrent category", CategoryType.Expense);

        await _user.SendAsync<CategoryResponse>(
            HttpMethod.Put, $"/api/v1/categories/{category.Id}",
            new UpdateCategoryRequest("Concurrent category", "#111111", null, category.Version),
            HttpStatusCode.OK);

        var stale = await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/categories/{category.Id}",
            new UpdateCategoryRequest("Concurrent category", "#222222", null, category.Version));

        Assert.Equal(HttpStatusCode.Conflict, stale);
    }

    [Fact]
    public async Task Duplicate_account_and_category_names_return_409()
    {
        await _user.CreateAccountAsync("Duplicate me", 0m);
        var duplicateAccount = await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/accounts", new CreateAccountRequest("Duplicate me", AccountType.Cash, 0m, null));

        await _user.CreateCategoryAsync("Duplicate cat", CategoryType.Expense);
        var duplicateCategory = await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/categories", new CreateCategoryRequest("Duplicate cat", CategoryType.Expense, null, null, null));

        // The same name with the other type is a different category.
        var otherType = await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/categories", new CreateCategoryRequest("Duplicate cat", CategoryType.Income, null, null, null));

        Assert.Equal(HttpStatusCode.Conflict, duplicateAccount);
        Assert.Equal(HttpStatusCode.Conflict, duplicateCategory);
        Assert.Equal(HttpStatusCode.Created, otherType);
    }

    // ---- Rules over HTTP -------------------------------------------------------------

    [Theory]
    [InlineData("0")]
    [InlineData("-5")]
    [InlineData("10.001")]
    [InlineData("10000000000000000.00")]
    public async Task Invalid_amounts_are_rejected_with_400(string amountText)
    {
        var amount = decimal.Parse(amountText, System.Globalization.CultureInfo.InvariantCulture);

        var status = await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(TransactionType.Expense, amount, Date, _cash.Id, null, _food.Id, null, null));

        Assert.Equal(HttpStatusCode.BadRequest, status);
    }

    [Fact]
    public async Task Rule_violations_are_rejected_with_400()
    {
        // A date no other test uses, so the final check sees only this test's rows.
        var day = new DateOnly(2031, 1, 1);
        var bodies = new (string Label, CreateTransactionRequest Body)[]
        {
            ("income with an expense category", new(TransactionType.Income, 10m, day, _cash.Id, null, _food.Id, null, null)),
            ("expense with an income category", new(TransactionType.Expense, 10m, day, _cash.Id, null, _pay.Id, null, null)),
            ("expense without a category", new(TransactionType.Expense, 10m, day, _cash.Id, null, null, null, null)),
            ("expense with a destination", new(TransactionType.Expense, 10m, day, _cash.Id, _bank.Id, _food.Id, null, null)),
            ("transfer without a destination", new(TransactionType.Transfer, 10m, day, _cash.Id, null, null, null, null)),
            ("transfer with a category", new(TransactionType.Transfer, 10m, day, _cash.Id, _bank.Id, _food.Id, null, null)),
            ("transfer to the same account", new(TransactionType.Transfer, 10m, day, _cash.Id, _cash.Id, null, null, null)),
            ("missing type", new(null, 10m, day, _cash.Id, null, _food.Id, null, null)),
            ("empty source account id", new(TransactionType.Expense, 10m, day, Guid.Empty, null, _food.Id, null, null)),
            ("description too long", new(TransactionType.Expense, 10m, day, _cash.Id, null, _food.Id, new string('d', 501), null)),
            ("merchant too long", new(TransactionType.Expense, 10m, day, _cash.Id, null, _food.Id, null, new string('m', 201))),
        };

        foreach (var (label, body) in bodies)
        {
            var status = await _user.StatusAsync(HttpMethod.Post, "/api/v1/transactions", body);
            Assert.True(status == HttpStatusCode.BadRequest, $"{label}: expected 400, got {(int)status}");
        }

        // None of the rejected requests created anything.
        Assert.Empty((await _user.ListTransactionsAsync($"accountId={_cash.Id}&from=2031-01-01&to=2031-01-01")).Items);
    }

    [Fact]
    public async Task A_missing_account_or_category_returns_404()
    {
        var unknown = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.NotFound, await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(TransactionType.Expense, 10m, Date, unknown, null, _food.Id, null, null)));
        Assert.Equal(HttpStatusCode.NotFound, await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(TransactionType.Expense, 10m, Date, _cash.Id, null, unknown, null, null)));
        Assert.Equal(HttpStatusCode.NotFound, await _user.StatusAsync(HttpMethod.Get, $"/api/v1/transactions/{unknown}"));
        Assert.Equal(HttpStatusCode.NotFound, await _user.StatusAsync(HttpMethod.Get, $"/api/v1/accounts/{unknown}"));
        Assert.Equal(HttpStatusCode.NotFound, await _user.StatusAsync(HttpMethod.Get, $"/api/v1/categories/{unknown}"));
    }

    [Fact]
    public async Task Subcategory_rules_are_enforced_and_archiving_a_parent_archives_its_children()
    {
        var parent = await _user.CreateCategoryAsync("Sub parent", CategoryType.Expense);
        var child = await _user.CreateCategoryAsync("Sub child", CategoryType.Expense, parent.Id);

        Assert.Equal(HttpStatusCode.BadRequest, await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/categories",
            new CreateCategoryRequest("Wrong type", CategoryType.Income, parent.Id, null, null)));
        Assert.Equal(HttpStatusCode.BadRequest, await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/categories",
            new CreateCategoryRequest("Too deep", CategoryType.Expense, child.Id, null, null)));

        await _user.SendAsync<CategoryResponse>(HttpMethod.Post, $"/api/v1/categories/{parent.Id}/archive", null, HttpStatusCode.OK);

        Assert.True((await _user.GetAsync<CategoryResponse>($"/api/v1/categories/{child.Id}")).IsArchived);
        Assert.Equal(HttpStatusCode.BadRequest, await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(TransactionType.Expense, 1m, Date, _cash.Id, null, child.Id, null, null)));
    }

    // ---- List filters and paging (D036) ----------------------------------------------

    [Fact]
    public async Task Searching_for_a_percent_sign_matches_the_literal_character_only()
    {
        var account = await _user.CreateAccountAsync("Search account", 100m);
        await _user.CreateTransactionAsync(TransactionType.Expense, 1m, Date, account.Id, categoryId: _food.Id, merchant: "Cafe 50%");
        await _user.CreateTransactionAsync(TransactionType.Expense, 2m, Date, account.Id, categoryId: _food.Id, merchant: "Plain shop");
        await _user.CreateTransactionAsync(TransactionType.Expense, 3m, Date, account.Id, categoryId: _food.Id, description: "snake_case note");

        Assert.Equal(1, (await _user.ListTransactionsAsync($"accountId={account.Id}&search=%25")).TotalCount);
        Assert.Equal(1, (await _user.ListTransactionsAsync($"accountId={account.Id}&search=_")).TotalCount);
        Assert.Equal(1, (await _user.ListTransactionsAsync($"accountId={account.Id}&search=CAFE")).TotalCount);
        Assert.Equal(1, (await _user.ListTransactionsAsync($"accountId={account.Id}&search=snake")).TotalCount);
        Assert.Equal(3, (await _user.ListTransactionsAsync($"accountId={account.Id}")).TotalCount);
    }

    [Fact]
    public async Task Filtering_by_a_parent_category_includes_its_subcategories()
    {
        var account = await _user.CreateAccountAsync("Category filter account", 100m);
        var parent = await _user.CreateCategoryAsync("Filter parent", CategoryType.Expense);
        var child = await _user.CreateCategoryAsync("Filter child", CategoryType.Expense, parent.Id);
        var other = await _user.CreateCategoryAsync("Filter other", CategoryType.Expense);

        var inParent = await _user.CreateTransactionAsync(TransactionType.Expense, 1m, Date, account.Id, categoryId: parent.Id);
        var inChild = await _user.CreateTransactionAsync(TransactionType.Expense, 2m, Date, account.Id, categoryId: child.Id);
        var inOther = await _user.CreateTransactionAsync(TransactionType.Expense, 3m, Date, account.Id, categoryId: other.Id);

        var byParent = await _user.ListTransactionsAsync($"accountId={account.Id}&categoryId={parent.Id}");
        var byChild = await _user.ListTransactionsAsync($"accountId={account.Id}&categoryId={child.Id}");

        Assert.Equal(new[] { inParent.Id, inChild.Id }.Order(), byParent.Items.Select(t => t.Id).Order());
        Assert.Equal(inChild.Id, Assert.Single(byChild.Items).Id);
        Assert.DoesNotContain(byParent.Items, t => t.Id == inOther.Id);
    }

    [Fact]
    public async Task Type_date_range_sort_and_paging_work_together()
    {
        var account = await _user.CreateAccountAsync("Paging account", 1000m);
        var amounts = new[] { 10m, 50m, 30m, 20m, 40m };
        for (var i = 0; i < amounts.Length; i++)
        {
            await _user.CreateTransactionAsync(
                TransactionType.Expense, amounts[i], new DateOnly(2025, 8, 1 + i), account.Id, categoryId: _food.Id);
        }

        await _user.CreateTransactionAsync(TransactionType.Income, 999m, new DateOnly(2025, 8, 3), account.Id, categoryId: _pay.Id);
        var scope = $"accountId={account.Id}";

        // Type filter.
        var expenses = await _user.ListTransactionsAsync($"{scope}&type=Expense&pageSize=100");
        Assert.Equal(5, expenses.TotalCount);
        Assert.All(expenses.Items, t => Assert.Equal(TransactionType.Expense, t.Type));

        // Inclusive date range: Aug 2 to Aug 4 holds the 50, 30 and 20 expenses (the income is filtered out by type).
        var range = await _user.ListTransactionsAsync($"{scope}&type=Expense&from=2025-08-02&to=2025-08-04&sort=AmountAsc");
        Assert.Equal(new[] { 20m, 30m, 50m }, range.Items.Select(t => t.Amount).ToArray());

        // Sorting.
        var byAmountDesc = await _user.ListTransactionsAsync($"{scope}&type=Expense&sort=AmountDesc");
        Assert.Equal(new[] { 50m, 40m, 30m, 20m, 10m }, byAmountDesc.Items.Select(t => t.Amount).ToArray());
        var byDateAsc = await _user.ListTransactionsAsync($"{scope}&type=Expense&sort=DateAsc");
        Assert.Equal(new[] { 10m, 50m, 30m, 20m, 40m }, byDateAsc.Items.Select(t => t.Amount).ToArray());
        var defaultSort = await _user.ListTransactionsAsync($"{scope}&type=Expense");
        Assert.Equal(new[] { 40m, 20m, 30m, 50m, 10m }, defaultSort.Items.Select(t => t.Amount).ToArray());

        // Paging: 5 rows, 2 per page.
        var page1 = await _user.ListTransactionsAsync($"{scope}&type=Expense&sort=AmountAsc&pageSize=2&page=1");
        var page3 = await _user.ListTransactionsAsync($"{scope}&type=Expense&sort=AmountAsc&pageSize=2&page=3");
        var page4 = await _user.ListTransactionsAsync($"{scope}&type=Expense&sort=AmountAsc&pageSize=2&page=4");
        Assert.Equal(new[] { 10m, 20m }, page1.Items.Select(t => t.Amount).ToArray());
        Assert.Equal(5, page1.TotalCount);
        Assert.Equal(3, page1.TotalPages);
        Assert.Equal(new[] { 50m }, page3.Items.Select(t => t.Amount).ToArray());
        Assert.Empty(page4.Items);
        Assert.Equal(5, page4.TotalCount);
    }

    [Theory]
    [InlineData("pageSize=0")]
    [InlineData("pageSize=101")]
    [InlineData("page=0")]
    [InlineData("from=2025-02-01&to=2025-01-01")]
    [InlineData("type=Loan")]
    [InlineData("sort=Sideways")]
    public async Task Invalid_list_queries_return_400(string query)
    {
        var status = await _user.StatusAsync(HttpMethod.Get, "/api/v1/transactions?" + query);

        Assert.Equal(HttpStatusCode.BadRequest, status);
    }
}
