namespace Raqam.Application.Ledger;

/// <summary>
/// An account's balance and how it is made up (spec §6.4, D006):
/// <c>Balance = OpeningBalance + Income − Expense + TransfersIn − TransfersOut</c>.
/// </summary>
/// <param name="AsOf">The date the balance was taken up to and including; null means "now" (everything).</param>
public sealed record AccountBalanceResponse(
    Guid AccountId,
    string CurrencyCode,
    DateOnly? AsOf,
    decimal OpeningBalance,
    decimal Income,
    decimal Expense,
    decimal TransfersIn,
    decimal TransfersOut,
    decimal Balance);

/// <summary>Income and expense for a date range. Transfers are never counted (business rule 3).</summary>
public sealed record LedgerTotalsResponse(
    DateOnly? From,
    DateOnly? To,
    Guid? AccountId,
    decimal Income,
    decimal Expense,
    decimal Net,
    int TransactionCount);
