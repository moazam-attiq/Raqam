using Raqam.Domain.Budgets;
using Raqam.Domain.Categories;
using Raqam.Domain.Common;
using Xunit;

namespace Raqam.Domain.Tests;

public class BudgetTests
{
    private readonly Guid _userId = TestData.NewUserId();

    private Category Expense(string name = "Food") => TestData.NewCategory(_userId, CategoryType.Expense, name);

    private Budget Create(decimal amount = 5000m, Category? category = null, int year = 2026, int month = 11) =>
        Budget.Create(_userId, year, month, amount, category, TestData.Now);

    [Fact]
    public void An_overall_budget_has_no_category()
    {
        var budget = Create(25000m);

        Assert.NotEqual(Guid.Empty, budget.Id);
        Assert.Equal(_userId, budget.UserId);
        Assert.Null(budget.CategoryId);
        Assert.Equal(25000m, budget.Amount);
        Assert.Equal(2026, budget.Year);
        Assert.Equal(11, budget.Month);
        Assert.Equal(TestData.Now, budget.CreatedAtUtc);
        Assert.Equal(TestData.Now, budget.UpdatedAtUtc);
    }

    [Fact]
    public void A_category_budget_points_at_its_expense_category()
    {
        var category = Expense();

        var budget = Create(category: category);

        Assert.Equal(category.Id, budget.CategoryId);
    }

    [Fact]
    public void A_subcategory_can_have_its_own_budget()
    {
        var parent = Expense("Food");
        var child = Category.Create(_userId, "Groceries", CategoryType.Expense, parent, null, null, TestData.Now);

        Assert.Equal(child.Id, Create(category: child).CategoryId);
    }

    [Fact]
    public void An_income_category_cannot_be_budgeted()
    {
        var income = TestData.NewCategory(_userId, CategoryType.Income, "Salary");

        var error = Assert.Throws<DomainException>(() => Create(category: income));

        Assert.Equal("A budget can only be set on an expense category.", error.Message);
    }

    [Fact]
    public void An_archived_category_cannot_be_budgeted()
    {
        var category = Expense();
        category.Archive(TestData.Now);

        Assert.Throws<DomainException>(() => Create(category: category));
    }

    [Fact]
    public void Another_owners_category_is_treated_as_missing()
    {
        var someoneElses = TestData.NewCategory(TestData.NewUserId(), CategoryType.Expense, "Theirs");

        var error = Assert.Throws<DomainException>(() => Create(category: someoneElses));

        Assert.Equal("Category was not found.", error.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    [InlineData(-1)]
    public void The_month_must_be_1_to_12(int month)
    {
        Assert.Throws<DomainException>(() => Create(month: month));
    }

    [Theory]
    [InlineData(1999)]
    [InlineData(2101)]
    public void The_year_must_be_in_range(int year)
    {
        Assert.Throws<DomainException>(() => Create(year: year));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-10")]
    [InlineData("10.555")]
    public void The_amount_must_be_above_zero_with_at_most_2_decimals(string amount)
    {
        Assert.Throws<DomainException>(() => Create(TestData.Amount(amount)));
    }

    [Fact]
    public void An_owner_is_required()
    {
        Assert.Throws<DomainException>(() => Budget.Create(Guid.Empty, 2026, 11, 100m, null, TestData.Now));
    }

    [Fact]
    public void Update_changes_only_the_amount_and_the_edit_time()
    {
        var category = Expense();
        var budget = Create(1000m, category);

        budget.Update(1500.50m, TestData.Later);

        Assert.Equal(1500.50m, budget.Amount);
        Assert.Equal(TestData.Later, budget.UpdatedAtUtc);
        Assert.Equal(TestData.Now, budget.CreatedAtUtc);
        Assert.Equal(category.Id, budget.CategoryId);
        Assert.Equal(2026, budget.Year);
        Assert.Equal(11, budget.Month);
    }

    [Fact]
    public void A_refused_update_leaves_the_budget_unchanged()
    {
        var budget = Create(1000m);

        Assert.Throws<DomainException>(() => budget.Update(0m, TestData.Later));

        Assert.Equal(1000m, budget.Amount);
        Assert.Equal(TestData.Now, budget.UpdatedAtUtc);
    }
}
