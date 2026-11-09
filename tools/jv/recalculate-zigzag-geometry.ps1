param([string]$Output='docs/jv/fixtures/zigzag-geometry-excel.json')
$ErrorActionPreference='Stop'
$resolved=(& node tools/jv/resolve-excel-sources.mjs | ConvertFrom-Json)
$books=@(
  @{profile='COMPLETATION';path=$resolved.completion.path;hash=$resolved.completion.sha256},
  @{profile='RETAIL';path=$resolved.retail.path;hash=$resolved.retail.sha256}
)
$scenarios=@(
  @{id='zigzag_yes_3600x2400_4leaf';width=3600;height=2400;leaves=4;openingSelector=2;setting=1;lockSetting=2;wholeGlue=$false},
  @{id='zigzag_no_3600x2400_4leaf';width=3600;height=2400;leaves=4;openingSelector=2;setting=2;lockSetting=2;wholeGlue=$false},
  @{id='zigzag_yes_4200x2500_5leaf';width=4200;height=2500;leaves=5;openingSelector=3;setting=1;lockSetting=2;wholeGlue=$false},
  @{id='zigzag_no_4200x2500_5leaf';width=4200;height=2500;leaves=5;openingSelector=3;setting=2;lockSetting=2;wholeGlue=$false},
  @{id='zigzag_selector1_even_lock_yes_3600';width=3600;height=2400;leaves=4;openingSelector=1;setting=1;lockSetting=1;wholeGlue=$true},
  @{id='zigzag_selector2_odd_lock_no_4200';width=4200;height=2500;leaves=5;openingSelector=2;setting=1;lockSetting=2;wholeGlue=$false}
)
$xl=New-Object -ComObject Excel.Application
$xl.Visible=$false;$xl.DisplayAlerts=$false;$xl.AutomationSecurity=3;$xl.EnableEvents=$false
$results=[System.Collections.Generic.List[object]]::new()
try {
 foreach($book in $books){foreach($scenario in $scenarios){
  $tmp=Join-Path $env:TEMP ('jv-zigzag-'+[guid]::NewGuid().ToString('N')+'.xlsm')
  Copy-Item -LiteralPath $book.path -Destination $tmp
  $wb=$xl.Workbooks.Open($tmp)
  try {
   $main=$wb.Worksheets.Item('Главная');$settingsSheet=$wb.Worksheets.Item('Настройки')
   $settingsSheet.Range('H2').Value2=$scenario.setting
   $settingsSheet.Range('H8').Value2=$scenario.lockSetting
   $settingsSheet.Range('L6').Value2=[int][bool]$scenario.wholeGlue
   $main.Range('F11').Value2=2;$main.Range('C11').Value2=$scenario.width;$main.Range('D11').Value2=$scenario.height
   $main.Range('L11').Value2=$scenario.leaves;$main.Range('J11').Value2=$scenario.openingSelector
   $xl.CalculateFullRebuild()
   $z=$wb.Worksheets.Item('Z1');$lookup=$wb.Worksheets.Item('#1')
   $settings=@{}
   foreach($address in @('P4','P24','P25','P26','P27','P28','P29','L23','D8','P3','D6','L4','L5','L7','L8','P12','P13','P16','P17','P21')){$settings[$address]=[string]$settingsSheet.Range($address).Value2}
   $settings['L6']=[bool]$settingsSheet.Range('L6').Value2
   $cells=@{}
   foreach($address in @('D3','D5','D6','H4','H5','H6','H7','H8','H9','H13','H14','H15','H16','H17','H18','D29','D30','D31','D22','D23','C22','C23','G37','G38','G39','H39','G40','G41','N5','N6','N7','N8','N9','N10','N11','N12','N13','N14','N15','N16','N17','N18','N19','N20','N21','N22','N23','N24','N25','N26','N27','N28','N29','N30','N31','N32','N33','N34','N35')){$cells[$address]=[string]$z.Range($address).Value2}
   $switches=@{
    D14=@{settingIndex=[int]$settingsSheet.Range('H4').Value2;overrideIndex=[int]$z.Range('C14').Value2;choices=@([string]$lookup.Range('G3').Value2,[string]$lookup.Range('G4').Value2)}
    D15=@{settingIndex=[int]$settingsSheet.Range('H6').Value2;overrideIndex=[int]$z.Range('C15').Value2;choices=@([string]$lookup.Range('F7').Value2,[string]$lookup.Range('F8').Value2)}
    D16=@{settingIndex=[int]$settingsSheet.Range('H8').Value2;overrideIndex=[int]$z.Range('C16').Value2;choices=@([string]$lookup.Range('G7').Value2,[string]$lookup.Range('G8').Value2)}
    D17=@{settingIndex=[int]$settingsSheet.Range('H10').Value2;overrideIndex=[int]$z.Range('C17').Value2;choices=@([string]$lookup.Range('F11').Value2,[string]$lookup.Range('F12').Value2)}
   }
   $inputs=@{family='ZIGZAG';selectorF=2;widthMm=$scenario.width;heightMm=$scenario.height;leafSelector=$scenario.leaves;openingSelector=$scenario.openingSelector;frameSettingIndex=$scenario.setting;frameOverrideIndex=[int]$z.Range('C13').Value2;frameChoices=@([string]$lookup.Range('F3').Value2,[string]$lookup.Range('F4').Value2);switches=$switches}
   $results.Add(@{id=$scenario.id;profile=$book.profile;workbook=[IO.Path]::GetFileName($book.path);sha256=$book.hash;excelVersion=$xl.Version;inputs=$inputs;settings=$settings;cells=$cells})
  } finally {$wb.Close($false);Remove-Item -LiteralPath $tmp -Force}
 }}
} finally {$xl.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)}
$json=@{schemaVersion=1;method='Excel 16 COM CalculateFullRebuild on temporary copies; outputs captured after recompute; originals remain unchanged';cases=@($results)}|ConvertTo-Json -Depth 8
$out=Join-Path (Get-Location) $Output
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($out))|Out-Null
[IO.File]::WriteAllText($out,$json,[Text.UTF8Encoding]::new($false))
Write-Output "Wrote $($results.Count) Zigzag Excel cases to $Output"
