using Raqam.Application.Common;
using Raqam.Application.Ledger;
using Raqam.Domain.Accounts;

namespace Raqam.Application.Accounts;

/// <summary>
/// Account use cases. The owner is always <see cref="ICurrentUser"/>, never a request
/// field (business rules 4 and 5); an account that is not the owner's is "not found" (D026).
/// Account balance and transaction history come with the transaction use cases.
/// </summary>
public class AccountService(
    IAccountRepository accounts,
    BalanceGuard balanceGuard,
    IUnitOfWork unitOfWork,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<AccountResponse>> ListAsync(bool includeArchived, CancellationToken cancellationToken)
    {
        var list = await accounts.ListAsync(currentUser.UserId, includeArchived, cancellationToken);
        return list.Select(a => a.ToResponse()).ToList();
    }

    public async Task<AccountResponse> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var account = await FindOrThrowAsync(id, cancellationToken);
        return account.ToResponse();
    }

    public async Task<AccountResponse> CreateAsync(CreateAccountRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        await EnsureNameFreeAsync(name, null, cancellationToken);

        var account = Account.Create(
            currentUser.UserId,
            name,
            request.AccountType!.Value,
            request.OpeningBalance,
            request.InstitutionName,
            Now());

        accounts.Add(account);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return account.ToResponse();
    }

    public async Task<AccountResponse> UpdateAsync(Guid id, UpdateAccountRequest request, CancellationToken cancellationToken)
    {
        var account = await FindOrThrowAsync(id, cancellationToken);

        var name = request.Name.Trim();
        await EnsureNameFreeAsync(name, account.Id, cancellationToken);

        // Lowering the opening balance lowers the balance by the same amount, which may not
        // take it below zero (D049). Raising it, or leaving it, is always fine.
        await balanceGuard.EnsureNotOverdrawnAsync(
            [new BalanceChange(account, request.OpeningBalance - account.OpeningBalance)], cancellationToken);

        accounts.ExpectVersion(account, request.Version);
        account.Update(
            name,
            request.AccountType!.Value,
            request.OpeningBalance,
            request.InstitutionName,
            Now());

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return account.ToResponse();
    }

    /// <summary>History is kept; the account just stops accepting new transactions (D024). Safe to repeat.</summary>
    public async Task<AccountResponse> ArchiveAsync(Guid id, CancellationToken cancellationToken)
    {
        var account = await FindOrThrowAsync(id, cancellationToken);

        account.Archive(Now());
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return account.ToResponse();
    }

    private async Task<Account> FindOrThrowAsync(Guid id, CancellationToken cancellationToken)
    {
        return await accounts.FindAsync(currentUser.UserId, id, cancellationToken)
            ?? throw new NotFoundException("Account was not found.");
    }

    private async Task EnsureNameFreeAsync(string name, Guid? exceptId, CancellationToken cancellationToken)
    {
        if (await accounts.NameTakenAsync(currentUser.UserId, name, exceptId, cancellationToken))
        {
            throw new ConflictException($"You already have an account named '{name}'.");
        }
    }

    private DateTime Now() => clock.GetUtcNow().UtcDateTime;
}
