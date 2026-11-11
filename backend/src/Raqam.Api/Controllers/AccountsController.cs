using Microsoft.AspNetCore.Mvc;
using Raqam.Application.Accounts;
using Raqam.Application.Common;
using Raqam.Application.Ledger;
using Raqam.Application.Transactions;

namespace Raqam.Api.Controllers;

// Authentication comes from the app-wide fallback policy and CSRF from the global filter,
// so nothing to add here. Controllers only translate HTTP to a service call; business
// rules live in the Domain and Application layers (D035).
[ApiController]
[Route("api/v1/accounts")]
public class AccountsController(
    AccountService accounts,
    TransactionService transactions,
    LedgerService ledger) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AccountResponse>>> List(
        [FromQuery] bool includeArchived, CancellationToken cancellationToken) =>
        Ok(await accounts.ListAsync(includeArchived, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<AccountResponse>> Create(
        CreateAccountRequest request, CancellationToken cancellationToken)
    {
        var account = await accounts.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = account.Id }, account);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AccountResponse>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await accounts.GetAsync(id, cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AccountResponse>> Update(
        Guid id, UpdateAccountRequest request, CancellationToken cancellationToken) =>
        Ok(await accounts.UpdateAsync(id, request, cancellationToken));

    [HttpPost("{id:guid}/archive")]
    public async Task<ActionResult<AccountResponse>> Archive(Guid id, CancellationToken cancellationToken) =>
        Ok(await accounts.ArchiveAsync(id, cancellationToken));

    /// <summary>The account's history: the transaction list, fixed to this account (a transfer shows on both sides).</summary>
    [HttpGet("{id:guid}/transactions")]
    public async Task<ActionResult<PagedResult<TransactionResponse>>> ListTransactions(
        Guid id, [FromQuery] TransactionQuery query, CancellationToken cancellationToken) =>
        Ok(await transactions.ListForAccountAsync(id, query, cancellationToken));

    [HttpGet("{id:guid}/balance")]
    public async Task<ActionResult<AccountBalanceResponse>> GetBalance(
        Guid id, [FromQuery] DateOnly? asOf, CancellationToken cancellationToken) =>
        Ok(await ledger.GetAccountBalanceAsync(id, asOf, cancellationToken));
}
