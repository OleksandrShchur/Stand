-- General feedback is independent of bookings. Identity snapshots survive account changes.
IF OBJECT_ID('dbo.Feedback', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Feedback
    (
        Id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Feedback PRIMARY KEY,
        AuthorizedUserId INT NULL,
        Phone            NVARCHAR(13) NOT NULL,
        FirstName        NVARCHAR(100) NOT NULL,
        LastName         NVARCHAR(100) NOT NULL,
        Comment          NVARCHAR(500) NOT NULL,
        CreatedAtUtc     DATETIME2(3) NOT NULL CONSTRAINT DF_Feedback_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Feedback_Comment CHECK (LEN(LTRIM(RTRIM(Comment))) > 0),
        CONSTRAINT FK_Feedback_AuthorizedUsers FOREIGN KEY (AuthorizedUserId)
            REFERENCES dbo.AuthorizedUsers(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_Feedback_AuthorizedUserId ON dbo.Feedback(AuthorizedUserId);
END
GO
