import type { DecimalString } from './types.ts'
const DECIMAL=/^([+-]?)(?:([0-9]+)(?:\.([0-9]*))?|\.([0-9]+))$/
type Parts={n:bigint;s:number}
function parse(v:string):Parts{const m=DECIMAL.exec(v);if(!m)throw new TypeError(`Invalid decimal: ${v}`);const frac=m[3]??m[4]??'';const whole=m[2]??'0';return {n:BigInt((m[1]==='-'?'-':'')+(whole+frac)),s:frac.length}}
function format(n:bigint,s:number):DecimalString{const neg=n<0n;let digits=(neg?-n:n).toString().padStart(s+1,'0');if(s)digits=digits.slice(0,-s)+'.'+digits.slice(-s);if(digits.includes('.'))digits=digits.replace(/0+$/,'').replace(/\.$/,'');return ((neg&&digits!=='0'?'-':'')+digits) as DecimalString}
export function decimalString(v:string):DecimalString{parse(v);return v as DecimalString}
export function addDecimal(a:DecimalString,b:DecimalString):DecimalString{const x=parse(a),y=parse(b),s=Math.max(x.s,y.s);return format(x.n*10n**BigInt(s-x.s)+y.n*10n**BigInt(s-y.s),s)}
export function subtractDecimal(a:DecimalString,b:DecimalString):DecimalString{return addDecimal(a,format(-parse(b).n,parse(b).s))}
export function multiplyDecimal(a:DecimalString,b:DecimalString):DecimalString{const x=parse(a),y=parse(b);return format(x.n*y.n,x.s+y.s)}
/** Division is exact only. Non-terminating results fail instead of silently rounding. */
export function divideDecimalExact(a:DecimalString,b:DecimalString):DecimalString{const x=parse(a),y=parse(b);if(y.n===0n)throw new RangeError('Division by zero');let n=x.n,d=y.n;const delta=y.s-x.s;if(delta>0)n*=10n**BigInt(delta);else if(delta<0)d*=10n**BigInt(-delta);let scale=0;while(n%d!==0n){if(scale>=30)throw new RangeError('Non-terminating decimal; explicit rounding policy required');n*=10n;scale++}return format(n/d,scale)}

export function compareDecimal(a:DecimalString,b:DecimalString):-1|0|1{const x=parse(a),y=parse(b),s=Math.max(x.s,y.s),left=x.n*10n**BigInt(s-x.s),right=y.n*10n**BigInt(s-y.s);return left<right?-1:left>right?1:0}

/** Excel ROUNDDOWN(value,0): truncate a finite decimal quotient toward zero. */
export function divideDecimalTruncateToInteger(a:DecimalString,b:DecimalString):DecimalString{const x=parse(a),y=parse(b);if(y.n===0n)throw new RangeError('Division by zero');let n=x.n,d=y.n;const delta=y.s-x.s;if(delta>0)n*=10n**BigInt(delta);else if(delta<0)d*=10n**BigInt(-delta);return format(n/d,0)}
