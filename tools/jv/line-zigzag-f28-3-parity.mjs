import { calculateJVOrder } from '../../packages/shared/src/jv/unified-order.ts'
import { addRational, divideRational, rationalFromDecimal } from '../../packages/shared/src/jv/rational.ts'

const bits = new DataView(new ArrayBuffer(8))
function asRational(binary64) {
  const exponent = Number((binary64 >> 52n) & 2047n)
  const fraction = binary64 & ((1n << 52n) - 1n)
  const significand = exponent === 0 ? fraction : (1n << 52n) + fraction
  const shift = (exponent === 0 ? -1022 : exponent - 1023) - 52
  return {
    numerator: (significand << BigInt(Math.max(shift, 0))).toString(),
    denominator: (1n << BigInt(Math.max(-shift, 0))).toString(),
  }
}

function compare(left, right) {
  const difference = BigInt(left.numerator) * BigInt(right.denominator)
    - BigInt(right.numerator) * BigInt(left.denominator)
  return difference === 0n ? 0 : difference > 0n ? 1 : -1
}

export function compareExcel(engine, excel) {
  if (engine === undefined || !excel || excel.errorType) return 'UNVERIFIED'
  if (typeof engine === 'string') return engine === excel.value2 ? 'EXACT' : 'MISMATCH'
  if (!Number.isFinite(excel.value2) || excel.value2 < 0 || BigInt(engine.numerator) < 0n) return 'UNVERIFIED'
  bits.setFloat64(0, Math.abs(excel.value2))
  const key = bits.getBigUint64(0)
  const rational = asRational(key)
  const order = compare(engine, rational)
  if (order === 0) return 'EXACT'
  const adjacent = key + BigInt(order)
  if (adjacent < 0x7ff0000000000000n) {
    const midpoint = divideRational(addRational(rational, asRational(adjacent)), { numerator: '2', denominator: '1' })
    const relativeToMidpoint = compare(engine, midpoint)
    if (relativeToMidpoint * order < 0 || (relativeToMidpoint === 0 && key % 2n === 0n)) {
      return 'NUMERICALLY_EQUIVALENT'
    }
  }
  const format = /^(?:# ##|#,##)?0(?:\.(0{1,6}))?$/.exec(excel.numberFormat)
  if (format) {
    const decimalPlaces = (format[1] ?? '').length
    const denominator = BigInt(engine.denominator)
    const scale = 10n ** BigInt(decimalPlaces)
    const scaled = (BigInt(engine.numerator) * scale * 2n + denominator) / (2n * denominator)
    const display = decimalPlaces
      ? (scaled / scale) + '.' + String(scaled % scale).padStart(decimalPlaces, '0')
      : String(scaled)
    if (display === excel.text.replace(/[ ,\u00a0\u202f]/g, '')) return 'DISPLAY_MATCH'
  }
  return 'MISMATCH'
}

export function evaluateMixedScenario(scenario, capture) {
  if (capture.scenarioId !== scenario.scenarioId || capture.profile !== scenario.profile
    || capture.sourceSha256 !== scenario.sourceSha256 || capture.excelVersion !== '16.0'
    || capture.calculationMode !== 'CalculateFullRebuild') throw new Error('Incorrect Excel capture provenance')
  for (const [inputs, actual, hasFormula] of [
    [scenario.primaryInputWrites, capture.inputs, false], [scenario.derivedInputs, capture.derived, true],
  ]) {
    if (inputs.length !== Object.keys(actual).length) throw new Error('Unexpected capture input count')
    for (const input of inputs) {
      const address = input.sheet + '!' + input.address
      const cell = actual[address]
      if (!cell || !Object.is(cell.value2, input.value) || cell.isBlank !== (input.value === null)
        || cell.errorType || Boolean(cell.formula) !== hasFormula) throw new Error('Incorrect Excel input ' + address)
    }
  }
  const result = calculateJVOrder(scenario.engineInput)
  if (result.status !== 'COMPLETE' || !result.confirmedLineZigzagOrder || !result.totalSalePrice) {
    throw new Error('Mixed order did not complete: ' + JSON.stringify(result.diagnostics))
  }
  const mix = result.confirmedLineZigzagOrder
  const observations = []
  const push = (address, engine, group) => {
    const excel = capture.outputs[address]
    if (!excel) throw new Error('Missing Excel output: ' + address)
    observations.push({ address, group, engine, status: compareExcel(engine, excel) })
  }
  const pushBlock = (sheet, block, group) => {
    for (const [address, value] of Object.entries(block)) push(sheet + '!' + address, value, group)
  }
  const line = mix.positions.find(position => position.family === 'LINE').lineCalculation
  const zigzag = mix.positions.find(position => position.family === 'ZIGZAG').zigzagCalculation
  for (const address of ['I25','I26','I27','D28','D29','D30','D31','D32']) {
    const step = line.trace.find(step => step.source?.sheet === 'L1' && step.source.cell === address)
    push('L1!' + address, typeof step?.result === 'string' ? rationalFromDecimal(step.result) : undefined, 'geometry')
  }
  pushBlock('Z2', zigzag.geometry.outputs, 'geometry')

  for (const item of [...line.materials.positions, ...line.additionalMaterials.positions]) {
    const row = item.sourceCell.match(/O(\d+)$/)[1]
    push('L1!O' + row, typeof item.quantity === 'string' ? rationalFromDecimal(item.quantity) : item.quantity, 'bom')
    push('L1!P' + row, item.unitPrice, 'material-price')
    push('L1!Q' + row, item.amount, 'material-price')
  }
  for (const item of zigzag.materialCost.positions) {
    push('Z2!K' + item.bomRow, item.sku, 'sku')
    push('Z2!N' + item.bomRow, item.quantity, 'bom')
    push('Z2!O' + item.bomRow, item.unitPrice, 'material-price')
    push('Z2!P' + item.bomRow, item.amount, 'material-price')
  }
  pushBlock('L1', {
    Q52: line.materialSubtotal.supportedSubtotal, Q53: line.paint.q53, Q54: line.glass.surcharge,
    Q55: line.work.assemblyAndMilling, Q56: line.commercial.q56, Q57: line.work.installation, Q58: line.commercial.q58,
  }, 'subtotal')
  pushBlock('Z2', zigzag.costs, 'subtotal')
  pushBlock('Клей+акт', {
    N12: mix.allocation.activatorPackages, N25: mix.allocation.adhesivePackages, ...mix.allocation.adhesiveFactors,
  }, 'allocation')
  for (const position of result.positions) {
    const row = 10 + position.slot
    const transfer = result.trace.find(trace =>
      trace.ruleId === 'JV.UNIFIED.MAIN.MIXED.PRICE-2026-11-08-v1' && trace.source.cell.endsWith(':AA' + row))
    push('Главная!AA' + row, transfer?.result.extendedPrice, 'order')
    const share = mix.allocation.systemAllocations.find(item => item.positionId === position.id)
    push('ПРМ!AB' + (24 + position.slot), share?.W, 'allocation')
  }
  push('Главная!AA18', result.totalSalePrice, 'order')
  return { result, observations }
}
