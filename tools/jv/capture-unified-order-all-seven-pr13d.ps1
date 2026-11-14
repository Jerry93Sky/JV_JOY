param(
  [string]$CompletionWorkbook = 'C:\Users\jerry\Desktop\JV\JV-комплектация 08.10.2026.xlsm',
  [string]$RetailWorkbook = 'C:\Users\jerry\Desktop\JV\JV-розница 08.10.2026.xlsm',
  [string]$Output = 'docs/jv/fixtures/unified-order-all-seven-pr13d-excel.json'
)
$ErrorActionPreference='Stop'
$excel=New-Object -ComObject Excel.Application
$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.AutomationSecurity=3;$excel.EnableEvents=$false
$books=@(@{profile='COMPLETATION';path=$CompletionWorkbook},@{profile='RETAIL';path=$RetailWorkbook})
$frontFixtures=Get-Content -Raw 'docs/jv/fixtures/front-pr12a-excel.json'|ConvertFrom-Json
$scenarioSpecs=@(
  @{id='all-seven-base';w=3200;h=2300;q=@(1,1,1,1,1,1,1)},
  @{id='all-seven-multi-quantity';w=3200;h=2300;q=@(1,2,3,1,2,3,2)},
  @{id='all-seven-3600x2400';w=3600;h=2400;q=@(1,1,1,1,1,1,1)},
  @{id='all-seven-4000x2500';w=4000;h=2500;q=@(1,1,1,1,1,1,1)},
  @{id='all-seven-3000x2200';w=3000;h=2200;q=@(1,2,1,2,1,2,1)},
  @{id='all-seven-varying-size';w=0;h=0;q=@(1,2,1,3,1,2,1)}
)
$results=[System.Collections.Generic.List[object]]::new()
try {
 foreach($book in $books){
  $frontRecord=$frontFixtures.scenarios|Where-Object{$_.scenarioId -eq ($book.profile+'-base')}|Select-Object -First 1
  foreach($spec in $scenarioSpecs){
   $temp=Join-Path ([IO.Path]::GetTempPath()) ('jv-unified-pr13d-'+[Guid]::NewGuid().ToString('N')+'.xlsm')
   Copy-Item -LiteralPath $book.path -Destination $temp -Force
   $wb=$excel.Workbooks.Open($temp,0,$false)
   try {
    $main=$wb.Worksheets.Item('Главная')
    for($slot=1;$slot -le 7;$slot++){
     $row=10+$slot
     if($spec.id -eq 'all-seven-varying-size'){
      if($slot -eq 1){$w=4000;$h=2500}elseif($slot -eq 2){$w=3600;$h=2400}elseif($slot -eq 7){$w=3000;$h=2200}else{$w=3000;$h=2200}
     } else {$w=$spec.w;$h=$spec.h;if($slot -eq 7){$w=3000;$h=2200}}
     $main.Range("C$row").Value2=$w;$main.Range("D$row").Value2=$h;$main.Range("Z$row").Value2=$spec.q[$slot-1]
     $main.Range("F$row").Value2=$slot;$main.Range("H$row").Value2=1;$main.Range("I$row").Value2=9;$main.Range("J$row").Value2=1;$main.Range("L$row").Value2=5
    }
    $main.Range('F17').Value2=7;$main.Range('H17').Value2=1;$main.Range('I17').Value2=9;$main.Range('J17').Value2=4;$main.Range('L17').Value2=3
    if($spec.id -eq 'all-seven-varying-size'){$main.Range('C17').Value2=3000;$main.Range('D17').Value2=2200}
    $frontSheet=$wb.Worksheets.Item('F7')
    foreach($cellName in @('C11','C12','C13','C14','C15','C18','C19','C20','C21','C22','C23','C24','D18','D19')){$frontSheet.Range($cellName).Value2=[double]$frontRecord.front.$cellName.value}
    $excel.CalculateFullRebuild()
    $rows=[System.Collections.Generic.List[object]]::new();$valid=$true
    for($slot=1;$slot -le 7;$slot++){
     $row=10+$slot;$cells=[ordered]@{}
     foreach($col in @('C','D','F','G','H','I','J','K','L','M','Z','R','S','T','U','V','W','X','Y','AA')){$address="$col$row";$cell=$main.Range($address);$cells[$address]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat};if($col -eq 'AA' -and $cell.Text -match '^#'){$valid=$false}}
     $rows.Add([ordered]@{slot=$slot;quantity=$spec.q[$slot-1];cells=$cells})
    }
    $order=$main.Range('AA18');if($order.Text -match '^#'){$valid=$false}
    $glue=$wb.Worksheets.Item('Клей+акт');$glueCells=[ordered]@{}
    foreach($address in @('N12','O5','N25','O18')){$cell=$glue.Range($address);$glueCells[$address]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}}
    $prm=$wb.Worksheets.Item('ПРМ');$area=[ordered]@{}
    foreach($slot in 1..7){$row=24+$slot;$cell=$prm.Range("AB$row");$area["AB$row"]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}}
    $f7=$wb.Worksheets.Item('F7');$frontInputCells=[ordered]@{};foreach($address in @('C11','C12','C13','C14','C15','C18','C19','C20','C21','C22','C23','C24','D18','D19')){$cell=$f7.Range($address);$frontInputCells[$address]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}};$frontCells=[ordered]@{}
    foreach($address in @('Y5','S38')){$cell=$f7.Range($address);$frontCells[$address]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}}
    $results.Add([ordered]@{scenarioId=$spec.id;profile=$book.profile;workbook=[IO.Path]::GetFileName($book.path);sourceSha256=(Get-FileHash -LiteralPath $book.path -Algorithm SHA256).Hash.ToLowerInvariant();excelVersion=$excel.Version;calculationMode='CalculateFullRebuild';valid=($valid -and $rows.Count -eq 7);inputs=[ordered]@{MainSlots=$rows|ForEach-Object{$r=10+[int]$_.slot;[ordered]@{slot=$_.slot;quantity=$_.quantity;selector=$_.cells["F$r"].value2;width=$_.cells["C$r"].value2;height=$_.cells["D$r"].value2;priceMode=$_.cells["H$r"].value2;glassSelector=$_.cells["I$r"].value2;openingSelector=$_.cells["J$r"].value2;controlK=$_.cells["K$r"].value2;controlL=$_.cells["L$r"].value2;leafOrOptionM=$_.cells["M$r"].value2}};frontInputCells=$frontInputCells};MainRows=$rows;sharedConsumables=$glueCells;frontAreaRows=$area;front=$frontCells;AA18=[ordered]@{formula=$order.Formula;value2=$order.Value2;text=$order.Text;numberFormat=$order.NumberFormat}})
   } finally {$wb.Close($false);Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
  }
 }
} finally {$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)}
$full=Join-Path (Get-Location) $Output
New-Item -ItemType Directory -Path (Split-Path $full) -Force|Out-Null
[IO.File]::WriteAllText($full,($results|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
Write-Output "Wrote $full ($($results.Count) profile/scenario captures; valid=$(@($results|Where-Object valid).Count))"
