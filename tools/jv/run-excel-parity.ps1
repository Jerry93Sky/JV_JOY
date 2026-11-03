$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$raw = Join-Path $env:TEMP ('JV_JOY_PR06_excel_' + [guid]::NewGuid().ToString('N') + '.json')
Push-Location $root
try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'recalculate-line-cutting-golden.ps1') -OutputPath $raw
  if ($LASTEXITCODE -ne 0) { throw 'Excel CalculateFullRebuild capture failed' }
  & node (Join-Path $PSScriptRoot 'build-line-price-fixtures.mjs') $raw (Join-Path $root 'docs/jv/fixtures')
  if ($LASTEXITCODE -ne 0) { throw 'Golden fixture generation failed' }
  & node --experimental-strip-types (Join-Path $PSScriptRoot 'compare-line-cutting-excel-golden.mjs') $raw (Join-Path $root 'docs/jv/fixtures/line-cutting-excel-golden.json')
  if ($LASTEXITCODE -ne 0) { throw 'Geometry/BOM/work parity failed' }
  & node (Join-Path $PSScriptRoot 'build-line-final-price-parity.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Q55/Q57 detailed parity report failed' }
  & node --experimental-strip-types (Join-Path $PSScriptRoot 'verify-line-price-parity.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Price parity failed' }
  & node --experimental-strip-types (Join-Path $PSScriptRoot 'verify-line-material-parity.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'BOM parity failed' }
  & node --experimental-strip-types (Join-Path $PSScriptRoot 'verify-line-bom-price-parity.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Material amount parity failed' }
  & node --experimental-strip-types (Join-Path $PSScriptRoot 'verify-line-sash-profile-parity.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Sash geometry parity failed' }
  & node --experimental-strip-types (Join-Path $PSScriptRoot 'verify-line-additional-parity.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Additional rows parity failed' }
} finally {
  Pop-Location
  Remove-Item -LiteralPath $raw -Force -ErrorAction SilentlyContinue
}
