import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, BookOpen } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      const { user } = useAuthStore.getState()
      navigate(user?.role === 'ADMIN' ? '/admin/dashboard' : '/student/courses')
    } catch (err: any) {
      setError(err.message || '登录失败，请检查邮箱和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500 text-white mb-4">
            <BookOpen size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">知识付费平台</h1>
          <p className="text-gray-500 mt-1">登录您的账户</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="邮箱地址"
              type="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              prefix={<Mail size={18} />}
              required
            />
            <Input
              label="密码"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              prefix={<Lock size={18} />}
              required
            />
            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
            >
              登录
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm text-gray-500">还没有账户？</span>
            <Link
              to="/register"
              className="text-sm text-primary-500 hover:text-primary-600 font-medium ml-1"
            >
              立即注册
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
