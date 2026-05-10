import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, PieChartIcon, LineChartIcon } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip2,
} from 'recharts'
import { relatoriosApi, lancamentosApi, categoriasApi } from '../../../lib/api'
import { formatCurrency } from '../../../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../components/ui/table'

interface CategoriaRow { categoria: { id: number; nome: string }; subcategorias: { categoria: { id: number; nome: string }; total: number }[]; total: number }

type CatView = 'pizza' | 'linhas'
type CatGranularidade = 'dia' | 'semana' | 'mes'

const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
]

const CAT_GRANULARIDADES: { id: CatGranularidade; label: string }[] = [
  { id: 'dia', label: 'Diário' },
  { id: 'semana', label: 'Semanal' },
  { id: 'mes', label: 'Mensal' },
]

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

export function PorCategoria({ dataInicio, dataFim, contaId, enabled = true }: Props) {
  const [catView, setCatView] = useState<CatView>('pizza')
  const [catGranularity, setCatGranularity] = useState<CatGranularidade>('dia')

  const params = { data_inicio: dataInicio, data_fim: dataFim, conta_id: contaId ? Number(contaId) : undefined }

  const { data: catData, isLoading: catLoading } = useQuery<CategoriaRow[]>({
    queryKey: ['relatorios', 'categoria', params],
    queryFn: () => relatoriosApi.porCategoria(params),
    enabled,
  })

  const { data: lancamentosRaw, isLoading: lancLoading } = useQuery({
    queryKey: ['relatorios', 'cat-lancamentos', dataInicio, dataFim, contaId],
    queryFn: async () => {
      const res = await lancamentosApi.list({ data_inicio: dataInicio, data_fim: dataFim, conta_id: contaId ? Number(contaId) : undefined })
      return res.data.items
    },
    enabled: enabled && catView === 'linhas',
  })

  const { data: categoriasAll, isLoading: catsLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await categoriasApi.list()).data,
    enabled: enabled && catView === 'linhas',
  })

  const lineDataObj = useMemo(() => {
    if (!lancamentosRaw || !categoriasAll) return null

    const intervals = buildIntervals(dataInicio, dataFim, catGranularity)
    
    // Maps interval.label -> (category id -> value)
    const receitasMap = new Map<string, Record<string, number>>()
    const despesasMap = new Map<string, Record<string, number>>()
    const receitasCategories = new Map<string, string>()
    const despesasCategories = new Map<string, string>()

    categoriasAll.forEach(c => {
      const catKey = `cat_${c.id}`
      if (c.tipo === 'receita' || c.tipo === 'entrada') receitasCategories.set(catKey, c.nome)
      else despesasCategories.set(catKey, c.nome)
    })

    intervals.forEach((interval) => {
      receitasMap.set(interval.label, { periodo: interval.label } as any)
      despesasMap.set(interval.label, { periodo: interval.label } as any)
    })

    for (const l of lancamentosRaw) {
      if (!l.categoria_id) continue // skip uncategorized if any
      const intervalKey = getIntervalKey(l.data, catGranularity, dataInicio, dataFim)
      const label = toIntervalLabel(intervalKey, catGranularity)
      
      const catKey = `cat_${l.categoria_id}`

      if (l.tipo === 'entrada') {
        const row = receitasMap.get(label)!
        row[catKey] = (row[catKey] || 0) + l.valor_total
      } else {
        const row = despesasMap.get(label)!
        row[catKey] = (row[catKey] || 0) + l.valor_total
      }
    }

    return {
      intervals,
      receitasData: Array.from(receitasMap.values()),
      despesasData: Array.from(despesasMap.values()),
      receitasCategories: Array.from(receitasCategories.entries()).map(([id, nome]) => ({ id, nome })),
      despesasCategories: Array.from(despesasCategories.entries()).map(([id, nome]) => ({ id, nome }))
    }
  }, [lancamentosRaw, categoriasAll, dataInicio, dataFim, catGranularity])

  const isLoading = catLoading || (catView === 'linhas' && (lancLoading || catsLoading))

  if (isLoading && enabled) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!enabled && !catData) return null;

  return (
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
                  className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
          <div className="space-y-12">
            {!lineDataObj ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum lançamento categorizado encontrado no período.</div>
            ) : (
              <>
                {/* Bloco de Receitas */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-green-600">Receitas por Categoria</h3>
                  {lineDataObj.receitasCategories.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhuma receita encontrada.</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={lineDataObj.receitasData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="periodo" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                          <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={80} />
                          <ReTooltip2
                            formatter={(value, name) => [formatCurrency(Number(value ?? 0)), typeof name === 'string' ? name : String(name)]}
                            labelFormatter={(label) => String(label)}
                          />
                          <Legend />
                          {lineDataObj.receitasCategories.map((cat, i) => (
                            <Line
                              key={cat.id}
                              type="monotone"
                              dataKey={cat.id}
                              name={cat.nome}
                              stroke={CHART_COLORS[i % CHART_COLORS.length]}
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="overflow-x-auto">
                        <table className="text-xs border-collapse w-full">
                          <thead>
                            <tr>
                              <th className="sticky left-0 bg-muted text-left px-3 py-2 font-semibold border border-border whitespace-nowrap">Categoria</th>
                              {lineDataObj.intervals.map((interval) => (
                                <th key={interval.key} className="px-2 py-2 text-center font-medium border border-border whitespace-nowrap text-muted-foreground">
                                  {interval.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lineDataObj.receitasCategories.map((cat, i) => (
                              <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                                <td className="sticky left-0 bg-card px-3 py-2 border border-border font-medium whitespace-nowrap">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                  {cat.nome}
                                </td>
                                {lineDataObj.intervals.map((interval) => {
                                  const val = (lineDataObj.receitasData.find(r => (r as any).periodo === interval.label) as any)?.[cat.id]
                                  return (
                                    <td key={interval.key} className="px-2 py-2 text-center border border-border whitespace-nowrap">
                                      {val ? <span className="text-green-600">{formatCurrency(val as number)}</span> : <span className="text-muted-foreground">—</span>}
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

                {/* Bloco de Despesas */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-red-600">Despesas por Categoria</h3>
                  {lineDataObj.despesasCategories.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhuma despesa encontrada.</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={lineDataObj.despesasData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="periodo" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                          <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={80} />
                          <ReTooltip2
                            formatter={(value, name) => [formatCurrency(Number(value ?? 0)), typeof name === 'string' ? name : String(name)]}
                            labelFormatter={(label) => String(label)}
                          />
                          <Legend />
                          {lineDataObj.despesasCategories.map((cat, i) => (
                            <Line
                              key={cat.id}
                              type="monotone"
                              dataKey={cat.id}
                              name={cat.nome}
                              stroke={CHART_COLORS[i % CHART_COLORS.length]}
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="overflow-x-auto">
                        <table className="text-xs border-collapse w-full">
                          <thead>
                            <tr>
                              <th className="sticky left-0 bg-muted text-left px-3 py-2 font-semibold border border-border whitespace-nowrap">Categoria</th>
                              {lineDataObj.intervals.map((interval) => (
                                <th key={interval.key} className="px-2 py-2 text-center font-medium border border-border whitespace-nowrap text-muted-foreground">
                                  {interval.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lineDataObj.despesasCategories.map((cat, i) => (
                              <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                                <td className="sticky left-0 bg-card px-3 py-2 border border-border font-medium whitespace-nowrap">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                  {cat.nome}
                                </td>
                                {lineDataObj.intervals.map((interval) => {
                                  const val = (lineDataObj.despesasData.find(r => (r as any).periodo === interval.label) as any)?.[cat.id]
                                  return (
                                    <td key={interval.key} className="px-2 py-2 text-center border border-border whitespace-nowrap">
                                      {val ? <span className="text-red-600">{formatCurrency(val as number)}</span> : <span className="text-muted-foreground">—</span>}
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
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
