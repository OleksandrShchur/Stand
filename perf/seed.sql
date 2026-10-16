-- Run only against the disposable database created for this benchmark.
IF DB_NAME() <> 'StandPerfTest' THROW 50000, 'Expected StandPerfTest database', 1;
SET NOCOUNT ON;
;WITH n AS (SELECT 1 n UNION ALL SELECT n+1 FROM n WHERE n < 10000)
INSERT dbo.AuthorizedUsers (Phone, FirstName, LastName)
SELECT '+38067' + RIGHT('0000000' + CAST(n AS varchar(7)), 7), 'Load', CAST(n AS nvarchar(100))
FROM n WHERE NOT EXISTS (SELECT 1 FROM dbo.AuthorizedUsers u WHERE u.Phone = '+38067' + RIGHT('0000000' + CAST(n AS varchar(7)), 7))
OPTION (MAXRECURSION 10000);
DECLARE @today date = CONVERT(date, SYSDATETIMEOFFSET() AT TIME ZONE 'FLE Standard Time');
;WITH n AS (SELECT 1 n UNION ALL SELECT n+1 FROM n WHERE n < 14)
MERGE dbo.AvailableDates AS target
USING (SELECT DATEADD(day,n,@today) [Date] FROM n) AS source ON target.[Date] = source.[Date]
WHEN MATCHED THEN UPDATE SET IsActive=1
WHEN NOT MATCHED THEN INSERT ([Date],IsActive) VALUES (source.[Date],1);
