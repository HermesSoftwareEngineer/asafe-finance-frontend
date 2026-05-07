import { Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Lancamentos from './pages/lancamentos'
import Transacoes from './pages/transacoes'
import Conciliacao from './pages/conciliacao'
import Relatorios from './pages/relatorios'
import Contas from './pages/cadastros/Contas'
import Categorias from './pages/cadastros/Categorias'
import CentrosCusto from './pages/cadastros/CentrosCusto'
import Usuarios from './pages/cadastros/Usuarios'
import AlterarSenha from './pages/AlterarSenha'
import { Loader2 } from 'lucide-react'

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
          <p className="text-lg font-medium">Algo deu errado.</p>
          <button
            className="text-sm underline text-muted-foreground hover:text-foreground"
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/lancamentos"
          element={
            <ProtectedRoute>
              <Layout>
                <Lancamentos />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/transacoes"
          element={
            <ProtectedRoute>
              <Layout>
                <Transacoes />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/conciliacao"
          element={
            <ProtectedRoute>
              <Layout>
                <Conciliacao />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/relatorios"
          element={
            <ProtectedRoute>
              <Layout>
                <Relatorios />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/cadastros/contas"
          element={
            <ProtectedRoute>
              <Layout>
                <Contas />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/cadastros/categorias"
          element={
            <ProtectedRoute>
              <Layout>
                <Categorias />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/cadastros/centros-custo"
          element={
            <ProtectedRoute>
              <Layout>
                <CentrosCusto />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/cadastros/usuarios"
          element={
            <ProtectedRoute>
              <Layout>
                <Usuarios />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/alterar-senha"
          element={
            <ProtectedRoute>
              <Layout>
                <AlterarSenha />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
