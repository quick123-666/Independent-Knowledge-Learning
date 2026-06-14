import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, BookOpen } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少为 6 位')
      return
    }

    setLoading(true)

    try {
      await register(email, password, name)
      const { user } = useAuthStore.getState()
      navigate(user?.role === 'admin' ? '/admin/dashboard' : '/student/courses')
    } catch (err: any) {
      setError(err.message || '注册失败，请稍后重试')
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
          <p className="text-gray-500 mt-1">创建新账户</p>
        </div>

        {/* 注册卡片 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="姓名"
              type="text"
              placeholder="请输入姓名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              prefix={<User size={18} />}
              required
            />
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
              placeholder="请输入密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              prefix={<Lock size={18} />}
              required
            />
            <Input
              label="确认密码"
              type="password"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              prefix={<Lock size={18} />}
              required
            />
            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
            >
              注册
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm text-gray-500">已有账户？</span>
            <Link
              to="/login"
              className="text-sm text-primary-500 hover:text-primary-600 font-medium ml-1"
            >
              立即登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
