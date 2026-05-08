import axios from 'axios'
import type {
  Conta,
  Categoria,
  CentroCusto,
  Lancamento,
  DashboardData,
  Paginated,
  User,
  OfxTransacao,
  OfxHistorico,
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
    tipo_recorrencia?: string
    status_conciliacao?: string
    categoria_id?: number
    centro_custo_id?: number
    conta_id?: number
    data_inicio?: string
    data_fim?: string
  }) => api.get<Paginated<Lancamento>>('/lancamentos', { params }),
  create: (data: {
    descricao: string
    tipo: string
    valor_total: number
    data: string
    status: string
    conta_id: number
    categoria_id?: number | null
    centro_custo_id?: number | null
    observacao?: string | null
    tipo_recorrencia?: string
    frequencia_recorrencia?: string | null
    total_parcelas?: number | null
  }) => api.post('/lancamentos', data),
  update: (
    id: number,
    data: {
      descricao: string
      tipo: string
      valor_total: number
      data: string
      status: string
      conta_id: number
      categoria_id?: number | null
      centro_custo_id?: number | null
      observacao?: string | null
      tipo_recorrencia?: string
      frequencia_recorrencia?: string | null
    }
  ) => api.put<Lancamento>(`/lancamentos/${id}`, data),
  delete: (id: number) => api.delete(`/lancamentos/${id}`),
  getSerie: (id: number) =>
    api.get<{ total: number; lancamentos: Lancamento[] }>(`/lancamentos/${id}/serie`),
  deleteSerie: (id: number) =>
    api.delete<{ ok: boolean; total_excluidos: number }>(`/lancamentos/${id}/serie`),
  gerarProximo: (id: number) =>
    api.post<Lancamento>(`/lancamentos/${id}/gerar-proximo`),
}

// ─── Conciliação Bancária ─────────────────────────────────────────────────────
export const conciliacaoApi = {
  upload: (conta_id: number, file: File) => {
    const fd = new FormData()
    fd.append('conta_id', String(conta_id))
    fd.append('file', file)
    return api.post('/conciliacao/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  pendentes: (params?: { conta_id?: number; com_sugestoes?: boolean; page?: number }) =>
    api.get<Paginated<OfxTransacao>>('/conciliacao/pendentes', { params }),
  vincular: (ofx_id: number, lancamento_id: number) =>
    api.put(`/conciliacao/vincular/${ofx_id}`, { lancamento_id }),
  criarLancamento: (
    ofx_id: number,
    data: { categoria_id?: number | null; centro_custo_id?: number | null; observacao?: string | null }
  ) => api.put(`/conciliacao/criar-lancamento/${ofx_id}`, data),
  ignorar: (ofx_id: number) => api.put(`/conciliacao/ignorar/${ofx_id}`),
  desvincular: (ofx_id: number) => api.put(`/conciliacao/desvincular/${ofx_id}`),
  historico: () => api.get<OfxHistorico[]>('/conciliacao/historico'),
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
  extratoConta: (params: { conta_id: number; data_inicio?: string; data_fim?: string }) =>
    api.get('/relatorios/extrato-conta', { params }),
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
    icone?: string | null
    categoria_pai_id?: number | null
    cor?: string
    ativo?: boolean
  }) => api.post<Categoria>('/cadastros/categorias', data),
  update: (
    id: number,
    data: {
      nome: string
      tipo: string
      icone?: string | null
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
