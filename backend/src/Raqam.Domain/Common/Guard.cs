namespace Raqam.Domain.Common;

/// <summary>Small input checks shared by the entities. Trims text before checking it.</summary>
internal static class Guard
{
    public static Guid NotEmpty(Guid value, string fieldName)
    {
        if (value == Guid.Empty)
            throw new DomainException($"{fieldName} is required.");

        return value;
    }

    public static string RequiredText(string? value, int maxLength, string fieldName)
    {
        var trimmed = value?.Trim();

        if (string.IsNullOrEmpty(trimmed))
            throw new DomainException($"{fieldName} is required.");

        if (trimmed.Length > maxLength)
            throw new DomainException($"{fieldName} must be at most {maxLength} characters.");

        return trimmed;
    }

    /// <summary>Returns null for null or whitespace; otherwise the trimmed text.</summary>
    public static string? OptionalText(string? value, int maxLength, string fieldName)
    {
        var trimmed = value?.Trim();

        if (string.IsNullOrEmpty(trimmed))
            return null;

        if (trimmed.Length > maxLength)
            throw new DomainException($"{fieldName} must be at most {maxLength} characters.");

        return trimmed;
    }
}
