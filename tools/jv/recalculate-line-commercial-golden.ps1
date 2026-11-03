param(
  [string]$CasesPath = (Join-Path $PSScriptRoot '..\..\docs\jv\fixtures\line-cutting-cases.json'),
  [string]$OutputPath = '',
  [int]$FinishOverride = 0,
  [int]$GlassOverride = 0,
  [int]$CommercialModeOverride = 0
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$projectRoot = Split-Path -Parent $repoRoot
$CasesPath = (Resolve-Path $CasesPath).Path
$cases = Get-Content -Raw -LiteralPath $CasesPath | ConvertFrom-Json
$sourceBooks = @(
  (Join-Path $projectRoot 'JV-комплектация 08.10.2026.xlsm'),
  (Join-Path $projectRoot 'JV-розница 08.10.2026.xlsm')
)
foreach ($book in $sourceBooks) {
  if (-not (Test-Path -LiteralPath $book -PathType Leaf)) { throw "Workbook not found: $book" }
}
$runRoot = Join-Path $env:TEMP ('JV_JOY_ExcelGolden_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
New-Item -ItemType Directory -Path $runRoot | Out-Null
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $runRoot 'golden-results.json' }

function Convert-ExcelValue($value) {
  if ($null -eq $value) { return $null }
  if ($value -is [bool]) { return $value }
  if ($value -is [string]) { return $value }
  if ($value -is [ValueType]) { return ([Convert]::ToString($value, [Globalization.CultureInfo]::InvariantCulture)) }
  return [string]$value
}
function Read-Cell($sheet, [string]$address) {
  $range = $null
  try {
    $range = $sheet.Range($address)
    $formula = $range.FormulaLocal
    $rawValue = $range.Value2
    $value = Convert-ExcelValue $rawValue
    $binary64 = $null
    if ($rawValue -is [double]) { $binary64 = [BitConverter]::DoubleToInt64Bits($rawValue).ToString('X16') }
    return [ordered]@{
      formula = (Convert-ExcelValue $formula)
      value = $value
      value2Type = if ($null -eq $rawValue) { $null } else { $rawValue.GetType().FullName }
      binary64 = $binary64
      displayedText = (Convert-ExcelValue $range.Text)
      numberFormat = (Convert-ExcelValue $range.NumberFormat)
    }
  } finally {
    if ($range -ne $null) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($range) }
  }
}

$excel = $null
$seedWorkbook = $null
$excelVersion = $null
$allResults = [System.Collections.Generic.List[object]]::new()
try {
  $excel = New-Object -ComObject Excel.Application
  $excelVersion = [string]$excel.Version
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AskToUpdateLinks = $false
  $excel.EnableEvents = $false
  $excel.AutomationSecurity = 3 # msoAutomationSecurityForceDisable
  $seedWorkbook = $excel.Workbooks.Add()
  $excel.Calculation = -4135 # xlCalculationManual: prevent open/input-triggered recalc passes.
  $seedWorkbook.Close($false)
  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($seedWorkbook)
  $seedWorkbook = $null
  $excel.ScreenUpdating = $false

  foreach ($source in $sourceBooks) {
    $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant()
    $caseIndex = 0
    foreach ($case in $cases.cases) {
      $caseDir = Join-Path $runRoot ($case.id + '_' + [IO.Path]::GetFileNameWithoutExtension($source))
      New-Item -ItemType Directory -Path $caseDir | Out-Null
      $copyPath = Join-Path $caseDir ([IO.Path]::GetFileName($source))
      Copy-Item -LiteralPath $source -Destination $copyPath
      $workbook = $null
      $main = $null
      $line = $null
      $settings = $null
      try {
        # UpdateLinks=0, ReadOnly=false. The source path is never opened for writing.
        $workbook = $excel.Workbooks.Open($copyPath, 0, $false)
        $main = $workbook.Worksheets.Item('Главная')
        $line = $workbook.Worksheets.Item('L1')
        $settings = $workbook.Worksheets.Item('Настройки')
        $priceSheet = $workbook.Worksheets.Item('Прайс-Line')
        $glueSheet = $workbook.Worksheets.Item('Клей+акт')
        $laborSheet = $workbook.Worksheets.Item('Прайс-сб+монт')

        $main.Range('C11').Value2 = [double]$case.main.width
        $main.Range('D11').Value2 = [double]$case.main.height
        $main.Range('J11').Value2 = [double]$case.main.openingSelector
        $main.Range('L11').Value2 = [double]$case.main.leaves
        $finishIndex = if ($FinishOverride -gt 0) { $FinishOverride } else { ($caseIndex % 4) + 1 }
        $glassIndex = if ($GlassOverride -gt 0) { $GlassOverride } else { (($caseIndex * 3) % 12) + 1 }
        $commercialModeIndex = if ($CommercialModeOverride -gt 0) { $CommercialModeOverride } elseif ($source -like '*розница*') { 3 } else { 1 }
        $main.Range('H11').Value2 = [double]$finishIndex
        $main.Range('I11').Value2 = [double]$glassIndex
        $main.Range('F28').Value2 = [double]$commercialModeIndex
        $main.Range('Z11').Value2 = [double]1
        foreach ($systemCell in @('Z12','Z13','Z14','Z15','Z16','Z17')) { $main.Range($systemCell).Value2 = [double]0 }
        $line.Range('C23').Value2 = [bool]$case.controls.parkedDoorSelected
        $line.Range('C24').Value2 = [double]$case.controls.parkedDoorPosition
        $line.Range('C21').Value2 = [bool]$case.controls.specialSashEnabled
        $line.Range('D21').Value2 = [double]$case.controls.specialSashWidth
        $line.Range('D22').Value2 = [double]$case.controls.rollerAxisToEdge
        foreach ($key in @('P2','P4','P5','P6','P7','P8','P9','P10','P14','P15')) {
          $settings.Range($key).Value2 = [double]$case.settings.$key
        }
        $settings.Range('D7').Value2 = [double]$case.settings.carrierProfileAllowance
        if ($null -ne $case.settings.assemblyEnabled) { $settings.Range('D33').Value2 = [bool]$case.settings.assemblyEnabled }
        if ($null -ne $case.settings.millingEnabled) { $settings.Range('L3').Value2 = [bool]$case.settings.millingEnabled }
        if ($null -ne $case.settings.installationEnabled) { $settings.Range('D34').Value2 = [bool]$case.settings.installationEnabled }

        $excel.CalculateFullRebuild()
        $timer = [Diagnostics.Stopwatch]::StartNew()
        while ($excel.CalculationState -ne 0) {
          if ($timer.Elapsed.TotalSeconds -gt 180) { throw ('Excel full recalculation timed out for ' + $case.id + ' in ' + $source) }
          Start-Sleep -Milliseconds 200
        }
        $workbook.Save()

        $lineCells = @('D3','D4','D5','D6','D7','D8','D9','D15','D16','D17','D18','D19','D20','D21','D22','D23','D24','D25','D33','D53','D54','C10','C21','C23','C24','C25','H21','I21','O15','I25','I26','I27','I42','I43','I44','I45','I46','I47','I48','I49','C28','D28','C29','D29','C30','D30','C31','D31','D32','C36','D36','C37','D37','C38','D38','C39','D39','C40','D40','C41','D41','C46','D46','C47','D47','C48','D48','C49','D49','C50','D50','C51','D51','F33','F34','F35','F36','F37','F38','F39','O5','O6','O7','P4','Q4','Q52','Q53','Q54','Q55','Q56','Q57','Q58','S52','S53','V15','V18','X5')
        # Capture formula outputs without normalizing COM Value2. These are recalculated values on copies.
        for ($row = 5; $row -le 51; $row++) {
          foreach ($column in @('L','M','N','O','P','Q','S','V')) { $lineCells += "$column$row" }
        }
        $priceCells = @{}
        for ($row = 3; $row -le 51; $row++) {
          foreach ($column in @('B','C','D','E','F','G')) { $priceCells["$column$row"] = Read-Cell $priceSheet "$column$row" }
        }
        $settingCells = @('P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P12','P13','P14','P15','P16','P17','D2','D6','D7','D8','D32','D33','D34','L3','L4','L5','L6','L7','L8','L23','P21')
        $lineValues = [ordered]@{}
        foreach ($cell in $lineCells) { $lineValues[$cell] = Read-Cell $line $cell }
        $settingValues = [ordered]@{}
        foreach ($cell in $settingCells) { $settingValues[$cell] = Read-Cell $settings $cell }
        $glueValues = [ordered]@{ O5 = (Read-Cell $glueSheet 'O5'); O18 = (Read-Cell $glueSheet 'O18') }
        $laborValues = [ordered]@{}
        foreach ($cell in @('C5','C8','C9','C10','C11','C12','C19','C25','C28')) { $laborValues[$cell] = Read-Cell $laborSheet $cell }
        $mainValues = [ordered]@{}
        foreach ($cell in @('F28','H11','I11','Z11','Z12','Z13','Z14','Z15','Z16','Z17')) { $mainValues[$cell] = Read-Cell $main $cell }
        $allResults.Add([ordered]@{
          workbook = [IO.Path]::GetFileName($source)
          workbookSha256 = $sourceHash
          excelVersion = [string]$excel.Version
          macrosForceDisabled = $true
          scenarioId = [string]$case.id
          scenarioInputs = $case
          scenarioSelectors = [ordered]@{ finishIndex = $finishIndex; glassIndex = $glassIndex; commercialModeIndex = $commercialModeIndex }
          values = [ordered]@{ Main = $mainValues; L1 = $lineValues; Settings = $settingValues; PriceLine = $priceCells; Glue = $glueValues; AssemblyInstall = $laborValues }
          temporaryWorkbookCopy = $copyPath
        })
      } finally {
        if ($workbook -ne $null) { $workbook.Close($true) }
        foreach ($comObject in @($laborSheet,$glueSheet,$priceSheet,$settings,$line,$main,$workbook)) {
          if ($comObject -ne $null) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($comObject) }
        }
      }
      $caseIndex++
    }
  }
} finally {
  if ($excel -ne $null) {
    if ($seedWorkbook -ne $null) { $seedWorkbook.Close($false); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($seedWorkbook) }
    $excel.Quit()
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)
  }
}
$payload = [ordered]@{
  schemaVersion = '1.0'
  runAt = (Get-Date).ToString('o')
  excelVersion = $excelVersion
  calculation = 'CalculateFullRebuild'
  macros = 'AutomationSecurity=ForceDisable; EnableEvents=false'
  sourceFiles = $sourceBooks
  cases = @($allResults)
}
$json = ConvertTo-Json -InputObject $payload -Depth 30
[IO.File]::WriteAllText($OutputPath, $json, [Text.UTF8Encoding]::new($false))
Write-Output $OutputPath
