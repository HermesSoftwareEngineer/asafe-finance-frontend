import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, CheckCircle, X, Loader2, FileText, Link2 } from 'lucide-react'
import { contasApi, categoriasApi, transacoesApi } from '../../lib/api'
import api from '../../lib/api'
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils'
import { toast } from '../../hooks/useToast'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import type { Conta, Categoria, LancamentoParaVincular, Transacao } from '../../types'

interface PendentesData {
  transacoes: Transacao[]
}

interface HistoricoItem {
  id: number
  arquivo_nome: string
  conta_nome: string
  total_registros: number
  importado_em: string
}

export default function Conciliacao() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadContaId, setUploadContaId] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [criarLancamentoDialog, setCriarLancamentoDialog] = useState<Transacao | null>(null)
  const [criarDescricao, setCriarDescricao] = useState('')
  const [criarCategoriaId, setCriarCategoriaId] = useState('')
  const [vinculandoTransacao, setVinculandoTransacao] = useState<Transacao | null>(null)
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<LancamentoParaVincular | null>(null)
  const [valorVinculado, setValorVinculado] = useState('')

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

  const { data: pendentes, isLoading: loadingPendentes } = useQuery<Transacao[]>({
    queryKey: ['conciliacao', 'pendentes'],
    queryFn: async () => {
      const res = await api.get('/conciliacao/pendentes')
      return res.data
    },
  })

  const { data: historico } = useQuery<HistoricoItem[]>({
    queryKey: ['conciliacao', 'historico'],
    queryFn: async () => {
      const res = await api.get('/conciliacao/historico')
      return res.data
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !uploadContaId) throw new Error('Preencha os campos')
      const formData = new FormData()
      formData.append('conta_id', uploadContaId)
      formData.append('arquivo', uploadFile)
      return api.post('/conciliacao/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: (res) => {
      const msg = res.data?.mensagem ?? 'Importação concluída!'
      toast({ variant: 'success', title: msg })
      setUploadFile(null)
      setUploadContaId('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      queryClient.invalidateQueries({ queryKey: ['conciliacao'] })
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao importar arquivo.' }),
  })

  const ignorarMutation = useMutation({
    mutationFn: (id: number) => api.post(`/conciliacao/ignorar/${id}`),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Transação ignorada.' })
      queryClient.invalidateQueries({ queryKey: ['conciliacao'] })
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao ignorar transação.' }),
  })

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
      toast({ variant: 'success', title: 'Transação vinculada e conciliada!' })
      setVinculandoTransacao(null)
      setLancamentoSelecionado(null)
      setValorVinculado('')
      queryClient.invalidateQueries({ queryKey: ['conciliacao'] })
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao vincular transação.' }),
  })

  const abrirVincular = (t: Transacao) => {
    setVinculandoTransacao(t)
    setLancamentoSelecionado(null)
    setValorVinculado(String(t.valor))
  }

  const criarLancamentoMutation = useMutation({
    mutationFn: () => {
      const t = criarLancamentoDialog!
      return api.post(`/conciliacao/criar-lancamento/${t.id}`, {
        descricao: criarDescricao,
        categoria_id: criarCategoriaId ? Number(criarCategoriaId) : null,
      })
    },
    onSuccess: () => {
      toast({ variant: 'success', title: 'Lançamento criado e transação conciliada!' })
      setCriarLancamentoDialog(null)
      setCriarDescricao('')
      setCriarCategoriaId('')
      queryClient.invalidateQueries({ queryKey: ['conciliacao'] })
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar lançamento.' }),
  })

  return (
    <div className="space-y-6">
      {/* Upload OFX */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload size={18} />
            Importar Extrato OFX
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Conta bancária *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={uploadContaId}
                onChange={(e) => setUploadContaId(e.target.value)}
              >
                <option value="">Selecione a conta</option>
                {contas?.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo OFX *</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.OFX"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !uploadContaId || !uploadFile}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Importar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Transações Pendentes de Conciliação
            {pendentes && pendentes.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendentes.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingPendentes ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !pendentes?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-medium text-foreground">Tudo conciliado!</p>
              <p className="text-sm">Nenhuma transação pendente.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{formatDate(t.data_pagamento)}</TableCell>
                    <TableCell className="font-medium">{t.descricao}</TableCell>
                    <TableCell>
                      <Badge variant={t.tipo === 'entrada' ? 'entrada' : 'saida'}>
                        {t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(t.valor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.conta_nome}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => abrirVincular(t)}
                        >
                          <Link2 size={14} />
                          Vincular
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCriarLancamentoDialog(t)
                            setCriarDescricao(t.descricao)
                          }}
                        >
                          <FileText size={14} />
                          Criar Lançamento
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hover:text-destructive"
                          onClick={() => ignorarMutation.mutate(t.id)}
                          disabled={ignorarMutation.isPending}
                        >
                          <X size={14} />
                          Ignorar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Import history */}
      {historico && historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Importações</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Info</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm font-medium">{h.arquivo_nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{h.conta_nome}</TableCell>
                    <TableCell>
                      <Badge variant="realizado">{h.total_registros}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">—</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(h.importado_em)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Vincular a lançamento existente */}
      <Dialog open={!!vinculandoTransacao} onOpenChange={(o) => { if (!o) { setVinculandoTransacao(null); setLancamentoSelecionado(null) } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular a Lançamento Existente</DialogTitle>
            {vinculandoTransacao && (
              <p className="text-sm text-muted-foreground pt-1">
                <span className="font-medium text-foreground">{vinculandoTransacao.descricao}</span>
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
                          <input type="radio" readOnly checked={lancamentoSelecionado?.id === l.id} className="accent-primary" />
                        </TableCell>
                        <TableCell className="font-medium">{l.descricao}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.categoria_nome ?? '—'}</TableCell>
                        <TableCell className="text-sm">{formatDate(l.data_competencia)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(l.valor_total)}</TableCell>
                        <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
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
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setVinculandoTransacao(null); setLancamentoSelecionado(null) }}>
              Cancelar
            </Button>
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

      {/* Create lancamento dialog */}
      <Dialog
        open={criarLancamentoDialog !== null}
        onOpenChange={(o) => { if (!o) setCriarLancamentoDialog(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Lançamento</DialogTitle>
          </DialogHeader>
          {criarLancamentoDialog && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Valor:</span> <strong>{formatCurrency(criarLancamentoDialog.valor)}</strong></p>
                <p><span className="text-muted-foreground">Data:</span> {formatDate(criarLancamentoDialog.data_pagamento)}</p>
                <p><span className="text-muted-foreground">Tipo:</span> {criarLancamentoDialog.tipo}</p>
              </div>
              <div className="space-y-2">
                <Label>Descrição do Lançamento *</Label>
                <Input
                  value={criarDescricao}
                  onChange={(e) => setCriarDescricao(e.target.value)}
                  placeholder="Descrição"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={criarCategoriaId}
                  onChange={(e) => setCriarCategoriaId(e.target.value)}
                >
                  <option value="">Nenhuma</option>
                  {categorias?.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCriarLancamentoDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarLancamentoMutation.mutate()}
              disabled={criarLancamentoMutation.isPending || !criarDescricao}
            >
              {criarLancamentoMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar e Conciliar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
