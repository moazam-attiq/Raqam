using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Raqam.Api.Contracts.Auth;
using Raqam.Infrastructure.Identity;
using Xunit;

namespace Raqam.Api.Tests;

public class TwoFactorTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private const string Password = "TwoFactor-Test-Password-1!";

    [Fact]
    public async Task EnableAndDisable_RoundTrip_UpdatesStatus()
    {
        var client = CreateHttpsClient();
        var email = await CreateTestUserAsync();

        try
        {
            await LoginAsync(client, email);

            var statusBefore = await client.GetFromJsonAsync<TwoFactorStatusResponse>("/api/v1/auth/two-factor/status");
            Assert.False(statusBefore!.Enabled);

            var setup = await PostWithCsrfForJsonAsync<TwoFactorSetupResponse>(
                client, "/api/v1/auth/two-factor/setup", content: null);

            var enableResult = await PostWithCsrfForJsonAsync<TwoFactorEnableResponse>(
                client, "/api/v1/auth/two-factor/enable", new TwoFactorEnableRequest(GenerateTotpCode(setup!.SharedKey)));
            Assert.NotEmpty(enableResult!.RecoveryCodes);

            var statusAfterEnable = await client.GetFromJsonAsync<TwoFactorStatusResponse>("/api/v1/auth/two-factor/status");
            Assert.True(statusAfterEnable!.Enabled);

            var disableResponse = await PostWithCsrfAsync(client, "/api/v1/auth/two-factor/disable", content: null);
            Assert.Equal(HttpStatusCode.NoContent, disableResponse.StatusCode);

            var statusAfterDisable = await client.GetFromJsonAsync<TwoFactorStatusResponse>("/api/v1/auth/two-factor/status");
            Assert.False(statusAfterDisable!.Enabled);
        }
        finally
        {
            await DeleteTestUserAsync(email);
        }
    }

    [Fact]
    public async Task Login_WithTwoFactorEnabled_RequiresVerifyToCompleteSignIn()
    {
        var setupClient = CreateHttpsClient();
        var email = await CreateTestUserAsync();

        try
        {
            await LoginAsync(setupClient, email);

            var setup = await PostWithCsrfForJsonAsync<TwoFactorSetupResponse>(
                setupClient, "/api/v1/auth/two-factor/setup", content: null);
            await PostWithCsrfForJsonAsync<TwoFactorEnableResponse>(
                setupClient, "/api/v1/auth/two-factor/enable", new TwoFactorEnableRequest(GenerateTotpCode(setup!.SharedKey)));

            // A fresh client/cookie jar — simulates returning for a new login once 2FA is on.
            var loginClient = CreateHttpsClient();
            var loginResponse = await loginClient.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
            var loginResult = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();

            Assert.False(loginResult!.Succeeded);
            Assert.True(loginResult.RequiresTwoFactor);

            // Not fully signed in yet — the pending-2FA cookie isn't the main session cookie.
            var meBeforeVerify = await loginClient.GetAsync("/api/v1/auth/me");
            Assert.Equal(HttpStatusCode.Unauthorized, meBeforeVerify.StatusCode);

            var verifyResponse = await loginClient.PostAsJsonAsync(
                "/api/v1/auth/two-factor/verify", new TwoFactorVerifyRequest(GenerateTotpCode(setup.SharedKey)));
            var verifyResult = await verifyResponse.Content.ReadFromJsonAsync<LoginResponse>();
            Assert.True(verifyResult!.Succeeded);

            var meAfterVerify = await loginClient.GetAsync("/api/v1/auth/me");
            Assert.Equal(HttpStatusCode.OK, meAfterVerify.StatusCode);
        }
        finally
        {
            await DeleteTestUserAsync(email);
        }
    }

    private HttpClient CreateHttpsClient() =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    private static async Task LoginAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        response.EnsureSuccessStatusCode();
    }

    // Mutating endpoints require a CSRF token (D018); fetch one and attach it before posting.
    private static async Task<HttpResponseMessage> PostWithCsrfAsync(HttpClient client, string url, object? content)
    {
        var tokenResponse = await client.GetFromJsonAsync<CsrfTokenResponse>("/api/v1/auth/csrf-token");

        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("X-CSRF-TOKEN", tokenResponse!.token);
        if (content is not null)
        {
            // Pass the runtime type explicitly — JsonContent.Create<T>(content) would bind T to
            // this parameter's static type (object) and serialize "{}" instead of the real shape.
            request.Content = JsonContent.Create(content, content.GetType());
        }

        return await client.SendAsync(request);
    }

    private static async Task<TResponse?> PostWithCsrfForJsonAsync<TResponse>(HttpClient client, string url, object? content)
    {
        var response = await PostWithCsrfAsync(client, url, content);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<TResponse>();
    }

    private async Task<string> CreateTestUserAsync()
    {
        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var email = $"2fa-test-{Guid.NewGuid():N}@example.test";
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

    private static byte[] Base32Decode(string base32)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        base32 = base32.TrimEnd('=').ToUpperInvariant();

        var bits = new StringBuilder();
        foreach (var c in base32)
        {
            bits.Append(Convert.ToString(alphabet.IndexOf(c), 2).PadLeft(5, '0'));
        }

        var bytes = new List<byte>();
        for (var i = 0; i + 8 <= bits.Length; i += 8)
        {
            bytes.Add(Convert.ToByte(bits.ToString(i, 8), 2));
        }

        return bytes.ToArray();
    }

    // The same RFC 6238 TOTP algorithm ASP.NET Core Identity's "Authenticator" token
    // provider uses (HMAC-SHA1, 30-second step, 6 digits, no extra modifier) — reimplemented
    // here rather than called, since Identity's Rfc6238AuthenticationService is internal.
    private static string GenerateTotpCode(string base32Secret)
    {
        var key = Base32Decode(base32Secret);
        var timestep = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;

        var timestepBytes = BitConverter.GetBytes(timestep);
        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(timestepBytes);
        }

        using var hmac = new HMACSHA1(key);
        var hash = hmac.ComputeHash(timestepBytes);

        var offset = hash[^1] & 0xf;
        var binaryCode = ((hash[offset] & 0x7f) << 24)
            | ((hash[offset + 1] & 0xff) << 16)
            | ((hash[offset + 2] & 0xff) << 8)
            | (hash[offset + 3] & 0xff);

        return (binaryCode % 1_000_000).ToString("D6");
    }

    private record CsrfTokenResponse(string token);
}
