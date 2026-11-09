param([string]$Output='docs/jv/fixtures/zigzag-order-pr10g-excel.json')
$ErrorActionPreference='Stop'
$resolved=(& node tools/jv/resolve-excel-sources.mjs | ConvertFrom-Json)
$books=@(@{profile='COMPLETATION';path=$resolved.completion.path;hash=$resolved.completion.sha256},@{profile='RETAIL';path=$resolved.retail.path;hash=$resolved.retail.sha256})
$scenarios=@(
  @{id='two_zigzag_active_glass_c8_four';first=@{width=3600;height=2400;leaves=4;opening=2;quantity=1;c8=4;glass=9;n40=2;n41=3};second=@{width=4200;height=2500;leaves=5;opening=2;quantity=2;c8=2;glass=9;n40=1;n41=2};F28=2;D32=1;D33=1;D34=1;L3=1},
  @{id='two_zigzag_minimum_packages';first=@{width=2400;height=1800;leaves=3;opening=2;quantity=1;c8=1;glass=9;n40=0;n41=0};second=@{width=2600;height=1900;leaves=3;opening=2;quantity=1;c8=1;glass=9;n40=0;n41=0};F28=1;D32=0;D33=0;D34=0;L3=0},
  @{id='two_zigzag_multiple_packages';first=@{width=5000;height=2600;leaves=5;opening=2;quantity=4;c8=1;glass=9;n40=0;n41=0};second=@{width=4600;height=2500;leaves=4;opening=2;quantity=3;c8=1;glass=9;n40=0;n41=0};F28=1;D32=1;D33=0;D34=0;L3=0},
  @{id='active_glass_guard_error';first=@{width=4200;height=2500;leaves=5;opening=3;quantity=1;c8=2;glass=9;n40=0;n41=0};second=@{width=3600;height=2400;leaves=4;opening=2;quantity=1;c8=2;glass=9;n40=0;n41=0};F28=1;D32=1;D33=0;D34=0;L3=0}
)
$xl=New-Object -ComObject Excel.Application;$xl.Visible=$false;$xl.DisplayAlerts=$false;$xl.EnableEvents=$false;$xl.AutomationSecurity=3
$results=[System.Collections.Generic.List[object]]::new()
function Cell($sheet,[string]$address){$c=$sheet.Range($address);$v=$c.Value2;$bits=$null;if($v -is [double]){$bits=[BitConverter]::ToUInt64([BitConverter]::GetBytes([double]$v),0).ToString('X16')};return @{formula=[string]$c.Formula;value=if($null -eq $v){$null}else{[string]$v};binary64=$bits;numberFormat=[string]$c.NumberFormat;displayedText=[string]$c.Text}}
try { foreach($book in $books){foreach($s in $scenarios){
  $tmp=Join-Path $env:TEMP ('jv-pr10g-order-'+[guid]::NewGuid().ToString('N')+'.xlsm');Copy-Item -LiteralPath $book.path -Destination $tmp;$wb=$xl.Workbooks.Open($tmp)
  try {
    $main=$wb.Worksheets.Item('Главная');$settings=$wb.Worksheets.Item('Настройки')
    foreach($slot in 11..17){$main.Range("Z$slot").Value2=0}
    $settings.Range('H2').Value2=1;$settings.Range('D32').Value2=$s.D32;$settings.Range('D33').Value2=$s.D33;$settings.Range('D34').Value2=$s.D34;$settings.Range('L3').Value2=$s.L3
    $main.Range('F28').Value2=$s.F28
    foreach($i in 0..1){$slot=11+$i;$x=if($i -eq 0){$s.first}else{$s.second};$main.Range("F$slot").Value2=2;$main.Range("C$slot").Value2=$x.width;$main.Range("D$slot").Value2=$x.height;$main.Range("H$slot").Value2=$x.c8;$main.Range("I$slot").Value2=$x.glass;$main.Range("J$slot").Value2=$x.opening;$main.Range("L$slot").Value2=$x.leaves;$main.Range("Z$slot").Value2=$x.quantity}
    $xl.CalculateFullRebuild()
    $slots=@()
    foreach($i in 0..1){$slot=11+$i;$z=$wb.Worksheets.Item("Z$($i+1)");$x=if($i -eq 0){$s.first}else{$s.second};$z.Range('N40').Value2=$x.n40;$z.Range('N41').Value2=$x.n41}
    $xl.CalculateFullRebuild()
    $main.Range('ZZ100').Formula='=S11*Z11+S12*Z12';$xl.CalculateFullRebuild()
    foreach($i in 0..1){$slot=11+$i;$z=$wb.Worksheets.Item("Z$($i+1)");$cells=@{};foreach($addr in @('C8','C9','N40','N41','U10','U11','U12','U13','U14','U15','U17','U18','P38','P39','P40','P41','P42','P43','P44','D28','D29','D30','D31','C29','C30','C31','G23','H23','G26','G27','G28','H26','H27','H28','H29','H33','W5')){$cells[$addr]=Cell $z $addr};for($r=5;$r -le 35;$r++){foreach($col in @('N','O','P')){$a="$col$r";$cells[$a]=Cell $z $a}};$slots+=@{slot=$slot;inputs=if($i -eq 0){$s.first}else{$s.second};cells=$cells;manualInputValidation=@{N40=[string]$z.Range('N40').Value2;N41=[string]$z.Range('N41').Value2;sheetProtected=[bool]$z.ProtectContents}}}
    $mainCells=@{};foreach($slot in 11..17){foreach($col in @('Z','S')){$a="$col$slot";$mainCells[$a]=Cell $main $a}};$mainCells['ZZ100']=Cell $main 'ZZ100';$settingsCells=@{};foreach($a in @('D12','D32','D33','D34','L3','H2','L26')){$settingsCells[$a]=Cell $settings $a}
    $glue=$wb.Worksheets.Item('Клей+акт');$glueCells=@{};foreach($a in @('N5','N6','N7','N8','N9','N10','N11','N12','O5','N18','N19','N20','N21','N22','N23','N24','N25','O18')){$glueCells[$a]=Cell $glue $a}
    $prm=$wb.Worksheets.Item('ПРМ');$prmCells=@{};foreach($r in 25..32){foreach($col in @('AA','AB','W')){$a="$col$r";$prmCells[$a]=Cell $prm $a}}
    $records=@{id=$s.id;profile=$book.profile;workbook=[IO.Path]::GetFileName($book.path);sha256=$book.hash;excelVersion=$xl.Version;recalc='CalculateFullRebuild';inputs=$s;settings=$settingsCells;main=$mainCells;glue=$glueCells;prm=$prmCells;positions=$slots;derivedOrderSum='=S11*Z11+S12*Z12 (temporary verification cell Main!ZZ100; not a source workbook formula)';derivedOrderSumValue=$main.Range('ZZ100').Value2;derivedOrderSumCell=$mainCells['ZZ100']}
    $results.Add($records)
  } finally {$wb.Close($false);Remove-Item -LiteralPath $tmp -Force}
}}
} finally {$xl.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)}
$json=@{schemaVersion=1;method='Excel 16 COM CalculateFullRebuild on temporary copies of both original workbooks; originals are not saved or modified. Main order total is explicitly derived from per-unit Sslot times position quantity because no workbook order-total formula is asserted.';cases=@($results)}|ConvertTo-Json -Depth 14
$out=Join-Path (Get-Location) $Output;[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($out))|Out-Null;[IO.File]::WriteAllText($out,$json,[Text.UTF8Encoding]::new($false));Write-Output "Wrote $($results.Count) cases to $Output"
