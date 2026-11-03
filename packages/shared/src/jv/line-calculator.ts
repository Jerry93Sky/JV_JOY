import type { DecimalString } from './types.ts'
import { decimalString } from './decimal.ts'
import { EngineError } from './errors.ts'
import { buildLineMaterialBom } from './bom-line.ts'
import { buildLineAdditionalBom } from './additional-line.ts'
import { calculateLineGeometryAndCuts } from './geometry/cutting.ts'
import { calculateLineSashProfileLengths } from './geometry/sash-cutting.ts'
import { calculateLineParkingComponents } from './geometry/parking-components.ts'
import { calculateLineMaterialCost, calculateLineAdditionalMaterialCost, aggregateLineQ52MaterialSubtotal, type LinePriceSnapshot } from './pricing-line.ts'
import { calculateLineWorkCosts } from './line-work-cost.ts'

export interface LineEngineInputs {
  readonly constructionId: string
  readonly profile: 'COMPLETATION'|'RETAIL'
  readonly workbook: 'JV-комплектация 08.10.2026.xlsm'|'JV-розница 08.10.2026.xlsm'
  readonly widthMm: DecimalString // L1!D3
  readonly heightMm: DecimalString // L1!D4
  readonly leaves: DecimalString // L1!D5
  readonly sideCount: DecimalString // L1!D6
  readonly direction: 'НАЛЕВО'|'НАПРАВО'|'ДВУХСТОР' // L1!D7
  readonly profileCount: DecimalString // L1!D8
  readonly connectorAngle: DecimalString // L1!D9
  readonly frameState: 'ДА'|'НЕТ' // L1!D15
  readonly knobState: 'ДА'|'НЕТ' // L1!D16
  readonly latchState: 'ДА'|'НЕТ' // L1!D17
  readonly weatherSealState: 'ДА'|'НЕТ' // L1!D18
  readonly floorLockState: 'ДА'|'НЕТ' // L1!D19
  readonly bottomPivotState: 'ДА'|'НЕТ' // L1!D20
  readonly specialSashEnabled: boolean // L1!C21
  readonly specialSashWidthMm: DecimalString // L1!D21
  readonly rollerAxisToEdgeMm: DecimalString // L1!D22
  readonly parkedDoorSelected: boolean // L1!C23
  readonly parkedDoorPosition: DecimalString // L1!C24
  readonly parkedDoorReuseOpening: boolean // L1!C25
  readonly parkedDoorWidthMm: DecimalString // L1!D25
  readonly assemblyEnabled: boolean // Настройки!D33
  readonly millingEnabled: boolean // Настройки!L3
  readonly installationEnabled: boolean // Настройки!D34
}

/** Exact source cells from the workbook settings; these are versioned input data, not UI defaults. */
export interface LineEngineSettings {
  readonly P2:string;readonly P3:string;readonly P4:string;readonly P5:string;readonly P6:string;readonly P7:string;readonly P8:string;readonly P9:string;readonly P10:string
  readonly P12:string;readonly P13:string;readonly P14:string;readonly P15:string;readonly P16:string;readonly P17:string;readonly L23:string;readonly D6:string;readonly D7:string;readonly D8:string;readonly L4:string;readonly L5:string;readonly L6:boolean;readonly L7:string;readonly L8:string;readonly P21:string
}
export interface LineEngineResult {
  readonly constructionId:string
  readonly profile:LineEngineInputs['profile']
  readonly status:'PARTIAL'|'COMPLETE'
  readonly geometry:ReturnType<typeof calculateLineGeometryAndCuts>
  readonly sash:ReturnType<typeof calculateLineSashProfileLengths>
  readonly parking:ReturnType<typeof calculateLineParkingComponents>
  readonly bom:ReturnType<typeof buildLineMaterialBom>
  readonly additionalBom:ReturnType<typeof buildLineAdditionalBom>
  readonly materials:ReturnType<typeof calculateLineMaterialCost>
  readonly additionalMaterials:ReturnType<typeof calculateLineAdditionalMaterialCost>
  readonly materialSubtotal:ReturnType<typeof aggregateLineQ52MaterialSubtotal>
  readonly work:ReturnType<typeof calculateLineWorkCosts>
  readonly finalPriceAvailable:false
  readonly diagnostics:readonly string[]
  readonly trace:readonly unknown[]
}

/** Public, UI-safe adapter; it orchestrates rule modules and does not expose DAG ids to forms. */
export function calculateLineConstruction(input:LineEngineInputs,settings:LineEngineSettings,snapshot:LinePriceSnapshot):LineEngineResult {
  if(input.profile!==snapshot.profile||input.workbook!==snapshot.workbook)throw new EngineError('INVALID_CONFIGURATION','Selected workbook, profile and price snapshot must match',{profile:input.profile,snapshotProfile:snapshot.profile,workbook:input.workbook,snapshotWorkbook:snapshot.workbook})
  const d=(x:string)=>decimalString(x)
  const geometry=calculateLineGeometryAndCuts({
    opening:{openingWidth:input.widthMm,leaves:input.leaves,sideCount:input.sideCount,specialSashEnabled:input.specialSashEnabled,specialSashWidth:input.specialSashWidthMm,mountingFrameState:input.frameState,unit:'mm',settings:{sideClearance:d(settings.P15),interLeafClearance:d(settings.P14),sideProfileWidth:d(settings.P4),rollerAxisToEdge:input.rollerAxisToEdgeMm}},
    parking:{parkedDoorSelected:input.parkedDoorSelected,parkedDoorPosition:input.parkedDoorPosition,settings:{edgeToSwingAxis:d(settings.P8),sashProfileWidth:d(settings.P5),sideLockHandleProjection:d(settings.P9),parkingDepthReserve:d(settings.P10),rollerAxisToEdge:input.rollerAxisToEdgeMm}},
    cuttingSettings:{carrierProfileWidth:{value:d(settings.P2),unit:'mm'},teeWidth:{value:d(settings.P6),unit:'mm'},teeProjection:{value:d(settings.P7),unit:'mm'},carrierProfileAllowance:{value:d(settings.D7),unit:'mm'}},sourceWorkbook:input.workbook,
  })
  const sash=calculateLineSashProfileLengths({workbook:input.workbook,openingWidth:input.widthMm,constructionHeight:input.heightMm,leaves:input.leaves,sides:input.sideCount,frameState:input.frameState,specialSash:input.specialSashEnabled,specialSashWidth:input.specialSashWidthMm,parkedDoorSelected:input.parkedDoorSelected,parkedDoorPosition:input.parkedDoorPosition,parkedDoorReuseOpening:input.parkedDoorReuseOpening,parkedDoorWidth:input.parkedDoorWidthMm,settings:{P3:settings.P3,P4:settings.P4,P12:settings.P12,P13:settings.P13,P14:settings.P14,P15:settings.P15,P16:settings.P16,P17:settings.P17,L23:settings.L23,D6:settings.D6}})
  const parking=calculateLineParkingComponents({workbook:input.workbook,leaves:input.leaves,sides:input.sideCount,direction:input.direction,doorState:geometry.parking.doorState,doorPosition:input.parkedDoorPosition,parkingPartCount:geometry.parking.parkingPartCount,knobState:input.knobState,latchState:input.latchState,bottomPivotState:input.bottomPivotState})
  const bom=buildLineMaterialBom({constructionId:input.constructionId,cutting:geometry.cutting,configuration:{leaves:input.leaves,sideCount:input.sideCount,connectorAngle:input.connectorAngle,direction:input.direction,mountingFrameState:input.frameState,profileCount:input.profileCount,floorLockState:input.floorLockState,floorCloserState:input.bottomPivotState,constructionHeight:input.heightMm,sideProfileHeightAllowance:d(settings.P3),sideProfileCutAllowance:d(settings.D8),sashProfile:sash,brushUnitsPerRoll:d(settings.L7),brushRollLengthMm:d(settings.P21),parkingComponents:parking}})
  const materials=calculateLineMaterialCost({bom,snapshot})
  const additionalBom=buildLineAdditionalBom({constructionId:`${input.constructionId}:EXTRA`,sourceWorkbook:input.workbook,baseQuantities:Object.fromEntries(bom.lines.filter(x=>['L1!O5','L1!O6','L1!O7','L1!O8'].includes(x.sourceCell)).map(x=>[x.sourceCell.slice(-2),x.quantity.value])),width:input.widthMm,leaves:input.leaves,sideCount:input.sideCount,profileCount:input.profileCount,connectorAngle:input.connectorAngle,frameState:input.frameState,weatherSealState:input.weatherSealState,settings:{L4:settings.L4,L5:settings.L5,L6:settings.L6,L7:settings.L7,L8:settings.L8,P21:settings.P21}})
  // AA-110/120 require construction-specific glue factors from the separate glue selection graph.
  // Keep their quantities visible and explicitly exclude their unpriced amounts until that graph is supplied.
  const pricedLines=additionalBom.lines.filter(x=>x.sku!=='AA-110'&&x.sku!=='AA-120')
  const priceableAdditional={...additionalBom,lines:pricedLines,unsupported:[...additionalBom.unsupported,...additionalBom.lines.filter(x=>x.sku==='AA-110'||x.sku==='AA-120').map(x=>({sourceL1Row:x.sourceL1Row,sku:x.sku,sourceCell:x.sourceCell,reason:'MISSING_INPUT' as const}))]}
  const additionalMaterials=calculateLineAdditionalMaterialCost({bom:priceableAdditional,profile:input.profile,snapshot})
  const materialSubtotal=aggregateLineQ52MaterialSubtotal({base:materials,additional:additionalMaterials})
  const work=calculateLineWorkCosts({workbook:input.workbook,profile:input.profile,snapshot,widthMm:input.widthMm,heightMm:input.heightMm,leaves:input.leaves,sides:input.sideCount,profileCount:input.profileCount,parkedDoorSelected:input.parkedDoorSelected,parkingPartCount:geometry.parking.parkingPartCount,assemblyEnabled:input.assemblyEnabled,millingEnabled:input.millingEnabled,installationEnabled:input.installationEnabled})
  const diagnostics=[...bom.unsupported.map(x=>`${x.sku} (${x.quantitySourceCell}): ${x.status}`),...additionalMaterials.unsupportedPositions.map(x=>`${x.sku} (${x.sourceCell}): glue factor is unavailable`),'Q53 painting, Q54 surcharge, Q56 commercial adjustment, and Q58 final guard are not part of the supported calculation.']
  return Object.freeze({constructionId:input.constructionId,profile:input.profile,status:'PARTIAL',geometry,sash,parking,bom,additionalBom,materials,additionalMaterials,materialSubtotal,work,finalPriceAvailable:false,diagnostics:Object.freeze(diagnostics),trace:Object.freeze([...geometry.trace,...sash.trace,...parking.trace,...bom.trace,...additionalBom.trace,...materials.trace,...additionalMaterials.trace,...materialSubtotal.trace,...work.trace])})
}
