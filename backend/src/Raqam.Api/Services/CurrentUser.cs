using System.Security.Claims;
using Raqam.Application.Common;

namespace Raqam.Api.Services;

public class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    public Guid UserId
    {
        get
        {
            var value = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);

            // The global fallback policy (Program.cs) requires authentication on every
            // endpoint that resolves this, so a missing/invalid claim means something is
            // wrong with the auth setup itself, not a normal "anonymous user" case.
            if (!Guid.TryParse(value, out var userId))
            {
                throw new InvalidOperationException(
                    "No authenticated user id is available. ICurrentUser must only be used " +
                    "from an endpoint that requires authentication.");
            }

            return userId;
        }
    }
}
