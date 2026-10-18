using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

internal static class ScheduleCapacityMigrationChecks
{
    public static async Task Run(string connectionString)
    {
        const string schema = "ScheduleCapacityMigrationCheck";
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();
        async Task Execute(string sql)
        {
            await using var command = new SqlCommand(sql, connection, transaction);
            await command.ExecuteNonQueryAsync();
        }
        async Task<int> Scalar(string sql)
        {
            await using var command = new SqlCommand(sql, connection, transaction);
            return Convert.ToInt32(await command.ExecuteScalarAsync());
        }
        void Check(bool condition, string description)
        {
            if (!condition) throw new Exception(description);
            Console.WriteLine("PASS " + description);
        }
        try
        {
            await Execute($"EXEC('CREATE SCHEMA {schema}')");
            await Execute($"""
                CREATE TABLE {schema}.Locations (Id INT PRIMARY KEY, Capacity INT NOT NULL CONSTRAINT DF_Locations_Capacity DEFAULT (3));
                CREATE TABLE {schema}.ScheduleSlots ([Date] DATE, LocationId INT, TimeSlotId INT);
                CREATE TABLE {schema}.Bookings ([Date] DATE, LocationId INT, TimeSlotId INT, IsBooked BIT);
                INSERT {schema}.Locations VALUES (1,2),(2,5);
                INSERT {schema}.ScheduleSlots VALUES ('2026-10-18',1,1),('2026-10-18',2,1),('2026-10-18',1,2);
                INSERT {schema}.Bookings VALUES ('2026-10-18',1,2,1),('2026-10-18',1,2,1),('2026-10-18',1,2,1),('2026-10-18',1,2,0);
                """);
            var script = (await File.ReadAllTextAsync(Path.Combine("db", "scripts", "0016_AddScheduleSlotCapacity.sql")))
                .Replace("dbo.", schema + ".");
            async Task Migrate()
            {
                foreach (var batch in Regex.Split(script, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase))
                    if (!string.IsNullOrWhiteSpace(batch)) await Execute(batch);
            }
            await Migrate();
            Check(await Scalar($"SELECT COUNT(*) FROM {schema}.ScheduleSlots WHERE TimeSlotId=1 AND ((LocationId=1 AND Capacity=2) OR (LocationId=2 AND Capacity=5))") == 2,
                "Capacity upgrade retains each existing location's configured limit");
            Check(await Scalar($"SELECT Capacity FROM {schema}.ScheduleSlots WHERE LocationId=1 AND TimeSlotId=2") == 3,
                "Capacity upgrade never sets an interval below its existing booked count");
            await Execute($"UPDATE {schema}.ScheduleSlots SET Capacity=7 WHERE LocationId=2; INSERT {schema}.Locations (Id) VALUES (3)");
            await Migrate();
            Check(await Scalar($"SELECT Capacity FROM {schema}.Locations WHERE Id=3") == 2 &&
                await Scalar($"SELECT Capacity FROM {schema}.Locations WHERE Id=2") == 5,
                "Upgrade defaults new locations to two without rewriting existing settings");
            Check(await Scalar($"SELECT Capacity FROM {schema}.ScheduleSlots WHERE LocationId=2") == 7,
                "Reapplying the capacity migration preserves edited interval capacities");
            Check(await Scalar($"SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('{schema}.ScheduleSlots') AND name='Capacity' AND is_nullable=0") == 1,
                "Migrated interval capacity is non-nullable");
            await Execute($"SET XACT_ABORT OFF");
            try
            {
                await Execute($"UPDATE {schema}.ScheduleSlots SET Capacity=0 WHERE LocationId=1 AND TimeSlotId=1");
                throw new Exception("SQL accepted a zero capacity");
            }
            catch (SqlException e) when (e.Number == 547) { Console.WriteLine("PASS SQL rejects a zero interval capacity"); }
        }
        finally { await transaction.RollbackAsync(); }
    }
}
