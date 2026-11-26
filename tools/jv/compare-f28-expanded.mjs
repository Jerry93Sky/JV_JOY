import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { prepareExpandedScenarios } from './prepare-f28-expanded.mjs'

const candidate = '74c9ead01616fbbcb88970b4bda838b6d01c6b2f'
const [engineDirectory, capturePath, reportPath] = process.argv.slice(2)
if (!engineDirectory || !capturePath || !reportPath) {
  throw new Error('Usage: node --experimental-strip-types tools/jv/compare-f28-expanded.mjs ENGINE_DIRECTORY CAPTURE REPORT')
}
const git = (...args) => execFileSync('git', ['-C', engineDirectory, ...args], { encoding: 'utf8' }).trim()
if (git('rev-parse', 'HEAD') !== candidate || git('status', '--porcelain', '--untracked-files=no')) {
  throw new Error('Use a clean checkout of published PR #24 at ' + candidate)
}
const importCandidate = file => import(pathToFileURL(path.resolve(engineDirectory, file)).href)
const { calculateJVOrder } = await importCandidate('packages/shared/src/jv/unified-order.ts')
const { compareCapturedPrice } = await importCandidate('tools/jv/transport-3-parity.mjs')
const captures = JSON.parse(await readFile(capturePath))
const nativeErrors = new Map([[2000, '#NULL!'], [2007, '#DIV/0!'], [2015, '#VALUE!'],
  [2023, '#REF!'], [2029, '#NAME?'], [2036, '#NUM!'], [2042, '#N/A'], [2043, '#GETTING_DATA']])
for (const capture of captures) {
  for (const cell of Object.values(capture.outputs)) {
    if (!cell.errorType && cell.text.startsWith('#') && Number.isInteger(cell.value2)) {
      cell.errorType = nativeErrors.get(cell.value2 + 2146828288) ?? null
    }
  }
}
const scenarios = prepareExpandedScenarios()
if (captures.length !== scenarios.length || new Set(captures.map(c => c.scenarioId)).size !== scenarios.length) {
  throw new Error('Expected one capture per scenario')
}

const rulesForFamily = {
  LINE: {
    Q52: 'aggregateLineQ52MaterialSubtotal', Q53: 'calculateLinePaint',
    Q54: 'calculateLineGlass', Q55: 'JV.LINE.WORK.Q55_ASSEMBLY_MILLING',
    Q56: 'JV.LINE.COMMERCIAL.Q56', Q57: 'JV.LINE.WORK.Q57_INSTALLATION', Q58: 'JV.LINE.COMMERCIAL.Q58',
  },
  ZIGZAG: {
    P38: 'calculateZigzagMaterialCost', P39: 'calculateZigzagP39',
    P40: 'calculateZigzagP40', P41: 'calculateZigzagP41',
    P42: 'calculateZigzagCommercialPrice', P43: 'calculateZigzagP43', P44: 'calculateZigzagCommercialPrice',
  },
  FRONT: {
    I23: 'calculateFront', S33: 'JV.FRONT.PRICE.S33', S34: 'JV.FRONT.WORK.S34', S35: 'JV.FRONT.GLASS.S35',
    S36: 'JV.FRONT.COMMERCIAL.S36', S37: 'JV.FRONT.WORK.S37', S38: 'JV.FRONT.COMMERCIAL.S38',
  },
}

function detailedValues(position) {
  const result = position.calculation
  if (position.family === 'LINE') {
    return {
      Q52: result.materialSubtotal.supportedSubtotal, Q53: result.paint.q53,
      Q54: result.glass.surcharge, Q55: result.work.assemblyAndMilling,
      Q56: result.commercial.q56, Q57: result.work.installation, Q58: result.commercial.q58,
    }
  }
  if (position.family === 'ZIGZAG') return result.costs ?? {}
  return {
    I23: 'НЕТ', S33: result.s33, S34: result.works.painting, S35: result.glass.treatmentAmount,
    S36: result.s36, S37: result.s37, S38: result.s38,
  }
}

const cases = []
for (const scenario of scenarios) {
  const capture = captures.find(row => row.scenarioId === scenario.scenarioId)
  if (!capture || capture.profile !== scenario.profile || capture.sourceSha256 !== scenario.sourceSha256
      || capture.excelVersion !== '16.0' || capture.calculationMode !== 'CalculateFullRebuild') {
    throw new Error('Unexpected independent source: ' + scenario.scenarioId)
  }
  for (const [refs, records, derived] of [
    [scenario.primaryInputWrites, capture.inputs, false], [scenario.derivedInputs, capture.derived, true],
  ]) {
    if (Object.keys(records).length !== refs.length) throw new Error('Unexpected input count')
    for (const ref of refs) {
      const address = ref.sheet + '!' + ref.address
      const actual = records[address]
      if (!actual || !Object.is(actual.value2, ref.value) || actual.errorType
          || Boolean(actual.formula) !== derived || actual.isBlank !== (ref.value === null)) {
        throw new Error(scenario.scenarioId + ' source input mismatch: ' + address + ' ' + JSON.stringify(actual))
      }
    }
  }
  const input = scenario.engineInput
  if (scenario.b26 !== null) {
    input.frontSlot7B26 = {
      schemaVersion: '1.0', sourceCell: 'Главная!B26', workbook: scenario.workbook,
      workbookSha256: scenario.sourceSha256, value: scenario.b26,
      version: 'JV-PR13E-B26-SCENARIO-1', sourceScenarioId: scenario.scenarioId,
    }
  }
  let result, engineError
  try {
    result = calculateJVOrder(input)
  } catch (error) {
    if (!error.code) throw error
    engineError = { code: error.code, message: error.message }
  }
  if (result?.status === 'PARTIAL' && result.totalSalePrice !== undefined) {
    throw new Error('PARTIAL published a total: ' + scenario.scenarioId)
  }

  const values = new Map([['Главная!AA18', { engine: result?.totalSalePrice, rule: 'JV.UNIFIED.MAIN.AA18' }]])
  for (const position of input.positions) {
    const prefix = { LINE: 'L', ZIGZAG: 'Z', FRONT: 'F' }[position.family]
    const match = result?.positions.find(p => p.slot === position.slot)
    const cells = match ? detailedValues(match) : {}
    for (const [cell, rule] of Object.entries(rulesForFamily[position.family])) {
      const engine = cell === 'I23' && engineError?.code === 'INVALID_CONFIGURATION'
        && engineError.message.includes('I23=ОШИБКА!') ? 'ОШИБКА!' : cells[cell]
      values.set(prefix + position.slot + '!' + cell, { engine, rule })
    }
    const aa = 'AA' + (10 + position.slot)
    const transfer = result?.trace.find(step => step.result?.extendedPrice && step.source?.sheet === 'Главная'
      && (step.source.cell === aa || step.source.cell?.endsWith(':' + aa)))
    values.set('Главная!' + aa, {
      engine: transfer?.result?.extendedPrice, rule: transfer?.ruleId ?? 'calculateJVOrder price transfer',
    })
  }

  const comparisons = scenario.watch.filter(ref => !ref.diagnostic).map(ref => {
    const address = ref.sheet + '!' + ref.address
    const excel = capture.outputs[address]
    const { engine, rule } = values.get(address)
    if (!excel?.formula) throw new Error('Expected captured Excel formula: ' + address)
    let status
    if (excel.errorType) status = engine === undefined ? 'UNVERIFIED' : 'MISMATCH'
    else if (typeof engine === 'string' && typeof excel.value2 === 'string') {
      status = engine === excel.value2 ? 'EXACT' : 'MISMATCH'
    } else {
      status = compareCapturedPrice(engine && typeof engine === 'object' ? engine : undefined, excel)
    }
    return { address, rule, excel, engine: engine ?? null, status }
  })
  const observedErrors = Object.entries(capture.outputs)
    .filter(([, cell]) => cell.errorType || (typeof cell.value2 === 'string' && cell.value2.startsWith('ОШИБКА')))
    .map(([address, cell]) => ({ address, errorType: cell.errorType, text: cell.text, value2: cell.value2 }))
  cases.push({
    scenarioId: scenario.scenarioId, profile: capture.profile, sourceSha256: capture.sourceSha256,
    method: 'Excel 16.0 CalculateFullRebuild, temporary copy, no macros/events',
    F28: scenario.f28, B26: scenario.b26,
    engineStatus: result?.status ?? 'REJECTED', engineError: engineError ?? null, diagnostics: result?.diagnostics ?? [],
    inputs: capture.inputs, derivedInputs: capture.derived, comparisons, observedErrors,
    observedContext: Object.fromEntries(scenario.watch.filter(ref => ref.diagnostic).map(ref => {
      const address = ref.sheet + '!' + ref.address
      return [address, capture.outputs[address]]
    })),
  })
}

const count = rows => {
  const counts = { EXACT: 0, NUMERICALLY_EQUIVALENT: 0, DISPLAY_MATCH: 0, MISMATCH: 0, UNVERIFIED: 0 }
  for (const row of rows) counts[row.status]++
  return counts
}
const summary = {
  F28_3: count(cases.filter(c => c.F28 === 3).flatMap(c => c.comparisons)),
  control: count(cases.filter(c => c.F28 !== 3).flatMap(c => c.comparisons)),
}
await writeFile(reportPath, ['{"candidate":"' + candidate + '","summary":' + JSON.stringify(summary) + ',"cases":[',
  cases.map(row => JSON.stringify(row)).join(',\n'), ']}\n'].join('\n'))
console.log(JSON.stringify(summary))
for (const c of cases) {
  console.log(c.scenarioId, c.engineStatus, JSON.stringify(count(c.comparisons)),
    c.engineError?.message ?? c.comparisons.filter(r => r.status === 'MISMATCH').map(r => r.address).join(','))
}
