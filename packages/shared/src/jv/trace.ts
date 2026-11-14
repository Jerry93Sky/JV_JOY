import type { TraceStep, ValueStatus } from './types.ts'
/** Pure trace constructor. It records supplied facts and never computes or mutates them. */
export function traceStep(step: TraceStep): TraceStep {
  if (!step.id.trim()) throw new TypeError('Trace step id is required')
  return Object.freeze({ ...step, inputRefs: Object.freeze([...step.inputRefs]), catalogRefs: Object.freeze(step.catalogRefs.map(x => Object.freeze({ ...x }))), input: Object.freeze({ ...step.input }), errorIds: Object.freeze([...step.errorIds]), warningIds: Object.freeze([...step.warningIds]) })
}
export function aggregateStatus(statuses: readonly ValueStatus[]): ValueStatus {
  if (statuses.includes('calculation_error')) return 'calculation_error'
  if (statuses.includes('invalid_input')) return 'invalid_input'
  if (statuses.includes('unavailable')) return 'unavailable'
  return 'ok'
}
