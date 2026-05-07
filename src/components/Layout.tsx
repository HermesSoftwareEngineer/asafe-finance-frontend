import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Toaster } from './ui/toaster'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/lancamentos': 'Lançamentos',
  '/transacoes': 'Transações',
  '/conciliacao': 'Conciliação Bancária',
  '/relatorios': 'Relatórios',
  '/cadastros/contas': 'Contas',
  '/cadastros/categorias': 'Categorias',
  '/cadastros/centros-custo': 'Centros de Custo',
  '/cadastros/usuarios': 'Usuários',
  '/alterar-senha': 'Alterar Senha',
}

interface Props {
  children: React.ReactNode
}

export function Layout({ children }: Props) {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Asafe Finance'

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-8 sticky top-0 z-30">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
  )
}
