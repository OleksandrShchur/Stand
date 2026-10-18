# Стенди — Запис

Public web app for booking volunteer duty shifts ("чергування") at informational
stands around Ternopil. No visitor registration or login — pick a day, a
location, a time slot, leave your name and phone, and get a booking number
with a cancel link. A small cookie-authenticated admin area manages locations,
time slots, which calendar dates are bookable, and the resulting bookings.

Stack:

- **Backend:** .NET 10, ASP.NET Core Web API (controllers), EF Core 10
  **database-first** (DbContext/entities scaffolded from a real SQL Server
  database — no EF Core code-first migrations are used)
- **Database:** SQL Server (developed against SQL Server LocalDB), schema
  owned by hand-written, numbered, idempotent SQL scripts in `db/scripts/`
- **Frontend:** React 19 + TypeScript + Vite + MUI, Ukrainian-only UI, mobile-first

---

## 1. Repository layout

```
db/scripts/            Numbered, idempotent SQL schema + seed scripts (0001...0010)
Stand.DbMigrator/       Console app that applies db/scripts against a SQL Server database
Stand.Server/           ASP.NET Core Web API (public + admin), serves the built SPA in production
stand.client/           React + TypeScript + MUI single-page app (Vite)
Stand.slnx              Solution file (Stand.Server + Stand.DbMigrator)
```

---

## 2. Prerequisites

- .NET 10 SDK
- Node.js 20+ and npm
- SQL Server instance reachable from your machine. The simplest option on
  Windows is **SQL Server LocalDB** (installed with Visual Studio, or via the
  standalone *SQL Server Express LocalDB* installer). Everything below
  assumes the default instance name `(localdb)\MSSQLLocalDB` and a database
  named `StandDb`; override via connection string if you use something else.

---

## 3. Set up the database (db-first, no EF migrations)

The schema is **not** created via `dotnet ef database update`. It is created
and evolved by plain, idempotent `.sql` scripts under `db/scripts/`, applied
by the small `Stand.DbMigrator` console runner. The runner tracks what has
already been applied in a `dbo.__SchemaVersions` table, so it is always safe
to re-run — on an empty database it creates everything from scratch, and on
an already-migrated database it simply reports that everything is up to date.

```powershell
# From the repository root. Uses (localdb)\MSSQLLocalDB / StandDb by default.
dotnet run --project Stand.DbMigrator
```

To target a different server/database, either pass `--connection`, set the
`ConnectionStrings__Default` environment variable, or add an
`appsettings.json` next to the built exe:

```powershell
dotnet run --project Stand.DbMigrator -- --connection "Server=.;Database=StandDb;Trusted_Connection=True;TrustServerCertificate=True"
```

What the scripts do, in order (`db/scripts/0001_...` → `0010_...`):

| Script | Purpose |
|---|---|
| `0001` | Creates `dbo.__SchemaVersions` (also auto-created by the runner itself) |
| `0002`–`0007` | Creates `Locations`, `TimeSlots`, `AvailableDates`, `DateTimeSlotExceptions`, `Bookings`, `AdminUsers` tables, with the constraints described in §6 |
| `0008` | Seeds the 8 Ternopil locations (idempotent `MERGE`) |
| `0009` | Seeds the 5 daily time slot ranges (idempotent `MERGE`) |
| `0010` | Seeds the bootstrap admin user `admin` (idempotent `MERGE`) |

All scripts use `IF NOT EXISTS` / `MERGE` guards, so re-running the whole set
against a database that already has them is a safe no-op — nothing is
duplicated or overwritten.

### Hashing a new admin password

`Stand.DbMigrator` also doubles as a password-hashing utility (same
`PasswordHasher<T>` format the API uses to verify admin logins), useful if
you want to seed a different admin password by hand:

```powershell
dotnet run --project Stand.DbMigrator -- hash "My-New-Password1"
# prints a hash you can paste into an INSERT/UPDATE against dbo.AdminUsers
```

### Re-generating the EF Core model (optional)

The checked-in `Stand.Server/Data/StandDbContext.cs` and
`Stand.Server/Data/Entities/*.cs` files were generated with a real
`dotnet ef dbcontext scaffold` run against a LocalDB database created from
these exact scripts. If you change the schema, re-run the scripts and then
re-scaffold from `Stand.Server/`:

```powershell
dotnet ef dbcontext scaffold "Server=(localdb)\MSSQLLocalDB;Database=StandDb;Trusted_Connection=True;TrustServerCertificate=True" `
  Microsoft.EntityFrameworkCore.SqlServer `
  --context StandDbContext --output-dir Data/Entities --context-dir Data `
  --no-onconfiguring --force
```

(`--no-onconfiguring` keeps the connection string out of the generated code —
it's wired up in `Program.cs` via `builder.Configuration` instead.)

---

## 4. Running the app

### 4a. Local development (hot reload, two processes)

The server project uses the standard ASP.NET Core **SpaProxy** pattern: in
Development, hitting the API's root redirects the browser to the Vite dev
server, whose own proxy config forwards `/api/*` calls back to the API — so
you get full React hot-reload *and* a working, same-site API in dev. This
was verified end-to-end, including cookie-based admin login working across
the two dev processes.

Terminal 1 — API:

```powershell
dotnet run --project Stand.Server --launch-profile https
# -> https://localhost:7062 (SpaProxy) / http://localhost:5114
```

Terminal 2 — client:

```powershell
cd stand.client
npm install   # first time only
npm run dev
# -> https://localhost:56258
```

Open **https://localhost:7062** (or just https://localhost:56258 directly) —
either works, since Vite's dev proxy forwards `/api` to the backend.
Swagger UI is available at **https://localhost:7062/swagger** in Development.

### 4b. Production-style run (single process, same origin)

```powershell
dotnet publish Stand.Server/Stand.Server.csproj -c Release -o ./publish
# npm build runs automatically as part of publish (tsc -b && vite build)
./publish/Stand.Server.exe --urls http://localhost:5115
```

This serves the built SPA (`index.html` + assets) and the `/api/*` endpoints
from the **same** Kestrel process/origin — verified by requesting both
`/` and `/api/locations` against the published executable.

---

## 5. Default admin login

| Field | Value |
|---|---|
| URL | `/admin/login` |
| Login | `admin` |
| Password | *(seeded in `db/scripts/0010_...`; change before any real deployment)* |

> ⚠️ **The bootstrap admin is for local/dev use only.** Change its password
> (or create a new admin and disable this one via `/admin/users`) before any
> real deployment. Passwords are stored hashed — see §3 for how to generate
> a hash for a replacement password.

Session behavior: cookie `stand_admin`, HttpOnly, sliding expiration of
**12 hours** of inactivity, hard cap of **7 days** absolute lifetime
regardless of activity (`AdminAuth` section in `appsettings.json`). Login is
rate-limited to 5 attempts/minute per IP.

---

## 6. Booking rules implemented

- **Window:** earliest bookable day is **today**, horizon is **14 days**
  ahead, and a date is only offered at all if an admin has explicitly enabled
  it (`AvailableDates` table / `/admin/dates`). Same-day (and any) slots are
  only bookable if their **start time is at least 1 hour** from now
  (`Booking:MinLeadTimeMinutes`, default 60); earlier slots show as
  «Недоступно» and are rejected on booking with `SLOT_TOO_SOON`.
- **Capacity:** configurable per date/location/interval in the admin schedule.
  New locations default to **2**; new intervals start with the location's default.
  Existing location settings and schedule capacities are preserved on upgrade.
  Capacity cannot be saved below the interval's current booked count; a user or
  admin must cancel enough bookings first. Enforced
  under concurrent requests via a DB transaction with a `WITH (UPDLOCK,
  HOLDLOCK)` row-locking count inside `BookingService`, so parallel booking
  attempts for the same date/location/time slot are serialized rather than
  racing. This was load-tested with 10 simultaneous requests against a
  capacity-3 slot: exactly 3 succeeded, 7 correctly got `SLOT_FULL`.
- **Immediate booking:** selecting an available slot opens the shift summary
  and participant list without reserving a place or starting a timer. The final
  confirm button checks capacity and inserts a booked record using the
  signed-in user's admin-managed name and phone. Unavailable
  slots open a read-only final screen with the shift's booked participants.
  A booking has one binary flag: `IsBooked`. There are no temporary holds,
  pending confirmations, expiry timers, or background hold cleanup.
- **Duplicate prevention:** one active booking per phone number per
  date+location+time slot, enforced both at the application layer (pre-check)
  and by a filtered unique index in SQL (`UQ_Bookings_Phone_Date_Location_TimeSlot`,
  `WHERE IsBooked = 1 AND Phone IS NOT NULL`) as a race-safe backstop.
- **Phone validation:** Ukrainian mobile numbers only, normalized server-side
  to `+380XXXXXXXXX` regardless of whether the visitor typed `0XXXXXXXXX`,
  `380XXXXXXXXX`, or `+380XXXXXXXXX`.
- **No notifications in v1** — confirmation is shown on-screen with a booking
  number and a cancel link (`/booking/{cancelToken}`); nothing is emailed/SMSed.

---

## 7. API surface

Public (no auth):

```
GET  /api/calendar                  Bookable dates in the current window
GET  /api/locations                 Active locations
GET  /api/slots?date=&locationId=   Time slots + availability for a day/location
POST /api/bookings                  Book immediately as the signed-in user
GET  /api/bookings/{cancelToken}    Look up a booking by its cancel token
POST /api/bookings/cancel           Cancel a booking by its cancel token
```

Admin (cookie auth, `/api/admin/**`):

```
POST /api/admin/auth/login | logout      GET /api/admin/auth/me
GET/POST/PUT  /api/admin/locations       + activate/deactivate
GET/POST/PUT  /api/admin/timeslots       + activate/deactivate
GET/PUT       /api/admin/dates           + POST /bulk
GET/POST/DELETE /api/admin/exceptions
GET  /api/admin/bookings                 filters: date, locationId, timeFrom, timeTo, timeSlotId, isBooked, search, phone
POST /api/admin/bookings/{id}/cancel
GET  /api/admin/bookings/export.csv
GET  /api/admin/dashboard
GET/POST /api/admin/users                + disable/enable
```

The bookings search field accepts phone numbers, first names, surnames, or full
names after two characters. Name matching ignores case, supports partial names
and either full-name order. The `search` filter also applies to CSV export;
the existing `phone` API filter remains available.

Time filters use 24-hour clock inputs, with either bound optional. A booking
matches when its end is after `timeFrom` and its start is before `timeTo`.
For example, 09:00–11:00 matches From 10:00 and 12:00–15:00 matches To 13:00.
Bookings that only touch a boundary are excluded. From must be earlier than To
when both are supplied. The same filters apply to CSV export.

---

## 8. Frontend routes

```
/                         Booking wizard: date -> location -> time -> contact -> confirmation
/booking/:cancelToken     Look up / cancel an existing booking
/admin/login              Admin sign-in
/admin                    Dashboard (today/upcoming counts per location)
/admin/bookings           Filterable bookings list, cancel, CSV export
/admin/locations          Location CRUD + activate/deactivate
/admin/timeslots          Time slot CRUD + activate/deactivate
/admin/dates              Enable/disable bookable calendar dates (single + bulk)
/admin/exceptions         Per-date/location/time-slot overrides
/admin/users              Admin account management
```

Wizard state is persisted to `sessionStorage` so a page refresh mid-flow
doesn't lose the selected shift. No reservation expires while reviewing the shift.

---

## 9. Configuration reference

`Stand.Server/appsettings.json`:

```json
{
  "ConnectionStrings": { "Default": "Server=(localdb)\\MSSQLLocalDB;Database=StandDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true" },
  "Booking": { "HorizonDays": 14, "MinLeadTimeMinutes": 60, "TimeZoneId": "Europe/Kyiv" },
  "AdminAuth": { "SlidingExpirationHours": 12, "AbsoluteExpirationDays": 7 }
}
```

All three sections have sane defaults in code even if omitted; override per
environment via `appsettings.{Environment}.json` or environment variables
(e.g. `ConnectionStrings__Default`, `Booking__HorizonDays`).

---

## 10. Acceptance checklist

| # | Criterion | Status |
|---|---|---|
| 1 | No visitor registration/login; Ukrainian-only UI | ✅ |
| 2 | Mobile-first, works well on desktop too; calm green civic theme (not purple/AI-generic) | ✅ `theme.ts` |
| 3 | Flow: calendar → location → time slots (with "Вільно x/y" / "Зайнято") → contact form → confirmation + cancel link | ✅ |
| 4 | Booking only possible on admin-enabled dates, within today…+14 days; same-day slots only if start ≥ now+1h | ✅ enforced server-side in `AvailabilityService`/`BookingService` (`MinLeadTimeMinutes`) |
| 5 | Capacity enforced correctly under parallel/concurrent requests | ✅ `WITH (UPDLOCK, HOLDLOCK)` transaction; verified with 10 parallel requests → exactly capacity succeed |
| 6 | Immediate booking with no countdown; unavailable shifts have a read-only final screen | ✅ Capacity is checked on final confirmation |
| 7 | UA phone validation + normalization | ✅ `PhoneNormalizer` → canonical `+380XXXXXXXXX` |
| 8 | Duplicate booking prevention (same phone+date+location+time) | ✅ app-level pre-check + filtered unique index backstop |
| 9 | Admin: cookie auth, sliding 12h / absolute 7d, rate-limited login | ✅ `Program.cs` cookie config + `AddRateLimiter` "login" policy |
| 10 | Admin CRUD: locations, time slots, bookable dates, exceptions | ✅ `Admin*Controller`s + corresponding admin pages |
| 11 | Admin bookings list: filters, cancel, CSV export | ✅ `AdminBookingsController` (`date`, `locationId`, `timeSlotId`, `isBooked`, `phone` filters; `/export.csv`) |
| 12 | Admin dashboard | ✅ today/upcoming counts per location |
| 13 | Multi-admin management | ✅ `/admin/users` + `AdminUsersController` (create/disable/enable) |
| 14 | DB schema via idempotent numbered SQL scripts, safe to re-run on empty **and** already-migrated DB | ✅ `db/scripts/0001`–`0010` + `Stand.DbMigrator`; verified both from empty and already-applied |
| 15 | EF Core entities/DbContext scaffolded from a real database (db-first), not hand-written, when SQL Server is available | ✅ SQL Server LocalDB was available; a genuine `dotnet ef dbcontext scaffold` was run against a database built from the scripts above |
| 16 | Seed data: 8 locations, 5 time slots, bootstrap admin | ✅ `0008`/`0009`/`0010`, login `admin` (change password before deployment — see §5) |
| 17 | No notifications in v1 | ✅ confirmation is on-screen only |
| 18 | `WeatherForecast` scaffold removed | ✅ deleted controller + model |
| 19 | Solution builds | ✅ `dotnet build Stand.slnx` — 0 warnings/errors across all 3 projects |
| 20 | Client builds | ✅ `npm run build` in `stand.client` (`tsc -b && vite build`) succeeds |
| 21 | App actually runs: dev workflow (SpaProxy + Vite) and production (`dotnet publish` + run) | ✅ both verified end-to-end, including cookie auth working across the dev-mode cross-origin setup |

---

## 11. Known limitations / notes for a future iteration

- No email/SMS notifications (explicitly out of scope for v1).
- `dotnet run` alone (without the Vite dev server running alongside it) will
  not serve the SPA's static files correctly in Development — this is
  expected ASP.NET Core SpaProxy behavior, not a bug; always run both
  processes together in dev (§4a), or use the production publish flow (§4b)
  for a single-process experience.
- The bootstrap admin password comes from the seed script — rotate it
  (or add a new admin and disable it) before exposing the admin area beyond
  local development.

## 12. Performance testing

The repeatable 256 MiB capacity benchmark, isolated database setup and workload
definition are in [perf/README.md](perf/README.md). Recorded measurements and
their hosting limitations are in [perf/RESULTS.md](perf/RESULTS.md).
Implemented improvements, deployment prerequisites and regression checks are in
[perf/OPTIMIZATIONS.md](perf/OPTIMIZATIONS.md).

## 13. Mobile admin schedule

Open `/admin/schedule` (Розклад). Select a date, open or close the day, enable its
locations, and set times separately for each location. Save and Copy are inside
the selected day's summary card, with unsaved changes and validation shown beside
the actions. Existing users keep the same booking screens.
Select a date using the calendar in the **Дата розкладу** input. Use
**Налаштувати час** on a location to open its full-screen editor. Add or edit
times there, tap **Готово**, then save the day. Time inputs use the full width
of the editor; the day page shows a compact summary of each location.

- **Серія інтервалів:** enter 09:00–17:00 and 60 minutes to generate eight
  hourly slots. Any whole-minute duration is supported; the period must divide
  evenly, so no partial slot is created silently.
- **Один інтервал:** add custom ranges individually, such as 09:00–12:00,
  12:00–13:00 and 14:00–17:00. Breaks are allowed; overlapping ranges within
  one location are rejected. Times stay within one day.
- **Копіювати:** copy the current draft (day status, locations and times) to
  individual dates or selected weekdays in a date range of up to one year.
  This replaces each target day's schedule. A preview lists the target dates,
  exact times and the number of affected bookings before confirmation.
- Closing a day/location or removing/changing a range **preserves bookings**
  at their original time. These shifts remain viewable and are closed to new
  bookings. Cancel each booking separately from Записи; the confirmation modal
  identifies the participant, date, location and time and explains the effects.
  No automatic notification is sent. Admins cannot create or move bookings.
- A schedule can be prepared beyond the public booking horizon; the existing
  configured horizon and minimum lead time still apply to public booking.
- Locations, site users and administrators have mobile card layouts. Site
  users have name/phone search and pagination. Booking filters can be expanded
  when needed, with CSV export and booking detail dialogs retained.

**Deployment:** apply pending SQL scripts, including `0014` and `0015`, with
`Stand.DbMigrator` against the intended database before starting the new server.
Use the existing configured connection or the migrator's `--connection` option;
this is a SQL script migration, not an EF code-first migration. The change adds
`AvailableDates.UseCustomSchedule`, `TimeSlots.IsScheduleOnly` and `ScheduleSlots`.
The EF mappings were checked against an actual LocalDB scaffold. Existing dates
retain their global slots/exceptions until first saved in the new editor;
new dates start empty. Custom ranges do not become global slots. The previous
`/admin/dates`, `/admin/timeslots` and `/admin/exceptions` UI routes redirect to
the combined schedule editor.

New admin API endpoints (existing cookie authorization):

```text
GET  /api/admin/schedule?date=yyyy-MM-dd
POST /api/admin/schedule/preview
PUT  /api/admin/schedule
```

The PUT and preview accept `{ dates, isActive, locations: [{ locationId, slots:
[{ startTime, endTime, capacity }] }], acknowledgeExistingBookings }`. Replacing a schedule
with affected bookings requires acknowledgment. The operation is atomic across
all selected dates and coordinated with in-flight bookings using transaction
locks. Time ranges referenced by bookings are not rewritten.

Each interval has its own positive whole-number capacity. The series generator
prefills the location's default, and admins can change any generated interval
individually. Copying across dates or locations includes capacity, and the review
lists it beside each interval. Changing a location's default does not change
capacities already saved in custom schedules. Legacy dates continue using the
location default until saved in the schedule editor.

Apply `0016_AddScheduleSlotCapacity.sql` through `Stand.DbMigrator` before starting
this version of the server. It adds `ScheduleSlots.Capacity`, backfills existing
intervals from their location settings (at least the current booked count), and
sets the default for new locations to two without changing existing locations.
The EF capacity mappings were verified against a LocalDB scaffold. Both preview
and save reject a capacity below the current booked count, including when copying
to multiple dates or acknowledging affected bookings. Saving rechecks under date
locks to cover bookings made since preview. Availability, concurrent booking
limits and dashboard fill rates all use each interval's saved capacity.

Validation: `npm test` and `npm run build` in `stand.client`; the SQL integration
checks in `tests/Stand.Integration` use only the disposable `StandPerfTest`
database. Apply the migration to that test database before running them.

The focused capacity browser regression is `node tests/admin-slot-capacity.mjs`.
Build the client first and launch an isolated Chrome debugging endpoint on port
9245 (or set `ADMIN_CHROME_URL`). It uses an API fixture without a database and
checks capacity editing, invalid values, save review and generated series at
320, 393 and 414 CSS pixels.

The mobile browser regression is `node tests/admin-mobile.mjs` from the repo
root. Point `ADMIN_BASE_URL` at a running local app backed by the isolated test
database and `ADMIN_CHROME_URL` at Chrome's debugging endpoint (default
`http://127.0.0.1:9237`). Launch installed Chrome with a separate user profile
and `--remote-debugging-port=9237`; no browser dependency is installed by the
test. Optional `ADMIN_TEST_LOGIN` and `ADMIN_TEST_PASSWORD` select the test
account. The script checks actual device widths of 320, 393 and 414 CSS pixels,
uses screen-coordinate touch events, and exercises calendar selection, hourly
and custom slots, editing, removal, previews, copy and unsaved-change dialogs.
It does not save schedules or cancel bookings. Screenshots are written to
`artifacts/admin-mobile/`. Width checks compare with the configured device
width so an expanded mobile layout viewport cannot mask overflow.

## 14. Booked or not booked

Bookings expose a single `isBooked` boolean in the API and an `IsBooked` bit in
SQL Server. `true` means booked; `false` means not booked. Only booked rows
consume capacity, appear as participants/upcoming shifts, or count on the
dashboard. Cancellation sets the flag to false immediately and retains the
record and cancellation token as history. The same participant can then book
that time again. Admins see booked records by default and can filter history
with `isBooked=false`. CSV exports the same boolean; there are no held,
pending, or separate confirmation states.

Before starting this version, apply `0015_SimplifyBookingState.sql` using
`Stand.DbMigrator` and the intended database connection, then restart the
backend and use the matching client build. The migration preserves existing
bookings and tokens, marks cancelled rows and unfinished legacy holds as not
booked, renames `ConfirmedAtUtc` to `BookedAtUtc`, and removes the old `Status`
and `HoldExpiresAtUtc` columns. Stored retry responses from the previous API
remain usable: their stable tokens resolve to the current binary state.

The SQL integration suite checks conversion and idempotency of the actual
migration in a separate, rollback-only test schema, plus capacity, history,
rebooking, binary filters and CSV, and retries after cancellation.
