using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Raqam.Api.Tests;

public class AuthorizationTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Me_WithoutAuthentication_ReturnsUnauthorized()
    {
        // The global fallback policy (Program.cs) requires authentication on every
        // endpoint unless explicitly exempted; this is the one endpoint that reads
        // back the authenticated user, so it's the simplest place to prove the policy
        // is actually enforced rather than just configured.
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/v1/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
