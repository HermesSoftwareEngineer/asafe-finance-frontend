import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, Link2, Unlink } from 'lucide-react'
import { lancamentosApi, categoriasApi, centrosCustoApi } from '../../lib/api'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { Lancamento, Categoria, CentroCusto, TransacaoParaVincular, VinculoLancamento } from '../../types'

const schema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  tipo: z.enum(['entrada', 'saida'], { required_error: 'Tipo obrigatório' }),
  valor_total: z.coerce.number().positive('Valor deve ser positivo'),
  data_competencia: z.string().min(1, 'Data obrigatória'),
  categoria_id: z.coerce.number().nullable().optional(),
  centro_custo_id: z.coerce.number().nullable().optional(),
  observacao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Filters {
  tipo: string
  status: string
  data_inicio: string
  data_fim: string
  categoria_id: string
}

export default function Lancamentos() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({
    tipo: '',
    status: '',
    data_inicio: '',
    data_fim: '',
    categoria_id: '',
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Lancamento | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [vinculosLancamento, setVinculosLancamento] = useState<Lancamento | null>(null)
  const [adicionandoVinculo, setAdicionandoVinculo] = useState(false)
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<TransacaoParaVincular | null>(null)
  const [valorVinculado, setValorVinculado] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['lancamentos', page, filters],
    queryFn: async () => {
      const params: Record<string, string | number | undefined> = { page }
      if (filters.tipo) params.tipo = filters.tipo
      if (filters.status) params.status = filters.status
      if (filters.data_inicio) params.data_inicio = filters.data_inicio
      if (filters.data_fim) params.data_fim = filters.data_fim
      if (filters.categoria_id) params.categoria_id = Number(filters.categoria_id)
      const res = await lancamentosApi.list(params)
      return res.data
    },
  })

  const { data: categoriasRaw } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await categoriasApi.list()).data,
  })

  // Flatten parent + subcategories for selects
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

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lancamentos'] })

  const { data: vinculos, isLoading: loadingVinculos } = useQuery<VinculoLancamento[]>({
    queryKey: ['lancamento-vinculos', vinculosLancamento?.id],
    queryFn: () => lancamentosApi.vinculos(vinculosLancamento!.id).then(r => r.data),
    enabled: !!vinculosLancamento,
  })

  const { data: transacoesDisponiveis, isLoading: loadingTransacoes } = useQuery<TransacaoParaVincular[]>({
    queryKey: ['lancamento-transacoes-para-vincular', vinculosLancamento?.id],
    queryFn: () => lancamentosApi.transacoesParaVincular(vinculosLancamento!.id).then(r => r.data),
    enabled: !!vinculosLancamento && adicionandoVinculo,
  })

  const desvinculaMutation = useMutation({
    mutationFn: (vinculoId: number) => lancamentosApi.desvincular(vinculosLancamento!.id, vinculoId),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Vínculo removido.' })
      queryClient.invalidateQueries({ queryKey: ['lancamento-vinculos', vinculosLancamento?.id] })
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao remover vínculo.' }),
  })

  const vincularMutation = useMutation({
    mutationFn: () =>
      lancamentosApi.vincularTransacao(
        vinculosLancamento!.id,
        transacaoSelecionada!.id,
        parseFloat(valorVinculado),
      ),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Transação vinculada!' })
      setAdicionandoVinculo(false)
      setTransacaoSelecionada(null)
      setValorVinculado('')
      queryClient.invalidateQueries({ queryKey: ['lancamento-vinculos', vinculosLancamento?.id] })
      queryClient.invalidateQueries({ queryKey: ['lancamento-transacoes-para-vincular', vinculosLancamento?.id] })
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao vincular transação.' }),
  })

  const fecharVinculos = () => {
    setVinculosLancamento(null)
    setAdicionandoVinculo(false)
    setTransacaoSelecionada(null)
    setValorVinculado('')
  }

  const createMutation = useMutation({
    mutationFn: (d: FormData) =>
      lancamentosApi.create({
        ...d,
        categoria_id: d.categoria_id ?? null,
        centro_custo_id: d.centro_custo_id ?? null,
        observacao: d.observacao ?? null,
      }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Lançamento criado com sucesso!' })
      setDialogOpen(false)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar lançamento.' }),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) =>
      lancamentosApi.update(editing!.id, {
        ...d,
        categoria_id: d.categoria_id ?? null,
        centro_custo_id: d.centro_custo_id ?? null,
        observacao: d.observacao ?? null,
      }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Lançamento atualizado!' })
      setDialogOpen(false)
      setEditing(null)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar lançamento.' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => lancamentosApi.delete(id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Lançamento excluído!' })
      setDeleteId(null)
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao excluir lançamento.' }),
  })

  const openNew = () => {
    setEditing(null)
    reset({
      descricao: '',
      tipo: undefined,
      valor_total: undefined,
      data_competencia: '',
      categoria_id: null,
      centro_custo_id: null,
      observacao: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (l: Lancamento) => {
    setEditing(l)
    reset({
      descricao: l.descricao,
      tipo: l.tipo,
      valor_total: l.valor_total,
      data_competencia: l.data_competencia,
      categoria_id: l.categoria_id,
      centro_custo_id: l.centro_custo_id,
      observacao: l.observacao ?? '',
    })
    setDialogOpen(true)
  }

  const onSubmit = (d: FormData) => {
    if (editing) updateMutation.mutate(d)
    else createMutation.mutate(d)
  }

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1
  const isPending = createMutation.isPending || updateMutation.isPending

  const statusBadge = (status: string) => {
    const map: Record<string, 'previsto' | 'parcial' | 'realizado'> = {
      previsto: 'previsto',
      parcial: 'parcial',
      realizado: 'realizado',
    }
    const labels: Record<string, string> = {
      previsto: 'Previsto',
      parcial: 'Parcial',
      realizado: 'Realizado',
    }
    return <Badge variant={map[status]}>{labels[status] ?? status}</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <Label className="text-xs mb-1 block">Tipo</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.tipo}
              onChange={(e) => { setFilters(f => ({ ...f, tipo: e.target.value })); setPage(1) }}
            >
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Status</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.status}
              onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1) }}
            >
              <option value="">Todos</option>
              <option value="previsto">Previsto</option>
              <option value="parcial">Parcial</option>
              <option value="realizado">Realizado</option>
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Data início</Label>
            <Input
              type="date"
              value={filters.data_inicio}
              onChange={(e) => { setFilters(f => ({ ...f, data_inicio: e.target.value })); setPage(1) }}
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Data fim</Label>
            <Input
              type="date"
              value={filters.data_fim}
              onChange={(e) => { setFilters(f => ({ ...f, data_fim: e.target.value })); setPage(1) }}
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Categoria</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.categoria_id}
              onChange={(e) => { setFilters(f => ({ ...f, categoria_id: e.target.value })); setPage(1) }}
            >
              <option value="">Todas</option>
              {categorias?.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus size={16} />
            Novo
          </Button>
        </div>
      </div>

      {/* Table */}
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
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{formatDate(l.data_competencia)}</TableCell>
                  <TableCell className="font-medium max-w-[180px] truncate">{l.descricao}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.categoria_nome ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={l.tipo === 'entrada' ? 'entrada' : 'saida'}>
                      {l.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(l.valor_total)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(l.valor_pago)}</TableCell>
                  <TableCell>{statusBadge(l.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Gerenciar vínculos"
                        onClick={() => setVinculosLancamento(l)}
                      >
                        <Link2 size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive"
                        onClick={() => setDeleteId(l.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {data && data.total > data.per_page && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {data.total} registro(s) — página {data.page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Form Dialog */}
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
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  {...register('tipo')}
                >
                  <option value="">Selecione</option>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
                {errors.tipo && <p className="text-xs text-destructive">{errors.tipo.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Valor Total *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register('valor_total')}
                />
                {errors.valor_total && <p className="text-xs text-destructive">{errors.valor_total.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data de Competência *</Label>
              <Input type="date" {...register('data_competencia')} />
              {errors.data_competencia && <p className="text-xs text-destructive">{errors.data_competencia.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('categoria_id')}
                onChange={(e) => setValue('categoria_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Nenhuma</option>
                {categorias?.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('centro_custo_id')}
                onChange={(e) => setValue('centro_custo_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Nenhum</option>
                {centros?.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea {...register('observacao')} placeholder="Observações..." rows={2} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setDialogOpen(false); setEditing(null) }}
              >
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

      {/* Dialog de Vínculos */}
      <Dialog open={!!vinculosLancamento} onOpenChange={(o) => { if (!o) fecharVinculos() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vínculos — {vinculosLancamento?.descricao}</DialogTitle>
            {vinculosLancamento && (
              <div className="flex items-center gap-3 pt-1 text-sm text-muted-foreground">
                <span>Total: <strong className="text-foreground">{formatCurrency(vinculosLancamento.valor_total)}</strong></span>
                <span>Pago: <strong className="text-foreground">{formatCurrency(vinculosLancamento.valor_pago)}</strong></span>
                <span>Status: {statusBadge(vinculosLancamento.status)}</span>
              </div>
            )}
          </DialogHeader>

          {!adicionandoVinculo ? (
            <div className="space-y-4">
              {loadingVinculos ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : !vinculos?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma transação vinculada. Clique em "Adicionar Vínculo" para registrar um pagamento.
                </p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transação</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor Vinculado</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vinculos.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.transacao_descricao ?? '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{v.transacao_conta ?? '—'}</TableCell>
                          <TableCell className="text-sm">{v.transacao_data ? formatDate(v.transacao_data) : '—'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(v.valor_vinculado)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:text-destructive"
                              title="Remover vínculo"
                              disabled={desvinculaMutation.isPending}
                              onClick={() => desvinculaMutation.mutate(v.id)}
                            >
                              <Unlink size={14} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={fecharVinculos}>Fechar</Button>
                <Button onClick={() => { setAdicionandoVinculo(true); setTransacaoSelecionada(null) }}>
                  <Link2 size={14} />
                  Adicionar Vínculo
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione uma transação pendente do mesmo tipo para vincular a este lançamento.
              </p>
              {loadingTransacoes ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : !transacoesDisponiveis?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma transação pendente compatível encontrada.
                </p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transacoesDisponiveis.map((t) => (
                        <TableRow
                          key={t.id}
                          className={`cursor-pointer ${transacaoSelecionada?.id === t.id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                          onClick={() => { setTransacaoSelecionada(t); setValorVinculado(String(t.valor)) }}
                        >
                          <TableCell>
                            <input type="radio" readOnly checked={transacaoSelecionada?.id === t.id} className="accent-primary" />
                          </TableCell>
                          <TableCell className="font-medium">{t.descricao}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.conta_nome ?? '—'}</TableCell>
                          <TableCell className="text-sm">{formatDate(t.data_pagamento)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {transacaoSelecionada && (
                <div className="space-y-2">
                  <Label>Valor a vincular *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valorVinculado}
                    onChange={(e) => setValorVinculado(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Valor da transação: {formatCurrency(transacaoSelecionada.valor)} — pode ser menor se o pagamento for parcial.
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setAdicionandoVinculo(false); setTransacaoSelecionada(null) }}>
                  Voltar
                </Button>
                <Button
                  disabled={!transacaoSelecionada || !valorVinculado || parseFloat(valorVinculado) <= 0 || vincularMutation.isPending}
                  onClick={() => vincularMutation.mutate()}
                >
                  {vincularMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar Vínculo
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteId !== null}
        description="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
