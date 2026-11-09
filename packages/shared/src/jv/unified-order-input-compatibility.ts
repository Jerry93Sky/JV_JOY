export interface UnifiedPrimaryInputCell {
  readonly scenarioId: string
  readonly family: string
  readonly sheet: string
  readonly address: string
  readonly expected: string | number | boolean | null
  readonly actual: string | number | boolean | null
  readonly source: string
}

export interface UnifiedInputMismatch extends UnifiedPrimaryInputCell {}

/** Strictly compares the primary input values projected from one canonical scenario manifest. */
export function findUnifiedInputMismatches(cells: readonly UnifiedPrimaryInputCell[]): readonly UnifiedInputMismatch[] {
  return Object.freeze(cells.filter(cell => !sameExcelInput(cell.expected, cell.actual)).map(cell => Object.freeze({...cell})))
}

function sameExcelInput(expected: UnifiedPrimaryInputCell['expected'], actual: UnifiedPrimaryInputCell['actual']): boolean {
  if (typeof expected === 'number' && typeof actual === 'number') return Object.is(expected, actual)
  return expected === actual
}
