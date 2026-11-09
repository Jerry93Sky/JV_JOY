param([string]$OutputPath=(Join-Path $PSScriptRoot '..\..\docs\jv\fixtures\front-material-price-parity.xlsx.json'))
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$source=Get-Content (Join-Path $root 'docs\jv\fixtures\front-pr12a-excel.json') -Raw | ConvertFrom-Json
$excel=New-Object -ComObject Excel.Application;$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.AutomationSecurity=3;$excel.EnableEvents=$false
$rows=[Collections.Generic.List[object]]::new()
try {
 foreach($profile in @('COMPLETATION','RETAIL')) {
  $bookName=if($profile -eq 'COMPLETATION'){'JV-комплектация 08.10.2026.xlsm'}else{'JV-розница 08.10.2026.xlsm'}
  $sourceBook=Join-Path (Split-Path -Parent $root) $bookName
  $hash=(Get-FileHash $sourceBook -Algorithm SHA256).Hash.ToLowerInvariant()
  foreach($id in @('base','wide','door_one')) {
   $case=$source.scenarios | Where-Object {$_.profile -eq $profile -and $_.scenarioId -eq "$profile-$id"} | Select-Object -First 1
   $tmp=Join-Path ([IO.Path]::GetTempPath()) ("front-price-"+[guid]::NewGuid().ToString('N')+'.xlsm');Copy-Item $sourceBook $tmp
   $wb=$excel.Workbooks.Open($tmp)
   try {
    $m=$wb.Worksheets.Item('Главная');$f=$wb.Worksheets.Item('F1');$s=$wb.Worksheets.Item('Настройки')
    foreach($a in @('C11','D11','F11','H11','I11','J11','L11')){$m.Range($a).Value2=$case.main.$a.value}
    foreach($a in @('H38','H40','H42','H44','I42','I44')){$s.Range($a).Value2=$case.settings.$a.value}
    foreach($a in @('C18','C19','C20','C21','C22','C23','C24')){$f.Range($a).Value2=$case.front.$a.value}
    $excel.CalculateFullRebuild()
    foreach($cell in @('R5:R32','S5:S33','X11','Y11','AA11')) { $range=if($cell -match ':'){$f.Range($cell)}elseif($cell -match '^X|^Y|^AA'){$m.Range($cell)}else{$f.Range($cell)}
     if($cell -match ':'){foreach($r in $range.Rows){foreach($c in $r.Cells){$a=$c.Address($false,$false);$rows.Add([ordered]@{profile=$profile;scenarioId=$case.scenarioId;workbook=$bookName;sha256=$hash;address="$($c.Worksheet.Name)!$a";formula=$c.Formula;value=$c.Value2;numberFormat=$c.NumberFormat;inputs=$case.inputs;d5=$s.Range('D5').Value2;d14=$s.Range('D14').Value2})}}}
     else {$rows.Add([ordered]@{profile=$profile;scenarioId=$case.scenarioId;workbook=$bookName;sha256=$hash;address="$($range.Worksheet.Name)!$cell";formula=$range.Formula;value=$range.Value2;numberFormat=$range.NumberFormat;inputs=$case.inputs;d5=$s.Range('D5').Value2;d14=$s.Range('D14').Value2})}
    }
   } finally {$wb.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb);Remove-Item $tmp -Force -ErrorAction SilentlyContinue}
  }
 }
 $dir=Split-Path -Parent $OutputPath;New-Item -ItemType Directory $dir -Force|Out-Null
 [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),([ordered]@{schemaVersion='1.0';method='Excel 16 COM CalculateFullRebuild temporary copies';records=$rows}|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
} finally {$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel);[GC]::Collect();[GC]::WaitForPendingFinalizers()}
"Captured $($rows.Count) material price parity records"
