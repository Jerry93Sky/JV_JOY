import { readFile, writeFile } from 'node:fs/promises'

const [inputPath = 'docs/jv/fixtures/zigzag-pricing-excel.json', outputPath = 'docs/jv/fixtures/zigzag-price-snapshots.json'] = process.argv.slice(2)
const capture = JSON.parse(await readFile(inputPath, 'utf8'))
const catalogRows = [5,6,7,8,11,15,17,18,19,20,23,26,29,30,31,32,33,34,35,36,37,38,41,42,43,45,46,47,48,50,51]
const rules = new Map([
  [5,{divisor:'D3'}],[6,{divisor:'D3'}],[7,{divisor:'D3'}],[8,{divisor:'D3'}],
  [30,{divisor:'L7'}],[31,{divisor:'L8'}],
])
const profiles = []
const expectedSources = {
  COMPLETATION: { workbook: 'JV-комплектация 08.10.2026.xlsm', sha256: '62dd6d49f059bef840b67713a0ea6a9f1dec0ec90cf364563cf423dac376d2d8' },
  RETAIL: { workbook: 'JV-розница 08.10.2026.xlsm', sha256: '025d7e2911176ca0b0cdb445574565cd8e3f44d814905cd4c474999630c7ab41' },
}
for (const profile of ['COMPLETATION','RETAIL']) {
  const cases = capture.cases.filter((item) => item.profile === profile)
  if (cases.length !== 3) throw new Error(`Expected three captured recalculations for ${profile}; got ${cases.length}`)
  const baseline = cases[0]
  const expectedSource = expectedSources[profile]
  if (baseline.workbook !== expectedSource.workbook || baseline.sha256 !== expectedSource.sha256) throw new Error(`Source workbook/hash differs for ${profile}`)
  const entries = []
  for (let i = 0; i < catalogRows.length; i++) {
    const row = i + 5
    const catalogRow = catalogRows[i]
    const item = baseline.catalog
    const sku = item[`B${catalogRow}`]?.value
    const description = item[`C${catalogRow}`]?.value
    const excelUnit = item[`D${catalogRow}`]?.value
    const price = item[`E${catalogRow}`]
    if (!sku || !description || !excelUnit || price?.value == null) throw new Error(`Missing catalog source data at 'Прайс-Line'!B${catalogRow}:E${catalogRow}`)
    for (const other of cases.slice(1)) {
      const compare = other.catalog[`E${catalogRow}`]
      if (compare?.value !== price.value || compare?.formula !== price.formula) throw new Error(`Price source changed between scenarios at E${catalogRow} (${profile})`)
    }
    const priceFormula = rules.get(row)
      ? `='Прайс-Line'!$E${catalogRow}/Настройки!$${rules.get(row).divisor}`
      : `='Прайс-Line'!$E${catalogRow}`
    for (const scenario of cases) {
      const expectedFormula = priceFormula.replaceAll('$', '')
      const actualFormula = scenario.cells[`O${row}`].formula.replaceAll('$', '').replaceAll(' ', '')
      if (actualFormula.toLocaleLowerCase('ru-RU') !== expectedFormula.replaceAll(' ', '').toLocaleLowerCase('ru-RU')) {
        throw new Error(`Unexpected Excel formula Z1!O${row}: ${scenario.cells[`O${row}`].formula}; expected ${priceFormula}`)
      }
    }
    entries.push({
      bomRow: row, sku, description, excelUnit, price: String(price.value),
      sourceCell: `'Прайс-Line'!E${catalogRow}`,
      ...(price.formula.startsWith('=') ? { sourceFormula: price.formula } : { sourceLiteral: price.formula }),
      excelPriceFormula: priceFormula,
      divisorSetting: rules.get(row)?.divisor,
      amountFormula: row === 34 ? `=O34*N34*'Клей+акт'!$O$5` : row === 35 ? `=O35*N35*'Клей+акт'!$O$18` : `=O${row}*N${row}`,
    })
  }
  for (const scenario of cases.slice(1)) {
    for (const cell of ['C6','C8','C9','C13','C19','C23','C24','C25']) {
      const source = baseline.sources.assemblyInstall[cell], other = scenario.sources.assemblyInstall[cell]
      if (source?.value !== other?.value || source?.formula !== other?.formula) throw new Error(`Assembly/install price changed between scenarios at ${cell} (${profile})`)
    }
    for (const row of [5,6,7,8,9,10,39,40]) {
      const source = baseline.catalog[`G${row}`], other = scenario.catalog[`G${row}`]
      if (source?.value !== other?.value || source?.formula !== other?.formula) throw new Error(`Line cost rate changed between scenarios at G${row} (${profile})`)
    }
    for (let row=5;row<=16;row++) {
      const source = baseline.sources.glass[`D${row}`], other = scenario.sources.glass[`D${row}`]
      if (source?.value !== other?.value || source?.formula !== other?.formula) throw new Error(`Glass price changed between scenarios at D${row} (${profile})`)
    }
  }
  profiles.push({
    schemaVersion: '1.0', profile,
    version: `JV-ZIGZAG-${profile}-2026-10-08-${baseline.sha256.slice(0,12)}`,
    workbook: baseline.workbook, workbookSha256: baseline.sha256,
    capturedFrom: 'EXCEL_COM_VALUE2', capturedWithExcel: baseline.excelVersion, currency: 'RUB',
    settings: Object.fromEntries(['D3','L7','L8','L9','L10','L11','P19','L17','L21'].map((cell) => [cell, String(baseline.sources.settings[cell].value)])),
    serviceRates: Object.fromEntries(['C6','C8','C9','C13','C19','C23','C24','C25'].map((cell) => [cell, { value: String(baseline.sources.assemblyInstall[cell].value), sourceCell: `'Прайс-сб+монт'!${cell}`, sourceLiteral: baseline.sources.assemblyInstall[cell].formula }])),
    lineCostRates: Object.fromEntries([5,6,7,8,9,10,39,40].map((row) => [`G${row}`, { value: String(baseline.catalog[`G${row}`].value), sourceCell: `'Прайс-Line'!G${row}`, sourceLiteral: baseline.catalog[`G${row}`].formula }])),
    glassRates: Array.from({length:12},(_,index)=>{const row=index+5;const cell=baseline.sources.glass[`D${row}`];return {selector:index+1,price:String(cell.value),sourceCell:`'Прайс-Стекло'!D${row}`,sourceLiteral:cell.formula}}),
    entries,
  })
}
await writeFile(outputPath, `${JSON.stringify({ schemaVersion: '1.0', sources: profiles }, null, 2)}\n`, 'utf8')
console.log(`Wrote ${profiles.length} verified Zigzag price snapshots to ${outputPath}`)
