import { readFileSync, writeFileSync } from 'node:fs'

const fixturePath = process.argv[2] ?? 'docs/jv/fixtures/line-cutting-excel-golden.json'
const reportPath = process.argv[3] ?? 'docs/jv/LINE_MATERIAL_PARITY.json'
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
if (fixture.sourceBooks.length !== 2 || fixture.totalCases < 20 || fixture.sourceBooks.some((book) => book.cases.length < 10)) throw new Error('Expected both source workbooks and at least 10 recalculated cases per workbook')
const books = fixture.sourceBooks.map(book => {
  if (book.macrosForceDisabled !== true) throw new Error(`${book.name}: macro safety metadata missing`)
  const cases = book.cases.map(record => {
    if (record.excelMaterialPositions?.length !== 40) throw new Error(`${book.name} ${record.id}: expected 40 captured L1 material rows`)
    const supported = record.excelMaterialPositions.filter(position => ['IMPLEMENTED_LN_010','IMPLEMENTED_CONFIRMED_CONSTANT','IMPLEMENTED_RULE'].includes(position.engineStatus))
    const unsupported = record.excelMaterialPositions.filter(position => position.engineStatus === 'QUANTITY_RULE_NOT_IMPLEMENTED')
    if (supported.length !== 40 || unsupported.length !== 0) throw new Error(`${book.name} ${record.id}: expected all 40 BOM rows to be supported`)
    const ln010 = supported.find(position => position.engineStatus === 'IMPLEMENTED_LN_010')
    if (ln010.excel.sku !== 'LN-010' || ln010.excel.description !== 'Профиль несущий' || ln010.excel.unit !== 'п.м') {
      throw new Error(`${book.name} ${record.id}: Excel LN-010 identity changed`)
    }
    for (const engineLine of record.engine.bomPositions.filter(line => line.sku !== 'LN-010')) {
      const row = Number(engineLine.sourceCell.match(/O(\d+)/)?.[1])
      const position = record.excelMaterialPositions.find(item => item.sourceRow === row)
      if (!position || String(position.excel.quantity) !== engineLine.quantity || position.excel.sku !== engineLine.sku || position.excel.description !== engineLine.description || position.excel.unit !== engineLine.unit) {
        throw new Error(`${book.name} ${record.id}: implemented line ${engineLine.sku} ${engineLine.sourceCell} differs from recalculated Excel`)
      }
    }
    const diffs = record.differences
    const exact = diffs.length === 0
    let result
    if (exact) {
      if (record.engine.bomVerification !== 'EXCEL_GOLDEN_CASE_SET' || String(ln010.excel.quantity) !== record.engine.bomQuantity) {
        throw new Error(`${book.name} ${record.id}: exact BOM golden flag/quantity is inconsistent`)
      }
      result = 'EXACT_MATCH'
    } else throw new Error(`${book.name} ${record.id}: engine-to-Excel differences: ${JSON.stringify(diffs)}`)
    return { id: record.id, materialRows: 40, supportedLines: 40, unsupportedLines: 0, ln010ExcelQuantity: ln010.excel.quantity, ln010EngineQuantity: record.engine.bomQuantity, result }
  })
  return { name: book.name, sha256: book.sha256, excelVersion: book.excelVersion, macrosForceDisabled: book.macrosForceDisabled, cases }
})
const allCases = books.flatMap(book => book.cases)
const report = {
  schemaVersion: '1.0',
  generatedAt: fixture.generatedAt,
  method: 'Fresh Microsoft Excel CalculateFullRebuild on temporary copies; compare exact decimal engine output without rounding/tolerance.',
  scope: 'All 40 base BOM positions are compared for every case, including parking positions O12:O20 and O26:O27 backed by four extracted PD matrices.',
  exactMatchCases: allCases.filter(record => record.result === 'EXACT_MATCH').length,
  binaryRepresentationDifferenceCases: 0,
  books,
  conclusion: `All 40 catalog identities, units, and quantities match ${allCases.length} recalculated cases across both workbooks. This finite scenario set does not prove every possible input configuration.`,
}
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8')
process.stdout.write(`${JSON.stringify({ reportPath, exactMatchCases: report.exactMatchCases, binaryRepresentationDifferenceCases: report.binaryRepresentationDifferenceCases }, null, 2)}\n`)
