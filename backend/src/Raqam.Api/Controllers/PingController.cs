using Microsoft.AspNetCore.Mvc;

namespace Raqam.Api.Controllers;

// Phase 0 placeholder that proves the API starts and routes requests.
// Replace with the real /health endpoint in Phase 1.
[ApiController]
[Route("api/v1/ping")]
public class PingController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { service = "Raqam.Api", status = "ok" });
}
