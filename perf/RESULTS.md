Performance test performed on 16 October 2026.

The highest sustained hosted load verified against the agreed overall targets
was **1,250 simulated active visitors**: 129,326 requests over ten minutes,
215.5 requests/second, overall p95 964.8 ms, and 298 failed requests (0.2304%).
The user reported 198 MB RAM during that run. This is a narrow aggregate pass:
session-check (`/api/auth/me`) p95 was 1,967 ms, p99 across all requests was
6,390 ms, and per-endpoint targets were not all met. At 1,750 visitors, the
ten-minute run failed the overall latency target; 2,000 visitors failed both
latency and errors in its two-minute run. No precise absolute maximum was proven.

The hosted tests reuse three accounts and exclude asset downloads and browser
rendering. These counts describe this paced API traffic model, rather than
verified capacity for the same number of distinct people's data. Each visitor
makes approximately five reads per thirty seconds; ten percent of journeys
attempt booking, followed by cancellation to keep slots usable. The highest
sustained local load meeting the targets under an enforced 256 MiB private
memory cap was 2,000 distinct synthetic users, with 224.1 MiB peak private memory.

This report includes local measurements and HTTPS tests on the designated
MonsterASP test site. The local measurements use a hard 256 MiB limit on the complete
.NET website process. They are separate from the hosted measurements below.
The application was published in Release, with its existing code and default
server GC. Local server logging was set to Warning. No application performance
optimizations were made.

The machine exposes 12 logical processors. The server used .NET/ASP.NET Core
10.0.13, built with SDK 10.0.402. Node 22.13.0 generated traffic in a separate
process, and SQL Server LocalDB hosted the isolated `StandPerfTest` database
outside the website's memory limit. SQL, the generator and the server share the
local machine's CPU; there is no simulated remote database network latency.

Each signed-in user repeats a thirty-second journey with five API reads and
think time. Ten percent of journeys attempt a booking, then cancel that new
booking. Users have unique synthetic accounts and source IPs. Login happens
before latency timing, but its memory use is included. See [README.md](README.md)
for the full workload, exclusions, seed commands and rerun instructions.

| Users | Measured duration | Overall p95 | Requests/s | Failed requests | Sampled peak private memory | Result |
| ---: | --- | ---: | ---: | --- | ---: | --- |
| 1 | 35 seconds | 88 ms | 0.23 | 0 / 8 | 38.6 MiB | Smoke test passed |
| 100 | 2 minutes | 12 ms | 17.5 | 0 / 2,096 | 54.1 MiB | Passed |
| 1,000 | 2 minutes | 13 ms | 173.5 | 0 / 20,822 | 77.2 MiB | Passed |
| 5,000 | 2 minutes | 281 ms | 866.3 | 3 / 103,966 (0.0029%) | 256.0 MiB | Numeric latency/error targets met, memory at cap |
| 6,000 | Aborted; about 70 seconds including setup | Not completed | — | Requests failed before crash | 255.0 MiB | Out of memory; process crashed |
| 5,000 repeat | Intended 10 minutes; aborted after about 55 seconds including setup | Not completed | — | Requests failed before crash | 254.9 MiB | Out of memory; process crashed |
| 4,000 | Intended 10 minutes; aborted after about 534 seconds including setup | Not completed | — | Requests failed before crash | 240.8 MiB | Out of memory; process crashed |
| 3,000 | 10 minutes | 1,264 ms | 519.7 | 69 / 311,822 (0.0221%) | 250.0 MiB | Completed, but failed latency target |
| 2,000 | 10 minutes | 361 ms | 346.7 | 4 / 208,027 (0.0019%) | 224.1 MiB | Passed; 4,012 successful bookings; cleanup complete |

The first 5,000-user run's original raw JSON has `passed: false` because the
initial harness additionally required zero failed journeys. The criterion was
subsequently aligned with the agreed request failure target of less than 1%.
Its aggregate p95 was 281 ms; its slowest endpoint p95 was 940 ms for slots.
It completed 1,980 successful bookings, recorded 3 expected `SLOT_FULL`
conflicts, and returned HTTP 500 on 3 bookings due to SQL deadlocks. It is not
considered sustainable because the repeat crashed.

The fixture began with an empty migrated database, seeded dates/locations and
synthetic users. It was expanded from 5,000 to 10,000 accounts before the
6,000-user test. Cancelled booking history and bookings left by aborted runs
were retained between runs, so later runs include accumulated data rather than
an identical empty dataset. This also means the unstable 5,000-user results
cannot be attributed to memory alone without further controlled comparisons.

The memory cap was enforced by a Windows Job Object. MonsterASP instead
documents [IIS worker recycling when the private memory limit is reached](https://help.monsterasp.net/websites/configuration/memory-limit).
The observed OOM is therefore a local failure under the budget, not a claim
that MonsterASP will fail in precisely the same way. Its free plan uses
[shared servers](https://help.monsterasp.net/getting-started/first-steps/free-vs-premium);
IIS overhead, CPU contention and the remote SQL server can reduce capacity.

Raw logs, summaries and memory/CPU samples are retained in the ignored
`artifacts/perf/results/` directory. Source scripts live in `perf/`.

Hosted measurements use the user-designated `https://stand.runasp.net` site.
Only three test identities are available, so sessions are shared across simulated
visitors. The request pacing matches the local tests, but identity diversity,
dataset size and server configuration differ. These results should not be used
as proof that the same number of distinct accounts will perform identically.

| Simulated visitors | Duration | Overall p95 | Requests/s | Failed requests | Successful bookings | Result |
| ---: | --- | ---: | ---: | --- | ---: | --- |
| 3 | 35 seconds | 129 ms | 0.60 | 0 / 21 | 0 | Smoke test passed |
| 100 | 2 minutes | 122 ms | 17.4 | 0 / 2,084 | 42 | Passed |
| 500 | 2 minutes | 128 ms | 86.6 | 0 / 10,388 | 194 | Passed |
| 1,000 | 2 minutes | 146 ms | 173.0 | 1 / 20,757 (0.0048%) | 378 | Passed; one duplicate-phone conflict |
| 2,000 | 2 minutes | 9,875 ms | 336.5 | 1,003 / 40,387 (2.4835%) | 622 | Failed latency and error targets |
| 1,500 | 2 minutes | 168 ms | 259.7 | 13 / 31,169 (0.0417%) | 578 | Overall targets met; slots p95 1,177 ms |
| 1,750 | 2 minutes | 401 ms | 302.6 | 13 / 36,316 (0.0358%) | 652 | Passed; all endpoint p95 values below 1 second |
| 1,750 | 10 minutes | 1,862 ms | 300.2 | 913 / 180,103 (0.5069%) | 3,400 | Failed sustained latency target; generator healthy |
| 1,250 | 10 minutes | 965 ms | 215.5 | 298 / 129,326 (0.2304%) | 2,424 | Overall targets met; session-check p95 1,967 ms |

Hosted latency is measured end-to-end over HTTPS from the generator. It excludes
initial login and asset downloads. Hosted RAM and recycle metrics must be read
from the MonsterASP control panel; they cannot be measured by this HTTP client.
For the 1,750-visitor sustained test window, the user reported a 311 MB RAM peak.
The panel metric (private memory versus working set) and recycle logs have not
yet been confirmed. This is above the nominal 256 MB budget, but it is not enough
to attribute the slowdown to a particular memory mechanism. Hosted runs reuse
the running application; the application was not manually restarted between
load levels, so retained memory and prior workload can affect later runs.
During the subsequent 1,250-visitor run, the user reported 198 MB RAM at about
18:12 Kyiv time, below the nominal budget. This is a user-observed panel reading
during the run; continuous process telemetry and a final whole-run memory peak
are not available to the HTTP generator.
The 1,250-visitor run's failures comprised 32 duplicate-phone conflicts, one
HTTP 500 and 265 connection/socket-timeout failures. The generator was healthy
(0.042 CPU cores on average, event-loop p95 35.7 ms). Known-token cancellation
cleanup completed with zero remaining tokens. Creation responses lost after
commit can still leave bookings whose tokens were never received, as described
in the benchmark instructions. Cancelled booking history is retained.

During development, the harness initially included stricter checks in its
`passed` flag: zero failed journeys, then per-endpoint p95 under one second.
The final harness uses the agreed overall p95/error thresholds for `passed`
and reports `endpointTargetsMet` separately. Historical raw flags therefore
need to be read together with their actual measurements. The 1,500-user hosted
run's raw `passed: false` reflects its slow slots endpoint, although its overall
latency/error targets were met. No historical raw measurements were rewritten.
