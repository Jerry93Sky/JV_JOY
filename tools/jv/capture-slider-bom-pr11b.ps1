$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$books=@(@{profile='COMPLETATION';name='JV-комплектация 08.10.2026.xlsm'},@{profile='RETAIL';name='JV-розница 08.10.2026.xlsm'})
$cases=@(@{id='two_leaves_left';width=3000;height=2200;leaves=2;opening=1;interlock=$true;jointIndex=2},@{id='four_leaves_two_sided';width=3600;height=2400;leaves=4;opening=3;interlock=$true;jointIndex=2},@{id='four_leaves_right_interlock_off';width=3600;height=2400;leaves=4;opening=2;interlock=$false;jointIndex=1},@{id='two_leaves_left_no_joint';width=3000;height=2200;leaves=2;opening=1;interlock=$true;jointIndex=3})
$excel=New-Object -ComObject Excel.Application;$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.EnableEvents=$false;$excel.AskToUpdateLinks=$false;$excel.AutomationSecurity=3
$records=[System.Collections.Generic.List[object]]::new()
try {
 foreach($bookInfo in $books){
  $source=Join-Path $root $bookInfo.name;$stream=[IO.File]::Open($source,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
  try{$sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}finally{$stream.Dispose()}
  $temp=Join-Path ([IO.Path]::GetTempPath()) ('jv-slider-bom-pr11b-'+[guid]::NewGuid().ToString('N')+'.xlsm');Copy-Item -LiteralPath $source -Destination $temp;$wb=$excel.Workbooks.Open($temp,0,$false)
  try {
   $main=$wb.Worksheets.Item('Главная');$settings=$wb.Worksheets.Item('Настройки');$sheet=$wb.Worksheets.Item('S1');$priceSheet=$wb.Worksheets.Item('Прайс-сб+монт')
   foreach($case in $cases){
    $main.Range('F11').Value2=3;$main.Range('C11').Value2=$case.width;$main.Range('D11').Value2=$case.height;$main.Range('M11').Value2=$case.leaves;$main.Range('J11').Value2=$case.opening;$settings.Range('H21').Value2=if($case.interlock){1}else{0};$settings.Range('I27').Value2=4;$sheet.Range('C22').Value2=$case.jointIndex;$wb.Application.CalculateFullRebuild()
    $rows=[System.Collections.Generic.List[object]]::new();for($row=5;$row -le 46;$row++){$items=[ordered]@{};foreach($col in @('A','B','C','D','E','F','G','H','I','J','K')){$cell=$sheet.Range("$col$row");$items[$col]=[ordered]@{value=$cell.Value2;formula=$cell.Formula}};$rows.Add([ordered]@{row=$row;item=$items;selector=$sheet.Range("I$row").Value2;selectorFormula=$sheet.Range("J$row").Formula;selectorValue=$sheet.Range("J$row").Value2;quantityFormula=$sheet.Range("K$row").Formula;quantity=$sheet.Range("K$row").Value2;quantityFormat=$sheet.Range("K$row").NumberFormat})}
    $geometry=[ordered]@{};foreach($address in @('C8','C9','C10','C13','C14','D3','D4','D5','D6','D7','D17','D18','D20','D22','D24','D26','D28','D31','D32','D33','D34','D36','D37','D43','D44','D45','M47','M48','M49','M50','M51','M52','M53','T5')){$geometry[$address]=[ordered]@{formula=$sheet.Range($address).Formula;value=$sheet.Range($address).Value2;format=$sheet.Range($address).NumberFormat}}
    $priceCells=[ordered]@{};foreach($address in @('L51','M51','N51','L52','M52','N52','L53','M53','N53')){$priceCells[$address]=[ordered]@{formula=$sheet.Range($address).Formula;value=$sheet.Range($address).Value2;format=$sheet.Range($address).NumberFormat}}
    $priceLines=[ordered]@{};for($row=5;$row -le 46;$row++){foreach($column in @('L','M','S','T')){$address="$column$row";$priceLines[$address]=[ordered]@{formula=$sheet.Range($address).Formula;value=$sheet.Range($address).Value2;format=$sheet.Range($address).NumberFormat}}}
    $priceSheetCells=[ordered]@{};foreach($address in @('C14','C15','C25')){$priceSheetCells[$address]=[ordered]@{formula=$priceSheet.Range($address).Formula;value=$priceSheet.Range($address).Value2;format=$priceSheet.Range($address).NumberFormat}}
    $settingCells=[ordered]@{};foreach($address in @('D6','D8','D34','H19','H21','H23','H25','H27','S2','S3','S4','S6','S7','S9','S10','S11','S12','S13','S14','S21','S22','S23','S24','L4','L5','L6','L23')){$settingCells[$address]=$settings.Range($address).Value2}
    $records.Add([ordered]@{profile=$bookInfo.profile;scenarioId=$case.id;workbook=$bookInfo.name;sha256=$hash;excelVersion=$excel.Version;recalc='CalculateFullRebuild';macrosForceDisabled=$true;worksheetEventsDisabled=$true;externalLinksUpdated=$false;inputs=[ordered]@{F11=3;C11=$case.width;D11=$case.height;M11=$case.leaves;J11=$case.opening};selectors=[ordered]@{G11=$main.Range('G11').Value2;S1A2=$sheet.Range('A2').Value2;S1A3=$sheet.Range('A3').Value2;C22=$sheet.Range('C22').Value2;I27=$settings.Range('I27').Value2;D20=$sheet.Range('D20').Value2;D22=$sheet.Range('D22').Value2;C22Formula=$sheet.Range('C22').Formula};settings=$settingCells;cells=$geometry;priceCells=$priceCells;priceLines=$priceLines;priceSheet=$priceSheetCells;rows=$rows})
   }
  }finally{$wb.Close($false);[Runtime.InteropServices.Marshal]::ReleaseComObject($wb)|Out-Null;Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
 }
 $out=Join-Path $PSScriptRoot '..\..\docs\jv\fixtures\slider-pr11b-bom-capture.json';$json=$records|ConvertTo-Json -Depth 15;[IO.File]::WriteAllText([IO.Path]::GetFullPath($out),$json,[Text.UTF8Encoding]::new($false))
}finally{$excel.Quit();[Runtime.InteropServices.Marshal]::ReleaseComObject($excel)|Out-Null;[GC]::Collect();[GC]::WaitForPendingFinalizers()}
Write-Output 'Captured 42 Slider-L3 BOM rows in eight Excel-rebuilt scenarios.'
