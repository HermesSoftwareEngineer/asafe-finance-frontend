import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2, ChevronRight } from 'lucide-react'
import { categoriasApi } from '../../lib/api'
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
import type { Categoria } from '../../types'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  tipo: z.string().min(1, 'Tipo obrigatório'),
  icone: z.string().optional(),
  categoria_pai_id: z.coerce.number().nullable().optional(),
  cor: z.string().default('#22c55e'),
  ativo: z.boolean().default(true),
})

type FormData = z.infer<typeof schema>

export default function Categorias() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Categoria | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [showSubs, setShowSubs] = useState<number | null>(null)

  const { data: categorias, isLoading } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await categoriasApi.list()).data,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ativo: true, cor: '#22c55e' },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categorias'] })

  const createMutation = useMutation({
    mutationFn: (d: FormData) => categoriasApi.create({ ...d, icone: d.icone || null, categoria_pai_id: d.categoria_pai_id ?? null }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Categoria criada!' })
      setDialogOpen(false)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar categoria.' }),
  })

  const updateMutation = useMutation({
    mutationFn: (d: FormData) => categoriasApi.update(editing!.id, { ...d, icone: d.icone || null, categoria_pai_id: d.categoria_pai_id ?? null }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Categoria atualizada!' })
      setDialogOpen(false)
      setEditing(null)
      reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar categoria.' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriasApi.delete(id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Categoria excluída!' })
      setDeleteId(null)
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao excluir categoria.' }),
  })

  const openNew = (paiId?: number) => {
    setEditing(null)
    reset({ nome: '', tipo: '', icone: '', categoria_pai_id: paiId ?? null, cor: '#22c55e', ativo: true })
    setDialogOpen(true)
  }

  const openEdit = (c: Categoria) => {
    setEditing(c)
    reset({
      nome: c.nome,
      tipo: c.tipo,
      icone: c.icone ?? '',
      categoria_pai_id: c.categoria_pai_id,
      cor: c.cor,
      ativo: c.ativo,
    })
    setDialogOpen(true)
  }

  const onSubmit = (d: FormData) => {
    if (editing) updateMutation.mutate(d)
    else createMutation.mutate(d)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  // Data from API already contains root categories with subcategorias embedded
  const pais = categorias ?? []
  const getSubs = (paiId: number) => {
    const pai = pais.find(c => c.id === paiId)
    return pai?.subcategorias ?? []
  }
  const paiOptions = pais

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openNew()} className="gap-2">
          <Plus size={16} />
          Nova Categoria
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !pais.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhuma categoria cadastrada.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Ícone</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pais.map((cat) => {
                const subs = getSubs(cat.id)
                const expanded = showSubs === cat.id
                return (
                  <>
                    <TableRow key={cat.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {subs.length > 0 && (
                            <button
                              onClick={() => setShowSubs(expanded ? null : cat.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ChevronRight
                                size={16}
                                className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
                              />
                            </button>
                          )}
                          <span className="font-medium">{cat.nome}</span>
                          {subs.length > 0 && (
                            <Badge variant="secondary" className="text-xs">{subs.length} sub</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-lg">
                        {cat.icone || <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cat.tipo === 'entrada' ? 'entrada' : 'saida'}>
                          {cat.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: cat.cor }} />
                          <span className="text-xs text-muted-foreground">{cat.cor}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cat.ativo ? 'realizado' : 'outline'}>
                          {cat.ativo ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Nova subcategoria"
                            onClick={() => openNew(cat.id)}
                          >
                            <Plus size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:text-destructive"
                            onClick={() => setDeleteId(cat.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded && subs.map((sub) => (
                      <TableRow key={sub.id} className="bg-muted/30">
                        <TableCell className="pl-10">
                          <span className="text-muted-foreground mr-2">└</span>
                          {sub.nome}
                        </TableCell>
                        <TableCell className="text-lg">
                          {sub.icone || <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sub.tipo === 'entrada' ? 'entrada' : 'saida'}>
                            {sub.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: sub.cor }} />
                            <span className="text-xs text-muted-foreground">{sub.cor}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sub.ativo ? 'realizado' : 'outline'}>
                            {sub.ativo ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(sub)}>
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:text-destructive"
                              onClick={() => setDeleteId(sub.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input {...register('nome')} placeholder="Nome da categoria" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>

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
              <Label>Categoria Pai (opcional)</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('categoria_pai_id')}
                onChange={(e) => setValue('categoria_pai_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Nenhuma (categoria raiz)</option>
                {paiOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <Input {...register('icone')} placeholder="Emoji ou nome (ex: 🎵, music)" />
              <p className="text-xs text-muted-foreground">Opcional. Pode ser um emoji (🎵) ou nome de ícone.</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label>Cor</Label>
                <input
                  type="color"
                  className="h-9 w-full rounded-md border border-input cursor-pointer"
                  {...register('cor')}
                />
              </div>
              <div className="flex items-center gap-3 mt-6">
                <input type="checkbox" id="cat-ativo" {...register('ativo')} className="w-4 h-4 accent-primary" />
                <Label htmlFor="cat-ativo" className="cursor-pointer">Ativa</Label>
              </div>
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
        description="Tem certeza que deseja excluir esta categoria? As subcategorias também serão afetadas."
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
