import { useQuery } from '@tanstack/react-query'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  FileSearch,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { dashboardApi } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import type { DashboardData } from '../types'

import { useState, useMemo } from 'react'
import { PeriodoPicker, computeDates, PERIODO_DEFAULT } from '../lib/periodo'
import type { Periodo } from '../lib/periodo'

import { FluxoCaixa } from './relatorios/components/fluxo-caixa'
import { PorCategoria } from './relatorios/components/por-categoria'
import { PorCentroCusto } from './relatorios/components/por-centro-custo'
import { PrevistoRealizado } from './relatorios/components/previsto-realizado'
import { ExtratoConta } from './relatorios/components/extrato-conta'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface SummaryCardProps {
  title: string
  value: string
  icon: React.ReactNode
  color: string
  bg: string
}

function SummaryCard({ title, value, icon, color, bg }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_DEFAULT)
  const { inicio: dataInicio, fim: dataFim } = computeDates(periodo)

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await dashboardApi.get()
      return res.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center text-red-700">
        Erro ao carregar o dashboard. Tente novamente.
      </div>
    )
  }

  const fullChartData = useMemo(() => {
    if (!data) return { labels: [], entradas: [], saidas: [] }

    let month = new Date().getMonth()
    let year = new Date().getFullYear()
    let isIso = false

    if (data.chart_labels.length > 0) {
      const firstLabel = data.chart_labels[0]
      if (firstLabel.includes('-')) {
        isIso = true
        const [y, m] = firstLabel.split('-')
        year = Number(y)
        month = Number(m) - 1
      } else if (firstLabel.includes('/')) {
        const [, m] = firstLabel.split('/')
        month = Number(m) - 1
      }
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const mapEntradas = new Map<string, number>()
    const mapSaidas = new Map<string, number>()

    data.chart_labels.forEach((label, i) => {
      mapEntradas.set(label, data.chart_entradas[i])
      mapSaidas.set(label, data.chart_saidas[i])
    })

    const labels = []
    const entradas = []
    const saidas = []

    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = String(i).padStart(2, '0')
      const monthStr = String(month + 1).padStart(2, '0')
      
      const label = isIso ? `${year}-${monthStr}-${dayStr}` : `${dayStr}/${monthStr}`
      labels.push(label)
      entradas.push(mapEntradas.get(label) || 0)
      saidas.push(mapSaidas.get(label) || 0)
    }

    return { labels, entradas, saidas }
  }, [data])

  const chartData = {
    labels: fullChartData.labels,
    datasets: [
      {
        label: 'Entradas',
        data: fullChartData.entradas,
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: 'Saídas',
        data: fullChartData.saidas,
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (v: number | string) => formatCurrency(Number(v)),
        },
      },
    },
  }

  const hasAlerts =
    data.lancamentos_vencidos > 0 ||
    data.ofx_pendentes > 0 ||
    data.lancamentos_nao_conciliados > 0

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          title="Saldo Total"
          value={formatCurrency(data.saldo_total)}
          icon={<Wallet className="w-6 h-6 text-primary" />}
          color="text-primary"
          bg="bg-green-50"
        />
        <SummaryCard
          title="Entradas do Mês"
          value={formatCurrency(data.entradas_mes)}
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
          color="text-green-600"
          bg="bg-green-50"
        />
        <SummaryCard
          title="Saídas do Mês"
          value={formatCurrency(data.saidas_mes)}
          icon={<TrendingDown className="w-6 h-6 text-red-600" />}
          color="text-red-600"
          bg="bg-red-50"
        />
      </div>

      {/* Alert strip */}
      {hasAlerts && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.lancamentos_vencidos > 0 && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
              <Clock className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <p className="text-sm text-orange-800">
                <strong>{data.lancamentos_vencidos}</strong> lançamento(s) vencido(s)
              </p>
            </div>
          )}
          {data.ofx_pendentes > 0 && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <FileSearch className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                <strong>{data.ofx_pendentes}</strong> transação(ões) OFX pendente(s)
              </p>
            </div>
          )}
          {data.lancamentos_nao_conciliados > 0 && (
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                <strong>{data.lancamentos_nao_conciliados}</strong> lançamento(s) sem conciliação
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Fluxo do Mês (Pagos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {fullChartData.labels.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nenhum lançamento pago no mês atual.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account balances */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo por Conta</CardTitle>
          </CardHeader>
          <CardContent>
            {data.saldos_conta.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {data.saldos_conta.map((conta) => (
                  <div
                    key={conta.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{conta.nome}</p>
                      <p className="text-xs text-muted-foreground capitalize">{conta.tipo}</p>
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        conta.saldo >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(conta.saldo)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Relatórios Detalhados */}
      <div className="space-y-6 pt-6 border-t border-border">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Relatórios Detalhados</h2>
          <PeriodoPicker value={periodo} onChange={setPeriodo} />
        </div>
        
        <FluxoCaixa dataInicio={dataInicio} dataFim={dataFim} enabled={true} />
        <PorCategoria dataInicio={dataInicio} dataFim={dataFim} enabled={true} />
        <PorCentroCusto dataInicio={dataInicio} dataFim={dataFim} enabled={true} />
        <PrevistoRealizado dataInicio={dataInicio} dataFim={dataFim} enabled={true} />
        {/* Extrato requires a contaId, so we might skip it or add a selector later. Leaving it out of the main dashboard is common unless there's a global account selected. */}
      </div>
    </div>
  )
}
