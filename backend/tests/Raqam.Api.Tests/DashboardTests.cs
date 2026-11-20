using System.Net;
using Raqam.Application.Accounts;
using Raqam.Application.Categories;
using Raqam.Application.Dashboard;
using Raqam.Application.Transactions;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>
/// M5 dashboard figures (D054): the period and the one before it, expenses by top-level category,
/// the monthly comparison, transfers never counted, owner scoping, and agreement with the
/// transaction list. September 2025 is used throughout so no date is in the future.
/// </summary>
public class DashboardTests(ApiFactory factory)
    : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private TestApiClient _user = null!;
    private AccountResponse _cash = null!;
    private AccountResponse _bank = null!;
    private CategoryResponse _food = null!;
    private CategoryResponse _groceries = null!;
    private CategoryResponse _transport = null!;
    private CategoryResponse _salary = null!;

    public async Task InitializeAsync()
    {
        _user = await TestApiClient.CreateAsync(factory, "dashboard");
        _cash = await _user.CreateAccountAsync("Dash cash", 1_000_000m);
        _bank = await _user.CreateAccountAsync("Dash bank", 0m);
        _food = await _user.CreateCategoryAsync("Dash food", CategoryType.Expense);
        _groceries = await _user.CreateCategoryAsync("Dash groceries", CategoryType.Expense, _food.Id);
        _transport = await _user.CreateCategoryAsync("Dash transport", CategoryType.Expense);
        _salary = await _user.CreateCategoryAsync("Dash salary", CategoryType.Income);
    }

    public async Task DisposeAsync() => await _user.DisposeAsync();

    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    private static string Url(DateOnly from, DateOnly to) => $"/api/v1/dashboard/summary?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}";

    private Task<DashboardSummaryResponse> SummaryAsync(DateOnly from, DateOnly to) =>
        _user.GetAsync<DashboardSummaryResponse>(Url(from, to));

    private Task<TransactionResponse> SpendAsync(CategoryResponse category, decimal amount, DateOnly date) =>
        _user.CreateTransactionAsync(TransactionType.Expense, amount, date, _cash.Id, categoryId: category.Id);

    private Task<TransactionResponse> EarnAsync(decimal amount, DateOnly date) =>
        _user.CreateTransactionAsync(TransactionType.Income, amount, date, _cash.Id, categoryId: _salary.Id);

    [Fact]
    public async Task Summary_totals_the_period_and_the_same_number_of_days_before_it()
    {
        // September is 30 days, so the previous period is 2 to 31 August.
        await EarnAsync(5000m, D(2025, 9, 5));
        await SpendAsync(_food, 200m, D(2025, 9, 10));
        await SpendAsync(_transport, 300m, D(2025, 9, 20));
        await _user.CreateTransactionAsync(TransactionType.Transfer, 9999m, D(2025, 9, 15), _cash.Id, _bank.Id);

        await SpendAsync(_food, 100m, D(2025, 8, 2));
        await SpendAsync(_food, 777m, D(2025, 8, 1));   // the day before the previous period
        await SpendAsync(_food, 55m, D(2025, 10, 1));   // the day after the period

        var summary = await SummaryAsync(D(2025, 9, 1), D(2025, 9, 30));

        Assert.Equal(D(2025, 9, 1), summary.Current.From);
        Assert.Equal(D(2025, 9, 30), summary.Current.To);
        Assert.Equal(5000m, summary.Current.Income);
        Assert.Equal(500m, summary.Current.Expense);
        Assert.Equal(4500m, summary.Current.Net);
        Assert.Equal(3, summary.Current.TransactionCount);

        Assert.Equal(D(2025, 8, 2), summary.Previous.From);
        Assert.Equal(D(2025, 8, 31), summary.Previous.To);
        Assert.Equal(0m, summary.Previous.Income);
        Assert.Equal(100m, summary.Previous.Expense);
        Assert.Equal(-100m, summary.Previous.Net);
        Assert.Equal(1, summary.Previous.TransactionCount);
    }

    [Fact]
    public async Task A_single_day_is_compared_with_the_day_before()
    {
        await SpendAsync(_food, 40m, D(2025, 9, 10));
        await SpendAsync(_food, 15m, D(2025, 9, 9));

        var summary = await SummaryAsync(D(2025, 9, 10), D(2025, 9, 10));

        Assert.Equal(40m, summary.Current.Expense);
        Assert.Equal(D(2025, 9, 9), summary.Previous.From);
        Assert.Equal(D(2025, 9, 9), summary.Previous.To);
        Assert.Equal(15m, summary.Previous.Expense);
    }

    [Fact]
    public async Task Expenses_are_grouped_by_top_level_category_largest_first()
    {
        await SpendAsync(_food, 100m, D(2025, 9, 3));
        await SpendAsync(_groceries, 200m, D(2025, 9, 4));   // counts toward Food
        await SpendAsync(_transport, 150m, D(2025, 9, 5));
        await EarnAsync(9000m, D(2025, 9, 6));               // income is never in the breakdown

        var summary = await SummaryAsync(D(2025, 9, 1), D(2025, 9, 30));

        Assert.Equal(new[] { "Dash food", "Dash transport" }, summary.ExpenseByCategory.Select(c => c.Name).ToArray());
        Assert.Equal(new[] { _food.Id, _transport.Id }, summary.ExpenseByCategory.Select(c => c.CategoryId).ToArray());
        Assert.Equal(new[] { 300m, 150m }, summary.ExpenseByCategory.Select(c => c.Amount).ToArray());
        Assert.Equal(new[] { 66.66m, 33.33m }, summary.ExpenseByCategory.Select(c => c.PercentOfExpense).ToArray());
        Assert.Equal(summary.Current.Expense, summary.ExpenseByCategory.Sum(c => c.Amount));
    }

    [Fact]
    public async Task An_archived_category_still_counts_as_spending()
    {
        await SpendAsync(_transport, 80m, D(2025, 9, 5));
        await _user.SendAsync<CategoryResponse>(
            HttpMethod.Post, $"/api/v1/categories/{_transport.Id}/archive", null, HttpStatusCode.OK);

        var summary = await SummaryAsync(D(2025, 9, 1), D(2025, 9, 30));

        Assert.Equal(80m, summary.Current.Expense);
        var row = Assert.Single(summary.ExpenseByCategory);
        Assert.Equal("Dash transport", row.Name);
        Assert.Equal(100m, row.PercentOfExpense);
    }

    [Fact]
    public async Task An_empty_period_is_all_zeros_with_no_categories()
    {
        var summary = await SummaryAsync(D(2025, 9, 1), D(2025, 9, 30));

        Assert.Equal(0m, summary.Current.Income);
        Assert.Equal(0m, summary.Current.Expense);
        Assert.Equal(0m, summary.Current.Net);
        Assert.Equal(0, summary.Current.TransactionCount);
        Assert.Equal(0m, summary.Previous.Expense);
        Assert.Empty(summary.ExpenseByCategory);
    }

    [Fact]
    public async Task Summary_agrees_with_the_transaction_list_for_the_same_filters()
    {
        await EarnAsync(1200m, D(2025, 9, 2));
        await EarnAsync(300m, D(2025, 9, 30));
        await SpendAsync(_food, 12.34m, D(2025, 9, 1));
        await SpendAsync(_groceries, 56.78m, D(2025, 9, 15));
        await SpendAsync(_transport, 9.99m, D(2025, 9, 30));
        await SpendAsync(_transport, 500m, D(2025, 10, 1));

        var summary = await SummaryAsync(D(2025, 9, 1), D(2025, 9, 30));

        var range = "from=2025-09-01&to=2025-09-30&pageSize=100";
        var expenses = await _user.ListTransactionsAsync($"{range}&type=Expense");
        var income = await _user.ListTransactionsAsync($"{range}&type=Income");

        Assert.Equal(expenses.Items.Sum(t => t.Amount), summary.Current.Expense);
        Assert.Equal(income.Items.Sum(t => t.Amount), summary.Current.Income);
        Assert.Equal(expenses.TotalCount + income.TotalCount, summary.Current.TransactionCount);
        Assert.Equal(summary.Current.Expense, summary.ExpenseByCategory.Sum(c => c.Amount));
    }

    [Fact]
    public async Task Another_users_transactions_are_never_counted()
    {
        await using var other = await TestApiClient.CreateAsync(factory, "dashboard-other");
        var theirCash = await other.CreateAccountAsync("Their cash", 100_000m);
        var theirFood = await other.CreateCategoryAsync("Their food", CategoryType.Expense);
        await other.CreateTransactionAsync(TransactionType.Expense, 4000m, D(2025, 9, 10), theirCash.Id, categoryId: theirFood.Id);
        await other.CreateTransactionAsync(TransactionType.Expense, 4000m, D(2025, 8, 10), theirCash.Id, categoryId: theirFood.Id);

        await SpendAsync(_food, 10m, D(2025, 9, 10));

        var summary = await SummaryAsync(D(2025, 9, 1), D(2025, 9, 30));

        Assert.Equal(10m, summary.Current.Expense);
        Assert.Equal(0m, summary.Previous.Expense);
        Assert.Equal(new[] { "Dash food" }, summary.ExpenseByCategory.Select(c => c.Name).ToArray());

        var monthly = await _user.GetAsync<IReadOnlyList<MonthlyTotalsResponse>>("/api/v1/dashboard/monthly?months=2&to=2025-09-30");
        Assert.Equal(new[] { 0m, 10m }, monthly.Select(m => m.Expense).ToArray());
    }

    [Theory]
    [InlineData("")]                                        // both missing
    [InlineData("?from=2025-09-01")]                        // 'to' missing
    [InlineData("?to=2025-09-30")]                          // 'from' missing
    [InlineData("?from=2025-09-30&to=2025-09-01")]          // reversed
    [InlineData("?from=1999-12-31&to=2025-09-01")]          // before 2000
    [InlineData("?from=2000-01-01&to=2010-01-02")]          // longer than 3660 days
    [InlineData("?from=not-a-date&to=2025-09-01")]
    public async Task A_bad_period_is_refused(string query)
    {
        var status = await _user.StatusAsync(HttpMethod.Get, "/api/v1/dashboard/summary" + query);

        Assert.Equal(HttpStatusCode.BadRequest, status);
    }

    [Fact]
    public async Task The_longest_allowed_period_is_accepted()
    {
        // 2000-01-01 plus 3659 days is the last allowed end date.
        var from = D(2000, 1, 1);
        var to = from.AddDays(3659);

        var status = await _user.StatusAsync(HttpMethod.Get, Url(from, to));

        Assert.Equal(HttpStatusCode.OK, status);
    }

    [Fact]
    public async Task Monthly_lists_every_month_oldest_first_with_zeros_for_empty_months()
    {
        await EarnAsync(1000m, D(2025, 7, 31));
        await SpendAsync(_food, 120m, D(2025, 7, 1));
        await SpendAsync(_food, 45.5m, D(2025, 9, 1));
        await SpendAsync(_transport, 5m, D(2025, 9, 30));
        await _user.CreateTransactionAsync(TransactionType.Transfer, 8000m, D(2025, 9, 12), _cash.Id, _bank.Id);
        await SpendAsync(_food, 900m, D(2025, 6, 30));   // before the window
        await SpendAsync(_food, 700m, D(2025, 10, 1));   // after the window

        var months = await _user.GetAsync<IReadOnlyList<MonthlyTotalsResponse>>(
            "/api/v1/dashboard/monthly?months=3&to=2025-09-15");

        Assert.Equal(new[] { (2025, 7), (2025, 8), (2025, 9) }, months.Select(m => (m.Year, m.Month)).ToArray());
        Assert.Equal(new[] { 1000m, 0m, 0m }, months.Select(m => m.Income).ToArray());
        Assert.Equal(new[] { 120m, 0m, 50.5m }, months.Select(m => m.Expense).ToArray());
        Assert.Equal(new[] { 880m, 0m, -50.5m }, months.Select(m => m.Net).ToArray());
    }

    [Fact]
    public async Task Monthly_crosses_a_year_boundary()
    {
        await SpendAsync(_food, 10m, D(2024, 12, 31));
        await SpendAsync(_food, 20m, D(2025, 1, 1));

        var months = await _user.GetAsync<IReadOnlyList<MonthlyTotalsResponse>>(
            "/api/v1/dashboard/monthly?months=3&to=2025-01-20");

        Assert.Equal(new[] { (2024, 11), (2024, 12), (2025, 1) }, months.Select(m => (m.Year, m.Month)).ToArray());
        Assert.Equal(new[] { 0m, 10m, 20m }, months.Select(m => m.Expense).ToArray());
    }

    [Fact]
    public async Task Monthly_defaults_to_six_months_ending_this_month()
    {
        var months = await _user.GetAsync<IReadOnlyList<MonthlyTotalsResponse>>("/api/v1/dashboard/monthly");

        var today = DateTime.UtcNow;
        Assert.Equal(6, months.Count);
        Assert.Equal((today.Year, today.Month), (months[^1].Year, months[^1].Month));
        Assert.All(months, m => Assert.Equal(0m, m.Net));
    }

    [Theory]
    [InlineData("?months=0")]
    [InlineData("?months=25")]
    [InlineData("?months=-1")]
    [InlineData("?months=3&to=1999-12-31")]
    [InlineData("?months=abc")]
    public async Task A_bad_month_window_is_refused(string query)
    {
        var status = await _user.StatusAsync(HttpMethod.Get, "/api/v1/dashboard/monthly" + query);

        Assert.Equal(HttpStatusCode.BadRequest, status);
    }

    [Fact]
    public async Task The_dashboard_needs_a_signed_in_user()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync(Url(D(2025, 9, 1), D(2025, 9, 30)));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
