using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Raqam.Api.Tests;

public class HealthEndpointTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Health_ReturnsOk_WhenDatabaseIsReachable()
    {
        // This talks to the real local PostgreSQL database configured via user-secrets —
        // there is no fake/in-memory provider substituted here. If the database in
        // ConnectionStrings:Default isn't reachable, this test fails for that reason, not
        // because of a code regression.
        var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }
}
