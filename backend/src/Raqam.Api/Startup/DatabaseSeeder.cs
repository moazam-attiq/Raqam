using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Raqam.Domain.Categories;
using Raqam.Infrastructure.Identity;
using Raqam.Infrastructure.Persistence;

namespace Raqam.Api.Startup;

/// <summary>
/// Creates Raqam's one user on startup, since public registration is deliberately off
/// (D017), then gives that user the default categories (D021). Reads the account from
/// configuration — set locally via `dotnet user-secrets set "SeedUser:Email" ...` /
/// "SeedUser:Password" — and never logs the password. Safe to run on every startup: it
/// does nothing once any user exists, and does nothing (just warns) if the seed
/// configuration isn't set, so it can't crash a test host or an environment that hasn't
/// configured it yet. Default categories are only ever created for the configured seed
/// user, and only while that user has no categories at all, so renamed or archived
/// defaults are never re-created.
/// </summary>
public static class DatabaseSeeder
{
    // Spec §3.4 examples. Top-level only; the user adds subcategories as needed.
    private static readonly string[] DefaultExpenseCategories =
    [
        "Food", "Transport", "Housing", "Utilities", "Shopping",
        "Health", "Education", "Entertainment", "Subscriptions", "Other",
    ];

    private static readonly string[] DefaultIncomeCategories =
    [
        "Salary", "Freelance", "Business", "Gifts", "Other income",
    ];

    // Arbitrary constant; every host that seeds categories must use the same one.
    private const long SeedLockKey = 7_203_001;

    public static async Task SeedAsync(IServiceProvider services, ILogger logger)
    {
        await SeedUserAsync(services, logger);
        await SeedDefaultCategoriesAsync(services, logger);
    }

    private static async Task SeedUserAsync(IServiceProvider services, ILogger logger)
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

    private static async Task SeedDefaultCategoriesAsync(IServiceProvider services, ILogger logger)
    {
        // Only the configured seed user, never "whichever users exist": test runs create and
        // delete throwaway users, and giving one of those categories would make deleting it
        // fail (user foreign keys are Restrict).
        var email = services.GetRequiredService<IConfiguration>()["SeedUser:Email"];
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return;
        }

        var db = services.GetRequiredService<RaqamDbContext>();

        // Several hosts can start at the same moment (xUnit runs test classes in parallel
        // and each one starts its own host). Without a lock they all pass the "no categories
        // yet" check and insert at once, and the inserts deadlock or clash on the unique
        // category-name index. A PostgreSQL advisory lock makes check-then-insert atomic
        // across hosts. It belongs to one database connection, so the connection is held
        // open for the whole block and the lock is released before it is closed.
        await db.Database.OpenConnectionAsync();
        try
        {
            await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_lock({SeedLockKey})");
            try
            {
                if (await db.Categories.AnyAsync(c => c.UserId == user.Id))
                {
                    return;
                }

                var now = DateTime.UtcNow;

                foreach (var name in DefaultExpenseCategories)
                {
                    db.Categories.Add(Category.Create(user.Id, name, CategoryType.Expense, null, null, null, now));
                }

                foreach (var name in DefaultIncomeCategories)
                {
                    db.Categories.Add(Category.Create(user.Id, name, CategoryType.Income, null, null, null, now));
                }

                await db.SaveChangesAsync();
                logger.LogInformation("Default categories created for the seed user.");
            }
            finally
            {
                await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_unlock({SeedLockKey})");
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }
}
