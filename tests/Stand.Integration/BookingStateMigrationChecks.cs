using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

internal static class BookingStateMigrationChecks
{
    public static async Task Run(string connectionString)
    {
        // Run the actual upgrade twice inside an outer rollback-only transaction,
        // using a separate schema so application tables are never changed here.
        const string schema = "BookingStateMigrationCheck";
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
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
            Console.WriteLine("PASS " + message);
        }
        try
        {
            await Execute($"EXEC('CREATE SCHEMA {schema}')");
            await Execute($"""
                CREATE TABLE {schema}.Bookings (
                    Id INT IDENTITY PRIMARY KEY, [Date] DATE NOT NULL, LocationId INT NOT NULL, TimeSlotId INT NOT NULL,
                    Phone NVARCHAR(20) NULL,
                    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Bookings_Status DEFAULT 'Held',
                    CreatedAtUtc DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
                    ConfirmedAtUtc DATETIME2(3) NULL, CancelledAtUtc DATETIME2(3) NULL, HoldExpiresAtUtc DATETIME2(3) NULL,
                    CancelToken UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
                    CONSTRAINT CK_Bookings_Status CHECK (Status IN ('Held','Confirmed','Cancelled'))
                );
                CREATE INDEX IX_Bookings_Date_Location_TimeSlot_Status ON {schema}.Bookings ([Date],LocationId,TimeSlotId,Status) INCLUDE(HoldExpiresAtUtc);
                CREATE UNIQUE INDEX UQ_Bookings_Phone_Date_Location_TimeSlot ON {schema}.Bookings (Phone,[Date],LocationId,TimeSlotId) WHERE Status <> 'Cancelled' AND Phone IS NOT NULL;
                INSERT {schema}.Bookings ([Date],LocationId,TimeSlotId,Phone,Status,ConfirmedAtUtc,HoldExpiresAtUtc) VALUES
                    ('2026-10-18',1,1,'+380670000001','Confirmed','2026-10-17T09:00:00',NULL),
                    ('2026-10-18',1,1,'+380670000002','Cancelled','2026-10-17T10:00:00',NULL),
                    ('2026-10-18',1,1,'+380670000003','Held',NULL,DATEADD(MINUTE,5,SYSUTCDATETIME())),
                    ('2026-10-18',1,1,'+380670000004','Held',NULL,DATEADD(MINUTE,-5,SYSUTCDATETIME()));
                SELECT CancelToken INTO {schema}.OriginalTokens FROM {schema}.Bookings;
                """);
            var script = (await File.ReadAllTextAsync(Path.Combine("db", "scripts", "0015_SimplifyBookingState.sql")))
                .Replace("dbo.", schema + ".");
            for (var attempt = 0; attempt < 2; attempt++)
                foreach (var batch in Regex.Split(script, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase))
                    if (!string.IsNullOrWhiteSpace(batch)) await Execute(batch);
            Check(await Scalar($"SELECT COUNT(*) FROM {schema}.Bookings WHERE IsBooked=1 AND Id=1 AND BookedAtUtc='2026-10-17T09:00:00'") == 1,
                "Upgrade preserves real bookings and their original booked time");
            Check(await Scalar($"SELECT COUNT(*) FROM {schema}.Bookings WHERE IsBooked=0 AND CancelledAtUtc IS NOT NULL") == 3,
                "Cancelled rows and unfinished legacy holds migrate to not booked");
            Check(await Scalar($"SELECT COUNT(*) FROM {schema}.Bookings b INNER JOIN {schema}.OriginalTokens t ON t.CancelToken=b.CancelToken") == 4,
                "Upgrade preserves history and cancellation tokens when run repeatedly");
            Check(await Scalar($"SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('{schema}.Bookings') AND name IN ('Status','HoldExpiresAtUtc','ConfirmedAtUtc')") == 0,
                "Legacy status and hold columns are removed from the schema");
            await Execute($"SET XACT_ABORT OFF; INSERT {schema}.Bookings ([Date],LocationId,TimeSlotId,Phone,IsBooked) VALUES ('2026-10-18',1,1,'+380670000001',0)");
            try
            {
                await Execute($"INSERT {schema}.Bookings ([Date],LocationId,TimeSlotId,Phone,IsBooked) VALUES ('2026-10-18',1,1,'+380670000001',1)");
                throw new Exception("Duplicate booked row was accepted");
            }
            catch (SqlException ex) when (ex.Number is 2601 or 2627)
            {
                Console.WriteLine("PASS Binary unique index permits inactive history and rejects duplicate booked rows");
            }
        }
        finally { await transaction.RollbackAsync(); }
    }
}
