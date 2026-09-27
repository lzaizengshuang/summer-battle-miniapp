$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$workspace = if ($env:COZE_WORKSPACE_PATH) { $env:COZE_WORKSPACE_PATH } else { $projectRoot }
$env:COZE_WORKSPACE_PATH = $workspace
Set-Location $workspace

& pnpm validate
exit $LASTEXITCODE
