# Capacity benchmark

This Windows-only benchmark runs the published application against a disposable
`StandPerfTest` LocalDB database. It never uses the application's configured
production database. The server is placed in a Windows Job Object with a 256 MiB
private committed memory limit; the Node load generator and SQL Server run outside
that job. Failed allocations under this hard cap can differ from an IIS recycle.
Private memory and working set are sampled every 100 ms, including startup.

## Prepare

From the repository root, with .NET 10, Node 22+, SQL Server LocalDB and `sqlcmd`:

```powershell
dotnet publish Stand.Server/Stand.Server.csproj -c Release -o artifacts/perf/site
sqlcmd -S '(localdb)\MSSQLLocalDB' -E -b -Q "IF DB_ID('StandPerfTest') IS NULL CREATE DATABASE StandPerfTest"
dotnet run --project Stand.DbMigrator -c Release -- --connection 'Server=(localdb)\MSSQLLocalDB;Database=StandPerfTest;Trusted_Connection=True;TrustServerCertificate=True'
sqlcmd -S '(localdb)\MSSQLLocalDB' -E -b -d StandPerfTest -i perf/seed.sql
powershell -NoProfile -ExecutionPolicy Bypass -File perf/run.ps1 -Users 10 -Seconds 120
```

The seed adds 10,000 synthetic users and enables the next fourteen Kyiv calendar
dates. Existing seeded location capacities remain unchanged. The database is
retained for inspection. Repeated runs accumulate cancelled booking history;
use a fresh disposable database for comparisons that require identical data.

## Workload and interpretation

Each user logs in once before timing, using a unique account and loopback source
IP. The server's login rate limiter stays enabled. The fixture manually replays
the returned secure cookie over local HTTP; it is deliberately restricted to
`127.0.0.1`. This is a signed-in session benchmark, not a login burst benchmark.

Users start at random offsets over ten seconds. Each repeats a thirty-second
journey: session check, upcoming bookings, calendar, five seconds thinking,
locations for a random enabled date, five seconds thinking, slots for a random
location, then the remaining think time. Ten percent of journeys attempt a
booking when space is available and immediately cancel only that new booking.
This adds cancellation work but prevents all real slots filling during the run.
Only `409 SLOT_FULL` is treated as an expected business conflict and reported
separately. Other non-2xx responses, timeouts and invalid journey data fail the
run. The fixture does not raise slot capacities or change production code.

Passing requires aggregate p95 below 1,000 ms, fewer than 1%
failed requests and no invalid successful response payloads. Failed journeys
and endpoint error counts are reported separately.
`endpointTargetsMet` separately checks whether every endpoint's p95 is under
1,000 ms. This is an additional diagnostic, not part of the agreed aggregate SLA.
Also inspect successful booking counts: short or small runs may not sample the
booking branch. The workload generates
about five browsing requests per user per thirty seconds, plus booking traffic.
An active user here means this pacing, not continuous requests or an idle tab.

Increase users in steps, bracket the first failure, and repeat smaller steps
near the boundary. Confirm a candidate with a ten-minute run and repeat runs.
Each invocation starts a fresh server; cold startup and login provisioning are
included in memory sampling but excluded from request latency measurements.
Steady-state measurements begin after those setup requests warm common paths.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File perf/run.ps1 -Users 100 -Seconds 120
powershell -NoProfile -ExecutionPolicy Bypass -File perf/run.ps1 -Users 100 -Seconds 600 -Label soak
# Optional comparison; changes only the child process environment:
powershell -NoProfile -ExecutionPolicy Bypass -File perf/run.ps1 -Users 100 -Seconds 120 -WorkstationGc -Label workstation
```

Raw endpoint latency/status summaries, memory/CPU samples and logs are written
under ignored `artifacts/perf/results/`, with a timestamp and unique suffix for
each invocation. The runner writes a failure summary if startup or load aborts;
it must never be counted as a passing run. Failed targets exit nonzero.
Only run one benchmark at a time (fixed local port 5116).

## Hosting limits

MonsterASP documents a [256 MB private memory recycle limit](https://help.monsterasp.net/websites/configuration/memory-limit)
for the free website and [shared, lower-performance servers](https://help.monsterasp.net/getting-started/first-steps/free-vs-premium).
This local benchmark uses standalone Kestrel, a local database and this machine's
CPU. IIS hosting overhead, shared CPU contention, TLS, remote SQL latency, data
volume and other users' activity can change the result. The hard cap applies to
the entire local server process, not just its GC heap. It does not reproduce IIS
recycling or prove an exact maximum on MonsterASP.

The request workload excludes asset downloads, JavaScript rendering, batch
bookings, admins, a dedicated hot-slot contention burst and sustained thirty-second
calendar polling by idle tabs. Validate separately if those are important to the
real traffic mix. Confirm capacity on the actual hosting environment with a
separate test website/database and observed IIS memory/recycle metrics before
treating any local concurrency count as production capacity.

## Designated hosted test site

The user designated `https://stand.runasp.net` for hosted testing and supplied
three test accounts. The optional `--hosted` mode is restricted to that exact
HTTPS origin. It logs in with up to three accounts from an environment variable,
then distributes those sessions across simulated visitors. It does not bypass
or disable the login rate limiter. Sessions are cached for one hour in the
ignored `artifacts/perf/hosted-sessions.json` file so subsequent load levels
reuse established sessions. Treat that file as a secret; do not commit or share
it. Set `STAND_PERF_SESSION_FILE` to override its local location.

```powershell
$env:STAND_PERF_PHONES = '<test phone 1>,<test phone 2>,<test phone 3>'
node perf/load.mjs https://stand.runasp.net 100 120 artifacts/perf/results/hosted-100-120.json --hosted
```

Hosted tests create and cancel only their own new bookings. They preserve
pre-existing bookings. Known tokens whose initial cancellation failed are retried during cleanup,
outside the measured phase; initial failures remain in the error totals. The
final result records any tokens still awaiting cleanup. A process interruption
or a creation response lost after commit can still leave a booking behind.
The shared account pool can
produce duplicate-phone booking conflicts that distinct people would not cause;
these count as failures rather than being hidden. This model measures concurrent
traffic across three identities, not thousands of distinct users' data.
It measures actual HTTPS and remote SQL latency, but cannot observe IIS process
memory or detect every recycle. Read peak RAM and recycle logs from the hosting
control panel. The generator itself imposes no memory cap on the remote server.
