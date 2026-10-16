param(
    [ValidateRange(1,10000)][int]$Users = 1,
    [ValidateRange(1,86400)][int]$Seconds = 120,
    [ValidateRange(16,32768)][int]$MemoryMb = 256,
    [switch]$WorkstationGc,
    [ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$Label = 'baseline'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$site = Join-Path $root 'artifacts/perf/site'
$results = Join-Path $root 'artifacts/perf/results'
New-Item -ItemType Directory -Force -Path $results | Out-Null
Add-Type -Path (Join-Path $PSScriptRoot 'ProcessLimit.cs')
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5116'
$env:ASPNETCORE_CONTENTROOT = $site
$env:ConnectionStrings__Default = 'Server=(localdb)\MSSQLLocalDB;Database=StandPerfTest;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true'
$env:Logging__LogLevel__Default = 'Warning'
$env:Logging__LogLevel__Microsoft = 'Warning'
if ($WorkstationGc) { $env:DOTNET_gcServer = '0' }
else { Remove-Item Env:DOTNET_gcServer -ErrorAction SilentlyContinue }
$runId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,6)
$name = "$Label-$Users-$Seconds-$runId"
Write-Host "Results: $results/$name-*"
$server = $null
$load = $null
$job = [IntPtr]::Zero
$samples = [System.Collections.Generic.List[object]]::new()
$watch = [Diagnostics.Stopwatch]::StartNew()
$runPassed = $false
try {
    $server = Start-Process -FilePath (Join-Path $site 'Stand.Server.exe') -WorkingDirectory $site -WindowStyle Hidden -PassThru -RedirectStandardOutput "$results/$name-server.log" -RedirectStandardError "$results/$name-server-error.log"
    $job = [PerfProcessLimit]::Attach($server.Handle, [uint64]$MemoryMb * 1MB)
    $ready = $false
    for ($i=0; $i -lt 150; $i++) {
        $server.Refresh()
        if ($server.HasExited) { throw 'Server exited during startup; inspect server logs.' }
        $samples.Add([pscustomobject]@{seconds=$watch.Elapsed.TotalSeconds; privateMb=$server.PrivateMemorySize64/1MB; workingSetMb=$server.WorkingSet64/1MB; cpuSeconds=$server.TotalProcessorTime.TotalSeconds})
        try {
            $response = Invoke-WebRequest 'http://127.0.0.1:5116/' -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $ready=$true; break }
        } catch {}
        Start-Sleep -Milliseconds 200
    }
    if (!$ready) { throw 'Server did not become ready.' }
    $loadArgs = @((Join-Path $PSScriptRoot 'load.mjs'), 'http://127.0.0.1:5116', $Users, $Seconds, "$results/$name-load.json") | ForEach-Object { '"' + $_ + '"' }
    $load = Start-Process node -ArgumentList $loadArgs -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput "$results/$name-load.log" -RedirectStandardError "$results/$name-load-error.log"
    while (!$load.HasExited) {
        $server.Refresh()
        if ($server.HasExited) { throw 'Server exited under load; inspect logs for allocation failures.' }
        $samples.Add([pscustomobject]@{seconds=$watch.Elapsed.TotalSeconds; privateMb=$server.PrivateMemorySize64/1MB; workingSetMb=$server.WorkingSet64/1MB; cpuSeconds=$server.TotalProcessorTime.TotalSeconds})
        if ($watch.Elapsed.TotalSeconds -gt ($Seconds + $Users * 2 + 120)) { throw 'Load generator exceeded time budget.' }
        Start-Sleep -Milliseconds 100
        $load.Refresh()
    }
    if (!(Test-Path "$results/$name-load.json")) { throw 'Load generator failed before writing results; inspect load-error.log.' }
    $result = Get-Content "$results/$name-load.json" -Raw | ConvertFrom-Json
    $result | Add-Member memoryLimitMb $MemoryMb
    $result | Add-Member peakPrivateMb (($samples | Measure-Object privateMb -Maximum).Maximum)
    $result | Add-Member peakWorkingSetMb (($samples | Measure-Object workingSetMb -Maximum).Maximum)
    $result | Add-Member gcMode $(if ($WorkstationGc) { 'workstation' } else { 'published default' })
    $result | ConvertTo-Json -Depth 10 | Set-Content "$results/$name-summary.json"
    $result | Select-Object users,passed,p95Ms,errorRate,requestsPerSecond,peakPrivateMb,bookings | Format-List
    $runPassed = $result.passed
} catch {
    [pscustomobject]@{
        users=$Users; requestedSeconds=$Seconds; passed=$false
        failure=$_.Exception.Message; elapsedIncludingSetupSeconds=$watch.Elapsed.TotalSeconds
        memoryLimitMb=$MemoryMb
        peakPrivateMb=(($samples | Measure-Object privateMb -Maximum).Maximum)
        peakWorkingSetMb=(($samples | Measure-Object workingSetMb -Maximum).Maximum)
    } | ConvertTo-Json | Set-Content "$results/$name-summary.json"
    throw
} finally {
    $samples | Export-Csv "$results/$name-memory.csv" -NoTypeInformation
    if ($load -and !$load.HasExited) { Stop-Process -Id $load.Id -Force }
    if ($job -ne [IntPtr]::Zero) { [PerfProcessLimit]::CloseHandle($job) | Out-Null }
    elseif ($server -and !$server.HasExited) { Stop-Process -Id $server.Id -Force }
}
if (!$runPassed) { exit 2 }
