using Raqam.Domain.Transactions;

namespace Raqam.Application.Transactions;

// No UserId in any request: the owner always comes from ICurrentUser (business rule 5).
// The type is nullable only so that "left out" is caught as an error instead of silently
// becoming the first enum value. A transfer uses DestinationAccountId and no category;
// income and expense use a category and no destination (D023).

public sealed record CreateTransactionRequest(
    TransactionType? Type,
    decimal Amount,
    DateOnly TransactionDate,
    Guid SourceAccountId,
    Guid? DestinationAccountId,
    Guid? CategoryId,
    string? Description,
    string? Merchant);

/// <param name="Version">The <see cref="TransactionResponse.Version"/> the client last saw; a stale one is rejected with 409.</param>
public sealed record UpdateTransactionRequest(
    TransactionType? Type,
    decimal Amount,
    DateOnly TransactionDate,
    Guid SourceAccountId,
    Guid? DestinationAccountId,
    Guid? CategoryId,
    string? Description,
    string? Merchant,
    uint Version);

public sealed record TransactionResponse(
    Guid Id,
    TransactionType Type,
    decimal Amount,
    DateOnly TransactionDate,
    Guid SourceAccountId,
    Guid? DestinationAccountId,
    Guid? CategoryId,
    string Description,
    string? Merchant,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    uint Version);

public enum TransactionSort
{
    DateDesc,
    DateAsc,
    AmountDesc,
    AmountAsc,
}

/// <summary>
/// List filters, bound from the query string. Every filter is optional and they combine
/// with AND. <c>AccountId</c> matches either side of a transfer. <c>CategoryId</c> on a
/// top-level category also matches its subcategories (D036).
/// </summary>
public sealed record TransactionQuery(
    DateOnly? From = null,
    DateOnly? To = null,
    TransactionType? Type = null,
    Guid? AccountId = null,
    Guid? CategoryId = null,
    string? Search = null,
    TransactionSort? Sort = null,
    int Page = 1,
    int PageSize = TransactionQuery.DefaultPageSize)
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
    public const int SearchMaxLength = 100;
}

public static class TransactionMappings
{
    public static TransactionResponse ToResponse(this Transaction transaction) => new(
        transaction.Id,
        transaction.Type,
        transaction.Amount,
        transaction.TransactionDate,
        transaction.SourceAccountId,
        transaction.DestinationAccountId,
        transaction.CategoryId,
        transaction.Description,
        transaction.Merchant,
        transaction.CreatedAtUtc,
        transaction.UpdatedAtUtc,
        transaction.Version);
}
