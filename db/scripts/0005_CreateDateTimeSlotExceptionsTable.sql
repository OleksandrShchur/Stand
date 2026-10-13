-- 0005_CreateDateTimeSlotExceptionsTable.sql
-- Per-date exceptions to the global TimeSlots list, e.g. disabling a specific time range
-- on a specific date (applies to every location on that date). Default (no row) = available.
-- Idempotent: safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DateTimeSlotExceptions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.DateTimeSlotExceptions
    (
        Id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Date]        DATE               NOT NULL,
        TimeSlotId    INT                NOT NULL,
        IsBlocked     BIT                NOT NULL CONSTRAINT DF_DateTimeSlotExceptions_IsBlocked DEFAULT (1),
        Note          NVARCHAR(300)      NULL,
        CreatedAtUtc  DATETIME2(3)       NOT NULL CONSTRAINT DF_DateTimeSlotExceptions_CreatedAtUtc DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_DateTimeSlotExceptions_TimeSlots FOREIGN KEY (TimeSlotId) REFERENCES dbo.TimeSlots (Id)
    );

    CREATE UNIQUE INDEX UQ_DateTimeSlotExceptions_Date_TimeSlot ON dbo.DateTimeSlotExceptions ([Date], TimeSlotId);
END
GO
