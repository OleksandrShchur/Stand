-- A booking is either booked or not booked. Preserve inactive history and tokens.
-- Unfinished legacy holds must never become real bookings during the upgrade.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.Bookings', 'IsBooked') IS NULL
    ALTER TABLE dbo.Bookings ADD IsBooked BIT NOT NULL
        CONSTRAINT DF_Bookings_IsBooked DEFAULT 1;
GO
IF COL_LENGTH('dbo.Bookings', 'Status') IS NOT NULL
BEGIN
    EXEC(N'UPDATE dbo.Bookings SET IsBooked = CASE WHEN Status = ''Confirmed'' THEN 1 ELSE 0 END,
        CancelledAtUtc = CASE WHEN Status <> ''Confirmed'' THEN COALESCE(CancelledAtUtc, SYSUTCDATETIME()) ELSE CancelledAtUtc END');

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Bookings') AND name = 'IX_Bookings_Date_Location_TimeSlot_Status')
        DROP INDEX IX_Bookings_Date_Location_TimeSlot_Status ON dbo.Bookings;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Bookings') AND name = 'UQ_Bookings_Phone_Date_Location_TimeSlot')
        DROP INDEX UQ_Bookings_Phone_Date_Location_TimeSlot ON dbo.Bookings;
    IF OBJECT_ID('dbo.CK_Bookings_Status', 'C') IS NOT NULL
        ALTER TABLE dbo.Bookings DROP CONSTRAINT CK_Bookings_Status;
    IF OBJECT_ID('dbo.DF_Bookings_Status', 'D') IS NOT NULL
        ALTER TABLE dbo.Bookings DROP CONSTRAINT DF_Bookings_Status;
    ALTER TABLE dbo.Bookings DROP COLUMN Status;
END;

IF COL_LENGTH('dbo.Bookings', 'HoldExpiresAtUtc') IS NOT NULL
    ALTER TABLE dbo.Bookings DROP COLUMN HoldExpiresAtUtc;
IF COL_LENGTH('dbo.Bookings', 'BookedAtUtc') IS NULL AND COL_LENGTH('dbo.Bookings', 'ConfirmedAtUtc') IS NOT NULL
    EXEC sys.sp_rename N'dbo.Bookings.ConfirmedAtUtc', N'BookedAtUtc', N'COLUMN';
GO
UPDATE dbo.Bookings SET BookedAtUtc = COALESCE(BookedAtUtc, CreatedAtUtc) WHERE IsBooked = 1;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Bookings') AND name = 'IX_Bookings_Date_Location_TimeSlot_IsBooked')
    CREATE INDEX IX_Bookings_Date_Location_TimeSlot_IsBooked ON dbo.Bookings ([Date], LocationId, TimeSlotId, IsBooked);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Bookings') AND name = 'UQ_Bookings_Phone_Date_Location_TimeSlot')
    CREATE UNIQUE INDEX UQ_Bookings_Phone_Date_Location_TimeSlot ON dbo.Bookings (Phone, [Date], LocationId, TimeSlotId)
        WHERE IsBooked = 1 AND Phone IS NOT NULL;

COMMIT TRANSACTION;
GO
