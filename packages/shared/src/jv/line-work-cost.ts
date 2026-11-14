import type { PriceProfile } from './types.ts'
import { EngineError } from './errors.ts'
import { executeGraph } from './graph.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from './rational.ts'
import type { LinePriceSnapshot } from './pricing-line.ts'

export interface LineWorkCostInput {
  readonly workbook: string
  readonly profile: PriceProfile
  readonly snapshot: LinePriceSnapshot
  readonly widthMm: string // L1!D3
  readonly heightMm: string // L1!D4
  readonly leaves: string // L1!D5
  readonly sides: string // L1!D6
  readonly profileCount: string // L1!D8
  readonly parkedDoorSelected: boolean // L1!C23
  readonly parkingPartCount: string // L1!O15
  readonly assemblyEnabled: boolean // Настройки!D33
  readonly millingEnabled: boolean // Настройки!L3
  readonly installationEnabled: boolean // Настройки!D34
}
export interface LineWorkCostResult {
  readonly profile: PriceProfile
  readonly priceSnapshotVersion: string
  readonly currency: 'RUB'
  readonly assemblyAndMilling: ExactRational // L1!Q55
  readonly installation: ExactRational // L1!Q57
  readonly trace: ReturnType<typeof executeGraph>['trace']
  readonly parity: 'EXCEL_PARITY_UNVERIFIED'
}

function neededPrice(input: LineWorkCostInput, cell: string): ExactRational {
  const text = input.snapshot.additionalSources?.assemblyInstallPrices?.[cell]
  if (text == null) throw new EngineError('PRICE_NOT_FOUND', `Missing work price in 'Прайс-сб+монт'!${cell}`, { sourceCell: `'Прайс-сб+монт'!${cell}`, profile: input.profile, version: input.snapshot.version })
  return rationalFromDecimal(text)
}

/** Implements the confirmed Excel assembly/milling and installation lines Q55/Q57 only. */
export function calculateLineWorkCosts(input: LineWorkCostInput): LineWorkCostResult {
  if (input.profile !== input.snapshot.profile || input.workbook !== input.snapshot.workbook) throw new EngineError('INVALID_CONFIGURATION', 'Work-cost inputs and price snapshot must use the same workbook profile', { workbook: input.workbook, snapshotWorkbook: input.snapshot.workbook, profile: input.profile, snapshotProfile: input.snapshot.profile })
  if (!input.snapshot.additionalSources?.assemblyInstallPrices) throw new EngineError('PRICE_NOT_FOUND', 'Assembly/install price snapshot is missing', { profile: input.profile, version: input.snapshot.version })
  const values = {
    width: rationalFromDecimal(input.widthMm), height: rationalFromDecimal(input.heightMm), leaves: rationalFromDecimal(input.leaves), sides: rationalFromDecimal(input.sides), profileCount: rationalFromDecimal(input.profileCount), parkingParts: rationalFromDecimal(input.parkingPartCount),
    assemblyEnabled: input.assemblyEnabled, millingEnabled: input.millingEnabled, installationEnabled: input.installationEnabled, parkedDoorSelected: input.parkedDoorSelected,
    C5: neededPrice(input,'C5'), C8: neededPrice(input,'C8'), C9: neededPrice(input,'C9'), C10: neededPrice(input,'C10'), C11: neededPrice(input,'C11'), C12: neededPrice(input,'C12'), C19: neededPrice(input,'C19'),
  }
  const graph = executeGraph(values, [
    { id: 'JV.LINE.WORK.Q55_ASSEMBLY_MILLING', version: `JV-LINE-WORK-2026-10-08:${input.snapshot.version}`, dependsOn: ['width','parkingParts','assemblyEnabled','millingEnabled','C5','C19'], source: { workbook: input.workbook, sheet: 'L1', cell: 'Q55', formula: "=IF(Настройки!$D$33,$D$3*'Прайс-сб+монт'!$C$5/1000,0)+IF(Настройки!$L$3,$O$15*'Прайс-сб+монт'!$C$19,0)" }, execute: ({inputs: x}) => {
      let total = rationalFromDecimal('0')
      if (x.assemblyEnabled === true) total = addRational(total, divideRational(multiplyRational(x.width as ExactRational, x.C5 as ExactRational), rationalFromDecimal('1000')))
      if (x.millingEnabled === true) total = addRational(total, multiplyRational(x.parkingParts as ExactRational, x.C19 as ExactRational))
      return total
    } },
    { id: 'JV.LINE.WORK.Q57_INSTALLATION', version: `JV-LINE-WORK-2026-10-08:${input.snapshot.version}`, dependsOn: ['installationEnabled','width','height','leaves','sides','profileCount','parkedDoorSelected','C8','C9','C10','C11','C12'], source: { workbook: input.workbook, sheet: 'L1', cell: 'Q57', formula: "=IF(Настройки!$D$34,$D$3*'Прайс-сб+монт'!$C$8/1000+$D$5*$D$4*'Прайс-сб+монт'!$C$9/1000+IF($D$6=2,'Прайс-сб+монт'!$C$10)+$D$8*'Прайс-сб+монт'!$C$11+IF($C$23,'Прайс-сб+монт'!$C$12,0),0)" }, execute: ({inputs: x}) => {
      if (x.installationEnabled !== true) return rationalFromDecimal('0')
      let total = divideRational(multiplyRational(x.width as ExactRational,x.C8 as ExactRational),rationalFromDecimal('1000'))
      total = addRational(total,divideRational(multiplyRational(multiplyRational(x.leaves as ExactRational,x.height as ExactRational),x.C9 as ExactRational),rationalFromDecimal('1000')))
      if (BigInt((x.sides as ExactRational).numerator) === 2n * BigInt((x.sides as ExactRational).denominator)) total = addRational(total,x.C10 as ExactRational)
      total = addRational(total,multiplyRational(x.profileCount as ExactRational,x.C11 as ExactRational))
      if (x.parkedDoorSelected === true) total = addRational(total,x.C12 as ExactRational)
      return total
    } },
  ])
  return Object.freeze({ profile: input.profile, priceSnapshotVersion: input.snapshot.version, currency: input.snapshot.currency, assemblyAndMilling: graph.values['JV.LINE.WORK.Q55_ASSEMBLY_MILLING'] as ExactRational, installation: graph.values['JV.LINE.WORK.Q57_INSTALLATION'] as ExactRational, trace: graph.trace, parity: 'EXCEL_PARITY_UNVERIFIED' })
}
