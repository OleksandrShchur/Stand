-- 0003_CreateTimeSlotsTable.sql
-- Global list of time-of-day ranges (not tied to a specific date). Arbitrary from-to.
-- Idempotent: safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TimeSlots' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.TimeSlots
    (
        Id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        StartTime     TIME(0)            NOT NULL,
        EndTime       TIME(0)            NOT NULL,
        SortOrder     INT                NOT NULL CONSTRAINT DF_TimeSlots_SortOrder DEFAULT (0),
        IsActive      BIT                NOT NULL CONSTRAINT DF_TimeSlots_IsActive DEFAULT (1),
        CreatedAtUtc  DATETIME2(3)       NOT NULL CONSTRAINT DF_TimeSlots_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc  DATETIME2(3)       NULL,

        CONSTRAINT CK_TimeSlots_StartBeforeEnd CHECK (StartTime < EndTime)
    );

    CREATE INDEX IX_TimeSlots_IsActive_SortOrder ON dbo.TimeSlots (IsActive, SortOrder);
END
GO
