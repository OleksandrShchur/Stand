# Automated tests

From the repository root, install the client dependencies once, then run the complete suite:

```powershell
npm ci --prefix stand.client
node tests/run-tests.mjs
```

Requires .NET 10 SDK, Node.js 22.12+ and SQL Server LocalDB on Windows. No application server, browser, application credentials or development database is needed. The GitHub Actions workflow runs the same command on Windows for pull requests, pushes to `master`, and manual dispatches. Feature-branch pushes use the pull-request trigger to avoid duplicate runs.

## Suites

| Project | What it checks | Run independently |
| --- | --- | --- |
| `Stand.UnitTests` | Phone normalization, date periods, Kyiv time, archive boundaries, booking numbers, input validation before persistence, and public error responses | `dotnet test tests/Stand.UnitTests` |
| `Stand.Integration` | Real SQL Server transactions, concurrency and retry safety, migrations, capacity, overlapping bookings, schedule preservation, statistics, search, feedback, identity management and HTTP cookie authentication/API contracts | `dotnet test tests/Stand.Integration` |
| Client unit | Actual TypeScript booking/schedule models, availability, grouping, dates, phone validation, storage/retry keys and API request serialization/error handling | `npm run test:unit --prefix stand.client` |
| Client integration | React/MUI deletion confirmation and the availability hook, including focus, dismissal, busy/error/retry states and request cleanup | `npm run test:integration --prefix stand.client` |

The original SQL scenarios are retained in `*Checks.cs` and run as one regression test. Their detailed assertions remain in test output. The legacy console commands such as `dotnet run --project tests/Stand.Integration -- --adjacent-shifts` still work after the disposable database has been initialized.

## Database isolation

SQL tests are fixed to `(localdb)\MSSQLLocalDB`, database `StandPerfTest`. They never read the application connection string. The shared test fixture creates this disposable database if missing and applies pending numbered scripts from `db/scripts`, recording their checksums in `__SchemaVersions`. The database remains available after the run; scenarios use rollback transactions or remove their own records and restore schedule settings. Do not use `StandPerfTest` for application data or run multiple copies of the SQL suite simultaneously.

The SQL scenarios run sequentially because they exercise global schedules, migrations and locks. HTTP tests run the actual application middleware, authentication, controllers and services through `WebApplicationFactory`; production authentication is not replaced with a test scheme. SQL Server is retained because SQLite/in-memory EF cannot verify the application's SQL locking, filtered indexes or migration scripts.

## Coverage contract

`node tests/run-tests.mjs` enforces these independent gates:

| Scope | Minimum |
| --- | --- |
| Entire `Stand.Server` assembly, including controllers, services, startup, EF mappings/entities and DTOs | 80% lines **and** branches, combined across unit and integration tests |
| Client non-UI application logic: every `.ts` module under `src/api`, `src/utils`, `src/hooks`, and `src/features`, including modules not imported by tests | 80% lines, statements, functions **and** branches |

Only code marked with `GeneratedCodeAttribute` is omitted from server instrumentation. Async state machines are included. The client excludes the type-only API declarations and unused mock booking fixture. Client page/component `.tsx` rendering, app bootstrap/theme/styles, `Stand.DbMigrator` and test code are outside these percentage gates. React integration tests exercise selected UI behavior; the existing browser regression scripts remain separate and do not contribute to coverage. The percentages are not a claim of 80% coverage of all React pages.

Server coverage merges exact line identities and branch paths from both projects, rather than averaging percentages or summing duplicate lines. Missing reports, empty instrumentation, failing tests and a failed threshold cause a nonzero exit. `tests/coverage.test.mjs` verifies complementary coverage, deduplication and threshold failure behavior.

Useful variants:

```powershell
node tests/run-tests.mjs --server
node tests/run-tests.mjs --frontend
npm run test:coverage --prefix stand.client
npm run test:types --prefix stand.client
npm run test:watch --prefix stand.client
```

Standalone `dotnet test` runs tests without the combined coverage gate; use the runner for enforcement.

Each run writes server TRX results, original collector JSON/Cobertura, merged `coverage.cobertura.xml` and per-file `summary.json` under `artifacts/tests/<timestamp>/`. `artifacts/tests/latest.txt` points to the latest run. Client reports are in `stand.client/coverage/` (`index.html`, `lcov.info`, and `coverage-summary.json`). CI uploads these reports even when a test fails. Generated reports are ignored by Git.

## README badges

The test-status badge shows the `Tests and coverage` workflow status for pushes to `master`. The two coverage badges show measured **line coverage** for the server and frontend non-UI logic, using the same scopes as the coverage gates above.

After tests, coverage gates and the client build succeed, CI generates SVGs from that run's actual JSON reports using `node tests/coverage-badges.mjs`. Only successful pushes to `master` publish them to the separate `coverage-badges` branch. The publisher uses the built-in `GITHUB_TOKEN` with `contents: write`; test jobs retain read-only repository access. No third-party coverage service or additional secret is required. Badge updates do not modify `master` or trigger another test run.

Coverage badges become available after the first successful `master` push containing this workflow change. Later failing runs update the test-status badge while coverage continues to show the last successful result. Publishing is serialized and ignores older run numbers so a slow older run cannot overwrite newer coverage. The published `coverage.json` records the source commit and CI run URL. GitHub may briefly cache badge images.

To preview badges locally after a complete successful test run:

```powershell
node tests/coverage-badges.mjs
```

Generated SVGs and their metadata are written to `artifacts/badges/`.
