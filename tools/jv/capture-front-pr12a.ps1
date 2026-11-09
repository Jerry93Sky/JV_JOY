param([string]$OutputPath = (Join-Path $PSScriptRoot '..\..\docs\jv\fixtures\front-pr12a-excel.json'))
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$books = @(
  @{profile='COMPLETATION';name='JV-комплектация 08.10.2026.xlsm'},
  @{profile='RETAIL';name='JV-розница 08.10.2026.xlsm'}
)
$cases = @(
  @{id='base';width=3000;height=2200;leaves=3;option=3;doorSetting=1},
  @{id='wide';width=3600;height=2400;leaves=4;option=3;doorSetting=1},
  @{id='one';width=1200;height=2000;leaves=1;option=3;doorSetting=1},
  @{id='two';width=2200;height=2300;leaves=2;option=3;doorSetting=1},
  @{id='tall';width=4000;height=2700;leaves=5;option=3;doorSetting=1},
  @{id='door_one';width=3000;height=2200;leaves=3;option=1;doorSetting=2},
  @{id='door_two';width=3600;height=2400;leaves=4;option=2;doorSetting=2},
  @{id='p_profile';width=3000;height=2200;leaves=3;option=3;doorSetting=1;profileSetting=2;frameSetting=2},
  @{id='fixed_door_width';width=3400;height=2300;leaves=3;option=1;doorSetting=2;doorWidthMode=2},
  @{id='transom';width=3200;height=2600;leaves=3;option=1;doorSetting=2;transomMode=2},
  @{id='fittings';width=3300;height=2350;leaves=3;option=1;doorSetting=2;transomMode=2;capSetting=1;edgeMode=2;closerMode=2;secondLockMode=2},
  @{id='fractional_sections';width=2700;height=2100;leaves=2.4;option=3;doorSetting=1}
)
$excel = $null
$records = [System.Collections.Generic.List[object]]::new()
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AutomationSecurity = 3 # msoAutomationSecurityForceDisable
  $excel.EnableEvents = $false
  foreach ($info in $books) {
    $source = Join-Path $sourceRoot $info.name
    if (!(Test-Path -LiteralPath $source)) { throw "Missing source $source" }
    $hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    $temp = Join-Path ([IO.Path]::GetTempPath()) ('jv-front-pr12a-' + [guid]::NewGuid().ToString('N') + '.xlsm')
    Copy-Item -LiteralPath $source -Destination $temp
    $wb = $excel.Workbooks.Open($temp)
    try {
      $main = $wb.Worksheets.Item('Главная')
      $front = $wb.Worksheets.Item('F1')
      $settings = $wb.Worksheets.Item('Настройки')
      $cat1 = $wb.Worksheets.Item('#1')
      $cat2 = $wb.Worksheets.Item('#2')
      foreach ($case in $cases) {
        $main.Range('F11').Value2 = 7
        $main.Range('C11').Value2 = $case.width
        $main.Range('D11').Value2 = $case.height
        $main.Range('L11').Value2 = [double]$case.leaves
        $main.Range('J11').Value2 = [double]$(if ($case.option -eq 1) {1} else {$case.option+1})
        $settings.Range('I42').Value2 = $case.doorSetting
        $settings.Range('H38').Value2 = if ($case.ContainsKey('profileSetting')) {$case.profileSetting} else {1}
        $settings.Range('I44').Value2 = if ($case.ContainsKey('frameSetting')) {$case.frameSetting} else {1}
        $settings.Range('H44').Value2 = if ($case.ContainsKey('capSetting')) {$case.capSetting} else {2}
        $front.Range('C18').Value2 = if ($case.ContainsKey('doorWidthMode')) {$case.doorWidthMode} else {1}
        $front.Range('C19').Value2 = if ($case.ContainsKey('transomMode')) {$case.transomMode} else {1}
        $front.Range('C20').Value2 = if ($case.ContainsKey('edgeMode')) {$case.edgeMode} else {1}
        $front.Range('C21').Value2 = if ($case.ContainsKey('closerMode')) {$case.closerMode} else {1}
        $front.Range('C24').Value2 = if ($case.ContainsKey('secondLockMode')) {$case.secondLockMode} else {1}
        $excel.CalculateFullRebuild()
        $frontCells = [ordered]@{}
        $addresses = [System.Collections.Generic.List[string]]::new()
        foreach ($a in @('A2','A3','C3','C4','C5','C6','C7','C8','C11','C12','C13','C14','C15','C17','C18','C19','C20','C21','C22','C23','C24','D3','D5','D6','D7','D8','D11','D12','D13','D14','D15','D17','D18','D19','D20','E18','E22','E23','E24','I6','I7','I27','K28','K31','K32')) {$addresses.Add($a)}
        foreach ($spec in @(@('C',28,31),@('D',28,34),@('E',28,31),@('H',3,14),@('I',17,23),@('I',28,32),@('J',28,34),@('P',5,32),@('Q',5,32))) {
          for ($row=[int]$spec[1]; $row -le [int]$spec[2]; $row++) {$addresses.Add(("{0}{1}" -f $spec[0],$row))}
        }
        $block=$front.Range('A2:Q35')
        $formulas=$block.Formula
        $values=$block.Value2
        $rowBase=$formulas.GetLowerBound(0)
        $columnBase=$formulas.GetLowerBound(1)
        foreach ($address in $addresses) {
            $column=([int][char]$address.Substring(0,1))-([int][char]'A')
            $row=[int]$address.Substring(1)-2
            $formula=$formulas.GetValue($rowBase+$row,$columnBase+$column)
            if ($null -ne $formula -and $formula -ne '') {
              $frontCells[$address] = [ordered]@{formula=$formula;value=$values.GetValue($rowBase+$row,$columnBase+$column);numberFormat=$front.Range($address).NumberFormat}
            }
        }
        $mainCells = [ordered]@{}
        foreach ($address in @('C11','D11','F11','G11','H11','I11','J11','K11','L11','M11','N11','X11')) {
          $range=$main.Range($address)
          $mainCells[$address]=[ordered]@{formula=$range.Formula;value=$range.Value2;text=$range.Text;numberFormat=$range.NumberFormat}
        }
        $settingCells=[ordered]@{}
        foreach ($address in @('D8','S29','S30','S31','S32','S33','S34','L22','L23','H38','H40','H42','H44','I34','I36','I38','I40','I42','I44')) {
          $range=$settings.Range($address)
          $settingCells[$address]=[ordered]@{formula=$range.Formula;value=$range.Value2;text=$range.Text}
        }
        $lookups=[ordered]@{}
        foreach ($table in @(@($cat1,'#1',@('C11','C12','C13','C14','C15','C16','C17','C18','C19','C20','C21','C22','C24','C25','C26','C27','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21','D22')),@($cat2,'#2',@('C6','C7','E6','E7','F6','F7','G6','G7','G8','C42','C43','C44')))) {
          $cells=[ordered]@{}
          foreach ($address in $table[2]) {$range=$table[0].Range($address);$cells[$address]=[ordered]@{formula=$range.Formula;value=$range.Value2}}
          $lookups[$table[1]]=$cells
        }
        $records.Add([ordered]@{scenarioId=($info.profile+'-'+$case.id);profile=$info.profile;workbook=$info.name;sourceSha256=$hash;excelVersion=$excel.Version;calculation='CalculateFullRebuild';inputs=$case;main=$mainCells;settings=$settingCells;lookups=$lookups;front=$frontCells})
      }
      foreach ($com in @($main,$front,$settings,$cat1,$cat2)) {[void][Runtime.InteropServices.Marshal]::ReleaseComObject($com)}
    } finally {
      $wb.Close($false)
      [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb)
      Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    }
  }
  $directory=Split-Path -Parent $OutputPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),([ordered]@{schemaVersion='1.0';method='Excel 16 COM CalculateFullRebuild on temporary copies';scenarios=$records}|ConvertTo-Json -Depth 24),[Text.UTF8Encoding]::new($false))
} finally {
  if ($excel) {$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)}
  [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
Write-Output "Wrote $OutputPath"
