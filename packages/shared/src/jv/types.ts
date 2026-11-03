/** Domain-neutral JV contracts. No formula semantics are implied here. */
export type DecimalString = string & { readonly __decimalString: unique symbol }
export type PriceProfile = 'COMPLETATION' | 'RETAIL'
export type JVVariant = 'LINE' | 'ZIGZAG' | 'SLIDER_L3' | 'SLIDER_L5' | 'SLIDER_X3' | 'SLIDER_X5' | 'FRONT'
export type Unit = 'mm' | 'm' | 'm2' | 'piece' | 'set' | 'kg' | 'hour' | 'rub' | 'percent' | 'unitless' | (string & {})
export type ValueStatus = 'ok' | 'invalid_input' | 'calculation_error' | 'unavailable'
export interface Quantity { value: DecimalString; unit: Unit }
export interface Measurement { value: DecimalString; unit: 'mm' | 'm' }
export interface Price { amount: DecimalString; currency: 'RUB'; unit: Unit }
export interface VersionSet { engine: string; rules: string; priceSnapshot: string; catalog: string; sourceWorkbook?: string }
export interface JVSystemRef { family: 'LINE'|'ZIGZAG'|'SLIDER'|'FRONT'; variant: JVVariant; catalogSystemId?: string; sourceSheet?: string }
export interface JVGeometryInput { width: Measurement; height: Measurement; depth?: Measurement; openings?: number; sections?: number; orientation?: string }
export interface SelectedMaterial { catalogId: string; sku?: string; finish?: string; quantityOverride?: Quantity }
export interface SelectedComponent extends SelectedMaterial { componentId?: string }
export interface FillingInput { kind: string; glassTypeId?: string; thickness?: Measurement; processing?: string[]; quantity?: Quantity }
export interface WorkOptions { painting?: { enabled: boolean; finish?: string }; assembly?: { enabled: boolean }; installation?: { enabled: boolean; parameters?: Readonly<Record<string,string|boolean|DecimalString>> }; delivery?: { enabled: boolean; optionId?: string }; extras?: readonly { code: string; enabled: boolean; quantity?: Quantity }[] }
export interface JVPositionInput { id: string; system: JVSystemRef; geometry: JVGeometryInput; parameters: Readonly<Record<string,string|boolean|DecimalString>>; materials?: readonly SelectedMaterial[]; components?: readonly SelectedComponent[]; fillings?: readonly FillingInput[]; work?: WorkOptions; quantity: Quantity }
export interface JVCalculationInput { calculationId: string; profile: PriceProfile; positions: readonly JVPositionInput[]; discount?: { kind: 'amount'|'percent'; value: DecimalString; reason?: string }; requestedAt?: string }
export interface PriceRecord { catalogId: string; price: Price; validFrom?: string; sourceRef: string }
export interface LookupTable { id: string; version: string; sourceRef: string; dimensions: readonly string[]; values: readonly (readonly DecimalString[])[] }
export interface CalculationContext { versions: VersionSet; prices: readonly PriceRecord[]; lookups: readonly LookupTable[]; settings: Readonly<Record<string,string|boolean|DecimalString>> }
export interface TraceStep { id: string; kind: 'input'|'validation'|'geometry'|'material'|'component'|'filling'|'work'|'pricing'|'summary'; label: string; inputRefs: readonly string[]; ruleId?: string; source?: { workbook?: string; sheet?: string; cell?: string; formula?: string }; catalogRefs: readonly { id: string; version: string }[]; input: Readonly<Record<string,unknown>>; result?: unknown; status: ValueStatus; errorIds: readonly string[]; warningIds: readonly string[] }
export interface SpecificationLine { id: string; positionId: string; kind: 'material'|'component'|'glass'|'work'|'delivery'|'discount'; catalogId?: string; description: string; quantity?: Quantity; unitPrice?: Price; total?: Price; sourceTraceStepId: string }
export interface CostLine { id: string; positionId?: string; category: string; basis?: Quantity; unitPrice?: Price; amount: Price; traceStepId: string }
export interface CalculationError { id: string; code: string; message: string; status: Exclude<ValueStatus,'ok'>; positionId?: string; source?: TraceStep['source']; relatedStepIds: readonly string[] }
export interface CalculationWarning { id: string; code: string; message: string; positionId?: string; relatedStepIds: readonly string[] }
export interface PositionResult { positionId: string; status: ValueStatus; specification: readonly SpecificationLine[]; costs: readonly CostLine[]; trace: readonly TraceStep[]; errors: readonly CalculationError[]; warnings: readonly CalculationWarning[] }
export interface CalculationSummary { status: ValueStatus; profile: PriceProfile; currency: 'RUB'; subtotal?: Price; discount?: Price; total?: Price; costTotal?: Price; positions: readonly PositionResult[]; specification: readonly SpecificationLine[]; trace: readonly TraceStep[]; errors: readonly CalculationError[]; warnings: readonly CalculationWarning[]; versions: VersionSet }
