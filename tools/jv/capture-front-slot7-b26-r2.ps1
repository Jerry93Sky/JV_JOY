param([string]$OutputPath='docs/jv/fixtures/front-slot7-b26-r2-excel.json')
$ErrorActionPreference='Stop'
$manifest=Get-Content -Raw -LiteralPath 'docs/jv/fixtures/unified-order-all-seven-inputs.json' | ConvertFrom-Json
$xl=New-Object -ComObject Excel.Application
$xl.Visible=$false; $xl.DisplayAlerts=$false; $xl.AutomationSecurity=3; $xl.EnableEvents=$false; $xl.AskToUpdateLinks=$false
$rows=[Collections.Generic.List[object]]::new()
function readCell($sheet,$address) { $c=$sheet.Range($address); [ordered]@{formula=[string]$c.Formula;value2=$c.Value2;text=[string]$c.Text;numberFormat=[string]$c.NumberFormat} }
try {
 foreach($profile in @('COMPLETATION','RETAIL')) {
  $scenario=$manifest.scenarios | Where-Object { $_.profile -eq $profile } | Select-Object -First 1
  $source=Join-Path (Split-Path -Parent (Get-Location).Path) $scenario.workbook
  $hash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
  if($hash -ne $scenario.sourceSha256) { throw 'Source workbook hash differs from manifest' }
  $copy=Join-Path ([IO.Path]::GetTempPath()) ('jv-b26-'+[guid]::NewGuid().ToString('N')+'.xlsm')
  Copy-Item -LiteralPath $source -Destination $copy
  $wb=$xl.Workbooks.Open($copy,0,$false)
  try {
   foreach($write in $scenario.primaryInputWrites) { $value=$write.value; $cell=$wb.Worksheets.Item([string]$write.sheet).Range([string]$write.address); if($value -is [bool]){$cell.Value2=[bool]$value}elseif($value -is [long] -or $value -is [int]){$cell.Value2=[int]$value}elseif($value -is [double]){$cell.Value2=[double]$value}else{$cell.Value2=[string]$value} }
   $m=$wb.Worksheets.Item('Главная'); $f=$wb.Worksheets.Item('F7'); $service=$wb.Worksheets.Item('Прайс-сб+монт')
   foreach($b26 in @(1,2)) { $m.Range('B26').Value2=$b26; foreach($mode in @(1,2)) { $m.Range('F28').Value2=$mode; $xl.CalculateFullRebuild(); $rows.Add([ordered]@{profile=$profile;workbook=$scenario.workbook;sha256=$hash;excelVersion=$xl.Version;scenario=$scenario.scenarioId;F28=$mode;B26=(readCell $m 'B26');S36=(readCell $f 'S36');S38=(readCell $f 'S38');Y5=(readCell $f 'Y5');C25=(readCell $service 'C25');AA17=(readCell $m 'AA17');AA18=(readCell $m 'AA18')}) } }
  } finally { $wb.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb); Remove-Item -LiteralPath $copy -Force -ErrorAction SilentlyContinue }
 }
} finally { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl); [GC]::Collect(); [GC]::WaitForPendingFinalizers() }
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),([ordered]@{method='Excel COM 16 CalculateFullRebuild; original workbooks copied';records=$rows}|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
