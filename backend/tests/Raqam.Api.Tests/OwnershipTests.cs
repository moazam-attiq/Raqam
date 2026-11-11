using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Raqam.Application.Accounts;
using Raqam.Application.Categories;
using Raqam.Application.Transactions;
using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>
/// Business rules 4 and 5, D026: every record belongs to one user, and another user's
/// record is "not found" (404), never "forbidden", so its existence is not revealed.
/// Alice owns the data; Bob tries everything against it.
/// </summary>
public class OwnershipTests(ApiFactory factory)
    : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private static readonly DateOnly Date = new(2025, 3, 10);

    private TestApiClient _alice = null!;
    private TestApiClient _bob = null!;

    public async Task InitializeAsync()
    {
        _alice = await TestApiClient.CreateAsync(factory, "alice");
        _bob = await TestApiClient.CreateAsync(factory, "bob");
    }

    public async Task DisposeAsync()
    {
        await _alice.DisposeAsync();
        await _bob.DisposeAsync();
    }

    [Fact]
    public async Task Another_users_account_is_not_found_for_every_operation()
    {
        var account = await _alice.CreateAccountAsync("Alice cash", 100m);
        var id = account.Id;

        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(HttpMethod.Get, $"/api/v1/accounts/{id}"));
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(
            HttpMethod.Put, $"/api/v1/accounts/{id}",
            new UpdateAccountRequest("Hijacked", AccountType.Cash, 0m, null, account.Version)));
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(HttpMethod.Post, $"/api/v1/accounts/{id}/archive"));
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(HttpMethod.Get, $"/api/v1/accounts/{id}/balance"));
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(HttpMethod.Get, $"/api/v1/accounts/{id}/transactions"));

        // Alice's account is untouched by Bob's attempts.
        var unchanged = await _alice.GetAsync<AccountResponse>($"/api/v1/accounts/{id}");
        Assert.Equal("Alice cash", unchanged.Name);
        Assert.False(unchanged.IsArchived);
        Assert.Equal(account.Version, unchanged.Version);
    }

    [Fact]
    public async Task Another_users_category_is_not_found_for_every_operation()
    {
        var category = await _alice.CreateCategoryAsync("Alice food", CategoryType.Expense);
        var id = category.Id;

        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(HttpMethod.Get, $"/api/v1/categories/{id}"));
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(
            HttpMethod.Put, $"/api/v1/categories/{id}",
            new UpdateCategoryRequest("Hijacked", null, null, category.Version)));
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(HttpMethod.Post, $"/api/v1/categories/{id}/archive"));

        // Bob cannot hang his own subcategory under Alice's category either.
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(
            HttpMethod.Post, "/api/v1/categories",
            new CreateCategoryRequest("Sneaky", CategoryType.Expense, id, null, null)));

        var unchanged = await _alice.GetAsync<CategoryResponse>($"/api/v1/categories/{id}");
        Assert.Equal("Alice food", unchanged.Name);
        Assert.False(unchanged.IsArchived);
    }

    [Fact]
    public async Task Another_users_transaction_is_not_found_for_every_operation()
    {
        var account = await _alice.CreateAccountAsync("Alice wallet", 0m);
        var category = await _alice.CreateCategoryAsync("Alice pay", CategoryType.Income);
        var transaction = await _alice.CreateTransactionAsync(
            TransactionType.Income, 500m, Date, account.Id, categoryId: category.Id, description: "private");
        var id = transaction.Id;

        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(HttpMethod.Get, $"/api/v1/transactions/{id}"));
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(
            HttpMethod.Put, $"/api/v1/transactions/{id}",
            new UpdateTransactionRequest(
                TransactionType.Income, 1m, Date, account.Id, null, category.Id, "x", null, transaction.Version)));
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(HttpMethod.Delete, $"/api/v1/transactions/{id}"));

        // Still there, unchanged, and still counted in Alice's balance.
        var unchanged = await _alice.GetAsync<TransactionResponse>($"/api/v1/transactions/{id}");
        Assert.Equal(500m, unchanged.Amount);
        Assert.Equal("private", unchanged.Description);
        Assert.Equal(500m, (await _alice.GetBalanceAsync(account.Id)).Balance);
    }

    [Fact]
    public async Task A_transaction_cannot_reference_another_users_account_or_category()
    {
        var aliceAccount = await _alice.CreateAccountAsync("Alice only", 0m);
        var aliceCategory = await _alice.CreateCategoryAsync("Alice only cat", CategoryType.Expense);
        var bobAccount = await _bob.CreateAccountAsync("Bob cash", 0m);
        var bobAccount2 = await _bob.CreateAccountAsync("Bob bank", 0m);
        var bobCategory = await _bob.CreateCategoryAsync("Bob food", CategoryType.Expense);

        // Alice's account as the source.
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(TransactionType.Expense, 10m, Date, aliceAccount.Id, null, bobCategory.Id, null, null)));

        // Alice's account as a transfer destination.
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(TransactionType.Transfer, 10m, Date, bobAccount.Id, aliceAccount.Id, null, null, null)));

        // Alice's category on Bob's own account.
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(TransactionType.Expense, 10m, Date, bobAccount.Id, null, aliceCategory.Id, null, null)));

        // Moving one of Bob's own transactions onto Alice's account is refused the same way.
        var own = await _bob.CreateTransactionAsync(TransactionType.Expense, 5m, Date, bobAccount.Id, categoryId: bobCategory.Id);
        Assert.Equal(HttpStatusCode.NotFound, await _bob.StatusAsync(
            HttpMethod.Put, $"/api/v1/transactions/{own.Id}",
            new UpdateTransactionRequest(
                TransactionType.Expense, 5m, Date, aliceAccount.Id, null, bobCategory.Id, null, null, own.Version)));

        // Nothing leaked onto Alice's side.
        Assert.Empty((await _alice.ListTransactionsAsync($"accountId={aliceAccount.Id}")).Items);
        Assert.Equal(0m, (await _alice.GetBalanceAsync(aliceAccount.Id)).Balance);

        // Bob's own accounts work as normal.
        var ok = await _bob.CreateTransactionAsync(TransactionType.Transfer, 10m, Date, bobAccount.Id, bobAccount2.Id);
        Assert.Equal(TransactionType.Transfer, ok.Type);
    }

    [Fact]
    public async Task Lists_and_filters_never_include_another_users_records()
    {
        var aliceAccount = await _alice.CreateAccountAsync("Alice list account", 0m);
        var aliceCategory = await _alice.CreateCategoryAsync("Alice list category", CategoryType.Expense);
        var aliceTransaction = await _alice.CreateTransactionAsync(
            TransactionType.Expense, 20m, Date, aliceAccount.Id, categoryId: aliceCategory.Id, description: "alice list");

        var bobAccounts = await _bob.GetAsync<List<AccountResponse>>("/api/v1/accounts?includeArchived=true");
        var bobCategories = await _bob.GetAsync<List<CategoryResponse>>("/api/v1/categories?includeArchived=true");
        var bobTransactions = await _bob.ListTransactionsAsync("pageSize=100");

        Assert.DoesNotContain(bobAccounts, a => a.Id == aliceAccount.Id);
        Assert.DoesNotContain(bobCategories, c => c.Id == aliceCategory.Id);
        Assert.DoesNotContain(bobTransactions.Items, t => t.Id == aliceTransaction.Id);

        // Filtering by Alice's ids from Bob's session finds nothing rather than her data.
        var byAccount = await _bob.ListTransactionsAsync($"accountId={aliceAccount.Id}");
        var byCategory = await _bob.ListTransactionsAsync($"categoryId={aliceCategory.Id}");
        var bySearch = await _bob.ListTransactionsAsync("search=alice%20list");
        Assert.Empty(byAccount.Items);
        Assert.Empty(byCategory.Items);
        Assert.Empty(bySearch.Items);
    }

    [Fact]
    public async Task A_user_id_in_the_payload_is_ignored()
    {
        // Business rule 5: the owner always comes from the signed-in session. Bob names
        // Alice as the owner in every body; the records still become Bob's.
        var account = await _bob.SendAsync<AccountResponse>(
            HttpMethod.Post, "/api/v1/accounts",
            new { name = "Claimed for Alice", accountType = "Cash", openingBalance = 1m, userId = _alice.UserId },
            HttpStatusCode.Created);

        var category = await _bob.SendAsync<CategoryResponse>(
            HttpMethod.Post, "/api/v1/categories",
            new { name = "Claimed category", type = "Expense", userId = _alice.UserId },
            HttpStatusCode.Created);

        var transaction = await _bob.SendAsync<TransactionResponse>(
            HttpMethod.Post, "/api/v1/transactions",
            new
            {
                type = "Expense",
                amount = 5m,
                transactionDate = "2025-03-10",
                sourceAccountId = account.Id,
                categoryId = category.Id,
                userId = _alice.UserId,
            },
            HttpStatusCode.Created);

        var aliceAccounts = await _alice.GetAsync<List<AccountResponse>>("/api/v1/accounts?includeArchived=true");
        var aliceCategories = await _alice.GetAsync<List<CategoryResponse>>("/api/v1/categories?includeArchived=true");
        Assert.DoesNotContain(aliceAccounts, a => a.Id == account.Id);
        Assert.DoesNotContain(aliceCategories, c => c.Id == category.Id);
        Assert.Equal(HttpStatusCode.NotFound, await _alice.StatusAsync(HttpMethod.Get, $"/api/v1/transactions/{transaction.Id}"));

        // They are Bob's, and the owner stored in the database says so.
        Assert.Equal(HttpStatusCode.OK, await _bob.StatusAsync(HttpMethod.Get, $"/api/v1/transactions/{transaction.Id}"));
        var owners = await TestDatabase.WithDbAsync(factory, async db => new[]
        {
            await db.Accounts.Where(a => a.Id == account.Id).Select(a => a.UserId).SingleAsync(),
            await db.Categories.Where(c => c.Id == category.Id).Select(c => c.UserId).SingleAsync(),
            await db.Transactions.Where(t => t.Id == transaction.Id).Select(t => t.UserId).SingleAsync(),
        });
        Assert.All(owners, owner => Assert.Equal(_bob.UserId, owner));
    }
}
