namespace Raqam.Api.Validation;

/// <summary>
/// Marks an action as exempt from CsrfFilter — used only on POST /auth/login, where no
/// session exists yet to have handed out a token to validate the request against.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public class SkipCsrfValidationAttribute : Attribute;
