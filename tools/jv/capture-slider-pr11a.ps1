param(
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\..\docs\jv\fixtures\slider-pr11a-selector-capture.json')
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$books=@(
  @{profile='COMPLETATION';name='JV-комплектация 08.10.2026.xlsm'},
  @{profile='RETAIL';name='JV-розница 08.10.2026.xlsm'}
)
$cases=@(
  @{id='l3_base_left_two_leaves';width=3000;height=2200;leaves=2;opening=1},
  @{id='l3_wider_four_leaves_two_sided';width=3600;height=2400;leaves=4;opening=3}
)
$excel=$null
$records=[System.Collections.Generic.List[object]]::new()
try {
  $excel=New-Object -ComObject Excel.Application
  $excel.Visible=$false
  $excel.DisplayAlerts=$false
  foreach($bookInfo in $books) {
    $source=Join-Path $root $bookInfo.name
    if(!(Test-Path -LiteralPath $source)){throw "Source workbook not found: $source"}
    $stream=[IO.File]::Open($source,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
    try{$sha=[Security.Cryptography.SHA256]::Create();try{$sourceHash=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}finally{$stream.Dispose()}
    $temp=Join-Path ([IO.Path]::GetTempPath()) ("jv-slider-pr11a-"+[guid]::NewGuid().ToString('N')+'.xlsm')
    Copy-Item -LiteralPath $source -Destination $temp
    $workbook=$excel.Workbooks.Open($temp)
    try {
      $main=$workbook.Worksheets.Item('Главная')
      $settings=$workbook.Worksheets.Item('Настройки')
      $headers=[ordered]@{}
      foreach($cell in @('R10','S10','T10','U10','V10','W10','X10')){$headers[$cell]=[ordered]@{formula=$main.Range($cell).Formula;value=$main.Range($cell).Value2;text=$main.Range($cell).Text}}
      foreach($case in $cases) { $selectors=if($case.id -eq 'l3_base_left_two_leaves'){@(3,4,5,6)}else{@(3)}; foreach($selector in $selectors) {
        $main.Range('F11').Value2=$selector
        $main.Range('C11').Value2=$case.width
        $main.Range('D11').Value2=$case.height
        $main.Range('M11').Value2=$case.leaves
        $main.Range('J11').Value2=$case.opening
        $workbook.Application.CalculateFullRebuild()
        $sheetStates=[ordered]@{}
        foreach($sheetName in @('L1','L2','L3','Z1','S1','S2','S3','F1')) {
          try {
            $sheet=$workbook.Worksheets.Item($sheetName)
            $sheetStates[$sheetName]=[ordered]@{A2=$sheet.Range('A2').Value2;A3=$sheet.Range('A3').Value2;C3=$sheet.Range('C3').Value2;D3=$sheet.Range('D3').Value2;D4=$sheet.Range('D4').Value2;D5=$sheet.Range('D5').Value2;D6=$sheet.Range('D6').Value2;D7=$sheet.Range('D7').Value2;M53=$sheet.Range('M53').Value2;M53Formula=$sheet.Range('M53').Formula;Q58=$sheet.Range('Q58').Value2;Q58Formula=$sheet.Range('Q58').Formula}
          } catch {}
        }
        $sliderCells=[ordered]@{}
        foreach($address in @('C8','C9','C10','C11','C12','C13','C14','C33','C34','C36','D3','D4','D5','D6','D7','D8','D17','D18','D20','D22','D24','D26','D28','D31','D32','D33','D34','D36','D37','D43','D44','D45','F5','G5','H5','I5','J5','K5','F6','G6','H6','I6','J6','K6','F7','G7','H7','I7','J7','K7','F8','G8','H8','I8','J8','K8','F9','G9','H9','I9','J9','K9','F10','G10','H10','I10','J10','K10','K11','K12','K13','K14','K15','K16','K17','K18','K19','K20','K21','K22','K23','K24','K25','K26','K27','K28','K29','K30','K31','K32','K33','K34','K35','K36','K37','K38','K39','K40','K41','K42','K43','K44','K45','K46','M53')){$sliderCells[$address]=[ordered]@{formula=$workbook.Worksheets.Item('S1').Range($address).Formula;value=$workbook.Worksheets.Item('S1').Range($address).Value2;text=$workbook.Worksheets.Item('S1').Range($address).Text}}
        $mainInputs=[ordered]@{}
        foreach($address in @('C11','D11','F11','G11','H11','I11','J11','K11','L11','M11','N11','Z11','Y11')){$mainInputs[$address]=[ordered]@{formula=$main.Range($address).Formula;value=$main.Range($address).Value2;text=$main.Range($address).Text}}
        $settingCells=[ordered]@{}
        foreach($address in @('D8','S2','S3','S4','S6','S7','S9','S10','S11','S12','S13','S14','S16','S17','S18','S19','S21','S22','S23','S24','L23','H19','H21','H23','H25','H15','H17','H27','H29','H31','H33','H35')){$settingCells[$address]=[ordered]@{formula=$settings.Range($address).Formula;value=$settings.Range($address).Value2;text=$settings.Range($address).Text}}
        $records.Add([ordered]@{scenarioId=($case.id+'-F'+$selector);baseScenarioId=$case.id;profile=$bookInfo.profile;workbook=$bookInfo.name;sha256=$sourceHash;excelVersion=$excel.Version;calculation='CalculateFullRebuild';inputs=[ordered]@{F11=$selector;C11=$case.width;D11=$case.height;M11=$case.leaves;J11=$case.opening};selectorResult=[ordered]@{G11=$main.Range('G11').Value2;G11Formula=$main.Range('G11').Formula};headers=$headers;mainInputs=$mainInputs;main=[ordered]@{T11Formula=$main.Range('T11').Formula;T11=$main.Range('T11').Value2;Y11Formula=$main.Range('Y11').Formula;Y11=$main.Range('Y11').Value2};settings=[ordered]@{L3=$settings.Range('L3').Value2;cells=$settingCells};slider=[ordered]@{cells=$sliderCells};sheets=$sheetStates})
      }}
      [Runtime.InteropServices.Marshal]::ReleaseComObject($main)|Out-Null
      [Runtime.InteropServices.Marshal]::ReleaseComObject($settings)|Out-Null
    } finally {
      $workbook.Close($false)
      [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)|Out-Null
      Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    }
  }
  $payload=[ordered]@{schemaVersion='1.0';method='Excel 16 COM CalculateFullRebuild on temporary copies';scenarios=$records}
  $directory=Split-Path -Parent $OutputPath
  New-Item -ItemType Directory -Path $directory -Force|Out-Null
  $json=$payload|ConvertTo-Json -Depth 20
  [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),$json,[Text.UTF8Encoding]::new($false))
} finally {
  if($excel){$excel.Quit();[Runtime.InteropServices.Marshal]::ReleaseComObject($excel)|Out-Null}
  [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
Write-Output "Wrote $OutputPath"
