import type { PriceProfile } from './types.ts'
import { EngineError } from './errors.ts'
import { executeGraph, type CalculationRule } from './graph.ts'
import type { LineMaterialBom } from './bom-line.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from './rational.ts'
import type { LineAdditionalBomResult } from './additional-line.ts'

export interface LinePriceRecord {
  readonly sku: string
  readonly unit: string
  readonly value: string
  readonly sourceCell: string
  readonly sourceFormula?: string
}
export interface LinePriceSnapshot {
  readonly profile: PriceProfile
  readonly currency: 'RUB'
  readonly version: string
  readonly workbook: string
  readonly workbookSha256: string
  readonly capturedFrom: 'EXCEL_COM_VALUE2'
  readonly entries: readonly LinePriceRecord[]
  readonly settings: Readonly<Record<string, string>>
  readonly additionalSources?: Readonly<{ assemblyInstallPrices?: Readonly<Record<string, string | null>> }>
}

export interface LineAdditionalCostResult {
  readonly profile: PriceProfile
  readonly currency: 'RUB'
  readonly priceSnapshotVersion: string
  readonly completeness: 'PARTIAL_SUPPORTED_POSITIONS' | 'COMPLETE_SUPPORTED_POSITIONS'
  readonly unsupportedPositions: LineAdditionalBomResult['unsupported']
  readonly positions: readonly { readonly sku: string; readonly sourceCell: string; readonly quantity: ExactRational; readonly unit: string; readonly unitPrice: ExactRational; readonly amount: ExactRational; readonly formula: string; readonly traceStepId: string }[]
  readonly supportedSubtotal: ExactRational
  readonly trace: ReturnType<typeof executeGraph>['trace']
}

export interface LineQ52MaterialAggregate {
  readonly sourceCell: 'L1!Q52'
  readonly sourceFormula: '=SUM(Q5:Q50)'
  readonly status: 'PARTIAL_SUPPORTED_POSITIONS' | 'COMPLETE'
  readonly currency: 'RUB'
  readonly profile: PriceProfile
  readonly priceSnapshotVersion: string
  readonly supportedSubtotal: ExactRational
  readonly supportedSourceCells: readonly string[]
  readonly unsupportedPositions: readonly { readonly sku: string; readonly sourceCell: string; readonly reason: string }[]
  readonly trace: ReturnType<typeof executeGraph>['trace']
  readonly parity: 'EXCEL_PARITY_UNVERIFIED'
}
export interface LineCostPosition {
  readonly sku: string
  readonly sourceCell: string
  readonly quantity: string
  readonly unit: string
  readonly unitPrice: ExactRational
  readonly amount: ExactRational
  readonly sourcePrice: { readonly workbook: string; readonly cell: string; readonly formula?: string }
  readonly traceStepId: string
}
export interface LineMaterialCostResult {
  readonly profile: PriceProfile
  readonly currency: 'RUB'
  readonly priceSnapshotVersion: string
  readonly completeness: 'PARTIAL_SUPPORTED_POSITIONS' | 'COMPLETE_SUPPORTED_BOM'
  readonly unsupportedPositions: readonly { readonly sku: string; readonly sourceCell: string; readonly reason: 'QUANTITY_RULE_NOT_IMPLEMENTED' }[]
  readonly positions: readonly LineCostPosition[]
  readonly supportedSubtotal: ExactRational
  readonly trace: ReturnType<typeof executeGraph>['trace']
  readonly parity: 'EXCEL_PARITY_UNVERIFIED'
}

const PRICE_RULE_VERSION = 'JV-LINE-PRICE-RULES-2026-10-08'
function formulaFor(lineRow: number): { formula: string; divisor?: string } {
  if (lineRow >= 5 && lineRow <= 8) return { formula: `='Прайс-Line'!$E${lineRow}/Настройки!$D$2`, divisor: 'D2' }
  if (lineRow === 44) return { formula: `='Прайс-Line'!$E45/Настройки!$L$7`, divisor: 'L7' }
  const catalogRow = lineRow <= 25 ? lineRow : lineRow + 1
  return { formula: `='Прайс-Line'!$E${catalogRow}` }
}
function lineRowOf(sourceCell: string): number {
  const match = /^L1!O(\d+)$/.exec(sourceCell)
  if (!match) throw new EngineError('RULE_UNCONFIRMED', `Unexpected BOM source cell: ${sourceCell}`, { sourceCell })
  return Number(match[1])
}

/** Calculates material amounts for available BOM rows. Non-terminating prices remain exact rationals. */
export function calculateLineMaterialCost(input: { readonly bom: LineMaterialBom; readonly snapshot: LinePriceSnapshot }): LineMaterialCostResult {
  const { bom, snapshot } = input
  if (snapshot.workbook !== bom.lines[0]?.sourceWorkbook) throw new EngineError('INVALID_CONFIGURATION', 'BOM workbook and price snapshot workbook must match', { bomWorkbook: bom.lines[0]?.sourceWorkbook, priceWorkbook: snapshot.workbook })
  const records = new Map(snapshot.entries.map((entry) => [entry.sku, entry]))
  const inputValues: Record<string, unknown> = {}
  const rules: CalculationRule[] = []
  const stepBySku = new Map<string, string>()
  for (const line of bom.lines) {
    const record = records.get(line.sku)
    if (!record) throw new EngineError('PRICE_NOT_FOUND', `No ${snapshot.profile} price for ${line.sku}`, { sku: line.sku, profile: snapshot.profile, version: snapshot.version })
    if (record.unit !== line.unit) throw new EngineError('UNIT_MISMATCH', `Price unit differs for ${line.sku}`, { sku: line.sku, materialUnit: line.unit, priceUnit: record.unit, priceCell: record.sourceCell })
    const sourceRow = lineRowOf(line.sourceCell)
    const catalogRow = sourceRow <= 25 ? sourceRow : sourceRow + 1
    const rule = formulaFor(sourceRow)
    const stepId = `JV.LINE.COST.${line.sku}`
    stepBySku.set(line.sku, stepId)
    inputValues[`${stepId}.price`] = record.value
    inputValues[`${stepId}.quantity`] = line.quantity.value
    if (rule.divisor) {
      const divisor = snapshot.settings[rule.divisor]
      if (!divisor) throw new EngineError('MISSING_INPUT', `Missing price coefficient Настройки!${rule.divisor}`, { sku: line.sku, sourceCell: `Настройки!${rule.divisor}` })
      inputValues[`${stepId}.divisor`] = divisor
    }
    rules.push({
      id: stepId,
      version: `${PRICE_RULE_VERSION}:${snapshot.version}`,
      dependsOn: [`${stepId}.price`, `${stepId}.quantity`, ...(rule.divisor ? [`${stepId}.divisor`] : [])],
      source: { workbook: snapshot.workbook, sheet: 'L1', cell: `P${sourceRow}`, formula: rule.formula },
      execute: ({ inputs: values }) => {
        const price = rationalFromDecimal(values[`${stepId}.price`] as string)
        const unitPrice = rule.divisor ? divideRational(price, rationalFromDecimal(values[`${stepId}.divisor`] as string)) : price
        return multiplyRational(unitPrice, rationalFromDecimal(values[`${stepId}.quantity`] as string))
      },
    })
    // Keep the catalog mapping explicit even for skipped Excel catalog row 26.
    if (records.get(line.sku)?.sourceCell !== `'Прайс-Line'!E${catalogRow}`) {
      throw new EngineError('RULE_UNCONFIRMED', `Price source row does not match catalog row for ${line.sku}`, { sku: line.sku, expected: `'Прайс-Line'!E${catalogRow}`, actual: record.sourceCell })
    }
  }
  const graph = executeGraph(inputValues, rules)
  let subtotal: ExactRational = rationalFromDecimal('0')
  const positions: LineCostPosition[] = bom.lines.map((line) => {
    const record = records.get(line.sku)!
    const sourceRow = lineRowOf(line.sourceCell)
    const rule = formulaFor(sourceRow)
    const unitPrice = rule.divisor ? divideRational(rationalFromDecimal(record.value), rationalFromDecimal(snapshot.settings[rule.divisor]!)) : rationalFromDecimal(record.value)
    const amount = graph.values[stepBySku.get(line.sku)!] as ExactRational
    subtotal = addRational(subtotal, amount)
    return Object.freeze({ sku: line.sku, sourceCell: line.sourceCell, quantity: line.quantity.value, unit: line.unit, unitPrice, amount, sourcePrice: Object.freeze({ workbook: snapshot.workbook, cell: record.sourceCell, ...(record.sourceFormula ? { formula: record.sourceFormula } : {}) }), traceStepId: stepBySku.get(line.sku)! })
  })
  return Object.freeze({ profile: snapshot.profile, currency: snapshot.currency, priceSnapshotVersion: snapshot.version, completeness: bom.status === 'COMPLETE' ? 'COMPLETE_SUPPORTED_BOM' : 'PARTIAL_SUPPORTED_POSITIONS', unsupportedPositions: Object.freeze(bom.unsupported.map((line) => Object.freeze({ sku: line.sku, sourceCell: line.quantitySourceCell, reason: line.status }))), positions: Object.freeze(positions), supportedSubtotal: subtotal, trace: graph.trace, parity: 'EXCEL_PARITY_UNVERIFIED' })
}

const ADDITIONAL_PRICE_RULES: Readonly<Record<string, { readonly lineRow: number; readonly catalogRow: number; readonly divisor?: string; readonly glueCell?: string; readonly formula: string; readonly amountFormula: string }>> = Object.freeze({
  'AA-020': { lineRow: 45, catalogRow: 46, divisor: 'L8', formula: "='Прайс-Line'!$E$46/Настройки!$L$8", amountFormula: '=$P$45*$O$45' },
  'AA-050': { lineRow: 46, catalogRow: 47, formula: "='Прайс-Line'!$E$47", amountFormula: '=$P$46*$O$46' },
  'AA-070': { lineRow: 47, catalogRow: 48, formula: "='Прайс-Line'!$E$48", amountFormula: '=$P$47*$O$47' },
  'AA-090': { lineRow: 48, catalogRow: 49, formula: "='Прайс-Line'!$E$49", amountFormula: '=$P$48*$O$48' },
  'AA-110': { lineRow: 49, catalogRow: 50, glueCell: 'O5', formula: "='Прайс-Line'!$E$50", amountFormula: "=$P$49*$O$49*'Клей+акт'!$O$5" },
  'AA-120': { lineRow: 50, catalogRow: 51, glueCell: 'O18', formula: "='Прайс-Line'!$E$51", amountFormula: "=$P$50*$O$50*'Клей+акт'!$O$18" },
})
export function calculateLineAdditionalMaterialCost(input: { readonly bom: LineAdditionalBomResult; readonly profile: PriceProfile; readonly snapshot: LinePriceSnapshot; readonly adhesiveFactors?: Readonly<Record<string, string>> }): LineAdditionalCostResult {
  const { bom, snapshot } = input
  if (snapshot.profile !== input.profile) throw new EngineError('INVALID_CONFIGURATION', 'Additional BOM and price profile must match', { requestedProfile: input.profile, snapshotProfile: snapshot.profile })
  const bySku = new Map(snapshot.entries.map((entry) => [entry.sku, entry]))
  const values: Record<string, unknown> = {}
  const rules: CalculationRule[] = []
  for (const line of bom.lines) {
    const rule = ADDITIONAL_PRICE_RULES[line.sku as keyof typeof ADDITIONAL_PRICE_RULES]
    if (!rule) throw new EngineError('RULE_UNCONFIRMED', `No supplementary price formula for ${line.sku}`, { sku: line.sku, sourceCell: line.sourceCell })
    const price = bySku.get(line.sku)
    if (!price) throw new EngineError('PRICE_NOT_FOUND', `No ${snapshot.profile} price for ${line.sku}`, { sku: line.sku, version: snapshot.version })
    if (price.unit !== line.unit) throw new EngineError('UNIT_MISMATCH', `Price unit differs for ${line.sku}`, { sku: line.sku, bomUnit: line.unit, priceUnit: price.unit, sourceCell: price.sourceCell })
    const priceSourceExpected = `'Прайс-Line'!E${rule.catalogRow}`
    if (price.sourceCell !== priceSourceExpected) throw new EngineError('RULE_UNCONFIRMED', `Price source mismatch for ${line.sku}`, { expected: priceSourceExpected, actual: price.sourceCell })
    const id = `JV.LINE.ADDITIONAL.COST.${line.sku}`
    values[`${id}.price`] = price.value
    values[`${id}.quantity`] = line.quantity
    const factor = rule.divisor ? snapshot.settings[rule.divisor] : undefined
    if (rule.divisor && factor === undefined) throw new EngineError('MISSING_INPUT', `Missing Настройки!${rule.divisor} for ${line.sku}`, { sourceCell: `Настройки!${rule.divisor}` })
    if (factor !== undefined) values[`${id}.divisor`] = factor
    const glueSource = rule.glueCell ? input.adhesiveFactors?.[rule.glueCell] : undefined
    if (rule.glueCell && glueSource == null) throw new EngineError('MISSING_INPUT', `Missing adhesive factor 'Клей+акт'!${rule.glueCell}`, { sourceCell: `'Клей+акт'!${rule.glueCell}`, sku: line.sku })
    const glue = glueSource == null ? undefined : glueSource
    if (glue !== undefined) values[`${id}.glue`] = glue
    rules.push({
      id,
      version: `JV-LINE-ADDITIONAL-PRICE-2026-10-08:${snapshot.version}`,
      dependsOn: [`${id}.price`, `${id}.quantity`, ...(factor === undefined ? [] : [`${id}.divisor`]), ...(glue === undefined ? [] : [`${id}.glue`])],
      source: { workbook: snapshot.workbook, sheet: 'L1', cell: `Q${rule.lineRow}`, formula: rule.amountFormula },
      execute: ({ inputs: source }) => {
        const base = multiplyRational(rationalFromDecimal(source[`${id}.price`] as string), source[`${id}.quantity`] as ExactRational)
        const unitPrice = factor === undefined ? base : divideRational(base, rationalFromDecimal(factor))
        return glue === undefined ? unitPrice : multiplyRational(unitPrice, rationalFromDecimal(glue))
      },
    })
  }
  const graph = executeGraph(values, rules)
  let subtotal = rationalFromDecimal('0')
  const positions = bom.lines.map((line) => {
    const rule = ADDITIONAL_PRICE_RULES[line.sku as keyof typeof ADDITIONAL_PRICE_RULES]
    const price = bySku.get(line.sku)!
    const factor = rule.divisor ? snapshot.settings[rule.divisor]! : undefined
    const glueSource = rule.glueCell ? input.adhesiveFactors?.[rule.glueCell] : undefined
    const glue = glueSource == null ? undefined : glueSource
    let unitPrice = rationalFromDecimal(price.value)
    if (factor !== undefined) unitPrice = divideRational(unitPrice, rationalFromDecimal(factor))
    let amount = multiplyRational(unitPrice, line.quantity)
    if (glue !== undefined) amount = multiplyRational(amount, rationalFromDecimal(glue))
    subtotal = addRational(subtotal, amount)
    return Object.freeze({ sku: line.sku, sourceCell: line.sourceCell, quantity: line.quantity, unit: line.unit, unitPrice, amount, formula: rule.amountFormula, traceStepId: `JV.LINE.ADDITIONAL.COST.${line.sku}` })
  })
  return Object.freeze({ profile: snapshot.profile, currency: snapshot.currency, priceSnapshotVersion: snapshot.version, completeness: bom.unsupported.length ? 'PARTIAL_SUPPORTED_POSITIONS' : 'COMPLETE_SUPPORTED_POSITIONS', unsupportedPositions: bom.unsupported, positions: Object.freeze(positions), supportedSubtotal: subtotal, trace: graph.trace })
}

/** Q52 partial material subtotal; never substitutes missing base/extra positions with zero. */
export function aggregateLineQ52MaterialSubtotal(input: { readonly base: LineMaterialCostResult; readonly additional: LineAdditionalCostResult }): LineQ52MaterialAggregate {
  if (input.base.profile !== input.additional.profile || input.base.priceSnapshotVersion !== input.additional.priceSnapshotVersion) {
    throw new EngineError('INVALID_CONFIGURATION', 'Q52 aggregation requires the same workbook price profile and snapshot', { baseProfile: input.base.profile, additionalProfile: input.additional.profile, baseSnapshot: input.base.priceSnapshotVersion, additionalSnapshot: input.additional.priceSnapshotVersion })
  }
  const baseCells = input.base.positions.map((position) => position.sourceCell.replace(/^L1!O/, 'L1!Q'))
  const additionalCells = input.additional.positions.map((position) => `L1!Q${Number(/O(\d+)$/.exec(position.sourceCell)?.[1])}`)
  const duplicate = [...baseCells, ...additionalCells].filter((cell, index, all) => all.indexOf(cell) !== index)
  if (duplicate.length) throw new EngineError('INVALID_CONFIGURATION', 'Q52 aggregation would double-count a line source cell', { duplicateSourceCells: duplicate })
  const graph = executeGraph({ base: input.base.supportedSubtotal, additional: input.additional.supportedSubtotal }, [{
    id: 'JV.LINE.MATERIAL.Q52_SUPPORTED_SUBTOTAL', version: 'JV-LINE-Q52-2026-10-08', dependsOn: ['base','additional'],
    source: { sheet: 'L1', cell: 'Q52', formula: '=SUM(Q5:Q50)' },
    execute: ({ inputs: values }) => addRational(values.base as ExactRational, values.additional as ExactRational),
  }])
  const result = graph.values['JV.LINE.MATERIAL.Q52_SUPPORTED_SUBTOTAL'] as ExactRational
  const unsupported = [
    ...input.base.unsupportedPositions.map((item) => ({ sku: item.sku, sourceCell: item.sourceCell, reason: item.reason })),
    ...input.additional.unsupportedPositions.map((item) => ({ sku: item.sku, sourceCell: item.sourceCell, reason: item.reason })),
  ]
  return Object.freeze({ sourceCell: 'L1!Q52', sourceFormula: '=SUM(Q5:Q50)', status: unsupported.length ? 'PARTIAL_SUPPORTED_POSITIONS' : 'COMPLETE', currency: input.base.currency, profile: input.base.profile, priceSnapshotVersion: input.base.priceSnapshotVersion, supportedSubtotal: result, supportedSourceCells: Object.freeze([...baseCells, ...additionalCells]), unsupportedPositions: Object.freeze(unsupported), trace: graph.trace, parity: 'EXCEL_PARITY_UNVERIFIED' })
}
