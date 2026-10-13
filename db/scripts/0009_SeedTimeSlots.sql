-- 0009_SeedTimeSlots.sql
-- Seeds a sensible default set of duty time ranges (idempotent: only inserts if a time slot
-- with the same Start/End does not already exist). Admin can edit afterwards.

SET NOCOUNT ON;

MERGE dbo.TimeSlots AS target
USING (VALUES
    (CAST('09:00' AS TIME(0)), CAST('11:00' AS TIME(0)), 10),
    (CAST('11:00' AS TIME(0)), CAST('13:00' AS TIME(0)), 20),
    (CAST('13:00' AS TIME(0)), CAST('15:00' AS TIME(0)), 30),
    (CAST('15:00' AS TIME(0)), CAST('17:00' AS TIME(0)), 40),
    (CAST('17:00' AS TIME(0)), CAST('19:00' AS TIME(0)), 50)
) AS src (StartTime, EndTime, SortOrder)
ON target.StartTime = src.StartTime AND target.EndTime = src.EndTime
WHEN NOT MATCHED THEN
    INSERT (StartTime, EndTime, SortOrder, IsActive, CreatedAtUtc)
    VALUES (src.StartTime, src.EndTime, src.SortOrder, 1, SYSUTCDATETIME());
GO
