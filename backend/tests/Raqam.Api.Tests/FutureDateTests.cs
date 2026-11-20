using System.Net;
using Raqam.Application.Categories;
using Raqam.Application.Transactions;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>D051: a transaction cannot be dated in the future, on create or on edit.</summary>
public class FutureDateTests(ApiFactory factory)
    : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private TestApiClient _user = null!;
    private CategoryResponse _food = null!;

    public async Task InitializeAsync()
    {
        _user = await TestApiClient.CreateAsync(factory, "futuredate");
        _food = await _user.CreateCategoryAsync("Future food", CategoryType.Expense);
    }

    public async Task DisposeAsync() => await _user.DisposeAsync();

    private static DateOnly UtcToday => DateOnly.FromDateTime(DateTime.UtcNow);

    private async Task<(HttpStatusCode Status, string Body)> PostAsync(Guid accountId, DateOnly date)
    {
        using var response = await _user.SendAsync(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(TransactionType.Expense, 10m, date, accountId, null, _food.Id, null, null));
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_date_well_in_the_future_is_refused_and_nothing_is_saved()
    {
        var account = await _user.CreateAccountAsync("Future refuse", 1000m);

        var (status, body) = await PostAsync(account.Id, UtcToday.AddDays(30));

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains("cannot be in the future", body);
        Assert.Empty((await _user.ListTransactionsAsync($"accountId={account.Id}")).Items);
    }

    [Fact]
    public async Task Today_yesterday_and_the_next_UTC_day_are_accepted()
    {
        var account = await _user.CreateAccountAsync("Future allow", 1000m);

        foreach (var offset in new[] { -1, 0, 1 })
        {
            var (status, body) = await PostAsync(account.Id, UtcToday.AddDays(offset));
            Assert.True(status == HttpStatusCode.Created, $"offset {offset}: {(int)status} {body}");
        }
    }

    [Fact]
    public async Task Editing_a_transaction_to_a_future_date_is_refused_and_keeps_the_old_date()
    {
        var account = await _user.CreateAccountAsync("Future edit", 1000m);
        var created = await _user.CreateTransactionAsync(
            TransactionType.Expense, 10m, UtcToday, account.Id, categoryId: _food.Id);

        var status = await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/transactions/{created.Id}",
            new UpdateTransactionRequest(
                TransactionType.Expense, 10m, UtcToday.AddDays(30), account.Id, null, _food.Id, null, null, created.Version));

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var after = (await _user.ListTransactionsAsync($"accountId={account.Id}")).Items.Single();
        Assert.Equal(UtcToday, after.TransactionDate);
    }
}
