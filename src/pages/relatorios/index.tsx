import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Download, FileText, BarChart2,
} from 'lucide-react'
import { contasApi } from '../../lib/api'
import { PeriodoPicker, computeDates, PERIODO_DEFAULT } from '../../lib/periodo'
import type { Periodo } from '../../lib/periodo'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import type { Conta } from '../../types'

import { FluxoCaixa } from './components/fluxo-caixa'
import { PorCategoria } from './components/por-categoria'
import { PorCentroCusto } from './components/por-centro-custo'
import { PrevistoRealizado } from './components/previsto-realizado'
import { ExtratoConta } from './components/extrato-conta'

type Tab = 'fluxo' | 'categoria' | 'centro' | 'previsto' | 'extrato'

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

const tabs: { id: Tab; label: string }[] = [
  { id: 'fluxo', label: 'Fluxo de Caixa' },
  { id: 'categoria', label: 'Por Categoria' },
  { id: 'centro', label: 'Por Centro de Custo' },
  { id: 'previsto', label: 'Previsto vs Realizado' },
  { id: 'extrato', label: 'Extrato de Conta' },
]

export default function Relatorios() {
  const [tab, setTab] = useState<Tab>('fluxo')
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_DEFAULT)
  const [contaId, setContaId] = useState('')
  const [shouldFetch, setShouldFetch] = useState(false)

  const { inicio: dataInicio, fim: dataFim } = computeDates(periodo)

  const { data: contas } = useQuery<Conta[]>({
    queryKey: ['contas'],
    queryFn: async () => (await contasApi.list()).data,
  })

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

      {/* Reports Components */}
      {tab === 'fluxo' && <FluxoCaixa dataInicio={dataInicio} dataFim={dataFim} contaId={contaId} enabled={shouldFetch} />}
      {tab === 'categoria' && <PorCategoria dataInicio={dataInicio} dataFim={dataFim} contaId={contaId} enabled={shouldFetch} />}
      {tab === 'centro' && <PorCentroCusto dataInicio={dataInicio} dataFim={dataFim} contaId={contaId} enabled={shouldFetch} />}
      {tab === 'previsto' && <PrevistoRealizado dataInicio={dataInicio} dataFim={dataFim} contaId={contaId} enabled={shouldFetch} />}
      {tab === 'extrato' && <ExtratoConta dataInicio={dataInicio} dataFim={dataFim} contaId={contaId} enabled={shouldFetch} />}
    </div>
  )
}
