import {EngineError} from '../errors.ts'
import {addRational,type ExactRational} from '../rational.ts'
import type {TraceStep} from '../types.ts'
import type {FrontMaterialCostResult} from './material-pricing.ts'
import type {FrontGlassCostResult} from './glass-pricing.ts'
import type {FrontWorksResult} from './works-pricing.ts'
import type {FrontConsumablesResult} from './consumables-pricing.ts'

export interface FrontCommercialComponentsResult {readonly status:'COMPLETE'|'PARTIAL';readonly material:FrontMaterialCostResult;readonly glass:FrontGlassCostResult;readonly works:FrontWorksResult;readonly consumables:FrontConsumablesResult;readonly s36?:ExactRational;readonly diagnostics:readonly string[];readonly trace:readonly TraceStep[]}
/** Joins sourced component results through F1!S36; S38 and Main transfer belong to PR_12B3. */
export function calculateFrontCommercialComponents(input:{readonly material:FrontMaterialCostResult;readonly glass:FrontGlassCostResult;readonly works:FrontWorksResult;readonly consumables:FrontConsumablesResult;readonly workbook:string;readonly sourceSlot?:number;readonly selectorValue?:number;readonly selectorVersion?:string}):FrontCommercialComponentsResult {
 const {material,glass,works,consumables}=input
 if(new Set([material.profile,glass.profile,works.profile,consumables.profile]).size!==1)throw new EngineError('INVALID_CONFIGURATION','Front commercial component price profiles differ')
 const expectedWorkbook=material.profile==='COMPLETATION'?'JV-комплектация 08.10.2026.xlsm':'JV-розница 08.10.2026.xlsm'
 if(input.workbook!==expectedWorkbook||new Set([material.snapshotVersion,glass.snapshotVersion,works.snapshotVersion]).size!==1)throw new EngineError('INVALID_CONFIGURATION','Front commercial component sources differ')
 const diagnostics=[...material.diagnostics,...glass.diagnostics,...works.diagnostics,...consumables.diagnostics]
 const trace=[...material.trace,...glass.trace,...works.trace,...consumables.trace]
 let s36:ExactRational|undefined
 if(!diagnostics.length&&material.status==='COMPLETE'&&glass.status==='COMPLETE'&&works.status==='COMPLETE'&&consumables.status==='COMPLETE'&&glass.treatmentAmount&&works.painting&&works.additionalWork){s36=[material.confirmedSubtotal,glass.treatmentAmount,works.painting,works.additionalWork].reduce(addRational);const slot=input.sourceSlot??1,selector=slot===7?'$B$26':'$F$28';trace.push(Object.freeze({id:'JV.FRONT.COMMERCIAL.S36',kind:'summary',label:`F${slot}!S36`,ruleId:'JV.FRONT.COMMERCIAL.S36',inputRefs:['JV.FRONT.PRICE.S33','JV.FRONT.GLASS.S35','JV.FRONT.WORK.S34','JV.FRONT.WORK.ADDITIONAL'],input:{materials:material.confirmedSubtotal,glass:glass.treatmentAmount,painting:works.painting,additionalWork:works.additionalWork,selectorValue:input.selectorValue??null,selectorSource:`Главная!${selector.replaceAll('$','')}`,selectorVersion:input.selectorVersion??null},result:s36,status:'ok',source:{workbook:input.workbook,sheet:`F${slot}`,cell:'S36',formula:`=SUM($S$33:$S$35)+IF(Главная!${selector}=2,'Прайс-сб+монт'!$C$25*$Y$5,0)`},catalogRefs:[{id:'front-commercial-components',version:works.snapshotVersion}],errorIds:[],warningIds:[]}))}else if(!diagnostics.length)diagnostics.push('F1!S36 requires complete material, glass, painting, additional-work, and consumables components')
 return Object.freeze({status:s36?'COMPLETE':'PARTIAL',material,glass,works,consumables,s36,diagnostics:Object.freeze(diagnostics),trace:Object.freeze(trace)})
}
