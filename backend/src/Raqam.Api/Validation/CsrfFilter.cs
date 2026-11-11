using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Raqam.Api.Validation;

/// <summary>
/// Validates the CSRF double-submit token (D018) on every unsafe-verb request, unless the
/// action carries [SkipCsrfValidation]. Written directly against IAntiforgery rather than
/// the built-in AutoValidateAntiforgeryTokenAttribute — that attribute resolves its filter
/// via DI registrations that only AddControllersWithViews/AddMvc set up (the MVC view
/// engine's "ViewFeatures" services), which this API-only project (AddControllers) doesn't
/// register; using it here throws "No service for type ...AutoValidateAntiforgeryTokenAuth
/// orizationFilter has been registered" at request time.
/// </summary>
public class CsrfFilter(IAntiforgery antiforgery) : IAsyncActionFilter
{
    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Get, HttpMethods.Head, HttpMethods.Options, HttpMethods.Trace,
    };

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var request = context.HttpContext.Request;
        var isExempt = context.ActionDescriptor.EndpointMetadata
            .Any(metadata => metadata is SkipCsrfValidationAttribute);

        if (isExempt || SafeMethods.Contains(request.Method))
        {
            await next();
            return;
        }

        try
        {
            await antiforgery.ValidateRequestAsync(context.HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            context.Result = new BadRequestObjectResult("A valid CSRF token is required.");
            return;
        }

        await next();
    }
}
