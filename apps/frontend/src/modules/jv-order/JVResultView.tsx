import { memo, useMemo, useState } from 'react'
import { type UnifiedBomLine, type UnifiedPositionResult } from '@bms/shared/jv'
import {
  object,
  rational,
  exact,
  numericText,
  measured,
  scalar,
  address,
  type RecordData,
} from './jvResultAdapter'
import type { JvPreviewResponse, JvUiValue } from '@/api/jv'

type InputPosition = { id: string; inputs: Record<string, JvUiValue> }

const BomTable = memo(function BomTable({
  lines,
  confirmed,
}: {
  lines: readonly UnifiedBomLine[]
  confirmed: boolean
}) {
  if (!lines.length) return <p>Нет доступных строк спецификации.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {[
              'Артикул',
              'Наименование',
              'Позиция',
              'Система',
              'Ед.',
              'Количество заказа',
              'Цена за ед.',
              'Сумма',
              'Источник',
              'Статус',
            ].map((t) => (
              <th className="p-2" key={t}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr className="border-t" key={`${l.sourcePositionId}-${l.traceStepId}-${i}`}>
              <td className="p-2">{l.sku}</td>
              <td className="p-2">{l.description}</td>
              <td className="p-2">{l.sourcePositionId}</td>
              <td className="p-2">{l.family}</td>
              <td className="p-2">{l.unit}</td>
              <td className="p-2">{exact(l.quantity)}</td>
              <td className="p-2">
                {confirmed && l.unitPrice ? exact(l.unitPrice) : 'не подтверждена'}
              </td>
              <td className="p-2">{confirmed && l.amount ? exact(l.amount) : 'не подтверждена'}</td>
              <td className="p-2">{l.sourceCell ?? '—'}</td>
              <td className="p-2">
                {confirmed && l.amount ? 'сумма передана' : 'не подтверждена'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
function Details({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="rounded border p-3" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium">{title}</summary>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </details>
  )
}
function Values({ values }: { values: RecordData }) {
  const rows = Object.entries(values).filter(
    ([, v]) =>
      rational(v) ||
      measured(v) ||
      numericText(v) ||
      typeof v === 'number' ||
      typeof v === 'boolean',
  )
  return rows.length ? (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{scalar(v)}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <p>Детализация недоступна.</p>
  )
}
function GlassPieces({ value }: { value: unknown }) {
  if (!Array.isArray(value) || !value.length) return null
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th>Источник</th>
          <th>Ширина, мм</th>
          <th>Высота, мм</th>
          <th>Количество</th>
        </tr>
      </thead>
      <tbody>
        {value.map((x: any, i: number) => (
          <tr className="border-t" key={i}>
            <td>{x.sourceRow ?? x.row ?? '—'}</td>
            <td>{exact(x.widthMm)}</td>
            <td>{exact(x.heightMm)}</td>
            <td>{exact(x.quantity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
function Trace({ steps }: { steps: readonly unknown[] }) {
  const [query, setQuery] = useState(''),
    [limit, setLimit] = useState(100)
  const filtered = useMemo(
    () =>
      steps
        .map(object)
        .filter((s) =>
          [s.id, s.kind, s.ruleId, s.source?.sheet, s.source?.cell].some(
            (v) => typeof v === 'string' && v.toLowerCase().includes(query.toLowerCase()),
          ),
        ),
    [steps, query],
  )
  return (
    <>
      <label className="block text-sm">
        Поиск по шагам{' '}
        <input
          className="ml-2 rounded border p-1"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(100)
          }}
        />
      </label>
      <p className="text-sm">
        Найдено: {filtered.length}; показано: {Math.min(limit, filtered.length)}
      </p>
      <ol className="space-y-2">
        {filtered.slice(0, limit).map((s, i) => (
          <li className="rounded border p-2 text-sm" key={`${s.id}-${i}`}>
            <div>
              {String(s.label ?? s.id ?? 'Шаг')} · {String(s.status ?? '—')}
            </div>
            <div>
              Правило: {String(s.ruleId ?? '—')} · тип: {String(s.kind ?? '—')} · источник:{' '}
              {address(s.source)}
            </div>
            <div>
              Зависимости:{' '}
              {Array.isArray(s.inputRefs)
                ? s.inputRefs.filter((x: unknown) => typeof x === 'string').join(', ')
                : '—'}
            </div>
            <div>Результат: {scalar(s.result)}</div>
            {Array.isArray(s.errorIds) && s.errorIds.length > 0 && (
              <div>Ошибки: {s.errorIds.join(', ')}</div>
            )}
            {Array.isArray(s.warningIds) && s.warningIds.length > 0 && (
              <div>Предупреждения: {s.warningIds.join(', ')}</div>
            )}
          </li>
        ))}
      </ol>
      {filtered.length > limit && (
        <button className="rounded border p-2" onClick={() => setLimit(limit + 100)}>
          Показать ещё 100
        </button>
      )}
    </>
  )
}
function Cuts({ position }: { position: UnifiedPositionResult }) {
  const c = object(position.calculation),
    g = object(c.geometry)
  const lines =
    position.family === 'LINE'
      ? object(g.cutting).items
      : position.family === 'FRONT'
        ? g.cutPieces
        : undefined
  if (!Array.isArray(lines) || !lines.length)
    return <p>Подробный раскрой для этой системы недоступен в ответе.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th>Деталь</th>
          <th>Длина, мм</th>
          <th>Количество</th>
          <th>Источник</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((v: any, i: number) => (
          <tr className="border-t" key={i}>
            <td>{v.label ?? v.sku ?? 'Деталь'}</td>
            <td>{exact(v.lengthMm ?? v.cutLength?.value)}</td>
            <td>{exact(v.count ?? v.quantity?.value)}</td>
            <td>{v.lengthCell ?? v.sourceCells?.length ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
function PositionDetails({
  position,
  input,
}: {
  position: UnifiedPositionResult
  input?: InputPosition
}) {
  const c = object(position.calculation),
    g = object(c.geometry)
  const dimensions =
    position.family === 'ZIGZAG'
      ? object(g.outputs)
      : position.family === 'LINE'
        ? object(g.openingWidth)
        : object(g.geometry)
  const glass = object(c.glass),
    works = object(c.works),
    paint = object(c.paint),
    subtotals = object(c.confirmedSubtotals),
    costs = object(c.costs),
    lineWork = object(c.work)
  const glassValues =
    position.family === 'FRONT'
      ? {
          areaM2: glass.areaM2,
          glassAmount: glass.glassAmount,
          treatmentAmount: glass.treatmentAmount,
        }
      : position.family === 'LINE'
        ? { glassTotal: glass.glassTotal, preCharge: glass.preCharge }
        : position.family === 'ZIGZAG'
          ? { P40: costs.P40 }
          : { glassD50: subtotals.glassD50 }
  const paintValues =
    position.family === 'FRONT'
      ? { painting: works.painting }
      : position.family === 'LINE'
        ? { finishTotal: paint.finishTotal }
        : position.family === 'ZIGZAG'
          ? { P39: costs.P39 }
          : { paintingM48: subtotals.paintingM48 }
  const workValues =
    position.family === 'FRONT'
      ? { additionalWork: works.additionalWork, installation: works.installation }
      : position.family.startsWith('SLIDER')
        ? {
            additionalWorkM49: subtotals.additionalWorkM49,
            installationM52: subtotals.installationM52,
          }
        : position.family === 'ZIGZAG'
          ? { P41: costs.P41, P43: costs.P43 }
          : position.family === 'LINE'
            ? {
                assemblyAndMilling: lineWork.assemblyAndMilling,
                installation: lineWork.installation,
              }
            : {}
  return (
    <section className="space-y-2 rounded border p-3">
      <h3 className="font-medium">
        Слот {position.slot} · {position.family} · {position.status}
      </h3>
      <p>
        Количество: {exact(position.quantity)}; подтверждённая цена за конструкцию:{' '}
        {position.confirmedUnitAmount ? exact(position.confirmedUnitAmount) : 'нет данных'}
      </p>
      {position.diagnostics.map((d, i) => (
        <p key={i}>{d}</p>
      ))}
      <Details title="Исходные размеры и геометрия">
        <p>
          Ширина:{' '}
          {String(
            input?.inputs['input.widthMm'] ??
              input?.inputs['position.geometry.widthMm'] ??
              input?.inputs['geometry.widthMm'] ??
              input?.inputs['construction.widthMm'] ??
              'нет данных',
          )}{' '}
          мм; высота:{' '}
          {String(
            input?.inputs['input.heightMm'] ??
              input?.inputs['position.geometry.heightMm'] ??
              input?.inputs['geometry.heightMm'] ??
              input?.inputs['construction.heightMm'] ??
              'нет данных',
          )}{' '}
          мм
        </p>
        <Values values={dimensions} />
      </Details>
      <Details title="Раскрой">
        <Cuts position={position} />
      </Details>
      <Details title="Спецификация позиции">
        <BomTable lines={position.bom} confirmed={position.status === 'COMPLETE'} />
      </Details>
      <Details title="Стекло">
        <Values values={glassValues} />
        <GlassPieces value={glass.pieces ?? glass.panes} />
      </Details>
      <Details title="Покраска">
        <Values values={paintValues} />
      </Details>
      <Details title="Работы">
        <Values values={workValues} />
      </Details>
      <Details title="Расходные материалы">
        <Values values={object(c.consumables)} />
      </Details>
      <Details title={`Шаги расчёта (${position.trace.length})`}>
        <Trace steps={position.trace} />
      </Details>
    </section>
  )
}
export default function JVResultView({
  result,
  inputs,
}: {
  result: JvPreviewResponse
  inputs: readonly InputPosition[]
}) {
  const calculation = result.calculation
  const totalCount = calculation.positions.every(
    (p) => rational(p.quantity) && p.quantity.denominator === '1',
  )
    ? calculation.positions.reduce((n, p) => n + BigInt(p.quantity.numerator), 0n).toString()
    : 'нет данных'
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-live="polite">
      <h2 className="text-lg font-medium">
        {result.status === 'COMPLETE' ? 'Расчёт завершён' : 'Частичный расчёт'}
      </h2>
      <p>
        Номер: {result.orderId} · профиль:{' '}
        {result.profile === 'COMPLETATION' ? 'Комплектация' : 'Розница'} · позиций:{' '}
        {calculation.positions.length} · конструкций: {totalCount}
      </p>
      <p>
        Версия правил: {result.versions.rules} · источник: {result.versions.workbook} · каталог:{' '}
        {result.versions.provider}
      </p>
      <p className="text-sm">
        Версии семейств:{' '}
        {Object.entries(result.versions.familyPriceSnapshots)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ')}
      </p>
      {result.status === 'COMPLETE' &&
      calculation.status === 'COMPLETE' &&
      calculation.totalSalePrice ? (
        <p className="text-xl font-semibold">Итог: {exact(calculation.totalSalePrice)} ₽</p>
      ) : (
        <p>Итоговая цена не подтверждена.</p>
      )}
      {calculation.diagnostics.map((d, i) => (
        <p key={i}>{d}</p>
      ))}
      {calculation.limitations.map((d, i) => (
        <p key={i}>{d}</p>
      ))}
      <Details title="Общая спецификация заказа">
        <p>
          Количество уже учитывает число конструкций; строки показаны без дополнительного
          объединения.
        </p>
        <BomTable lines={calculation.bom} confirmed={result.status === 'COMPLETE'} />
      </Details>
      {calculation.positions.map((p) => (
        <PositionDetails key={p.id} position={p} input={inputs.find((i) => i.id === p.id)} />
      ))}
      <Details title={`Шаги заказа (${calculation.trace.length})`}>
        <Trace steps={calculation.trace} />
      </Details>
    </section>
  )
}
