using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Raqam.Application.Common;
using Raqam.Domain.Common;

namespace Raqam.Api.ErrorHandling;

/// <summary>
/// Catches any exception that reaches the end of the middleware pipeline and turns it
/// into a ProblemDetails response instead of a raw stack trace. A <see cref="DomainException"/>
/// (a broken business rule) becomes a 400, a <see cref="NotFoundException"/> a 404 and a
/// <see cref="ConflictException"/> a 409; everything else is a 500. Request-shape errors
/// are handled earlier by FluentValidation (D013).
/// </summary>
public class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IHostEnvironment environment) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        // A broken business rule, a missing record, or a conflicting edit is the client's
        // situation, not a server fault: answer 400 / 404 / 409 with the exception's message
        // (written for clients, no internal detail) and no stack trace.
        if (exception is DomainException or NotFoundException or ConflictException)
        {
            logger.LogInformation("Request rejected ({Kind}) {Method} {Path}",
                exception.GetType().Name, httpContext.Request.Method, httpContext.Request.Path);

            var (status, title, type) = exception switch
            {
                NotFoundException => (
                    StatusCodes.Status404NotFound,
                    "The record was not found.",
                    "https://tools.ietf.org/html/rfc9110#section-15.5.5"),
                ConflictException => (
                    StatusCodes.Status409Conflict,
                    "The request conflicts with the current data.",
                    "https://tools.ietf.org/html/rfc9110#section-15.5.10"),
                _ => (
                    StatusCodes.Status400BadRequest,
                    "The request breaks a business rule.",
                    "https://tools.ietf.org/html/rfc9110#section-15.5.1"),
            };

            var clientError = new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = exception.Message,
                Type = type,
            };

            httpContext.Response.StatusCode = status;
            await httpContext.Response.WriteAsJsonAsync(clientError, cancellationToken);

            return true;
        }

        // Log the real exception server-side; never leak it to the client in production.
        logger.LogError(exception, "Unhandled exception processing {Method} {Path}",
            httpContext.Request.Method, httpContext.Request.Path);

        var problemDetails = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An unexpected error occurred.",
            Type = "https://tools.ietf.org/html/rfc9110#section-15.6.1",
        };

        // Stack traces and exception messages are a development-only convenience.
        if (environment.IsDevelopment())
        {
            problemDetails.Detail = exception.ToString();
        }

        httpContext.Response.StatusCode = problemDetails.Status.Value;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true;
    }
}
