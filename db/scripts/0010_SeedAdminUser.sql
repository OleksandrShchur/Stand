-- 0010_SeedAdminUser.sql
-- Bootstraps the first admin account (idempotent: only inserts if login 'admin' does not
-- already exist). Password hash below corresponds to the default password 'ChangeMe!Admin1'
-- using ASP.NET Core Identity's PasswordHasher<T> (v3, PBKDF2-HMAC-SHA256).
--
-- IMPORTANT: change this password immediately after first login in production!
-- (Admin > Users > create a new admin, then disable/replace this bootstrap account,
-- or implement a "change password" flow before going live.)

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM dbo.AdminUsers WHERE Login = N'admin')
BEGIN
    INSERT INTO dbo.AdminUsers (Login, PasswordHash, IsActive, CreatedAtUtc)
    VALUES (N'admin', N'AQAAAAIAAYagAAAAEFT7zp8O+ztahdmJYtFCYEnjx6IEG+9bF8ZLQ5bhuWEbktDfZP0HKyDbUkz3f/ey5A==', 1, SYSUTCDATETIME());
END
GO
