param([string]$OutputPath=(Join-Path $PSScriptRoot '..\..\docs\jv\fixtures\front-commercial-components.xlsx.json'))
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
  foreach($id in @('base','wide','door_one','transom','fittings')) {
   $case=$source.scenarios | Where-Object {$_.profile -eq $profile -and $_.scenarioId -eq "$profile-$id"} | Select-Object -First 1
   $tmp=Join-Path ([IO.Path]::GetTempPath()) ("front-price-"+[guid]::NewGuid().ToString('N')+'.xlsm');Copy-Item $sourceBook $tmp
   $wb=$excel.Workbooks.Open($tmp)
   try {
    $m=$wb.Worksheets.Item('Главная');$f=$wb.Worksheets.Item('F1');$s=$wb.Worksheets.Item('Настройки');$prm=$wb.Worksheets.Item('ПРМ')
    foreach($a in @('C11','D11','F11','H11','I11','J11','L11')){$m.Range($a).Value2=$case.main.$a.value}
    foreach($a in @('H38','H40','H42','H44','I42','I44')){$s.Range($a).Value2=$case.settings.$a.value}
    foreach($a in @('C18','C19','C20','C21','C22','C23','C24','D18','D19')){$f.Range($a).Value2=$case.front.$a.value}
    if($id -eq 'wide'){$m.Range('H11').Value2=2;$m.Range('Z11').Value2=2;$s.Range('D32').Value2=$true}
    if($id -eq 'door_one'){$m.Range('H11').Value2=4;$m.Range('I11').Value2=5;$s.Range('D32').Value2=$true;$s.Range('D34').Value2=$true}
    if($id -eq 'transom'){$m.Range('H11').Value2=2;$m.Range('F28').Value2=2;$m.Range('Z11').Value2=3;$s.Range('D32').Value2=$true;$s.Range('D34').Value2=$true}
    $excel.CalculateFullRebuild()
    $orderPositions=@();foreach($orow in 11..17){$orderPositions+=@{mainRow=$orow;widthMm=$m.Range("C$orow").Value2;heightMm=$m.Range("D$orow").Value2;quantity=$m.Range("Z$orow").Value2}}
    foreach($cell in @('C18:C24','D18:D19','Q5:Q32','R5:R32','S5:S32','G28:G31','H28:H32','U5:U20','W5:W24','D35','S33','S34:S38','X11','Y11','AA11','Y5','R25','AB25','X11','Y11','AA11')) { $range=if($cell -match ':'){$f.Range($cell)}elseif($cell -in @('X11','Y11','AA11')){$m.Range($cell)}elseif($cell -in @('R25','AB25')){$prm.Range($cell)}else{$f.Range($cell)}
     if($cell -match ':'){foreach($r in $range.Rows){foreach($c in $r.Cells){$a=$c.Address($false,$false);$rows.Add([ordered]@{profile=$profile;scenarioId=$case.scenarioId;workbook=$bookName;sha256=$hash;address="$($c.Worksheet.Name)!$a";formula=$c.Formula;value=$c.Value2;numberFormat=$c.NumberFormat;inputs=$case.inputs;d5=$s.Range('D5').Value2;d14=$s.Range('D14').Value2;mainH11=$m.Range('H11').Value2;mainI11=$m.Range('I11').Value2;mainZ11=$m.Range('Z11').Value2;mainF28=$m.Range('F28').Value2;settingsD32=$s.Range('D32').Value2;settingsD34=$s.Range('D34').Value2;orderPositions=$orderPositions})}}}
     else {$rows.Add([ordered]@{profile=$profile;scenarioId=$case.scenarioId;workbook=$bookName;sha256=$hash;address="$($range.Worksheet.Name)!$cell";formula=$range.Formula;value=$range.Value2;numberFormat=$range.NumberFormat;inputs=$case.inputs;d5=$s.Range('D5').Value2;d14=$s.Range('D14').Value2;mainH11=$m.Range('H11').Value2;mainI11=$m.Range('I11').Value2;mainZ11=$m.Range('Z11').Value2;mainF28=$m.Range('F28').Value2;settingsD32=$s.Range('D32').Value2;settingsD34=$s.Range('D34').Value2;orderPositions=$orderPositions})}
    }
   } finally {$wb.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb);Remove-Item $tmp -Force -ErrorAction SilentlyContinue}
  }
 }
 $dir=Split-Path -Parent $OutputPath;New-Item -ItemType Directory $dir -Force|Out-Null
 [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),([ordered]@{schemaVersion='1.0';method='Excel 16 COM CalculateFullRebuild temporary copies';records=$rows}|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
} finally {$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel);[GC]::Collect();[GC]::WaitForPendingFinalizers()}
"Captured $($rows.Count) Front commercial component parity records"
