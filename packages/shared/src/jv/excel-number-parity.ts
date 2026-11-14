import { rationalToDecimalExact, type ExactRational } from './rational.ts'

export type ExcelParityClassification='EXACT'|'NUMERICALLY_EQUIVALENT'|'DISPLAY_MATCH'|'MISMATCH'|'UNVERIFIED'

/**
 * Compares an exact engine rational with the numeric value returned by Excel COM.
 * NUMERICALLY_EQUIVALENT means both values map to the same IEEE-754 number; it
 * does not use a tolerance. Display comparison remains the caller's responsibility
 * because it requires the cell's actual Excel number format.
 */
export function compareRationalToExcelValue2(value:ExactRational,excelValue:unknown):ExcelParityClassification {
  if(typeof excelValue!=='number'||!Number.isFinite(excelValue))return 'UNVERIFIED'
  const exactDecimal=rationalToDecimalExact(value)
  if(exactDecimal!==undefined&&exactDecimal===String(excelValue))return 'EXACT'
  const rounded=roundingIntervalContains(value,excelValue)
  if(rounded===true)return 'NUMERICALLY_EQUIVALENT'
  if(rounded===undefined)return 'UNVERIFIED'
  return 'MISMATCH'
}

type Fraction={n:bigint;d:bigint}
function compareFraction(a:Fraction,b:Fraction):number {const x=a.n*b.d,y=b.n*a.d;return x<y?-1:x>y?1:0}
function floatFraction(value:number):Fraction|undefined {
  if(!Number.isFinite(value))return undefined
  const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value,false);const bits=view.getBigUint64(0,false),negative=(bits>>63n)!==0n,exponent=Number((bits>>52n)&0x7ffn),fraction=bits&0xfffffffffffffn
  if(exponent===0&&fraction===0n)return{n:0n,d:1n}
  const significand=exponent===0?fraction:(1n<<52n)|fraction,power=(exponent===0?1-1023:exponent-1023)-52
  const n=(negative?-significand:significand)*(power>=0?1n<<BigInt(power):1n),d=power<0?1n<<BigInt(-power):1n
  return{n,d}
}
function nextUp(value:number):number {if(value===0)return Number.MIN_VALUE;const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value,false);let bits=view.getBigUint64(0,false);bits+=value>0?1n:-1n;view.setBigUint64(0,bits,false);return view.getFloat64(0,false)}
function nextDown(value:number):number {if(value===0)return -Number.MIN_VALUE;const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value,false);let bits=view.getBigUint64(0,false);bits+=value>0?-1n:1n;view.setBigUint64(0,bits,false);return view.getFloat64(0,false)}
function midpoint(a:Fraction,b:Fraction):Fraction{return{n:a.n*b.d+b.n*a.d,d:2n*a.d*b.d}}
/** True when the exact rational lies inside the round-to-nearest-even interval for the Excel binary64 value. */
function roundingIntervalContains(value:ExactRational,excelValue:number):boolean|undefined {
  const center=floatFraction(excelValue),below=floatFraction(nextDown(excelValue)),above=floatFraction(nextUp(excelValue))
  if(!center||!below||!above)return undefined
  const rational={n:BigInt(value.numerator),d:BigInt(value.denominator)},lower=midpoint(below,center),upper=midpoint(center,above),lowCmp=compareFraction(rational,lower),highCmp=compareFraction(rational,upper)
  if(lowCmp<0||highCmp>0)return false
  if(lowCmp===0||highCmp===0){const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,excelValue,false);return(view.getBigUint64(0,false)&1n)===0n}
  return true
}
