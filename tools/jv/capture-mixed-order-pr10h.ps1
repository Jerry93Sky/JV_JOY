param(
  [string]$CompletionWorkbook='C:\Users\jerry\Desktop\JV\JV-комплектация 08.10.2026.xlsm',
  [string]$RetailWorkbook='C:\Users\jerry\Desktop\JV\JV-розница 08.10.2026.xlsm',
  [string]$Output='docs/jv/fixtures/mixed-order-pr10h-excel.json'
)
$ErrorActionPreference='Stop'
$scenarios=@(
  @{id='line_plus_zigzag_one_each';F28=1;flags=@{D32=1;D33=1;D34=1;L3=1};positions=@(@{slot=1;family='LINE';width=3200;height=2300;quantity=1},@{slot=2;family='ZIGZAG';width=3600;height=2400;quantity=1;leaves=4;opening=2})},
  @{id='line_plus_zigzag_multiple_instances';F28=2;flags=@{D32=0;D33=0;D34=0;L3=0};positions=@(@{slot=1;family='LINE';width=3200;height=2300;quantity=2},@{slot=2;family='ZIGZAG';width=3600;height=2400;quantity=3;leaves=4;opening=2})},
  @{id='two_line_slots_plus_zigzag';F28=1;flags=@{D32=0;D33=0;D34=0;L3=0};positions=@(@{slot=1;family='LINE';width=3200;height=2300;quantity=2},@{slot=2;family='LINE';width=1800;height=2100;quantity=1},@{slot=3;family='ZIGZAG';width=3600;height=2400;quantity=1;leaves=4;opening=2})},
  @{id='line_plus_two_zigzag_slots';F28=2;flags=@{D32=0;D33=0;D34=0;L3=0};positions=@(@{slot=1;family='LINE';width=3200;height=2300;quantity=1},@{slot=2;family='ZIGZAG';width=3600;height=2400;quantity=1;leaves=4;opening=2},@{slot=3;family='ZIGZAG';width=4200;height=2500;quantity=2;leaves=5;opening=2})},
  @{id='mixed_multiple_packages';F28=1;flags=@{D32=0;D33=0;D34=0;L3=0};positions=@(@{slot=1;family='LINE';width=5000;height=2600;quantity=4},@{slot=2;family='ZIGZAG';width=5000;height=2600;quantity=4;leaves=5;opening=2})}
)
$books=@(
  @{profile='COMPLETATION';path=$CompletionWorkbook},
  @{profile='RETAIL';path=$RetailWorkbook}
)
$lineBaseline=Get-Content -Raw -LiteralPath 'docs/jv/fixtures/line-full-commercial-excel-golden.json'|ConvertFrom-Json
$lineBaseline=$lineBaseline.cases|Where-Object{$_.scenarioId -eq 'line_single_no_park'}|Select-Object -First 1
$zigzagSnapshots=Get-Content -Raw -LiteralPath 'docs/jv/fixtures/zigzag-price-snapshots.json'|ConvertFrom-Json
$excel=New-Object -ComObject Excel.Application
$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.EnableEvents=$false;$excel.AutomationSecurity=3
$cases=[System.Collections.Generic.List[object]]::new()
function Read-Cell($sheet,[string]$address){$cell=$sheet.Range($address);$value=$cell.Value2;$binary=$null;if($value -is [double]){$binary=[BitConverter]::ToUInt64([BitConverter]::GetBytes([double]$value),0).ToString('X16')};return [ordered]@{formula=[string]$cell.Formula;value=if($null -eq $value){$null}else{[string]$value};binary64=$binary;numberFormat=[string]$cell.NumberFormat;displayedText=[string]$cell.Text}}
try {
  foreach($book in $books){
    $hash=($zigzagSnapshots.sources|Where-Object{$_.profile -eq $book.profile}|Select-Object -First 1).workbookSha256
    foreach($scenario in $scenarios){
      $temp=Join-Path $env:TEMP ('jv-mixed-pr10h-'+[guid]::NewGuid().ToString('N')+'.xlsm')
      Copy-Item -LiteralPath $book.path -Destination $temp
      $workbook=$excel.Workbooks.Open($temp,0,$false)
      try {
        $main=$workbook.Worksheets.Item('Главная');$settings=$workbook.Worksheets.Item('Настройки')
        foreach($slot in 1..7){$row=10+$slot;$main.Range("Z$row").Value2=0}
        $main.Range('F28').Value2=$scenario.F28
        $settings.Range('H2').Value2=1;$settings.Range('D32').Value2=$scenario.flags.D32;$settings.Range('D33').Value2=$scenario.flags.D33;$settings.Range('D34').Value2=$scenario.flags.D34;$settings.Range('L3').Value2=$scenario.flags.L3
        foreach($position in $scenario.positions){
          $row=10+$position.slot;$selector=if($position.family -eq 'LINE'){1}else{2}
          $main.Range("F$row").Value2=$selector;$main.Range("C$row").Value2=$position.width;$main.Range("D$row").Value2=$position.height;$main.Range("Z$row").Value2=$position.quantity
          if($position.family -eq 'LINE'){$main.Range("H$row").Value2=1;$main.Range("I$row").Value2=1;$main.Range("J$row").Value2=[double]$lineBaseline.scenarioInputs.main.openingSelector;$main.Range("K$row").Value2=[double]$lineBaseline.input.sideCount;$main.Range("L$row").Value2=[double]$lineBaseline.input.leaves;$lineSheet=$workbook.Worksheets.Item("L$($position.slot)");$lineSheet.Range('C23').Value2=[int][bool]$lineBaseline.input.parkedDoorSelected;$lineSheet.Range('C24').Value2=[double]$lineBaseline.input.parkedDoorPosition;$lineSheet.Range('C21').Value2=[int][bool]$lineBaseline.input.specialSashEnabled;$lineSheet.Range('D21').Value2=[double]$lineBaseline.input.specialSashWidthMm;$lineSheet.Range('D22').Value2=[double]$lineBaseline.input.rollerAxisToEdgeMm}
          else{$main.Range("H$row").Value2=1;$main.Range("I$row").Value2=9;$main.Range("J$row").Value2=$position.opening;$main.Range("K$row").Value2=1;$main.Range("L$row").Value2=$position.leaves}
        }
        foreach($key in @('P2','P4','P5','P6','P7','P8','P9','P10','P14','P15')){$settings.Range($key).Value2=[double]$lineBaseline.settings.$key};$settings.Range('D7').Value2=[double]$lineBaseline.scenarioInputs.settings.carrierProfileAllowance
        $excel.CalculateFullRebuild()
        $terms=@($scenario.positions|ForEach-Object{$row=10+$_.slot;"Y$row*Z$row"})
        $main.Range('ZZ100').Formula='='+($terms -join '+')
        $excel.CalculateFullRebuild()
        $positionResults=[System.Collections.Generic.List[object]]::new()
        foreach($position in $scenario.positions){
          $slot=$position.slot;$mainRow=10+$slot;$family=$position.family;$sheet=$workbook.Worksheets.Item("$(if($family -eq 'LINE'){'L'}else{'Z'})$slot")
          $addresses=if($family -eq 'LINE'){@('O49','O50','Q49','Q50','Q52','Q53','Q54','Q55','Q56','Q57','Q58')}else{@('C8','N34','N35','W5','P38','P39','P40','P41','P42','P43','P44')+@((5..35|ForEach-Object{"N$_"})+(5..35|ForEach-Object{"O$_"})+(5..35|ForEach-Object{"P$_"}))}
          $cells=[ordered]@{};foreach($address in $addresses){$cells[$address]=Read-Cell $sheet $address}
          $positionResults.Add([ordered]@{id="slot-$slot";slot=$slot;family=$family;widthMm=$position.width;heightMm=$position.height;quantity=$position.quantity;main=[ordered]@{F=(Read-Cell $main "F$mainRow");G=(Read-Cell $main "G$mainRow");C=(Read-Cell $main "C$mainRow");D=(Read-Cell $main "D$mainRow");H=(Read-Cell $main "H$mainRow");I=(Read-Cell $main "I$mainRow");J=(Read-Cell $main "J$mainRow");K=(Read-Cell $main "K$mainRow");L=(Read-Cell $main "L$mainRow");Z=(Read-Cell $main "Z$mainRow");R=(Read-Cell $main "R$mainRow");S=(Read-Cell $main "S$mainRow");Y=(Read-Cell $main "Y$mainRow")};cells=$cells})
        }
        $glue=$workbook.Worksheets.Item('Клей+акт');$glueCells=[ordered]@{}
        foreach($row in 5..11 + 18..24){foreach($column in @('C','L','M','N')){$address="$column$row";$glueCells[$address]=Read-Cell $glue $address}}
        foreach($address in @('N12','O5','N25','O18')){$glueCells[$address]=Read-Cell $glue $address}
        $prm=$workbook.Worksheets.Item('ПРМ');$prmCells=[ordered]@{}
        foreach($row in 25..31){foreach($column in @('U','V','W','AA','AB')){$address="$column$row";$prmCells[$address]=Read-Cell $prm $address}}
        $settingsCells=[ordered]@{};foreach($address in @('D11','D12','D13','D14','D21','D22','D23','D24','D25','D26','D27','D32','D33','D34','L3','H2')){$settingsCells[$address]=Read-Cell $settings $address}
        $cases.Add([ordered]@{scenarioId=$scenario.id;profile=$book.profile;sourceWorkbook=[IO.Path]::GetFileName($book.path);sourceSha256=$hash;excelVersion=$excel.Version;calculationMode='CalculateFullRebuild';sourceIsTemporaryCopy=$true;inputs=$scenario.positions;orderSettings=[ordered]@{F28=Read-Cell $main 'F28'};settings=$settingsCells;glue=$glueCells;prm=$prmCells;positions=$positionResults;orderTotal=Read-Cell $main 'ZZ100';orderTotalIsScratch=$true})
      } finally {$workbook.Close($false);Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
    }
  }
} finally {$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)}
$result=[ordered]@{schemaVersion=1;captureMethod='Excel 16 COM CalculateFullRebuild on temporary copies of both originals';comparison='Engine comparison pending';cases=$cases}
$full=Join-Path (Get-Location) $Output;[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($full))|Out-Null
[IO.File]::WriteAllText($full,($result|ConvertTo-Json -Depth 16),[Text.UTF8Encoding]::new($false))
Write-Output "Wrote $full ($($cases.Count) cases)"
