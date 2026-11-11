namespace Raqam.Application.Common;

/// <summary>
/// The authenticated owner for the current request. Application-layer use cases depend
/// on this instead of a raw ClaimsPrincipal, so they stay free of ASP.NET Core types
/// while still enforcing business rule 4 (every record is owner-scoped) and rule 5
/// (never trust a client-supplied user id) — the id always comes from here, never from
/// a request body or query string.
/// </summary>
public interface ICurrentUser
{
    Guid UserId { get; }
}
