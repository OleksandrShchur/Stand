-- 0006_CreateBookingsTable.sql
-- Volunteer duty bookings. A row is created as 'Held' when a user selects a slot (soft-hold,
-- HoldExpiresAtUtc = now + 2 minutes, contact fields NULL), and becomes 'Confirmed' once the
-- contact form is submitted before the hold expires. 'Cancelled' covers both expired holds and
-- user/admin cancellations.
-- Idempotent: safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Bookings' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Bookings
    (
        Id                INT IDENTITY(1,1)   NOT NULL PRIMARY KEY,
        PublicNumber      NVARCHAR(30)        NOT NULL,
        LocationId        INT                 NOT NULL,
        [Date]            DATE                NOT NULL,
        TimeSlotId        INT                 NOT NULL,
        FirstName         NVARCHAR(100)       NULL,
        LastName          NVARCHAR(100)       NULL,
        Phone             NVARCHAR(20)        NULL,
        Comment           NVARCHAR(500)       NULL,
        Status            NVARCHAR(20)        NOT NULL CONSTRAINT DF_Bookings_Status DEFAULT ('Held'),
        CreatedAtUtc      DATETIME2(3)        NOT NULL CONSTRAINT DF_Bookings_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        ConfirmedAtUtc    DATETIME2(3)        NULL,
        CancelledAtUtc    DATETIME2(3)        NULL,
        CancelToken       UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_Bookings_CancelToken DEFAULT NEWID(),
        HoldExpiresAtUtc  DATETIME2(3)        NULL,

        CONSTRAINT FK_Bookings_Locations FOREIGN KEY (LocationId) REFERENCES dbo.Locations (Id),
        CONSTRAINT FK_Bookings_TimeSlots FOREIGN KEY (TimeSlotId) REFERENCES dbo.TimeSlots (Id),
        CONSTRAINT CK_Bookings_Status CHECK (Status IN ('Held', 'Confirmed', 'Cancelled'))
    );

    CREATE UNIQUE INDEX UQ_Bookings_PublicNumber ON dbo.Bookings (PublicNumber);
    CREATE UNIQUE INDEX UQ_Bookings_CancelToken ON dbo.Bookings (CancelToken);

    -- Speeds up capacity counting for a given date+location+timeslot.
    CREATE INDEX IX_Bookings_Date_Location_TimeSlot_Status
        ON dbo.Bookings ([Date], LocationId, TimeSlotId, Status)
        INCLUDE (HoldExpiresAtUtc);

    -- One booking per phone per (date + location + time) among non-cancelled bookings.
    -- NULL phones (holds not yet confirmed) are not indexed by SQL Server filtered indexes,
    -- so this only enforces uniqueness once the phone number is attached at confirmation.
    CREATE UNIQUE INDEX UQ_Bookings_Phone_Date_Location_TimeSlot
        ON dbo.Bookings (Phone, [Date], LocationId, TimeSlotId)
        WHERE Status <> 'Cancelled' AND Phone IS NOT NULL;
END
GO
