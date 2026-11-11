using Raqam.Application.Accounts;
using Raqam.Application.Categories;
using Raqam.Application.Common;
using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;

namespace Raqam.Application.Transactions;

/// <summary>
/// Transaction use cases. The owner is always <see cref="ICurrentUser"/>. Accounts and
/// categories named in a request are looked up for the owner only, so another user's id
/// is "not found" (D026). The domain then enforces the type rules (income, expense and
/// transfer shapes, matching category type, no archived references). A transfer is one
/// row, so every change here is a single save (D023, rule 6).
/// </summary>
public class TransactionService(
    ITransactionRepository transactions,
    IAccountRepository accounts,
    ICategoryRepository categories,
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

        transactions.Add(transaction);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return transaction.ToResponse();
    }

    public async Task<TransactionResponse> UpdateAsync(Guid id, UpdateTransactionRequest request, CancellationToken cancellationToken)
    {
        var transaction = await FindOrThrowAsync(id, cancellationToken);

        var (source, destination, category) = await LoadReferencesAsync(
            request.SourceAccountId, request.DestinationAccountId, request.CategoryId, cancellationToken);

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

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return transaction.ToResponse();
    }

    /// <summary>A transaction is hard-deleted (D029); the balance follows because it is computed from the ledger (D006).</summary>
    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var transaction = await FindOrThrowAsync(id, cancellationToken);

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
