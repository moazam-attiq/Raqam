namespace Raqam.Domain.Accounts;

/// <summary>Initial account types from spec §3.3. Stored as strings in the database.</summary>
public enum AccountType
{
    Cash,
    BankAccount,
    DigitalWallet,
    SavingsAccount,
}
