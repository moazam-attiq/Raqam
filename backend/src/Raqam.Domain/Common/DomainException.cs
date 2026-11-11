namespace Raqam.Domain.Common;

/// <summary>
/// Raised when a business rule from the specification (§4, §6.2) is violated. The message
/// is written for the API client and contains no internal details, so the API layer can
/// return it as a 400 ProblemDetails.
/// </summary>
public class DomainException(string message) : Exception(message);
