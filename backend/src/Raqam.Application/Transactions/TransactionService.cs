using Raqam.Application.Accounts;
using Raqam.Application.Categories;
using Raqam.Application.Common;
using Raqam.Application.Ledger;
using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;

namespace Raqam.Application.Transactions;

/// <summary>
/// Transaction use cases. The owner is always <see cref="ICurrentUser"/>. Accounts and
/// categories named in a request are looked up for the owner only, so another user's id
/// is "not found" (D026). The domain then enforces the type rules (income, expense and
/// transfer shapes, matching category type, no archived references). A transfer is one
/// row, so every change here is a single save (D023, rule 6). No change may take an
/// account's balance below zero (D049): <see cref="BalanceGuard"/> checks that for every
/// create, edit and delete before anything is saved.
/// </summary>
public class TransactionService(
    ITransactionRepository transactions,
    IAccountRepository accounts,
    ICategoryRepository categories,
    BalanceGuard balanceGuard,
    IUnitOfWork unitOfWork,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    public Task<PagedResult<TransactionResponse>> ListAsync(TransactionQuery query, CancellationToken cancellationToken) =>
        SearchAsync(query, cancellationToken);

    /// <summary>An account's history: the same list and filters, fixed to one account (a transfer shows on both sides).</summary>
    public async Task<PagedResult<TransactionResponse>> ListForAccountAsync(
        Guid accountId, TransactionQuery query, CancellationToken cancellationToken)
    {
        // 404 for a missing or foreign account, rather than an empty list that would hide the difference.
        _ = await accounts.FindAsync(currentUser.UserId, accountId, cancellationToken)
            ?? throw new NotFoundException("Account was not found.");

        return await SearchAsync(query with { AccountId = accountId }, cancellationToken);
    }

    public async Task<TransactionResponse> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var transaction = await FindOrThrowAsync(id, cancellationToken);
        return transaction.ToResponse();
    }

    public async Task<TransactionResponse> CreateAsync(CreateTransactionRequest request, CancellationToken cancellationToken)
    {
        var (source, destination, category) = await LoadReferencesAsync(
            request.SourceAccountId, request.DestinationAccountId, request.CategoryId, cancellationToken);

        var transaction = Transaction.Create(
            currentUser.UserId,
            request.Type!.Value,
            request.Amount,
            request.TransactionDate,
            source,
            destination,
            category,
            request.Description,
            request.Merchant,
            Now());

        // Checked before the transaction is added, so the balance it reads does not include it.
        await balanceGuard.EnsureNotOverdrawnAsync(Effects(transaction, source, destination), cancellationToken);

        transactions.Add(transaction);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return transaction.ToResponse();
    }

    public async Task<TransactionResponse> UpdateAsync(Guid id, UpdateTransactionRequest request, CancellationToken cancellationToken)
    {
        var transaction = await FindOrThrowAsync(id, cancellationToken);

        var (source, destination, category) = await LoadReferencesAsync(
            request.SourceAccountId, request.DestinationAccountId, request.CategoryId, cancellationToken);

        // What the saved version does to its accounts is taken back out, and what the edited
        // version does is put in; only the difference per account is checked.
        var taken = await ReversalAsync(transaction, cancellationToken);

        transactions.ExpectVersion(transaction, request.Version);
        transaction.Update(
            request.Type!.Value,
            request.Amount,
            request.TransactionDate,
            source,
            destination,
            category,
            request.Description,
            request.Merchant,
            Now());

        await balanceGuard.EnsureNotOverdrawnAsync(
            taken.Concat(Effects(transaction, source, destination)), cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return transaction.ToResponse();
    }

    /// <summary>
    /// A transaction is hard-deleted (D029); the balance follows because it is computed from the
    /// ledger (D006). Deleting income, or the incoming side of a transfer, lowers a balance, so
    /// it is refused if the money has already been spent (D049).
    /// </summary>
    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var transaction = await FindOrThrowAsync(id, cancellationToken);

        await balanceGuard.EnsureNotOverdrawnAsync(await ReversalAsync(transaction, cancellationToken), cancellationToken);

        transactions.Remove(transaction);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<PagedResult<TransactionResponse>> SearchAsync(TransactionQuery query, CancellationToken cancellationToken)
    {
        var page = await transactions.SearchAsync(currentUser.UserId, query, cancellationToken);

        return PagedResult<TransactionResponse>.Create(
            page.Items.Select(t => t.ToResponse()).ToList(),
            query.Page,
            query.PageSize,
            page.TotalCount);
    }

    /// <summary>What a transaction does to each account it touches, as balance changes.</summary>
    private static IEnumerable<BalanceChange> Effects(Transaction transaction, Account source, Account? destination)
    {
        yield return new BalanceChange(source, transaction.SignedEffectOn(source.Id));

        if (destination is not null)
            yield return new BalanceChange(destination, transaction.SignedEffectOn(destination.Id));
    }

    /// <summary>The opposite of what the saved transaction does, for removing or replacing it. Call before it is changed.</summary>
    private async Task<List<BalanceChange>> ReversalAsync(Transaction transaction, CancellationToken cancellationToken)
    {
        var ids = new[] { transaction.SourceAccountId, transaction.DestinationAccountId }
            .OfType<Guid>()
            .Distinct();

        var reversal = new List<BalanceChange>();
        foreach (var accountId in ids)
        {
            var account = await accounts.FindAsync(currentUser.UserId, accountId, cancellationToken)
                ?? throw new NotFoundException("Account was not found.");

            reversal.Add(new BalanceChange(account, -transaction.SignedEffectOn(accountId)));
        }

        return reversal;
    }

    private async Task<Transaction> FindOrThrowAsync(Guid id, CancellationToken cancellationToken)
    {
        return await transactions.FindAsync(currentUser.UserId, id, cancellationToken)
            ?? throw new NotFoundException("Transaction was not found.");
    }

    private async Task<(Account Source, Account? Destination, Category? Category)> LoadReferencesAsync(
        Guid sourceAccountId, Guid? destinationAccountId, Guid? categoryId, CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;

        var source = await accounts.FindAsync(userId, sourceAccountId, cancellationToken)
            ?? throw new NotFoundException("Source account was not found.");

        Account? destination = null;
        if (destinationAccountId is { } destinationId)
        {
            destination = await accounts.FindAsync(userId, destinationId, cancellationToken)
                ?? throw new NotFoundException("Destination account was not found.");
        }

        Category? category = null;
        if (categoryId is { } id)
        {
            category = await categories.FindAsync(userId, id, cancellationToken)
                ?? throw new NotFoundException("Category was not found.");
        }

        return (source, destination, category);
    }

    private DateTime Now() => clock.GetUtcNow().UtcDateTime;
}
