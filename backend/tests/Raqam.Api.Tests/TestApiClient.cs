using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Raqam.Api.Contracts.Auth;
using Raqam.Application.Accounts;
using Raqam.Application.Categories;
using Raqam.Application.Ledger;
using Raqam.Application.Transactions;
using Raqam.Domain.Accounts;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Raqam.Infrastructure.Identity;
using Raqam.Infrastructure.Persistence;
using Xunit;

namespace Raqam.Api.Tests;

/// <summary>
/// A throwaway signed-in user plus an HTTP client that carries its auth cookie and CSRF
/// token (D018). Each test gets its own user (created in <c>InitializeAsync</c>, which xUnit
/// runs per test), so tests never share data. That means many sign-ins a minute, so the test
/// classes use <see cref="ApiFactory"/>, which raises the login rate limit (D019).
/// Disposing removes everything the user created, then the user.
/// </summary>
public sealed class TestApiClient : IAsyncDisposable
{
    public const string Password = "Finance-Test-Password-1!";

    /// <summary>Same JSON shape the API uses: camelCase, enums as names.</summary>
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _http;
    private string _csrfToken = string.Empty;

    private TestApiClient(WebApplicationFactory<Program> factory, HttpClient http, Guid userId, string email)
    {
        _factory = factory;
        _http = http;
        UserId = userId;
        Email = email;
    }

    public Guid UserId { get; }
    public string Email { get; }

    public static async Task<TestApiClient> CreateAsync(WebApplicationFactory<Program> factory, string label)
    {
        var (userId, email) = await TestDatabase.CreateUserAsync(factory, label);

        // HTTPS base address: the auth and antiforgery cookies are Secure.
        var http = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        var client = new TestApiClient(factory, http, userId, email);

        var login = await http.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        login.EnsureSuccessStatusCode();
        var loginResult = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.True(loginResult!.Succeeded, "The throwaway test user could not sign in.");

        // Fetched after sign-in: the token is tied to the signed-in identity.
        using var tokenDocument = JsonDocument.Parse(await http.GetStringAsync("/api/v1/auth/csrf-token"));
        client._csrfToken = tokenDocument.RootElement.GetProperty("token").GetString()!;

        return client;
    }

    // ---- Raw requests ----------------------------------------------------------------

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-CSRF-TOKEN", _csrfToken);

        if (body is not null)
        {
            // The runtime type is passed explicitly so the record's real shape is serialized.
            request.Content = JsonContent.Create(body, body.GetType(), options: Json);
        }

        return await _http.SendAsync(request);
    }

    public async Task<HttpStatusCode> StatusAsync(HttpMethod method, string url, object? body = null)
    {
        using var response = await SendAsync(method, url, body);
        return response.StatusCode;
    }

    /// <summary>Sends a request, asserts the status, and reads the JSON body.</summary>
    public async Task<T> SendAsync<T>(HttpMethod method, string url, object? body, HttpStatusCode expected)
    {
        using var response = await SendAsync(method, url, body);
        var text = await response.Content.ReadAsStringAsync();

        Assert.True(
            response.StatusCode == expected,
            $"{method} {url} returned {(int)response.StatusCode}, expected {(int)expected}. Body: {text}");

        return JsonSerializer.Deserialize<T>(text, Json)!;
    }

    public Task<T> GetAsync<T>(string url) => SendAsync<T>(HttpMethod.Get, url, null, HttpStatusCode.OK);

    // ---- Typed helpers (all expect success) ------------------------------------------

    public Task<AccountResponse> CreateAccountAsync(
        string name, decimal openingBalance, AccountType type = AccountType.Cash) =>
        SendAsync<AccountResponse>(
            HttpMethod.Post, "/api/v1/accounts",
            new CreateAccountRequest(name, type, openingBalance, null),
            HttpStatusCode.Created);

    public Task<CategoryResponse> CreateCategoryAsync(string name, CategoryType type, Guid? parentId = null) =>
        SendAsync<CategoryResponse>(
            HttpMethod.Post, "/api/v1/categories",
            new CreateCategoryRequest(name, type, parentId, null, null),
            HttpStatusCode.Created);

    public Task<TransactionResponse> CreateTransactionAsync(
        TransactionType type,
        decimal amount,
        DateOnly date,
        Guid sourceAccountId,
        Guid? destinationAccountId = null,
        Guid? categoryId = null,
        string? description = null,
        string? merchant = null) =>
        SendAsync<TransactionResponse>(
            HttpMethod.Post, "/api/v1/transactions",
            new CreateTransactionRequest(type, amount, date, sourceAccountId, destinationAccountId, categoryId, description, merchant),
            HttpStatusCode.Created);

    public Task<AccountBalanceResponse> GetBalanceAsync(Guid accountId, DateOnly? asOf = null)
    {
        var url = $"/api/v1/accounts/{accountId}/balance";
        if (asOf is { } date)
        {
            url += $"?asOf={date:yyyy-MM-dd}";
        }

        return GetAsync<AccountBalanceResponse>(url);
    }

    public Task<Raqam.Application.Common.PagedResult<TransactionResponse>> ListTransactionsAsync(string query = "") =>
        GetAsync<Raqam.Application.Common.PagedResult<TransactionResponse>>(
            "/api/v1/transactions" + (query.Length == 0 ? "" : "?" + query));

    public async ValueTask DisposeAsync()
    {
        _http.Dispose();
        await TestDatabase.DeleteUserAsync(_factory, UserId);
    }
}

/// <summary>Direct database access for tests: throwaway users, cleanup, and raw SQL checks.</summary>
public static class TestDatabase
{
    public static async Task<(Guid Id, string Email)> CreateUserAsync(WebApplicationFactory<Program> factory, string label)
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var email = $"{label}-{Guid.NewGuid():N}@example.test";
        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };

        var result = await userManager.CreateAsync(user, TestApiClient.Password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to create test user: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }

        return (user.Id, email);
    }

    /// <summary>
    /// Deletes a user's financial rows, then the user. The foreign keys are all Restrict
    /// (financial history is never cascade-deleted), so the order matters: transactions,
    /// then subcategories, then categories and accounts.
    /// </summary>
    public static async Task DeleteUserAsync(WebApplicationFactory<Program> factory, Guid userId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RaqamDbContext>();

        await db.Database.ExecuteSqlInterpolatedAsync($"""DELETE FROM "Transactions" WHERE "UserId" = {userId}""");
        await db.Database.ExecuteSqlInterpolatedAsync($"""DELETE FROM "Budgets" WHERE "UserId" = {userId}""");
        await db.Database.ExecuteSqlInterpolatedAsync($"""DELETE FROM "Categories" WHERE "UserId" = {userId} AND "ParentCategoryId" IS NOT NULL""");
        await db.Database.ExecuteSqlInterpolatedAsync($"""DELETE FROM "Categories" WHERE "UserId" = {userId}""");
        await db.Database.ExecuteSqlInterpolatedAsync($"""DELETE FROM "Accounts" WHERE "UserId" = {userId}""");

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is not null)
        {
            await userManager.DeleteAsync(user);
        }
    }

    public static async Task<T> WithDbAsync<T>(WebApplicationFactory<Program> factory, Func<RaqamDbContext, Task<T>> action)
    {
        using var scope = factory.Services.CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<RaqamDbContext>());
    }

    public static async Task WithDbAsync(WebApplicationFactory<Program> factory, Func<RaqamDbContext, Task> action)
    {
        using var scope = factory.Services.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<RaqamDbContext>());
    }

    /// <summary>
    /// Runs an action that the database should refuse and returns the PostgreSQL error
    /// code (23514 check, 23503 foreign key, 23505 unique), or "none" if it succeeded.
    /// Walks the exception chain because EF may wrap the provider exception.
    /// </summary>
    public static async Task<string> SqlStateAsync(Func<Task> action)
    {
        try
        {
            await action();
            return "none";
        }
        catch (Exception exception)
        {
            for (var current = exception; current is not null; current = current.InnerException!)
            {
                if (current is PostgresException postgres)
                {
                    return postgres.SqlState;
                }

                if (current.InnerException is null)
                {
                    break;
                }
            }

            throw;
        }
    }
}

/// <summary>
/// The application, with the login rate limit (D019, 5 per minute) raised so tests that sign
/// in a fresh user each can run. <c>RateLimitingTests</c> deliberately keeps the default
/// factory so the real limit stays covered.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder) =>
        builder.UseSetting("RateLimiting:LoginPermitLimit", "100000");
}
