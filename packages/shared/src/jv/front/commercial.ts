import { EngineError } from '../errors.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from '../rational.ts'
import type { TraceStep } from '../types.ts'
import type { FrontResult } from './calculator.ts'
import type { FrontMaterialCostResult } from './material-pricing.ts'
import type { FrontGlassCostResult } from './glass-pricing.ts'
import type { FrontWorksResult } from './works-pricing.ts'
import type { FrontConsumablesResult } from './consumables-pricing.ts'
import { calculateFrontCommercialComponents } from './commercial-components.ts'
import { calculateFront, type FrontInput } from './calculator.ts'
import { calculateFrontMaterialCosts, type FrontPriceSnapshot, type FrontRawPrice } from './material-pricing.ts'
import { calculateFrontGlassCosts, type FrontGlassPriceSnapshot } from './glass-pricing.ts'
import { calculateFrontWorks, type FrontWorksSnapshot } from './works-pricing.ts'
import { calculateFrontConsumables } from './consumables-pricing.ts'
import { calculateFrontY5, type FrontOrderAreaContext } from './commercial-context.ts'
const div=divideRational,mul=multiplyRational,add=addRational
const workbookFor=(p:'COMPLETATION'|'RETAIL')=>p==='COMPLETATION'?'JV-комплектация 08.10.2026.xlsm':'JV-розница 08.10.2026.xlsm'
export interface FrontCommercialResult {readonly status:'COMPLETE'|'PARTIAL';readonly profile:'COMPLETATION'|'RETAIL';readonly geometry:FrontResult;readonly material:FrontMaterialCostResult;readonly glass:FrontGlassCostResult;readonly works:FrontWorksResult;readonly consumables:FrontConsumablesResult;readonly s33:ExactRational;readonly s36?:ExactRational;readonly s37?:ExactRational;readonly s38?:ExactRational;readonly mainX?:ExactRational;readonly mainY?:ExactRational;readonly mainAA?:ExactRational;readonly diagnostics:readonly string[];readonly trace:readonly TraceStep[]}
/** Joins the confirmed Front component calculators and transfers its confirmed S38 value. */
function composeFrontCommercial(input:{readonly geometry:FrontResult;readonly material:FrontMaterialCostResult;readonly glass:FrontGlassCostResult;readonly works:FrontWorksResult;readonly consumables:FrontConsumablesResult;readonly workbook:string;readonly validation:string;readonly mainQuantity:string;readonly markupPercent:string;readonly discountPercent:string;readonly retailDivisor:string}):FrontCommercialResult {
 const profile=input.material.profile
 if(input.workbook!==workbookFor(profile)||input.geometry.trace[0]?.source?.workbook!==input.workbook)throw new EngineError('INVALID_CONFIGURATION','Front commercial workbook/profile mismatch')
 const c=calculateFrontCommercialComponents({material:input.material,glass:input.glass,works:input.works,consumables:input.consumables,workbook:input.workbook}),diagnostics=[...c.diagnostics],trace:TraceStep[]=[...c.trace]
 let s38:ExactRational|undefined,mainX:ExactRational|undefined,mainY:ExactRational|undefined,mainAA:ExactRational|undefined
 if(c.status==='COMPLETE'&&input.works.installation&&input.validation==='НЕТ'){
  s38=add(c.s36!,input.works.installation)
  trace.push(Object.freeze({id:'JV.FRONT.COMMERCIAL.S38',kind:'summary',label:'F1!S38',ruleId:'JV.FRONT.COMMERCIAL.S38',input:{s36:c.s36,s37:input.works.installation,validation:input.validation},result:s38,status:'ok',source:{workbook:input.workbook,sheet:'F1',cell:'S38',formula:'=IF($I$23="ОШИБКА!",$I$23,SUM($S$36:$S$37))'},catalogRefs:[{id:'front-commercial-components',version:input.material.snapshotVersion}],inputRefs:['JV.FRONT.COMMERCIAL.S36','JV.FRONT.WORK.S37'],errorIds:[],warningIds:[]}))
  try{const hundred=rationalFromDecimal('100');mainX=div(s38,rationalFromDecimal(input.retailDivisor));mainY=mul(mainX,div(add(hundred,rationalFromDecimal(input.markupPercent)),hundred));mainAA=mul(mul(mainY,rationalFromDecimal(input.mainQuantity)),div(add(hundred,rationalFromDecimal(input.discountPercent)),hundred));for(const [cell,value,formula,refs] of [['X11',mainX,"='F1'!$S$38/Настройки!$D$14",['JV.FRONT.COMMERCIAL.S38']],['Y11',mainY,'=INDEX(R11:X11,G11)*(100+Настройки!$D21)/100',['Главная!G11','Главная!X11']],['AA11',mainAA,'=Y11*Z11*(100+Настройки!$D$19)/100',['Главная!Y11','Главная!Z11']]] as const)trace.push(Object.freeze({id:'JV.FRONT.MAIN.'+cell,kind:'summary',label:'Главная!'+cell,ruleId:'JV.FRONT.MAIN.'+cell,input:{references:refs},result:value,status:'ok',source:{workbook:input.workbook,sheet:'Главная',cell,formula},catalogRefs:[{id:'front-main-transfer',version:input.material.snapshotVersion}],inputRefs:refs,errorIds:[],warningIds:[]}))}catch(e){diagnostics.push('Главная transfer: '+String(e));s38=undefined}
 } else diagnostics.push(input.validation==='НЕТ'?'S38 requires confirmed S36 and S37':'S38 blocked by active F1!I23 validation')
 return Object.freeze({status:s38?'COMPLETE':'PARTIAL',profile,geometry:input.geometry,material:input.material,glass:input.glass,works:input.works,consumables:input.consumables,s33:input.material.confirmedSubtotal,s36:c.s36,s37:input.works.installation,s38,mainX,mainY,mainAA,diagnostics:Object.freeze(diagnostics),trace:Object.freeze(trace)})
}

export type FrontCommercialSnapshot = FrontPriceSnapshot & FrontGlassPriceSnapshot & FrontWorksSnapshot & {readonly settings:FrontWorksSnapshot['settings'] & Readonly<{D32:FrontRawPrice}>}
/** Runs the complete confirmed Front geometry-to-commercial pipeline from raw controls and source-bound catalogs. */
export function calculateFrontCommercial(input:{readonly construction:FrontInput;readonly snapshot:FrontCommercialSnapshot;readonly order:FrontOrderAreaContext;readonly glassEnabled:boolean;readonly finishingEnabled:boolean;readonly glassServiceEnabled:boolean;readonly installationEnabled:boolean;readonly mainSurchargeSelector:1|2;readonly mainQuantity:string;readonly markupPercent:string;readonly discountPercent:string;readonly retailDivisor:string}):FrontCommercialResult {
 const geometry=calculateFront(input.construction)
 let y5:ExactRational|undefined,orderDiagnostic:string|undefined
 try{y5=calculateFrontY5(input.order).value}catch(e){if(e instanceof EngineError&&e.code==='MISSING_INPUT')orderDiagnostic=`Missing required order dependency: ${e.message}`;else throw e}
 const material=calculateFrontMaterialCosts({bom:geometry,snapshot:input.snapshot,controls:{C21:input.construction.controls.C21,C22:input.construction.controls.C22,C23:input.construction.controls.C23,C24:input.construction.controls.C24}})
 const glass=calculateFrontGlassCosts({geometry,snapshot:input.snapshot,selector:input.construction.glassSelector,glassEnabled:input.glassEnabled,finishingEnabled:input.finishingEnabled,glassServiceEnabled:input.glassServiceEnabled,y5})
 const works=calculateFrontWorks({geometry,snapshot:input.snapshot,finishSelector:input.construction.finishSelector,installationEnabled:input.installationEnabled,mainSurchargeSelector:input.mainSurchargeSelector,C21:input.construction.controls.C21,y5})
 const consumables=calculateFrontConsumables({profile:input.snapshot.profile,workbook:input.snapshot.workbook,systemSelector:7,constructionCount:input.mainQuantity,workbookSha256:input.snapshot.workbookSha256})
 const result=composeFrontCommercial({geometry,material,glass,works,consumables,workbook:input.snapshot.workbook,validation:geometry.selections.I23 as string,mainQuantity:input.mainQuantity,markupPercent:input.markupPercent,discountPercent:input.discountPercent,retailDivisor:input.retailDivisor})
 if(!orderDiagnostic)return result
 return Object.freeze({...result,status:'PARTIAL' as const,s38:undefined,mainX:undefined,mainY:undefined,mainAA:undefined,diagnostics:Object.freeze([...result.diagnostics,orderDiagnostic])})
}
