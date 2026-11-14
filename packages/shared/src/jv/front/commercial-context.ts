import {EngineError} from '../errors.ts'
import {addRational,divideRational,multiplyRational,rationalFromDecimal,type ExactRational} from '../rational.ts'
import type {TraceStep} from '../types.ts'
export interface FrontOrderAreaPosition {readonly mainRow:11|12|13|14|15|16|17;readonly widthMm:string;readonly heightMm:string;readonly quantity:string}
export interface FrontB26Snapshot {readonly schemaVersion:'1.0';readonly sourceCell:'Главная!B26';readonly workbook:string;readonly workbookSha256:string;readonly value:1|2;readonly version:string;readonly sourceScenarioId:string}
export interface FrontOrderAreaContext {readonly workbook:string;readonly sourceSha256:string;readonly positions:readonly FrontOrderAreaPosition[];readonly positionMainRow?:11|12|13|14|15|16|17;readonly frontSlot7B26?:FrontB26Snapshot}
/** ПРМ!AB(row)=AA(row)/(AA32*W(row)), with rows 25:31 derived from raw order dimensions and quantities. */
export function calculateFrontY5(context:FrontOrderAreaContext):{readonly value:ExactRational;readonly trace:readonly TraceStep[]} {
 if(context.positions.length!==7||![11,12,13,14,15,16,17].every(row=>context.positions.some(x=>x.mainRow===row)))throw new EngineError('MISSING_INPUT','Front order area context requires every Main row 11:17, including empty rows as zero')
 if(!/^[a-f0-9]{64}$/i.test(context.sourceSha256))throw new EngineError('INVALID_CONFIGURATION','Front order area context requires source SHA-256')
 const positionMainRow=context.positionMainRow??11
 if(![11,12,13,14,15,16,17].includes(positionMainRow))throw new EngineError('INVALID_CONFIGURATION','Front order area context has an invalid Main row')
 const seen=new Set<number>();let total=rationalFromDecimal('0'),own:ExactRational|undefined,ownQty:ExactRational|undefined
 for(const p of context.positions){if(seen.has(p.mainRow))throw new EngineError('INVALID_CONFIGURATION','Duplicate Main order row');seen.add(p.mainRow);let w:ExactRational,h:ExactRational,q:ExactRational;try{w=rationalFromDecimal(p.widthMm);h=rationalFromDecimal(p.heightMm);q=rationalFromDecimal(p.quantity)}catch{throw new EngineError('INVALID_DECIMAL','Invalid Front order area input')};if(BigInt(w.numerator)<0n||BigInt(h.numerator)<0n||BigInt(q.numerator)<0n)throw new EngineError('INVALID_CONFIGURATION','Negative Front order area input');const area=divideRational(multiplyRational(multiplyRational(w,h),q),rationalFromDecimal('1000000'));total=addRational(total,area);if(p.mainRow===positionMainRow){own=area;ownQty=q}}
 if(!own||!ownQty)throw new EngineError('MISSING_INPUT',`Missing Front order row ${positionMainRow}`)
 const denominator=multiplyRational(total,ownQty),value=BigInt(denominator.numerator)===0n?rationalFromDecimal('0'):divideRational(own,denominator)
 const prmRow=14+positionMainRow,frontSheet=`F${positionMainRow-10}`,prmCell=`AB${prmRow}`
 const trace:TraceStep={id:`JV.FRONT.PRM.${prmCell}`,kind:'pricing',label:`ПРМ!${prmCell}`,ruleId:'JV.FRONT.PRM.AREA-SHARE',inputRefs:[],input:{positions:context.positions,totalArea:total,ownArea:own,ownQuantity:ownQty,positionMainRow},result:value,status:'ok',source:{workbook:context.workbook,sheet:'ПРМ',cell:prmCell,formula:`=IFERROR(AA${prmRow}/($AA$32*W${prmRow}),0)`},catalogRefs:[{id:'front-order-area',version:context.sourceSha256}],errorIds:[],warningIds:[]}
 const transfer:TraceStep={id:`JV.FRONT.${frontSheet}.Y5`,kind:'pricing',label:`${frontSheet}!Y5`,ruleId:'JV.FRONT.ORDER-AREA-TRANSFER',inputRefs:[trace.id],input:{areaShare:value},result:value,status:'ok',source:{workbook:context.workbook,sheet:frontSheet,cell:'Y5',formula:`=ПРМ!$AB$${prmRow}`},catalogRefs:[{id:'front-order-area',version:context.sourceSha256}],errorIds:[],warningIds:[]}
 return Object.freeze({value,trace:Object.freeze([Object.freeze(trace),Object.freeze(transfer)])})
}
