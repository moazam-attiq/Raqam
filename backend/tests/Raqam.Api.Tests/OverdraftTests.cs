using System.Net;
using Raqam.Application.Accounts;
using Raqam.Application.Categories;
using Raqam.Application.Transactions;
using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>
/// D049: an account's balance never goes below zero. Every way a balance can drop is covered:
/// a new expense or transfer, an edit that raises one or moves it to a poorer account, deleting
/// income or an incoming transfer that was already spent, and lowering the opening balance.
/// Landing exactly on zero is allowed. A refused change must leave everything as it was.
/// </summary>
public class OverdraftTests(ApiFactory factory)
    : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private static readonly DateOnly Date = new(2025, 9, 1);

    private TestApiClient _user = null!;
    private CategoryResponse _food = null!;
    private CategoryResponse _pay = null!;

    public async Task InitializeAsync()
    {
        _user = await TestApiClient.CreateAsync(factory, "overdraft");
        _food = await _user.CreateCategoryAsync("Overdraft food", CategoryType.Expense);
        _pay = await _user.CreateCategoryAsync("Overdraft pay", CategoryType.Income);
    }

    public async Task DisposeAsync() => await _user.DisposeAsync();

    private async Task<decimal> BalanceAsync(AccountResponse account) =>
        (await _user.GetBalanceAsync(account.Id)).Balance;

    private async Task<(HttpStatusCode Status, string Body)> PostAsync(CreateTransactionRequest request)
    {
        using var response = await _user.SendAsync(HttpMethod.Post, "/api/v1/transactions", request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private Task<(HttpStatusCode Status, string Body)> SpendAsync(AccountResponse account, decimal amount) =>
        PostAsync(new CreateTransactionRequest(TransactionType.Expense, amount, Date, account.Id, null, _food.Id, null, null));

    private Task<(HttpStatusCode Status, string Body)> TransferAsync(AccountResponse from, AccountResponse to, decimal amount) =>
        PostAsync(new CreateTransactionRequest(TransactionType.Transfer, amount, Date, from.Id, to.Id, null, null, null));

    private async Task<HttpStatusCode> PutAsync(TransactionResponse current, TransactionType type, decimal amount, Guid source, Guid? destination = null)
    {
        Guid? category = type == TransactionType.Expense ? _food.Id : type == TransactionType.Income ? _pay.Id : null;
        return await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/transactions/{current.Id}",
            new UpdateTransactionRequest(type, amount, Date, source, destination, category, null, null, current.Version));
    }

    private Task<HttpStatusCode> DeleteAsync(TransactionResponse transaction) =>
        _user.StatusAsync(HttpMethod.Delete, $"/api/v1/transactions/{transaction.Id}");

    // ---- New transactions --------------------------------------------------------------

    [Fact]
    public async Task An_expense_larger_than_the_balance_is_refused_and_says_what_is_available()
    {
        var account = await _user.CreateAccountAsync("Refuse expense", 1000m);

        var (status, body) = await SpendAsync(account, 1000.01m);

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains("Refuse expense has Rs 1,000.00 available", body);
        Assert.Equal(1000m, await BalanceAsync(account));
        Assert.Empty((await _user.ListTransactionsAsync($"accountId={account.Id}")).Items);
    }

    [Fact]
    public async Task Spending_exactly_the_balance_is_allowed_and_leaves_zero_but_not_a_cent_more()
    {
        var account = await _user.CreateAccountAsync("Spend all", 1000m);

        Assert.Equal(HttpStatusCode.Created, (await SpendAsync(account, 1000m)).Status);
        Assert.Equal(0m, await BalanceAsync(account));

        var (status, body) = await SpendAsync(account, 0.01m);
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains("has Rs 0.00 available", body);
        Assert.Equal(0m, await BalanceAsync(account));
    }

    [Fact]
    public async Task A_transfer_larger_than_the_source_balance_is_refused_and_moves_nothing()
    {
        var from = await _user.CreateAccountAsync("Transfer from", 1000m);
        var to = await _user.CreateAccountAsync("Transfer to", 0m);

        var (status, body) = await TransferAsync(from, to, 1001m);

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains("Transfer from has Rs 1,000.00 available", body);
        Assert.Equal(1000m, await BalanceAsync(from));
        Assert.Equal(0m, await BalanceAsync(to));

        // The whole balance can move.
        Assert.Equal(HttpStatusCode.Created, (await TransferAsync(from, to, 1000m)).Status);
        Assert.Equal(0m, await BalanceAsync(from));
        Assert.Equal(1000m, await BalanceAsync(to));
    }

    [Fact]
    public async Task Income_and_incoming_transfers_make_more_available()
    {
        var account = await _user.CreateAccountAsync("Earn then spend", 0m);
        var other = await _user.CreateAccountAsync("Earn other", 200m);

        Assert.Equal(HttpStatusCode.BadRequest, (await SpendAsync(account, 1m)).Status);

        await _user.CreateTransactionAsync(TransactionType.Income, 500m, Date, account.Id, categoryId: _pay.Id);
        await _user.CreateTransactionAsync(TransactionType.Transfer, 200m, Date, other.Id, account.Id);

        Assert.Equal(HttpStatusCode.Created, (await SpendAsync(account, 700m)).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await SpendAsync(account, 0.01m)).Status);
    }

    [Fact]
    public async Task Income_is_never_refused_however_low_the_balance()
    {
        var account = await _user.CreateAccountAsync("Income always", 0m);

        var created = await _user.CreateTransactionAsync(TransactionType.Income, 1m, Date, account.Id, categoryId: _pay.Id);

        Assert.Equal(1m, await BalanceAsync(account));
        Assert.Equal(TransactionType.Income, created.Type);
    }

    // ---- Editing ----------------------------------------------------------------------

    [Fact]
    public async Task Raising_an_expense_beyond_the_balance_is_refused_but_up_to_it_is_fine()
    {
        var account = await _user.CreateAccountAsync("Raise expense", 100m);
        var expense = await _user.CreateTransactionAsync(TransactionType.Expense, 60m, Date, account.Id, categoryId: _food.Id);

        Assert.Equal(HttpStatusCode.BadRequest, await PutAsync(expense, TransactionType.Expense, 101m, account.Id));
        Assert.Equal(40m, await BalanceAsync(account));

        Assert.Equal(HttpStatusCode.OK, await PutAsync(expense, TransactionType.Expense, 100m, account.Id));
        Assert.Equal(0m, await BalanceAsync(account));
    }

    [Fact]
    public async Task Lowering_an_expense_or_changing_its_details_is_always_allowed()
    {
        var account = await _user.CreateAccountAsync("Lower expense", 100m);
        var expense = await _user.CreateTransactionAsync(TransactionType.Expense, 100m, Date, account.Id, categoryId: _food.Id);
        Assert.Equal(0m, await BalanceAsync(account));

        // Same amount (balance stays at zero) and a smaller one both go through.
        Assert.Equal(HttpStatusCode.OK, await PutAsync(expense, TransactionType.Expense, 100m, account.Id));
        var refreshed = await _user.GetAsync<TransactionResponse>($"/api/v1/transactions/{expense.Id}");
        Assert.Equal(HttpStatusCode.OK, await PutAsync(refreshed, TransactionType.Expense, 40m, account.Id));
        Assert.Equal(60m, await BalanceAsync(account));
    }

    [Fact]
    public async Task Moving_an_expense_to_an_account_that_cannot_cover_it_is_refused()
    {
        var rich = await _user.CreateAccountAsync("Move rich", 1000m);
        var poor = await _user.CreateAccountAsync("Move poor", 10m);
        var expense = await _user.CreateTransactionAsync(TransactionType.Expense, 50m, Date, rich.Id, categoryId: _food.Id);

        Assert.Equal(HttpStatusCode.BadRequest, await PutAsync(expense, TransactionType.Expense, 50m, poor.Id));

        Assert.Equal(950m, await BalanceAsync(rich));
        Assert.Equal(10m, await BalanceAsync(poor));
    }

    [Fact]
    public async Task Turning_income_into_an_expense_or_transfer_is_checked_against_the_balance()
    {
        var account = await _user.CreateAccountAsync("Retype", 0m);
        var other = await _user.CreateAccountAsync("Retype other", 0m);
        var income = await _user.CreateTransactionAsync(TransactionType.Income, 100m, Date, account.Id, categoryId: _pay.Id);

        // Income of 100 becoming an expense of 100 would take the account to minus 100.
        Assert.Equal(HttpStatusCode.BadRequest, await PutAsync(income, TransactionType.Expense, 100m, account.Id));
        Assert.Equal(HttpStatusCode.BadRequest, await PutAsync(income, TransactionType.Transfer, 100m, account.Id, other.Id));
        Assert.Equal(100m, await BalanceAsync(account));
        Assert.Equal(0m, await BalanceAsync(other));
    }

    [Fact]
    public async Task Lowering_income_below_what_was_spent_is_refused()
    {
        var account = await _user.CreateAccountAsync("Lower income", 0m);
        var income = await _user.CreateTransactionAsync(TransactionType.Income, 500m, Date, account.Id, categoryId: _pay.Id);
        await _user.CreateTransactionAsync(TransactionType.Expense, 300m, Date, account.Id, categoryId: _food.Id);

        Assert.Equal(HttpStatusCode.BadRequest, await PutAsync(income, TransactionType.Income, 299m, account.Id));
        Assert.Equal(200m, await BalanceAsync(account));

        Assert.Equal(HttpStatusCode.OK, await PutAsync(income, TransactionType.Income, 300m, account.Id));
        Assert.Equal(0m, await BalanceAsync(account));
    }

    // ---- Deleting ---------------------------------------------------------------------

    [Fact]
    public async Task Deleting_income_that_was_already_spent_is_refused_until_the_spending_is_gone()
    {
        var account = await _user.CreateAccountAsync("Delete income", 0m);
        var income = await _user.CreateTransactionAsync(TransactionType.Income, 500m, Date, account.Id, categoryId: _pay.Id);
        var expense = await _user.CreateTransactionAsync(TransactionType.Expense, 300m, Date, account.Id, categoryId: _food.Id);

        Assert.Equal(HttpStatusCode.BadRequest, await DeleteAsync(income));
        Assert.Equal(200m, await BalanceAsync(account));
        Assert.Equal(HttpStatusCode.OK, await _user.StatusAsync(HttpMethod.Get, $"/api/v1/transactions/{income.Id}"));

        Assert.Equal(HttpStatusCode.NoContent, await DeleteAsync(expense));
        Assert.Equal(HttpStatusCode.NoContent, await DeleteAsync(income));
        Assert.Equal(0m, await BalanceAsync(account));
    }

    [Fact]
    public async Task Deleting_a_transfer_is_refused_when_the_receiving_account_already_spent_the_money()
    {
        var from = await _user.CreateAccountAsync("Delete transfer from", 100m);
        var to = await _user.CreateAccountAsync("Delete transfer to", 0m);
        var transfer = await _user.CreateTransactionAsync(TransactionType.Transfer, 100m, Date, from.Id, to.Id);
        var spent = await _user.CreateTransactionAsync(TransactionType.Expense, 100m, Date, to.Id, categoryId: _food.Id);

        Assert.Equal(HttpStatusCode.BadRequest, await DeleteAsync(transfer));
        Assert.Equal(0m, await BalanceAsync(from));
        Assert.Equal(0m, await BalanceAsync(to));

        Assert.Equal(HttpStatusCode.NoContent, await DeleteAsync(spent));
        Assert.Equal(HttpStatusCode.NoContent, await DeleteAsync(transfer));
        Assert.Equal(100m, await BalanceAsync(from));
    }

    [Fact]
    public async Task Deleting_an_expense_is_always_allowed()
    {
        var account = await _user.CreateAccountAsync("Delete expense", 100m);
        var expense = await _user.CreateTransactionAsync(TransactionType.Expense, 100m, Date, account.Id, categoryId: _food.Id);

        Assert.Equal(HttpStatusCode.NoContent, await DeleteAsync(expense));
        Assert.Equal(100m, await BalanceAsync(account));
    }

    // ---- Opening balance --------------------------------------------------------------

    [Fact]
    public async Task A_negative_opening_balance_is_refused_on_create_and_on_update()
    {
        Assert.Equal(HttpStatusCode.BadRequest, await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/accounts", new CreateAccountRequest("Negative open", AccountType.Cash, -1m, null)));

        var account = await _user.CreateAccountAsync("Negative edit", 10m);
        Assert.Equal(HttpStatusCode.BadRequest, await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/accounts/{account.Id}",
            new UpdateAccountRequest("Negative edit", AccountType.Cash, -0.01m, null, account.Version)));

        Assert.Equal(10m, (await _user.GetAsync<AccountResponse>($"/api/v1/accounts/{account.Id}")).OpeningBalance);
    }

    [Fact]
    public async Task Lowering_the_opening_balance_below_what_was_spent_is_refused()
    {
        var account = await _user.CreateAccountAsync("Lower opening", 1000m);
        await _user.CreateTransactionAsync(TransactionType.Expense, 600m, Date, account.Id, categoryId: _food.Id);

        var tooLow = await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/accounts/{account.Id}",
            new UpdateAccountRequest("Lower opening", AccountType.Cash, 599.99m, null, account.Version));
        Assert.Equal(HttpStatusCode.BadRequest, tooLow);
        Assert.Equal(400m, await BalanceAsync(account));

        // Down to exactly what was spent is fine: the balance becomes zero. Raising it is fine too.
        var current = await _user.GetAsync<AccountResponse>($"/api/v1/accounts/{account.Id}");
        var exact = await _user.SendAsync<AccountResponse>(
            HttpMethod.Put, $"/api/v1/accounts/{account.Id}",
            new UpdateAccountRequest("Lower opening", AccountType.Cash, 600m, null, current.Version), HttpStatusCode.OK);
        Assert.Equal(0m, await BalanceAsync(account));

        await _user.SendAsync<AccountResponse>(
            HttpMethod.Put, $"/api/v1/accounts/{account.Id}",
            new UpdateAccountRequest("Lower opening", AccountType.Cash, 5000m, null, exact.Version), HttpStatusCode.OK);
        Assert.Equal(4400m, await BalanceAsync(account));
    }

    // ---- Simultaneous requests ---------------------------------------------------------

    [Fact]
    public async Task Two_simultaneous_expenses_cannot_both_overdraw_the_account()
    {
        var account = await _user.CreateAccountAsync("Race account", 1000m);

        var results = await Task.WhenAll(SpendAsync(account, 600m), SpendAsync(account, 600m));

        // Whichever got there first is saved. The other is refused, either because it saw the
        // lower balance (400) or because the account changed under it (409, safe to retry).
        Assert.Single(results, r => r.Status == HttpStatusCode.Created);
        Assert.All(
            results.Where(r => r.Status != HttpStatusCode.Created),
            r => Assert.True(r.Status is HttpStatusCode.BadRequest or HttpStatusCode.Conflict, $"got {(int)r.Status}: {r.Body}"));
        Assert.Equal(400m, await BalanceAsync(account));
    }
}
