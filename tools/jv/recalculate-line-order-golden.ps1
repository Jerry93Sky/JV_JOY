param(
  [string]$CompletionWorkbook = 'C:\Users\jerry\Desktop\JV\JV-комплектация 08.10.2026.xlsm',
  [string]$RetailWorkbook = 'C:\Users\jerry\Desktop\JV\JV-розница 08.10.2026.xlsm',
  [string]$Output = 'docs/jv/fixtures/line-order-excel-golden.json'
)
$ErrorActionPreference = 'Stop'
$scenarios = @(
  @{ id='line_single_qty1'; positions=@(@{slot=1;family='LINE';width=3200;height=2300;quantity=1}) },
  @{ id='line_single_qty3'; positions=@(@{slot=1;family='LINE';width=3200;height=2300;quantity=3}) },
  @{ id='line_two_slots_mixed_area'; positions=@(@{slot=1;family='LINE';width=3200;height=2300;quantity=2},@{slot=2;family='LINE';width=1800;height=2100;quantity=3}) }
  @{ id='line_two_slots_equal_area'; positions=@(@{slot=1;family='LINE';width=2400;height=2000;quantity=1},@{slot=2;family='LINE';width=2000;height=2400;quantity=1}) }
  @{ id='line_three_slots_mixed_quantity'; positions=@(@{slot=1;family='LINE';width=3200;height=2300;quantity=2},@{slot=2;family='LINE';width=1800;height=2100;quantity=1},@{slot=3;family='LINE';width=2500;height=2200;quantity=3}) }
  @{ id='line_two_slots_large_and_small'; positions=@(@{slot=1;family='LINE';width=4000;height=2500;quantity=1},@{slot=2;family='LINE';width=3000;height=2000;quantity=2}) }
)
$books = @(@{profile='COMPLETATION';path=$CompletionWorkbook},@{profile='RETAIL';path=$RetailWorkbook})
$cases = [System.Collections.Generic.List[object]]::new()
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.AutomationSecurity = 3; $excel.EnableEvents = $false
try {
  foreach($book in $books) {
    $hash=(Get-FileHash -Algorithm SHA256 -LiteralPath $book.path).Hash.ToLowerInvariant()
    foreach($scenario in $scenarios) {
      $temp=Join-Path ([IO.Path]::GetTempPath()) ("jv-order-"+[Guid]::NewGuid().ToString('N')+'.xlsm')
      Copy-Item -LiteralPath $book.path -Destination $temp
      $workbook=$excel.Workbooks.Open($temp,0,$false)
      try {
        $main=$workbook.Worksheets.Item('Главная')
        for($slot=1;$slot -le 7;$slot++) { $row=10+$slot; $main.Range("Z$row").Value2=0 }
        foreach($position in $scenario.positions) {
          $row=10+$position.slot
          $main.Range("F$row").Value2=1
          $main.Range("H$row").Value2=1
          $main.Range("I$row").Value2=9
          $main.Range("J$row").Value2=1
          $main.Range("L$row").Value2=5
          $main.Range("C$row").Value2=$position.width
          $main.Range("D$row").Value2=$position.height
          $main.Range("Z$row").Value2=$position.quantity
        }
        $excel.CalculateFullRebuild()
        $positionResults=[System.Collections.Generic.List[object]]::new()
        $orderTotals=[ordered]@{Q52=0.0;Q53=0.0;Q54=0.0;Q55=0.0;Q56=0.0;Q57=0.0;Q58=0.0}
        foreach($position in $scenario.positions) {
          $row=10+$position.slot; $sheet=$workbook.Worksheets.Item("L$($position.slot)")
        $values=[ordered]@{X5=$sheet.Range('X5').Value2;X5NumberFormat=$sheet.Range('X5').NumberFormat;X5Text=$sheet.Range('X5').Text}
          foreach($cell in @('Q52','Q53','Q54','Q55','Q56','Q57','Q58')) {
            $value=[double]$sheet.Range($cell).Value2; $values[$cell]=$value
            $orderTotals[$cell]+=$value*[double]$position.quantity
          }
          $positionResults.Add([ordered]@{slot=$position.slot;mainRow=$row;widthMm=$position.width;heightMm=$position.height;quantity=$position.quantity;family='LINE';cells=$values})
        }
        $prm=$workbook.Worksheets.Item('ПРМ'); $glue=$workbook.Worksheets.Item('Клей+акт')
        $mainRows=[System.Collections.Generic.List[object]]::new()
        foreach($position in $scenario.positions){$r=10+$position.slot;$rowData=[ordered]@{};foreach($cellName in @("C$r","D$r","F$r","G$r","H$r","I$r","J$r","K$r","L$r","M$r","R$r","S$r","T$r","U$r","V$r","W$r","X$r","Y$r","Z$r","AA$r")){$cell=$main.Range($cellName);$rowData[$cellName]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}};$mainRows.Add([ordered]@{slot=$position.slot;cells=$rowData})}
        $commercialSettings=[ordered]@{}
        $settingsSheet=$workbook.Worksheets.Item('Настройки')
        foreach($cellName in @('D11','D12','D13','D14','D19','D21','D22','D23','D24','D25','D26','D27')){$cell=$settingsSheet.Range($cellName);$commercialSettings[$cellName]=[ordered]@{formula=$cell.Formula;value2=$cell.Value2;text=$cell.Text;numberFormat=$cell.NumberFormat}}
        $orderTotalCell=$main.Range('AA18')
        $xRows=[System.Collections.Generic.List[object]]::new()
        foreach($position in $scenario.positions) { $r=24+$position.slot; $xRows.Add([ordered]@{row=$r;AA=$prm.Range("AA$r").Value2;W=$prm.Range("W$r").Value2;AB=$prm.Range("AB$r").Value2;AAFormula=$prm.Range("AA$r").Formula;ABFormula=$prm.Range("AB$r").Formula}) }
        $cases.Add([ordered]@{scenarioId=$scenario.id;profile=$book.profile;sourceWorkbook=[IO.Path]::GetFileName($book.path);sourceSha256=$hash;excelVersion=$excel.Version;calculationMode='CalculateFullRebuild';selectors=[ordered]@{finishIndex=$main.Range('H11').Value2;glassIndex=$main.Range('I11').Value2;commercialModeIndex=$main.Range('F28').Value2;assembly=$settingsSheet.Range('D33').Value2;milling=$settingsSheet.Range('L3').Value2;installation=$settingsSheet.Range('D34').Value2};inputs=$scenario.positions;mainRows=$mainRows;commercialSettings=$commercialSettings;mainOrderTotal=[ordered]@{cell='Главная!AA18';formula=$orderTotalCell.Formula;value2=$orderTotalCell.Value2;text=$orderTotalCell.Text;numberFormat=$orderTotalCell.NumberFormat};positions=$positionResults;allocation=$xRows;orderTotals=$orderTotals;glue=[ordered]@{N12=$glue.Range('N12').Value2;O5=$glue.Range('O5').Value2;O5NumberFormat=$glue.Range('O5').NumberFormat;O5Text=$glue.Range('O5').Text;N25=$glue.Range('N25').Value2;O18=$glue.Range('O18').Value2;O18NumberFormat=$glue.Range('O18').NumberFormat;O18Text=$glue.Range('O18').Text;N12Formula=$glue.Range('N12').Formula;N25Formula=$glue.Range('N25').Formula;O5Formula=$glue.Range('O5').Formula;O18Formula=$glue.Range('O18').Formula}})
      } finally { $workbook.Close($false); Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }
    }
  }
} finally { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
$result=[ordered]@{schemaVersion=1;capture='EXCEL_COM_VALUE2';comparisonClassification='UNVERIFIED until engine comparisons are generated';sourceCopiesOnly=$true;cases=$cases}
$json=$result|ConvertTo-Json -Depth 12
$full=Join-Path (Get-Location) $Output
New-Item -ItemType Directory -Path (Split-Path $full) -Force|Out-Null
[IO.File]::WriteAllText($full,$json,[Text.UTF8Encoding]::new($false))
Write-Output "Wrote $full ($($cases.Count) cases)"
