using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Raqam.Api.Contracts.Auth;
using Raqam.Api.Validation;
using Raqam.Infrastructure.Identity;

namespace Raqam.Api.Controllers;

[ApiController]
[Route("api/v1/auth/two-factor")]
public class TwoFactorController(
    SignInManager<ApplicationUser> signInManager,
    UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpGet("status")]
    public async Task<ActionResult<TwoFactorStatusResponse>> Status()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(new TwoFactorStatusResponse(await userManager.GetTwoFactorEnabledAsync(user)));
    }

    // Returns the shared key for an authenticator app to add, as both the raw secret and a
    // ready-to-scan otpauth:// URI. Doesn't enable 2FA by itself — Enable does, once the
    // user proves the app is actually producing valid codes.
    [HttpPost("setup")]
    public async Task<ActionResult<TwoFactorSetupResponse>> Setup()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var key = await userManager.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrEmpty(key))
        {
            await userManager.ResetAuthenticatorKeyAsync(user);
            key = await userManager.GetAuthenticatorKeyAsync(user);
        }

        var email = await userManager.GetEmailAsync(user);
        var authenticatorUri =
            $"otpauth://totp/{Uri.EscapeDataString("Raqam")}:{Uri.EscapeDataString(email!)}" +
            $"?secret={key}&issuer={Uri.EscapeDataString("Raqam")}&digits=6";

        return Ok(new TwoFactorSetupResponse(key!, authenticatorUri));
    }

    // Confirms the authenticator app is producing valid codes before turning 2FA on, then
    // hands back one-time recovery codes — shown here once; there's nowhere else to
    // retrieve them later, so the frontend must tell the user to save them now.
    [HttpPost("enable")]
    public async Task<ActionResult<TwoFactorEnableResponse>> Enable(TwoFactorEnableRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var isValid = await userManager.VerifyTwoFactorTokenAsync(
            user, userManager.Options.Tokens.AuthenticatorTokenProvider, request.Code);

        if (!isValid)
        {
            return BadRequest("The verification code is invalid.");
        }

        await userManager.SetTwoFactorEnabledAsync(user, true);
        var recoveryCodes = await userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, 10);

        return Ok(new TwoFactorEnableResponse(recoveryCodes ?? []));
    }

    [HttpPost("disable")]
    public async Task<IActionResult> Disable()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        await userManager.SetTwoFactorEnabledAsync(user, false);

        // Invalidate the old shared key too — re-enabling later goes through Setup again
        // rather than silently reusing a key the user may have already removed from their app.
        await userManager.ResetAuthenticatorKeyAsync(user);

        return NoContent();
    }

    // Completes a login that PasswordSignInAsync left pending (LoginResponse.RequiresTwoFactor
    // = true) — SignInManager resolves which user is pending from its own cookie, not from
    // the main session, so no main session cookie exists yet. Anonymous and CSRF-exempt like
    // /auth/login for the same reason, and shares its rate limit (D019) since this is an
    // equally attractive brute-force target.
    [HttpPost("verify")]
    [AllowAnonymous]
    [SkipCsrfValidation]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Verify(TwoFactorVerifyRequest request)
    {
        var result = await signInManager.TwoFactorAuthenticatorSignInAsync(
            request.Code, isPersistent: true, rememberClient: false);

        return Ok(new LoginResponse(
            Succeeded: result.Succeeded,
            RequiresTwoFactor: false,
            LockedOut: result.IsLockedOut));
    }

    [HttpPost("recovery-code")]
    [AllowAnonymous]
    [SkipCsrfValidation]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> RedeemRecoveryCode(TwoFactorRecoveryCodeRequest request)
    {
        var result = await signInManager.TwoFactorRecoveryCodeSignInAsync(request.Code);

        return Ok(new LoginResponse(
            Succeeded: result.Succeeded,
            RequiresTwoFactor: false,
            LockedOut: result.IsLockedOut));
    }
}
