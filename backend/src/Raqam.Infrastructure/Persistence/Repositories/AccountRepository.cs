using Microsoft.EntityFrameworkCore;
using Raqam.Application.Accounts;
using Raqam.Domain.Accounts;

namespace Raqam.Infrastructure.Persistence.Repositories;

public class AccountRepository(RaqamDbContext db) : IAccountRepository
{
    public Task<Account?> FindAsync(Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Accounts.FirstOrDefaultAsync(a => a.UserId == userId && a.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Account>> ListAsync(
        Guid userId, bool includeArchived, CancellationToken cancellationToken) =>
        await db.Accounts
            .AsNoTracking()
            .Where(a => a.UserId == userId && (includeArchived || !a.IsArchived))
            .OrderBy(a => a.Name)
            .ToListAsync(cancellationToken);

    public Task<bool> NameTakenAsync(
        Guid userId, string name, Guid? exceptId, CancellationToken cancellationToken) =>
        db.Accounts.AnyAsync(
            a => a.UserId == userId && a.Name == name && (exceptId == null || a.Id != exceptId),
            cancellationToken);

    public void Add(Account account) => db.Accounts.Add(account);

    public void ExpectVersion(Account account, uint version) =>
        db.Entry(account).Property(a => a.Version).OriginalValue = version;
}
