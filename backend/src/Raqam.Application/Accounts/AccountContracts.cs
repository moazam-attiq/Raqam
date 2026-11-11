using Raqam.Domain.Accounts;

namespace Raqam.Application.Accounts;

// No UserId in any request: the owner always comes from ICurrentUser (business rule 5).
// The account type is nullable only so that "left out" is caught as an error instead of
// silently becoming the first enum value.

public sealed record CreateAccountRequest(
    string Name,
    AccountType? AccountType,
    decimal OpeningBalance,
    string? InstitutionName);

/// <param name="Version">The <see cref="AccountResponse.Version"/> the client last saw; a stale one is rejected with 409.</param>
public sealed record UpdateAccountRequest(
    string Name,
    AccountType? AccountType,
    decimal OpeningBalance,
    string? InstitutionName,
    uint Version);

public sealed record AccountResponse(
    Guid Id,
    string Name,
    AccountType AccountType,
    decimal OpeningBalance,
    string CurrencyCode,
    string? InstitutionName,
    bool IsArchived,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    uint Version);

public static class AccountMappings
{
    public static AccountResponse ToResponse(this Account account) => new(
        account.Id,
        account.Name,
        account.AccountType,
        account.OpeningBalance,
        account.CurrencyCode,
        account.InstitutionName,
        account.IsArchived,
        account.CreatedAtUtc,
        account.UpdatedAtUtc,
        account.Version);
}
