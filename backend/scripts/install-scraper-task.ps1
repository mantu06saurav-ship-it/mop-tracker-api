<#
.SYNOPSIS
    Registers (or removes) the Windows scheduled task that runs the MOP Tracker scraper.

.DESCRIPTION
    The task starts `pythonw.exe -m app.scraping.runner --scheduled` every few minutes, hidden.
    Each start only checks the Auto-Scrape schedule saved in the web app (Manage Users ->
    Auto-Scrape) and scrapes when a scheduled time has arrived that hasn't run yet, so run times
    are still changed from the web app, not here.

    The task runs whether or not anyone is logged on (no password is stored), never starts a
    second copy while a scrape is still going, and starts as soon as possible after a missed
    start (PC off or asleep).

    Run from an elevated PowerShell ("Run as administrator"), in this backend folder:
        powershell -ExecutionPolicy Bypass -File scripts\install-scraper-task.ps1
    Remove it again with:
        powershell -ExecutionPolicy Bypass -File scripts\install-scraper-task.ps1 -Uninstall

.PARAMETER IntervalMinutes
    How often the task checks the schedule. Default 15.

.PARAMETER WakeToRun
    Also wake the PC from sleep for each check.
#>
param(
    [int]$IntervalMinutes = 15,
    [switch]$WakeToRun,
    [switch]$Uninstall,
    [string]$TaskName = "MOP Tracker Scraper"
)

$ErrorActionPreference = "Stop"

if ($Uninstall) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'."
    return
}

$backendDir = Split-Path -Parent $PSScriptRoot
$pythonw = Join-Path $backendDir ".venv\Scripts\pythonw.exe"
if (-not (Test-Path $pythonw)) {
    throw "Python virtualenv not found at $pythonw. Create it first (see README: 'Scraper PC setup')."
}
if (-not (Test-Path (Join-Path $backendDir ".env"))) {
    throw "No .env in $backendDir. The scraper needs the same DB_* settings as the API."
}

$action = New-ScheduledTaskAction -Execute $pythonw -Argument "-m app.scraping.runner --scheduled" -WorkingDirectory $backendDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 12) `
    -WakeToRun:$WakeToRun
# S4U = "Run whether user is logged on or not" without storing a password. The scraper only needs
# the internet and SQL Server (SQL login from .env), not Windows network shares, so that's enough.
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description "Scrapes marketplace prices for MOP Tracker at the times set in the web app (Manage Users -> Auto-Scrape). Logs: $backendDir\logs" `
    -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName' (checks every $IntervalMinutes minutes)."
Write-Host "Logs: $(Join-Path $backendDir 'logs')"
