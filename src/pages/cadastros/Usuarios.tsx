import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2, ShieldCheck } from 'lucide-react'
import { usuariosApi } from '../../lib/api'
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
import type { User } from '../../types'

const createSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  is_admin: z.boolean().default(false),
  ativo: z.boolean().default(true),
})

const editSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  nova_senha: z.string().optional(),
  is_admin: z.boolean().default(false),
  ativo: z.boolean().default(true),
})

type CreateData = z.infer<typeof createSchema>
type EditData = z.infer<typeof editSchema>

export default function Usuarios() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: usuarios, isLoading } = useQuery<User[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await usuariosApi.list()).data,
  })

  const createForm = useForm<CreateData>({
    resolver: zodResolver(createSchema),
    defaultValues: { is_admin: false, ativo: true },
  })

  const editForm = useForm<EditData>({
    resolver: zodResolver(editSchema),
    defaultValues: { is_admin: false, ativo: true },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['usuarios'] })

  const createMutation = useMutation({
    mutationFn: (d: CreateData) => usuariosApi.create(d),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Usuário criado!' })
      setDialogOpen(false)
      createForm.reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar usuário.' }),
  })

  const updateMutation = useMutation({
    mutationFn: (d: EditData) => usuariosApi.update(editing!.id, d),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Usuário atualizado!' })
      setDialogOpen(false)
      setEditing(null)
      editForm.reset()
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar usuário.' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usuariosApi.delete(id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Usuário excluído!' })
      setDeleteId(null)
      invalidate()
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao excluir usuário.' }),
  })

  const openNew = () => {
    setEditing(null)
    createForm.reset({ nome: '', email: '', senha: '', is_admin: false, ativo: true })
    setDialogOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    editForm.reset({ nome: u.nome, email: u.email, nova_senha: '', is_admin: u.is_admin, ativo: true })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-2">
          <Plus size={16} />
          Novo Usuário
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !usuarios?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhum usuário cadastrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {u.is_admin ? (
                      <Badge variant="default" className="gap-1">
                        <ShieldCheck size={12} />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Usuário</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive"
                        onClick={() => setDeleteId(u.id)}
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

      {/* Create dialog */}
      {!editing && (
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Usuário</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input {...createForm.register('nome')} placeholder="Nome completo" />
                {createForm.formState.errors.nome && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.nome.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input type="email" {...createForm.register('email')} placeholder="email@exemplo.com" />
                {createForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Senha *</Label>
                <Input type="password" {...createForm.register('senha')} placeholder="Mínimo 6 caracteres" />
                {createForm.formState.errors.senha && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.senha.message}</p>
                )}
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_admin"
                    {...createForm.register('is_admin')}
                    className="w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="is_admin" className="cursor-pointer">Administrador</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ativo_u"
                    {...createForm.register('ativo')}
                    className="w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="ativo_u" className="cursor-pointer">Ativo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null) } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={editForm.handleSubmit((d) => updateMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input {...editForm.register('nome')} placeholder="Nome completo" />
                {editForm.formState.errors.nome && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.nome.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input type="email" {...editForm.register('email')} />
                {editForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Nova Senha (deixe em branco para não alterar)</Label>
                <Input type="password" {...editForm.register('nova_senha')} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_is_admin"
                    {...editForm.register('is_admin')}
                    className="w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="edit_is_admin" className="cursor-pointer">Administrador</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_ativo"
                    {...editForm.register('ativo')}
                    className="w-4 h-4 accent-primary"
                  />
                  <Label htmlFor="edit_ativo" className="cursor-pointer">Ativo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditing(null) }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        description="Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita."
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
