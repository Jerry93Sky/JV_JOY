import type { UnifiedFamily } from '@bms/shared'

/** Only construction choices, dimensions and work switches are accepted from the UI. */
export const JV_UI_SCHEMA_VERSION = 'JV-UI-INPUTS-2'
export const JV_UI_LEGACY_SCHEMA_VERSION = 'JV-UI-INPUTS-1'
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

type UiOption = { value: string | number; label: string; supported: boolean }
export type UiField = { path: string; label: string; type: 'decimal' | 'boolean' | 'select'; unit?: string; options?: UiOption[]; status: 'CONFIRMED' | 'LIMITED'; source?: string; dependsOn?: string }
const glass = ['6 мм проз.','6 мм освет.','6 мм тон.','6 мм мат.','8 мм проз.','8 мм освет.','8 мм тон.','8 мм мат.','10 мм проз.','10 мм освет.','10 мм тон.','10 мм мат.']
const finish = ['некраш.','глянец','матовый','муар']
const transport = ['Самовывоз','Отправка через ТК','Доставка на объект']
// #2!C11:C14, C17:C33 and F17:F35; names only, no prices.
const frontClosers = ['НЕТ','82 DH Петля-доводчик нижняя, SSS','DORMA BTS 60 доводчик, шир. 1000, вес до 80 кг','DORMA BTS 65 доводчик с фикс., шир. 1100, вес до 100 кг']
const frontHandles = ['НЕТ','LN-190 Штатная ручка-кноб Line (691, сатин)','691 Ручка-кноб, SSS (сатин)','691 Ручка-кноб SBLC (матовая чёрная)','691-1 Ручка-кноб односторонняя SSS (сатин)','010 Ручка 32x800 с оргстеклом','010 Ручка 32x800 с оргстеклом','HDL-627 Ручка 32x600 скоба, SSS (Пономарёв)','625 Ручка 20x10x275 прямоугольная, SSS','HDL-633 Ручка прямая 32x425x600, PSS (Пономарёв)','HDL-633 Ручка прямая 32x425x600, PSS (Пономарёв)','139 Ручка 20x280 дугой, PSS (хром глянец)','645А Ручка 38x275x600, PSS + чёрное дерево','293 Ручка пряма 32x625x800 SSS','670 Ручка 32x825x1000 крепл. под 45гр., SSS','671 Ручка 32x625x800 крепл. под 45гр., SSS','HDL-639 Ручка 32x600 эллипсовидная, SSS (Пономарёв)']
const frontLocks = ['НЕТ','ZMD122-812 A Замок и ответка c наж.ручкой, SSS','013 Замок с наж.ручкой и отв. на стекло без притвора, SSS','86 Замок с наж. ручкой, притвор, отв на стекло, SSS','86 Замок с наж. ручкой, притвор, отв на стекло, чёрный','87 Замок с наж. ручкой, притвор, отв на стекло, SSS','87 Замок с наж. ручкой, притвор, отв на стекло, AL','860 Защёлка WC, наж.ручка, отв.на стекло, AL+SSS','007 Замок с ответной частью на стену, SSS','008 Замок с ответной частью на стекло, SSS','0','030 Защелка с притвором, вороток, SSS','032 Защелка с воротком, отв. на стену и в пол, SSS','034 Замок большой, отв. на стену и в пол, SSS','150RN Замок нижний фитинг с круглым ригелем, SSS','ZSD122-016A Замок с усами, отв.на стекло, +вороток, SSS','ZSD122-016B Замок с усами, отв. на стену, +вороток, SSS','122-136A-1 Замок для расп.дв. с отв.на стекло, SSS','К05-4 Замок для душ.кабины с отв. на стекло, SSS']
const labels: Record<string, string> = { widthMm:'Ширина',heightMm:'Высота',leaves:'Количество створок',leafCount:'Количество створок',leafSelector:'Количество створок',sectionDemand:'Количество секций',openingSelector:'Вариант открывания',commercialModeIndex:'Транспортная опция',F28:'Транспортная опция',mainSurchargeSelector:'Транспортная опция',glassSelectionIndex:'Тип стекла',glassSelector:'Тип стекла',glassTypeSelector:'Тип стекла',finishSelectionIndex:'Отделка',finishSelector:'Отделка',priceMode:'Отделка',sideCount:'Количество сторон',direction:'Направление',connectorAngle:'Угол соединения',profileCount:'Количество профилей',C18:'Выбор ширины двери',C19:'Высота двери / фрамуга',C20:'Примыкание двери',C21:'Доводчик',C22:'Ручка',C23:'Замок',C24:'Дополнительный замок',D18:'Ширина двери',D19:'Высота двери',glassEnabled:'Стекло',finishingEnabled:'Отделка',glassServiceEnabled:'Обработка стекла',installationEnabled:'Монтаж' }
Object.assign(labels, { frameState:'Монтажная рама',knobState:'Ручка-кноб',latchState:'Защёлка',weatherSealState:'Уплотнитель',floorLockState:'Замок в пол',bottomPivotState:'Напольный доводчик',specialSashEnabled:'Специальное полотно',specialSashWidthMm:'Ширина специального полотна',rollerAxisToEdgeMm:'Ось ролика до края',parkedDoorSelected:'Паркуемая дверь',parkedDoorPosition:'Позиция паркуемой двери',parkedDoorReuseOpening:'Использовать ширину проёма',parkedDoorWidthMm:'Ширина паркуемой двери',c8:'Параметр комплектации C8',N40:'Ручное количество N40',N41:'Ручное количество N41' })
const keys = (values: readonly (string | number)[], names?: readonly string[], unsupported: readonly (string | number)[] = []): UiOption[] => values.map((value, i) => ({ value, label: names?.[i] ?? String(value), supported: !unsupported.includes(value) }))
export function getUiMetadata(family: UnifiedFamily, template: RecordValue): UiField[] {
  const defaults = getUiDefaults(family, template)
  return Object.entries(defaults).map(([path, value]) => {
    const name = path.split('.').pop()!, label = labels[name] ?? `Параметр ${name}`
    const field: UiField = { path, label, type: typeof value === 'boolean' ? 'boolean' : 'decimal', status: 'CONFIRMED' }
    if (['widthMm','heightMm','specialSashWidthMm','rollerAxisToEdgeMm','parkedDoorWidthMm','D18','D19'].includes(name)) field.unit = 'мм'
    if (path === 'construction.controls.D18') { field.source = 'F1!D18'; field.dependsOn = 'Дверь доступна и C18=2' }
    if (path === 'construction.controls.D19') { field.source = 'F1!D19'; field.dependsOn = 'Дверь доступна и C19=2' }
    let options: UiOption[] | undefined
    if (['commercialModeIndex','F28','mainSurchargeSelector'].includes(name)) { options = keys([1,2,3], transport, [3]); field.source = 'Главная!F28 → #1!C29:C31'; field.dependsOn = family === 'FRONT' ? 'Общий параметр заказа; вариант 3 не подтверждён. Для слота 7 используется серверный контекст B26' : 'Общий параметр заказа; вариант 3 не подтверждён для смешанного заказа' }
    else if (['glassSelectionIndex','glassSelector','glassTypeSelector'].includes(name)) { options = keys(Array.from({length:12}, (_,i)=>i+1), glass); field.source = 'Главная!I11 → #1!C11:C22' }
    else if (['finishSelectionIndex','finishSelector','priceMode'].includes(name)) { options = keys([1,2,3,4], finish); field.source = 'Главная!H11 → #1!C24:C27' }
    else if (name === 'openingSelector') { options = family === 'FRONT' ? keys([1,2,3,4],['налево','направо','2-сторон.','нет'],[1,2,3]) : keys([1,2,3],['налево','направо','2-сторон.']); field.source = 'Главная!J11 → #1!K3:K6'; if (family === 'FRONT') field.dependsOn = 'При серверной настройке I42=1 варианты 1–3 недоступны' }
    else if (path === 'input.direction') options = keys(['НАЛЕВО','НАПРАВО','ДВУХСТОР'])
    else if (typeof value === 'string' && (value === 'ДА' || value === 'НЕТ')) options = keys(['ДА','НЕТ'])
    else if (name === 'sideCount') options = keys(['1','2'])
    else if (name === 'connectorAngle') options = keys(['90','135'])
    else if (path === 'construction.controls.C18') { options = keys([1,2],['Как все','Особая']); field.source = 'F1!C18 → #2!C45:C46'; field.dependsOn = 'Дверь доступна; список зависит от числа секций и дверей' }
    else if (path === 'construction.controls.C19') { options = keys([1,2],['На всю высоту','Особая']); field.source = 'F1!C19 → #2!I6:I7'; field.dependsOn = 'Дверь доступна' }
    else if (path === 'construction.controls.C20') { options = keys([1,2,3],['Стекло — дверь — стекло','Стена — дверь — стекло','Стена — дверь — стена']); field.source = 'F1!C20 → #2!C42:C44'; field.dependsOn = 'Доступность определяется числом секций и дверей' }
    else if (family === 'FRONT' && ['C21','C22','C23','C24'].includes(name)) {
      const names = name === 'C21' ? frontClosers : name === 'C22' ? frontHandles : frontLocks
      options = names.map((label, index) => ({ value: index + 1, label, supported: index + 1 === value }))
      field.source = name === 'C21' ? 'F1!C21 → #2!C11:C14' : name === 'C22' ? 'F1!C22 → #2!C17:C33' : `F1!${name} → #2!F17:F35`
      field.dependsOn = 'Другие варианты требуют подтверждения parity; при отсутствии двери настройка недоступна'
      field.status = 'LIMITED'
    }
    else if (typeof value === 'number' || name === 'jointPairSelection') { options = keys([value as string | number]); field.status = 'LIMITED'; field.dependsOn = 'Другие варианты не подтверждены для текущего интерфейса' }
    if (options) { field.type = 'select'; field.options = options; if (options.some(option => !option.supported)) field.status = 'LIMITED' }
    return field
  })
}

export function validateUiOptions(family: UnifiedFamily, template: RecordValue, userInputs: RecordValue): string[] {
  const issues = getUiMetadata(family, template).flatMap(field => field.options && !field.options.some(option => option.supported && option.value === userInputs[field.path]) ? [`${field.path}: unsupported selector`] : [])
  if (family === 'FRONT' && userInputs['construction.openingSelector'] === 4) {
    const defaults = getUiDefaults(family, template)
    for (const path of ['C18','C19','C20','C21','C22','C23','C24','D18','D19'].map(name => `construction.controls.${name}`)) {
      if (userInputs[path] !== defaults[path]) issues.push(`${path}: unavailable without a door`)
    }
  }
  return issues
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
