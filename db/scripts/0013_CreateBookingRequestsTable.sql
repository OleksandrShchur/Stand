-- Durable replay for optional Idempotency-Key booking requests.
-- No user FK: deleting an authorized user must retain the existing behavior.
IF OBJECT_ID('dbo.BookingRequests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BookingRequests
    (
        AuthorizedUserId int NOT NULL,
        RequestId uniqueidentifier NOT NULL,
        Fingerprint char(64) NOT NULL,
        ResponseJson nvarchar(max) NOT NULL,
        CreatedAtUtc datetime2(3) NOT NULL CONSTRAINT DF_BookingRequests_Created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_BookingRequests PRIMARY KEY (AuthorizedUserId, RequestId),
        CONSTRAINT CK_BookingRequests_Json CHECK (ISJSON(ResponseJson) = 1)
    );
END
GO
