param(
  [Parameter(Mandatory)][string]$ManifestPath,
  [Parameter(Mandatory)][string]$OutputPath,
  [string]$SourceDirectory = (Split-Path -Parent (Get-Location).Path)
)

$ErrorActionPreference = 'Stop'
$scenarios = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AutomationSecurity = 3
$excel.EnableEvents = $false
$excel.AskToUpdateLinks = $false
$records = [Collections.Generic.List[object]]::new()
$sourceHashes = @{}

function ReadCell($sheet, [string]$address) {
  $range = $sheet.Range($address)
  $value = $range.Value2
  $text = [string]$range.Text
  # COM Value2 uses signed HRESULTs for CVErr; Excel numeric cells marshal as doubles.
  $native = @{2000='#NULL!';2007='#DIV/0!';2015='#VALUE!';2023='#REF!';2029='#NAME?';2036='#NUM!';2042='#N/A';2043='#GETTING_DATA'}
  $errorType = $null
  if ($value -is [int] -and $text.StartsWith('#')) {
    $cvErr = [int]($value + 2146828288)
    if ($native.ContainsKey($cvErr)) { $errorType = $native[$cvErr] }
  }
  return [ordered]@{
    formula=if ($range.HasFormula) { [string]$range.Formula } else { $null }
    value2=$value
    text=$text
    numberFormat=[string]$range.NumberFormat
    isBlank=($null -eq $value -and -not $range.HasFormula)
    errorType=$errorType
  }
}

try {
  if ($excel.Version -ne '16.0') { throw "Unexpected Excel version $($excel.Version)" }
  foreach ($scenario in $scenarios) {
    $source = Join-Path $SourceDirectory $scenario.workbook
    if (-not $sourceHashes.ContainsKey($source)) {
      $sourceHashes[$source] = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    if ($sourceHashes[$source] -ne $scenario.sourceSha256) { throw "Source hash mismatch for $($scenario.profile)" }
    $temp = Join-Path ([IO.Path]::GetTempPath()) ('jv-f28-expanded-' + [guid]::NewGuid().ToString('N') + '.xlsm')
    Copy-Item -LiteralPath $source -Destination $temp
    $book = $null
    try {
      $book = $excel.Workbooks.Open($temp, 0, $false)
      foreach ($ref in $scenario.primaryInputWrites) {
        $cell = $book.Worksheets.Item([string]$ref.sheet).Range([string]$ref.address)
        if ($cell.HasFormula) { throw "Input would overwrite formula: $($ref.sheet)!$($ref.address)" }
        $value = $ref.value
        if ($null -eq $value) {
          $area = $cell.MergeArea
          if ($area.Cells.Item(1,1).Address() -ne $cell.Address()) { throw "Cannot clear non-anchor cell: $($ref.sheet)!$($ref.address)" }
          [void]$area.ClearContents()
        }
        elseif ($value -is [bool]) { $cell.Value2 = [bool]$value }
        elseif ($value -is [int] -or $value -is [long]) { $cell.Value2 = [int]$value }
        elseif ($value -is [double]) { $cell.Value2 = [double]$value }
        else { $cell.Value2 = [string]$value }
      }
      $excel.CalculateFullRebuild()
      $inputs = [ordered]@{}
      foreach ($ref in $scenario.primaryInputWrites) {
        $inputs["$($ref.sheet)!$($ref.address)"] = ReadCell ($book.Worksheets.Item([string]$ref.sheet)) $ref.address
      }
      $derived = [ordered]@{}
      foreach ($ref in $scenario.derivedInputs) {
        $derived["$($ref.sheet)!$($ref.address)"] = ReadCell ($book.Worksheets.Item([string]$ref.sheet)) $ref.address
      }
      $outputs = [ordered]@{}
      foreach ($ref in $scenario.watch) {
        $outputs["$($ref.sheet)!$($ref.address)"] = ReadCell ($book.Worksheets.Item([string]$ref.sheet)) $ref.address
      }
      $records.Add([ordered]@{
        scenarioId=$scenario.scenarioId; profile=$scenario.profile; sourceSha256=$sourceHashes[$source];
        excelVersion=[string]$excel.Version; calculationMode='CalculateFullRebuild'; inputs=$inputs; derived=$derived; outputs=$outputs
      })
      Write-Output "Captured $($scenario.scenarioId)"
    } finally {
      if ($null -ne $book) { $book.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book) }
      Remove-Item -LiteralPath $temp -Force
    }
  }
  foreach ($source in $sourceHashes.Keys) {
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sourceHashes[$source]) {
      throw "Original workbook changed: $source"
    }
  }
} finally {
  $excel.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), ($records | ConvertTo-Json -Depth 12 -Compress), [Text.UTF8Encoding]::new($false))
