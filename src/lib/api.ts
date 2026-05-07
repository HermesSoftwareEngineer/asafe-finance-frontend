import axios from 'axios'
import type {
  Conta,
  Categoria,
  CentroCusto,
  Lancamento,
  LancamentoParaVincular,
  TransacaoParaVincular,
  VinculoLancamento,
  Transacao,
  DashboardData,
  Paginated,
  User,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<User>('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
  alterarSenha: (data: {
    senha_atual: string
    nova_senha: string
    confirmar_senha: string
  }) => api.post('/auth/alterar-senha', data),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get<DashboardData>('/dashboard'),
}

// ─── Lançamentos ──────────────────────────────────────────────────────────────
export const lancamentosApi = {
  list: (params: {
    page?: number
    tipo?: string
    status?: string
    categoria_id?: number
    centro_custo_id?: number
    data_inicio?: string
    data_fim?: string
  }) => api.get<Paginated<Lancamento>>('/lancamentos', { params }),
  create: (data: {
    descricao: string
    tipo: string
    valor_total: number
    data_competencia: string
    categoria_id?: number | null
    centro_custo_id?: number | null
    observacao?: string | null
  }) => api.post<Lancamento>('/lancamentos', data),
  update: (
    id: number,
    data: {
      descricao: string
      tipo: string
      valor_total: number
      data_competencia: string
      categoria_id?: number | null
      centro_custo_id?: number | null
      observacao?: string | null
    }
  ) => api.put<Lancamento>(`/lancamentos/${id}`, data),
  delete: (id: number) => api.delete(`/lancamentos/${id}`),
  vinculos: (id: number) => api.get<VinculoLancamento[]>(`/lancamentos/${id}/vinculos`),
  desvincular: (lancamentoId: number, vinculoId: number) =>
    api.delete(`/lancamentos/${lancamentoId}/vinculos/${vinculoId}`),
  transacoesParaVincular: (id: number) =>
    api.get<TransacaoParaVincular[]>(`/lancamentos/${id}/transacoes-para-vincular`),
  vincularTransacao: (id: number, transacao_id: number, valor_vinculado: number) =>
    api.post(`/transacoes/${transacao_id}/vincular`, { lancamento_id: id, valor_vinculado }),
}

// ─── Transações ───────────────────────────────────────────────────────────────
export const transacoesApi = {
  list: (params: {
    page?: number
    conta_id?: number
    status_conciliacao?: string
    forma_pagamento?: string
    data_inicio?: string
    data_fim?: string
  }) => api.get<Paginated<Transacao>>('/transacoes', { params }),
  create: (data: {
    descricao: string
    tipo: string
    valor: number
    data_pagamento: string
    conta_id: number
    forma_pagamento: string
  }) => api.post<Transacao>('/transacoes', data),
  update: (
    id: number,
    data: {
      descricao: string
      tipo: string
      valor: number
      data_pagamento: string
      conta_id: number
      forma_pagamento: string
    }
  ) => api.put<Transacao>(`/transacoes/${id}`, data),
  delete: (id: number) => api.delete(`/transacoes/${id}`),
  lancamentosParaVincular: (id: number) =>
    api.get<LancamentoParaVincular[]>(`/transacoes/${id}/lancamentos-para-vincular`),
  vincular: (id: number, lancamento_id: number, valor_vinculado: number) =>
    api.post(`/transacoes/${id}/vincular`, { lancamento_id, valor_vinculado }),
}

// ─── Conciliação ──────────────────────────────────────────────────────────────
export const conciliacaoApi = {
  getPendentes: () => api.get('/conciliacao/pendentes'),
  getHistorico: () => api.get('/conciliacao/historico'),
  uploadOfx: (formData: FormData) =>
    api.post('/conciliacao/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  vincular: (transacaoId: number, lancamentoId: number, valorVinculado: number) =>
    api.post(`/conciliacao/vincular/${transacaoId}`, {
      lancamento_id: lancamentoId,
      valor_vinculado: valorVinculado,
    }),
  ignorar: (transacaoId: number) =>
    api.post(`/conciliacao/ignorar/${transacaoId}`),
  criarLancamento: (transacaoId: number, data: { descricao: string; categoria_id?: number | null }) =>
    api.post(`/conciliacao/criar-lancamento/${transacaoId}`, data),
}

// ─── Relatórios ───────────────────────────────────────────────────────────────
export const relatoriosApi = {
  fluxoCaixa: (params: { data_inicio?: string; data_fim?: string; conta_id?: number }) =>
    api.get('/relatorios/fluxo-caixa', { params }),
  porCategoria: (params: { data_inicio?: string; data_fim?: string }) =>
    api.get('/relatorios/por-categoria', { params }),
  porCentroCusto: (params: { data_inicio?: string; data_fim?: string }) =>
    api.get('/relatorios/por-centro-custo', { params }),
  previstoRealizado: (params: { data_inicio?: string; data_fim?: string }) =>
    api.get('/relatorios/previsto-realizado', { params }),
}

// ─── Contas ───────────────────────────────────────────────────────────────────
export const contasApi = {
  list: () => api.get<Conta[]>('/cadastros/contas'),
  create: (data: { nome: string; tipo: string; saldo_inicial: number; ativo: boolean }) =>
    api.post<Conta>('/cadastros/contas', data),
  update: (id: number, data: { nome: string; tipo: string; saldo_inicial: number; ativo: boolean }) =>
    api.put<Conta>(`/cadastros/contas/${id}`, data),
  delete: (id: number) => api.delete(`/cadastros/contas/${id}`),
}

// ─── Categorias ───────────────────────────────────────────────────────────────
export const categoriasApi = {
  list: () => api.get<Categoria[]>('/cadastros/categorias'),
  create: (data: {
    nome: string
    tipo: string
    categoria_pai_id?: number | null
    cor?: string
    ativo?: boolean
  }) => api.post<Categoria>('/cadastros/categorias', data),
  update: (
    id: number,
    data: {
      nome: string
      tipo: string
      categoria_pai_id?: number | null
      cor?: string
      ativo?: boolean
    }
  ) => api.put<Categoria>(`/cadastros/categorias/${id}`, data),
  delete: (id: number) => api.delete(`/cadastros/categorias/${id}`),
}

// ─── Centros de Custo ─────────────────────────────────────────────────────────
export const centrosCustoApi = {
  list: () => api.get<CentroCusto[]>('/cadastros/centros-custo'),
  create: (data: { nome: string; ativo: boolean }) =>
    api.post<CentroCusto>('/cadastros/centros-custo', data),
  update: (id: number, data: { nome: string; ativo: boolean }) =>
    api.put<CentroCusto>(`/cadastros/centros-custo/${id}`, data),
  delete: (id: number) => api.delete(`/cadastros/centros-custo/${id}`),
}

// ─── Usuários ─────────────────────────────────────────────────────────────────
export const usuariosApi = {
  list: () => api.get<User[]>('/cadastros/usuarios'),
  create: (data: {
    nome: string
    email: string
    senha: string
    is_admin: boolean
    ativo: boolean
  }) => api.post<User>('/cadastros/usuarios', data),
  update: (
    id: number,
    data: {
      nome: string
      email: string
      is_admin: boolean
      ativo: boolean
      nova_senha?: string
    }
  ) => api.put<User>(`/cadastros/usuarios/${id}`, data),
  delete: (id: number) => api.delete(`/cadastros/usuarios/${id}`),
}
