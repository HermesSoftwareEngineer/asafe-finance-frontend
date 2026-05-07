import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Loader2, KeyRound } from 'lucide-react'
import { authApi } from '../lib/api'
import { toast } from '../hooks/useToast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

const schema = z
  .object({
    senha_atual: z.string().min(1, 'Senha atual obrigatória'),
    nova_senha: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres'),
    confirmar_senha: z.string().min(1, 'Confirmação obrigatória'),
  })
  .refine((d) => d.nova_senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })

type FormData = z.infer<typeof schema>

export default function AlterarSenha() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.alterarSenha(data),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Senha alterada com sucesso!' })
      reset()
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      const msg = err.response?.data?.detail ?? 'Erro ao alterar senha.'
      toast({ variant: 'destructive', title: msg })
    },
  })

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound size={20} />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha_atual">Senha Atual *</Label>
              <Input
                id="senha_atual"
                type="password"
                placeholder="Sua senha atual"
                autoComplete="current-password"
                {...register('senha_atual')}
              />
              {errors.senha_atual && (
                <p className="text-xs text-destructive">{errors.senha_atual.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nova_senha">Nova Senha *</Label>
              <Input
                id="nova_senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                {...register('nova_senha')}
              />
              {errors.nova_senha && (
                <p className="text-xs text-destructive">{errors.nova_senha.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmar_senha">Confirmar Nova Senha *</Label>
              <Input
                id="confirmar_senha"
                type="password"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                {...register('confirmar_senha')}
              />
              {errors.confirmar_senha && (
                <p className="text-xs text-destructive">{errors.confirmar_senha.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                'Alterar Senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
