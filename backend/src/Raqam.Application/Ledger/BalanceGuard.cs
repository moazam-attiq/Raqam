using System.Globalization;
using Raqam.Application.Common;
using Raqam.Application.Transactions;
using Raqam.Domain.Accounts;
using Raqam.Domain.Common;

namespace Raqam.Application.Ledger;

/// <summary>An account, and how much a change moves its balance. Negative means money leaves it.</summary>
public readonly record struct BalanceChange(Account Account, decimal Amount);

/// <summary>The balance formula in one place (spec §6.4): the opening balance plus what the ledger moved.</summary>
public static class AccountBalance
{
    public static decimal Of(Account account, AccountMovements movements) =>
        account.OpeningBalance
        + movements.Income
        - movements.Expense
        + movements.TransfersIn
        - movements.TransfersOut;
}

/// <summary>
/// No change may take an account's balance below zero (D049). It is given what a create, edit,
/// delete or opening-balance change would do to each account, and refuses the ones that lower a
/// balance more than the account holds. The check is against the account's current balance,
/// counting every transaction whatever its date, which is the figure the balance endpoint
/// shows. Landing exactly on zero is allowed.
/// <para>
/// An account that is already below zero (it was opened that way before D049) is not locked
/// out: a change that does not lower it is never refused, only one that would lower it further.
/// </para>
/// <para>
/// For every account it lets through that loses money, it also marks the account row as
/// changed. Two requests that spend from the same account at the same moment would otherwise
/// both pass against the same balance; with the row marked, the second fails with a conflict
/// (the account's version is a concurrency token, D027) and the caller retries.
/// </para>
/// </summary>
public class BalanceGuard(ITransactionRepository transactions, ICurrentUser currentUser, TimeProvider clock)
{
    /// <exception cref="DomainException">An account would go below zero.</exception>
    public async Task EnsureNotOverdrawnAsync(IEnumerable<BalanceChange> changes, CancellationToken cancellationToken)
    {
        // One net change per account: an edit that moves money between two accounts, or one
        // that only changes an amount, can list the same account more than once.
        foreach (var group in changes.GroupBy(change => change.Account.Id))
        {
            var account = group.First().Account;
            var change = group.Sum(item => item.Amount);

            if (change >= 0)
                continue;

            var movements = await transactions.GetMovementsAsync(currentUser.UserId, account.Id, null, cancellationToken);
            var current = AccountBalance.Of(account, movements);

            if (current + change < 0)
            {
                var available = Math.Max(current, 0m).ToString("N2", CultureInfo.InvariantCulture);
                throw new DomainException($"{account.Name} has Rs {available} available. This would take it below zero.");
            }

            account.Touch(clock.GetUtcNow().UtcDateTime);
        }
    }
}
