using Microsoft.EntityFrameworkCore;
using Raqam.Domain.Budgets;
using Raqam.Domain.Categories;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>
/// The database's own backstop for budgets (D053), tested by writing past the application:
/// the unique index must treat the overall budget's NULL category as one value, the check
/// constraints must refuse impossible rows, and a budget cannot point at another owner's category.
/// </summary>
public class BudgetConstraintTests(ApiFactory factory)
    : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private static readonly DateTime Now = new(2026, 11, 20, 12, 0, 0, DateTimeKind.Utc);

    private TestApiClient _owner = null!;
    private TestApiClient _other = null!;

    public async Task InitializeAsync()
    {
        _owner = await TestApiClient.CreateAsync(factory, "budgetdb-owner");
        _other = await TestApiClient.CreateAsync(factory, "budgetdb-other");
    }

    public async Task DisposeAsync()
    {
        await _owner.DisposeAsync();
        await _other.DisposeAsync();
    }

    [Fact]
    public async Task Two_overall_budgets_for_one_month_clash_although_their_category_is_null()
    {
        var code = await TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Budgets.Add(Budget.Create(_owner.UserId, 2025, 9, 100m, null, Now));
            db.Budgets.Add(Budget.Create(_owner.UserId, 2025, 9, 200m, null, Now));
            await db.SaveChangesAsync();
        }));

        Assert.Equal("23505", code);
    }

    [Fact]
    public async Task Overall_budgets_for_different_months_or_different_owners_do_not_clash()
    {
        var code = await TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, async db =>
        {
            db.Budgets.Add(Budget.Create(_owner.UserId, 2025, 9, 100m, null, Now));
            db.Budgets.Add(Budget.Create(_owner.UserId, 2025, 10, 100m, null, Now));
            db.Budgets.Add(Budget.Create(_other.UserId, 2025, 9, 100m, null, Now));
            await db.SaveChangesAsync();
        }));

        Assert.Equal("none", code);
    }

    [Theory]
    [InlineData("0", 9, 2025)]
    [InlineData("-5", 9, 2025)]
    [InlineData("100", 0, 2025)]
    [InlineData("100", 13, 2025)]
    [InlineData("100", 9, 1999)]
    [InlineData("100", 9, 2101)]
    public async Task The_database_refuses_an_impossible_amount_month_or_year(string amount, int month, int year)
    {
        var code = await InsertAsync(_owner.UserId, null, decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture), month, year);

        Assert.Equal("23514", code);
    }

    [Fact]
    public async Task A_budget_cannot_point_at_another_owners_category()
    {
        var theirs = await _other.CreateCategoryAsync("Their food", CategoryType.Expense);

        var code = await InsertAsync(_owner.UserId, theirs.Id, 100m, 9, 2025);

        Assert.Equal("23503", code);
    }

    [Fact]
    public async Task A_budget_on_the_owners_own_category_is_accepted()
    {
        var mine = await _owner.CreateCategoryAsync("My food", CategoryType.Expense);

        var code = await InsertAsync(_owner.UserId, mine.Id, 100m, 9, 2025);

        Assert.Equal("none", code);
    }

    /// <summary>Writes a row with plain SQL, so the domain's own checks cannot get in the way.</summary>
    private Task<string> InsertAsync(Guid userId, Guid? categoryId, decimal amount, int month, int year) =>
        TestDatabase.SqlStateAsync(() => TestDatabase.WithDbAsync(factory, db => db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO "Budgets" ("Id", "UserId", "CategoryId", "Amount", "Year", "Month", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES ({Guid.NewGuid()}, {userId}, {categoryId}, {amount}, {year}, {month}, {Now}, {Now})
            """)));
}
