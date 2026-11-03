param([string]$OutputPath = (Join-Path $env:TEMP 'jv-pd-extended-catalog.json'))
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$projectRoot = Split-Path -Parent $repoRoot
$books = @((Join-Path $projectRoot 'JV-комплектация 08.10.2026.xlsm'), (Join-Path $projectRoot 'JV-розница 08.10.2026.xlsm'))
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AutomationSecurity = 3
$excel.EnableEvents = $false
$result = [ordered]@{}
try {
  foreach ($book in $books) {
    $workbook = $excel.Workbooks.Open((Resolve-Path $book).Path, 0, $true)
    try {
      $sheet = $workbook.Worksheets.Item('ПД')
      $tables = [ordered]@{}
      foreach ($spec in @(@('oneSidedLongitudinal', 'D117:BA166'), @('twoSidedLongitudinal', 'D173:BA222'))) {
        $range = $sheet.Range($spec[1])
        try {
          $matrix = $range.Value2
          $rows = [System.Collections.Generic.List[object]]::new()
          for ($r = 1; $r -le 50; $r++) {
            $row = [System.Collections.Generic.List[object]]::new()
            for ($c = 1; $c -le 50; $c++) {
              $value = $matrix.GetValue($r, $c)
              if ($null -eq $value) { $row.Add($null) }
              elseif ($value -is [ValueType]) { $row.Add([Convert]::ToString($value, [Globalization.CultureInfo]::InvariantCulture)) }
              else { $row.Add([string]$value) }
            }
            $rows.Add([object[]]$row.ToArray())
          }
          $tables[$spec[0]] = [object[]]$rows.ToArray()
        } finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($range) }
      }
      $result[[IO.Path]::GetFileName($book)] = $tables
    } finally {
      $workbook.Close($false)
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheet)
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($workbook)
    }
  }
} finally { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) }
[IO.File]::WriteAllText($OutputPath, (ConvertTo-Json -InputObject $result -Depth 10), [Text.UTF8Encoding]::new($false))
Write-Output $OutputPath
