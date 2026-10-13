-- 0007_CreateAdminUsersTable.sql
-- Admin accounts (multiple), authenticated via ASP.NET Core cookie auth.
-- Idempotent: safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AdminUsers' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AdminUsers
    (
        Id              INT IDENTITY(1,1)  NOT NULL PRIMARY KEY,
        Login           NVARCHAR(50)       NOT NULL,
        PasswordHash    NVARCHAR(500)      NOT NULL,
        IsActive        BIT                NOT NULL CONSTRAINT DF_AdminUsers_IsActive DEFAULT (1),
        CreatedAtUtc    DATETIME2(3)       NOT NULL CONSTRAINT DF_AdminUsers_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        LastLoginAtUtc  DATETIME2(3)       NULL
    );

    CREATE UNIQUE INDEX UQ_AdminUsers_Login ON dbo.AdminUsers (Login);
END
GO
