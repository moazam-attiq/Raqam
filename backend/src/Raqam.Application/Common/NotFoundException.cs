namespace Raqam.Application.Common;

/// <summary>
/// The requested record does not exist <em>for the current owner</em>. A record that
/// belongs to someone else is reported exactly like a missing one, so a caller cannot
/// probe for other users' ids (D026). Mapped to 404 by the API.
/// </summary>
public class NotFoundException(string message) : Exception(message);
