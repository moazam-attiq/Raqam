namespace Raqam.Api.Contracts.Auth;

/// <summary>
/// RequiresTwoFactor is already surfaced so the frontend's contract is correct from
/// the start, but there is no two-factor verification endpoint yet — that is the
/// next increment of M2. Until then, a 2FA-enrolled user cannot complete login
/// through this endpoint.
/// </summary>
public record LoginResponse(bool Succeeded, bool RequiresTwoFactor, bool LockedOut);
