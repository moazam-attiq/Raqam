using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Raqam.Infrastructure.Identity;

namespace Raqam.Api.Startup;

/// <summary>
/// Creates Raqam's one user on startup, since public registration is deliberately off
/// (D017). Reads the account from configuration — set locally via
/// `dotnet user-secrets set "SeedUser:Email" ...` / "SeedUser:Password" — and never
/// logs the password. Safe to run on every startup: it does nothing once any user
/// exists, and does nothing (just warns) if the seed configuration isn't set, so it
/// can't crash a test host or an environment that hasn't configured it yet.
/// </summary>
public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider services, ILogger logger)
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        if (await userManager.Users.AnyAsync())
        {
            return;
        }

        var configuration = services.GetRequiredService<IConfiguration>();
        var email = configuration["SeedUser:Email"];
        var password = configuration["SeedUser:Password"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning(
                "No users exist and SeedUser:Email/SeedUser:Password are not configured. " +
                "Skipping user seed — set them with 'dotnet user-secrets set' to create the account.");
            return;
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
        };

        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            // Never includes the password; Identity's error descriptions don't contain it.
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException($"Seed user creation failed: {errors}");
        }

        logger.LogInformation("Seed user created for {Email}.", email);
    }
}
