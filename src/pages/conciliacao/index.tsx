import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Link2,
  Plus,
  ChevronLeft,
  ChevronRight,
  History,
} from 'lucide-react'
import { conciliacaoApi, contasApi, categoriasApi, centrosCustoApi, lancamentosApi } from '../../lib/api'
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
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { OfxTransacao, OfxSugestao, Conta, Categoria, CentroCusto, Lancamento } from '../../types'

type Tab = 'pendentes' | 'historico'

const criarSchema = z.object({
  categoria_id: z.coerce.number().nullable().optional(),
  centro_custo_id: z.coerce.number().nullable().optional(),
  observacao: z.string().optional(),
})
type CriarFormData = z.infer<typeof criarSchema>

export default function Conciliacao() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<Tab>('pendentes')
  const [contaFiltro, setContaFiltro] = useState('')
  const [page, setPage] = useState(1)

  // dialogs
  const [vincularOfx, setVincularOfx] = useState<OfxTransacao | null>(null)
  const [criarOfx, setCriarOfx] = useState<OfxTransacao | null>(null)
  const [ignorarId, setIgnorarId] = useState<number | null>(null)
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<number | null>(null)
  const [buscarLancamento, setBuscarLancamento] = useState('')

  const { data: contas } = useQuery<Conta[]>({
    queryKey: ['contas'],
    queryFn: async () => (await contasApi.list()).data,
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

  const { data: pendentes, isLoading: loadingPendentes } = useQuery({
    queryKey: ['conciliacao-pendentes', contaFiltro, page],
    queryFn: async () => {
      const res = await conciliacaoApi.pendentes({
        conta_id: contaFiltro ? Number(contaFiltro) : undefined,
        com_sugestoes: true,
        page,
      })
      return res.data
    },
    enabled: tab === 'pendentes',
  })

  const { data: historico, isLoading: loadingHistorico } = useQuery({
    queryKey: ['conciliacao-historico'],
    queryFn: async () => (await conciliacaoApi.historico()).data,
    enabled: tab === 'historico',
  })

  // Lançamentos pagos da mesma conta para o dialog de vincular
  const contaVincular = vincularOfx?.conta_id
  const { data: lancamentosPagos } = useQuery<Lancamento[]>({
    queryKey: ['lancamentos-pagos-conta', contaVincular],
    queryFn: async () => {
      const res = await lancamentosApi.list({ status: 'pago', conta_id: contaVincular, page: 1 })
      return res.data.items
    },
    enabled: !!vincularOfx,
  })

  const invalidatePendentes = () =>
    queryClient.invalidateQueries({ queryKey: ['conciliacao-pendentes'] })

  // Upload OFX
  const uploadMutation = useMutation({
    mutationFn: ({ conta_id, file }: { conta_id: number; file: File }) =>
      conciliacaoApi.upload(conta_id, file),
    onSuccess: (res) => {
      const d = res.data as { importadas?: number; duplicatas?: number }
      toast({
        variant: 'success',
        title: `OFX importado: ${d.importadas ?? 0} transação(ões), ${d.duplicatas ?? 0} duplicata(s).`,
      })
      invalidatePendentes()
      queryClient.invalidateQueries({ queryKey: ['conciliacao-historico'] })
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao importar OFX.' }),
  })

  const [uploadContaId, setUploadContaId] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!uploadContaId) {
      toast({ variant: 'destructive', title: 'Selecione uma conta antes de importar.' })
      return
    }
    uploadMutation.mutate({ conta_id: Number(uploadContaId), file })
    e.target.value = ''
  }

  // Vincular
  const vincularMutation = useMutation({
    mutationFn: () => conciliacaoApi.vincular(vincularOfx!.id, lancamentoSelecionado!),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Transação vinculada com sucesso!' })
      setVincularOfx(null)
      setLancamentoSelecionado(null)
      setBuscarLancamento('')
      invalidatePendentes()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao vincular transação.' }),
  })

  // Criar lançamento do OFX
  const {
    register: criarRegister,
    handleSubmit: criarHandleSubmit,
    reset: criarReset,
    setValue: criarSetValue,
  } = useForm<CriarFormData>({ resolver: zodResolver(criarSchema) })

  const criarMutation = useMutation({
    mutationFn: (d: CriarFormData) =>
      conciliacaoApi.criarLancamento(criarOfx!.id, {
        categoria_id: d.categoria_id ?? null,
        centro_custo_id: d.centro_custo_id ?? null,
        observacao: d.observacao || null,
      }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Lançamento criado e conciliado!' })
      setCriarOfx(null)
      criarReset()
      invalidatePendentes()
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar lançamento.' }),
  })

  // Ignorar
  const ignorarMutation = useMutation({
    mutationFn: (id: number) => conciliacaoApi.ignorar(id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Transação ignorada.' })
      setIgnorarId(null)
      invalidatePendentes()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao ignorar transação.' }),
  })

  const totalPages = pendentes ? Math.ceil(pendentes.total / pendentes.per_page) : 1
  const selectClass =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring'

  const lancamentosFiltrados = lancamentosPagos?.filter((l) =>
    !buscarLancamento ||
    l.descricao.toLowerCase().includes(buscarLancamento.toLowerCase())
  )

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="border-b border-border flex items-center justify-between">
        <div className="flex gap-1">
          {(['pendentes', 'historico'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'pendentes' ? 'Pendentes' : 'Histórico'}
            </button>
          ))}
        </div>

        {/* Upload OFX */}
        <div className="flex items-center gap-2 pb-1">
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={uploadContaId}
            onChange={(e) => setUploadContaId(e.target.value)}
          >
            <option value="">Conta para importar</option>
            {contas?.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Importar OFX
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.qfx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* ── Pendentes ── */}
      {tab === 'pendentes' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <Label className="text-xs whitespace-nowrap">Filtrar conta:</Label>
            <select
              className={`${selectClass} max-w-[220px]`}
              value={contaFiltro}
              onChange={(e) => { setContaFiltro(e.target.value); setPage(1) }}
            >
              <option value="">Todas</option>
              {contas?.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {loadingPendentes ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !pendentes?.items.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-400" />
                <p className="text-base font-medium">Nenhuma transação pendente.</p>
                <p className="text-sm mt-1">Importe um arquivo OFX para começar.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição OFX</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Sugestão</TableHead>
                    <TableHead className="w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.items.map((ofx) => {
                    const melhor: OfxSugestao | undefined = ofx.sugestoes?.[0]
                    return (
                      <TableRow key={ofx.id}>
                        <TableCell className="text-sm">{formatDate(ofx.data)}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate font-medium">{ofx.descricao}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ofx.conta_nome}</TableCell>
                        <TableCell>
                          <Badge variant={ofx.tipo === 'entrada' ? 'entrada' : 'saida'}>
                            {ofx.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(ofx.valor)}
                        </TableCell>
                        <TableCell>
                          {melhor ? (
                            <div className="text-xs">
                              <p className="font-medium truncate max-w-[140px]">{melhor.descricao}</p>
                              <p className="text-muted-foreground">
                                {formatCurrency(melhor.valor_total)} · score {(melhor.score * 100).toFixed(0)}%
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem sugestão</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Vincular a lançamento"
                              onClick={() => {
                                setVincularOfx(ofx)
                                setLancamentoSelecionado(melhor?.lancamento_id ?? null)
                                setBuscarLancamento('')
                              }}
                            >
                              <Link2 size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Criar lançamento"
                              onClick={() => { setCriarOfx(ofx); criarReset() }}
                            >
                              <Plus size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ignorar"
                              className="hover:text-destructive"
                              onClick={() => setIgnorarId(ofx.id)}
                            >
                              <XCircle size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}

            {pendentes && pendentes.total > pendentes.per_page && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {pendentes.total} registro(s) — página {pendentes.page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Histórico ── */}
      {tab === 'historico' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loadingHistorico ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !historico?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma importação realizada.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Importadas</TableHead>
                  <TableHead>Conciliadas</TableHead>
                  <TableHead>Pendentes</TableHead>
                  <TableHead>Ignoradas</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium text-sm">{h.arquivo_nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{h.conta_nome}</TableCell>
                    <TableCell className="text-sm">{h.importadas}</TableCell>
                    <TableCell>
                      <span className="text-green-600 font-medium">{h.conciliados}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-yellow-600 font-medium">{h.pendentes}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{h.ignorados}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(h.importado_em)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ── Dialog: Vincular ── */}
      <Dialog
        open={!!vincularOfx}
        onOpenChange={(o) => {
          if (!o) { setVincularOfx(null); setLancamentoSelecionado(null); setBuscarLancamento('') }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular Transação OFX</DialogTitle>
          </DialogHeader>

          {vincularOfx && (
            <div className="space-y-4">
              {/* OFX info */}
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm text-muted-foreground">Transação OFX</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{vincularOfx.descricao}</span>
                    <span className="font-bold">{formatCurrency(vincularOfx.valor)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(vincularOfx.data)} · {vincularOfx.conta_nome}
                  </p>
                </CardContent>
              </Card>

              {/* Sugestões */}
              {(vincularOfx.sugestoes?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Sugestões automáticas
                  </p>
                  <div className="space-y-1">
                    {vincularOfx.sugestoes!.map((s) => (
                      <button
                        key={s.lancamento_id}
                        type="button"
                        onClick={() => setLancamentoSelecionado(s.lancamento_id)}
                        className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                          lancamentoSelecionado === s.lancamento_id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{s.descricao}</span>
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                            {(s.score * 100).toFixed(0)}% match
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(s.valor_total)} · {formatDate(s.data)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Buscar lançamento manualmente */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Buscar lançamento pago
                </p>
                <Input
                  placeholder="Buscar por descrição..."
                  value={buscarLancamento}
                  onChange={(e) => setBuscarLancamento(e.target.value)}
                  className="mb-2"
                />
                <div className="border border-border rounded-md overflow-hidden max-h-48 overflow-y-auto">
                  {!lancamentosFiltrados?.length ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum lançamento pago encontrado nesta conta.
                    </p>
                  ) : (
                    lancamentosFiltrados.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLancamentoSelecionado(l.id)}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-border last:border-0 transition-colors ${
                          lancamentoSelecionado === l.id
                            ? 'bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate max-w-[280px]">{l.descricao}</span>
                          <span className="text-xs font-medium ml-2">{formatCurrency(l.valor_total)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(l.data)}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setVincularOfx(null); setLancamentoSelecionado(null); setBuscarLancamento('') }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!lancamentoSelecionado || vincularMutation.isPending}
              onClick={() => vincularMutation.mutate()}
            >
              {vincularMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar Vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Criar Lançamento ── */}
      <Dialog
        open={!!criarOfx}
        onOpenChange={(o) => { if (!o) { setCriarOfx(null); criarReset() } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Lançamento a partir do OFX</DialogTitle>
          </DialogHeader>

          {criarOfx && (
            <Card className="mb-2">
              <CardContent className="py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{criarOfx.descricao}</span>
                  <span className="font-bold">{formatCurrency(criarOfx.valor)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(criarOfx.data)} · {criarOfx.conta_nome}
                </p>
              </CardContent>
            </Card>
          )}

          <form onSubmit={criarHandleSubmit((d) => criarMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select
                className={selectClass}
                {...criarRegister('categoria_id')}
                onChange={(e) =>
                  criarSetValue('categoria_id', e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Nenhuma</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icone ? `${c.icone} ` : ''}{c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <select
                className={selectClass}
                {...criarRegister('centro_custo_id')}
                onChange={(e) =>
                  criarSetValue('centro_custo_id', e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Nenhum</option>
                {centros?.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea {...criarRegister('observacao')} placeholder="Observações..." rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setCriarOfx(null); criarReset() }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criarMutation.isPending}>
                {criarMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar e Conciliar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar ignorar */}
      <ConfirmDialog
        open={ignorarId !== null}
        description="Deseja ignorar esta transação OFX? Ela não aparecerá mais na lista de pendentes."
        onConfirm={() => ignorarId !== null && ignorarMutation.mutate(ignorarId)}
        onCancel={() => setIgnorarId(null)}
      />
    </div>
  )
}
