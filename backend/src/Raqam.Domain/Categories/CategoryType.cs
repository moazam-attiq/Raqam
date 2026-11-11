namespace Raqam.Domain.Categories;

/// <summary>
/// Income and expense categories are separate (spec §3.4). Transfers have no category.
/// Stored as strings in the database.
/// </summary>
public enum CategoryType
{
    Income,
    Expense,
}
