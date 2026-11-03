import { readFileSync, writeFileSync } from 'node:fs'
import { decimalString } from '../../packages/shared/src/jv/decimal.ts'
import { calculateLineConstruction } from '../../packages/shared/src/jv/line-calculator.ts'
import { rationalFromDecimal, rationalToDecimalExact } from '../../packages/shared/src/jv/rational.ts'

const fixture=JSON.parse(readFileSync('docs/jv/fixtures/line-full-commercial-excel-golden.json','utf8'))
const mode2=JSON.parse(readFileSync('docs/jv/fixtures/line-mode2-excel-golden.json','utf8'))
const prices=JSON.parse(readFileSync('docs/jv/fixtures/line-price-snapshots.json','utf8')).sources
const glass=JSON.parse(readFileSync('docs/jv/fixtures/line-glass-price-snapshots.json','utf8')).sources
const paints=JSON.parse(readFileSync('docs/jv/fixtures/line-paint-price-snapshots.json','utf8')).sources
const cells=['Q52','Q53','Q54','Q55','Q56','Q57','Q58']
function display2(v){const n=BigInt(v.numerator),d=BigInt(v.denominator),a=n<0n?-n:n,s=a*100n;let q=s/d;if((s%d)*2n>=d)q++;const z=q.toString().padStart(3,'0');return `${n<0n?'-':''}${z.slice(0,-2)}.${z.slice(-2)}`}
function evaluate(record,commercialOverride,excelReference,finishOverride,glassOverride){
 const p=prices.find(x=>x.profile===record.profile),g=glass.find(x=>x.profile===record.profile),paint=paints.find(x=>x.profile===record.profile),i=record.input
 const input={constructionId:record.scenarioId,profile:record.profile,workbook:record.workbook,...Object.fromEntries(['constructionQuantity','widthMm','heightMm','leaves','sideCount','profileCount','connectorAngle','specialSashWidthMm','rollerAxisToEdgeMm','parkedDoorPosition','parkedDoorWidthMm'].map(k=>[k,decimalString(i[k])])),mainLeavesSelector:decimalString(i.mainLeavesSelector),direction:i.direction,frameState:i.frameState,knobState:i.knobState,latchState:i.latchState,weatherSealState:i.weatherSealState,floorLockState:i.floorLockState,bottomPivotState:i.bottomPivotState,specialSashEnabled:i.specialSashEnabled,parkedDoorSelected:i.parkedDoorSelected,parkedDoorReuseOpening:i.parkedDoorReuseOpening,glassSelectionIndex:glassOverride??i.glassSelectionIndex,finishSelectionIndex:finishOverride??i.finishSelectionIndex,commercialModeIndex:commercialOverride??i.commercialModeIndex,assemblyEnabled:i.assemblyEnabled,millingEnabled:i.millingEnabled,installationEnabled:i.installationEnabled}
 const s={...record.settings,P19:g.settings.P19,L17:g.settings.L17,L18:g.settings.L18,L22:g.settings.L22,L6:/^(true|1)$/i.test(record.settings.L6),L21:/^(true|1)$/i.test(g.settings.L21),D32:/^(true|1)$/i.test(g.settings.D32)}
 const r=calculateLineConstruction(input,s,p,g,paint)
 const actual={Q52:r.materialSubtotal.supportedSubtotal,Q53:r.paint.q53,Q54:r.glass.surcharge,Q55:r.work.assemblyAndMilling,Q56:r.commercial.q56,Q57:r.work.installation,Q58:r.commercial.q58}
 const comparisons=Object.fromEntries(cells.map(cell=>{const source=excelReference?.values?.L1?.[cell]??excelReference?.excelValues?.[cell]??record.expected[cell],expected=source.value2??source.value,exact=rationalToDecimalExact(actual[cell]),status=exact===expected?'EXACT':display2(actual[cell])===display2(rationalFromDecimal(expected))?'DISPLAY_MATCH':'MISMATCH';return [cell,{engineExactDecimal:exact,excelValue2:expected,excelDisplayed:source.displayedText??null,engineDisplayed:display2(actual[cell]),status,formula:source.formula,numberFormat:source.numberFormat}]}))
 return {workbook:record.workbook,sha256:record.workbookSha256,profile:record.profile,scenarioId:commercialOverride?`${record.scenarioId}-mode-${commercialOverride}`:record.scenarioId,inputs:{...record.input,commercialModeIndex:commercialOverride??record.input.commercialModeIndex},selectors:{...record.selectors,commercialModeIndex:commercialOverride??record.selectors.commercialModeIndex},comparisons}
}
const cases=fixture.cases.map(record=>evaluate(record))
for(const record of mode2.cases)cases.push(evaluate(record))
const counts={cases:cases.length,byProfile:{COMPLETATION:cases.filter(c=>c.profile==='COMPLETATION').length,RETAIL:cases.filter(c=>c.profile==='RETAIL').length},comparisons:0,exact:0,displayMatch:0,mismatch:0,unverified:0}
for(const c of cases)for(const v of Object.values(c.comparisons)){counts.comparisons++;if(v.status==='EXACT')counts.exact++;else if(v.status==='DISPLAY_MATCH')counts.displayMatch++;else if(v.status==='MISMATCH')counts.mismatch++;else counts.unverified++}
const output={schemaVersion:'2.0',method:'Excel 16 CalculateFullRebuild on temporary workbook copies; macro execution forced off; events disabled; original XLSM files were not modified.',scope:'20 independent raw-input single-slot cases (10 per workbook/profile) plus two commercialModeIndex=2 branch cases from prior verified Excel rebuilds. The engine receives source selector Главная!L11 and independently evaluates CEILING(L11,1) -> Главная!M11 -> L1!D5.',classification:'EXACT means engine exact decimal equals Excel COM Value2 decimal text. DISPLAY_MATCH means exact binary/decimal values differ but formatted two-decimal display agrees. No numeric equivalence tolerance is used. Mode-2 legacy records are not independently reclassified where prior engine values were not persisted.',counts,cases}
writeFileSync('docs/jv/LINE_FULL_PRICE_PARITY.json',JSON.stringify(output,null,2)+'\n')
process.stdout.write(JSON.stringify(counts,null,2)+'\n')
