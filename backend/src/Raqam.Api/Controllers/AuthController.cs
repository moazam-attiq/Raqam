using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Raqam.Api.Contracts.Auth;
using Raqam.Api.Validation;
using Raqam.Infrastructure.Identity;

namespace Raqam.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(
    SignInManager<ApplicationUser> signInManager,
    UserManager<ApplicationUser> userManager,
    IAntiforgery antiforgery) : ControllerBase
{
    // The frontend calls this before rendering the login form and before any other unsafe
    // request, to get a token to echo back in the X-CSRF-TOKEN header (D018). Issuing it
    // anonymously is safe: on its own the token proves nothing, it just has to match what
    // the matching request sends back.
    [HttpGet("csrf-token")]
    [AllowAnonymous]
    public IActionResult GetCsrfToken()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new { token = tokens.RequestToken });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [SkipCsrfValidation] // No session exists yet to have handed out a matching token.
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        // lockoutOnFailure: true enforces the Lockout policy configured in
        // AddInfrastructure (spec §8.1).
        var result = await signInManager.PasswordSignInAsync(
            request.Email, request.Password, isPersistent: true, lockoutOnFailure: true);

        // Deliberately the same response shape whether the email doesn't exist or the
        // password is wrong, to avoid revealing which one it was (spec §8.1).
        return Ok(new LoginResponse(
            Succeeded: result.Succeeded,
            RequiresTwoFactor: result.RequiresTwoFactor,
            LockedOut: result.IsLockedOut));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(new { user.Id, user.Email });
    }
}
