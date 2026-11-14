$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$books=@(@{profile='COMPLETATION';name='JV-комплектация 08.10.2026.xlsm'},@{profile='RETAIL';name='JV-розница 08.10.2026.xlsm'})
$cases=@(
 @{id='two_leaf_glass';width=3000;height=2200;leaves=2;opening=1;priceMode=2;f28=1;additional=$false;widthService=$false;install=$false},
 @{id='four_leaf_two_side';width=3600;height=2400;leaves=4;opening=3;priceMode=2;f28=2;additional=$true;widthService=$true;install=$true},
 @{id='no_interlock_glass';width=3200;height=2300;leaves=3;opening=1;priceMode=2;glassType=2;f28=1;additional=$true;widthService=$true;install=$false;h21=$false},
 @{id='four_leaf_right';width=4200;height=2600;leaves=4;opening=2;priceMode=1;f28=1;additional=$true;widthService=$false;install=$false},
 @{id='two_leaf_no_glass';width=2400;height=2000;leaves=2;opening=1;priceMode=1;f28=2;additional=$false;widthService=$false;install=$true}
)
$excel=New-Object -ComObject Excel.Application;$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.EnableEvents=$false;$excel.AskToUpdateLinks=$false;$excel.AutomationSecurity=3
$records=[System.Collections.Generic.List[object]]::new()
function CellRec($sheet,$address){$c=$sheet.Range($address);return [ordered]@{formula=$c.Formula;value=$c.Value2;format=$c.NumberFormat}}
try { foreach($b in $books) {
 $source=Join-Path $root $b.name;$temp=Join-Path ([IO.Path]::GetTempPath()) ('jv-slider-pr11j-'+[guid]::NewGuid().ToString('N')+'.xlsm');Copy-Item -LiteralPath $source -Destination $temp
 $fs=[IO.File]::Open($source,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);try{$sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash($fs))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}finally{$fs.Dispose()}
 $wb=$excel.Workbooks.Open($temp,0,$false)
 try {$main=$wb.Worksheets.Item('Главная');$settings=$wb.Worksheets.Item('Настройки');$s1=$wb.Worksheets.Item('S1');$slider=$wb.Worksheets.Item('Прайс-Slider');$services=$wb.Worksheets.Item('Прайс-сб+монт');$glass=$wb.Worksheets.Item('Прайс-Стекло');$prm=$wb.Worksheets.Item('ПРМ');$glue=$wb.Worksheets.Item('Клей+акт')
 foreach($case in $cases){
  $main.Range('F11').Value2=6;$main.Range('C11').Value2=$case.width;$main.Range('D11').Value2=$case.height;$main.Range('M11').Value2=$case.leaves;$main.Range('J11').Value2=$case.opening;$main.Range('F28').Value2=$case.f28;$main.Range('H11').Value2=$case.priceMode;$main.Range('I11').Value2=if($case.ContainsKey('glassType')){$case.glassType}else{9};foreach($row in 12..17){$main.Range("Z$row").Value2=0}
  $settings.Range('H21').Value2=if($case.ContainsKey('h21') -and !$case.h21){0}else{1};$settings.Range('D32').Value2=if($case.additional){1}else{0};$settings.Range('D33').Value2=if($case.widthService){1}else{0};$settings.Range('D34').Value2=if($case.install){1}else{0}
  $wb.Application.CalculateFullRebuild()
  $cells=[ordered]@{};foreach($a in @('A3','C8','C9','C10','C11','C12','C17','C18','C20','C22','C24','C26','C47','C48','C49','D3','D4','D5','D6','D17','D18','D20','D22','D24','D26','D28','D31','D32','D33','D34','D43','D44','D45','D47','D48','D49','D50','D51','D52','D53','R22','R23','R24','R26','R27','T5','M47','M48','M49','M50','M51','M52','M53')){$cells[$a]=CellRec $s1 $a}
  $materials=[ordered]@{};for($row=5;$row -le 46;$row++){foreach($col in @('K','L','M','R')){$addr="$col$row";$materials[$addr]=CellRec $s1 $addr}}
  $catalog=[ordered]@{};for($row=5;$row -le 46;$row++){foreach($col in @('B','C','D','E','G')){$addr="$col$row";$catalog["$col$row"]=CellRec $slider $addr}}
  $settingsOut=[ordered]@{};foreach($a in @('D4','D6','D8','D13','D21','D32','D33','D34','H19','H21','H23','H25','H27','I15','I17','I25','I27','I29','I31','L3','L4','L5','L6','L8','L9','L10','L11','L17','L18','L23','S2','S3','S4','S6','S7','S9','S10','S11','S12','S13','S14','S21','S22','S23','S24','S26')){$settingsOut[$a]=CellRec $settings $a}
  $serviceOut=[ordered]@{};foreach($a in @('C7','C14','C15','C19','C23','C24','C25')){$serviceOut[$a]=CellRec $services $a}
  $glassOut=[ordered]@{};for($row=1;$row -le 40;$row++){foreach($col in @('A','B','C','D','E','F','G','H')){$addr="$col$row";$rec=CellRec $glass $addr;if($rec.formula -ne '' -or $rec.value -ne $null){$glassOut[$addr]=$rec}}}
  $prmOut=[ordered]@{};for($row=25;$row -le 32;$row++){foreach($col in @('U','V','W','X','Y','Z','AA','AB')){$a="$col$row";$prmOut[$a]=CellRec $prm $a}}
  $mainInputs=[ordered]@{};foreach($row in 11..17){foreach($col in @('C','D','F','Z')){$a="$col$row";$mainInputs[$a]=CellRec $main $a}}
  $glueCosts=[ordered]@{};foreach($a in @('N5','N6','N7','N8','N9','N10','N11','N12','O5','N18','N19','N20','N21','N22','N23','N24','N25','O18')){$glueCosts[$a]=CellRec $glue $a}
  $records.Add([ordered]@{schemaVersion='1.0';profile=$b.profile;workbook=$b.name;sha256=$hash;excelVersion=$excel.Version;recalc='CalculateFullRebuild';scenarioId=$case.id;requestedInputs=[ordered]@{F11=6;C11=$case.width;D11=$case.height;M11=$case.leaves;J11=$case.opening;H11=$case.priceMode;F28=$case.f28;additional=$case.additional;widthService=$case.widthService;install=$case.install};main=[ordered]@{F11=CellRec $main 'F11';G11=CellRec $main 'G11';H11=CellRec $main 'H11';I11=CellRec $main 'I11';F28=CellRec $main 'F28';T11=CellRec $main 'T11';Y11=CellRec $main 'Y11'};mainOrderInputs=$mainInputs;cells=$cells;materials=$materials;sliderCatalog=$catalog;settings=$settingsOut;serviceRates=$serviceOut;glassSheet=$glassOut;prm=$prmOut;glueCosts=$glueCosts})
 }
 } finally {$wb.Close($false);[Runtime.InteropServices.Marshal]::ReleaseComObject($wb)|Out-Null;Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
 }} finally {$excel.Quit();[Runtime.InteropServices.Marshal]::ReleaseComObject($excel)|Out-Null;[GC]::Collect();[GC]::WaitForPendingFinalizers()}
$out=Join-Path $PSScriptRoot '..\..\docs\jv\fixtures\slider-pr11j-commercial-capture.json';[IO.File]::WriteAllText([IO.Path]::GetFullPath($out),($records|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false));Write-Output "Captured $($records.Count) Excel 16 commercial scenarios to a temporary-copy fixture."
