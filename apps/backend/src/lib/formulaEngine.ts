type Context = Record<string, number | string | boolean>

function sanitizeFormula(formula: string): string {
  return formula
    // Заменяем "умные" кавычки на обычные
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    // Убираем невидимые Unicode-символы (zero-width, BOM и т.д.)
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    // Заменяем нестандартные минусы на обычный
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .trim()
}

export function evaluateFormula(formula: string, context: Context): number | string | boolean {
  let expr = sanitizeFormula(formula)

  expr = replaceIf(expr)

  expr = expr
    .replace(/\bround\s*\(/g, '__round(')
    .replace(/\bfloor\s*\(/g, '__floor(')
    .replace(/\bceil\s*\(/g, '__ceil(')
    .replace(/\bmin\s*\(/g, '__min(')
    .replace(/\bmax\s*\(/g, '__max(')
    .replace(/\babs\s*\(/g, '__abs(')
    .replace(/\bsqrt\s*\(/g, '__sqrt(')

  const varNames = Object.keys(context)
  const varValues = Object.values(context)

  const fnBody = `
    const __round = (x, d = 0) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
    const __floor = Math.floor;
    const __ceil = Math.ceil;
    const __min = Math.min;
    const __max = Math.max;
    const __abs = Math.abs;
    const __sqrt = Math.sqrt;
    return (${expr});
  `

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...varNames, fnBody)
    const result = fn(...varValues)
    return result
  } catch (e) {
    throw new Error(`Ошибка в формуле "${formula}": ${(e as Error).message}`)
  }
}

function replaceIf(expr: string): string {
  let result = expr
  let iterations = 0
  while (/\bif\s*\(/.test(result) && iterations < 50) {
    result = result.replace(/\bif\s*\(/, '__IF__(')
    const start = result.indexOf('__IF__(')
    if (start === -1) break
    const argsStart = start + 7
    const args = extractArgs(result, argsStart)
    if (!args || args.length < 3) break
    const [cond, trueVal, falseVal] = args
    const replacement = `((${cond}) ? (${trueVal}) : (${falseVal}))`
    const end = argsStart + getArgsLength(result, argsStart)
    result = result.slice(0, start) + replacement + result.slice(end + 1)
    iterations++
  }
  return result
}

function extractArgs(expr: string, start: number): string[] | null {
  const args: string[] = []
  let depth = 0
  let current = ''
  let i = start
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') {
      if (depth === 0) { args.push(current.trim()); break }
      depth--
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim())
      current = ''
      i++
      continue
    }
    current += ch
    i++
  }
  return args.length >= 3 ? args : null
}

function getArgsLength(expr: string, start: number): number {
  let depth = 0
  let i = start
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') {
      if (depth === 0) return i - start
      depth--
    }
    i++
  }
  return i - start
}
