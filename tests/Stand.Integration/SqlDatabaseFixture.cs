using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

[CollectionDefinition(Name)]
public sealed class SqlDatabaseCollection : ICollectionFixture<SqlDatabaseFixture>
{
    public const string Name = "Disposable SQL Server";
}

public sealed class SqlDatabaseFixture : IAsyncLifetime
{
    public async Task InitializeAsync()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "Stand.slnx"))) root = root.Parent;
        if (root is null) throw new InvalidOperationException("Cannot find the repository's SQL scripts.");

        // Deliberately fixed to StandPerfTest; application configuration is never consulted.
        var masterString = new SqlConnectionStringBuilder(ApiFactory.Connection) { InitialCatalog = "master" }.ConnectionString;
        await using (var master = new SqlConnection(masterString))
        {
            await master.OpenAsync();
            await using var create = new SqlCommand("IF DB_ID(N'StandPerfTest') IS NULL CREATE DATABASE [StandPerfTest]", master);
            await create.ExecuteNonQueryAsync();
        }
        await using var db = new SqlConnection(ApiFactory.Connection);
        await db.OpenAsync();
        var scripts = Directory.GetFiles(Path.Combine(root.FullName, "db", "scripts"), "*.sql").Order(StringComparer.OrdinalIgnoreCase).ToArray();
        // Bootstrap the ledger before checking pending scripts, as the migrator does.
        await ExecuteScript(db, await File.ReadAllTextAsync(scripts[0]));
        var applied = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using (var command = new SqlCommand("SELECT ScriptName FROM dbo.__SchemaVersions", db))
        await using (var reader = await command.ExecuteReaderAsync())
            while (await reader.ReadAsync()) applied.Add(reader.GetString(0));
        foreach (var script in scripts)
        {
            var name = Path.GetFileName(script);
            if (applied.Contains(name)) continue;
            var sql = await File.ReadAllTextAsync(script);
            await ExecuteScript(db, sql);
            await using var record = new SqlCommand("INSERT dbo.__SchemaVersions (ScriptName, Checksum) VALUES (@name, @checksum)", db);
            record.Parameters.AddWithValue("@name", name);
            record.Parameters.AddWithValue("@checksum", Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sql))));
            await record.ExecuteNonQueryAsync();
        }
    }

    private static async Task ExecuteScript(SqlConnection db, string sql)
    {
        foreach (var batch in Regex.Split(sql, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(batch)) continue;
            await using var command = new SqlCommand(batch, db) { CommandTimeout = 120 };
            await command.ExecuteNonQueryAsync();
        }
    }

    public Task DisposeAsync() => Task.CompletedTask;
}
