using Microsoft.EntityFrameworkCore;
using Npgsql;
using Raqam.Application.Common;

namespace Raqam.Infrastructure.Persistence.Repositories;

/// <summary>
/// Saves the DbContext's pending changes as one database transaction and translates the
/// two database failures a client can cause into <see cref="ConflictException"/> (409):
/// an edit against an out-of-date row version (D027) and a clash with a unique index.
/// </summary>
public class UnitOfWork(RaqamDbContext db) : IUnitOfWork
{
    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException(
                "This record was changed by another request. Reload it and try again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The services check names first for a friendly message; this catches the race
            // where two requests pass that check at once.
            throw new ConflictException("A record with the same name already exists.");
        }
    }
}
