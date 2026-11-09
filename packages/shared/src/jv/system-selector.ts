import { EngineError } from './errors.ts'

export const systemSelectorCatalogVersion = 'JV-MAIN-2026-10-08-v1'
export const systemByColumnIndex = {
  1: 'LINE', 2: 'ZIGZAG', 3: 'SLIDER_L3', 4: 'SLIDER_L5', 5: 'SLIDER_X3', 6: 'SLIDER_X5', 7: 'FRONT',
} as const
export type JvSystemFamily = typeof systemByColumnIndex[keyof typeof systemByColumnIndex]

export interface MainSystemSelection { rawSelector: number; declaredFamily?: JvSystemFamily }
export interface ResolvedMainSystem { rawSelector: number; normalizedSelector: number; family: JvSystemFamily; sourceCell: string; formula: string; catalogVersion: string }

export function normalizeMainSystemSelector(rawSelector: number): number {
  if (!Number.isInteger(rawSelector) || rawSelector < 1 || rawSelector > 11) {
    throw new EngineError('INVALID_CONFIGURATION', `Главная!F selector must be integer 1..11; received ${rawSelector}`, { rawSelector })
  }
  return [4, 5, 6].includes(rawSelector) ? 3 : rawSelector === 11 ? 10 : rawSelector
}

export function resolveMainSystemSelection(input: MainSystemSelection): ResolvedMainSystem {
  const normalizedSelector = normalizeMainSystemSelector(input.rawSelector)
  const family = systemByColumnIndex[normalizedSelector as keyof typeof systemByColumnIndex]
  if (!family) throw new EngineError('RULE_UNCONFIRMED', `Главная!F${input.rawSelector}: normalized selector ${normalizedSelector} is outside Главная!R:X index 1..7`, { rawSelector: input.rawSelector, normalizedSelector })
  if (input.declaredFamily && input.declaredFamily !== family) {
    throw new EngineError('INVALID_CONFIGURATION', `Selector ${input.rawSelector} resolves to ${family}, conflicting with declared ${input.declaredFamily}`, { rawSelector: input.rawSelector, normalizedSelector, declaredFamily: input.declaredFamily })
  }
  return { rawSelector: input.rawSelector, normalizedSelector, family, sourceCell: `Главная!F${input.rawSelector}`, formula: '=IF(OR(Frow=4,Frow=5,Frow=6),3,IF(Frow=11,10,Frow))', catalogVersion: systemSelectorCatalogVersion }
}
