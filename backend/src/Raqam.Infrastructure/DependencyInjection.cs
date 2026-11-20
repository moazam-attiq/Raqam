using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Raqam.Application.Accounts;
using Raqam.Application.Budgets;
using Raqam.Application.Categories;
using Raqam.Application.Common;
using Raqam.Application.Transactions;
using Raqam.Infrastructure.Identity;
using Raqam.Infrastructure.Persistence;
using Raqam.Infrastructure.Persistence.Repositories;

namespace Raqam.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'ConnectionStrings:Default' is not configured.");

        services.AddDbContext<RaqamDbContext>(options => options.UseNpgsql(connectionString));

        // Persistence behind the interfaces the Application layer defines (D025). Scoped, so
        // they all share the request's one DbContext and one save is one transaction.
        services.AddScoped<IAccountRepository, AccountRepository>();
        services.AddScoped<IBudgetRepository, BudgetRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // AddIdentity (rather than the lighter AddIdentityCore) sets up the cookie
        // authentication schemes Identity's own sign-in and two-factor flows expect
        // (application, external, two-factor-user-id, two-factor-remember-me) — see D016.
        services
            .AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
            {
                // Raqam has one user, created by a seed step, not public registration (D017).
                // Still enforce a real policy in case a password is ever reset.
                options.Password.RequiredLength = 12;
                options.User.RequireUniqueEmail = true;

                // Lockout matches spec §8.1 ("lockout or progressive delay for repeated
                // failed attempts"); exact thresholds can be tuned without a new decision.
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddEntityFrameworkStores<RaqamDbContext>()
            .AddDefaultTokenProviders();

        // This is an API, not a page-based app: there is no /Account/Login to redirect
        // to. Return 401/403 instead of Identity's default redirect behaviour.
        services.ConfigureApplicationCookie(options =>
        {
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };

            // Cross-site cookie settings: the frontend (Vercel) and API (Render) are
            // expected to be on different domains (spec §9.2–§9.3).
            options.Cookie.SameSite = SameSiteMode.None;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        });

        return services;
    }
}
