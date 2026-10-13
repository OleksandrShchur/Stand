-- 0004_CreateAvailableDatesTable.sql
-- Whitelist of bookable calendar dates. A date is only bookable if present here AND IsActive = 1
-- AND within the tomorrow..+14 days horizon (enforced in application logic, not in SQL).
-- Idempotent: safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AvailableDates' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AvailableDates
    (
        Id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Date]        DATE               NOT NULL,
        IsActive      BIT                NOT NULL CONSTRAINT DF_AvailableDates_IsActive DEFAULT (1),
        CreatedAtUtc  DATETIME2(3)       NOT NULL CONSTRAINT DF_AvailableDates_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc  DATETIME2(3)       NULL
    );

    CREATE UNIQUE INDEX UQ_AvailableDates_Date ON dbo.AvailableDates ([Date]);
END
GO
