-- 0008_SeedLocations.sql
-- Seeds the initial set of duty locations (idempotent: only inserts if a location with the
-- same Name does not already exist). Admin can edit/deactivate/reorder afterwards.

SET NOCOUNT ON;

MERGE dbo.Locations AS target
USING (VALUES
    (N'Центр міста',    N'Театральний майдан',        3, 10),
    (N'Подоляни',       N'ТРЦ «Подоляни»',             3, 20),
    (N'Залізничний вокзал', N'Привокзальна площа',     3, 30),
    (N'Дружба',         N'Ринок «Дружба»',             3, 40),
    (N'БАМ',            N'Ринок «БАМ»',                3, 50),
    (N'Канада',         N'вул. Коновальця',            3, 60),
    (N'Східний',        N'вул. Протасевича',           3, 70),
    (N'Новий світ',     N'Парк «Новий світ»',          3, 80)
) AS src (Name, Address, Capacity, SortOrder)
ON target.Name = src.Name
WHEN NOT MATCHED THEN
    INSERT (Name, Address, Capacity, SortOrder, IsActive, CreatedAtUtc)
    VALUES (src.Name, src.Address, src.Capacity, src.SortOrder, 1, SYSUTCDATETIME());
GO
