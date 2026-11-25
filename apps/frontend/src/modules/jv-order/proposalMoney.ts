/** Presentation only: exact rational -> kopecks, half away from zero. */
export function displayProposalMoney(value: unknown): {text:string;rounded:boolean}|null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const x=value as Record<string,unknown>
  if(typeof x.numerator!=='string'||typeof x.denominator!=='string'||!/^[-]?\d+$/.test(x.numerator)||!/^\d+$/.test(x.denominator))return null
  const numerator=BigInt(x.numerator),denominator=BigInt(x.denominator)
  if(denominator===0n)return null
  const abs=numerator<0n?-numerator:numerator,scaled=abs*100n,remainder=scaled%denominator
  const cents=scaled/denominator+(remainder*2n>=denominator?1n:0n)
  const sign=numerator<0n&&cents!==0n?'-':''
  return {text:`${sign}${cents/100n},${String(cents%100n).padStart(2,'0')}`,rounded:remainder!==0n}
}
