# Контракт расчётного ядра JV (проект)

Пока только контракт; математика и интеграция не внедряются на этапе 0.

```ts
type PriceProfile = 'COMPLETATION' | 'RETAIL';
type JVVariant = 'LINE'|'ZIGZAG'|'SLIDER_L3'|'SLIDER_L5'|'SLIDER_X3'|'SLIDER_X5'|'FRONT';
type CalcStatus = 'ok'|'invalid_input'|'calculation_error'|'unavailable';
type DecimalString = string; // десятичное значение без двоичной погрешности
interface JVInput { profile: PriceProfile; priceSnapshotId: string; items: JVItemInput[]; options: JVOrderOptions }
interface JVItemInput { itemId: string; variant: JVVariant; dimensions: Record<string, DecimalString>; parameters: Record<string, string|boolean|DecimalString>; quantity: DecimalString }
interface JVOrderOptions { glass?: GlassInput[]; painting?: WorkOption; assembly?: WorkOption; installation?: WorkOption; delivery?: DeliveryInput; accessories: AccessoryInput[]; discount?: DiscountInput }
interface CalculationContext { modelVersion: string; priceSnapshotId: string; prices: readonly PriceRecord[]; lookups: readonly LookupTable[]; settings: readonly SettingRecord[] }
interface JVResult { status: CalcStatus; positions: PositionResult[]; summary: Summary; trace: TraceStep[]; errors: CalcError[] }
```

`calculateJV(input, context): JVResult` — чистая детерминированная функция без Prisma, I/O, Date.now, сети, `eval`/`new Function`. Каждая позиция рассчитывается независимо. Возвращаются material BOM с raw/order/billed quantity и единицами; стекло по каждому стеклу; work lines; cost/selling; итог/скидка. Прайсы и settings immutable и versioned. Money/quantity хранить decimal strings или decimal type; округление задаётся операцией и источником, intermediate values сохраняются в trace. Ошибка выбранной ветви не превращается в 0; неактивная ветвь не блокирует результат. Excel errors/status — tagged errors. `INDEX` внешне 1-based с проверкой индекса.

Типы уточнить после полного разбора именованных диапазонов, validation и MIGRATION_MAPPING (не обнаружен). Этот эскиз не является утверждённым финансовым правилом.
