using Raqam.Application.Accounts;
using Raqam.Application.Common;
using Raqam.Application.Transactions;

namespace Raqam.Application.Ledger;

/// <summary>
/// Read-only figures computed from the ledger: an account's balance and income/expense
/// totals. Both are aggregated in the database in one query each (spec §6.4); nothing is
/// cached, so a new, edited or deleted transaction is reflected immediately (D006).
/// </summary>
public class LedgerService(
    IAccountRepository accounts,
    ITransactionRepository transactions,
    ICurrentUser currentUser)
{
    public async Task<AccountBalanceResponse> GetAccountBalanceAsync(
        Guid accountId, DateOnly? asOf, CancellationToken cancellationToken)
    {
        var account = await accounts.FindAsync(currentUser.UserId, accountId, cancellationToken)
            ?? throw new NotFoundException("Account was not found.");

        var movements = await transactions.GetMovementsAsync(currentUser.UserId, account.Id, asOf, cancellationToken);

        var balance = account.OpeningBalance
            + movements.Income
            - movements.Expense
            + movements.TransfersIn
            - movements.TransfersOut;

        return new AccountBalanceResponse(
            account.Id,
            account.CurrencyCode,
            asOf,
            account.OpeningBalance,
            movements.Income,
            movements.Expense,
            movements.TransfersIn,
            movements.TransfersOut,
            balance);
    }

    /// <summary>Income and expense totals for a date range, optionally for one account. Transfers excluded.</summary>
    public async Task<LedgerTotalsResponse> GetTotalsAsync(
        DateOnly? from, DateOnly? to, Guid? accountId, CancellationToken cancellationToken)
    {
        if (from is not null && to is not null && to < from)
            throw new Raqam.Domain.Common.DomainException("'To' cannot be before 'From'.");

        if (accountId is { } id)
        {
            _ = await accounts.FindAsync(currentUser.UserId, id, cancellationToken)
                ?? throw new NotFoundException("Account was not found.");
        }

        var totals = await transactions.GetTotalsAsync(currentUser.UserId, from, to, accountId, cancellationToken);

        return new LedgerTotalsResponse(
            from, to, accountId, totals.Income, totals.Expense, totals.Income - totals.Expense, totals.TransactionCount);
    }
}
