import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from 'lucide-react'
import { PeriodoPicker, computeDates, PERIODO_DEFAULT } from '../../lib/periodo'
import type { Periodo } from '../../lib/periodo'
import { lancamentosApi, categoriasApi, centrosCustoApi, contasApi } from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/utils'
import { toast } from '../../hooks/useToast'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { Lancamento, Categoria, CentroCusto, Conta } from '../../types'

// ─── Período (imported from shared lib/periodo.tsx) ───────────────────────────

// ─── Constantes de recorrência ────────────────────────────────────────────────

const FREQUENCIAS = [
  { label: 'Diária', value: 'diaria' },
  { label: 'Semanal', value: 'semanal' },
  { label: 'Quinzenal', value: 'quinzenal' },
  { label: 'Mensal', value: 'mensal' },
]

const FREQ_LABEL: Record<string, string> = {
  diaria: 'Diária', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal',
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    descricao: z.string().min(1, 'Descrição obrigatória'),
    tipo: z.enum(['entrada', 'saida'], { required_error: 'Tipo obrigatório' }),
    valor_total: z.coerce.number().positive('Valor deve ser positivo'),
    data: z.string().min(1, 'Data obrigatória'),
    status: z.enum(['pago', 'a pagar']).default('a pagar'),
    conta_id: z.coerce.number().min(1, 'Conta obrigatória'),
    categoria_id: z.coerce.number().nullable().optional(),
    centro_custo_id: z.coerce.number().nullable().optional(),
    observacao: z.string().optional(),
    tipo_recorrencia: z.enum(['unico', 'fixo', 'parcelado']).default('unico'),
    frequencia_recorrencia: z.enum(['diaria', 'semanal', 'quinzenal', 'mensal']).nullable().optional(),
    total_parcelas: z.coerce.number().int().min(2).nullable().optional(),
  })
  .refine(
    (d) => d.tipo_recorrencia === 'unico' || !!d.frequencia_recorrencia,
    { message: 'Frequência obrigatória para fixo e parcelado', path: ['frequencia_recorrencia'] }
  )
  .refine(
    (d) => d.tipo_recorrencia !== 'parcelado' || (d.total_parcelas != null && d.total_parcelas >= 2),
    { message: 'Informe o número de parcelas (mínimo 2)', path: ['total_parcelas'] }
  )

type FormData = z.infer<typeof schema>

type Scope = 'only' | 'all' | 'future'

interface Filters {
  tipo: string
  status: string
  tipo_recorrencia: string
  status_conciliacao: string
  categoria_id: string
  conta_id: string
}

const CONCILIACAO_LABEL: Record<string, string> = {
  pendente: 'Pendente', conciliado: 'Conciliado', ignorado: 'Ignorado',
}
const CONCILIACAO_VARIANT: Record<string, 'pendente' | 'conciliado' | 'ignorado'> = {
  pendente: 'pendente', conciliado: 'conciliado', ignorado: 'ignorado',
}

function RecorrenciaBadge({ l }: { l: Lancamento }) {
  if (l.tipo_recorrencia === 'fixo') {
    return (
      <span className="text-xs text-muted-foreground">
        · Fixo {l.frequencia_recorrencia ? `/ ${FREQ_LABEL[l.frequencia_recorrencia]}` : ''}
      </span>
    )
  }
  if (l.tipo_recorrencia === 'parcelado' && l.numero_parcela && l.total_parcelas) {
    return (
      <span className="text-xs text-muted-foreground">
        · Parcela {l.numero_parcela}/{l.total_parcelas}
      </span>
    )
  }
  return null
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Lancamentos() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_DEFAULT)
  const [filters, setFilters] = useState<Filters>({
    tipo: '', status: '', tipo_recorrencia: '', status_conciliacao: '', categoria_id: '', conta_id: '',
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Lancamento | null>(null)
  const [editScope, setEditScope] = useState<Scope>('only')

  // delete states
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteSerieDialog, setDeleteSerieDialog] = useState<Lancamento | null>(null)

  const { inicio: data_inicio, fim: data_fim } = computeDates(periodo)

  const handlePeriodoChange = (v: Periodo) => { setPeriodo(v); setPage(1) }

  const { data, isLoading } = useQuery({
    queryKey: ['lancamentos', page, filters, data_inicio, data_fim],
    queryFn: async () => {
      const params: Record<string, string | number | undefined> = { page }
      if (filters.tipo) params.tipo = filters.tipo
      if (filters.status) params.status = filters.status
      if (filters.tipo_recorrencia) params.tipo_recorrencia = filters.tipo_recorrencia
      if (filters.status_conciliacao) params.status_conciliacao = filters.status_conciliacao
      if (filters.categoria_id) params.categoria_id = Number(filters.categoria_id)
      if (filters.conta_id) params.conta_id = Number(filters.conta_id)
      if (data_inicio) params.data_inicio = data_inicio
      if (data_fim) params.data_fim = data_fim
      return (await lancamentosApi.list(params)).data
    },
  })

  const { data: categoriasRaw } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await categoriasApi.list()).data,
  })
  const categorias: Categoria[] = []
  if (categoriasRaw) {
    for (const c of categoriasRaw) {
      categorias.push(c)
      if (c.subcategorias) categorias.push(...c.subcategorias)
    }
  }

  const { data: centros } = useQuery<CentroCusto[]>({
    queryKey: ['centros-custo'],
    queryFn: async () => (await centrosCustoApi.list()).data,
  })
  const { data: contas } = useQuery<Conta[]>({
    queryKey: ['contas'],
    queryFn: async () => (await contasApi.list()).data,
  })

  const {
    register, handleSubmit, reset, setValue, control,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const tipoRecorrencia = useWatch({ control, name: 'tipo_recorrencia', defaultValue: 'unico' })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lancamentos'] })

  const createMutation = useMutation({
    mutationFn: (d: FormData) =>
      lancamentosApi.create({
        descricao: d.descricao, tipo: d.tipo, valor_total: d.valor_total,
        data: d.data, status: d.status, conta_id: d.conta_id,
        categoria_id: d.categoria_id ?? null, centro_custo_id: d.centro_custo_id ?? null,
        observacao: d.observacao || null,
        tipo_recorrencia: d.tipo_recorrencia,
        frequencia_recorrencia: d.tipo_recorrencia !== 'unico' ? (d.frequencia_recorrencia ?? null) : null,
        total_parcelas: d.tipo_recorrencia === 'parcelado' ? (d.total_parcelas ?? null) : null,
      }),
    onSuccess: (res) => {
      const d = res.data as { total_criados?: number }
      const msg = d.total_criados
        ? `${d.total_criados} parcela(s) criada(s) com sucesso!`
        : 'Lançamento criado com sucesso!'
      toast({ variant: 'success', title: msg })
      setDialogOpen(false)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar lançamento.' }),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: FormData & { scope?: Scope }) =>
      lancamentosApi.update(editing!.id, {
        descricao: payload.descricao, tipo: payload.tipo, valor_total: payload.valor_total,
        data: payload.data, status: payload.status, conta_id: payload.conta_id,
        categoria_id: payload.categoria_id ?? null, centro_custo_id: payload.centro_custo_id ?? null,
        observacao: payload.observacao || null,
        tipo_recorrencia: payload.tipo_recorrencia,
        frequencia_recorrencia: payload.tipo_recorrencia !== 'unico' ? (payload.frequencia_recorrencia ?? null) : null,
        total_parcelas: payload.tipo_recorrencia === 'parcelado' ? (payload.total_parcelas ?? null) : null,
      }, payload.scope),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Lançamento atualizado!' })
      setDialogOpen(false); setEditing(null); reset(); setEditScope('only'); invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar lançamento.' }),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, scope }: { id: number; scope?: Scope }) => lancamentosApi.delete(id, scope),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Lançamento excluído!' })
      setDeleteId(null); setDeleteSerieDialog(null); invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao excluir lançamento.' }),
  })

  const gerarProximoMutation = useMutation({
    mutationFn: (id: number) => lancamentosApi.gerarProximo(id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Próxima ocorrência gerada!' })
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao gerar próxima ocorrência.' }),
  })

  const openNew = () => {
    setEditing(null)
    reset({
      descricao: '', tipo: undefined, valor_total: undefined, data: '',
      status: 'a pagar', conta_id: undefined, categoria_id: null,
      centro_custo_id: null, observacao: '',
      tipo_recorrencia: 'unico', frequencia_recorrencia: null, total_parcelas: null,
    })
    setDialogOpen(true)
  }

  const openEdit = (l: Lancamento) => {
    setEditing(l)
    reset({
      descricao: l.descricao, tipo: l.tipo, valor_total: l.valor_total,
      data: l.data, status: l.status, conta_id: l.conta_id,
      categoria_id: l.categoria_id, centro_custo_id: l.centro_custo_id,
      observacao: l.observacao ?? '',
      tipo_recorrencia: l.tipo_recorrencia ?? 'unico',
      frequencia_recorrencia: l.frequencia_recorrencia ?? null,
      total_parcelas: l.total_parcelas ?? null,
    })
    setEditScope('only')
    setDialogOpen(true)
  }

  const handleDelete = (l: Lancamento) => {
    if (l.tipo_recorrencia !== 'unico') setDeleteSerieDialog(l)
    else setDeleteId(l.id)
  }

  const onSubmit = (d: FormData) => {
    if (editing) {
      const scope = editing.tipo_recorrencia === 'unico' ? 'only' : editScope
      updateMutation.mutate({ ...d, scope })
    } else createMutation.mutate(d)
  }

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1
  const isPending = createMutation.isPending || updateMutation.isPending
  const selectClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex justify-center">
          <PeriodoPicker value={periodo} onChange={handlePeriodoChange} />
        </div>

        <div className="border-t border-border pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
          <div>
            <Label className="text-xs mb-1 block">Tipo</Label>
            <select className={selectClass} value={filters.tipo}
              onChange={(e) => { setFilters((f) => ({ ...f, tipo: e.target.value })); setPage(1) }}>
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Status</Label>
            <select className={selectClass} value={filters.status}
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1) }}>
              <option value="">Todos</option>
              <option value="pago">Pago</option>
              <option value="a pagar">A Pagar</option>
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Recorrência</Label>
            <select className={selectClass} value={filters.tipo_recorrencia}
              onChange={(e) => { setFilters((f) => ({ ...f, tipo_recorrencia: e.target.value })); setPage(1) }}>
              <option value="">Todos</option>
              <option value="unico">Único</option>
              <option value="fixo">Fixo</option>
              <option value="parcelado">Parcelado</option>
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Conciliação</Label>
            <select className={selectClass} value={filters.status_conciliacao}
              onChange={(e) => { setFilters((f) => ({ ...f, status_conciliacao: e.target.value })); setPage(1) }}>
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="conciliado">Conciliado</option>
              <option value="ignorado">Ignorado</option>
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Conta</Label>
            <select className={selectClass} value={filters.conta_id}
              onChange={(e) => { setFilters((f) => ({ ...f, conta_id: e.target.value })); setPage(1) }}>
              <option value="">Todas</option>
              {contas?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Categoria</Label>
            <select className={selectClass} value={filters.categoria_id}
              onChange={(e) => { setFilters((f) => ({ ...f, categoria_id: e.target.value })); setPage(1) }}>
              <option value="">Todas</option>
              {categorias?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus size={16} /> Novo
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-base">Nenhum lançamento encontrado.</p>
            <p className="text-sm mt-1">Ajuste os filtros ou crie um novo lançamento.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conciliação</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{formatDate(l.data)}</TableCell>
                  <TableCell className="max-w-[180px]">
                    <div className="font-medium truncate">{l.descricao}</div>
                    <RecorrenciaBadge l={l} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.conta_nome ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.categoria_icone && <span className="mr-1">{l.categoria_icone}</span>}
                    {l.categoria_nome ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.tipo === 'entrada' ? 'entrada' : 'saida'}>
                      {l.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(l.valor_total)}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === 'pago' ? 'pago' : 'a_pagar'}>
                      {l.status === 'pago' ? 'Pago' : 'A Pagar'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {l.status_conciliacao ? (
                      <Badge variant={CONCILIACAO_VARIANT[l.status_conciliacao]}>
                        {CONCILIACAO_LABEL[l.status_conciliacao]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {l.tipo_recorrencia === 'fixo' && (
                        <Button variant="ghost" size="icon" title="Gerar próxima ocorrência"
                          disabled={gerarProximoMutation.isPending}
                          onClick={() => gerarProximoMutation.mutate(l.id)}>
                          <RotateCw size={14} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="hover:text-destructive"
                        onClick={() => handleDelete(l)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {data && data.total > data.per_page && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {data.total} registro(s) — página {data.page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de formulário */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input {...register('descricao')} placeholder="Descrição do lançamento" />
              {errors.descricao && <p className="text-xs text-destructive">{errors.descricao.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <select className={selectClass} {...register('tipo')}>
                  <option value="">Selecione</option>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
                {errors.tipo && <p className="text-xs text-destructive">{errors.tipo.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input type="number" step="0.01" min="0" placeholder="0,00" {...register('valor_total')} />
                {errors.valor_total && <p className="text-xs text-destructive">{errors.valor_total.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" {...register('data')} />
                {errors.data && <p className="text-xs text-destructive">{errors.data.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Status *</Label>
                <select className={selectClass} {...register('status')}>
                  <option value="a pagar">A Pagar</option>
                  <option value="pago">Pago</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conta *</Label>
              <select className={selectClass} {...register('conta_id')}>
                <option value="">Selecione a conta</option>
                {contas?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {errors.conta_id && <p className="text-xs text-destructive">{errors.conta_id.message}</p>}
            </div>

            {/* Recorrência */}
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Recorrência
              </p>

              <div className="space-y-2">
                <Label>Tipo de Recorrência</Label>
                <select className={selectClass} {...register('tipo_recorrencia')}>
                  <option value="unico">Único (sem recorrência)</option>
                  <option value="fixo">Fixo (repete indefinidamente)</option>
                  <option value="parcelado">Parcelado</option>
                </select>
              </div>

              {(tipoRecorrencia === 'fixo' || tipoRecorrencia === 'parcelado') && (
                <div className="space-y-2">
                  <Label>Frequência *</Label>
                  <select className={selectClass} {...register('frequencia_recorrencia')}>
                    <option value="">Selecione</option>
                    {FREQUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  {errors.frequencia_recorrencia && (
                    <p className="text-xs text-destructive">{errors.frequencia_recorrencia.message}</p>
                  )}
                </div>
              )}

              {tipoRecorrencia === 'parcelado' && !editing && (
                <div className="space-y-2">
                  <Label>Número de Parcelas *</Label>
                  <Input type="number" min="2" placeholder="Ex: 12" {...register('total_parcelas')} />
                  {errors.total_parcelas && (
                    <p className="text-xs text-destructive">{errors.total_parcelas.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Serão criadas N parcelas com valor dividido igualmente.
                  </p>
                </div>
              )}

              {tipoRecorrencia === 'parcelado' && editing && (
                <p className="text-xs text-muted-foreground">
                  Esta é a parcela {editing.numero_parcela}/{editing.total_parcelas}. O número total de parcelas não pode ser alterado.
                </p>
              )}

              {editing && editing.tipo_recorrencia !== 'unico' && (
                <div className="space-y-2">
                  <Label>Escopo de alteração</Label>
                  <select className={selectClass} value={editScope}
                    onChange={(e) => setEditScope(e.target.value as Scope)}>
                    <option value="only">Apenas este lançamento</option>
                    <option value="all">Todos os lançamentos da sequência</option>
                    <option value="future">Este e os futuros lançamentos da sequência</option>
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <select className={selectClass} {...register('categoria_id')}
                onChange={(e) => setValue('categoria_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Nenhuma</option>
                {categorias?.map((c) => (
                  <option key={c.id} value={c.id}>{c.icone ? `${c.icone} ` : ''}{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <select className={selectClass} {...register('centro_custo_id')}
                onChange={(e) => setValue('centro_custo_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Nenhum</option>
                {centros?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea {...register('observacao')} placeholder="Observações..." rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline"
                onClick={() => { setDialogOpen(false); setEditing(null) }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog excluir série */}
      <Dialog open={!!deleteSerieDialog} onOpenChange={(o) => { if (!o) setDeleteSerieDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir lançamento</DialogTitle>
          </DialogHeader>
          {deleteSerieDialog && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{deleteSerieDialog.descricao}</strong> faz parte de uma série{' '}
                {deleteSerieDialog.tipo_recorrencia === 'parcelado'
                  ? `(Parcela ${deleteSerieDialog.numero_parcela}/${deleteSerieDialog.total_parcelas})`
                  : '(Fixo)'}.
              </p>
              <p className="text-sm text-muted-foreground">O que deseja excluir?</p>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button variant="outline" className="w-full"
              onClick={() => {
                if (deleteSerieDialog) {
                  deleteMutation.mutate({ id: deleteSerieDialog.id, scope: 'only' })
                }
                setDeleteSerieDialog(null)
              }}>
              Apenas este lançamento
            </Button>
            <Button variant="secondary" className="w-full"
              onClick={() => {
                if (deleteSerieDialog) deleteMutation.mutate({ id: deleteSerieDialog.id, scope: 'future' })
              }}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Este e os futuros lançamentos
            </Button>
            <Button variant="destructive" className="w-full"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteSerieDialog) deleteMutation.mutate({ id: deleteSerieDialog.id, scope: 'all' })
              }}>
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Excluir toda a sequência
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setDeleteSerieDialog(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm excluir único */}
      <ConfirmDialog
        open={deleteId !== null}
        description="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
        onConfirm={() => deleteId !== null && deleteMutation.mutate({ id: deleteId, scope: 'only' })}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
