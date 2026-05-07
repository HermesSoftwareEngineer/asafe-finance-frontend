import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import { transacoesApi, contasApi } from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/utils'
import { toast } from '../../hooks/useToast'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
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
import type { Transacao, Conta, LancamentoParaVincular } from '../../types'

const schema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  tipo: z.enum(['entrada', 'saida'], { required_error: 'Tipo obrigatório' }),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data_pagamento: z.string().min(1, 'Data obrigatória'),
  conta_id: z.coerce.number().min(1, 'Conta obrigatória'),
  forma_pagamento: z.string().min(1, 'Forma de pagamento obrigatória'),
})

type FormData = z.infer<typeof schema>

const FORMAS_PAGAMENTO = [
  'Transferência',
  'PIX',
  'Boleto',
  'Débito',
  'Crédito',
  'Dinheiro',
  'Cheque',
  'Outro',
]

export default function Transacoes() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    conta_id: '',
    status_conciliacao: '',
    forma_pagamento: '',
    data_inicio: '',
    data_fim: '',
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transacao | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [vinculandoTransacao, setVinculandoTransacao] = useState<Transacao | null>(null)
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<LancamentoParaVincular | null>(null)
  const [valorVinculado, setValorVinculado] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['transacoes', page, filters],
    queryFn: async () => {
      const params: Record<string, string | number | undefined> = { page }
      if (filters.conta_id) params.conta_id = Number(filters.conta_id)
      if (filters.status_conciliacao) params.status_conciliacao = filters.status_conciliacao
      if (filters.forma_pagamento) params.forma_pagamento = filters.forma_pagamento
      if (filters.data_inicio) params.data_inicio = filters.data_inicio
      if (filters.data_fim) params.data_fim = filters.data_fim
      const res = await transacoesApi.list(params)
      return res.data
    },
  })

  const { data: contas } = useQuery<Conta[]>({
    queryKey: ['contas'],
    queryFn: async () => (await contasApi.list()).data,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['transacoes'] })

  const { data: lancamentosParaVincular, isLoading: loadingLancamentos } = useQuery({
    queryKey: ['lancamentos-para-vincular', vinculandoTransacao?.id],
    queryFn: () => transacoesApi.lancamentosParaVincular(vinculandoTransacao!.id).then(r => r.data),
    enabled: !!vinculandoTransacao,
  })

  const vincularMutation = useMutation({
    mutationFn: () =>
      transacoesApi.vincular(
        vinculandoTransacao!.id,
        lancamentoSelecionado!.id,
        parseFloat(valorVinculado),
      ),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Transação vinculada com sucesso!' })
      setVinculandoTransacao(null)
      setLancamentoSelecionado(null)
      setValorVinculado('')
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao vincular transação.' }),
  })

  const abrirVincular = (t: Transacao) => {
    setVinculandoTransacao(t)
    setLancamentoSelecionado(null)
    setValorVinculado(String(t.valor))
  }

  const fecharVincular = () => {
    setVinculandoTransacao(null)
    setLancamentoSelecionado(null)
    setValorVinculado('')
  }

  const createMutation = useMutation({
    mutationFn: (d: FormData) => transacoesApi.create(d),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Transação criada com sucesso!' })
      setDialogOpen(false)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar transação.' }),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => transacoesApi.update(editing!.id, d),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Transação atualizada!' })
      setDialogOpen(false)
      setEditing(null)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar transação.' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transacoesApi.delete(id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Transação excluída!' })
      setDeleteId(null)
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao excluir transação.' }),
  })

  const openNew = () => {
    setEditing(null)
    reset()
    setDialogOpen(true)
  }

  const openEdit = (t: Transacao) => {
    setEditing(t)
    reset({
      descricao: t.descricao,
      tipo: t.tipo,
      valor: t.valor,
      data_pagamento: t.data_pagamento,
      conta_id: t.conta_id,
      forma_pagamento: t.forma_pagamento,
    })
    setDialogOpen(true)
  }

  const onSubmit = (d: FormData) => {
    if (editing) updateMutation.mutate(d)
    else createMutation.mutate(d)
  }

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1
  const isPending = createMutation.isPending || updateMutation.isPending

  const conciliacaoBadge = (status: string) => {
    const map: Record<string, 'pendente' | 'conciliado' | 'ignorado'> = {
      pendente: 'pendente',
      conciliado: 'conciliado',
      ignorado: 'ignorado',
    }
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      conciliado: 'Conciliado',
      ignorado: 'Ignorado',
    }
    return <Badge variant={map[status] ?? 'outline'}>{labels[status] ?? status}</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <Label className="text-xs mb-1 block">Conta</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.conta_id}
              onChange={(e) => { setFilters(f => ({ ...f, conta_id: e.target.value })); setPage(1) }}
            >
              <option value="">Todas</option>
              {contas?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Conciliação</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.status_conciliacao}
              onChange={(e) => { setFilters(f => ({ ...f, status_conciliacao: e.target.value })); setPage(1) }}
            >
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="conciliado">Conciliado</option>
              <option value="ignorado">Ignorado</option>
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
            <Label className="text-xs mb-1 block">Forma de Pag.</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.forma_pagamento}
              onChange={(e) => { setFilters(f => ({ ...f, forma_pagamento: e.target.value })); setPage(1) }}
            >
              <option value="">Todas</option>
              {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus size={16} />
            Nova
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
            <p className="text-base">Nenhuma transação encontrada.</p>
            <p className="text-sm mt-1">Ajuste os filtros ou crie uma nova transação.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Pagamento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Forma Pag.</TableHead>
                <TableHead>Conciliação</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{formatDate(t.data_pagamento)}</TableCell>
                  <TableCell className="font-medium max-w-[160px] truncate">{t.descricao}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.conta_nome}</TableCell>
                  <TableCell>
                    <Badge variant={t.tipo === 'entrada' ? 'entrada' : 'saida'}>
                      {t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(t.valor)}</TableCell>
                  <TableCell className="text-sm">{t.forma_pagamento}</TableCell>
                  <TableCell>{conciliacaoBadge(t.status_conciliacao)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {t.status_conciliacao === 'pendente' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-primary"
                          title="Vincular a lançamento"
                          onClick={() => abrirVincular(t)}
                        >
                          <Link2 size={14} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive"
                        onClick={() => setDeleteId(t.id)}
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

        {data && data.total > data.per_page && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {data.total} registro(s) — página {data.page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input {...register('descricao')} placeholder="Descrição da transação" />
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
                <Label>Valor *</Label>
                <Input type="number" step="0.01" min="0" placeholder="0,00" {...register('valor')} />
                {errors.valor && <p className="text-xs text-destructive">{errors.valor.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data de Pagamento *</Label>
              <Input type="date" {...register('data_pagamento')} />
              {errors.data_pagamento && <p className="text-xs text-destructive">{errors.data_pagamento.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Conta *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('conta_id')}
              >
                <option value="">Selecione a conta</option>
                {contas?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {errors.conta_id && <p className="text-xs text-destructive">{errors.conta_id.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('forma_pagamento')}
              >
                <option value="">Selecione</option>
                {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              {errors.forma_pagamento && <p className="text-xs text-destructive">{errors.forma_pagamento.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditing(null) }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        description="Tem certeza que deseja excluir esta transação?"
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Dialog de Vinculação */}
      <Dialog open={!!vinculandoTransacao} onOpenChange={(o) => { if (!o) fecharVincular() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular a Lançamento</DialogTitle>
            {vinculandoTransacao && (
              <p className="text-sm text-muted-foreground pt-1">
                Transação: <span className="font-medium text-foreground">{vinculandoTransacao.descricao}</span>
                {' '}— {formatCurrency(vinculandoTransacao.valor)}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {loadingLancamentos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !lancamentosParaVincular?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum lançamento compatível encontrado (mesmo tipo, ±30 dias, não realizado).
              </p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancamentosParaVincular.map((l) => (
                      <TableRow
                        key={l.id}
                        className={`cursor-pointer ${lancamentoSelecionado?.id === l.id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                        onClick={() => setLancamentoSelecionado(l)}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            readOnly
                            checked={lancamentoSelecionado?.id === l.id}
                            className="accent-primary"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{l.descricao}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.categoria_nome ?? '—'}</TableCell>
                        <TableCell className="text-sm">{formatDate(l.data_competencia)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(l.valor_total)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(l.valor_pago)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{l.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {lancamentoSelecionado && (
              <div className="space-y-2">
                <Label>Valor a vincular *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valorVinculado}
                  onChange={(e) => setValorVinculado(e.target.value)}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground">
                  Valor da transação: {vinculandoTransacao && formatCurrency(vinculandoTransacao.valor)}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharVincular}>Cancelar</Button>
            <Button
              disabled={!lancamentoSelecionado || !valorVinculado || parseFloat(valorVinculado) <= 0 || vincularMutation.isPending}
              onClick={() => vincularMutation.mutate()}
            >
              {vincularMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar Vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
