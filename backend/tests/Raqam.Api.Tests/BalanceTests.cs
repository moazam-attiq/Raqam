using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Raqam.Application.Accounts;
using Raqam.Application.Transactions;
using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>
/// Balances are computed from the ledger in one SQL query (D006, spec §6.4). These tests
/// check that SQL against the domain's own definition of direction,
/// <see cref="Transaction.SignedEffectOn"/>, over a mixed set of transactions.
/// </summary>
public class BalanceTests(ApiFactory factory)
    : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private TestApiClient _user = null!;

    public async Task InitializeAsync() => _user = await TestApiClient.CreateAsync(factory, "balance");

    public async Task DisposeAsync() => await _user.DisposeAsync();

    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    [Fact]
    public async Task Balance_matches_the_signed_effect_of_every_transaction_at_every_date()
    {
        var cash = await _user.CreateAccountAsync("Mixed cash", 1000m);
        var bank = await _user.CreateAccountAsync("Mixed bank", 5000.50m, AccountType.BankAccount);
        // Opened with enough to cover the 1000 transfer out of it below: no account may go below zero (D049).
        var wallet = await _user.CreateAccountAsync("Mixed wallet", 1000m, AccountType.DigitalWallet);
        var salary = await _user.CreateCategoryAsync("Mixed salary", CategoryType.Income);
        var food = await _user.CreateCategoryAsync("Mixed food", CategoryType.Expense);
        var rent = await _user.CreateCategoryAsync("Mixed rent", CategoryType.Expense);
        var groceries = await _user.CreateCategoryAsync("Mixed groceries", CategoryType.Expense, food.Id);

        await _user.CreateTransactionAsync(TransactionType.Income, 2500m, D(2024, 1, 5), bank.Id, categoryId: salary.Id);
        await _user.CreateTransactionAsync(TransactionType.Expense, 199.99m, D(2024, 1, 6), cash.Id, categoryId: food.Id);
        await _user.CreateTransactionAsync(TransactionType.Expense, 1200m, D(2024, 1, 10), bank.Id, categoryId: rent.Id);
        await _user.CreateTransactionAsync(TransactionType.Transfer, 300m, D(2024, 1, 12), bank.Id, cash.Id);
        await _user.CreateTransactionAsync(TransactionType.Transfer, 50.25m, D(2024, 1, 12), cash.Id, wallet.Id);
        await _user.CreateTransactionAsync(TransactionType.Income, 75m, D(2024, 1, 15), wallet.Id, categoryId: salary.Id);
        await _user.CreateTransactionAsync(TransactionType.Expense, 20.10m, D(2024, 1, 15), wallet.Id, categoryId: groceries.Id);
        await _user.CreateTransactionAsync(TransactionType.Transfer, 1000m, D(2024, 2, 1), wallet.Id, bank.Id);
        await _user.CreateTransactionAsync(TransactionType.Expense, 0.01m, D(2024, 2, 1), cash.Id, categoryId: food.Id);
        await _user.CreateTransactionAsync(TransactionType.Income, 10000m, D(2024, 3, 1), bank.Id, categoryId: salary.Id);
        await _user.CreateTransactionAsync(TransactionType.Transfer, 123.45m, D(2024, 3, 2), bank.Id, wallet.Id);
        await _user.CreateTransactionAsync(TransactionType.Expense, 4m, D(2024, 3, 2), bank.Id, categoryId: groceries.Id);

        var accounts = new[] { cash, bank, wallet };
        var accountIds = accounts.Select(a => a.Id).ToHashSet();

        // Everything the user has, read straight from the database.
        var all = await TestDatabase.WithDbAsync(
            factory, db => db.Transactions.AsNoTracking().Where(t => t.UserId == _user.UserId).ToListAsync());
        var ledger = all.Where(t => accountIds.Contains(t.SourceAccountId)).ToList();
        Assert.Equal(12, ledger.Count);

        var asOfDates = new DateOnly?[]
        {
            null,
            D(2023, 12, 31), // before everything: only the opening balance
            D(2024, 1, 12),  // a day with two transfers: the date is inclusive
            D(2024, 1, 31),
            D(2024, 2, 1),
            D(2024, 12, 31),
        };

        foreach (var account in accounts)
        {
            foreach (var asOf in asOfDates)
            {
                var included = ledger.Where(t => asOf is null || t.TransactionDate <= asOf).ToList();
                var expected = account.OpeningBalance + included.Sum(t => t.SignedEffectOn(account.Id));

                var actual = await _user.GetBalanceAsync(account.Id, asOf);
                var label = $"{account.Name} as of {(asOf is null ? "now" : asOf.Value.ToString("yyyy-MM-dd"))}";

                Assert.True(expected == actual.Balance, $"{label}: expected {expected}, got {actual.Balance}");
                Assert.Equal(account.OpeningBalance, actual.OpeningBalance);
                Assert.Equal(Sum(included, t => t.Type == TransactionType.Income && t.SourceAccountId == account.Id), actual.Income);
                Assert.Equal(Sum(included, t => t.Type == TransactionType.Expense && t.SourceAccountId == account.Id), actual.Expense);
                Assert.Equal(Sum(included, t => t.Type == TransactionType.Transfer && t.DestinationAccountId == account.Id), actual.TransfersIn);
                Assert.Equal(Sum(included, t => t.Type == TransactionType.Transfer && t.SourceAccountId == account.Id), actual.TransfersOut);
                Assert.Equal(account.CurrencyCode, actual.CurrencyCode);
                Assert.Equal(asOf, actual.AsOf);
            }
        }

        // Transfers only move money between these accounts, so across all three the total
        // changes by income minus expense and nothing else.
        var openings = accounts.Sum(a => a.OpeningBalance);
        var income = Sum(ledger, t => t.Type == TransactionType.Income);
        var expense = Sum(ledger, t => t.Type == TransactionType.Expense);
        var balances = 0m;
        foreach (var account in accounts)
        {
            balances += (await _user.GetBalanceAsync(account.Id)).Balance;
        }

        Assert.Equal(openings + income - expense, balances);
    }

    [Fact]
    public async Task Ledger_totals_exclude_transfers()
    {
        // 2001 keeps these rows apart from every other test's dates.
        // Opened with enough to cover the 5000 transfer out of it below (D049).
        var x = await _user.CreateAccountAsync("Totals X", 5000m);
        var y = await _user.CreateAccountAsync("Totals Y", 0m);
        var pay = await _user.CreateCategoryAsync("Totals pay", CategoryType.Income);
        var spend = await _user.CreateCategoryAsync("Totals spend", CategoryType.Expense);

        await _user.CreateTransactionAsync(TransactionType.Income, 300m, D(2001, 1, 11), x.Id, categoryId: pay.Id);
        await _user.CreateTransactionAsync(TransactionType.Expense, 100m, D(2001, 1, 12), x.Id, categoryId: spend.Id);
        await _user.CreateTransactionAsync(TransactionType.Transfer, 5000m, D(2001, 1, 13), x.Id, y.Id);
        await _user.CreateTransactionAsync(TransactionType.Income, 50m, D(2001, 2, 1), x.Id, categoryId: pay.Id);

        using var scope = factory.Services.CreateScope();
        var transactions = scope.ServiceProvider.GetRequiredService<ITransactionRepository>();
        var userId = _user.UserId;

        var january = await transactions.GetTotalsAsync(userId, D(2001, 1, 1), D(2001, 1, 31), x.Id, CancellationToken.None);
        Assert.Equal(300m, january.Income);
        Assert.Equal(100m, january.Expense);
        Assert.Equal(2, january.TransactionCount);

        var wholeYear = await transactions.GetTotalsAsync(userId, D(2001, 1, 1), D(2001, 12, 31), null, CancellationToken.None);
        Assert.Equal(350m, wholeYear.Income);
        Assert.Equal(100m, wholeYear.Expense);
        Assert.Equal(3, wholeYear.TransactionCount);

        // The 5000 transfer is not income for Y, and not expense for X.
        var forY = await transactions.GetTotalsAsync(userId, D(2001, 1, 1), D(2001, 12, 31), y.Id, CancellationToken.None);
        Assert.Equal(0m, forY.Income);
        Assert.Equal(0m, forY.Expense);
        Assert.Equal(0, forY.TransactionCount);

        // Range ends are inclusive.
        var exactDay = await transactions.GetTotalsAsync(userId, D(2001, 1, 12), D(2001, 1, 12), x.Id, CancellationToken.None);
        Assert.Equal(0m, exactDay.Income);
        Assert.Equal(100m, exactDay.Expense);

        var empty = await transactions.GetTotalsAsync(userId, D(1999, 1, 1), D(1999, 12, 31), null, CancellationToken.None);
        Assert.Equal(0m, empty.Income);
        Assert.Equal(0m, empty.Expense);
        Assert.Equal(0, empty.TransactionCount);
    }

    [Fact]
    public async Task Editing_and_deleting_a_transaction_changes_the_balance_straight_away()
    {
        var first = await _user.CreateAccountAsync("Edit first", 100m);
        var second = await _user.CreateAccountAsync("Edit second", 0m);
        var spend = await _user.CreateCategoryAsync("Edit spend", CategoryType.Expense);
        var pay = await _user.CreateCategoryAsync("Edit pay", CategoryType.Income);
        var date = D(2025, 5, 1);

        var tx = await _user.CreateTransactionAsync(TransactionType.Expense, 30m, date, first.Id, categoryId: spend.Id);
        await AssertBalancesAsync(first, 70m, second, 0m);

        // Expense becomes a transfer: the money now arrives in the second account.
        tx = await UpdateAsync(tx, new UpdateTransactionRequest(
            TransactionType.Transfer, 30m, date, first.Id, second.Id, null, null, null, tx.Version));
        await AssertBalancesAsync(first, 70m, second, 30m);

        // Transfer becomes income on the first account.
        tx = await UpdateAsync(tx, new UpdateTransactionRequest(
            TransactionType.Income, 30m, date, first.Id, null, pay.Id, null, null, tx.Version));
        await AssertBalancesAsync(first, 130m, second, 0m);

        // A new amount.
        tx = await UpdateAsync(tx, new UpdateTransactionRequest(
            TransactionType.Income, 45.5m, date, first.Id, null, pay.Id, null, null, tx.Version));
        await AssertBalancesAsync(first, 145.5m, second, 0m);

        // Moving it to the other account.
        tx = await UpdateAsync(tx, new UpdateTransactionRequest(
            TransactionType.Income, 45.5m, date, second.Id, null, pay.Id, null, null, tx.Version));
        await AssertBalancesAsync(first, 100m, second, 45.5m);

        Assert.Equal(HttpStatusCode.NoContent, await _user.StatusAsync(HttpMethod.Delete, $"/api/v1/transactions/{tx.Id}"));
        await AssertBalancesAsync(first, 100m, second, 0m);
        Assert.Equal(HttpStatusCode.NotFound, await _user.StatusAsync(HttpMethod.Get, $"/api/v1/transactions/{tx.Id}"));
    }

    [Fact]
    public async Task An_archived_account_keeps_its_history_in_the_balance_but_takes_no_new_transactions()
    {
        var account = await _user.CreateAccountAsync("Archive me", 10m);
        var pay = await _user.CreateCategoryAsync("Archive pay", CategoryType.Income);
        await _user.CreateTransactionAsync(TransactionType.Income, 5m, D(2025, 6, 1), account.Id, categoryId: pay.Id);

        var archived = await _user.SendAsync<AccountResponse>(
            HttpMethod.Post, $"/api/v1/accounts/{account.Id}/archive", null, HttpStatusCode.OK);
        Assert.True(archived.IsArchived);

        Assert.Equal(15m, (await _user.GetBalanceAsync(account.Id)).Balance);
        Assert.Single((await _user.ListTransactionsAsync($"accountId={account.Id}")).Items);

        var refused = await _user.StatusAsync(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(TransactionType.Income, 1m, D(2025, 6, 2), account.Id, null, pay.Id, null, null));
        Assert.Equal(HttpStatusCode.BadRequest, refused);
        Assert.Equal(15m, (await _user.GetBalanceAsync(account.Id)).Balance);
    }

    [Fact]
    public async Task A_transfer_shows_once_in_each_accounts_history_and_nets_to_zero()
    {
        var from = await _user.CreateAccountAsync("History from", 500m);
        var to = await _user.CreateAccountAsync("History to", 0m);
        var transfer = await _user.CreateTransactionAsync(TransactionType.Transfer, 120m, D(2025, 7, 1), from.Id, to.Id);

        var fromHistory = await _user.GetAsync<Raqam.Application.Common.PagedResult<TransactionResponse>>(
            $"/api/v1/accounts/{from.Id}/transactions");
        var toHistory = await _user.GetAsync<Raqam.Application.Common.PagedResult<TransactionResponse>>(
            $"/api/v1/accounts/{to.Id}/transactions");

        Assert.Equal(transfer.Id, Assert.Single(fromHistory.Items).Id);
        Assert.Equal(transfer.Id, Assert.Single(toHistory.Items).Id);
        Assert.Equal(380m, (await _user.GetBalanceAsync(from.Id)).Balance);
        Assert.Equal(120m, (await _user.GetBalanceAsync(to.Id)).Balance);
    }

    private async Task AssertBalancesAsync(AccountResponse first, decimal firstExpected, AccountResponse second, decimal secondExpected)
    {
        Assert.Equal(firstExpected, (await _user.GetBalanceAsync(first.Id)).Balance);
        Assert.Equal(secondExpected, (await _user.GetBalanceAsync(second.Id)).Balance);
    }

    private Task<TransactionResponse> UpdateAsync(TransactionResponse current, UpdateTransactionRequest request) =>
        _user.SendAsync<TransactionResponse>(HttpMethod.Put, $"/api/v1/transactions/{current.Id}", request, HttpStatusCode.OK);

    private static decimal Sum(IEnumerable<Transaction> transactions, Func<Transaction, bool> filter) =>
        transactions.Where(filter).Sum(t => t.Amount);
}
