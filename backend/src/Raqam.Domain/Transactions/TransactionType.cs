namespace Raqam.Domain.Transactions;

/// <summary>
/// The three kinds of ledger entry (spec §3.2). The type, not the sign of the amount,
/// gives the financial direction. Stored as strings in the database.
/// </summary>
public enum TransactionType
{
    Income,
    Expense,
    Transfer,
}
