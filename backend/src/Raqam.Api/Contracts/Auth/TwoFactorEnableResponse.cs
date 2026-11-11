namespace Raqam.Api.Contracts.Auth;

public record TwoFactorEnableResponse(IEnumerable<string> RecoveryCodes);
