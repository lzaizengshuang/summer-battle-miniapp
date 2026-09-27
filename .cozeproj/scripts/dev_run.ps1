$ErrorActionPreference = "Stop"

function Stop-ProcessTree([int] $processId) {
  if ($processId -gt 0 -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
    & taskkill.exe /PID $processId /T /F *> $null
  }
}

function Stop-ListeningProcess([int] $port) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-ProcessTree $_ }
}

function Start-DevProcess([string] $workingDirectory, [string] $logFile, [hashtable] $environment) {
  $previousEnvironment = @{}
  foreach ($key in $environment.Keys) {
    $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $environment[$key], 'Process')
  }

  try {
    return Start-Process -FilePath "pnpm.cmd" -ArgumentList @("dev") -WorkingDirectory $workingDirectory -RedirectStandardOutput $logFile -RedirectStandardError "$logFile.error" -PassThru
  } finally {
    foreach ($key in $environment.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process')
    }
  }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$workspace = if ($env:COZE_WORKSPACE_PATH) { $env:COZE_WORKSPACE_PATH } else { $projectRoot }
$env:COZE_WORKSPACE_PATH = $workspace
$port = if ($env:DEPLOY_RUN_PORT) { [int] $env:DEPLOY_RUN_PORT } elseif ($env:PORT) { [int] $env:PORT } else { 5000 }
$serverPort = if ($env:SERVER_PORT) { [int] $env:SERVER_PORT } else { 3000 }
$logDirectory = if ($env:COZE_LOG_DIR) { $env:COZE_LOG_DIR } else { Join-Path $workspace "logs" }
$logFile = Join-Path $logDirectory "dev.log"
$pidFile = Join-Path $logDirectory "dev.pid"
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

if (Test-Path $pidFile) {
  Stop-ProcessTree ([int] (Get-Content $pidFile -Raw))
  Remove-Item $pidFile -Force
}
Stop-ListeningProcess $port
Stop-ListeningProcess $serverPort

$environment = @{ COZE_WORKSPACE_PATH = $workspace; PORT = "$port"; SERVER_PORT = "$serverPort" }
if ($env:COZE_PROJECT_DOMAIN_DEFAULT) {
  $environment.PROJECT_DOMAIN = $env:COZE_PROJECT_DOMAIN_DEFAULT
}

$process = Start-DevProcess $workspace $logFile $environment
$process.Id | Set-Content $pidFile
Start-Sleep -Seconds 1
if ($process.HasExited) {
  Get-Content "$logFile.error" -Tail 20 -ErrorAction SilentlyContinue
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  exit 1
}

Write-Host "Taro H5 and NestJS services started. PID: $($process.Id)"
Write-Host "Web port: $port; server port: $serverPort"
Write-Host "Log file: $logFile"
