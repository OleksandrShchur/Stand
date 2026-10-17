Implemented optimizations (16 October 2026)

The selected changes cover authentication, slots queries, frontend request
patterns, booking reliability and lazy admin routes. No shared availability
response cache was added.

* A scoped `CurrentPublicUser` loads the active profile once per request and
  reuses it in authentication and domain services. A new request always checks
  SQL again, preserving immediate user-disable checks without a cache TTL.
* The authenticated slots path now executes five SQL reads instead of eight.
  Slot blocking is projected with slot metadata, and booked participants come
  from one active-bookings read (`IsBooked = 1`). Counts include the user's
  own booking; participant lists exclude that user. Inactive history is ignored.
* Current calendars no longer trigger a second today's-location check. Older
  servers retain their fallback. A shared polling controller pauses hidden tabs,
  coalesces focus/visibility events, prevents overlapping refreshes and aborts
  obsolete work on navigation/date changes. There is no cross-request data cache.
* Booking transactions retry SQL deadlock 1205 at most twice, with jitter, after
  rolling back and clearing tracked state. Response participant data is fetched
  once per batch and built before commit. No summary SQL query runs after commit.
* Optional UUID `Idempotency-Key` headers scope durable replay to user + key.
  Responses and payload fingerprints are stored in the same transaction as the
  booking. An identical key/payload replays the original creation response;
  changed payloads return 409. The browser preserves its pending key across
  uncertain results/reloads and clears it after success. Cancellation retries
  return the already-cancelled booking successfully.
* The admin route tree and each admin screen load on demand. Shared libraries
  still used by public pages remain initial dependencies.

Measured local verification

* SQL Server integration checks cover actual query counts, immediate disable
  checks, binary booking state/participants, concurrent capacity, concurrent/durable request
  replay, mismatched payloads, per-user key scope, cancellation replay and rollback
  when response construction fails. A real SQL deadlock error is captured on
  test-owned rows and injected after INSERT to verify full-transaction retry and
  the three-attempt limit. Tests clean up their owned users/location/bookings.
* Initial JavaScript entry + all HTML module-preloads: 885,998 -> 813,971 bytes
  (about 8.1% smaller). gzip with Node's default settings: 266,639 -> 254,613 bytes
  (about 4.5% smaller). Counting just the entry chunk would overstate the saving.
* A two-minute local run with 1,000 unique accounts under a hard 256 MiB process
  cap completed 20,726 requests with no failures, p95 11.13 ms, 363 successful
  booking/cancellation cycles and 71.73 MiB sampled peak private memory. The
  pre-optimization report used different accumulated test data, so these numbers
  are a regression check, not a controlled percentage speedup or new capacity claim.
  This existing load fixture uses the compatible headerless booking route;
  integration checks and `tests/http-bookings.mjs` separately exercise the new
  idempotency header through SQL and HTTP.
* The HTTP smoke check verifies cookie authentication, concurrent identical keys,
  invalid and changed-payload keys, repeated cancellation and replay after a
  booking has been cancelled. All 28 frontend tests pass, as do targeted lint,
  TypeScript/Vite build and production publish. Existing NuGet NU1902/NU1903
  dependency warnings and the Vite large-shared-chunk warning remain.

Deployment

Apply `db/scripts/0013_CreateBookingRequestsTable.sql` using the existing
migrator **before deploying the API/client**. No production database or hosted
website was changed during this work. Requests without the optional header
remain compatible, but the new browser sends it when confirming bookings.

Replay responses retain their original creation snapshot, even if the booking
is subsequently cancelled; the upcoming-shifts API reads current state. Replay
records are stored in SQL rather than process memory and currently have no
automatic expiry. Retention is part of the durable replay contract; a later
cleanup policy must explicitly define its replay window.

Checks from the repository root:

```powershell
dotnet run --project Stand.DbMigrator -c Release -- --connection 'Server=(localdb)\MSSQLLocalDB;Database=StandPerfTest;Trusted_Connection=True;TrustServerCertificate=True'
dotnet build Stand.Server/Stand.Server.csproj -c Release -p:BuildProjectReferences=false
dotnet run --project tests/Stand.Integration -c Release -p:BuildProjectReferences=false
node --test stand.client/tests/*.test.mjs
dotnet publish Stand.Server/Stand.Server.csproj -c Release -o artifacts/perf/site
powershell -NoProfile -ExecutionPolicy Bypass -File perf/run.ps1 -Users 1000 -Seconds 120 -Label optimized
```

While a local server from `perf/run.ps1` is running, execute
`node tests/http-bookings.mjs` for the HTTP checks (requires the 10,000-account
fixture from `perf/seed.sql`). Integration checks intentionally target only LocalDB `StandPerfTest`. Prepare
that database using `perf/README.md` if it does not yet exist. Three existing
tests contained copy assertions stale relative to the unchanged Ukrainian
product wording; those assertions were corrected without changing the messages.
