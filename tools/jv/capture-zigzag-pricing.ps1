param([string]$Output='docs/jv/fixtures/zigzag-pricing-excel.json')
$ErrorActionPreference='Stop'
$resolved=(& node tools/jv/resolve-excel-sources.mjs | ConvertFrom-Json)
$books=@(
  @{profile='COMPLETATION';path=$resolved.completion.path;hash=$resolved.completion.sha256},
  @{profile='RETAIL';path=$resolved.retail.path;hash=$resolved.retail.sha256}
)
$scenarios=@(
  @{id='single_3600x2400_4leaf';width=3600;height=2400;leaves=4;opening=2;frame=1;paint=$true;assembly=$true;install=$true;F28=2;secondQuantity=0},
  @{id='single_4200x2500_5leaf_off';width=4200;height=2500;leaves=5;opening=3;frame=1;paint=$false;assembly=$false;install=$false;F28=1;secondQuantity=0},
  @{id='two_positions_4200x2500_5leaf';width=4200;height=2500;leaves=5;opening=3;frame=1;paint=$false;assembly=$false;install=$false;F28=1;secondQuantity=2}
)
$xl=New-Object -ComObject Excel.Application
$xl.Visible=$false;$xl.DisplayAlerts=$false;$xl.AutomationSecurity=3;$xl.EnableEvents=$false
$results=[System.Collections.Generic.List[object]]::new()
function CellRecord($sheet,$address) {
  $cell=$sheet.Range($address)
  $value=$cell.Value2
  $binary64=$null
  if($value -is [double] -or $value -is [single]){$binary64=[BitConverter]::ToUInt64([BitConverter]::GetBytes([double]$value),0).ToString('X16')}
  return @{formula=[string]$cell.Formula;value=if($null -eq $value){$null}else{[string]$value};binary64=$binary64;numberFormat=[string]$cell.NumberFormat;displayedText=[string]$cell.Text}
}
try {
 foreach($book in $books){foreach($scenario in $scenarios){
  $tmp=Join-Path $env:TEMP ('jv-zigzag-pricing-'+[guid]::NewGuid().ToString('N')+'.xlsm')
  Copy-Item -LiteralPath $book.path -Destination $tmp
  $wb=$xl.Workbooks.Open($tmp)
  try {
   $main=$wb.Worksheets.Item('Главная');$settings=$wb.Worksheets.Item('Настройки')
   $settings.Range('H2').Value2=$scenario.frame
   $settings.Range('H8').Value2=2
   $settings.Range('D32').Value2=[int][bool]$scenario.paint
   $settings.Range('D33').Value2=[int][bool]$scenario.assembly
   $settings.Range('D34').Value2=[int][bool]$scenario.install
   $settings.Range('L3').Value2=[int][bool]$scenario.assembly
   $main.Range('F11').Value2=2;$main.Range('C11').Value2=$scenario.width;$main.Range('D11').Value2=$scenario.height
   $main.Range('L11').Value2=$scenario.leaves;$main.Range('J11').Value2=$scenario.opening
   $main.Range('F28').Value2=$scenario.F28
   foreach($row in 12..17){$main.Range("Z$row").Value2=0}
   if($scenario.secondQuantity -gt 0){$main.Range('F12').Value2=2;$main.Range('C12').Value2=3600;$main.Range('D12').Value2=2400;$main.Range('I12').Value2=9;$main.Range('L12').Value2=4;$main.Range('J12').Value2=2;$main.Range('Z12').Value2=$scenario.secondQuantity}
   $xl.CalculateFullRebuild()
   $z=$wb.Worksheets.Item('Z1');$z2=$wb.Worksheets.Item('Z2');$price=$wb.Worksheets.Item('Прайс-Line');$work=$wb.Worksheets.Item('Прайс-сб+монт');$glue=$wb.Worksheets.Item('Клей+акт')
   $cells=@{}
   foreach($row in 5..35){foreach($col in @('N','O','P')){$addr="$col$row";$cells[$addr]=CellRecord $z $addr}}
   foreach($addr in @('P38','P39','P40','P41','P42','P43','P44','C8','N40','N41','U5','U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U17','U18','H29','H33','W5','D3','D4','D5','C9','C29','C30','C31','D28','D29','D30','D31','G26','G27','G28','H26','H27','H28')){$cells[$addr]=CellRecord $z $addr}
   $slot2Cells=@{}
   foreach($row in 5..35){foreach($col in @('N','O','P')){$addr="$col$row";$slot2Cells[$addr]=CellRecord $z2 $addr}}
   foreach($addr in @('P38','P39','P40','P41','P42','P43','P44','W5')){$slot2Cells[$addr]=CellRecord $z2 $addr}
   $catalog=@{}
   foreach($row in 5..51){foreach($col in @('B','C','D','E')){$addr="$col$row";$catalog[$addr]=CellRecord $price $addr}}
   foreach($row in @(5,6,7,8,9,10,39,40)){$addr="G$row";$catalog[$addr]=CellRecord $price $addr}
   $source=@{settings=@{};assemblyInstall=@{};glue=@{};glass=@{};main=@{}}
   foreach($addr in @('D3','D32','D33','D34','L3','L7','L8','D12','P19','L17','L21','L9','L10','L11')){$source.settings[$addr]=CellRecord $settings $addr}
   foreach($addr in @('C6','C8','C9','C13','C19','C23','C24','C25')){$source.assemblyInstall[$addr]=CellRecord $work $addr}
   foreach($row in 5..25){foreach($col in @('L','M','N')){$addr="$col$row";$source.glue[$addr]=CellRecord $glue $addr}}
   foreach($row in 5..11){foreach($col in @('C','E','F','G','H','I','J','K')){$addr="$col$row";$source.glue[$addr]=CellRecord $glue $addr}}
   foreach($row in 18..24){foreach($col in @('C','E','F','G','H','I','J','K')){$addr="$col$row";$source.glue[$addr]=CellRecord $glue $addr}}
   foreach($addr in @('N12','N25','O5','O18')){$source.glue[$addr]=CellRecord $glue $addr}
   $glassSheet=$wb.Worksheets.Item('Прайс-Стекло')
   foreach($row in 5..16){$addr="D$row";$source.glass[$addr]=CellRecord $glassSheet $addr}
   foreach($addr in @('F28','S11','I11','I12','H11')){$source.main[$addr]=CellRecord $main $addr}
   foreach($row in 11..17){$addr="Z$row";$source.main[$addr]=CellRecord $main $addr}
   $results.Add(@{id=$scenario.id;profile=$book.profile;workbook=[IO.Path]::GetFileName($book.path);sha256=$book.hash;excelVersion=$xl.Version;inputs=$scenario;cells=$cells;slot2Cells=$slot2Cells;catalog=$catalog;sources=$source})
  } finally {$wb.Close($false);Remove-Item -LiteralPath $tmp -Force}
 }}
} finally {$xl.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)}
$json=@{schemaVersion=1;method='Excel 16 COM CalculateFullRebuild on temporary source workbook copies; formulas, Value2, display and NumberFormat captured after rebuild. Originals unchanged.';cases=@($results)}|ConvertTo-Json -Depth 12
$out=Join-Path (Get-Location) $Output
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($out))|Out-Null
[IO.File]::WriteAllText($out,$json,[Text.UTF8Encoding]::new($false))
Write-Output "Wrote $($results.Count) Zigzag pricing cases to $Output"
