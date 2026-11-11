using Raqam.Domain.Categories;
using Raqam.Domain.Common;
using Xunit;

namespace Raqam.Domain.Tests;

public class CategoryTests
{
    [Fact]
    public void Create_makes_a_top_level_category()
    {
        var userId = TestData.NewUserId();

        var category = Category.Create(userId, "  Food ", CategoryType.Expense, null, " #336699 ", " tag ", TestData.Now);

        Assert.NotEqual(Guid.Empty, category.Id);
        Assert.Equal(userId, category.UserId);
        Assert.Equal("Food", category.Name);
        Assert.Equal(CategoryType.Expense, category.Type);
        Assert.Null(category.ParentCategoryId);
        Assert.Equal("#336699", category.Colour);
        Assert.Equal("tag", category.Icon);
        Assert.False(category.IsArchived);
    }

    [Fact]
    public void Create_makes_a_subcategory_of_the_same_type()
    {
        var userId = TestData.NewUserId();
        var parent = TestData.NewCategory(userId, CategoryType.Expense, "Food");

        var child = Category.Create(userId, "Groceries", CategoryType.Expense, parent, null, null, TestData.Now);

        Assert.Equal(parent.Id, child.ParentCategoryId);
    }

    [Fact]
    public void Create_rejects_a_subcategory_of_a_subcategory()
    {
        var userId = TestData.NewUserId();
        var parent = TestData.NewCategory(userId, CategoryType.Expense, "Food");
        var child = TestData.NewCategory(userId, CategoryType.Expense, "Groceries", parent);

        Assert.Throws<DomainException>(() =>
            Category.Create(userId, "Fruit", CategoryType.Expense, child, null, null, TestData.Now));
    }

    [Fact]
    public void Create_rejects_a_subcategory_whose_type_differs_from_its_parent()
    {
        var userId = TestData.NewUserId();
        var parent = TestData.NewCategory(userId, CategoryType.Expense, "Food");

        Assert.Throws<DomainException>(() =>
            Category.Create(userId, "Bonus", CategoryType.Income, parent, null, null, TestData.Now));
    }

    [Fact]
    public void Create_rejects_a_parent_that_belongs_to_another_owner_without_revealing_it()
    {
        var parent = TestData.NewCategory(TestData.NewUserId(), CategoryType.Expense, "Food");

        var exception = Assert.Throws<DomainException>(() =>
            Category.Create(TestData.NewUserId(), "Groceries", CategoryType.Expense, parent, null, null, TestData.Now));

        Assert.Equal("Parent category was not found.", exception.Message);
    }

    [Fact]
    public void Create_rejects_an_archived_parent()
    {
        var userId = TestData.NewUserId();
        var parent = TestData.NewCategory(userId, CategoryType.Expense, "Food");
        parent.Archive(TestData.Later);

        Assert.Throws<DomainException>(() =>
            Category.Create(userId, "Groceries", CategoryType.Expense, parent, null, null, TestData.Now));
    }

    [Fact]
    public void Create_rejects_an_empty_owner()
    {
        Assert.Throws<DomainException>(() => TestData.NewCategory(Guid.Empty, CategoryType.Income));
    }

    [Fact]
    public void Create_rejects_an_unknown_type()
    {
        Assert.Throws<DomainException>(() =>
            Category.Create(TestData.NewUserId(), "X", (CategoryType)99, null, null, null, TestData.Now));
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void Create_rejects_a_blank_name(string name)
    {
        Assert.Throws<DomainException>(() =>
            Category.Create(TestData.NewUserId(), name, CategoryType.Income, null, null, null, TestData.Now));
    }

    [Fact]
    public void Create_rejects_a_name_colour_or_icon_that_is_too_long()
    {
        var userId = TestData.NewUserId();

        Assert.Throws<DomainException>(() =>
            Category.Create(userId, new string('a', Category.NameMaxLength + 1), CategoryType.Income, null, null, null, TestData.Now));
        Assert.Throws<DomainException>(() =>
            Category.Create(userId, "A", CategoryType.Income, null, new string('c', Category.ColourMaxLength + 1), null, TestData.Now));
        Assert.Throws<DomainException>(() =>
            Category.Create(userId, "A", CategoryType.Income, null, null, new string('i', Category.IconMaxLength + 1), TestData.Now));
    }

    [Fact]
    public void Update_changes_the_display_fields_but_not_type_or_parent()
    {
        var userId = TestData.NewUserId();
        var parent = TestData.NewCategory(userId, CategoryType.Expense, "Food");
        var child = TestData.NewCategory(userId, CategoryType.Expense, "Groceries", parent);

        child.Update("Supermarket", "#112233", "cart", TestData.Later);

        Assert.Equal("Supermarket", child.Name);
        Assert.Equal("#112233", child.Colour);
        Assert.Equal("cart", child.Icon);
        Assert.Equal(CategoryType.Expense, child.Type);
        Assert.Equal(parent.Id, child.ParentCategoryId);
        Assert.Equal(TestData.Later, child.UpdatedAtUtc);
    }

    [Fact]
    public void Update_with_a_blank_name_throws()
    {
        var category = TestData.NewCategory(TestData.NewUserId(), CategoryType.Income);

        Assert.Throws<DomainException>(() => category.Update(" ", null, null, TestData.Later));
    }

    [Fact]
    public void Archive_is_safe_to_repeat_and_keeps_the_first_update_time()
    {
        var category = TestData.NewCategory(TestData.NewUserId(), CategoryType.Income);
        category.Archive(TestData.Later);

        category.Archive(TestData.Later.AddHours(3));

        Assert.True(category.IsArchived);
        Assert.Equal(TestData.Later, category.UpdatedAtUtc);
    }
}
