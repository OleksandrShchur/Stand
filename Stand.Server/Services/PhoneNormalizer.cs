using System.Text.RegularExpressions;

namespace Stand.Server.Services;

/// <summary>Normalizes and validates Ukrainian mobile phone numbers to E.164 (+380XXXXXXXXX).</summary>
public static partial class PhoneNormalizer
{
    [GeneratedRegex(@"[^\d+]")]
    private static partial Regex NonDigitOrPlus();

    /// <summary>
    /// Accepts common Ukrainian input formats (+380XXXXXXXXX, 380XXXXXXXXX, 0XXXXXXXXX, with or
    /// without spaces/dashes/parentheses) and returns the canonical "+380XXXXXXXXX" form, or
    /// null if the input is not a valid UA mobile number.
    /// </summary>
    public static string? TryNormalize(string? rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput))
        {
            return null;
        }

        var cleaned = NonDigitOrPlus().Replace(rawInput.Trim(), string.Empty);

        // Keep only a single leading '+', strip any other '+' characters.
        var hasLeadingPlus = cleaned.StartsWith('+');
        var digits = cleaned.Replace("+", string.Empty);

        string? nationalNumber = null;

        if (hasLeadingPlus && digits.StartsWith("380") && digits.Length == 12)
        {
            nationalNumber = digits[3..];
        }
        else if (!hasLeadingPlus && digits.StartsWith("380") && digits.Length == 12)
        {
            nationalNumber = digits[3..];
        }
        else if (!hasLeadingPlus && digits.StartsWith('0') && digits.Length == 10)
        {
            nationalNumber = digits[1..];
        }
        else if (!hasLeadingPlus && digits.Length == 9)
        {
            nationalNumber = digits;
        }

        if (nationalNumber is null || nationalNumber.Length != 9 || !nationalNumber.All(char.IsDigit))
        {
            return null;
        }

        // Ukrainian mobile prefixes start with 3, 5, 6, 7 or 9 (first digit of the 9-digit national number).
        if (nationalNumber[0] is not ('3' or '5' or '6' or '7' or '9'))
        {
            return null;
        }

        return $"+380{nationalNumber}";
    }
}
