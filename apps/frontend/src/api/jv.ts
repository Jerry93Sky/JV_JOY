import type { PriceProfile, UnifiedFamily, UnifiedOrderResult, UnifiedPositionInput } from '@bms/shared/jv'
import api from './client'

type PositionFor<F extends UnifiedFamily> = Extract<UnifiedPositionInput, { family: F }>
type PositionBase<F extends UnifiedFamily> = Omit<PositionFor<F>, 'calculation'>
type LineCalculation = Omit<PositionFor<'LINE'>['calculation'], 'priceSnapshot' | 'glassSnapshot' | 'paintSnapshot'>
type ZigzagCalculation = Omit<PositionFor<'ZIGZAG'>['calculation'], 'snapshot'>
type SliderCalculation<F extends 'SLIDER_L3' | 'SLIDER_L5' | 'SLIDER_X3' | 'SLIDER_X5'> = Omit<PositionFor<F>['calculation'], 'snapshot'>
type FrontCalculation = PositionFor<'FRONT'>['calculation']
type ClientFrontCalculation = Omit<FrontCalculation, 'commercial'> & {
  commercial: Omit<FrontCalculation['commercial'], 'snapshot'>
}

/** Price snapshots are supplied by the backend, never by the editor. */
export type JvPreviewPosition =
  | (PositionBase<'LINE'> & { calculation: LineCalculation })
  | (PositionBase<'ZIGZAG'> & { calculation: ZigzagCalculation })
  | (PositionBase<'SLIDER_L3'> & { calculation: SliderCalculation<'SLIDER_L3'> })
  | (PositionBase<'SLIDER_L5'> & { calculation: SliderCalculation<'SLIDER_L5'> })
  | (PositionBase<'SLIDER_X3'> & { calculation: SliderCalculation<'SLIDER_X3'> })
  | (PositionBase<'SLIDER_X5'> & { calculation: SliderCalculation<'SLIDER_X5'> })
  | (PositionBase<'FRONT'> & { calculation: ClientFrontCalculation })

export interface JvPreviewRequest {
  orderId?: string
  profile: PriceProfile
  rulesVersion: string
  priceSnapshotVersion?: string
  positions: readonly JvPreviewPosition[]
}

export type JvUiValue = string | number | boolean
export interface JvUiField {
  path: string
  label: string
  type: 'decimal' | 'boolean' | 'select'
  unit?: string
  options?: { value: string | number; label: string; supported: boolean }[]
  status: 'CONFIRMED' | 'LIMITED'
  source?: string
  dependsOn?: string
}
export interface JvUiConfig {
  schemaVersion: string
  rulesVersion: string
  profile: PriceProfile
  families: Record<UnifiedFamily, Record<string, JvUiValue>>
  fieldMetadata: Record<UnifiedFamily, JvUiField[]>
  frontDoorProfile: { id: string; label: string; defaults: Record<string, JvUiValue>; fieldMetadata: JvUiField[]; slots: UnifiedFamily[]; restriction: string }
}
export interface JvUiPreviewRequest {
  orderId?: string
  profile: PriceProfile
  rulesVersion: string
  uiSchemaVersion: string
  positions: readonly { id: string; slot: number; family: UnifiedFamily; quantity: string; calculation: Record<string, JvUiValue>; configurationId?: string }[]
}

export interface JvPreviewResponse {
  correlationId: string
  orderId: string
  profile: PriceProfile
  engineVersion: string
  versions: { rules: string; provider: string; workbook: string; workbookSha256: string; familyPriceSnapshots: Record<string, string> }
  status: 'COMPLETE' | 'PARTIAL'
  calculation: UnifiedOrderResult
}

export const JV_RULES_VERSION = 'JV-UNIFIED-ORDER-PR13E-1'

export async function calculateJvPreview(request: JvPreviewRequest | JvUiPreviewRequest, signal?: AbortSignal): Promise<JvPreviewResponse> {
  const response = await api.post<JvPreviewResponse>('/jv/orders/calculate-preview', request, { signal })
  return response.data
}

export async function getJvUiConfig(profile: PriceProfile, signal?: AbortSignal): Promise<JvUiConfig> {
  const response = await api.get<JvUiConfig>('/jv/orders/form-config', { params: { profile }, signal })
  return response.data
}

export function canCalculateJv(role: string | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}
