import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PeriodoModo = 'mes' | 'semana' | 'dia' | 'trimestre' | 'personalizado'

export interface Periodo {
  modo: PeriodoModo
  offset: number
  customInicio: string
  customFim: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function computeDates(p: Periodo): { inicio: string; fim: string } {
  if (p.modo === 'personalizado') return { inicio: p.customInicio, fim: p.customFim }
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  if (p.modo === 'dia') {
    const d = new Date(hoje)
    d.setDate(d.getDate() + p.offset)
    const s = toISO(d)
    return { inicio: s, fim: s }
  }
  if (p.modo === 'semana') {
    const d = new Date(hoje)
    const dow = d.getDay()
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) + p.offset * 7)
    const fim = new Date(d)
    fim.setDate(fim.getDate() + 6)
    return { inicio: toISO(d), fim: toISO(fim) }
  }
  if (p.modo === 'mes') {
    const start = new Date(hoje.getFullYear(), hoje.getMonth() + p.offset, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    return { inicio: toISO(start), fim: toISO(end) }
  }
  if (p.modo === 'trimestre') {
    const q = Math.floor(hoje.getMonth() / 3)
    const qBase = hoje.getFullYear() * 4 + q + p.offset
    const targetY = Math.floor(qBase / 4)
    const targetQ = ((qBase % 4) + 4) % 4
    const start = new Date(targetY, targetQ * 3, 1)
    const end = new Date(targetY, targetQ * 3 + 3, 0)
    return { inicio: toISO(start), fim: toISO(end) }
  }
  return { inicio: '', fim: '' }
}

export function getPeriodoLabel(p: Periodo): string {
  if (p.modo === 'personalizado') {
    if (p.customInicio && p.customFim)
      return `${formatDate(p.customInicio)} – ${formatDate(p.customFim)}`
    return 'Período Personalizado'
  }
  const hoje = new Date()
  if (p.modo === 'dia') {
    if (p.offset === 0) return 'Hoje'
    if (p.offset === -1) return 'Ontem'
    return `Dia ${formatDate(computeDates(p).inicio)}`
  }
  if (p.modo === 'semana') {
    if (p.offset === 0) return 'Esta semana'
    const { inicio, fim } = computeDates(p)
    return `Semana ${formatDate(inicio)} – ${formatDate(fim)}`
  }
  if (p.modo === 'mes') {
    if (p.offset === 0) return 'Este mês'
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + p.offset, 1)
    return `Mês de ${MESES[d.getMonth()]} ${d.getFullYear()}`
  }
  if (p.modo === 'trimestre') {
    if (p.offset === 0) return 'Este trimestre'
    const q = Math.floor(hoje.getMonth() / 3)
    const qBase = hoje.getFullYear() * 4 + q + p.offset
    const targetY = Math.floor(qBase / 4)
    const targetQ = ((qBase % 4) + 4) % 4
    return `T${targetQ + 1} ${targetY}`
  }
  return ''
}

export const PERIODO_OPCOES: { modo: PeriodoModo; label: string }[] = [
  { modo: 'mes', label: 'Este mês' },
  { modo: 'semana', label: 'Esta semana' },
  { modo: 'dia', label: 'Hoje' },
  { modo: 'trimestre', label: 'Este trimestre' },
  { modo: 'personalizado', label: 'Período Personalizado' },
]

export const PERIODO_DEFAULT: Periodo = { modo: 'mes', offset: 0, customInicio: '', customFim: '' }

// ─── PeriodoPicker Component ──────────────────────────────────────────────────

interface PeriodoPickerProps {
  value: Periodo
  onChange: (v: Periodo) => void
}

export function PeriodoPicker({ value, onChange }: PeriodoPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isCustom = value.modo === 'personalizado'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        {!isCustom && (
          <Button variant="outline" size="icon" className="h-9 w-9"
            onClick={() => onChange({ ...value, offset: value.offset - 1 })}>
            <ChevronLeft size={16} />
          </Button>
        )}
        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-5 py-2 border border-border rounded-md bg-card hover:bg-muted/50 font-medium text-sm min-w-[220px] justify-center transition-colors"
          >
            <span>{getPeriodoLabel(value)}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
          {open && (
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-md shadow-md overflow-hidden min-w-[200px]">
              {PERIODO_OPCOES.map((opt) => (
                <button key={opt.modo} type="button"
                  onClick={() => { onChange({ ...value, modo: opt.modo, offset: 0 }); setOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-muted/50 ${value.modo === opt.modo ? 'text-primary font-semibold bg-primary/5' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {!isCustom && (
          <Button variant="outline" size="icon" className="h-9 w-9"
            onClick={() => onChange({ ...value, offset: value.offset + 1 })}>
            <ChevronRight size={16} />
          </Button>
        )}
      </div>
      {isCustom && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">De</Label>
            <Input type="date" className="w-36 h-8 text-sm" value={value.customInicio}
              onChange={(e) => onChange({ ...value, customInicio: e.target.value })} />
          </div>
          <span className="text-muted-foreground text-sm">–</span>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Até</Label>
            <Input type="date" className="w-36 h-8 text-sm" value={value.customFim}
              onChange={(e) => onChange({ ...value, customFim: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  )
}
