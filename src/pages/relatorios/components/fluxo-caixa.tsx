import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts'
import { relatoriosApi, lancamentosApi } from '../../../lib/api'
import { formatCurrency } from '../../../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../components/ui/table'

interface FluxoRow { periodo: string; entradas: number; saidas: number; saldo: number; saldo_acumulado: number }

type Granularidade = 'dia' | 'semana' | 'mes'

interface Props {
  dataInicio: string;
  dataFim: string;
  contaId?: string;
  enabled?: boolean;
}

function toDisplayDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function toIntervalLabel(key: string, granularity: Granularidade) {
  if (granularity === 'dia') return toDisplayDate(key)
  if (granularity === 'semana') {
    const [start, end] = key.split('_')
    return `${toDisplayDate(start)} – ${toDisplayDate(end)}`
  }
  const [year, month] = key.split('-')
  return `${month}/${year}`
}

function buildIntervals(inicio: string, fim: string, granularity: Granularidade) {
  const start = new Date(`${inicio}T00:00:00`)
  const end = new Date(`${fim}T00:00:00`)
  const intervals: { key: string; label: string }[] = []

  if (granularity === 'dia') {
    const current = new Date(start)
    while (current <= end) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
      intervals.push({ key, label: toIntervalLabel(key, 'dia') })
      current.setDate(current.getDate() + 1)
    }
    return intervals
  }

  if (granularity === 'semana') {
    let currentStart = new Date(start)
    while (currentStart <= end) {
      const currentEnd = new Date(currentStart)
      currentEnd.setDate(currentEnd.getDate() + 6)
      const intervalEnd = currentEnd > end ? end : currentEnd
      const key = `${currentStart.getFullYear()}-${String(currentStart.getMonth() + 1).padStart(2, '0')}-${String(currentStart.getDate()).padStart(2, '0')}` +
        `_${intervalEnd.getFullYear()}-${String(intervalEnd.getMonth() + 1).padStart(2, '0')}-${String(intervalEnd.getDate()).padStart(2, '0')}`
      intervals.push({ key, label: toIntervalLabel(key, 'semana') })
      currentStart.setDate(currentStart.getDate() + 7)
    }
    return intervals
  }

  const current = new Date(start.getFullYear(), start.getMonth(), 1)
  while (current <= end) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
    intervals.push({ key, label: toIntervalLabel(key, 'mes') })
    current.setMonth(current.getMonth() + 1)
  }
  return intervals
}

function getIntervalKey(date: string, granularity: Granularidade, inicio: string, fim: string) {
  const parsed = new Date(`${date}T00:00:00`)
  if (granularity === 'dia') {
    return date
  }
  if (granularity === 'semana') {
    const start = new Date(`${inicio}T00:00:00`)
    let currentStart = new Date(start)
    while (currentStart <= new Date(`${fim}T00:00:00`)) {
      const currentEnd = new Date(currentStart)
      currentEnd.setDate(currentEnd.getDate() + 6)
      const intervalEnd = currentEnd > new Date(`${fim}T00:00:00`) ? new Date(`${fim}T00:00:00`) : currentEnd
      if (parsed >= currentStart && parsed <= intervalEnd) {
        return `${currentStart.getFullYear()}-${String(currentStart.getMonth() + 1).padStart(2, '0')}-${String(currentStart.getDate()).padStart(2, '0')}` +
          `_${intervalEnd.getFullYear()}-${String(intervalEnd.getMonth() + 1).padStart(2, '0')}-${String(intervalEnd.getDate()).padStart(2, '0')}`
      }
      currentStart.setDate(currentStart.getDate() + 7)
    }
    return date
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
}

export function FluxoCaixa({ dataInicio, dataFim, contaId, enabled = true }: Props) {
  const [granularidade, setGranularidade] = useState<Granularidade>('dia')

  const { data: lancamentosRaw, isLoading: lancLoading } = useQuery({
    queryKey: ['relatorios', 'fluxo-lancamentos', dataInicio, dataFim, contaId],
    queryFn: async () => {
      const res = await lancamentosApi.list({ data_inicio: dataInicio, data_fim: dataFim, conta_id: contaId ? Number(contaId) : undefined })
      return res.data.items
    },
    enabled,
  })

  const yesterday = useMemo(() => {
    const d = new Date(`${dataInicio}T00:00:00`)
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [dataInicio])

  // We fetch fluxoCaixa up to yesterday to get the true initial balance
  const { data: fluxoAnterior, isLoading: fluxoLoading } = useQuery<FluxoRow[]>({
    queryKey: ['relatorios', 'fluxo-anterior', yesterday, contaId],
    queryFn: () => relatoriosApi.fluxoCaixa({ data_fim: yesterday, conta_id: contaId ? Number(contaId) : undefined }),
    enabled,
  })

  const aggData = useMemo(() => {
    if (!lancamentosRaw) return []

    const intervals = buildIntervals(dataInicio, dataFim, granularidade)
    const map = new Map<string, FluxoRow>()

    // Discover the starting balance before the period
    let lastSaldoAcumulado = 0;
    if (fluxoAnterior && fluxoAnterior.length > 0) {
      lastSaldoAcumulado = fluxoAnterior[fluxoAnterior.length - 1].saldo_acumulado;
    }

    // Initialize all periods
    intervals.forEach((interval) => {
      map.set(interval.key, { 
        periodo: interval.label, 
        entradas: 0, 
        saidas: 0, 
        saldo: 0, 
        saldo_acumulado: 0 
      })
    })

    // Accumulate the entries and exits
    for (const l of lancamentosRaw) {
      const intervalKey = getIntervalKey(l.data, granularidade, dataInicio, dataFim)
      const existing = map.get(intervalKey)
      if (existing) {
        if (l.tipo === 'entrada') existing.entradas += l.valor_total
        else existing.saidas += l.valor_total
        
        existing.saldo = existing.entradas - existing.saidas
      }
    }

    // Propagate the running balance chronologically
    intervals.forEach((interval) => {
      const row = map.get(interval.key)!
      lastSaldoAcumulado += row.saldo
      row.saldo_acumulado = lastSaldoAcumulado
    })

    return Array.from(map.values())
  }, [lancamentosRaw, fluxoAnterior, dataInicio, dataFim, granularidade])

  const isLoading = lancLoading || fluxoLoading

  if (isLoading && enabled) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!enabled && !lancamentosRaw) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Fluxo de Caixa</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Granularidade</span>
            <select
              className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={granularidade}
              onChange={(e) => setGranularidade(e.target.value as Granularidade)}
            >
              <option value="dia">Diário</option>
              <option value="semana">Semanal</option>
              <option value="mes">Mensal</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!aggData?.length ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum dado encontrado.</div>
        ) : (
          <div className="flex flex-col">
            {/* Chart */}
            <div className="p-4 border-b border-border">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={aggData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={80} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={80} />
                  <ReTooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar yAxisId="left" dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Line yAxisId="right" type="monotone" dataKey="saldo_acumulado" name="Saldo Acumulado" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                  <TableHead className="text-right">Saldo Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggData.map((row) => (
                  <TableRow key={row.periodo}>
                    <TableCell className="font-medium">{row.periodo}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(row.entradas)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrency(row.saidas)}</TableCell>
                    <TableCell className={`text-right font-medium ${row.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(row.saldo)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${row.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-700'}`}>
                      {formatCurrency(row.saldo_acumulado)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
