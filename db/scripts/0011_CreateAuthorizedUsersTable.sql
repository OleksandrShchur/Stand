-- 0011_CreateAuthorizedUsersTable.sql
-- Phone-only public users allowed to access the booking website.
-- Idempotent: safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuthorizedUsers' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AuthorizedUsers
    (
        Id              INT IDENTITY(1,1)  NOT NULL PRIMARY KEY,
        Phone           NVARCHAR(13)       NOT NULL,
        IsActive        BIT                NOT NULL CONSTRAINT DF_AuthorizedUsers_IsActive DEFAULT (1),
        CreatedAtUtc    DATETIME2(3)       NOT NULL CONSTRAINT DF_AuthorizedUsers_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        LastLoginAtUtc  DATETIME2(3)       NULL
    );

    CREATE UNIQUE INDEX UQ_AuthorizedUsers_Phone ON dbo.AuthorizedUsers (Phone);
END
GO
