$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$books=@(@{profile='COMPLETATION';name='JV-комплектация 08.10.2026.xlsm'},@{profile='RETAIL';name='JV-розница 08.10.2026.xlsm'})
$excel=New-Object -ComObject Excel.Application
$excel.Visible=$false;$excel.DisplayAlerts=$false
$records=[System.Collections.Generic.List[object]]::new()
try {
 foreach($bookInfo in $books){
  $source=Join-Path $root $bookInfo.name
  $stream=[IO.File]::Open($source,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
  try{$sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}finally{$stream.Dispose()}
  $temp=Join-Path ([IO.Path]::GetTempPath()) ('jv-slider-bom-pr11a-'+[guid]::NewGuid().ToString('N')+'.xlsm');Copy-Item -LiteralPath $source -Destination $temp
  $wb=$excel.Workbooks.Open($temp)
  try {
   $main=$wb.Worksheets.Item('Главная');$main.Range('F11').Value2=3;$main.Range('C11').Value2=3000;$main.Range('D11').Value2=2200;$main.Range('M11').Value2=2;$main.Range('J11').Value2=1;$wb.Application.CalculateFullRebuild()
   $sheet=$wb.Worksheets.Item('S1');$lines=[System.Collections.Generic.List[object]]::new()
   for($row=5;$row -le 46;$row++){$lines.Add([ordered]@{row=$row;sku=[ordered]@{formula=$sheet.Range("F$row").Formula;value=$sheet.Range("F$row").Value2};description=[ordered]@{formula=$sheet.Range("G$row").Formula;value=$sheet.Range("G$row").Value2};unit=[ordered]@{formula=$sheet.Range("H$row").Formula;value=$sheet.Range("H$row").Value2};selectorFormula=$sheet.Range("J$row").Formula;quantityFormula=$sheet.Range("K$row").Formula;quantity=$sheet.Range("K$row").Value2})}
   $validations=[ordered]@{};foreach($address in @('C11','D11','M11','J11')){try{$validations[$address]=[ordered]@{type=$main.Range($address).Validation.Type;formula1=$main.Range($address).Validation.Formula1;formula2=$main.Range($address).Validation.Formula2}}catch{$validations[$address]=[ordered]@{error=$_.Exception.Message}}}
   $records.Add([ordered]@{profile=$bookInfo.profile;workbook=$bookInfo.name;sha256=$hash;calculation='CalculateFullRebuild';selector=[ordered]@{F11=3;G11=$main.Range('G11').Value2;S1A2=$sheet.Range('A2').Value2;S1A3=$sheet.Range('A3').Value2};inputValidations=$validations;sourceRange='S1!F5:K46';rows=$lines})
  }finally{$wb.Close($false);[Runtime.InteropServices.Marshal]::ReleaseComObject($wb)|Out-Null;Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
 }
 $out=Join-Path $PSScriptRoot '..\..\docs\jv\fixtures\slider-pr11a-bom-capture.json';$json=$records|ConvertTo-Json -Depth 15;[IO.File]::WriteAllText([IO.Path]::GetFullPath($out),$json,[Text.UTF8Encoding]::new($false))
}finally{$excel.Quit();[Runtime.InteropServices.Marshal]::ReleaseComObject($excel)|Out-Null;[GC]::Collect();[GC]::WaitForPendingFinalizers()}
Write-Output 'Captured S1!F5:K46 for both workbooks.'
