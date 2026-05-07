import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  RefreshCw,
  BarChart2,
  Briefcase,
  Tag,
  Layers,
  Users,
  LogOut,
  KeyRound,
  Leaf,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '../lib/utils'

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
}

function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-white/10 text-[#4ade80] font-semibold'
            : 'text-white/70 hover:bg-white/5 hover:text-white'
        )
      }
    >
      <span className="w-5 h-5 flex-shrink-0">{icon}</span>
      {label}
    </NavLink>
  )
}

export function Sidebar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    queryClient.clear()
    navigate('/login')
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[260px] flex flex-col z-40 scrollbar-thin overflow-y-auto"
      style={{ backgroundColor: '#0a1a0e' }}
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center flex-shrink-0">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Asafe Finance</p>
            <p className="text-white/50 text-[10px] leading-tight mt-0.5">Ministério Asafe Vocal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
        <NavItem to="/lancamentos" icon={<FileText size={18} />} label="Lançamentos" />
        <NavItem to="/transacoes" icon={<CreditCard size={18} />} label="Transações" />
        <NavItem to="/conciliacao" icon={<RefreshCw size={18} />} label="Conciliação" />
        <NavItem to="/relatorios" icon={<BarChart2 size={18} />} label="Relatórios" />

        <div className="pt-4 pb-2 px-4">
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest">
            Cadastros
          </p>
        </div>

        <NavItem to="/cadastros/contas" icon={<Briefcase size={18} />} label="Contas" />
        <NavItem to="/cadastros/categorias" icon={<Tag size={18} />} label="Categorias" />
        <NavItem
          to="/cadastros/centros-custo"
          icon={<Layers size={18} />}
          label="Centros de Custo"
        />
        {user?.is_admin && (
          <NavItem to="/cadastros/usuarios" icon={<Users size={18} />} label="Usuários" />
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-white text-sm font-medium truncate mb-3">{user?.nome}</p>
        <div className="space-y-0.5">
          <NavLink
            to="/alterar-senha"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 text-xs px-3 py-2 rounded-md transition-colors w-full',
                isActive
                  ? 'bg-white/10 text-[#4ade80]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <KeyRound size={14} />
            Alterar Senha
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-md transition-colors w-full text-white/60 hover:bg-white/5 hover:text-red-400"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </div>
    </aside>
  )
}
