"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceStep = traceStep;
exports.aggregateStatus = aggregateStatus;
/** Pure trace constructor. It records supplied facts and never computes or mutates them. */
function traceStep(step) {
    if (!step.id.trim())
        throw new TypeError('Trace step id is required');
    return Object.freeze({ ...step, inputRefs: Object.freeze([...step.inputRefs]), catalogRefs: Object.freeze(step.catalogRefs.map(x => Object.freeze({ ...x }))), input: Object.freeze({ ...step.input }), errorIds: Object.freeze([...step.errorIds]), warningIds: Object.freeze([...step.warningIds]) });
}
function aggregateStatus(statuses) {
    if (statuses.includes('calculation_error'))
        return 'calculation_error';
    if (statuses.includes('invalid_input'))
        return 'invalid_input';
    if (statuses.includes('unavailable'))
        return 'unavailable';
    return 'ok';
}
