import {EngineError} from '../errors.ts'
import {rationalFromDecimal,type ExactRational} from '../rational.ts'
import type {PriceProfile,TraceStep} from '../types.ts'

export interface FrontConsumablesResult {readonly status:'COMPLETE'|'PARTIAL';readonly profile:PriceProfile;readonly scope:'FRONT_POSITION_ONLY';readonly activatorPerConstruction:ExactRational;readonly adhesivePerConstruction:ExactRational;readonly activatorPositionQuantity:ExactRational;readonly adhesivePositionQuantity:ExactRational;readonly diagnostics:readonly string[];readonly trace:readonly TraceStep[]}
const z=rationalFromDecimal('0')
/** Front's source selector resolves to literal zero in the seventh system column. */
export function calculateFrontConsumables(input:{readonly profile:PriceProfile;readonly workbook:string;readonly systemSelector:number;readonly constructionCount:string;readonly workbookSha256:string}):FrontConsumablesResult {
 if(input.systemSelector!==7)throw new EngineError('INVALID_CONFIGURATION','Front consumables require Главная!Gslot=7')
 if(input.workbook!==(input.profile==='COMPLETATION'?'JV-комплектация 08.10.2026.xlsm':'JV-розница 08.10.2026.xlsm'))throw new EngineError('INVALID_CONFIGURATION','Front consumables workbook/profile mismatch')
 if(!/^[a-f0-9]{64}$/i.test(input.workbookSha256))throw new EngineError('INVALID_CONFIGURATION','Front consumables require source workbook SHA-256')
 let count:ExactRational;try{count=rationalFromDecimal(input.constructionCount)}catch{throw new EngineError('INVALID_DECIMAL','Invalid Front construction count')}
 if(BigInt(count.numerator)<0n)throw new EngineError('INVALID_CONFIGURATION','Construction count cannot be negative')
 const trace=(id:string,sheet:string,cell:string,formula:string):TraceStep=>Object.freeze({id,kind:'material',label:`${sheet}!${cell}`,ruleId:id,input:{systemSelector:7,constructionCount:count},result:z,status:'ok',source:{workbook:input.workbook,sheet,cell,formula},catalogRefs:[{id:`front-consumables-${cell}`,version:input.workbookSha256}],inputRefs:[],errorIds:[],warningIds:[]})
 const steps=[trace('JV.FRONT.CONSUMABLE.L5','Клей+акт','L5','=IFERROR(   INDEX($E5:$K5,$C5),   0)'),trace('JV.FRONT.CONSUMABLE.L18','Клей+акт','L18','=IFERROR(   INDEX($E18:$K18,$C18),   0)')]
 return Object.freeze({status:'COMPLETE',profile:input.profile,scope:'FRONT_POSITION_ONLY',activatorPerConstruction:z,adhesivePerConstruction:z,activatorPositionQuantity:z,adhesivePositionQuantity:z,diagnostics:Object.freeze([]),trace:Object.freeze(steps)})
}
