-- Existing dates retain their global schedule until first saved in the schedule editor.
IF COL_LENGTH('dbo.AvailableDates', 'UseCustomSchedule') IS NULL
    ALTER TABLE dbo.AvailableDates ADD UseCustomSchedule BIT NOT NULL
        CONSTRAINT DF_AvailableDates_UseCustomSchedule DEFAULT 0;
GO
-- Schedule ranges are immutable and must never become global template slots.
IF COL_LENGTH('dbo.TimeSlots', 'IsScheduleOnly') IS NULL
    ALTER TABLE dbo.TimeSlots ADD IsScheduleOnly BIT NOT NULL
        CONSTRAINT DF_TimeSlots_IsScheduleOnly DEFAULT 0;
GO
IF OBJECT_ID('dbo.ScheduleSlots', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ScheduleSlots (
        [Date] DATE NOT NULL,
        LocationId INT NOT NULL,
        TimeSlotId INT NOT NULL,
        CONSTRAINT PK_ScheduleSlots PRIMARY KEY ([Date], LocationId, TimeSlotId),
        CONSTRAINT FK_ScheduleSlots_AvailableDates FOREIGN KEY ([Date]) REFERENCES dbo.AvailableDates ([Date]),
        CONSTRAINT FK_ScheduleSlots_Locations FOREIGN KEY (LocationId) REFERENCES dbo.Locations (Id),
        CONSTRAINT FK_ScheduleSlots_TimeSlots FOREIGN KEY (TimeSlotId) REFERENCES dbo.TimeSlots (Id)
    );
    CREATE INDEX IX_ScheduleSlots_TimeSlotId ON dbo.ScheduleSlots (TimeSlotId);
END;
GO
