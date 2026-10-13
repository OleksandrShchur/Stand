-- 0002_CreateLocationsTable.sql
-- Global list of duty locations. Soft-deactivate via IsActive (keep history).
-- Idempotent: safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Locations' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Locations
    (
        Id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name          NVARCHAR(200)      NOT NULL,
        Address       NVARCHAR(300)      NULL,
        Capacity      INT                NOT NULL CONSTRAINT DF_Locations_Capacity DEFAULT (3),
        SortOrder     INT                NOT NULL CONSTRAINT DF_Locations_SortOrder DEFAULT (0),
        IsActive      BIT                NOT NULL CONSTRAINT DF_Locations_IsActive DEFAULT (1),
        CreatedAtUtc  DATETIME2(3)       NOT NULL CONSTRAINT DF_Locations_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc  DATETIME2(3)       NULL,

        CONSTRAINT CK_Locations_Capacity CHECK (Capacity > 0)
    );

    CREATE INDEX IX_Locations_IsActive_SortOrder ON dbo.Locations (IsActive, SortOrder);
END
GO
