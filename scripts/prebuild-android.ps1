Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$driveLetter = @("M", "N", "O", "P", "Q", "R") |
  Where-Object { -not (Test-Path "$($_):\") } |
  Select-Object -First 1

if (-not $driveLetter) {
  throw "No free drive letter is available for Android prebuild."
}

$driveName = "${driveLetter}:"
$substPath = Join-Path $env:SystemRoot "System32\subst.exe"
$mapped = $false
$exitCode = 1

try {
  & $substPath $driveName $repositoryRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Could not map the repository to a temporary drive."
  }
  $mapped = $true

  Push-Location "$driveName\apps\mobile"
  try {
    & npx.cmd expo prebuild --platform android --no-install
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  if ($mapped) {
    & $substPath $driveName /D | Out-Null
  }
}

exit $exitCode
