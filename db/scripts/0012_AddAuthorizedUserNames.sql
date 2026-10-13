-- Existing users keep empty names until an administrator edits them.
IF COL_LENGTH('dbo.AuthorizedUsers', 'FirstName') IS NULL
BEGIN
    ALTER TABLE dbo.AuthorizedUsers ADD FirstName NVARCHAR(100) NOT NULL
        CONSTRAINT DF_AuthorizedUsers_FirstName DEFAULT ('');
END
GO

IF COL_LENGTH('dbo.AuthorizedUsers', 'LastName') IS NULL
BEGIN
    ALTER TABLE dbo.AuthorizedUsers ADD LastName NVARCHAR(100) NOT NULL
        CONSTRAINT DF_AuthorizedUsers_LastName DEFAULT ('');
END
GO
