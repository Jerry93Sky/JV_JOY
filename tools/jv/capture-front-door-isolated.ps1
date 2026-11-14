param([string]$OutputPath='docs/jv/fixtures/front-door-isolated-excel.json')
$ErrorActionPreference='Stop'
$cases=(Get-Content -Raw -LiteralPath 'docs/jv/fixtures/front-pr12a-excel.json'|ConvertFrom-Json).scenarios
$manifest=(Get-Content -Raw -LiteralPath 'docs/jv/fixtures/unified-order-all-seven-inputs.json'|ConvertFrom-Json).scenarios
$excel=New-Object -ComObject Excel.Application
$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.AutomationSecurity=3;$excel.EnableEvents=$false;$excel.AskToUpdateLinks=$false
$results=[Collections.Generic.List[object]]::new()
function Cell($sheet,$address){$c=$sheet.Range($address);[ordered]@{formula=[string]$c.Formula;value2=$c.Value2;text=[string]$c.Text;numberFormat=[string]$c.NumberFormat}}
try { foreach($profile in @('COMPLETATION','RETAIL')) {
 $case=$cases|Where-Object {$_.scenarioId -eq "$profile-fittings"}|Select-Object -First 1
 $source=Join-Path (Split-Path -Parent (Get-Location).Path) $case.workbook
 $hash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant();if($hash -ne $case.sourceSha256){throw 'Workbook hash mismatch'}
 $tmp=Join-Path ([IO.Path]::GetTempPath()) ('jv-door-'+[guid]::NewGuid().ToString('N')+'.xlsm');Copy-Item -LiteralPath $source -Destination $tmp
 $wb=$excel.Workbooks.Open($tmp,0,$false)
 try {
  $m=$wb.Worksheets.Item('Главная');$s=$wb.Worksheets.Item('Настройки');$f=$wb.Worksheets.Item('F1')
  foreach($row in 11..17){foreach($col in @('C','D','F','Z')){$m.Range("$col$row").Value2=0}}
  foreach($a in @('C11','D11','F11','H11','I11','J11','L11')){$m.Range($a).Value2=$case.main.$a.value}
  $m.Range('Z11').Value2=1;$m.Range('F28').Value2=1;$m.Range('B26').Value2=1
  foreach($a in @('H38','H40','H42','H44','I42','I44')){$s.Range($a).Value2=$case.settings.$a.value}
  foreach($a in @('C18','C19','C20','C21','C22','C23','C24','D18','D19')){$f.Range($a).Value2=$case.front.$a.value}
  $excel.CalculateFullRebuild()
  $cells=[ordered]@{};foreach($a in @('C3','C4','C5','C8','C18','C19','C20','C21','C22','C23','C24','D18','D19','I23','Y5','Q27','Q28','Q29','Q30','R27','R28','R29','R30','S27','S28','S29','S30','S33','S34','S35','S36','S37','S38')){$cells[$a]=Cell $f $a}
  $main=[ordered]@{};foreach($a in @('F28','B26','C11','D11','F11','H11','I11','J11','L11','Z11','X11','Y11','AA11','AA18')){$main[$a]=Cell $m $a}
  $settings=[ordered]@{};foreach($a in @('I42','D32','D33','D34','L3','D5','D14','D19','D21')){$settings[$a]=Cell $s $a}
  $results.Add([ordered]@{profile=$profile;workbook=$case.workbook;sourceSha256=$hash;excelVersion=$excel.Version;method='CalculateFullRebuild on temporary workbook';cells=$cells;main=$main;settings=$settings})
 }finally{$wb.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb);Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue}
} }finally{$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel);[GC]::Collect();[GC]::WaitForPendingFinalizers()}
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),([ordered]@{schemaVersion='1.0';cases=$results}|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
