import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import api from '@/api/client'
import { type UnifiedFamily } from '@bms/shared/jv'
import JVResultView from './JVResultView'
import { exact } from './jvResultAdapter'
import { displayProposalMoney } from './proposalMoney'
import { calculateJvPreview, canCalculateJv, getJvUiConfig, type JvPreviewResponse, type JvUiConfig, type JvUiValue } from '@/api/jv'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const families: { value: UnifiedFamily; label: string }[] = [
  { value: 'LINE', label: 'JV-Line' }, { value: 'ZIGZAG', label: 'JV-Zigzag' },
  { value: 'SLIDER_L3', label: 'Slider L3' }, { value: 'SLIDER_L5', label: 'Slider L5' },
  { value: 'SLIDER_X3', label: 'Slider X3' }, { value: 'SLIDER_X5', label: 'Slider X5' },
  { value: 'FRONT', label: 'JV-Front' },
]
type DraftPosition = { id: string; family: UnifiedFamily; slot: number; quantity: string; inputs: Record<string, JvUiValue>; configurationId?: string }
type Profile = 'COMPLETATION' | 'RETAIL'
type ProposalTerms = {recipient:string;requisites:string;payment:string;timeframe:string;delivery:string}
const emptyTerms:ProposalTerms={recipient:'',requisites:'',payment:'',timeframe:'',delivery:''}
type ProposalDetail = {id:string;number:number;payload:{orderNumber:number;orderVersion:number;profile:string;totalSalePrice:unknown;terms?:ProposalTerms;positions:Array<{id:string;family:string;slot:number;quantity:unknown;confirmedUnitAmount?:unknown}>}}
function stableJson(value: unknown): string {
  const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,normalize(x)])) : v
  return JSON.stringify(normalize(value))
}
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
const labels: Record<string, string> = {
  widthMm: 'Ширина, мм', heightMm: 'Высота, мм', leaves: 'Количество створок', leafCount: 'Количество створок', leafSelector: 'Количество створок', sectionDemand: 'Количество секций',
  openingSelector: 'Вариант открывания', direction: 'Направление открывания', sideCount: 'Количество сторон', profileCount: 'Количество профилей', connectorAngle: 'Угол соединения, °',
  glassSelectionIndex: 'Вариант стекла', glassSelector: 'Вариант стекла', glassTypeSelector: 'Вариант стекла', finishSelectionIndex: 'Вариант отделки', finishSelector: 'Вариант отделки', commercialModeIndex: 'Транспортная опция', priceMode: 'Отделка', mainSurchargeSelector: 'Транспортная опция', F28: 'Транспортная опция',
  frameState: 'Монтажная рама', knobState: 'Ручка-кноб', latchState: 'Защёлка', weatherSealState: 'Уплотнитель', floorLockState: 'Замок в пол', bottomPivotState: 'Напольный доводчик', specialSashEnabled: 'Специальное полотно', specialSashWidthMm: 'Ширина специального полотна, мм', rollerAxisToEdgeMm: 'Ось ролика до края, мм', parkedDoorSelected: 'Паркуемая дверь', parkedDoorPosition: 'Позиция паркуемой двери', parkedDoorReuseOpening: 'Использовать ширину проёма', parkedDoorWidthMm: 'Ширина паркуемой двери, мм',
  interlockState: 'Замковый профиль', meetingSealState: 'Уплотнение притвора', jointPairSelection: 'Выбор пары соединений', glassEnabled: 'Стекло', finishingEnabled: 'Отделка', glassServiceEnabled: 'Обработка стекла', installationEnabled: 'Монтаж', frameOverrideIndex: 'Вариант рамы', c8: 'Параметр комплектации C8', N40: 'Ручное количество N40', N41: 'Ручное количество N41', D18: 'Размер D18, мм', D19: 'Размер D19, мм', C18: 'Выбор ширины двери', C19: 'Выбор высоты двери', C20: 'Примыкание двери', C21: 'Вариант доводчика', C22: 'Вариант ручки', C23: 'Вариант замка', C24: 'Вариант дополнительного замка',
}
const keyOf = (path: string) => { const parts = path.split('.'); return parts[parts.length - 1] || path }
const fieldLabel = (path: string) => labels[keyOf(path)] ?? `Выбор ${path}`
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const transportField = (path: string) => ['input.commercialModeIndex','position.commercial.F28','controls.mainSurchargeSelector','commercial.mainSurchargeSelector'].includes(path)
function fieldDisabled(path: string, inputs: Record<string, JvUiValue>): boolean {
  if (inputs['construction.openingSelector'] === 4 && /^construction\.controls\.(C18|C19|C20|C21|C22|C23|C24|D18|D19)$/.test(path)) return true
  if (path === 'input.specialSashWidthMm') return inputs['input.specialSashEnabled'] !== true
  if (path === 'input.parkedDoorPosition' || path === 'input.parkedDoorReuseOpening') return inputs['input.parkedDoorSelected'] !== true
  if (path === 'input.parkedDoorWidthMm') return inputs['input.parkedDoorSelected'] !== true || inputs['input.parkedDoorReuseOpening'] !== true
  if (path === 'construction.controls.D18') return inputs['construction.controls.C18'] !== 2
  if (path === 'construction.controls.D19') return inputs['construction.controls.C19'] !== 2
  return false
}

export default function JVOrderPage() {
  const role = useAuthStore(s => s.user?.role)
  const userId = useAuthStore(s => s.user?.id)
  const [positions, setPositions] = useState<DraftPosition[]>([])
  const [activeId, setActiveId] = useState('')
  const [tab, setTab] = useState<'list'|'form'|'result'>('list')
  const [profile, setProfile] = useState<Profile>('COMPLETATION')
  const [config, setConfig] = useState<JvUiConfig | null>(null)
  const [result, setResult] = useState<JvPreviewResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [savedVersion, setSavedVersion] = useState(0)
  const [orderLinks, setOrderLinks] = useState<{contactId?:string;dealId?:string}>({})
  const [draftVersions, setDraftVersions] = useState<{uiSchemaVersion:string;rulesVersion:string}|null>(null)
  const [savedKey, setSavedKey] = useState('')
  const [orders, setOrders] = useState<Array<{id:string;number:number;version:number;profile:string}>>([])
  const [revisions, setRevisions] = useState<Array<{version:number;authorId:string;createdAt:string;snapshot:unknown}>>([])
  const [saveMessage, setSaveMessage] = useState('')
  const [captures,setCaptures]=useState<Array<{id:string;orderVersion:number;createdAt:string;contentSha256:string}>>([])
  const [captureDetail,setCaptureDetail]=useState<unknown>(null)
  const [capturing,setCapturing]=useState(false)
  const [proposals,setProposals]=useState<Array<{id:string;number:number;createdAt:string}>>([])
  const [proposalDetail,setProposalDetail]=useState<ProposalDetail|null>(null)
  const [proposalTerms,setProposalTerms]=useState<ProposalTerms>(emptyTerms)
  const [savingTerms,setSavingTerms]=useState(false)
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [saveFailure, setSaveFailure] = useState<'network'|'conflict'|null>(null)
  const [templates, setTemplates] = useState<Array<{id:string;name:string;draft:{positions:DraftPosition[];profile:Profile;uiSchemaVersion:string;rulesVersion:string}}>>([])
  const saveLock = useRef(false)
  const creationKey = useRef<string>(crypto.randomUUID())
  const skipDefaults = useRef(false)
  const currentKey = stableJson({positions,profile,versions:draftVersions})
  const dirty = savedKey !== currentKey
  const termsDirty=!!proposalDetail && stableJson(proposalTerms)!==stableJson(proposalDetail.payload.terms??emptyTerms)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const warn = (event: BeforeUnloadEvent) => { if ((dirty && positions.length) || termsDirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, positions.length, termsDirty])

  useEffect(() => {
    if (typeof document === 'undefined' || (!(dirty && positions.length) && !termsDirty)) return
    const guard = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = new URL(anchor.href, window.location.href)
      if (target.origin === window.location.origin && target.pathname === window.location.pathname && target.search === window.location.search) return
      if (!window.confirm('Есть несохранённые изменения. Покинуть редактор?')) { event.preventDefault(); event.stopPropagation() }
    }
    document.addEventListener('click', guard, true)
    return () => document.removeEventListener('click', guard, true)
  }, [dirty,positions.length,termsDirty])

  type Snapshot = {positions: DraftPosition[]; profile: Profile; activeId: string}
  const past = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const lastEdit = useRef<{key:string;time:number}|null>(null)
  const [, redrawHistory] = useState(0)
  const generation = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const allowed = canCalculateJv(role)

  function invalidate() { generation.current++; activeRequest.current?.abort(); activeRequest.current = null; setLoading(false); setResult(null); setError('') }
  function remember(key?: string) {
    const now=Date.now()
    if (!key || !lastEdit.current || lastEdit.current.key!==key || now-lastEdit.current.time>1000) {
      past.current.push({positions:structuredClone(positions),profile,activeId})
      if(past.current.length>50) past.current.shift()
    }
    lastEdit.current=key?{key,time:now}:null
    future.current=[];redrawHistory(n=>n+1)
  }
  function restore(direction:'undo'|'redo') {
    const from=direction==='undo'?past.current:future.current, to=direction==='undo'?future.current:past.current
    const snapshot=from.pop(); if(!snapshot)return
    to.push({positions:structuredClone(positions),profile,activeId});if(to.length>50)to.shift()
    invalidate();lastEdit.current=null
    setPositions(snapshot.positions);setActiveId(snapshot.positions.some(p=>p.id===snapshot.activeId)?snapshot.activeId:snapshot.positions[0]?.id??'')
    if(snapshot.profile!==profile){setConfig(null);setProfile(snapshot.profile)}
    redrawHistory(n=>n+1)
  }
  useEffect(()=>{
    if (typeof window === 'undefined') return
    const handler=(e:KeyboardEvent)=>{
      if (restoring) return
      const target=e.target as HTMLElement|null
      if(target?.closest('input,textarea,select,[contenteditable="true"]'))return
      if(!(e.ctrlKey||e.metaKey)||e.altKey)return
      const key=e.key.toLowerCase();if(key==='z'||key==='y'){e.preventDefault();restore(key==='y'||e.shiftKey?'redo':'undo')}
    }
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)
  })
  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    setConfig(null)
    getJvUiConfig(profile, controller.signal).then(value => {
      if (controller.signal.aborted) return
      setConfig(value)
      if (skipDefaults.current) { skipDefaults.current=false; return }
      setPositions(old => old.map(p => { const fixed=old.some(x=>x.configurationId); const defaults=p.configurationId?value.frontDoorProfile.defaults:value.families[p.family]; return {...p,inputs:Object.fromEntries(Object.entries(defaults).map(([path,initial])=>[path,(!fixed||transportField(path))&&typeof p.inputs[path]===typeof initial?p.inputs[path]:initial]))} }))
    }).catch(e => { if (!controller.signal.aborted) setError(axios.isAxiosError(e) && e.response?.status === 403 ? 'Недостаточно прав для расчёта.' : 'Не удалось загрузить параметры форм.') })
    return () => controller.abort()
  }, [profile, allowed])
  useEffect(() => () => { generation.current++; activeRequest.current?.abort() }, [])

  // Per-tab recovery protects edits that have not yet been acknowledged by the server.
  useEffect(() => {
    if (!allowed || !userId) return
    const key=`jv-draft-recovery:${userId}`
    try {
      const stored=sessionStorage.getItem(key)
      if (stored) {
        const x=JSON.parse(stored) as {positions:DraftPosition[];profile:Profile;activeId:string;savedId:string|null;savedVersion:number;savedKey:string;versions:{uiSchemaVersion:string;rulesVersion:string}|null;creationKey:string;links:{contactId?:string;dealId?:string}}
        if (Array.isArray(x.positions) && x.positions.length && window.confirm('Найдены неподтверждённые изменения этой вкладки. Восстановить их?')) {
          skipDefaults.current=true;setPositions(x.positions);setProfile(x.profile);setActiveId(x.activeId);setSavedId(x.savedId);setSavedVersion(x.savedVersion);setSavedKey(x.savedKey);setDraftVersions(x.versions);setOrderLinks(x.links??{});creationKey.current=x.creationKey;setTab('form')
        } else sessionStorage.removeItem(key)
      }
    } catch { setError('Не удалось восстановить локальную копию черновика.') }
    setRecoveryReady(true)
  }, [allowed,userId])
  useEffect(() => {
    if (!recoveryReady || !userId) return
    const key=`jv-draft-recovery:${userId}`
    try {
      if (positions.length && (dirty || saving)) sessionStorage.setItem(key,JSON.stringify({positions,profile,activeId,savedId,savedVersion,savedKey,versions:draftVersions,creationKey:creationKey.current,links:orderLinks}))
      else sessionStorage.removeItem(key)
    } catch { setError('Локальная копия недоступна. Не закрывайте страницу до сохранения на сервере.') }
  }, [recoveryReady,userId,currentKey,savedId,savedVersion,savedKey,saving,activeId,orderLinks])

  useEffect(() => {
    if (typeof window === 'undefined' || !recoveryReady || !allowed || !config || !positions.length || !dirty || saving || saveFailure) return
    const timer = window.setTimeout(() => { void saveOrder() }, 1500)
    return () => window.clearTimeout(timer)
  }, [recoveryReady, allowed, config, currentKey, savedKey, saving, saveFailure])

  if (!allowed) return <div role="alert" className="rounded-lg border p-5">Раздел JV-заказов доступен владельцу и администратору.</div>

  async function refreshOrders() { try { setOrders((await api.get('/jv/orders')).data) } catch { setError('Не удалось загрузить список заказов.') } }
  async function openOrder(id:string) {
    if(saveLock.current || savingTerms) { setError('Дождитесь завершения сохранения.'); return }
    if(((dirty && positions.length)||termsDirty) && !window.confirm('Есть несохранённые изменения. Открыть другой заказ?')) return
    try {
      const {data}=await api.get(`/jv/orders/${id}`)
      const draft=data.draft as {positions:DraftPosition[];profile:Profile;uiSchemaVersion:string;rulesVersion:string;contactId?:string;dealId?:string}
      setDraftVersions({uiSchemaVersion:draft.uiSchemaVersion,rulesVersion:draft.rulesVersion})
      setOrderLinks({...(draft.contactId?{contactId:draft.contactId}:{}),...(draft.dealId?{dealId:draft.dealId}:{})})
      invalidate();setCaptures([]);setCaptureDetail(null);setProposals([]);setProposalDetail(null); past.current=[];future.current=[];lastEdit.current=null
      skipDefaults.current=draft.profile!==profile
      setPositions(draft.positions);setProfile(draft.profile);setActiveId(draft.positions[0]?.id??'');setTab('list')
      setSaveFailure(null);setSavedId(data.id);setSavedVersion(data.version);setSavedKey(stableJson({positions:draft.positions,profile:draft.profile,versions:{uiSchemaVersion:draft.uiSchemaVersion,rulesVersion:draft.rulesVersion}}));setSaveMessage('Заказ открыт. Для получения цены выполните расчёт заново.')
      setRevisions((await api.get(`/jv/orders/${id}/revisions`)).data);redrawHistory(n=>n+1)
    } catch { setError('Не удалось открыть заказ.') }
  }
  async function saveOrder() {
    if (!config || saveLock.current || !positions.length || (!dirty && savedId)) return
    saveLock.current=true;setSaving(true);setSaveMessage('');setError('')
    const snapshot={profile,uiSchemaVersion:draftVersions?.uiSchemaVersion??config.schemaVersion,rulesVersion:draftVersions?.rulesVersion??config.rulesVersion,positions:structuredClone(positions),...orderLinks}
    const versions={uiSchemaVersion:snapshot.uiSchemaVersion,rulesVersion:snapshot.rulesVersion}
    const key=stableJson({positions:snapshot.positions,profile:snapshot.profile,versions})
    try {
      const {data}=savedId?await api.put(`/jv/orders/${savedId}`,{version:savedVersion,draft:snapshot}):await api.post('/jv/orders',snapshot,{headers:{'Idempotency-Key':creationKey.current}})
      const persisted=data.draft as typeof snapshot
      const persistedVersions={uiSchemaVersion:persisted.uiSchemaVersion,rulesVersion:persisted.rulesVersion}
      const persistedKey=stableJson({positions:persisted.positions,profile:persisted.profile,versions:persistedVersions})
      setSaveFailure(null);setSavedId(data.id);setSavedVersion(data.version);setDraftVersions(versions);setSavedKey(persistedKey || key);setSaveMessage(`Заказ №${data.number} сохранён, версия ${data.version}.`);await refreshOrders()
      setRevisions((await api.get(`/jv/orders/${data.id}/revisions`)).data)
    } catch(e) { const conflict=axios.isAxiosError(e)&&e.response?.status===409;setSaveFailure(conflict?'conflict':'network');setError(conflict?'Заказ изменён в другой вкладке. Локальные изменения остаются на экране.':'Ошибка сохранения. Введённые данные остаются на экране.') }
    finally {saveLock.current=false;setSaving(false)}
  }
  function newOrder() { if(saveLock.current||savingTerms){setError('Дождитесь завершения сохранения.');return} if(((dirty && positions.length)||termsDirty) && !window.confirm('Есть несохранённые изменения. Создать новый заказ?')) return; invalidate();past.current=[];future.current=[];lastEdit.current=null;setPositions([]);setActiveId('');setSavedId(null);setSavedVersion(0);creationKey.current=crypto.randomUUID();setSaveFailure(null);setDraftVersions(null);setOrderLinks({});setSavedKey('');setRevisions([]);setCaptures([]);setCaptureDetail(null);setProposals([]);setProposalDetail(null);setSaveMessage('');setTab('list');redrawHistory(n=>n+1) }

  async function loadCaptures() { if(!savedId)return;try{setCaptures((await api.get(`/jv/orders/${savedId}/calculation-snapshots`)).data)}catch{setError('Не удалось загрузить снимки расчётов.')} }
  async function captureCalculation() {
    if(!savedId||dirty||saving||capturing||!draftVersions||!config||draftVersions.uiSchemaVersion!==config.schemaVersion||draftVersions.rulesVersion!==config.rulesVersion)return
    setCapturing(true)
    try{await api.post(`/jv/orders/${savedId}/calculation-snapshots`,{version:savedVersion});setSaveMessage('Расчёт сохранён для просмотра. Это ещё не коммерческий документ.');await loadCaptures()}
    catch(e){const code=axios.isAxiosError(e)?e.response?.data?.error?.code:undefined;setError(code==='PARTIAL_CALCULATION'?'Неполный расчёт нельзя сохранить как подтверждённый снимок.':code==='VERSION_CONFLICT'?'Заказ изменился. Обновите заказ перед фиксацией расчёта.':'Не удалось сохранить снимок расчёта.')}
    finally{setCapturing(false)}
  }
  async function loadProposals() {if(!savedId)return;try{setProposals((await api.get(`/jv/orders/${savedId}/proposal-drafts`)).data)}catch{setError('Не удалось загрузить черновики КП.')}}
  function selectProposal(data:ProposalDetail) {setProposalDetail(data);setProposalTerms(data.payload.terms??emptyTerms)}
  async function createProposal(snapshotId:string) {if(!savedId||savingTerms)return;if(termsDirty&&!window.confirm('Несохранённые условия КП будут потеряны. Продолжить?'))return;try{const {data}=await api.post(`/jv/orders/${savedId}/proposal-drafts`,{snapshotId});selectProposal(data);await loadProposals()}catch(e){const code=axios.isAxiosError(e)?e.response?.data?.error?.code:undefined;setError(code==='HISTORICAL_GLASS_POLICY'?'Снимок использует старые настройки стекла. Выполните новый расчёт и создайте новый снимок.':'Не удалось создать черновик КП из снимка.')}}
  async function reviseProposal() {if(!savedId||!proposalDetail||savingTerms)return;setSavingTerms(true);try{const {data}=await api.post(`/jv/orders/${savedId}/proposal-drafts/${proposalDetail.id}/revise`,{terms:proposalTerms});selectProposal(data);await loadProposals();setSaveMessage('Создан новый черновик КП. Предыдущий сохранён.')}catch(e){const code=axios.isAxiosError(e)?e.response?.data?.error?.code:undefined;setError(code==='INVALID_TERMS'?'Заполните все пять полей условий КП.':code==='HISTORICAL_GLASS_POLICY'?'КП использует прежние настройки стекла. Создайте новый снимок и КП; введённый текст пока остаётся на экране.':'Не удалось сохранить условия КП; введённый текст сохранён на экране.')}finally{setSavingTerms(false)}}
  async function refreshTemplates() { try { setTemplates((await api.get('/jv/templates')).data) } catch { setError('Не удалось загрузить шаблоны.') } }
  async function createTemplate() {
    if (!config || !activeId) return
    const name=window.prompt('Название шаблона'); if (!name?.trim()) return
    const chosen=positions.some(p=>p.configurationId)?positions:positions.filter(p=>p.id===activeId)
    try { await api.post('/jv/templates',{name:name.trim(),draft:{profile,uiSchemaVersion:draftVersions?.uiSchemaVersion??config.schemaVersion,rulesVersion:draftVersions?.rulesVersion??config.rulesVersion,positions:chosen}});await refreshTemplates() } catch { setError('Не удалось сохранить шаблон.') }
  }
  function applyTemplate(t:typeof templates[number]) {
    if (t.draft.positions.length===1 && (t.draft.profile!==profile || t.draft.uiSchemaVersion!==(draftVersions?.uiSchemaVersion??config?.schemaVersion) || t.draft.rulesVersion!==(draftVersions?.rulesVersion??config?.rulesVersion))) { setError('Профиль или версии шаблона отличаются от текущего заказа.'); return }
    if (t.draft.positions.length>1) {
      if (positions.length) { setError('Шаблон Front с дверью можно применить только к пустому заказу.'); return }
      remember();invalidate();const items=t.draft.positions.map(p=>({...structuredClone(p),id:crypto.randomUUID()}));setPositions(items);setActiveId(items[0]?.id??'');setDraftVersions({uiSchemaVersion:t.draft.uiSchemaVersion,rulesVersion:t.draft.rulesVersion});skipDefaults.current=t.draft.profile!==profile;setProfile(t.draft.profile);setTab('form')
    } else { if(positions.length>=7 || positions.some(p=>p.configurationId)){setError('Нет свободного слота для шаблона.');return} add(t.draft.positions[0]) }
  }
  async function restoreRevision(version:number) {
    if(!savedId||saveLock.current)return
    if(!window.confirm(`Восстановить версию ${version}? Текущие несохранённые изменения будут потеряны, а восстановление создаст новую версию.`))return
    saveLock.current=true;setSaving(true);setRestoring(true)
    try { const {data}=await api.post(`/jv/orders/${savedId}/revisions/${version}/restore`,{version:savedVersion});const d=data.draft;invalidate();past.current=[];future.current=[];lastEdit.current=null;skipDefaults.current=d.profile!==profile;setOrderLinks({...(d.contactId?{contactId:d.contactId}:{}),...(d.dealId?{dealId:d.dealId}:{})});setPositions(d.positions);setProfile(d.profile);setActiveId(d.positions[0]?.id??'');setDraftVersions({uiSchemaVersion:d.uiSchemaVersion,rulesVersion:d.rulesVersion});setSavedVersion(data.version);setSavedKey(stableJson({positions:d.positions,profile:d.profile,versions:{uiSchemaVersion:d.uiSchemaVersion,rulesVersion:d.rulesVersion}}));setSaveFailure(null);setSaveMessage('Версия восстановлена. Выполните расчёт заново.');setRevisions((await api.get(`/jv/orders/${savedId}/revisions`)).data) }
    catch(e){setSaveFailure(axios.isAxiosError(e)&&e.response?.status===409?'conflict':'network');setError('Не удалось восстановить версию; проверьте конфликт изменений.')}
    finally{saveLock.current=false;setSaving(false);setRestoring(false)}
  }

  function add(copy?: DraftPosition) {
    if (!config) return
    const used = new Set(positions.map(p => p.slot)), slot = [1, 2, 3, 4, 5, 6, 7].find(s => !used.has(s))
    if (!slot) return
    remember(); invalidate()
    const inputs = { ...(copy?.inputs ?? config.families.LINE) }
    const existingMode = positions.flatMap(p => Object.entries(p.inputs).filter(([path]) => transportField(path)))[0]?.[1]
    if (existingMode !== undefined) for (const path of Object.keys(inputs)) if (transportField(path)) inputs[path] = existingMode
    const item = { id: crypto.randomUUID(), slot, family: copy?.family ?? 'LINE', quantity: copy?.quantity ?? '1', inputs, configurationId:copy?.configurationId }; setPositions(old => [...old, item]); setActiveId(item.id); setTab('form')
  }
  function addDoorExample() {
    if (!config || positions.length) return
    remember(); invalidate()
    const items = config.frontDoorProfile.slots.map((family,index)=>({id:crypto.randomUUID(),slot:index+1,family,quantity:'1',inputs:{...(family==='FRONT'?config.frontDoorProfile.defaults:config.families[family])},...(family==='FRONT'?{configurationId:config.frontDoorProfile.id}:{})})); setPositions(items); setActiveId(items[0]?.id ?? ''); setTab('form')
  }
  function update(id: string, change: Partial<Pick<DraftPosition, 'slot' | 'family' | 'quantity' | 'inputs'>>) {
    remember(change.quantity!==undefined?`quantity:${id}`:undefined); invalidate(); setPositions(old => old.map(p => p.id === id ? { ...p, ...change } : p))
  }
  function updateField(id: string, path: string, value: JvUiValue) {
    remember(typeof value === 'string' ? `field:${id}:${path}` : undefined); invalidate()
    setPositions(old => old.map(p => {
      const inputs = { ...p.inputs }
      if (p.id === id) inputs[path] = value
      if (transportField(path)) for (const otherPath of Object.keys(inputs)) if (transportField(otherPath)) inputs[otherPath] = value
      return { ...p, inputs }
    }))
  }
  function move(index: number, delta: number) {
    remember(); invalidate(); setPositions(old => { const next = [...old], target = index + delta; if (target < 0 || target >= next.length) return old; [next[index], next[target]] = [next[target], next[index]]; return next })
  }
  async function calculate() {
    if (!config || !positions.length) return
    for (const p of positions) {
      if (!/^[1-9]\d{0,5}$/.test(p.quantity)) { setError(`Слот ${p.slot}: количество должно быть целым от 1 до 999999.`); return }
      for (const [path, value] of Object.entries(p.inputs)) {
        const key = keyOf(path)
        if (typeof value === 'string' && ['widthMm','heightMm','leaves','leafCount','leafSelector','sectionDemand','sideCount','profileCount','connectorAngle','specialSashWidthMm','rollerAxisToEdgeMm','parkedDoorPosition','parkedDoorWidthMm','D18','D19','N40','N41','c8'].includes(key) && (!decimal.test(value) || value.length > 64 || (value.split('.')[1]?.length ?? 0) > 30)) { setError(`Слот ${p.slot}: проверьте поле «${fieldLabel(path)}».`); return }
        if (typeof value === 'string' && ['widthMm','heightMm','leaves','leafCount','leafSelector','sectionDemand'].includes(key) && (value.startsWith('-') || !/[1-9]/.test(value))) { setError(`Слот ${p.slot}: поле «${fieldLabel(path)}» должно быть больше нуля.`); return }
      }
    }
    invalidate(); const requestGeneration = generation.current, controller = new AbortController(); activeRequest.current = controller; setLoading(true)
    try {
      const response = await calculateJvPreview({ profile, rulesVersion: config.rulesVersion, uiSchemaVersion: config.schemaVersion, positions: positions.map(p => ({ id: p.id, family: p.family, slot: p.slot, quantity: p.quantity, calculation: p.inputs, ...(p.configurationId?{configurationId:p.configurationId}:{}) })) }, controller.signal)
      if (generation.current === requestGeneration && !controller.signal.aborted) { setResult(response); setDraftVersions({uiSchemaVersion:config.schemaVersion,rulesVersion:config.rulesVersion}) }
    } catch (e) {
      if (generation.current !== requestGeneration || controller.signal.aborted) return
      if (axios.isAxiosError(e)) {
        const status = e.response?.status
        const issues = e.response?.data?.error?.issues
        const details = Array.isArray(issues) ? issues.filter((x): x is string => typeof x === 'string').slice(0, 5).join('; ') : ''
        setError(status === 400 || status === 422 ? `Проверьте параметры конструкций: сервер отклонил ввод. ${details}` : status === 401 ? 'Сессия истекла. Войдите снова.' : status === 403 ? 'Недостаточно прав для расчёта.' : status === 409 ? 'Версия правил или настроек изменилась. Обновите страницу.' : status ? 'Ошибка сервера расчёта.' : 'Нет соединения с сервером.')
      } else setError('Не удалось выполнить расчёт.')
    } finally { if (generation.current === requestGeneration) { activeRequest.current = null; setLoading(false) } }
  }

  return <fieldset disabled={restoring}><div className="mx-auto max-w-[1600px] space-y-5 pb-8">
    <nav aria-label="Разделы рабочего пространства" className="flex gap-2 md:hidden">{(['list','form','result'] as const).map((t,i)=><button key={t} onClick={()=>setTab(t)} aria-pressed={tab===t} className="rounded border px-3 py-2">{['Конструкции','Параметры','Результат'][i]}</button>)}</nav>
    <div className="flex gap-2"><Button variant="outline" disabled={!past.current.length} onClick={()=>restore('undo')}>Отменить</Button><Button variant="outline" disabled={!future.current.length} onClick={()=>restore('redo')}>Повторить</Button></div>
    <header><h1 className="text-2xl font-semibold">Новый JV-заказ</h1><p className="mt-1 text-sm text-muted-foreground">{saving ? 'Сохранение…' : saveFailure ? 'Ошибка сохранения' : dirty && positions.length ? 'Есть изменения' : 'Сохранено'}</p></header>
    <div className="flex flex-wrap gap-2"><Button onClick={saveOrder} disabled={!config || saving}>{saving?'Сохранение…':'Сохранить заказ'}</Button><Button variant="outline" onClick={newOrder}>Новый заказ</Button><Button variant="outline" onClick={refreshOrders}>Список заказов</Button></div>
    {saveMessage && <p role="status">{saveMessage}</p>}
    {saveFailure && <div className="rounded border p-3"><p>Локальные изменения сохраняются на экране. При открытии серверной версии они будут потеряны.</p>{saveFailure==='conflict' && savedId && <><Button variant="outline" onClick={()=>void openOrder(savedId)}>Открыть серверную версию</Button><Button variant="outline" onClick={()=>{if(!window.confirm('Сохранить изменения как отдельный новый заказ?'))return;setSavedId(null);setSavedVersion(0);creationKey.current=crypto.randomUUID();setSaveFailure(null)}}>Сохранить отдельно</Button></>}{saveFailure==='network' && <Button variant="outline" onClick={()=>setSaveFailure(null)}>Повторить сохранение</Button>}</div>}
    {draftVersions && <p>Версии заказа: UI {draftVersions.uiSchemaVersion}, правила {draftVersions.rulesVersion}.{config && (draftVersions.uiSchemaVersion!==config.schemaVersion || draftVersions.rulesVersion!==config.rulesVersion) && ' Возможна несовместимость с текущими правилами; проверьте входные данные.'}</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void refreshTemplates()}>Шаблоны</Button><Button variant="outline" disabled={!activeId} onClick={()=>void createTemplate()}>Сохранить конструкцию как шаблон</Button></div>
    {templates.map(t=><div key={t.id} className="flex flex-wrap gap-2"><span>{t.name}</span><Button variant="outline" onClick={()=>applyTemplate(t)}>Применить</Button><Button variant="outline" onClick={async()=>{const name=window.prompt('Новое название',t.name);if(name?.trim()){await api.patch(`/jv/templates/${t.id}`,{name:name.trim()});await refreshTemplates()}}}>Переименовать</Button><Button variant="outline" onClick={async()=>{if(window.confirm('Удалить шаблон?')){await api.delete(`/jv/templates/${t.id}`);await refreshTemplates()}}}>Удалить шаблон</Button></div>)}
    {orders.length>0 && <section className="rounded border p-3"><h2 className="font-semibold">Сохранённые заказы</h2>{orders.map(o=><button key={o.id} className="block text-primary underline" onClick={()=>openOrder(o.id)}>Заказ №{o.number} · версия {o.version} · {o.profile}</button>)}</section>}
    {savedId && <section className="rounded border p-3"><h2 className="font-semibold">Снимки расчёта</h2><p className="text-sm">Сервер рассчитывает сохранённую версию заново. Снимок не является выпущенным коммерческим документом.</p>{draftVersions && config && (draftVersions.uiSchemaVersion!==config.schemaVersion||draftVersions.rulesVersion!==config.rulesVersion) && <p role="status">Для фиксации сначала выполните новый расчёт и сохраните заказ с текущими настройками.</p>}<div className="flex gap-2"><Button variant="outline" disabled={dirty||saving||capturing||!draftVersions||!config||draftVersions.uiSchemaVersion!==config.schemaVersion||draftVersions.rulesVersion!==config.rulesVersion} onClick={()=>void captureCalculation()}>{capturing?'Сохранение…':'Зафиксировать расчёт'}</Button><Button variant="outline" onClick={()=>void loadCaptures()}>Обновить список</Button></div>{captures.map(x=><div key={x.id} className="flex flex-wrap gap-2"><button className="text-left text-primary underline" onClick={async()=>{try{setCaptureDetail((await api.get(`/jv/orders/${savedId}/calculation-snapshots/${x.id}`)).data)}catch{setError('Не удалось открыть снимок.')}}}>Версия заказа {x.orderVersion} · {new Date(x.createdAt).toLocaleString()} · {x.contentSha256.slice(0,12)}</button><Button variant="outline" onClick={()=>void createProposal(x.id)}>Создать черновик КП</Button></div>)}{captureDetail!==null && <details><summary>Данные выбранного снимка</summary><pre className="max-h-96 overflow-auto text-xs">{JSON.stringify(captureDetail,null,2)}</pre></details>}</section>}
    {savedId && <section className="space-y-2 rounded border p-3"><h2 className="font-semibold">Коммерческие предложения</h2><p className="text-sm">Условия вводятся вручную; налоги, согласование и выпуск пока не настроены.</p><Button variant="outline" onClick={()=>void loadProposals()}>Список черновиков КП</Button>{proposals.map(p=><button disabled={savingTerms} key={p.id} className="block text-primary underline" onClick={async()=>{try{(termsDirty&&!window.confirm('Несохранённые условия КП будут потеряны. Продолжить?'))?undefined:selectProposal((await api.get(`/jv/orders/${savedId}/proposal-drafts/${p.id}`)).data)}catch{setError('Не удалось открыть черновик КП.')}}}>Черновик КП №{p.number} · {new Date(p.createdAt).toLocaleString()}</button>)}{proposalDetail && <article className="space-y-2 rounded border bg-background p-4"><h3 className="font-semibold">Черновик коммерческого предложения №{proposalDetail.number}</h3><p>Заказ №{proposalDetail.payload.orderNumber} · версия {proposalDetail.payload.orderVersion} · {proposalDetail.payload.profile==='RETAIL'?'Розница':'Комплектация'}</p><ul>{proposalDetail.payload.positions.map(p=><li key={p.id}>{p.family} · слот {p.slot} · количество {exact(p.quantity)} · стоимость за единицу {displayProposalMoney(p.confirmedUnitAmount)?.text ?? 'нет данных'} ₽{displayProposalMoney(p.confirmedUnitAmount)?.rounded && ' (округлено)'}</li>)}</ul><p className="font-semibold">Итого: {displayProposalMoney(proposalDetail.payload.totalSalePrice)?.text ?? 'нет данных'} ₽{displayProposalMoney(proposalDetail.payload.totalSalePrice)?.rounded && ' (округлено)'}</p><details><summary>Точное значение итога</summary><p>{exact(proposalDetail.payload.totalSalePrice)} ₽</p></details><div className="grid gap-3 md:grid-cols-2">{([['recipient','Получатель'],['requisites','Реквизиты'],['payment','Условия оплаты'],['timeframe','Сроки'],['delivery','Условия доставки']] as const).map(([key,label])=><label className="block text-sm" key={key}><span className="block">{label}</span><textarea aria-label={label} disabled={savingTerms} className="min-h-20 w-full rounded border bg-background p-2" maxLength={2000} value={proposalTerms[key]} onChange={e=>setProposalTerms(old=>({...old,[key]:e.target.value}))}/></label>)}</div><Button variant="outline" disabled={savingTerms||!termsDirty} onClick={()=>void reviseProposal()}>{savingTerms?'Сохранение…':'Сохранить условия новой версией'}</Button><p className="text-sm text-muted-foreground">Предыдущий черновик останется доступен. Все пять полей обязательны для сохранения условий.</p><p className="text-sm text-muted-foreground">Черновик не утверждён и не является выпущенным документом.</p></article>}</section>}
    {revisions.length>0 && <details className="rounded border p-3"><summary>История версий</summary>{revisions.map(r=><details key={r.version}><summary>Версия {r.version} · {new Date(r.createdAt).toLocaleString()} · {r.authorId}</summary><pre className="overflow-auto text-xs">{JSON.stringify(r.snapshot,null,2)}</pre><Button variant="outline" disabled={saving} onClick={()=>void restoreRevision(r.version)}>Восстановить эту версию</Button></details>)}</details>}
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">Начальные значения получены из контрольного сценария выбранного профиля. Проверьте параметры каждой конструкции перед расчётом. Некоторые переключатели пока доступны только в подтверждённом варианте.</p>
    {profile==='COMPLETATION' && config?.schemaVersion==='JV-UI-INPUTS-3' && <p className="rounded border p-3 text-sm">В комплектации стоимость стекла по умолчанию исключена. Общий переключатель Excel также влияет на дополнительные работы Slider; неподтверждённые варианты остаются частичными.</p>}
    <label className="block max-w-xs space-y-1 text-sm">Ценовой профиль<select className={selectClass} value={profile} onChange={e => { remember(); invalidate(); setConfig(null); setProfile(e.target.value as Profile) }}><option value="COMPLETATION">Комплектация</option><option value="RETAIL">Розница</option></select></label>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium">Конструкции ({positions.length}/7)</h2><Button onClick={() => add()} disabled={!config || positions.length >= 7 || positions.some(p=>p.configurationId)}>Добавить конструкцию</Button></div>
    {positions.length===0 && config && <Button variant="outline" onClick={addDoorExample}>{config.frontDoorProfile.label}</Button>}
    {positions.some(p=>p.configurationId) && <div className="rounded border p-3 text-sm"><p>{config?.frontDoorProfile.restriction} Транспорт можно переключать.</p><Button variant="outline" onClick={()=>{remember();invalidate();setPositions([]);setActiveId('');setTab('list')}}>Очистить пример</Button></div>}
    {positions.length === 7 && <p className="text-sm text-muted-foreground">Все семь слотов заняты. Для новой позиции удалите одну из существующих.</p>}
    {positions.length === 0 && <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Добавьте первую конструкцию. Доступно до семи отдельных слотов.</p>}
    <div className="grid min-w-0 gap-4 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_minmax(320px,0.8fr)]">
      <PositionList positions={positions} activeId={activeId} select={id=>{setActiveId(id);setTab('form')}} visible={tab==='list'}/>
      <div className={`min-w-0 ${tab==='form'?'':'hidden'} md:block`}>
        {positions.map((p,index)=>p.id===activeId&&<PositionForm key={p.id} p={p} index={index} positions={positions} config={config} update={update} updateField={updateField} move={move} add={add} remove={id=>{remember();invalidate();const next=positions.filter(x=>x.id!==id);setPositions(next);setActiveId(next[0]?.id??'');if(!next.length)setTab('list')}} />)}
      </div>
      <div className={`min-w-0 space-y-3 ${tab==='result'?'':'hidden'} md:col-span-2 md:block xl:col-span-1`}><h2 className="font-semibold">Результат · {profile === 'RETAIL' ? 'Розница' : 'Комплектация'}</h2><p>{result ? (result.status === 'COMPLETE' ? 'Расчёт завершён' : 'Частичный расчёт') : 'Расчёт не выполнен или устарел'}</p>{result?.status==='COMPLETE' && result.calculation.status==='COMPLETE' && result.calculation.totalSalePrice && <p>Итог: {exact(result.calculation.totalSalePrice)} ₽</p>}{result && <a href="#jv-details" onClick={()=>setTab('result')} className="block text-primary underline">Открыть подробности</a>}
        <Button onClick={calculate} disabled={!config || !positions.length || loading}>{loading ? 'Выполняется расчёт…' : 'Рассчитать'}</Button>
      </div>
    </div>
    {result && <div id="jv-details" className={`min-w-0 ${tab==='result'?'':'hidden'} md:block`}><JVResultView result={result} inputs={positions}/></div>}
    {error && <p role="alert" className="rounded border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
  </div></fieldset>
}

function PositionForm({p,index,positions,config,update,updateField,move,add,remove}: {p:DraftPosition;index:number;positions:DraftPosition[];config:JvUiConfig|null;update:(id:string,change:Partial<Pick<DraftPosition,'slot'|'family'|'quantity'|'inputs'>>)=>void;updateField:(id:string,path:string,value:JvUiValue)=>void;move:(index:number,delta:number)=>void;add:(p?:DraftPosition)=>void;remove:(id:string)=>void}) {
  return <section key={p.id} className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="font-medium">Позиция {index + 1} · слот {p.slot}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">Семейство<select disabled={positions.some(x=>x.configurationId)} className={selectClass} value={p.family} onChange={e => { const family = e.target.value as UnifiedFamily; if (config) { const inputs = { ...config.families[family] }; const mode = Object.entries(p.inputs).find(([path]) => transportField(path))?.[1]; if (mode !== undefined) for (const path of Object.keys(inputs)) if (transportField(path)) inputs[path] = mode; update(p.id, { family, inputs }) } }}>{families.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
        <label className="space-y-1 text-sm">Слот<select disabled={positions.some(x=>x.configurationId)} className={selectClass} value={p.slot} onChange={e => update(p.id, { slot: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(s => <option key={s} value={s} disabled={s !== p.slot && positions.some(other => other.slot === s)}>{s}</option>)}</select></label>
        <label className="space-y-1 text-sm">Количество, шт.<Input disabled={positions.some(x=>x.configurationId)} inputMode="numeric" value={p.quantity} aria-invalid={!/^[1-9]\d{0,5}$/.test(p.quantity)} onChange={e => update(p.id, { quantity: e.target.value })}/></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(p.inputs).map(([path, value]) => {
        const field = (p.configurationId?config?.frontDoorProfile.fieldMetadata:config?.fieldMetadata[p.family])?.find(entry => entry.path === path)
        const options = field?.options
        const disabled = fieldDisabled(path, p.inputs) || (positions.some(x=>x.configurationId) && !transportField(path))
        return <label key={path} className="space-y-1 text-sm"><span className="block">{field ? `${field.label}${field.unit ? `, ${field.unit}` : ''}` : fieldLabel(path)}</span>{typeof value === 'boolean' ? <input type="checkbox" checked={value} disabled={disabled} onChange={e => updateField(p.id, path, e.target.checked)}/> : options ? <select className={selectClass} value={String(value)} disabled={disabled || options.filter(option => option.supported).length <= 1} onChange={e => updateField(p.id, path, typeof value === 'number' ? Number(e.target.value) : e.target.value)}>{options.map(option => <option key={String(option.value)} value={String(option.value)} disabled={!option.supported}>{option.label}{!option.supported ? ' (не поддерживается)' : ''}</option>)}</select> : <Input value={String(value)} inputMode="decimal" disabled={disabled} onChange={e => updateField(p.id, path, e.target.value)}/>} {field?.status === 'LIMITED' && <span className="block text-xs text-muted-foreground">{field.dependsOn ?? 'Часть вариантов пока не подтверждена.'}</span>}</label>
      })}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => move(index, -1)} disabled={index === 0}>Выше</Button><Button variant="outline" onClick={() => move(index, 1)} disabled={index === positions.length - 1}>Ниже</Button><Button variant="outline" onClick={() => add(p)} disabled={positions.length >= 7}>Дублировать</Button><Button variant="outline" disabled={positions.some(x=>x.configurationId)} onClick={() => remove(p.id)}>Удалить</Button></div>
    </section>

}

function PositionList({positions,activeId,select,visible}:{positions:DraftPosition[];activeId:string;select:(id:string)=>void;visible:boolean}) {
  return <aside aria-label="Список конструкций" className={`space-y-2 rounded border bg-card p-3 ${visible?'':'hidden'} md:block`}>{positions.map(p=><button key={p.id} onClick={()=>select(p.id)} aria-current={p.id===activeId?'true':undefined} className="block w-full rounded border p-2 text-left aria-[current=true]:border-primary"><strong>{p.family} · слот {p.slot}</strong><span className="block text-sm text-muted-foreground">Количество: {p.quantity} · {String(p.inputs['input.widthMm'] ?? p.inputs['position.geometry.widthMm'] ?? p.inputs['geometry.widthMm'] ?? p.inputs['construction.widthMm'] ?? '—')} × {String(p.inputs['input.heightMm'] ?? p.inputs['position.geometry.heightMm'] ?? p.inputs['geometry.heightMm'] ?? p.inputs['construction.heightMm'] ?? '—')} мм</span></button>)}</aside>
}
