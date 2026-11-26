import { findUnifiedInputMismatches } from '../../packages/shared/src/jv/unified-order-input-compatibility.ts'
import { addRational, divideRational } from '../../packages/shared/src/jv/rational.ts'

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

function compareRational(left, right) {
  const difference = BigInt(left.numerator) * BigInt(right.denominator)
    - BigInt(right.numerator) * BigInt(left.denominator)
  return difference === 0n ? 0 : difference > 0n ? 1 : -1
}

function midpoint(left, right) {
  return divideRational(addRational(left, right), { numerator: '2', denominator: '1' })
}

export function compareCapturedPrice(engine, excel) {
  if (!engine || !Number.isFinite(excel?.value2) || excel.value2 < 0 || BigInt(engine.numerator) < 0n) return 'UNVERIFIED'
  bits.setFloat64(0, Math.abs(excel.value2))
  const binary64 = bits.getBigUint64(0)
  const exact = asRational(binary64)
  const order = compareRational(engine, exact)
  if (order === 0) return 'EXACT'
  const adjacent = binary64 + BigInt(order)
  if (adjacent < 0x7ff0000000000000n) {
    const relativeToMidpoint = compareRational(engine, midpoint(exact, asRational(adjacent)))
    if (relativeToMidpoint * order < 0 || (relativeToMidpoint === 0 && binary64 % 2n === 0n)) {
      return 'NUMERICALLY_EQUIVALENT'
    }
  }
  const simpleFormat = /^(?:# ##|#,##)?0(?:\.(0{1,6}))?$/.exec(excel.numberFormat)
  if (simpleFormat) {
    const decimalPlaces = (simpleFormat[1] ?? '').length
    const denominator = BigInt(engine.denominator)
    const scale = 10n ** BigInt(decimalPlaces)
    const scaled = (BigInt(engine.numerator) * scale * 2n + denominator) / (2n * denominator)
    const display = decimalPlaces
      ? (scaled / scale) + '.' + String(scaled % scale).padStart(decimalPlaces, '0')
      : String(scaled)
    const excelDisplay = excel.text.replace(/[ ,\u00a0\u202f]/g, '')
    if (display === excelDisplay) return 'DISPLAY_MATCH'
  }
  return 'MISMATCH'
}

export function verifyCapturedInputs(scenario, capture) {
  if (scenario.sourceSha256 !== capture.sourceSha256 || scenario.profile !== capture.profile
      || capture.excelVersion !== '16.0' || capture.calculationMode !== 'CalculateFullRebuild'
      || !capture.temporaryCopy || scenario.primaryInputWrites.length !== capture.inputCells.length) {
    throw new Error('Incompatible capture provenance: ' + scenario.scenarioId)
  }
  const inputs = capture.inputCells.map((captured, index) => {
    const input = scenario.primaryInputWrites[index]
    if (input.sheet !== captured.sheet || input.address !== captured.address) throw new Error('Unexpected input address')
    return { ...captured, expected: input.value }
  })
  const mismatches = findUnifiedInputMismatches(inputs)
  if (mismatches.length) throw new Error(JSON.stringify(mismatches))
}

export function transportOrderInput(scenario) {
  return {
    ...scenario.engineInput,
    frontSlot7B26: {
      schemaVersion: '1.0',
      sourceCell: 'Главная!B26',
      workbook: scenario.workbook,
      workbookSha256: scenario.sourceSha256,
      value: scenario.orderSettings.frontMainSurchargeSelector,
      version: 'JV-PR13E-B26-SCENARIO-1',
      sourceScenarioId: scenario.scenarioId,
    },
  }
}

export function transportComparisons(calculation, captured) {
  const outputs = []
  const record = (address, excel, engine) => {
    outputs.push({
      address, formula: excel.formula, value2: excel.value2, text: excel.text,
      numberFormat: excel.numberFormat, engine, status: compareCapturedPrice(engine, excel),
    })
  }
  for (const position of calculation.positions) {
    const slot = captured.slots.find(slot => slot.slot === position.slot)
    const result = position.calculation
    const source = position.family === 'LINE' ? ['Q56', 'Q58', result.commercial.q56]
      : position.family === 'ZIGZAG' ? ['P42', 'P44', result.costs?.P42]
        : position.family === 'FRONT' ? ['S36', 'S38', result.s36]
          : ['M51', 'M53', result.confirmedSubtotals.productSubtotalM51]
    const address = slot.sourceSheet + '!' + source[0]
    record(address, captured.additionalOutputs[address], source[2])
    const main = calculation.trace.find(step => step.ruleId === 'JV.UNIFIED.MAIN.PRICE-2026-11-08-v2'
      && step.source.cell === 'AA' + (10 + position.slot))
    record(slot.sourceSheet + '!' + source[1], slot.main.unitPriceSource, main?.input.sourceAmount)
    record('Главная!AA' + (10 + position.slot), slot.main.extendedPrice, main?.result.extendedPrice)
  }
  record('Главная!AA18', captured.AA18, calculation.totalSalePrice)
  return outputs
}
