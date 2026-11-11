namespace Raqam.Application.Common;

/// <summary>
/// Saves everything the repositories have added or changed in one database transaction
/// (business rule 6). Implemented in Infrastructure, which also turns database-level
/// concurrency and uniqueness failures into <see cref="ConflictException"/>.
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
