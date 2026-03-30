import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/supervisor/Dashboard'
import Schedule from './pages/supervisor/Schedule'
import KPIDashboard from './pages/admin/KPIDashboard'
import Reports from './pages/admin/Reports'
import LoadingSpinner from './components/common/LoadingSpinner'

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode
  roles?: string[]
}) {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (user?.role === 'admin') return <Navigate to="/admin/kpi" replace />
  return <Navigate to="/supervisor/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/supervisor/dashboard"
        element={
          <ProtectedRoute roles={['supervisor', 'admin']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisor/schedule"
        element={
          <ProtectedRoute roles={['supervisor', 'admin']}>
            <Schedule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/kpi"
        element={
          <ProtectedRoute roles={['admin']}>
            <KPIDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute roles={['admin']}>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
