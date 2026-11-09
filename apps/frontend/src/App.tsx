import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import DealsPage from './pages/DealsPage'
import LeadsPage from './pages/LeadsPage'
import ClientsPage from './pages/ClientsPage'
import WarehousePage from './pages/WarehousePage'
import SystemsPage from './pages/SystemsPage'
import FinancePage from './pages/FinancePage'
import SettingsPage from './pages/SettingsPage'
import VendorsPage from './pages/VendorsPage'
import JVLineLabPage from './modules/jv-line/JVLineLabPage'
import JVOrderPage from './modules/jv-order/JVOrderPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/leads" replace />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="deals" element={<DealsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="warehouse" element={<WarehousePage />} />
        <Route path="systems" element={<SystemsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="jv-line-lab" element={<JVLineLabPage />} />
        <Route path="jv/orders/new" element={<JVOrderPage />} />
      </Route>
    </Routes>
  )
}
