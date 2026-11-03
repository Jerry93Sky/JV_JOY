import { EngineError } from './errors.ts'
import { executeGraph } from './graph.ts'
import { divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from './rational.ts'

export interface LineAdhesiveFactorResult {
  readonly O5: ExactRational
  readonly O18: ExactRational
  readonly trace: ReturnType<typeof executeGraph>['trace']
}

function ceilPositive(value: ExactRational): bigint {
  const numerator = BigInt(value.numerator)
  const denominator = BigInt(value.denominator)
  if (numerator <= 0n || denominator <= 0n) throw new EngineError('INVALID_CONFIGURATION', 'Adhesive consumption and construction quantity must be positive')
  return (numerator + denominator - 1n) / denominator
}

/**
 * Models the JV-Line-only row selected by Главная!G11=1. For this isolated
 * calculator, the quote group consists of this construction and its explicit
 * quantity; other system slots from the multi-system workbook are out of scope.
 */
export function calculateLineAdhesiveFactors(input: {
  readonly activatorQuantityPerConstruction: ExactRational // L1!O49
  readonly adhesiveQuantityPerConstruction: ExactRational // L1!O50
  readonly constructionQuantity: ExactRational // Главная!Z11
  readonly workbook: string
}): LineAdhesiveFactorResult {
  const activatorConsumption = multiplyRational(input.activatorQuantityPerConstruction, input.constructionQuantity)
  const adhesiveConsumption = multiplyRational(input.adhesiveQuantityPerConstruction, input.constructionQuantity)
  const graph = executeGraph({ activatorConsumption, adhesiveConsumption }, [
    {
      id: 'JV.LINE.GLUE.O5_FACTOR', version: 'JV-LINE-GLUE-2026-10-08', dependsOn: ['activatorConsumption'],
      source: { workbook: input.workbook, sheet: 'Клей+акт', cell: 'O5', formula: '=N12/SUM(N5:N11)' },
      execute: ({ inputs }) => divideRational(rationalFromDecimal(String(ceilPositive(inputs.activatorConsumption as ExactRational))), inputs.activatorConsumption as ExactRational),
    },
    {
      id: 'JV.LINE.GLUE.O18_FACTOR', version: 'JV-LINE-GLUE-2026-10-08', dependsOn: ['adhesiveConsumption'],
      source: { workbook: input.workbook, sheet: 'Клей+акт', cell: 'O18', formula: '=N25/SUM(N18:N24)' },
      execute: ({ inputs }) => divideRational(rationalFromDecimal(String(ceilPositive(inputs.adhesiveConsumption as ExactRational))), inputs.adhesiveConsumption as ExactRational),
    },
  ])
  return Object.freeze({ O5: graph.values['JV.LINE.GLUE.O5_FACTOR'] as ExactRational, O18: graph.values['JV.LINE.GLUE.O18_FACTOR'] as ExactRational, trace: graph.trace })
}
