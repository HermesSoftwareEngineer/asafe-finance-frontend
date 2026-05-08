export interface User {
  id: number
  nome: string
  email: string
  is_admin: boolean
}

export interface Conta {
  id: number
  nome: string
  tipo: string
  saldo_inicial: number
  ativo: boolean
}

export interface Categoria {
  id: number
  nome: string
  tipo: string
  cor: string
  icone: string | null
  categoria_pai_id: number | null
  ativo: boolean
  subcategorias?: Categoria[]
}

export interface CentroCusto {
  id: number
  nome: string
  ativo: boolean
}

export interface Lancamento {
  id: number
  descricao: string
  tipo: 'entrada' | 'saida'
  valor_total: number
  data: string
  status: 'pago' | 'a pagar'
  tipo_recorrencia: 'unico' | 'fixo' | 'parcelado'
  frequencia_recorrencia: 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | null
  total_parcelas: number | null
  numero_parcela: number | null
  lancamento_pai_id: number | null
  status_conciliacao: 'pendente' | 'conciliado' | 'ignorado' | null
  ofx_transaction_id: string | null
  conta_id: number
  conta_nome: string | null
  categoria_id: number | null
  categoria_nome: string | null
  categoria_icone: string | null
  centro_custo_id: number | null
  centro_custo_nome: string | null
  observacao: string | null
}

export interface DashboardData {
  saldo_total: number
  entradas_mes: number
  saidas_mes: number
  lancamentos_vencidos: number
  ofx_pendentes: number
  lancamentos_nao_conciliados: number
  saldos_conta: { id: number; nome: string; tipo: string; saldo: number }[]
  chart_labels: string[]
  chart_entradas: number[]
  chart_saidas: number[]
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

export interface OfxTransacao {
  id: number
  ofx_transaction_id: string
  conta_id: number
  conta_nome: string
  descricao: string
  tipo: 'entrada' | 'saida'
  valor: number
  data: string
  status: 'pendente' | 'conciliado' | 'ignorado'
  lancamento_id: number | null
  lancamento_descricao: string | null
  sugestoes?: OfxSugestao[]
}

export interface OfxSugestao {
  lancamento_id: number
  descricao: string
  valor_total: number
  data: string
  score: number
  conta_nome: string | null
}

export interface OfxHistorico {
  id: number
  arquivo_nome: string
  conta_id: number
  conta_nome: string
  importadas: number
  pendentes: number
  conciliados: number
  ignorados: number
  importado_em: string
}
