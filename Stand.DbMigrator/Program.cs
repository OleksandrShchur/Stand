using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Stand.DbMigrator;

/// <summary>
/// Applies the numbered, idempotent SQL scripts in db/scripts (in order) against the
/// configured SQL Server database, tracking what has already been applied in the
/// dbo.__SchemaVersions table. Re-running this tool is always safe:
///   - already-applied scripts are skipped at the runner level (by file name),
///   - every script is additionally written so that re-running its SQL body is a no-op.
///
/// Usage:
///   dotnet run --project Stand.DbMigrator                       Apply all pending scripts.
///   dotnet run --project Stand.DbMigrator -- hash &lt;password&gt;      Print a password hash
///                                                                  (ASP.NET Core Identity
///                                                                  PasswordHasher format)
///                                                                  for seeding admin users.
///
/// Connection string resolution order:
///   1. --connection "..." command line argument
///   2. ConnectionStrings:Default in appsettings.json (next to this exe) or environment
///      variable ConnectionStrings__Default
///   3. Fallback to a local SQL Server LocalDB database named StandDb
/// </summary>
internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        if (args.Length >= 1 && string.Equals(args[0], "hash", StringComparison.OrdinalIgnoreCase))
        {
            var password = args.Length >= 2 ? args[1] : "ChangeMe!Admin1";
            var hasher = new PasswordHasher<string>();
            var hash = hasher.HashPassword("admin", password);
            Console.WriteLine(hash);
            return 0;
        }

        var config = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true)
            .AddEnvironmentVariables()
            .AddCommandLine(args)
            .Build();

        var connectionString =
            config["connection"] ??
            config.GetConnectionString("Default") ??
            "Server=(localdb)\\MSSQLLocalDB;Database=StandDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";

        var scriptsDir = ResolveScriptsDirectory(config["scripts"]);
        if (scriptsDir is null)
        {
            Console.Error.WriteLine("Could not locate the db/scripts directory. Pass --scripts <path> explicitly.");
            return 1;
        }

        Console.WriteLine($"Scripts directory : {scriptsDir}");
        Console.WriteLine($"Connection string  : {Redact(connectionString)}");

        try
        {
            await RunnerAsync(connectionString, scriptsDir);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Migration failed: {ex.Message}");
            return 1;
        }

        return 0;
    }

    private static async Task RunnerAsync(string connectionString, string scriptsDir)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        // Step 1: ensure __SchemaVersions exists regardless of script file state.
        await EnsureSchemaVersionsTableAsync(connection);

        // Step 2: figure out what has already been applied.
        var applied = await GetAppliedScriptNamesAsync(connection);

        // Step 3: apply pending scripts, in filename order.
        var files = Directory.GetFiles(scriptsDir, "*.sql")
            .OrderBy(f => Path.GetFileName(f), StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (files.Count == 0)
        {
            Console.WriteLine("No .sql scripts found.");
            return;
        }

        var appliedCount = 0;
        foreach (var file in files)
        {
            var name = Path.GetFileName(file);
            if (applied.Contains(name))
            {
                Console.WriteLine($"[skip]  {name} (already applied)");
                continue;
            }

            Console.WriteLine($"[apply] {name}");
            var sql = await File.ReadAllTextAsync(file);
            var checksum = ComputeChecksum(sql);

            await ExecuteBatchedSqlAsync(connection, sql);
            await RecordAppliedAsync(connection, name, checksum);
            appliedCount++;
        }

        Console.WriteLine(appliedCount == 0
            ? "Database is already up to date."
            : $"Applied {appliedCount} script(s) successfully.");
    }

    private static async Task EnsureSchemaVersionsTableAsync(SqlConnection connection)
    {
        const string sql = """
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__SchemaVersions' AND schema_id = SCHEMA_ID('dbo'))
            BEGIN
                CREATE TABLE dbo.__SchemaVersions
                (
                    Id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    ScriptName    NVARCHAR(260)      NOT NULL,
                    Checksum      NVARCHAR(100)      NULL,
                    AppliedOnUtc  DATETIME2(3)       NOT NULL CONSTRAINT DF___SchemaVersions_AppliedOnUtc DEFAULT SYSUTCDATETIME()
                );

                CREATE UNIQUE INDEX UQ___SchemaVersions_ScriptName ON dbo.__SchemaVersions (ScriptName);
            END
            """;

        await using var cmd = new SqlCommand(sql, connection);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task<HashSet<string>> GetAppliedScriptNamesAsync(SqlConnection connection)
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        const string sql = "SELECT ScriptName FROM dbo.__SchemaVersions";
        await using var cmd = new SqlCommand(sql, connection);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(reader.GetString(0));
        }

        return result;
    }

    private static async Task RecordAppliedAsync(SqlConnection connection, string scriptName, string checksum)
    {
        const string sql = """
            INSERT INTO dbo.__SchemaVersions (ScriptName, Checksum, AppliedOnUtc)
            VALUES (@name, @checksum, SYSUTCDATETIME())
            """;
        await using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@name", scriptName);
        cmd.Parameters.AddWithValue("@checksum", checksum);
        await cmd.ExecuteNonQueryAsync();
    }

    /// <summary>
    /// SqlClient cannot execute "GO" batch separators directly, so split on lines containing
    /// only "GO" (case-insensitive, optional whitespace) and execute each batch separately.
    /// </summary>
    private static async Task ExecuteBatchedSqlAsync(SqlConnection connection, string sql)
    {
        var batches = SplitOnGo(sql);
        foreach (var batch in batches)
        {
            if (string.IsNullOrWhiteSpace(batch))
            {
                continue;
            }

            await using var cmd = new SqlCommand(batch, connection)
            {
                CommandTimeout = 120,
            };
            await cmd.ExecuteNonQueryAsync();
        }
    }

    private static IEnumerable<string> SplitOnGo(string sql)
    {
        var lines = sql.Replace("\r\n", "\n").Split('\n');
        var current = new List<string>();
        foreach (var line in lines)
        {
            if (line.Trim().Equals("GO", StringComparison.OrdinalIgnoreCase))
            {
                yield return string.Join('\n', current);
                current.Clear();
            }
            else
            {
                current.Add(line);
            }
        }

        if (current.Count > 0)
        {
            yield return string.Join('\n', current);
        }
    }

    private static string ComputeChecksum(string content)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(content);
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private static string? ResolveScriptsDirectory(string? explicitPath)
    {
        if (!string.IsNullOrWhiteSpace(explicitPath) && Directory.Exists(explicitPath))
        {
            return explicitPath;
        }

        // Walk up from the executable/base directory looking for a "db/scripts" folder,
        // which works both when run via `dotnet run` (project dir) and from a published exe
        // (as long as it is copied alongside, or run from the repo).
        var candidates = new List<string> { AppContext.BaseDirectory, Directory.GetCurrentDirectory() };
        foreach (var start in candidates)
        {
            var dir = new DirectoryInfo(start);
            for (var i = 0; i < 8 && dir is not null; i++)
            {
                var candidate = Path.Combine(dir.FullName, "db", "scripts");
                if (Directory.Exists(candidate))
                {
                    return candidate;
                }

                dir = dir.Parent;
            }
        }

        return null;
    }

    private static string Redact(string connectionString)
    {
        return System.Text.RegularExpressions.Regex.Replace(
            connectionString,
            "(Password|Pwd)=([^;]*)",
            "$1=***",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }
}
