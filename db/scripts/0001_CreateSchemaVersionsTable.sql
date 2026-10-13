-- 0001_CreateSchemaVersionsTable.sql
-- Creates the tracking table used by the DbMigrator runner to record applied scripts.
-- Idempotent: safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__SchemaVersions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.__SchemaVersions
    (
        Id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ScriptName    NVARCHAR(260)      NOT NULL,
        Checksum      NVARCHAR(100)      NULL,
        AppliedOnUtc  DATETIME2(3)       NOT NULL CONSTRAINT DF___SchemaVersions_AppliedOnUtc DEFAULT SYSUTCDATETIME()
    );

    CREATE UNIQUE INDEX UQ___SchemaVersions_ScriptName ON dbo.__SchemaVersions (ScriptName);
END
GO
