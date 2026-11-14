param(
  [string]$CompletionWorkbook = 'C:\Users\jerry\Desktop\JV\JV-комплектация 08.10.2026.xlsm',
  [string]$RetailWorkbook = 'C:\Users\jerry\Desktop\JV\JV-розница 08.10.2026.xlsm',
  [string]$Output = 'docs/jv/fixtures/unified-order-excel-probe.json'
)
$ErrorActionPreference='Stop'
$excel=New-Object -ComObject Excel.Application
$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.AutomationSecurity=3;$excel.EnableEvents=$false
$books=@(@{profile='COMPLETATION';path=$CompletionWorkbook},@{profile='RETAIL';path=$RetailWorkbook})
$results=[System.Collections.Generic.List[object]]::new()
$frontFixtures=Get-Content -Raw 'docs/jv/fixtures/front-pr12a-excel.json'|ConvertFrom-Json
try {
 foreach($book in $books){
  $temp=Join-Path ([IO.Path]::GetTempPath()) ('jv-unified-probe-'+[Guid]::NewGuid().ToString('N')+'.xlsm')
  Copy-Item -LiteralPath $book.path -Destination $temp -Force
  $wb=$excel.Workbooks.Open($temp,0,$false)
  try {
   $main=$wb.Worksheets.Item('Главная')
   for($slot=1;$slot -le 7;$slot++){
    $row=10+$slot;$main.Range("C$row").Value2=3200;$main.Range("D$row").Value2=2300;$main.Range("Z$row").Value2=1
    $main.Range("F$row").Value2=$slot;$main.Range("H$row").Value2=1;$main.Range("I$row").Value2=9;$main.Range("J$row").Value2=1;$main.Range("L$row").Value2=5
   }
   $main.Range('C17').Value2=3000;$main.Range('D17').Value2=2200;$main.Range('F17').Value2=7;$main.Range('H17').Value2=1;$main.Range('I17').Value2=9;$main.Range('J17').Value2=4;$main.Range('L17').Value2=3
   $frontRecord=$frontFixtures.scenarios|Where-Object{$_.scenarioId -eq ($book.profile+'-base')}|Select-Object -First 1
   $frontSheet=$wb.Worksheets.Item('F7')
   foreach($cellName in @('C11','C12','C13','C14','C15','C18','C19','C20','C21','C22','C23','C24','D18','D19')){$frontSheet.Range($cellName).Value2=[double]$frontRecord.front.$cellName.value}
   $excel.CalculateFullRebuild()
   $front=$frontSheet;$glue=$wb.Worksheets.Item('Клей+акт');$prm=$wb.Worksheets.Item('ПРМ')
   $rows=[System.Collections.Generic.List[object]]::new()
   for($slot=1;$slot -le 7;$slot++){$r=10+$slot;$cells=[ordered]@{};foreach($col in @('F','G','R','S','T','U','V','W','X','Y','Z','AA')){$c="$col$r";$cell=$main.Range($c);$cells[$c]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}};$pr=$prm.Range("AB$((24+$slot))");$rows.Add([ordered]@{slot=$slot;familySelector=$main.Range("F$r").Value2;main=$cells;prmAB=[ordered]@{formula=$pr.Formula;value2=$pr.Value2;text=$pr.Text;numberFormat=$pr.NumberFormat}})}
   $glueCells=[ordered]@{};foreach($c in @('N12','O5','N25','O18')){$cell=$glue.Range($c);$glueCells[$c]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}}
   $settings=$wb.Worksheets.Item('Настройки');$commercialSettings=[ordered]@{};foreach($c in @('D11','D12','D13','D14','D19','D21','D22','D23','D24','D25','D26','D27')){$cell=$settings.Range($c);$commercialSettings[$c]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}}
   $frontCells=[ordered]@{};foreach($c in @('C8','C17','D11','D15','D17','E18','D20','I17','I18','I19','I20','I21','I22','I23','S36','S37','S38')){$cell=$front.Range($c);$frontCells[$c]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}}
   $order=$main.Range('AA18');$results.Add([ordered]@{profile=$book.profile;workbook=[IO.Path]::GetFileName($book.path);sha256=(Get-FileHash -LiteralPath $book.path -Algorithm SHA256).Hash.ToLowerInvariant();excelVersion=$excel.Version;method='CalculateFullRebuild';scenario='All seven selectors active; Front input controls set from the completed PR_12A Excel fixture; other rows use 3200x2300, H=1,I=9,J=1,L=5,Z=1';positions=$rows;commercialSettings=$commercialSettings;sharedGlue=$glueCells;front=$frontCells;orderTotal=[ordered]@{formula=$order.Formula;value2=$order.Value2;text=$order.Text;numberFormat=$order.NumberFormat}})
  }finally{$wb.Close($false);Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
 }
}finally{$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)}
$full=Join-Path (Get-Location) $Output
New-Item -ItemType Directory -Path (Split-Path $full) -Force|Out-Null
[IO.File]::WriteAllText($full,($results|ConvertTo-Json -Depth 16),[Text.UTF8Encoding]::new($false))
Write-Output "Wrote $full ($($results.Count) profiles)"
