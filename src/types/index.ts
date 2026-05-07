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
  valor_pago: number
  data_competencia: string
  status: 'previsto' | 'parcial' | 'realizado'
  categoria_id: number | null
  categoria_nome: string | null
  centro_custo_id: number | null
  centro_custo_nome: string | null
  observacao: string | null
}

export interface Transacao {
  id: number
  descricao: string
  tipo: 'entrada' | 'saida'
  valor: number
  data_pagamento: string
  conta_id: number
  conta_nome: string
  forma_pagamento: string
  status_conciliacao: 'pendente' | 'conciliado' | 'ignorado'
}

export interface DashboardData {
  saldo_total: number
  entradas_mes: number
  saidas_mes: number
  pendentes_conciliacao: number
  lancamentos_vencidos: number
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

export interface VinculoTransacao {
  id: number
  lancamento_id: number
  lancamento_descricao: string | null
  lancamento_data: string | null
  lancamento_categoria: string | null
  valor_vinculado: number
}

export interface VinculoLancamento {
  id: number
  transacao_id: number
  transacao_descricao: string | null
  transacao_data: string | null
  transacao_conta: string | null
  valor_vinculado: number
}

export interface TransacaoParaVincular {
  id: number
  descricao: string
  tipo: 'entrada' | 'saida'
  valor: number
  data_pagamento: string
  conta_nome: string | null
  forma_pagamento: string
}

export interface LancamentoParaVincular {
  id: number
  descricao: string
  tipo: 'entrada' | 'saida'
  valor_total: number
  valor_pago: number
  data_competencia: string
  status: string
  categoria_nome: string | null
}

export interface OfxImport {
  id: number
  arquivo_nome: string
  conta_id: number
  conta_nome: string
  importadas: number
  duplicatas: number
  importado_em: string
}
