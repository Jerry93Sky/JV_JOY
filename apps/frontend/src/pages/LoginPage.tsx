import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/client'
import { Layers } from 'lucide-react'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { login, password })
      setAuth(res.data.token, res.data.user)
      navigate('/')
    } catch {
      setError('Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.08) 0%, transparent 60%), hsl(222 20% 8%)',
      }}>
      <div className="w-full max-w-sm px-4">
        {/* Логотип */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-3 shadow-lg shadow-primary/10">
            <Layers size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">BMS</h1>
          <p className="text-sm text-muted-foreground mt-1">Система управления бизнесом</p>
        </div>

        {/* Форма */}
        <div className="glass-panel rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Логин</label>
              <input
                className="w-full bg-white/5 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                placeholder="Введите логин"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Пароль</label>
              <input
                type="password"
                className="w-full bg-white/5 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Введите пароль"
              />
            </div>
            {error && (
              <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
