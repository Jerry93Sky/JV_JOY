param(
  [string]$CompletionWorkbook='C:\Users\jerry\Desktop\JV\JV-комплектация 08.10.2026.xlsm',
  [string]$RetailWorkbook='C:\Users\jerry\Desktop\JV\JV-розница 08.10.2026.xlsm',
  [string]$ManifestPath='docs/jv/fixtures/front-door-all-seven-inputs.json',
  [string]$OutputPath='docs/jv/fixtures/front-door-all-seven-excel.json'
)
$ErrorActionPreference='Stop'
$manifest=Get-Content -LiteralPath $ManifestPath -Raw|ConvertFrom-Json
$excel=New-Object -ComObject Excel.Application
$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.AutomationSecurity=3;$excel.EnableEvents=$false;$excel.AskToUpdateLinks=$false
$paths=@{COMPLETATION=$CompletionWorkbook;RETAIL=$RetailWorkbook}
$results=[Collections.Generic.List[object]]::new()
function CellRecord($sheet,[string]$address){$c=$sheet.Range($address);$v=$c.Value2;return [ordered]@{formula=[string]$c.Formula;value2=$v;text=[string]$c.Text;numberFormat=[string]$c.NumberFormat}}
try {
 foreach($scenario in $manifest.scenarios){
  $source=$paths[[string]$scenario.profile]
  if(-not(Test-Path -LiteralPath $source)){throw "Missing Excel source workbook: $source"}
  $sha=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
  if($sha -ne [string]$scenario.sourceSha256){throw "Workbook SHA-256 mismatch for $($scenario.scenarioId): expected $($scenario.sourceSha256), got $sha"}
  $temp=Join-Path ([IO.Path]::GetTempPath()) ('jv-pr13e-'+[guid]::NewGuid().ToString('N')+'.xlsm')
  Copy-Item -LiteralPath $source -Destination $temp -Force
  $wb=$excel.Workbooks.Open($temp,0,$false)
  try {
   foreach($write in $scenario.primaryInputWrites){$ws=$wb.Worksheets.Item([string]$write.sheet);$value=$write.value;if($value -is [long] -or $value -is [int]){$value=[double]$value};try{if($value -is [bool]){$ws.Range([string]$write.address).Value2=[bool]$value}elseif($value -is [double] -and [Math]::Floor($value) -eq $value){$ws.Range([string]$write.address).Value2=[int]$value}elseif($value -is [double]){$ws.Range([string]$write.address).Value2=[double]$value}else{$ws.Range([string]$write.address).Value2=[string]$value}}catch{throw "Failed writing $($write.sheet)!$($write.address) = $value ($($value.GetType().FullName)): $($_.Exception.Message)"}}
   $excel.CalculateFullRebuild()
   $inputCapture=[Collections.Generic.List[object]]::new()
   foreach($write in $scenario.primaryInputWrites){$ws=$wb.Worksheets.Item([string]$write.sheet);$rec=CellRecord $ws ([string]$write.address);$inputCapture.Add([ordered]@{family=$write.family;sheet=$write.sheet;address=$write.address;expected=$write.value;actual=$rec.value2;formula=$rec.formula;text=$rec.text;numberFormat=$rec.numberFormat;source=$write.source})}
   $main=$wb.Worksheets.Item('Главная');$slotResults=[Collections.Generic.List[object]]::new()
   foreach($position in $scenario.engineInput.positions){
    $slot=[int]$position.slot;$row=10+$slot
    $selector=[int]$slot
    $sourceSheet=if($position.family -eq 'LINE'){"L$slot"}elseif($position.family -eq 'ZIGZAG'){"Z$slot"}elseif($position.family -eq 'FRONT'){"F$slot"}else{"S$slot"}
    $familySheet=$wb.Worksheets.Item($sourceSheet)
    $priceCell=if($position.family -eq 'LINE'){'Q58'}elseif($position.family -eq 'ZIGZAG'){'P44'}elseif($position.family -eq 'FRONT'){'S38'}else{'M53'}
    $slotResults.Add([ordered]@{slot=$slot;family=$position.family;quantity=$position.quantity;sourceSheet=$sourceSheet;main=[ordered]@{selector=(CellRecord $main "F$row");width=(CellRecord $main "C$row");height=(CellRecord $main "D$row");quantity=(CellRecord $main "Z$row");unitPriceSource=(CellRecord $familySheet $priceCell);rowPrice=(CellRecord $main "Y$row");extendedPrice=(CellRecord $main "AA$row")} })
   }
   $aa=[Collections.Generic.List[object]]::new();foreach($slot in 1..7){$cell="AA$(10+$slot)";$aa.Add((CellRecord $main $cell))}
   $aa18=CellRecord $main 'AA18'
   $glue=$wb.Worksheets.Item('Клей+акт');$glueRows=@{};foreach($address in @('N5','N6','N7','N8','N9','N10','N11','N12','O5','N18','N19','N20','N21','N22','N23','N24','N25','O18')){$glueRows[$address]=CellRecord $glue $address}
   $prm=$wb.Worksheets.Item('ПРМ');$areas=@{};foreach($slot in 1..7){$address="AB$(24+$slot)";$areas[$address]=CellRecord $prm $address}
   $f7=$wb.Worksheets.Item('F7');$services=$wb.Worksheets.Item('Прайс-сб+монт')
   $frontComponents=[ordered]@{};foreach($address in @('C3','C4','C5','C8','Q27','Q28','Q29','Q30','R27','R28','R29','R30','S27','S28','S29','S30','S33','S34','S35','S36','S37','S38','I23','Y5')){$frontComponents[$address]=CellRecord $f7 $address};$frontComponents['Service!C25']=CellRecord $services 'C25'
   $results.Add([ordered]@{scenarioId=$scenario.scenarioId;profile=$scenario.profile;workbook=[IO.Path]::GetFileName($source);sourceSha256=$sha;excelVersion=$excel.Version;calculationMode='CalculateFullRebuild';temporaryCopy=$true;inputCells=$inputCapture;slots=$slotResults;AA11toAA17=$aa;AA18=$aa18;sharedConsumables=$glueRows;areaShares=$areas;frontSlot7=$frontComponents})
  } finally {$wb.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb);Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
 }
} finally {$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel);[GC]::Collect();[GC]::WaitForPendingFinalizers()}
$full=Join-Path (Get-Location) $OutputPath;[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($full))|Out-Null
[IO.File]::WriteAllText($full,($results|ConvertTo-Json -Depth 25),[Text.UTF8Encoding]::new($false))
Write-Output "Captured $($results.Count) all-seven scenario/profile cases using Excel $($excel.Version); workbook copies only."
