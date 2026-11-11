using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Raqam.Api.Contracts.Auth;
using Xunit;

namespace Raqam.Api.Tests;

public class RateLimitingTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Login_SixthAttemptWithinAMinute_ReturnsTooManyRequests()
    {
        // The "login" policy (D019) permits 5 attempts/minute per client IP, independent
        // of whether the credentials are real — the limiter runs before PasswordSignInAsync
        // is ever called, so bogus credentials exercise it just as well.
        var client = factory.CreateClient();
        var request = new LoginRequest("nobody@example.test", "definitely-wrong");

        HttpResponseMessage? response = null;
        for (var attempt = 0; attempt < 6; attempt++)
        {
            response = await client.PostAsJsonAsync("/api/v1/auth/login", request);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, response!.StatusCode);
    }
}
