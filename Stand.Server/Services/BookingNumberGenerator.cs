using System.Security.Cryptography;

namespace Stand.Server.Services;

/// <summary>Generates human-friendly public booking numbers, e.g. "STD-20261014-A7K2".</summary>
public static class BookingNumberGenerator
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

    public static string Generate(DateOnly date)
    {
        var suffix = RandomNumberGenerator.GetString(Alphabet, 5);
        return $"STD-{date:yyyyMMdd}-{suffix}";
    }
}
