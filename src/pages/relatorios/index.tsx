import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Download, Loader2, FileText, BarChart2,
  PieChartIcon, LineChartIcon,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip2,
} from 'recharts'
import { relatoriosApi, contasApi, lancamentosApi } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import { PeriodoPicker, computeDates, PERIODO_DEFAULT } from '../../lib/periodo'
import type { Periodo } from '../../lib/periodo'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table'
import type { Conta } from '../../types'

type Tab = 'fluxo' | 'categoria' | 'centro' | 'previsto' | 'extrato'
type CatView = 'pizza' | 'linhas'

interface FluxoRow { periodo: string; entradas: number; saidas: number; saldo: number; saldo_acumulado: number }
interface CategoriaRow { categoria: { id: number; nome: string }; subcategorias: { categoria: { id: number; nome: string }; total: number }[]; total: number }
interface CentroRow { centro: { id: number; nome: string }; entradas: number; saidas: number; saldo: number }
interface PrevistoRow { categoria: { id: number; nome: string }; previsto: number; realizado: number; diferenca: number; percentual: number }
interface ExtratoRow { data: string; descricao: string; tipo: 'entrada' | 'saida'; valor_total: number; saldo: number; categoria_nome: string | null }

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
]

const LINE_TYPE_LABELS: Record<string, string> = {
  entrada: 'Receita',
  saida: 'Despesa',
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'fluxo', label: 'Fluxo de Caixa' },
  { id: 'categoria', label: 'Por Categoria' },
  { id: 'centro', label: 'Por Centro de Custo' },
  { id: 'previsto', label: 'Previsto vs Realizado' },
  { id: 'extrato', label: 'Extrato de Conta' },
]

function toDisplayDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type CatGranularidade = 'dia' | 'semana' | 'mes'

const CAT_GRANULARIDADES: { id: CatGranularidade; label: string }[] = [
  { id: 'dia', label: 'Diário' },
  { id: 'semana', label: 'Semanal' },
  { id: 'mes', label: 'Mensal' },
]

function toIntervalLabel(key: string, granularity: CatGranularidade) {
  if (granularity === 'dia') return toDisplayDate(key)
  if (granularity === 'semana') {
    const [start, end] = key.split('_')
    return `${toDisplayDate(start)} – ${toDisplayDate(end)}`
  }
  const [year, month] = key.split('-')
  return `${month}/${year}`
}

function buildIntervals(inicio: string, fim: string, granularity: CatGranularidade) {
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

function getIntervalKey(date: string, granularity: CatGranularidade, inicio: string, fim: string) {
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

export default function Relatorios() {
  const [tab, setTab] = useState<Tab>('fluxo')
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_DEFAULT)
  const [contaId, setContaId] = useState('')
  const [shouldFetch, setShouldFetch] = useState(false)
  const [catView, setCatView] = useState<CatView>('pizza')
  const [catGranularity, setCatGranularity] = useState<CatGranularidade>('dia')

  const { inicio: dataInicio, fim: dataFim } = computeDates(periodo)

  const { data: contas } = useQuery<Conta[]>({
    queryKey: ['contas'],
    queryFn: async () => (await contasApi.list()).data,
  })

  const params = { data_inicio: dataInicio, data_fim: dataFim, conta_id: contaId ? Number(contaId) : undefined }

  const { data: fluxoData, isLoading: fluxoLoading } = useQuery<FluxoRow[]>({
    queryKey: ['relatorios', 'fluxo', params],
    queryFn: () => relatoriosApi.fluxoCaixa(params),
    enabled: tab === 'fluxo' && shouldFetch,
  })

  const { data: catData, isLoading: catLoading } = useQuery<CategoriaRow[]>({
    queryKey: ['relatorios', 'categoria', params],
    queryFn: () => relatoriosApi.porCategoria(params),
    enabled: tab === 'categoria' && shouldFetch,
  })

  // Fetch raw lancamentos for the line chart
  const { data: lancamentosRaw, isLoading: lancLoading } = useQuery({
    queryKey: ['relatorios', 'cat-lancamentos', dataInicio, dataFim],
    queryFn: async () => {
      const res = await lancamentosApi.list({ data_inicio: dataInicio, data_fim: dataFim })
      return res.data.items
    },
    enabled: tab === 'categoria' && shouldFetch && catView === 'linhas',
  })

  const { data: centroData, isLoading: centroLoading } = useQuery<CentroRow[]>({
    queryKey: ['relatorios', 'centro', params],
    queryFn: () => relatoriosApi.porCentroCusto(params),
    enabled: tab === 'centro' && shouldFetch,
  })

  const { data: previstoData, isLoading: previstoLoading } = useQuery<PrevistoRow[]>({
    queryKey: ['relatorios', 'previsto', params],
    queryFn: () => relatoriosApi.previstoRealizado(params),
    enabled: tab === 'previsto' && shouldFetch,
  })

  const { data: extratoData, isLoading: extratoLoading } = useQuery<ExtratoRow[]>({
    queryKey: ['relatorios', 'extrato', params],
    queryFn: () => relatoriosApi.extratoConta({ ...params, conta_id: Number(contaId) }),
    enabled: tab === 'extrato' && shouldFetch && !!contaId,
  })

  // ── Line chart data aggregation ────────────────────────────────────────────
  const { lineData, lineIntervals, lineCategories } = useMemo(() => {
    if (!lancamentosRaw || !lancamentosRaw.length) return { lineData: [], lineIntervals: [], lineCategories: [] }

    const intervals = buildIntervals(dataInicio, dataFim, catGranularity)
    const rowMap = new Map<string, { periodo: string; entrada: number; saida: number }>()

    intervals.forEach((interval) => {
      rowMap.set(interval.key, { periodo: interval.label, entrada: 0, saida: 0 })
    })

    for (const l of lancamentosRaw) {
      const intervalKey = getIntervalKey(l.data, catGranularity, dataInicio, dataFim)
      const row = rowMap.get(intervalKey)
      if (!row) continue
      row[l.tipo] = (row[l.tipo] || 0) + l.valor_total
    }

    const data = Array.from(rowMap.values())
    const categories = [
      { id: 'entrada', nome: LINE_TYPE_LABELS.entrada },
      { id: 'saida', nome: LINE_TYPE_LABELS.saida },
    ]

    return { lineData: data, lineIntervals: intervals, lineCategories: categories }
  }, [lancamentosRaw, dataInicio, dataFim, catGranularity])

  const isLoading = fluxoLoading || catLoading || centroLoading || previstoLoading || extratoLoading || lancLoading

  const buildExportUrl = (formato: 'pdf' | 'excel') => {
    const path =
      tab === 'fluxo' ? 'fluxo-caixa'
        : tab === 'categoria' ? 'por-categoria'
          : tab === 'centro' ? 'por-centro-custo'
            : tab === 'previsto' ? 'previsto-realizado'
              : 'extrato-conta'
    const qs = new URLSearchParams({ formato, data_inicio: dataInicio, data_fim: dataFim })
    if ((tab === 'fluxo' || tab === 'extrato') && contaId) qs.set('conta_id', contaId)
    return `${API_BASE}/relatorios/${path}?${qs.toString()}`
  }

  const selectClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setShouldFetch(false) }}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Period picker centered */}
          <div className="flex justify-center">
            <PeriodoPicker value={periodo} onChange={(v) => { setPeriodo(v); setShouldFetch(false) }} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border pt-4">
            {(tab === 'fluxo' || tab === 'extrato') && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">
                  Conta{tab === 'extrato' && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <select
                  className={selectClass + ' w-48'}
                  value={contaId}
                  onChange={(e) => setContaId(e.target.value)}
                >
                  {tab !== 'extrato' && <option value="">Todas</option>}
                  {tab === 'extrato' && <option value="">Selecione...</option>}
                  {contas?.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <Button onClick={() => setShouldFetch(true)} className="gap-2">
              <BarChart2 size={16} />
              Gerar
            </Button>

            {shouldFetch && (
              <div className="flex gap-2">
                <a href={buildExportUrl('pdf')} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText size={14} />PDF
                  </Button>
                </a>
                <a href={buildExportUrl('excel')} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Download size={14} />Excel
                  </Button>
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* ── Fluxo de Caixa ── */}
      {tab === 'fluxo' && shouldFetch && !fluxoLoading && (
        <Card>
          <CardHeader><CardTitle className="text-base">Fluxo de Caixa</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!fluxoData?.length ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum dado encontrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Saldo Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fluxoData.map((row) => (
                    <TableRow key={row.periodo}>
                      <TableCell className="font-medium">{row.periodo}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(row.entradas)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(row.saidas)}</TableCell>
                      <TableCell className={`text-right font-medium ${row.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.saldo)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${row.saldo_acumulado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(row.saldo_acumulado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Por Categoria ── */}
      {tab === 'categoria' && shouldFetch && !catLoading && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Por Categoria</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
                  <button
                    title="Gráfico de Pizza"
                    onClick={() => setCatView('pizza')}
                    className={`p-1.5 rounded transition-colors ${catView === 'pizza' ? 'bg-card shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <PieChartIcon size={16} />
                  </button>
                  <button
                    title="Gráfico de Linhas"
                    onClick={() => setCatView('linhas')}
                    className={`p-1.5 rounded transition-colors ${catView === 'linhas' ? 'bg-card shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <LineChartIcon size={16} />
                  </button>
                </div>
                {catView === 'linhas' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Granularidade</span>
                    <select
                      className={selectClass + ' w-40'}
                      value={catGranularity}
                      onChange={(e) => setCatGranularity(e.target.value as CatGranularidade)}
                    >
                      {CAT_GRANULARIDADES.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!catData?.length ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum dado encontrado.</div>
            ) : catView === 'pizza' ? (
              /* ── Pizza View ── */
              <div className="space-y-6">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart margin={{ top: 20, right: 140, left: 20, bottom: 20 }}>
                    <Pie
                      data={catData.map((r) => ({ name: r.categoria.nome, value: r.total }))}
                      dataKey="value"
                      nameKey="name"
                      cx="45%"
                      cy="50%"
                      outerRadius={100}
                      labelLine={false}
                      label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {catData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ right: 0, top: '50%', transform: 'translateY(-50%)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Subcategoria</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catData.map((row) =>
                      row.subcategorias.length > 0
                        ? row.subcategorias.map((sub) => (
                          <TableRow key={`${row.categoria.id}-${sub.categoria.id}`}>
                            <TableCell className="font-medium">{row.categoria.nome}</TableCell>
                            <TableCell className="text-muted-foreground">{sub.categoria.nome}</TableCell>
                            <TableCell className="text-right">{formatCurrency(sub.total)}</TableCell>
                          </TableRow>
                        ))
                        : [
                          <TableRow key={row.categoria.id}>
                            <TableCell className="font-medium">{row.categoria.nome}</TableCell>
                            <TableCell className="text-muted-foreground">—</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                          </TableRow>,
                        ]
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* ── Line View ── */
              <div className="space-y-6">
                {lancLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : lineData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">Nenhum lançamento encontrado no período.</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="periodo"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={80} />
                        <ReTooltip2
                          formatter={(value, name) => [formatCurrency(Number(value ?? 0)), typeof name === 'string' ? name : String(name)]}
                          labelFormatter={(label) => String(label)}
                        />
                        <Legend formatter={(id) => lineCategories.find(c => c.id === id)?.nome ?? id} />
                        {lineCategories.map((cat) => (
                          <Line
                            key={cat.id}
                            type="monotone"
                            dataKey={cat.id}
                            name={cat.nome}
                            stroke={cat.id === 'entrada' ? CHART_COLORS[2] : CHART_COLORS[3]}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>

                    {/* Detailed table: rows = categories, columns = days */}
                    <div className="overflow-x-auto">
                      <table className="text-xs border-collapse w-full">
                        <thead>
                          <tr>
                            <th className="sticky left-0 bg-muted text-left px-3 py-2 font-semibold border border-border whitespace-nowrap">
                              Categoria
                            </th>
                            {lineIntervals.map((interval) => (
                              <th key={interval.key} className="px-2 py-2 text-center font-medium border border-border whitespace-nowrap text-muted-foreground">
                                {interval.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {lineCategories.map((cat, i) => (
                            <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                              <td className="sticky left-0 bg-card px-3 py-2 border border-border font-medium whitespace-nowrap">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                                {cat.nome}
                              </td>
                              {lineIntervals.map((interval) => {
                                const val = lineData.find(r => r.periodo === interval.label)?.[cat.id as keyof typeof lineData[0]]
                                return (
                                  <td key={interval.key} className="px-2 py-2 text-center border border-border whitespace-nowrap">
                                    {val ? (
                                      <span className="text-red-600">{formatCurrency(val as number)}</span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Por Centro de Custo ── */}
      {tab === 'centro' && shouldFetch && !centroLoading && (
        <Card>
          <CardHeader><CardTitle className="text-base">Por Centro de Custo</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!centroData?.length ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum dado encontrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {centroData.map((row) => (
                    <TableRow key={row.centro.id}>
                      <TableCell className="font-medium">{row.centro.nome}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(row.entradas)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(row.saidas)}</TableCell>
                      <TableCell className={`text-right font-medium ${row.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Extrato de Conta ── */}
      {tab === 'extrato' && shouldFetch && !extratoLoading && (
        <Card>
          <CardHeader><CardTitle className="text-base">Extrato de Conta</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!contaId ? (
              <div className="text-center py-12 text-muted-foreground">Selecione uma conta para gerar o extrato.</div>
            ) : !extratoData?.length ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum lançamento encontrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extratoData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(row.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{row.descricao}</TableCell>
                      <TableCell className="text-muted-foreground">{row.categoria_nome ?? '—'}</TableCell>
                      <TableCell className={`text-right ${row.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {row.tipo === 'entrada' ? '+' : '-'}{formatCurrency(row.valor_total)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${row.saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(row.saldo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Previsto vs Realizado ── */}
      {tab === 'previsto' && shouldFetch && !previstoLoading && (
        <Card>
          <CardHeader><CardTitle className="text-base">Previsto vs Realizado</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!previstoData?.length ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum dado encontrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead className="text-right">Realizado</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead className="text-right">% Execução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previstoData.map((row) => (
                    <TableRow key={row.categoria.id}>
                      <TableCell className="font-medium">{row.categoria.nome}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.previsto)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.realizado)}</TableCell>
                      <TableCell className={`text-right ${row.diferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.diferenca)}
                      </TableCell>
                      <TableCell className="text-right">{row.percentual.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
