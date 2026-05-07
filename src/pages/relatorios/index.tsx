import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Loader2, FileText, BarChart2 } from 'lucide-react'
import { relatoriosApi, contasApi } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import type { Conta } from '../../types'

type Tab = 'fluxo' | 'categoria' | 'centro' | 'previsto'

const hoje = new Date()
const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]

interface FluxoRow {
  periodo: string
  entradas: number
  saidas: number
  saldo: number
  saldo_acumulado: number
}

interface CategoriaRow {
  categoria: { id: number; nome: string }
  subcategorias: { categoria: { id: number; nome: string }; total: number }[]
  total: number
}

interface CentroRow {
  centro: { id: number; nome: string }
  entradas: number
  saidas: number
  saldo: number
}

interface PrevistoRow {
  categoria: { id: number; nome: string }
  previsto: number
  realizado: number
  diferenca: number
  percentual: number
}

export default function Relatorios() {
  const [tab, setTab] = useState<Tab>('fluxo')
  const [dataInicio, setDataInicio] = useState(primeiroDia)
  const [dataFim, setDataFim] = useState(ultimoDia)
  const [contaId, setContaId] = useState('')
  const [shouldFetch, setShouldFetch] = useState(false)

  const { data: contas } = useQuery<Conta[]>({
    queryKey: ['contas'],
    queryFn: async () => (await contasApi.list()).data,
  })

  const params = { data_inicio: dataInicio, data_fim: dataFim, conta_id: contaId ? Number(contaId) : undefined }

  const { data: fluxoData, isLoading: fluxoLoading } = useQuery<FluxoRow[]>({
    queryKey: ['relatorios', 'fluxo', params],
    queryFn: async () => (await relatoriosApi.fluxoCaixa(params)).data,
    enabled: tab === 'fluxo' && shouldFetch,
  })

  const { data: catData, isLoading: catLoading } = useQuery<CategoriaRow[]>({
    queryKey: ['relatorios', 'categoria', params],
    queryFn: async () => (await relatoriosApi.porCategoria(params)).data,
    enabled: tab === 'categoria' && shouldFetch,
  })

  const { data: centroData, isLoading: centroLoading } = useQuery<CentroRow[]>({
    queryKey: ['relatorios', 'centro', params],
    queryFn: async () => (await relatoriosApi.porCentroCusto(params)).data,
    enabled: tab === 'centro' && shouldFetch,
  })

  const { data: previstoData, isLoading: previstoLoading } = useQuery<PrevistoRow[]>({
    queryKey: ['relatorios', 'previsto', params],
    queryFn: async () => (await relatoriosApi.previstoRealizado(params)).data,
    enabled: tab === 'previsto' && shouldFetch,
  })

  const isLoading = fluxoLoading || catLoading || centroLoading || previstoLoading

  const buildExportUrl = (formato: 'pdf' | 'excel') => {
    const base = tab === 'fluxo'
      ? '/relatorios/fluxo-caixa'
      : tab === 'categoria'
        ? '/relatorios/por-categoria'
        : tab === 'centro'
          ? '/relatorios/por-centro-custo'
          : '/relatorios/previsto-realizado'
    const qs = new URLSearchParams({ formato, data_inicio: dataInicio, data_fim: dataFim })
    if (tab === 'fluxo' && contaId) qs.set('conta_id', contaId)
    return `${base}?${qs.toString()}`
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'fluxo', label: 'Fluxo de Caixa' },
    { id: 'categoria', label: 'Por Categoria' },
    { id: 'centro', label: 'Por Centro de Custo' },
    { id: 'previsto', label: 'Previsto vs Realizado' },
  ]

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setShouldFetch(false) }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
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
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            {tab === 'fluxo' && (
              <div className="space-y-1">
                <Label className="text-xs">Conta</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={contaId}
                  onChange={(e) => setContaId(e.target.value)}
                >
                  <option value="">Todas</option>
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
                    <FileText size={14} />
                    PDF
                  </Button>
                </a>
                <a href={buildExportUrl('excel')} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Download size={14} />
                    Excel
                  </Button>
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Fluxo de Caixa */}
      {tab === 'fluxo' && shouldFetch && !fluxoLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fluxo de Caixa</CardTitle>
          </CardHeader>
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

      {/* Por Categoria */}
      {tab === 'categoria' && shouldFetch && !catLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!catData?.length ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum dado encontrado.</div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      )}

      {/* Por Centro de Custo */}
      {tab === 'centro' && shouldFetch && !centroLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Centro de Custo</CardTitle>
          </CardHeader>
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

      {/* Previsto vs Realizado */}
      {tab === 'previsto' && shouldFetch && !previstoLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previsto vs Realizado</CardTitle>
          </CardHeader>
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
