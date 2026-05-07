import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { contasApi } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
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
import type { Conta } from '../../types'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  tipo: z.string().min(1, 'Tipo obrigatório'),
  saldo_inicial: z.coerce.number(),
  ativo: z.boolean(),
})

type FormData = z.infer<typeof schema>

const TIPOS_CONTA = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'outro', label: 'Outro' },
]

export default function Contas() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Conta | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: contas, isLoading } = useQuery<Conta[]>({
    queryKey: ['contas'],
    queryFn: async () => (await contasApi.list()).data,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ativo: true, saldo_inicial: 0 },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contas'] })

  const createMutation = useMutation({
    mutationFn: (d: FormData) => contasApi.create(d),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Conta criada!' })
      setDialogOpen(false)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar conta.' }),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => contasApi.update(editing!.id, d),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Conta atualizada!' })
      setDialogOpen(false)
      setEditing(null)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar conta.' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contasApi.delete(id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Conta excluída!' })
      setDeleteId(null)
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao excluir conta.' }),
  })

  const openNew = () => {
    setEditing(null)
    reset({ nome: '', tipo: '', saldo_inicial: 0, ativo: true })
    setDialogOpen(true)
  }

  const openEdit = (c: Conta) => {
    setEditing(c)
    reset({ nome: c.nome, tipo: c.tipo, saldo_inicial: c.saldo_inicial, ativo: c.ativo })
    setDialogOpen(true)
  }

  const onSubmit = (d: FormData) => {
    if (editing) updateMutation.mutate(d)
    else createMutation.mutate(d)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-2">
          <Plus size={16} />
          Nova Conta
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !contas?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhuma conta cadastrada.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Saldo Inicial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">
                    {TIPOS_CONTA.find(t => t.value === c.tipo)?.label ?? c.tipo}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(c.saldo_inicial)}</TableCell>
                  <TableCell>
                    <Badge variant={c.ativo ? 'realizado' : 'outline'}>
                      {c.ativo ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive"
                        onClick={() => setDeleteId(c.id)}
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input {...register('nome')} placeholder="Nome da conta" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('tipo')}
              >
                <option value="">Selecione</option>
                {TIPOS_CONTA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {errors.tipo && <p className="text-xs text-destructive">{errors.tipo.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Saldo Inicial</Label>
              <Input type="number" step="0.01" {...register('saldo_inicial')} />
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="ativo" {...register('ativo')} className="w-4 h-4 accent-primary" />
              <Label htmlFor="ativo" className="cursor-pointer">Conta ativa</Label>
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
        description="Tem certeza que deseja excluir esta conta?"
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
