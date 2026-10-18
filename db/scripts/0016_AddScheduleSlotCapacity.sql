-- Preserve configured schedules; changing a location default must not change their capacity.
IF COL_LENGTH('dbo.ScheduleSlots', 'Capacity') IS NULL
    ALTER TABLE dbo.ScheduleSlots ADD Capacity INT NULL;
GO
UPDATE s
SET Capacity = CASE WHEN COALESCE(b.Booked, 0) > l.Capacity THEN b.Booked ELSE l.Capacity END
FROM dbo.ScheduleSlots s
JOIN dbo.Locations l ON l.Id = s.LocationId
OUTER APPLY (
    SELECT COUNT(*) AS Booked FROM dbo.Bookings b
    WHERE b.[Date] = s.[Date] AND b.LocationId = s.LocationId
        AND b.TimeSlotId = s.TimeSlotId AND b.IsBooked = 1
) b
WHERE s.Capacity IS NULL;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ScheduleSlots') AND name = 'Capacity' AND is_nullable = 1)
    ALTER TABLE dbo.ScheduleSlots ALTER COLUMN Capacity INT NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.ScheduleSlots') AND name = 'DF_ScheduleSlots_Capacity')
    ALTER TABLE dbo.ScheduleSlots ADD CONSTRAINT DF_ScheduleSlots_Capacity DEFAULT (2) FOR Capacity;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.ScheduleSlots') AND name = 'CK_ScheduleSlots_Capacity')
    ALTER TABLE dbo.ScheduleSlots ADD CONSTRAINT CK_ScheduleSlots_Capacity CHECK (Capacity > 0);
GO
-- New locations default to two places. Existing location settings are retained.
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.Locations') AND name = 'DF_Locations_Capacity')
    ALTER TABLE dbo.Locations DROP CONSTRAINT DF_Locations_Capacity;
ALTER TABLE dbo.Locations ADD CONSTRAINT DF_Locations_Capacity DEFAULT (2) FOR Capacity;
GO
