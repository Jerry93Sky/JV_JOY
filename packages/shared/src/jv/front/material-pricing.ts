import { EngineError } from '../errors.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, roundRationalAwayFromZero, type ExactRational } from '../rational.ts'
import type { PriceProfile, TraceStep } from '../types.ts'
import type { FrontResult } from './calculator.ts'
import { FRONT_PRICE_FORMULAS } from './source-price-formulas.ts'

export interface FrontRawPrice { readonly value:string; readonly sourceCell:string; readonly sourceFormula:string }
export interface FrontPriceSnapshot {
 readonly schemaVersion:'1.0'; readonly profile:PriceProfile; readonly version:string; readonly workbook:string
 readonly workbookSha256:string; readonly currency:'RUB'; readonly prices:Readonly<Record<string,FrontRawPrice>>
 readonly settings:Readonly<{D5:FrontRawPrice;D14:FrontRawPrice;D15:FrontRawPrice}>
}
export interface FrontMaterialPosition {
 readonly row:number; readonly sku:string|null; readonly unit:string; readonly quantity:ExactRational
 readonly unitPrice?:ExactRational; readonly amount?:ExactRational; readonly priceSourceCells:readonly string[]
 readonly sourceFormula:string; readonly traceStepId:string; readonly includedIn?:string; readonly status:'PRICED'|'PARTIAL'|'NOT_APPLICABLE'
}
export interface FrontMaterialCostResult {
 readonly status:'COMPLETE'|'PARTIAL'; readonly profile:PriceProfile; readonly currency:'RUB'; readonly snapshotVersion:string
 readonly positions:readonly FrontMaterialPosition[]; readonly confirmedSubtotal:ExactRational
 readonly diagnostics:readonly string[]; readonly d14:ExactRational; readonly trace:readonly TraceStep[]
}
const z=rationalFromDecimal('0'),one=rationalFromDecimal('1')
const add=(a:ExactRational,b:ExactRational)=>addRational(a,b),mul=(a:ExactRational,b:ExactRational)=>multiplyRational(a,b),div=(a:ExactRational,b:ExactRational)=>divideRational(a,b)
const eq=(a:ExactRational,b:number)=>BigInt(a.numerator)===BigInt(b)*BigInt(a.denominator)
const SOURCE:Record<PriceProfile,string>={COMPLETATION:'JV-комплектация 08.10.2026.xlsm',RETAIL:'JV-розница 08.10.2026.xlsm'}
function price(snapshot:FrontPriceSnapshot,cell:string):ExactRational { const p=cell==='Настройки!D5'?snapshot.settings?.D5:cell==='Настройки!D14'?snapshot.settings?.D14:cell==='Настройки!D15'?snapshot.settings?.D15:snapshot.prices[cell];if(!p)throw new EngineError('MISSING_INPUT',`Missing Front source price ${cell}`);if(p.sourceCell!==cell||p.sourceFormula!==p.value)throw new EngineError('RULE_UNCONFIRMED',`Front price must be a raw source literal: ${cell}`,{sourceCell:p.sourceCell,formula:p.sourceFormula});if(p.value===''){if(p.sourceFormula==='')return z;throw new EngineError('MISSING_INPUT',`Blank/unresolved Front source price ${cell}`)}return rationalFromDecimal(p.value) }
export function calculateFrontMaterialCosts(input:{readonly bom:FrontResult;readonly snapshot:FrontPriceSnapshot;readonly controls:Readonly<{C21:number;C22:number;C23:number;C24:number}>}):FrontMaterialCostResult {
 const {bom,snapshot,controls}=input
 if(snapshot.schemaVersion!=='1.0'||snapshot.currency!=='RUB'||snapshot.workbook!==SOURCE[snapshot.profile])throw new EngineError('INVALID_CONFIGURATION','Front price snapshot provenance/profile is invalid')
 if(!/^[a-f0-9]{64}$/i.test(snapshot.workbookSha256)||!snapshot.version)throw new EngineError('INVALID_CONFIGURATION','Front price snapshot needs a version and source SHA-256')
 if(snapshot.workbookSha256.toLowerCase()!==bom.versions.sourceSha256.toLowerCase()||snapshot.workbook!==bom.trace[0]?.source?.workbook)throw new EngineError('INVALID_CONFIGURATION','Front BOM and price snapshot must use the same source workbook')
 for(const [k,v] of Object.entries(controls))if(!Number.isSafeInteger(v)||v<1)throw new EngineError('INVALID_CONFIGURATION',`Invalid Front price selector ${k}`)
 const d5=price(snapshot,'Настройки!D5'),d14=price(snapshot,'Настройки!D14'),d15=price(snapshot,'Настройки!D15');if(!BigInt(d5.numerator))throw new EngineError('INVALID_CONFIGURATION','Настройки!D5 cannot be zero')
 const positions:FrontMaterialPosition[]=[],trace:TraceStep[]=[],diagnostics:string[]=[];let subtotal=z
 for(const line of bom.bom){
  const row=line.row,selector=row===29?controls.C23:row===30?controls.C24:0
  let cells:string[]=[]
  if(row>=5&&row<=18||row===31||row===32)cells=[`Прайс-Front!E${row<=18?row:row-12}`]
  else if(row>=19&&row<=26)cells=[`Прайс-Аксессуары!D${row+32}`,'Настройки!D15']
  else if(row===27&&controls.C21>1)cells=[`Прайс-Аксессуары!D${58+controls.C21}`]
  else if(row===28)cells=[`Прайс-Аксессуары!D${11+controls.C22}`]
  else if(row===29||row===30)cells=[`Прайс-Аксессуары!D${28+selector}`]
  try{
   let unitPrice:ExactRational
   if(row>=5&&row<=6||row>=12&&row<=16)unitPrice=div(price(snapshot,cells[0]!),d5)
   else if(row>=19&&row<=26){const accessory=price(snapshot,cells[0]!);unitPrice=mul(d15,div(accessory,d15))}
   else if(row===27&&controls.C21===1)unitPrice=z
   else if(row>=27&&row<=30)unitPrice=price(snapshot,cells[0]!)
   else unitPrice=price(snapshot,cells[0]!)
   const amount=row===6?mul(mul(line.quantity.numerator==='0'?z:one,unitPrice),mul(rationalFromDecimal('2'),rationalFromDecimal(roundRationalAwayFromZero(div(bom.geometry.C3,rationalFromDecimal('1000')),0)))):mul(line.quantity,unitPrice)
   subtotal=add(subtotal,amount)
   const stepId=`JV.FRONT.PRICE.S${row}`;trace.push(Object.freeze({id:stepId,kind:'material',label:`F1!S${row}`,ruleId:stepId,input:{quantity:line.quantity,priceSourceCells:cells},result:amount,status:'ok',source:{workbook:bom.trace[0]?.source?.workbook??snapshot.workbook,sheet:'F1',cell:`S${row}`,formula:FRONT_PRICE_FORMULAS[`S${row}` as keyof typeof FRONT_PRICE_FORMULAS]},catalogRefs:[{id:`front-price-${snapshot.profile}-${row}`,version:snapshot.version}],inputRefs:[line.traceStepId],errorIds:[],warningIds:[]}))
   positions.push(Object.freeze({row,sku:line.sku,unit:line.unit,quantity:line.quantity,unitPrice,amount,priceSourceCells:Object.freeze(cells),sourceFormula:FRONT_PRICE_FORMULAS[`S${row}` as keyof typeof FRONT_PRICE_FORMULAS]??'0',traceStepId:stepId,status:row===23?'NOT_APPLICABLE':'PRICED',...(row===23?{includedIn:'Excel source Q23 is literal 0; no charge'}:{})}))
  }catch(e){const message=e instanceof Error?e.message:String(e);diagnostics.push(`F1!S${row}: ${message}`);positions.push(Object.freeze({row,sku:line.sku,unit:line.unit,quantity:line.quantity,priceSourceCells:Object.freeze(cells),sourceFormula:FRONT_PRICE_FORMULAS[`S${row}` as keyof typeof FRONT_PRICE_FORMULAS]??'0',traceStepId:`JV.FRONT.PRICE.S${row}`,status:row===23?'NOT_APPLICABLE':'PARTIAL'}))}
 }
 return Object.freeze({status:diagnostics.length?'PARTIAL':'COMPLETE',profile:snapshot.profile,currency:'RUB',snapshotVersion:snapshot.version,positions:Object.freeze(positions),confirmedSubtotal:subtotal,diagnostics:Object.freeze(diagnostics),d14,trace:Object.freeze(trace)})
}
