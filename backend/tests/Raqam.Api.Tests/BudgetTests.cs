using System.Net;
using Raqam.Application.Accounts;
using Raqam.Application.Budgets;
using Raqam.Application.Categories;
using Raqam.Application.Transactions;
using Raqam.Domain.Budgets;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>
/// M5 budgets (D053): create/edit/delete, what counts as spending, the 80% and 100% statuses,
/// one budget per month and category, and owner scoping. September 2025 is used throughout so
/// no date is in the future.
/// </summary>
public class BudgetTests(ApiFactory factory)
    : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const int Year = 2025;
    private const int Month = 9;

    private TestApiClient _user = null!;
    private AccountResponse _cash = null!;
    private AccountResponse _bank = null!;
    private CategoryResponse _food = null!;
    private CategoryResponse _groceries = null!;
    private CategoryResponse _transport = null!;
    private CategoryResponse _salary = null!;

    public async Task InitializeAsync()
    {
        _user = await TestApiClient.CreateAsync(factory, "budgets");
        _cash = await _user.CreateAccountAsync("Budget cash", 1_000_000m);
        _bank = await _user.CreateAccountAsync("Budget bank", 0m);
        _food = await _user.CreateCategoryAsync("Budget food", CategoryType.Expense);
        _groceries = await _user.CreateCategoryAsync("Budget groceries", CategoryType.Expense, _food.Id);
        _transport = await _user.CreateCategoryAsync("Budget transport", CategoryType.Expense);
        _salary = await _user.CreateCategoryAsync("Budget salary", CategoryType.Income);
    }

    public async Task DisposeAsync() => await _user.DisposeAsync();

    private static DateOnly Day(int day, int month = Month, int year = Year) => new(year, month, day);

    private Task<TransactionResponse> SpendAsync(CategoryResponse category, decimal amount, DateOnly date) =>
        _user.CreateTransactionAsync(TransactionType.Expense, amount, date, _cash.Id, categoryId: category.Id);

    private Task<BudgetResponse> CreateBudgetAsync(decimal amount, CategoryResponse? category = null, int year = Year, int month = Month) =>
        _user.SendAsync<BudgetResponse>(
            HttpMethod.Post, "/api/v1/budgets",
            new CreateBudgetRequest(year, month, amount, category?.Id),
            HttpStatusCode.Created);

    private Task<IReadOnlyList<BudgetResponse>> ListAsync(int year = Year, int month = Month) =>
        _user.GetAsync<IReadOnlyList<BudgetResponse>>($"/api/v1/budgets?year={year}&month={month}");

    private Task<BudgetResponse> GetBudgetAsync(Guid id) => _user.GetAsync<BudgetResponse>($"/api/v1/budgets/{id}");

    private Task<HttpStatusCode> PostStatusAsync(CreateBudgetRequest request) =>
        _user.StatusAsync(HttpMethod.Post, "/api/v1/budgets", request);

    // ---- Creating and listing -----------------------------------------------------------

    [Fact]
    public async Task An_overall_and_a_category_budget_are_listed_with_their_progress_overall_first()
    {
        var overall = await CreateBudgetAsync(10_000m);
        var food = await CreateBudgetAsync(4_000m, _food);
        await SpendAsync(_food, 1_000m, Day(5));
        await SpendAsync(_transport, 500m, Day(6));

        var list = await ListAsync();

        Assert.Equal(new[] { overall.Id, food.Id }, list.Select(b => b.Id));

        Assert.Null(list[0].CategoryId);
        Assert.Equal(10_000m, list[0].Amount);
        Assert.Equal(1_500m, list[0].Spent);
        Assert.Equal(8_500m, list[0].Remaining);
        Assert.Equal(15m, list[0].PercentUsed);
        Assert.Equal(BudgetStatus.OnTrack, list[0].Status);

        Assert.Equal(_food.Id, list[1].CategoryId);
        Assert.Equal(1_000m, list[1].Spent);
        Assert.Equal(3_000m, list[1].Remaining);
        Assert.Equal(25m, list[1].PercentUsed);
    }

    [Fact]
    public async Task A_new_budget_answers_with_its_progress_and_a_month_with_no_budgets_is_an_empty_list()
    {
        await SpendAsync(_food, 250m, Day(1));

        var created = await CreateBudgetAsync(1_000m, _food);

        Assert.Equal(250m, created.Spent);
        Assert.Equal(25m, created.PercentUsed);
        Assert.Empty(await ListAsync(Year, 3));
    }

    // ---- What counts as spending --------------------------------------------------------

    [Fact]
    public async Task Only_expenses_inside_the_month_count_not_income_transfers_or_other_months()
    {
        var overall = await CreateBudgetAsync(10_000m);

        await SpendAsync(_food, 100m, Day(1));              // first day: counts
        await SpendAsync(_transport, 200m, Day(30));        // last day: counts
        await SpendAsync(_food, 1_000m, Day(31, 8));        // the day before: does not
        await SpendAsync(_food, 2_000m, Day(1, 10));        // the day after: does not
        await _user.CreateTransactionAsync(TransactionType.Income, 5_000m, Day(10), _cash.Id, categoryId: _salary.Id);
        await _user.CreateTransactionAsync(TransactionType.Transfer, 3_000m, Day(11), _cash.Id, _bank.Id);

        Assert.Equal(300m, (await GetBudgetAsync(overall.Id)).Spent);
    }

    [Fact]
    public async Task A_category_budget_counts_its_subcategories_but_a_subcategory_budget_counts_only_itself()
    {
        var foodBudget = await CreateBudgetAsync(5_000m, _food);
        var groceriesBudget = await CreateBudgetAsync(2_000m, _groceries);
        await SpendAsync(_food, 100m, Day(2));
        await SpendAsync(_groceries, 300m, Day(3));
        await SpendAsync(_transport, 999m, Day(4));

        Assert.Equal(400m, (await GetBudgetAsync(foodBudget.Id)).Spent);
        Assert.Equal(300m, (await GetBudgetAsync(groceriesBudget.Id)).Spent);
    }

    [Fact]
    public async Task Progress_follows_edits_and_deletes_of_transactions()
    {
        var budget = await CreateBudgetAsync(1_000m, _food);
        var first = await SpendAsync(_food, 400m, Day(2));
        await SpendAsync(_food, 100m, Day(3));
        Assert.Equal(500m, (await GetBudgetAsync(budget.Id)).Spent);

        await _user.SendAsync<TransactionResponse>(
            HttpMethod.Put, $"/api/v1/transactions/{first.Id}",
            new UpdateTransactionRequest(
                TransactionType.Expense, 250m, Day(2), _cash.Id, null, _food.Id, null, null, first.Version),
            HttpStatusCode.OK);
        Assert.Equal(350m, (await GetBudgetAsync(budget.Id)).Spent);

        Assert.Equal(HttpStatusCode.NoContent, await _user.StatusAsync(HttpMethod.Delete, $"/api/v1/transactions/{first.Id}"));
        Assert.Equal(100m, (await GetBudgetAsync(budget.Id)).Spent);
    }

    [Fact]
    public async Task An_archived_category_keeps_its_budget_and_its_spending()
    {
        var budget = await CreateBudgetAsync(1_000m, _transport);
        await SpendAsync(_transport, 200m, Day(8));

        await _user.SendAsync<CategoryResponse>(
            HttpMethod.Post, $"/api/v1/categories/{_transport.Id}/archive", null, HttpStatusCode.OK);

        var after = (await ListAsync()).Single(b => b.Id == budget.Id);
        Assert.Equal(200m, after.Spent);
    }

    // ---- Statuses -----------------------------------------------------------------------

    [Fact]
    public async Task The_status_moves_to_near_limit_at_80_percent_and_to_limit_reached_at_100()
    {
        var budget = await CreateBudgetAsync(1_000m, _food);

        await SpendAsync(_food, 799.99m, Day(2));
        Assert.Equal(BudgetStatus.OnTrack, (await GetBudgetAsync(budget.Id)).Status);

        await SpendAsync(_food, 0.01m, Day(3));
        var atEighty = await GetBudgetAsync(budget.Id);
        Assert.Equal(BudgetStatus.NearLimit, atEighty.Status);
        Assert.Equal(80m, atEighty.PercentUsed);

        await SpendAsync(_food, 200m, Day(4));
        var atHundred = await GetBudgetAsync(budget.Id);
        Assert.Equal(BudgetStatus.LimitReached, atHundred.Status);
        Assert.Equal(0m, atHundred.Remaining);

        await SpendAsync(_food, 1m, Day(5));
        var over = await GetBudgetAsync(budget.Id);
        Assert.Equal(BudgetStatus.LimitReached, over.Status);
        Assert.Equal(-1m, over.Remaining);
        Assert.Equal(100.1m, over.PercentUsed);
    }

    // ---- One budget per month and category ----------------------------------------------

    [Fact]
    public async Task A_second_budget_for_the_same_month_and_category_is_a_conflict_with_a_clear_message()
    {
        await CreateBudgetAsync(1_000m, _food);
        await CreateBudgetAsync(9_000m);

        using var category = await _user.SendAsync(HttpMethod.Post, "/api/v1/budgets", new CreateBudgetRequest(Year, Month, 5m, _food.Id));
        Assert.Equal(HttpStatusCode.Conflict, category.StatusCode);
        Assert.Contains("Budget food in September 2025", await category.Content.ReadAsStringAsync());

        using var overall = await _user.SendAsync(HttpMethod.Post, "/api/v1/budgets", new CreateBudgetRequest(Year, Month, 5m, null));
        Assert.Equal(HttpStatusCode.Conflict, overall.StatusCode);
        Assert.Contains("overall budget for September 2025", await overall.Content.ReadAsStringAsync());

        Assert.Equal(2, (await ListAsync()).Count);
    }

    [Fact]
    public async Task The_same_category_in_another_month_and_another_category_in_the_same_month_are_fine()
    {
        await CreateBudgetAsync(1_000m, _food);

        await CreateBudgetAsync(1_000m, _food, Year, 10);
        await CreateBudgetAsync(1_000m, _transport);

        Assert.Equal(2, (await ListAsync()).Count);
        Assert.Single(await ListAsync(Year, 10));
    }

    // ---- Refused input ------------------------------------------------------------------

    [Fact]
    public async Task Bad_input_is_refused_with_400_and_creates_nothing()
    {
        var bodies = new (string Label, CreateBudgetRequest Body)[]
        {
            ("amount zero", new(Year, Month, 0m, null)),
            ("amount negative", new(Year, Month, -5m, null)),
            ("three decimals", new(Year, Month, 10.555m, null)),
            ("month 0", new(Year, 0, 100m, null)),
            ("month 13", new(Year, 13, 100m, null)),
            ("year 1999", new(1999, Month, 100m, null)),
            ("empty category id", new(Year, Month, 100m, Guid.Empty)),
            ("income category", new(Year, Month, 100m, _salary.Id)),
        };

        foreach (var (label, body) in bodies)
        {
            var status = await PostStatusAsync(body);
            Assert.True(status == HttpStatusCode.BadRequest, $"{label}: expected 400, got {(int)status}");
        }

        Assert.Empty(await ListAsync());
    }

    [Fact]
    public async Task An_archived_category_is_refused_and_an_unknown_one_is_not_found()
    {
        var spare = await _user.CreateCategoryAsync("Budget spare", CategoryType.Expense);
        await _user.SendAsync<CategoryResponse>(HttpMethod.Post, $"/api/v1/categories/{spare.Id}/archive", null, HttpStatusCode.OK);

        Assert.Equal(HttpStatusCode.BadRequest, await PostStatusAsync(new(Year, Month, 100m, spare.Id)));
        Assert.Equal(HttpStatusCode.NotFound, await PostStatusAsync(new(Year, Month, 100m, Guid.NewGuid())));
    }

    [Theory]
    [InlineData("")]
    [InlineData("?year=2025")]
    [InlineData("?month=9")]
    [InlineData("?year=2025&month=13")]
    [InlineData("?year=1999&month=9")]
    public async Task Listing_needs_a_valid_year_and_month(string query)
    {
        Assert.Equal(HttpStatusCode.BadRequest, await _user.StatusAsync(HttpMethod.Get, $"/api/v1/budgets{query}"));
    }

    // ---- Editing and deleting -----------------------------------------------------------

    [Fact]
    public async Task Editing_the_amount_recalculates_progress_and_keeps_month_and_category()
    {
        var budget = await CreateBudgetAsync(1_000m, _food);
        await SpendAsync(_food, 500m, Day(2));

        var updated = await _user.SendAsync<BudgetResponse>(
            HttpMethod.Put, $"/api/v1/budgets/{budget.Id}", new UpdateBudgetRequest(600m, budget.Version), HttpStatusCode.OK);

        Assert.Equal(600m, updated.Amount);
        Assert.Equal(100m, updated.Remaining);
        Assert.Equal(BudgetStatus.NearLimit, updated.Status);
        Assert.Equal(_food.Id, updated.CategoryId);
        Assert.Equal(Year, updated.Year);
        Assert.Equal(Month, updated.Month);
        Assert.NotEqual(budget.Version, updated.Version);
    }

    [Fact]
    public async Task Editing_with_a_stale_version_is_a_conflict_and_a_bad_amount_is_a_400()
    {
        var budget = await CreateBudgetAsync(1_000m, _food);
        var first = await _user.SendAsync<BudgetResponse>(
            HttpMethod.Put, $"/api/v1/budgets/{budget.Id}", new UpdateBudgetRequest(1_200m, budget.Version), HttpStatusCode.OK);

        Assert.Equal(HttpStatusCode.Conflict, await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/budgets/{budget.Id}", new UpdateBudgetRequest(5m, budget.Version)));
        Assert.Equal(HttpStatusCode.BadRequest, await _user.StatusAsync(
            HttpMethod.Put, $"/api/v1/budgets/{budget.Id}", new UpdateBudgetRequest(0m, first.Version)));

        Assert.Equal(1_200m, (await GetBudgetAsync(budget.Id)).Amount);
    }

    [Fact]
    public async Task Deleting_a_budget_removes_it_and_leaves_the_transactions_alone()
    {
        var budget = await CreateBudgetAsync(1_000m, _food);
        var spend = await SpendAsync(_food, 100m, Day(2));

        Assert.Equal(HttpStatusCode.NoContent, await _user.StatusAsync(HttpMethod.Delete, $"/api/v1/budgets/{budget.Id}"));

        Assert.Equal(HttpStatusCode.NotFound, await _user.StatusAsync(HttpMethod.Get, $"/api/v1/budgets/{budget.Id}"));
        Assert.Equal(HttpStatusCode.NotFound, await _user.StatusAsync(HttpMethod.Delete, $"/api/v1/budgets/{budget.Id}"));
        Assert.Empty(await ListAsync());
        Assert.Equal(spend.Id, (await _user.GetAsync<TransactionResponse>($"/api/v1/transactions/{spend.Id}")).Id);
    }

    [Fact]
    public async Task A_deleted_budget_can_be_created_again_for_the_same_month_and_category()
    {
        var budget = await CreateBudgetAsync(1_000m, _food);
        await _user.StatusAsync(HttpMethod.Delete, $"/api/v1/budgets/{budget.Id}");

        var again = await CreateBudgetAsync(2_000m, _food);

        Assert.Equal(2_000m, again.Amount);
    }

    // ---- Owner scoping ------------------------------------------------------------------

    [Fact]
    public async Task Another_users_budgets_are_invisible_and_cannot_be_used()
    {
        await using var bob = await TestApiClient.CreateAsync(factory, "budgets-bob");
        var budget = await CreateBudgetAsync(1_000m, _food);

        Assert.Equal(HttpStatusCode.NotFound, await bob.StatusAsync(HttpMethod.Get, $"/api/v1/budgets/{budget.Id}"));
        Assert.Equal(HttpStatusCode.NotFound, await bob.StatusAsync(
            HttpMethod.Put, $"/api/v1/budgets/{budget.Id}", new UpdateBudgetRequest(1m, budget.Version)));
        Assert.Equal(HttpStatusCode.NotFound, await bob.StatusAsync(HttpMethod.Delete, $"/api/v1/budgets/{budget.Id}"));
        Assert.Empty(await bob.GetAsync<IReadOnlyList<BudgetResponse>>($"/api/v1/budgets?year={Year}&month={Month}"));

        // Bob cannot budget Alice's category, and his own overall budget is separate from hers.
        Assert.Equal(HttpStatusCode.NotFound, await bob.StatusAsync(
            HttpMethod.Post, "/api/v1/budgets", new CreateBudgetRequest(Year, Month, 100m, _food.Id)));
        await CreateBudgetAsync(5_000m);
        var bobs = await bob.SendAsync<BudgetResponse>(
            HttpMethod.Post, "/api/v1/budgets", new CreateBudgetRequest(Year, Month, 700m, null), HttpStatusCode.Created);
        Assert.Equal(0m, bobs.Spent);

        // Alice's budget is untouched.
        Assert.Equal(1_000m, (await GetBudgetAsync(budget.Id)).Amount);
    }

    [Fact]
    public async Task Another_users_spending_never_counts()
    {
        await using var bob = await TestApiClient.CreateAsync(factory, "budgets-spender");
        var overall = await CreateBudgetAsync(1_000m);
        var bobCash = await bob.CreateAccountAsync("Bob cash", 5_000m);
        var bobFood = await bob.CreateCategoryAsync("Bob food", CategoryType.Expense);
        await bob.CreateTransactionAsync(TransactionType.Expense, 400m, Day(5), bobCash.Id, categoryId: bobFood.Id);

        Assert.Equal(0m, (await GetBudgetAsync(overall.Id)).Spent);
    }
}
