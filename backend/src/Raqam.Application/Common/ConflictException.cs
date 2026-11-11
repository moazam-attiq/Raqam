namespace Raqam.Application.Common;

/// <summary>
/// The request is well-formed but clashes with current data: a duplicate name, or an
/// edit made against an out-of-date version (D027). Mapped to 409 by the API.
/// </summary>
public class ConflictException(string message) : Exception(message);
