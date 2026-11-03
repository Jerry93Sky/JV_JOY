import type { DecimalString } from './types.ts'
import { addDecimal, compareDecimal, decimalString, divideDecimalTruncateToInteger } from './decimal.ts'
import { EngineError } from './errors.ts'
import { buildLineMaterialBom } from './bom-line.ts'
import { buildLineAdditionalBom } from './additional-line.ts'
import { calculateLineGeometryAndCuts } from './geometry/cutting.ts'
import { calculateLineSashProfileLengths } from './geometry/sash-cutting.ts'
import { calculateLineParkingComponents } from './geometry/parking-components.ts'
import { calculateLineMaterialCost, calculateLineAdditionalMaterialCost, aggregateLineQ52MaterialSubtotal, type LinePriceSnapshot } from './pricing-line.ts'
import { calculateLineWorkCosts } from './line-work-cost.ts'
import { calculateLineAdhesiveFactors } from './adhesive-line.ts'
import { rationalFromDecimal } from './rational.ts'
import { calculateLineGlass, type LineGlassPriceSnapshot } from './glass-line.ts'
import { calculateLinePaint, type LinePaintPriceSnapshot } from './paint-line.ts'
import { calculateLineCommercial } from './commercial-line.ts'

export interface LineEngineInputs {
  readonly constructionId: string
  readonly constructionQuantity: DecimalString // Главная!Z11; standalone JV-Line quote quantity
  readonly glassSelectionIndex: number // Главная!I11 -> L1!C11
  readonly finishSelectionIndex: number // Главная!H11 -> L1!C10
  readonly commercialModeIndex: number // Главная!F28
  readonly profile: 'COMPLETATION'|'RETAIL'
  readonly workbook: 'JV-комплектация 08.10.2026.xlsm'|'JV-розница 08.10.2026.xlsm'
  readonly widthMm: DecimalString // L1!D3
  readonly heightMm: DecimalString // L1!D4
  readonly leaves: DecimalString // L1!D5
  /** Optional raw Главная!L11 selector. When supplied, apply its sourced =CEILING(L11,1) formula before L1!D5 consumers. */
  readonly mainLeavesSelector?: DecimalString
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
  readonly P12:string;readonly P13:string;readonly P14:string;readonly P15:string;readonly P16:string;readonly P17:string;readonly L23:string;readonly D6:string;readonly D7:string;readonly D8:string;readonly L4:string;readonly L5:string;readonly L6:boolean;readonly L7:string;readonly L8:string;readonly P21:string;readonly P19:string;readonly L17:string;readonly L18:string;readonly L21:boolean;readonly L22:string;readonly D32:boolean
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
  readonly adhesiveFactors:ReturnType<typeof calculateLineAdhesiveFactors>
  readonly glass:ReturnType<typeof calculateLineGlass>
  readonly paint:ReturnType<typeof calculateLinePaint>
  readonly commercial:ReturnType<typeof calculateLineCommercial>
  readonly finalPriceAvailable:boolean
  readonly diagnostics:readonly string[]
  readonly trace:readonly unknown[]
}

/** Public, UI-safe adapter; it orchestrates rule modules and does not expose DAG ids to forms. */
export function calculateLineConstruction(input:LineEngineInputs,settings:LineEngineSettings,snapshot:LinePriceSnapshot,glassSnapshot:LineGlassPriceSnapshot,paintSnapshot:LinePaintPriceSnapshot):LineEngineResult {
  if(input.profile!==snapshot.profile||input.workbook!==snapshot.workbook)throw new EngineError('INVALID_CONFIGURATION','Selected workbook, profile and price snapshot must match',{profile:input.profile,snapshotProfile:snapshot.profile,workbook:input.workbook,snapshotWorkbook:snapshot.workbook})
  const d=(x:string)=>decimalString(x)
  const wholeLeaves=input.mainLeavesSelector===undefined?input.leaves:(()=>{const source=d(input.mainLeavesSelector),integer=divideDecimalTruncateToInteger(source,d('1'));return compareDecimal(source,integer)>0?addDecimal(integer,d('1')):integer})()
  const geometry=calculateLineGeometryAndCuts({
    opening:{openingWidth:input.widthMm,leaves:wholeLeaves,sideCount:input.sideCount,specialSashEnabled:input.specialSashEnabled,specialSashWidth:input.specialSashWidthMm,mountingFrameState:input.frameState,unit:'mm',settings:{sideClearance:d(settings.P15),interLeafClearance:d(settings.P14),sideProfileWidth:d(settings.P4),rollerAxisToEdge:input.rollerAxisToEdgeMm}},
    parking:{parkedDoorSelected:input.parkedDoorSelected,parkedDoorPosition:input.parkedDoorPosition,settings:{edgeToSwingAxis:d(settings.P8),sashProfileWidth:d(settings.P5),sideLockHandleProjection:d(settings.P9),parkingDepthReserve:d(settings.P10),rollerAxisToEdge:input.rollerAxisToEdgeMm}},
    cuttingSettings:{carrierProfileWidth:{value:d(settings.P2),unit:'mm'},teeWidth:{value:d(settings.P6),unit:'mm'},teeProjection:{value:d(settings.P7),unit:'mm'},carrierProfileAllowance:{value:d(settings.D7),unit:'mm'}},sourceWorkbook:input.workbook,
  })
  const sash=calculateLineSashProfileLengths({workbook:input.workbook,openingWidth:input.widthMm,constructionHeight:input.heightMm,leaves:wholeLeaves,sides:input.sideCount,frameState:input.frameState,specialSash:input.specialSashEnabled,specialSashWidth:input.specialSashWidthMm,parkedDoorSelected:input.parkedDoorSelected,parkedDoorPosition:input.parkedDoorPosition,parkedDoorReuseOpening:input.parkedDoorReuseOpening,parkedDoorWidth:input.parkedDoorWidthMm,settings:{P3:settings.P3,P4:settings.P4,P12:settings.P12,P13:settings.P13,P14:settings.P14,P15:settings.P15,P16:settings.P16,P17:settings.P17,L23:settings.L23,D6:settings.D6}})
  const parking=calculateLineParkingComponents({workbook:input.workbook,leaves:wholeLeaves,sides:input.sideCount,direction:input.direction,doorState:geometry.parking.doorState,doorPosition:input.parkedDoorPosition,parkingPartCount:geometry.parking.parkingPartCount,knobState:input.knobState,latchState:input.latchState,bottomPivotState:input.bottomPivotState})
  const bom=buildLineMaterialBom({constructionId:input.constructionId,cutting:geometry.cutting,configuration:{leaves:wholeLeaves,sideCount:input.sideCount,connectorAngle:input.connectorAngle,direction:input.direction,mountingFrameState:input.frameState,profileCount:input.profileCount,floorLockState:input.floorLockState,floorCloserState:input.bottomPivotState,constructionHeight:input.heightMm,sideProfileHeightAllowance:d(settings.P3),sideProfileCutAllowance:d(settings.D8),sashProfile:sash,brushUnitsPerRoll:d(settings.L7),brushRollLengthMm:d(settings.P21),parkingComponents:parking}})
  const materials=calculateLineMaterialCost({bom,snapshot})
  const additionalBom=buildLineAdditionalBom({constructionId:`${input.constructionId}:EXTRA`,sourceWorkbook:input.workbook,baseQuantities:Object.fromEntries(bom.lines.filter(x=>['L1!O5','L1!O6','L1!O7','L1!O8'].includes(x.sourceCell)).map(x=>[x.sourceCell.slice(-2),x.quantity.value])),width:input.widthMm,leaves:wholeLeaves,sideCount:input.sideCount,profileCount:input.profileCount,connectorAngle:input.connectorAngle,frameState:input.frameState,weatherSealState:input.weatherSealState,settings:{L4:settings.L4,L5:settings.L5,L6:settings.L6,L7:settings.L7,L8:settings.L8,P21:settings.P21}})
  const quantityBySku=new Map(additionalBom.lines.map(line=>[line.sku,line.quantity]))
  const adhesiveFactors=calculateLineAdhesiveFactors({activatorQuantityPerConstruction:quantityBySku.get('AA-110')!,adhesiveQuantityPerConstruction:quantityBySku.get('AA-120')!,constructionQuantity:rationalFromDecimal(input.constructionQuantity),workbook:input.workbook})
  const additionalMaterials=calculateLineAdditionalMaterialCost({bom:additionalBom,profile:input.profile,snapshot,adhesiveFactors:{O5:adhesiveFactors.O5,O18:adhesiveFactors.O18}})
  const glass=calculateLineGlass({workbook:input.workbook,profile:input.profile,heightMm:input.heightMm,constructionQuantity:input.constructionQuantity,glassSelectionIndex:input.glassSelectionIndex,sash:sash.intermediates,priceSnapshot:glassSnapshot,settings:{P19:settings.P19,L17:settings.L17,L18:settings.L18,L21:settings.L21,L22:settings.L22,D32:settings.D32},fixedChargePrice:snapshot.additionalSources?.assemblyInstallPrices?.C23 ?? (()=>{throw new EngineError('PRICE_NOT_FOUND',"Missing fixed glass charge 'Прайс-сб+монт'!C23")})()})
  const paint=calculateLinePaint({workbook:input.workbook,profile:input.profile,finishIndex:input.finishSelectionIndex,bom,systemAllocationFactor:glass.systemAllocationFactor,priceSnapshot:paintSnapshot})
  const materialSubtotal=aggregateLineQ52MaterialSubtotal({base:materials,additional:additionalMaterials})
  const work=calculateLineWorkCosts({workbook:input.workbook,profile:input.profile,snapshot,widthMm:input.widthMm,heightMm:input.heightMm,leaves:wholeLeaves,sides:input.sideCount,profileCount:input.profileCount,parkedDoorSelected:input.parkedDoorSelected,parkingPartCount:geometry.parking.parkingPartCount,assemblyEnabled:input.assemblyEnabled,millingEnabled:input.millingEnabled,installationEnabled:input.installationEnabled})
  const c25=snapshot.additionalSources?.assemblyInstallPrices?.C25
  if(c25==null)throw new EngineError('PRICE_NOT_FOUND',"Missing commercial adjustment price 'Прайс-сб+монт'!C25")
  const commercial=calculateLineCommercial({workbook:input.workbook,q52:materialSubtotal.supportedSubtotal,q53:paint.q53,q54:glass.surcharge,q55:work.assemblyAndMilling,q57:work.installation,sideCount:input.sideCount,direction:input.direction,commercialModeIndex:input.commercialModeIndex,priceC25:c25,systemAllocationFactor:glass.systemAllocationFactor,componentsComplete:bom.status==='COMPLETE'&&additionalMaterials.completeness==='COMPLETE_SUPPORTED_POSITIONS'&&materialSubtotal.status==='COMPLETE'})
  const diagnostics=[...bom.unsupported.map(x=>`${x.sku} (${x.quantitySourceCell}): ${x.status}`),...additionalMaterials.unsupportedPositions.map(x=>`${x.sku} (${x.sourceCell}): ${x.reason}`),...(!commercial.finalPriceAvailable?['Q58 is not a publishable final price because an upstream component is incomplete or the Excel guard returned an error.']:[])]
  const leafSelectorTrace=input.mainLeavesSelector===undefined?[]:[Object.freeze({id:'JV.LINE.LEAF_SELECTOR_CEILING',kind:'input' as const,label:'Нормализация количества створок Главная!L11 -> L1!D5',inputRefs:['Главная!L11'],ruleId:'JV.LINE.MAIN_LEAVES_CEILING',source:{workbook:input.workbook,sheet:'Главная',cell:'M11',formula:'=CEILING($L11,1)'},catalogRefs:[],input:Object.freeze({mainSelector:input.mainLeavesSelector}),result:wholeLeaves,status:'ok' as const,errorIds:[],warningIds:[]})]
  return Object.freeze({constructionId:input.constructionId,profile:input.profile,status:commercial.status,geometry,sash,parking,bom,additionalBom,materials,additionalMaterials,materialSubtotal,work,adhesiveFactors,glass,paint,commercial,finalPriceAvailable:commercial.finalPriceAvailable,diagnostics:Object.freeze(diagnostics),trace:Object.freeze([...leafSelectorTrace,...geometry.trace,...sash.trace,...parking.trace,...bom.trace,...additionalBom.trace,...adhesiveFactors.trace,...glass.trace,...paint.trace,...materials.trace,...additionalMaterials.trace,...materialSubtotal.trace,...work.trace,...commercial.trace])})
}
