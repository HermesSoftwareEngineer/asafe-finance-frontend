import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { centrosCustoApi } from '../../lib/api'
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
import type { CentroCusto } from '../../types'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  ativo: z.boolean().default(true),
})

type FormData = z.infer<typeof schema>

export default function CentrosCusto() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CentroCusto | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: centros, isLoading } = useQuery<CentroCusto[]>({
    queryKey: ['centros-custo'],
    queryFn: async () => (await centrosCustoApi.list()).data,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ativo: true },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['centros-custo'] })

  const createMutation = useMutation({
    mutationFn: (d: FormData) => centrosCustoApi.create(d),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Centro de custo criado!' })
      setDialogOpen(false)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar centro de custo.' }),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => centrosCustoApi.update(editing!.id, d),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Centro de custo atualizado!' })
      setDialogOpen(false)
      setEditing(null)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar centro de custo.' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => centrosCustoApi.delete(id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Centro de custo excluído!' })
      setDeleteId(null)
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao excluir centro de custo.' }),
  })

  const openNew = () => {
    setEditing(null)
    reset({ nome: '', ativo: true })
    setDialogOpen(true)
  }

  const openEdit = (c: CentroCusto) => {
    setEditing(c)
    reset({ nome: c.nome, ativo: c.ativo })
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
          Novo Centro de Custo
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !centros?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhum centro de custo cadastrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centros.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>
                    <Badge variant={c.ativo ? 'realizado' : 'outline'}>
                      {c.ativo ? 'Ativo' : 'Inativo'}
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
            <DialogTitle>{editing ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input {...register('nome')} placeholder="Nome do centro de custo" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="cc-ativo" {...register('ativo')} className="w-4 h-4 accent-primary" />
              <Label htmlFor="cc-ativo" className="cursor-pointer">Centro de custo ativo</Label>
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
        description="Tem certeza que deseja excluir este centro de custo?"
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
