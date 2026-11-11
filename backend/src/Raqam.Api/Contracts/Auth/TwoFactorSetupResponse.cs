namespace Raqam.Api.Contracts.Auth;

public record TwoFactorSetupResponse(string SharedKey, string AuthenticatorUri);
