/**
 * Скрипт импорта данных из Excel файла JV-комплектация
 * Запуск: pnpm exec tsx src/prisma/import-excel.ts
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'

const prisma = new PrismaClient()

// ─── Парсер XML ──────────────────────────────────────────────────────────────

function parseXML(content: string) {
  const parser = new DOMParser()
  return parser.parseFromString(content, 'text/xml')
}

function getTextContent(node: import('@xmldom/xmldom').Element | null): string {
  if (!node) return ''
  return node.textContent || ''
}

// ─── Чтение Excel ────────────────────────────────────────────────────────────

interface SheetData {
  name: string
  rows: string[][]
}

async function readExcel(filePath: string): Promise<{ sheets: SheetData[]; sharedStrings: string[] }> {
  const buffer = fs.readFileSync(filePath)
  const zip = await JSZip.loadAsync(buffer)

  // Shared strings
  const ssFile = zip.file('xl/sharedStrings.xml')
  const sharedStrings: string[] = []
  if (ssFile) {
    const ssXml = await ssFile.async('string')
    const ssDoc = parseXML(ssXml)
    const siNodes = ssDoc.getElementsByTagName('si')
    for (let i = 0; i < siNodes.length; i++) {
      const tNodes = siNodes[i].getElementsByTagName('t')
      let text = ''
      for (let j = 0; j < tNodes.length; j++) text += getTextContent(tNodes[j])
      sharedStrings.push(text)
    }
  }

  // Sheet names
  const wbFile = zip.file('xl/workbook.xml')
  const sheetMap: Record<string, string> = {} // rId -> name
  const relMap: Record<string, string> = {}   // rId -> target
  if (wbFile) {
    const wbXml = await wbFile.async('string')
    const wbDoc = parseXML(wbXml)
    const sheetNodes = wbDoc.getElementsByTagName('sheet')
    for (let i = 0; i < sheetNodes.length; i++) {
      const s = sheetNodes[i]
      const rid = s.getAttribute('r:id') || ''
      const name = s.getAttribute('name') || ''
      sheetMap[rid] = name
    }
  }

  const relsFile = zip.file('xl/_rels/workbook.xml.rels')
  if (relsFile) {
    const relsXml = await relsFile.async('string')
    const relsDoc = parseXML(relsXml)
    const relNodes = relsDoc.getElementsByTagName('Relationship')
    for (let i = 0; i < relNodes.length; i++) {
      const r = relNodes[i]
      relMap[r.getAttribute('Id') || ''] = r.getAttribute('Target') || ''
    }
  }

  // Parse each sheet
  const sheets: SheetData[] = []
  for (const [rid, sheetName] of Object.entries(sheetMap)) {
    const target = relMap[rid]
    if (!target) continue
    const sheetPath = target.startsWith('xl/') ? target : `xl/${target}`
    const sheetFile = zip.file(sheetPath)
    if (!sheetFile) continue

    const sheetXml = await sheetFile.async('string')
    const sheetDoc = parseXML(sheetXml)
    const rowNodes = sheetDoc.getElementsByTagName('row')
    const rows: string[][] = []

    for (let i = 0; i < rowNodes.length; i++) {
      const cellNodes = rowNodes[i].getElementsByTagName('c')
      const row: string[] = []
      for (let j = 0; j < cellNodes.length; j++) {
        const c = cellNodes[j]
        const t = c.getAttribute('t') || ''
        const vNode = c.getElementsByTagName('v')[0]
        const v = vNode ? getTextContent(vNode) : ''
        if (t === 's') {
          row.push(sharedStrings[parseInt(v)] || '')
        } else {
          row.push(v)
        }
      }
      if (row.some(x => x !== '')) rows.push(row)
    }
    sheets.push({ name: sheetName, rows })
  }

  return { sheets, sharedStrings }
}

// ─── Извлечение данных из прайс-листов ───────────────────────────────────────

interface ProductRow {
  sku: string
  name: string
  unit: string
  costPrice: number
  paintPerimeter?: number // мм периметра для покраски
  isPaintable: boolean
  typeHint: string // подсказка для определения типа
}

function parsePrice(val: string): number {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

// Парсер для листа "Прайс-Аксессуары"
// Структура: колонка B = "АРТИКУЛ  Название" или просто название, D = цена СС
// Важно: ячейки читаются по атрибуту r (ссылка), т.к. A пустая и пропускается в XML
function extractAccessories(sheet: SheetData): ProductRow[] {
  const products: ProductRow[] = []
  const skuAtStart = /^([A-ZА-Я0-9][A-ZА-Я0-9\-\.]{0,20}(?:-[A-Z0-9]+)?)\s{1,4}(.+)/i
  const skipNames = new Set(['Наименование', 'АКСЕССУАРЫ', 'пог/штучн.', 'Нет', '#REF!', '0', '', 'Тип', 'CC', 'руб.', 'Цена'])

  for (const row of sheet.rows) {
    // row[0] = первая непустая ячейка (обычно B, т.к. A пустая)
    const rawName = (row[0] || '').trim()
    // Цена в колонке D = row[2] (B=0, C=1, D=2 — но A пустая, значит B=0, C=1, D=2)
    const priceRaw = row[2] || row[3] || ''
    const price = parseFloat(priceRaw)

    if (!rawName || isNaN(price) || price <= 0 || skipNames.has(rawName)) continue

    let sku = ''
    let name = rawName

    const m = rawName.match(skuAtStart)
    if (m) {
      sku = m[1].trim()
      name = m[2].trim()
    } else {
      // Нет явного артикула — генерируем
      const words = rawName.split(/\s+/)
      sku = `ACC-${words[0].replace(/[^A-Z0-9]/gi, '').substring(0, 8).toUpperCase()}`
      name = rawName
    }

    if (!name || name.length < 3 || sku.length < 2) continue

    const nameL = name.toLowerCase()
    const isPaintable = nameL.includes('профил')

    products.push({
      sku,
      name: name.substring(0, 100),
      unit: 'шт',
      costPrice: Math.round(price * 100) / 100,
      isPaintable,
      typeHint: 'Прайс-Аксессуары',
    })
  }
  return products
}

// Парсер для листа "Прайс-Стекло"
// Структура: B = название, C = единица, D = цена СС
function extractGlass(sheet: SheetData): ProductRow[] {
  const products: ProductRow[] = []
  const glassTypes: Record<string, string> = {
    'прозрач': 'прозрачное',
    'осветлён': 'осветлённое',
    'тониров': 'тонированное',
    'матиров': 'матированное',
  }

  for (const row of sheet.rows) {
    const rawName = (row[0] || row[1] || '').trim()
    const unit = (row[1] || row[2] || 'кв.м').trim()
    const priceRaw = row[2] || row[3] || ''
    const price = parseFloat(priceRaw)

    if (!rawName || isNaN(price) || price <= 0) continue
    if (!rawName.toLowerCase().includes('стекл')) continue

    // Генерируем артикул из названия: GLASS-6-CLEAR, GLASS-8-TINTED и т.д.
    const thicknessMatch = rawName.match(/(\d+)\s*мм/)
    const thickness = thicknessMatch ? thicknessMatch[1] : '6'
    let typeKey = 'CLEAR'
    for (const [key, _] of Object.entries(glassTypes)) {
      if (rawName.toLowerCase().includes(key)) {
        typeKey = key.toUpperCase().substring(0, 5)
        break
      }
    }
    const sku = `GLASS-${thickness}-${typeKey}`

    products.push({
      sku,
      name: rawName.substring(0, 100),
      unit: unit || 'кв.м',
      costPrice: Math.round(price * 100) / 100,
      isPaintable: false,
      typeHint: 'Прайс-Стекло',
    })
  }
  return products
}

function extractProductsFromSheet(sheet: SheetData): ProductRow[] {
  const products: ProductRow[] = []
  // Ищем строки где первая или вторая колонка — артикул (содержит дефис или точку)
  const skuPattern = /^[A-Z0-9]{2,}-[A-Z0-9\-\.]+$|^[A-Z]{2,}\.[0-9]+\.[0-9]+$/i
  const unitWords = ['п.м', 'шт.', 'м', 'кв.м', 'комплект', 'пара', 'п/м', 'пог']

  for (const row of sheet.rows) {
    // Ищем артикул в первых 3 колонках
    let skuIdx = -1
    let sku = ''
    for (let i = 0; i < Math.min(3, row.length); i++) {
      const cell = (row[i] || '').trim()
      if (skuPattern.test(cell) && cell.length > 2 && cell.length < 30) {
        skuIdx = i
        sku = cell
        break
      }
    }
    if (skuIdx === -1 || !sku) continue

    const name = (row[skuIdx + 1] || '').trim()
    if (!name || name.length < 3) continue

    // Единица измерения
    let unit = 'шт.'
    for (let i = skuIdx + 2; i < Math.min(skuIdx + 4, row.length); i++) {
      const cell = (row[i] || '').toLowerCase().trim()
      if (unitWords.some(u => cell.includes(u.toLowerCase()))) {
        unit = row[i].trim()
        break
      }
    }

    // Цена (ищем первое числовое значение > 1 после артикула)
    let costPrice = 0
    for (let i = skuIdx + 2; i < Math.min(skuIdx + 6, row.length); i++) {
      const n = parseFloat(row[i] || '')
      if (!isNaN(n) && n > 1) {
        costPrice = Math.round(n * 100) / 100
        break
      }
    }
    if (costPrice === 0) continue

    // Периметр для покраски (мм) — обычно последние колонки
    let paintPerimeter: number | undefined
    for (let i = row.length - 1; i >= skuIdx + 3; i--) {
      const n = parseFloat(row[i] || '')
      if (!isNaN(n) && n > 50 && n < 2000) {
        paintPerimeter = n
        break
      }
    }

    // Определяем окрашиваемость — профили окрашиваемые, фурнитура нет
    const nameL = name.toLowerCase()
    const isPaintable = nameL.includes('профил') || nameL.includes('направляющ') || nameL.includes('боков')

    products.push({
      sku,
      name,
      unit: unit.replace('п.м', 'п.м.').replace('шт.', 'шт'),
      costPrice,
      paintPerimeter,
      isPaintable,
      typeHint: sheet.name,
    })
  }
  return products
}

// ─── Определение типа комплектующих ─────────────────────────────────────────

function guessProductType(product: ProductRow): string {
  const name = product.name.toLowerCase()
  const sku = product.sku.toLowerCase()
  const hint = product.typeHint

  if (hint === 'Прайс-Стекло' || sku.startsWith('glass-')) return 'Стекло'
  if (name.includes('профил') || name.includes('направляющ')) return 'Профиль'
  if (name.includes('уплотнит')) return 'Уплотнители'
  if (name.includes('заглушк')) return 'Заглушки'
  if (name.includes('ручк') || name.includes('кноб')) return 'Ручки'
  if (name.includes('замок') || name.includes('защёлк') || name.includes('фитинг')) return 'Замки и защёлки'
  if (name.includes('петл') || name.includes('шарнир') || name.includes('узел') || name.includes('доводчик')) return 'Петли и шарниры'
  if (name.includes('клей') || name.includes('активатор')) return 'Клей и химия'
  if (name.includes('стекл')) return 'Стекло'
  if (name.includes('сборк') || name.includes('монтаж')) return 'Услуги'
  if (hint === 'Прайс-Аксессуары') return 'Аксессуары'
  if (sku.startsWith('aa-')) return 'Аксессуары'
  return 'Фурнитура'
}

// ─── Импорт систем ───────────────────────────────────────────────────────────

// Параметры стекла — общие для всех систем
const GLASS_PARAMS = [
  {
    name: 'Тип стекла',
    variable: 'glass_type',
    type: 'SELECT',
    paramKind: 'INPUT',
    options: [
      { label: '6 мм прозрачное', value: '6clear' },
      { label: '6 мм осветлённое', value: '6light' },
      { label: '6 мм тонированное', value: '6tinted' },
      { label: '6 мм матированное', value: '6matte' },
      { label: '8 мм прозрачное', value: '8clear' },
      { label: '8 мм осветлённое', value: '8light' },
      { label: '8 мм тонированное', value: '8tinted' },
      { label: '8 мм матированное', value: '8matte' },
      { label: '10 мм прозрачное', value: '10clear' },
      { label: '10 мм осветлённое', value: '10light' },
      { label: '10 мм тонированное', value: '10tinted' },
      { label: '10 мм матированное', value: '10matte' },
    ],
    defaultValue: '6clear',
    showInProposal: true,
    showInAssembly: true,
  },
  // Цены за кв.м по типу стекла (константы, редактируются в настройках системы)
  { name: 'Цена стекла 6мм прозрачное (₽/м²)', variable: 'gp_6clear', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '4564', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 6мм осветлённое (₽/м²)', variable: 'gp_6light', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '8845', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 6мм тонированное (₽/м²)', variable: 'gp_6tinted', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '8845', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 6мм матированное (₽/м²)', variable: 'gp_6matte', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '7169', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 8мм прозрачное (₽/м²)', variable: 'gp_8clear', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '5553', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 8мм осветлённое (₽/м²)', variable: 'gp_8light', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '10956', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 8мм тонированное (₽/м²)', variable: 'gp_8tinted', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '10956', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 8мм матированное (₽/м²)', variable: 'gp_8matte', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '8565', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 10мм прозрачное (₽/м²)', variable: 'gp_10clear', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '6869', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 10мм осветлённое (₽/м²)', variable: 'gp_10light', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '13515', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 10мм тонированное (₽/м²)', variable: 'gp_10tinted', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '13515', showInProposal: false, showInAssembly: false },
  { name: 'Цена стекла 10мм матированное (₽/м²)', variable: 'gp_10matte', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '11493', showInProposal: false, showInAssembly: false },
  {
    // Рассчитываемая стоимость стекла — выбирает нужную цену по типу
    name: 'Стоимость стекла (₽)',
    variable: 'glass_cost',
    type: 'NUMBER',
    paramKind: 'CALCULATED',
    formula: `round(glassArea * if(glass_type == '6clear', gp_6clear, if(glass_type == '6light', gp_6light, if(glass_type == '6tinted', gp_6tinted, if(glass_type == '6matte', gp_6matte, if(glass_type == '8clear', gp_8clear, if(glass_type == '8light', gp_8light, if(glass_type == '8tinted', gp_8tinted, if(glass_type == '8matte', gp_8matte, if(glass_type == '10clear', gp_10clear, if(glass_type == '10light', gp_10light, if(glass_type == '10tinted', gp_10tinted, gp_10matte))))))))))), 0)`,
    showInProposal: true,
    showInAssembly: false,
  },
]

const SYSTEMS_CONFIG = [
  {
    name: 'JV-Line (Парковка)',
    sheetPrefix: 'L',
    params: [
      { name: 'Ширина проёма', variable: 'width', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '3000', showInProposal: true, showInAssembly: true },
      { name: 'Высота проёма', variable: 'height', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '2500', showInProposal: true, showInAssembly: true },
      { name: 'Количество створок', variable: 'panels', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '5', showInProposal: true, showInAssembly: true },
      { name: 'Боковой профиль', variable: 'hasSide', type: 'BOOLEAN', paramKind: 'INPUT', defaultValue: 'true', showInProposal: false, showInAssembly: false },
      { name: 'Коэффициент раскроя', variable: 'cutCoeff', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '0.9', showInProposal: false, showInAssembly: false },
      { name: 'Ширина несущего профиля', variable: 'bearingW', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '44', showInProposal: false, showInAssembly: false },
      { name: 'Высота несущего профиля', variable: 'bearingH', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '58', showInProposal: false, showInAssembly: false },
      { name: 'Ширина стекла', variable: 'glassWidth', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round((width - bearingW * 2) / panels, 0)', showInProposal: true, showInAssembly: true },
      { name: 'Высота стекла', variable: 'glassHeight', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(height - 50, 0)', showInProposal: true, showInAssembly: true },
      { name: 'Площадь остекления (м²)', variable: 'glassArea', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(width * height / 1000000, 2)', showInProposal: true, showInAssembly: false },
      { name: 'Масса системы (кг)', variable: 'totalWeight', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(glassArea * 15, 1)', showInProposal: true, showInAssembly: false },
      ...GLASS_PARAMS,
    ],
    limits: [
      { variable: 'width', min: 500, max: 12000 },
      { variable: 'height', min: 500, max: 3500 },
      { variable: 'panels', min: 2, max: 12 },
    ],
  },
  {
    name: 'JV-Zigzag (Гармошка)',
    sheetPrefix: 'Z',
    params: [
      { name: 'Ширина проёма', variable: 'width', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '3000', showInProposal: true, showInAssembly: true },
      { name: 'Высота проёма', variable: 'height', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '2500', showInProposal: true, showInAssembly: true },
      { name: 'Количество створок', variable: 'panels', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '5', showInProposal: true, showInAssembly: true },
      { name: 'Коэффициент раскроя', variable: 'cutCoeff', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '0.9', showInProposal: false, showInAssembly: false },
      { name: 'Ширина несущего профиля', variable: 'bearingW', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '44', showInProposal: false, showInAssembly: false },
      { name: 'Ширина стекла', variable: 'glassWidth', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round((width - bearingW * 2) / panels, 0)', showInProposal: true, showInAssembly: true },
      { name: 'Высота стекла', variable: 'glassHeight', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(height - 50, 0)', showInProposal: true, showInAssembly: true },
      { name: 'Площадь остекления (м²)', variable: 'glassArea', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(width * height / 1000000, 2)', showInProposal: true, showInAssembly: false },
      ...GLASS_PARAMS,
    ],
    limits: [
      { variable: 'width', min: 500, max: 10000 },
      { variable: 'height', min: 500, max: 3500 },
      { variable: 'panels', min: 2, max: 10 },
    ],
  },
  {
    name: 'JV-Slider (Раздвижка)',
    sheetPrefix: 'S',
    params: [
      { name: 'Ширина проёма', variable: 'width', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '3000', showInProposal: true, showInAssembly: true },
      { name: 'Высота проёма', variable: 'height', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '2500', showInProposal: true, showInAssembly: true },
      { name: 'Количество створок', variable: 'panels', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '3', showInProposal: true, showInAssembly: true },
      { name: 'Тип дорожек', variable: 'tracks', type: 'SELECT', paramKind: 'INPUT', defaultValue: '3',
        options: [{ label: '3 дорожки', value: '3' }, { label: '5 дорожек', value: '5' }],
        showInProposal: true, showInAssembly: true },
      { name: 'Коэффициент раскроя', variable: 'cutCoeff', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '0.8', showInProposal: false, showInAssembly: false },
      { name: 'Ширина стекла', variable: 'glassWidth', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(width / panels, 0)', showInProposal: true, showInAssembly: true },
      { name: 'Высота стекла', variable: 'glassHeight', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(height - 60, 0)', showInProposal: true, showInAssembly: true },
      { name: 'Площадь остекления (м²)', variable: 'glassArea', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(width * height / 1000000, 2)', showInProposal: true, showInAssembly: false },
      ...GLASS_PARAMS,
    ],
    limits: [
      { variable: 'width', min: 600, max: 8000 },
      { variable: 'height', min: 500, max: 3000 },
    ],
  },
  {
    name: 'JV-Front (Стационарное)',
    sheetPrefix: 'F',
    params: [
      { name: 'Ширина проёма', variable: 'width', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '3000', showInProposal: true, showInAssembly: true },
      { name: 'Высота проёма', variable: 'height', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '2500', showInProposal: true, showInAssembly: true },
      { name: 'Количество стёкол', variable: 'panels', type: 'NUMBER', paramKind: 'INPUT', defaultValue: '5', showInProposal: true, showInAssembly: true },
      { name: 'Зазор между стёклами', variable: 'gap', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '6', showInProposal: false, showInAssembly: false },
      { name: 'Коэффициент раскроя', variable: 'cutCoeff', type: 'NUMBER', paramKind: 'CONSTANT', defaultValue: '0.8', showInProposal: false, showInAssembly: false },
      { name: 'Ширина стекла', variable: 'glassWidth', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round((width - gap * (panels - 1)) / panels, 0)', showInProposal: true, showInAssembly: true },
      { name: 'Высота стекла', variable: 'glassHeight', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(height - 20, 0)', showInProposal: true, showInAssembly: true },
      { name: 'Площадь остекления (м²)', variable: 'glassArea', type: 'NUMBER', paramKind: 'CALCULATED', formula: 'round(width * height / 1000000, 2)', showInProposal: true, showInAssembly: false },
      ...GLASS_PARAMS,
    ],
    limits: [
      { variable: 'width', min: 300, max: 6000 },
      { variable: 'height', min: 300, max: 4000 },
    ],
  },
]

// ─── Главная функция импорта ─────────────────────────────────────────────────

async function main() {
  const excelPath = path.resolve(process.cwd(), '../../JV-комплектация 25.02.2026.xlsx')

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Файл не найден: ${excelPath}`)
    process.exit(1)
  }

  console.log('📂 Читаем Excel файл...')
  const { sheets } = await readExcel(excelPath)

  const priceSheets = ['Прайс-Line', 'Прайс-Slider', 'Прайс-Front', 'Прайс-Аксессуары']
  const serviceSheet = sheets.find(s => s.name === 'Прайс-сб+монт')

  // ── 1. Типы комплектующих ──────────────────────────────────────────────────
  console.log('\n📦 Создаём типы комплектующих...')
  const typeNames = ['Профиль', 'Фурнитура', 'Уплотнители', 'Заглушки', 'Ручки', 'Замки и защёлки', 'Петли и шарниры', 'Клей и химия', 'Стекло', 'Аксессуары']
  const typeMap: Record<string, string> = {}
  for (const name of typeNames) {
    const existing = await prisma.productType.findUnique({ where: { name } })
    const t = existing || await prisma.productType.create({ data: { name } })
    typeMap[name] = t.id
    console.log(`  ✓ ${name}`)
  }

  // ── 2. Товары из прайс-листов ──────────────────────────────────────────────
  console.log('\n🔩 Импортируем товары...')
  let productCount = 0
  let skipped = 0
  const allProducts: ProductRow[] = []

  for (const sheetName of priceSheets) {
    const sheet = sheets.find(s => s.name === sheetName)
    if (!sheet) { console.log(`  ⚠️  Лист "${sheetName}" не найден`); continue }

    let products: ProductRow[]
    if (sheetName === 'Прайс-Аксессуары') {
      products = extractAccessories(sheet)
    } else {
      products = extractProductsFromSheet(sheet)
    }

    allProducts.push(...products)
    console.log(`  📋 ${sheetName}: найдено ${products.length} позиций`)
  }

  // Создаём поставщика JV
  let supplier = await prisma.supplier.findFirst({ where: { name: 'JV (импорт из Excel)' } })
  if (!supplier) supplier = await prisma.supplier.create({ data: { name: 'JV (импорт из Excel)' } })

  // Создаём приходной документ
  const { addDays } = await import('../lib/dateUtils')
  const receipt = await prisma.receipt.create({
    data: {
      supplierId: supplier.id,
      date: new Date(),
      editableUntil: addDays(new Date(), 10),
    },
  })

  for (const p of allProducts) {
    const typeName = guessProductType(p)
    const typeId = typeMap[typeName] || typeMap['Фурнитура']

    // Проверяем дубликаты
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } })
    if (existing) { skipped++; continue }

    const markup = 30 // базовая наценка 30%
    const priceRetail = Math.round(p.costPrice * 1.3 * 100) / 100
    const priceWholesale = Math.round(p.costPrice * 1.15 * 100) / 100

    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        typeId,
        unit: p.unit || 'шт',
        isPaintable: p.isPaintable,
        markupRetail: markup,
        markupWholesale: 15,
        priceRetail,
        priceWholesale,
        quantity: 0,
      },
    })

    // Добавляем в приход с нулевым количеством (только для фиксации цены)
    await prisma.receiptItem.create({
      data: {
        receiptId: receipt.id,
        productId: product.id,
        quantity: 0,
        costPrice: p.costPrice,
      },
    })

    productCount++
    console.log(`  ✓ [${p.sku}] ${p.name.substring(0, 50)}`)
  }

  console.log(`\n  Итого: создано ${productCount}, пропущено дублей ${skipped}`)

  // ── 3. Услуги ──────────────────────────────────────────────────────────────
  console.log('\n🔧 Импортируем услуги...')
  const defaultServices: { name: string; price?: number; priceFormula?: string; unit: string }[] = [
    { name: 'Сборка Line', price: 1500, unit: 'п.м.' },
    { name: 'Сборка Zigzag', price: 1800, unit: 'п.м.' },
    { name: 'Сборка Slider', price: 1200, unit: 'п.м.' },
    { name: 'Сборка Front', price: 1000, unit: 'п.м.' },
    { name: 'Монтаж', priceFormula: 'width / 1000 * 2000', unit: 'п.м.' },
    { name: 'Склейка', priceFormula: 'panels * 800', unit: 'шт' },
    { name: 'Доставка', price: 3000, unit: 'шт' },
  ]

  for (const svc of defaultServices) {
    const existing = await prisma.service.findFirst({ where: { name: svc.name } })
    if (!existing) {
      await prisma.service.create({
        data: {
          name: svc.name,
          unit: svc.unit,
          ...(svc.price !== undefined ? { price: svc.price } : {}),
          ...(svc.priceFormula !== undefined ? { priceFormula: svc.priceFormula } : {}),
        },
      })
      console.log(`  ✓ ${svc.name}`)
    }
  }

  // Пробуем извлечь из листа
  if (serviceSheet) {
    for (const row of serviceSheet.rows) {
      const name = (row[0] || '').trim()
      const priceVal = parseFloat(row[1] || '')
      if (name && !isNaN(priceVal) && priceVal > 0 && name.length > 3) {
        const existing = await prisma.service.findFirst({ where: { name } })
        if (!existing) {
          await prisma.service.create({ data: { name, price: priceVal } })
          console.log(`  ✓ ${name}: ${priceVal} ₽`)
        }
      }
    }
  }

  // ── 4. Системы остекления ──────────────────────────────────────────────────
  console.log('\n🏗️  Создаём системы остекления...')

  for (const config of SYSTEMS_CONFIG) {
    const existing = await prisma.glazingSystem.findFirst({ where: { name: config.name } })
    if (existing) {
      console.log(`  ⚠️  Система "${config.name}" уже существует, пропускаем`)
      continue
    }

    const system = await prisma.glazingSystem.create({ data: { name: config.name } })
    console.log(`  ✓ Система: ${config.name}`)

    // Параметры
    for (const param of config.params) {
      const created = await prisma.systemParameter.create({
        data: {
          systemId: system.id,
          name: param.name,
          variable: param.variable,
          type: param.type as never,
          paramKind: param.paramKind as never,
          defaultValue: param.defaultValue,
          formula: (param as { formula?: string }).formula,
          options: (param as { options?: unknown }).options ? JSON.stringify((param as { options: unknown }).options) : undefined,
          showInProposal: param.showInProposal,
          showInAssembly: param.showInAssembly,
        },
      })

      // Лимиты
      const limit = config.limits?.find(l => l.variable === param.variable)
      if (limit) {
        await prisma.systemLimit.create({
          data: {
            parameterId: created.id,
            minValue: limit.min,
            maxValue: limit.max,
          },
        })
      }
      console.log(`    + параметр: ${param.name}`)
    }
  }

  // ── 5. Настройки ──────────────────────────────────────────────────────────
  console.log('\n⚙️  Обновляем настройки...')
  await prisma.setting.upsert({
    where: { key: 'glass_markup_pct' },
    update: { value: '30' },
    create: { key: 'glass_markup_pct', value: '30' },
  })
  console.log('  ✓ Наценка на стекло: 30%')

  console.log('\n✅ Импорт завершён!')
  console.log(`   Товаров создано: ${productCount}`)
  console.log('   Системы: JV-Line, JV-Zigzag, JV-Slider, JV-Front')
  console.log('   Услуги: сборка, монтаж, склейка, доставка')
  console.log('\n⚠️  Важно: формулы расчёта комплектующих для каждой системы')
  console.log('   нужно настроить вручную в разделе "Системы" → вкладка "Комплектующие"')
  console.log('   т.к. они зависят от конкретной конфигурации объекта.')
}

main()
  .catch(e => { console.error('❌ Ошибка:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
