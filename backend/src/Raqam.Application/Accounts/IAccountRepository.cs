using Raqam.Domain.Accounts;

namespace Raqam.Application.Accounts;

/// <summary>
/// Persistence for accounts (D025). Every method takes the owner's id and only ever sees
/// that owner's rows (D026), so a missing result means "not found for this user".
/// </summary>
public interface IAccountRepository
{
    /// <summary>The owner's account, tracked for changes; null if missing or someone else's.</summary>
    Task<Account?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<Account>> ListAsync(Guid userId, bool includeArchived, CancellationToken cancellationToken);

    /// <summary>Exact-name check against the unique (owner, name) index, optionally ignoring one account.</summary>
    Task<bool> NameTakenAsync(Guid userId, string name, Guid? exceptId, CancellationToken cancellationToken);

    void Add(Account account);

    /// <summary>Makes the next save fail with a conflict if the row changed since the client read it (D027).</summary>
    void ExpectVersion(Account account, uint version);
}
