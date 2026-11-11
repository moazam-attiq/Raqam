using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Raqam.Api.Contracts.Auth;
using Raqam.Infrastructure.Identity;
using Xunit;

namespace Raqam.Api.Tests;

public class CsrfTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    // Logout is the only authenticated, unsafe-verb endpoint that exists right now, so it's
    // what exercises the CSRF filter (D018) — login itself is deliberately exempt. Uses a
    // throwaway user created directly via UserManager rather than the real seed credentials,
    // since those live only in the user's own secrets and shouldn't be known to a test.
    private const string Password = "Csrf-Test-Password-1!";

    [Fact]
    public async Task Logout_WithoutCsrfToken_IsRejected()
    {
        var client = CreateHttpsClient();
        var email = await CreateTestUserAsync();

        try
        {
            await LoginAsync(client, email);

            var response = await client.PostAsync("/api/v1/auth/logout", content: null);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        finally
        {
            await DeleteTestUserAsync(email);
        }
    }

    [Fact]
    public async Task Logout_WithValidCsrfToken_Succeeds()
    {
        var client = CreateHttpsClient();
        var email = await CreateTestUserAsync();

        try
        {
            await LoginAsync(client, email);

            var tokenResponse = await client.GetFromJsonAsync<CsrfTokenResponse>("/api/v1/auth/csrf-token");

            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
            request.Headers.Add("X-CSRF-TOKEN", tokenResponse!.token);
            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }
        finally
        {
            await DeleteTestUserAsync(email);
        }
    }

    // The auth and antiforgery cookies are both Secure (D016/D018), and HttpClient's cookie
    // container only stores/sends Secure cookies over an https-looking base address — the
    // in-memory TestServer doesn't need a real certificate for this to work.
    private HttpClient CreateHttpsClient() =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    private static async Task LoginAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        response.EnsureSuccessStatusCode();
    }

    private async Task<string> CreateTestUserAsync()
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var email = $"csrf-test-{Guid.NewGuid():N}@example.test";
        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };

        var result = await userManager.CreateAsync(user, Password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to create test user: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }

        return email;
    }

    private async Task DeleteTestUserAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var user = await userManager.FindByEmailAsync(email);
        if (user is not null)
        {
            await userManager.DeleteAsync(user);
        }
    }

    private record CsrfTokenResponse(string token);
}
