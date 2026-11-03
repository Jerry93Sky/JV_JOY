import test from 'node:test'
import assert from 'node:assert/strict'
import { decimalString } from './decimal.ts'
import { buildLineMaterialBom } from './bom-line.ts'
import { LINE_MATERIAL_CATALOG } from './catalog-line.ts'
import { calculateLineCarrierProfileCuts } from './geometry/cutting.ts'
import { calculateLineSashProfileLengths } from './geometry/sash-cutting.ts'
import type { LineCarrierCuttingResult } from './geometry/cutting.ts'
import type { SpecificationLine } from './types.ts'

const workbook = 'JV-комплектация 08.10.2026.xlsm' as const
const baseConfiguration = { leaves: decimalString('5'), sideCount: decimalString('1'), direction: 'НАЛЕВО', mountingFrameState: 'ДА' }
const cutting = calculateLineCarrierProfileCuts({
  openingWidth: { value: decimalString('4000'), unit: 'mm' },
  sideCount: decimalString('1'),
  parkingDepth: { value: decimalString('369'), unit: 'mm' },
  parkingAxisWidth: { value: decimalString('691'), unit: 'mm' },
  settings: {
    carrierProfileWidth: { value: decimalString('44'), unit: 'mm' },
    teeWidth: { value: decimalString('218'), unit: 'mm' },
    teeProjection: { value: decimalString('109'), unit: 'mm' },
    carrierProfileAllowance: { value: decimalString('100'), unit: 'mm' },
  },
  sourceWorkbook: workbook,
})

test('BOM contains the previously supported rows plus seven new profile-plug rules', () => {
  const bom = buildLineMaterialBom({ constructionId: 'C-001', cutting, configuration: baseConfiguration })
  assert.equal(bom.status, 'PARTIAL')
  assert.equal(bom.lines.length, 21)
  assert.deepEqual(
    [bom.lines[0].sku, bom.lines[0].description, bom.lines[0].unit, bom.lines[0].quantity.value],
    ['LN-010', 'Профиль несущий', 'п.м', '4.877'],
  )
  assert.equal(bom.lines[0].sourceCell, 'L1!O5')
  assert.equal(bom.lines[0].sourceFormula, '=$D$32/1000+Настройки!$D$7/1000')
  assert.equal(bom.lines[0].verification, 'NOT_YET_PARITY_TESTED')
  assert.ok(bom.lines[0].traceStepIds.includes('JV.LINE.CARRIER_PROFILE_MATERIAL_QUANTITY'))
  assert.ok(bom.lines[0].traceStepIds.includes('JV.LINE.BOM.LN010'))
  assert.ok(bom.lines.every((line) => line.traceStepIds.length > 0 && bom.trace.some((step) => step.id === line.sourceTraceStepId)))
  assert.deepEqual(bom.lines.map((line) => [line.sku, line.sourceCell, line.sourceExpression, line.quantity.value]), [
    ['LN-010', 'L1!O5', '=$D$32/1000+Настройки!$D$7/1000', '4.877'],
    ['LN-050-L', 'L1!O9', '=IF(OR($D$7="НАЛЕВО",$D$6=2),1,0)', '1'],
    ['LN-050-R', 'L1!O10', '=IF(OR($D$7="НАПРАВО",$D$6=2),1,0)', '0'],
    ['LN-060', 'L1!O11', '=$D$5-$D$6', '4'],
    ['LN-140-L', 'L1!O21', '=IF(OR($D$7="НАЛЕВО",$D$6=2),1,0)', '1'],
    ['LN-140-R', 'L1!O22', '=IF(OR($D$7="НАПРАВО",$D$6=2),1,0)', '0'],
    ['LN-150', 'L1!O23', '=3*$D$6', '3'],
    ['LN-160', 'L1!O24', '=$D$6*IF($D$9=90,1,0)', '1'],
    ['LN-170', 'L1!O25', '=$D$6*IF($D$9=135,1,0)', '0'],
    ['LN-TL', 'L1!O28', '=IF($D$7="НАЛЕВО",2*$D$5-2,0)+IF(AND($D$7="ДВУХСТОР",$D$5<=3),2,0)+IF(AND($D$7="ДВУХСТОР",$D5>3),2*($D$5-2),0)', '8'],
    ['LN-TR', 'L1!O29', '=IF($D$7="НАПРАВО",2*$D$5-2,0)+IF(AND($D$7="ДВУХСТОР",$D$5=2),2,0)+IF($D$7="ДВУХСТОР",2*$D5-2-$O$28)', '0'],
    ['LN-TF', 'L1!O30', '=IF($D$15="ДА",0,2)', '0'],
    ['LN-TSL', 'L1!O31', '=IF($D$15="ДА",1,0)', '1'],
    ['LN-TSR', 'L1!O32', '=IF($D$15="ДА",1,0)', '1'],
    ['LN-BL', 'L1!O33', '=$O$28', '8'],
    ['LN-BR', 'L1!O34', '=$O$29', '0'],
    ['LN-BF', 'L1!O35', '=$O$30', '0'],
    ['LN-BSL', 'L1!O36', '=$O$31', '1'],
    ['LN-BSR', 'L1!O37', '=$O$32', '1'],
    ['LN-210', 'L1!O40', '0', '0'],
    ['LN-220', 'L1!O41', '0', '0'],
  ])
  assert.equal(bom.trace.at(-1)?.id, 'JV.LINE.BOM.LN-220.CONSTANT')
})

test('sash-profile geometry closes LN-020/LN-030 and AA-010 without a resolved F39 input', () => {
  const sashProfile = calculateLineSashProfileLengths({
    workbook, openingWidth:'4000', constructionHeight:'2500', leaves:'5', sides:'1', frameState:'ДА', specialSash:false,
    parkedDoorSelected:false, parkedDoorPosition:'2', parkedDoorReuseOpening:false,
    settings:{P3:'58',P4:'14',P12:'17',P13:'6',P14:'1',P15:'5',P16:'2',P17:'0.5',L23:'0',D6:'100'},
  })
  const bom = buildLineMaterialBom({constructionId:'SASH-001',cutting,configuration:{...baseConfiguration,profileCount:decimalString('0'),floorLockState:'НЕТ',floorCloserState:'НЕТ',constructionHeight:decimalString('2500'),sideProfileHeightAllowance:decimalString('58'),sideProfileCutAllowance:decimalString('8'),sashProfile,brushUnitsPerRoll:decimalString('0.95'),brushRollLengthMm:decimalString('1600')}})
  const bySku = new Map(bom.lines.map((line)=>[line.sku,line]))
  assert.equal(bySku.get('LN-020')?.quantity.value,'3.973')
  assert.equal(bySku.get('LN-030')?.quantity.value,'3.973')
  assert.equal(bySku.get('AA-010')?.quantity.value,'6')
  assert.equal(bom.lines.length,29)
  assert.equal(bom.unsupported.length,11)
  assert.equal(bySku.get('AA-010')?.traceStepIds.includes('JV.LINE.SASH.F39'),true)
})

test('catalog snapshot preserves 40 source rows; unsupported formulas remain explicit, not zero', () => {
  const bom = buildLineMaterialBom({ constructionId: 'C-001', cutting, configuration: baseConfiguration })
  assert.equal(LINE_MATERIAL_CATALOG.length, 40)
  assert.equal(bom.unsupported.length, 19)
  assert.ok(bom.unsupported.some((item) => item.sku === 'LN-020' && item.quantityFormula === '=$F$39/1000+Настройки!$D$6/1000'))
  assert.equal(bom.unsupported.find((item) => item.sku === 'LN-020')?.quantitySourceCell, 'L1!O6')
  assert.equal(bom.unsupported.every((item) => item.status === 'QUANTITY_RULE_NOT_IMPLEMENTED'), true)
  assert.equal(bom.unsupported.some((item) => Object.hasOwn(item, 'quantity')), false)
})

test('zero quantity is retained as a confirmed quantity, not confused with unsupported quantity', () => {
  const zeroCutting = { ...cutting, materialRequirement: { ...cutting.materialRequirement, quantity: decimalString('0') } }
  const bom = buildLineMaterialBom({ constructionId: 'C-002', cutting: zeroCutting, configuration: baseConfiguration })
  assert.equal(bom.lines.find((line) => line.sku === 'LN-010')?.quantity.value, '0')
  assert.equal(bom.lines.find((line) => line.sku === 'LN-210')?.quantity.value, '0')
  assert.equal(bom.lines.find((line) => line.sku === 'LN-220')?.quantity.value, '0')
  assert.equal(bom.unsupported[0].status, 'QUANTITY_RULE_NOT_IMPLEMENTED')
})

test('direction, leaf count, fixed 90-degree connector and frame switch follow Excel branches', () => {
  const configuration = { leaves: decimalString('5'), sideCount: decimalString('2'), direction: 'ДВУХСТОР', mountingFrameState: 'НЕТ' }
  const bom = buildLineMaterialBom({ constructionId: 'C-006', cutting, configuration })
  const value = (sku: string) => bom.lines.find((line) => line.sku === sku)?.quantity.value
  assert.equal(value('LN-050-L'), '1')
  assert.equal(value('LN-050-R'), '1')
  assert.equal(value('LN-060'), '3')
  assert.equal(value('LN-140-L'), '1')
  assert.equal(value('LN-140-R'), '1')
  assert.equal(value('LN-150'), '6')
  assert.equal(value('LN-160'), '2')
  assert.equal(value('LN-170'), '0')
  assert.equal(value('LN-TF'), '2')
  assert.equal(value('LN-TSL'), '0')
  assert.equal(value('LN-TSR'), '0')
})

test('BOM serialization and row ordering are deterministic and never aggregate separate SKUs', () => {
  const configuration = baseConfiguration
  const first = buildLineMaterialBom({ constructionId: 'C-003', cutting, configuration })
  const second = buildLineMaterialBom({ constructionId: 'C-003', cutting, configuration })
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  const contractLines: readonly SpecificationLine[] = first.lines
  assert.equal(contractLines.length, 21)
  assert.deepEqual(first.unsupported.map((item) => item.sourceL1Row), [...first.unsupported.map((item) => item.sourceL1Row)].sort((a, b) => a - b))
  assert.equal(new Set(LINE_MATERIAL_CATALOG.map((item) => item.sku)).size, LINE_MATERIAL_CATALOG.length)
})

test('conditional 90-degree caps, floor lock and floor closer require their real Excel inputs', () => {
  const configuration = { ...baseConfiguration, sideCount: decimalString('2'), profileCount: decimalString('3'), floorLockState: 'ДА', floorCloserState: 'ДА' }
  const bom = buildLineMaterialBom({ constructionId: 'C-007', cutting, configuration })
  const value = (sku: string) => bom.lines.find((line) => line.sku === sku)?.quantity.value
  assert.equal(value('LN-T90'), '3')
  assert.equal(value('LN-B90'), '3')
  assert.equal(value('LN-230'), '1')
  assert.equal(value('LN-240'), '2')
  assert.equal(bom.lines.length, 25)
  assert.equal(bom.unsupported.length, 15)
})

test('LN-040 side-profile material uses the traced L1!D33 geometry and confirmed settings cells', () => {
  const configuration = { ...baseConfiguration, constructionHeight: decimalString('2500'), sideProfileHeightAllowance: decimalString('58'), sideProfileCutAllowance: decimalString('50') }
  const bom = buildLineMaterialBom({ constructionId: 'C-008', cutting, configuration })
  const line = bom.lines.find((item) => item.sku === 'LN-040')!
  assert.equal(line.quantity.value, '4.934')
  assert.equal(line.sourceCell, 'L1!O8')
  assert.equal(line.sourceFormula, '=IF($D$15="ДА", 2*$D$33/1000+Настройки!$D$8/1000, 0)')
  assert.ok(line.traceStepIds.includes('JV.LINE.SIDE_PROFILE_CUT_LENGTH'))
  assert.equal(bom.trace.find((step) => step.id === 'JV.LINE.SIDE_PROFILE_CUT_LENGTH')?.source?.cell, 'D33')
})

test('BOM rejects an unrecognized SKU, incompatible unit, and unsupported workbook instead of substituting', () => {
  const configuration = baseConfiguration
  assert.throws(() => buildLineMaterialBom({ constructionId: 'C-004', cutting: { ...cutting, materialRequirement: { ...cutting.materialRequirement, catalogCode: 'LN-999' } } as LineCarrierCuttingResult, configuration }), (error: any) => error.code === 'LOOKUP_NOT_FOUND')
  assert.throws(() => buildLineMaterialBom({ constructionId: 'C-004', cutting: { ...cutting, materialRequirement: { ...cutting.materialRequirement, catalogUnit: 'шт.' } } as LineCarrierCuttingResult, configuration }), (error: any) => error.code === 'UNIT_MISMATCH')
  assert.throws(() => buildLineMaterialBom({ constructionId: 'C-004', cutting: { ...cutting, materialRequirement: { ...cutting.materialRequirement, catalogSource: { ...cutting.materialRequirement.catalogSource, workbook: 'unknown.xlsm' } } } as unknown as LineCarrierCuttingResult, configuration }), (error: any) => error.code === 'INVALID_CONFIGURATION')
  assert.throws(() => buildLineMaterialBom({ constructionId: ' ', cutting, configuration }), (error: any) => error.code === 'INVALID_CONFIGURATION')
  assert.throws(() => buildLineMaterialBom({ constructionId: 'C-004', cutting, configuration: { ...configuration, leaves: 'НЕТ' as never } }), (error: any) => error.code === 'INVALID_CONFIGURATION')
})

test('runtime BOM never self-certifies Excel parity without a case-specific comparison record', () => {
  const bom = buildLineMaterialBom({ constructionId: 'C-005', cutting, configuration: baseConfiguration })
  assert.ok(bom.lines.every((line) => line.verification === 'NOT_YET_PARITY_TESTED'))
  assert.equal(bom.parity, 'EXCEL_PARITY_UNVERIFIED')
})
