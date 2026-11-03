import { prisma } from './prisma'
import { evaluateFormula } from './formulaEngine'

interface DealExtrasResult {
  calcGlassPrice: number
  calcInstallPrice: number
  calcPaintingPrice: number
  calcTransportPrice: number
}

async function getSetting(key: string, defaultVal: number): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s ? parseFloat(s.value) || defaultVal : defaultVal
}

/**
 * Рассчитывает расчётные цены стекла, монтажа, покраски и транспорта для сделки.
 * Использует параметры систем (переменные glass_price, install_price) и настройки.
 */
export async function calculateDealExtras(dealId: string): Promise<DealExtrasResult> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      systems: { include: { system: { include: { parameters: true } } } },
      items: { include: { product: true } },
    },
  })
  if (!deal) return { calcGlassPrice: 0, calcInstallPrice: 0, calcPaintingPrice: 0, calcTransportPrice: 0 }

  // ── Стекло ────────────────────────────────────────────────────────────────
  let calcGlassPrice = 0
  if (deal.glassSupply === 'OURS') {
    for (const ds of deal.systems) {
      const calcParams = (ds.calcParams || {}) as Record<string, unknown>
      const inputParams = (ds.inputParams || {}) as Record<string, unknown>
      // Объединяем input + calc параметры как контекст
      const context: Record<string, number | string | boolean> = {}
      for (const [k, v] of Object.entries(inputParams)) context[k] = v as never
      for (const [k, v] of Object.entries(calcParams)) context[k] = v as never
      // Добавляем константы системы в контекст
      if (ds.system) {
        for (const p of ds.system.parameters.filter(p => p.paramKind === 'CONSTANT')) {
          context[p.variable] = p.defaultValue ? parseFloat(p.defaultValue) : 0
        }
      }

      const glassFormula = ds.system?.glassFormula
      if (glassFormula) {
        // Вычисляем по формуле системы
        try {
          calcGlassPrice += Number(evaluateFormula(glassFormula, context)) || 0
        } catch { /* игнорируем ошибку */ }
      } else {
        // Fallback: ищем переменную glass_price / glass_cost в calcParams
        const glassVal = calcParams['glass_price'] ?? calcParams['glass_cost'] ?? calcParams['стоимость_стекла'] ?? 0
        calcGlassPrice += Number(glassVal) || 0
      }
    }
    // Применяем наценку
    const glassMarkup = await getSetting('glass_markup_pct', 30)
    calcGlassPrice = calcGlassPrice * (1 + glassMarkup / 100)
  }

  // ── Монтаж ────────────────────────────────────────────────────────────────
  let calcInstallPrice = 0
  if (deal.includeInstall) {
    for (const ds of deal.systems) {
      const calcParams = (ds.calcParams || {}) as Record<string, unknown>
      const inputParams = (ds.inputParams || {}) as Record<string, unknown>
      const context: Record<string, number | string | boolean> = {}
      for (const [k, v] of Object.entries(inputParams)) context[k] = v as never
      for (const [k, v] of Object.entries(calcParams)) context[k] = v as never
      if (ds.system) {
        for (const p of ds.system.parameters.filter(p => p.paramKind === 'CONSTANT')) {
          context[p.variable] = p.defaultValue ? parseFloat(p.defaultValue) : 0
        }
      }

      const installFormula = ds.system?.installFormula
      if (installFormula) {
        try {
          calcInstallPrice += Number(evaluateFormula(installFormula, context)) || 0
        } catch { /* игнорируем */ }
      } else {
        const installVal = calcParams['install_price'] ?? calcParams['монтаж'] ?? calcParams['installation'] ?? 0
        calcInstallPrice += Number(installVal) || 0
      }
    }
  }

  // ── Покраска ──────────────────────────────────────────────────────────────
  let calcPaintingPrice = 0
  if (deal.needPainting) {
    const minPrice = await getSetting('painting_min_price', 0)
    const defaultPricePerUnit = await getSetting('painting_price_per_unit', 0)
    const defaultPricePerMeter = await getSetting('painting_price_per_meter', 0)
    const hammertoneMarkup = await getSetting('painting_hammertone_markup_pct', 15)
    const paintingMarkup = await getSetting('painting_markup_pct', 0) // наценка на покраску

    const paintableItems = deal.items.filter(i => i.product.isPaintable && i.paintColor)

    if (deal.paintAllOneColor) {
      // Один цвет — считаем всё вместе, применяем минимальную цену один раз
      let sum = 0
      for (const item of paintableItems) {
        const qty = Number(item.quantity)
        const unit = item.product.unit.toLowerCase()
        const isLinear = unit.includes('п.м') || unit === 'м'
        let basePrice: number
        if (isLinear) {
          const productPrice = Number((item.product as never as { paintingPricePerMeter?: number }).paintingPricePerMeter || 0)
          basePrice = (productPrice > 0 ? productPrice : defaultPricePerMeter) * qty
        } else {
          basePrice = defaultPricePerUnit * qty
        }
        const finish = item.paintFinish || 'matte'
        const finishMultiplier = finish === 'hammertone' ? (1 + hammertoneMarkup / 100) : 1
        sum += basePrice * finishMultiplier
      }
      const costPrice = Math.max(minPrice, sum)
      calcPaintingPrice = costPrice * (1 + paintingMarkup / 100)
    } else {
      // Разные цвета — для каждого цвета считаем отдельно с минимальной ценой
      const byColor: Record<string, typeof paintableItems> = {}
      for (const item of paintableItems) {
        const key = `${item.paintColor}_${item.paintFinish || 'matte'}`
        if (!byColor[key]) byColor[key] = []
        byColor[key].push(item)
      }
      let totalCostPrice = 0
      for (const colorItems of Object.values(byColor)) {
        let sum = 0
        for (const item of colorItems) {
          const qty = Number(item.quantity)
          const unit = item.product.unit.toLowerCase()
          const isLinear = unit.includes('п.м') || unit === 'м'
          let basePrice: number
          if (isLinear) {
            const productPrice = Number((item.product as never as { paintingPricePerMeter?: number }).paintingPricePerMeter || 0)
            basePrice = (productPrice > 0 ? productPrice : defaultPricePerMeter) * qty
          } else {
            basePrice = defaultPricePerUnit * qty
          }
          const finish = item.paintFinish || 'matte'
          const finishMultiplier = finish === 'hammertone' ? (1 + hammertoneMarkup / 100) : 1
          sum += basePrice * finishMultiplier
        }
        totalCostPrice += Math.max(minPrice, sum)
      }
      calcPaintingPrice = totalCostPrice * (1 + paintingMarkup / 100)
    }
  }

  // ── Транспорт ─────────────────────────────────────────────────────────────
  let calcTransportPrice = 0
  if (deal.includeTransport || deal.needPainting) {
    const basePrice = await getSetting('transport_base_price', 0)
    const deliveryType = deal.deliveryType || 'SELF_PICKUP'

    // Стоимость поездки на покраску/с покраски (если нужна покраска)
    const paintingTrip = deal.needPainting ? basePrice * 2 : 0 // туда + обратно

    if (deliveryType === 'SELF_PICKUP') {
      // Самовывоз: только покраска если нужна
      calcTransportPrice = paintingTrip
    } else if (deliveryType === 'TERMINAL') {
      // До ТК: покраска + доставка до ТК (базовая цена)
      calcTransportPrice = paintingTrip + basePrice
    } else if (deliveryType === 'LOCAL') {
      // До объекта: покраска + ручной ввод (calcTransportPrice уже может быть задан вручную)
      // Здесь только покраска — стоимость доставки до объекта вводится вручную
      calcTransportPrice = paintingTrip
    }
  }

  return { calcGlassPrice, calcInstallPrice, calcPaintingPrice, calcTransportPrice }

}

/**
 * Возвращает настройки участия в скидке для стекла и монтажа
 */
export async function getExtrasDiscountSettings() {
  const glassAffected = await prisma.setting.findUnique({ where: { key: 'glass_affected_by_discount' } })
  const installAffected = await prisma.setting.findUnique({ where: { key: 'install_affected_by_discount' } })
  return {
    glassAffectedByDiscount: glassAffected?.value !== 'false',
    installAffectedByDiscount: installAffected?.value === 'true',
  }
}
