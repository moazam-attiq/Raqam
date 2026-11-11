using Microsoft.AspNetCore.Identity;

namespace Raqam.Infrastructure.Identity;

/// <summary>
/// Identity's user record. Raqam is single-user (spec §1), but every financial
/// record still carries this user's Id as its owner (business rule 4) — see
/// spec §6.1. Extra profile fields can be added here later if needed; none are
/// required yet.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>;
