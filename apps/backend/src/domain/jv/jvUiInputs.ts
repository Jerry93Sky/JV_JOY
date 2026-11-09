import type { UnifiedFamily } from '@bms/shared'

/** Only construction choices, dimensions and work switches are accepted from the UI. */
export const JV_UI_SCHEMA_VERSION = 'JV-UI-INPUTS-1'
const line = ['commercialModeIndex','glassSelectionIndex','finishSelectionIndex','widthMm','heightMm','leaves','sideCount','direction','profileCount','connectorAngle','frameState','knobState','latchState','weatherSealState','floorLockState','bottomPivotState','specialSashEnabled','specialSashWidthMm','rollerAxisToEdgeMm','parkedDoorSelected','parkedDoorPosition','parkedDoorReuseOpening','parkedDoorWidthMm'].map(x => `input.${x}`)
const zigzag = ['widthMm','heightMm','leafSelector','openingSelector'].map(x => `position.geometry.${x}`).concat(['c8','F28','glassTypeSelector','N40','N41'].map(x => `position.commercial.${x}`))
const sliderGeometry = ['widthMm','heightMm','leafCount','openingSelector'].map(x => `geometry.${x}`)
const sliderControls = ['priceMode','mainSurchargeSelector','glassSelector'].map(x => `controls.${x}`)
const slider = sliderGeometry.concat(sliderControls)
const front = ['widthMm','heightMm','sectionDemand','finishSelector','glassSelector','openingSelector'].map(x => `construction.${x}`).concat(['C18','C19','C20','C21','C22','C23','C24','D18','D19'].map(x => `construction.controls.${x}`), ['glassEnabled','finishingEnabled','glassServiceEnabled','installationEnabled','mainSurchargeSelector'].map(x => `commercial.${x}`))

export const JV_UI_INPUT_PATHS: Readonly<Record<UnifiedFamily, readonly string[]>> = {
  LINE: line,
  ZIGZAG: zigzag,
  SLIDER_L3: slider,
  SLIDER_L5: slider,
  SLIDER_X3: slider,
  SLIDER_X5: slider,
  FRONT: front,
}

type RecordValue = Record<string, unknown>
function record(value: unknown): value is RecordValue { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function location(root: RecordValue, path: string): { parent: RecordValue; key: string } {
  const parts = path.split('.'); const key = parts.pop()!; let parent = root
  for (const part of parts) {
    if (!record(parent[part])) throw new Error(`Missing configured UI field ${path}`)
    parent = parent[part] as RecordValue
  }
  if (!Object.hasOwn(parent, key)) throw new Error(`Missing configured UI field ${path}`)
  return { parent, key }
}

/** Returns only explicitly permitted fields, never the source snapshots or settings. */
export function getUiDefaults(family: UnifiedFamily, template: RecordValue): RecordValue {
  return Object.fromEntries(JV_UI_INPUT_PATHS[family].map(path => {
    const { parent, key } = location(template, path)
    return [path, parent[key]]
  }))
}

export function hydrateUiInputs(family: UnifiedFamily, template: RecordValue, userInputs: RecordValue): { calculation?: RecordValue; issues: string[] } {
  const allowed = JV_UI_INPUT_PATHS[family]
  const issues = Object.keys(userInputs).filter(key => !allowed.includes(key)).map(key => `${key}: field is not user-editable`)
  for (const key of allowed) if (!Object.hasOwn(userInputs, key)) issues.push(`${key}: required input is missing`)
  if (issues.length) return { issues }
  const calculation = structuredClone(template)
  for (const path of allowed) {
    const { parent, key } = location(calculation, path)
    parent[key] = userInputs[path]
  }
  return { calculation, issues }
}
