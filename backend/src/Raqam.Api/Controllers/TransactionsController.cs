using Microsoft.AspNetCore.Mvc;
using Raqam.Application.Common;
using Raqam.Application.Transactions;

namespace Raqam.Api.Controllers;

[ApiController]
[Route("api/v1/transactions")]
public class TransactionsController(TransactionService transactions) : ControllerBase
{
    /// <summary>Filters: from, to, type, accountId, categoryId, search; plus sort, page, pageSize (D036).</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<TransactionResponse>>> List(
        [FromQuery] TransactionQuery query, CancellationToken cancellationToken) =>
        Ok(await transactions.ListAsync(query, cancellationToken));

    /// <summary>Income, expense and transfer all use this one endpoint; a transfer is a single row (D023).</summary>
    [HttpPost]
    public async Task<ActionResult<TransactionResponse>> Create(
        CreateTransactionRequest request, CancellationToken cancellationToken)
    {
        var transaction = await transactions.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = transaction.Id }, transaction);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TransactionResponse>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await transactions.GetAsync(id, cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TransactionResponse>> Update(
        Guid id, UpdateTransactionRequest request, CancellationToken cancellationToken) =>
        Ok(await transactions.UpdateAsync(id, request, cancellationToken));

    /// <summary>Hard delete (D029).</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await transactions.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
