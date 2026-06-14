import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Calendar, BookOpen, ShoppingCart, GraduationCap, Edit3, Save, X, Lock, ChevronRight, Upload, Fingerprint } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/lib/utils'
import Loading from '@/components/ui/Loading'
import Button from '@/components/ui/Button'

interface UserProfile {
  id: string
  name: string
  email: string
  avatar: string | null
  role: string
  createdAt: string
}

interface Stats {
  totalCourses: number
  totalOrders: number
  totalSpent: number
  completedCourses: number
}

export default function Profile() {
  const navigate = useNavigate()
  const { user: authUser, fetchUser } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [saving, setSaving] = useState(false)

  // 头像上传
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // 邮箱验证码
  const [verifyCode, setVerifyCode] = useState('')
  const [codeSending, setCodeSending] = useState(false)
  const [codeCountdown, setCodeCountdown] = useState(0)
  const [emailChanged, setEmailChanged] = useState(false)

  const [changingPwd, setChangingPwd] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  // 验证码倒计时
  useEffect(() => {
    if (codeCountdown <= 0) return
    const timer = setTimeout(() => setCodeCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [codeCountdown])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res: any = await api.get('/auth/me')
      const userData = res.data?.user || res.data
      setProfile(userData)
      setEditName(userData?.name || '')
      setEditEmail(userData?.email || '')
      setEditAvatar(userData?.avatar || '')
      setEmailChanged(false)
      setVerifyCode('')

      const [enrollRes, orderRes] = await Promise.all([
        api.get('/enrollments'),
        api.get('/orders'),
      ])
      const enrollments = enrollRes.data?.list || enrollRes.data || []
      const orders = orderRes.data?.list || orderRes.data || []
      const paidOrders = orders.filter((o: any) => o.status === 'PAID')

      setStats({
        totalCourses: enrollments.length,
        totalOrders: orders.length,
        totalSpent: paidOrders.reduce((sum: number, o: any) => sum + o.amount, 0),
        completedCourses: enrollments.filter((e: any) => e.progress === 100).length,
      })
    } catch (error) {
      console.error('获取个人信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 头像本地上传
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }
    try {
      setAvatarUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      const res: any = await api.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = res.data?.data || res.data
      if (data?.url) {
        setEditAvatar(data.url)
      }
    } catch (error: any) {
      alert(error?.response?.data?.message || '头像上传失败')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // 发送邮箱验证码（模拟）
  const handleSendVerifyCode = async () => {
    if (!editEmail.trim()) {
      alert('请先输入邮箱地址')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editEmail.trim())) {
      alert('邮箱格式不正确')
      return
    }
    try {
      setCodeSending(true)
      // 模拟发送验证码（实际项目中应调用后端发送邮件 API）
      await new Promise((resolve) => setTimeout(resolve, 800))
      alert(`验证码已发送至 ${editEmail.trim()}\n（演示模式：请输入 123456）`)
      setCodeCountdown(60)
    } catch (error: any) {
      alert('发送验证码失败')
    } finally {
      setCodeSending(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      alert('姓名不能为空')
      return
    }
    if (!editEmail.trim()) {
      alert('邮箱不能为空')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editEmail.trim())) {
      alert('邮箱格式不正确')
      return
    }
    // 如果邮箱修改了，需要验证码
    if (emailChanged) {
      if (!verifyCode.trim()) {
        alert('请输入邮箱验证码')
        return
      }
      if (verifyCode.trim() !== '123456') {
        alert('验证码不正确（演示模式请输入 123456）')
        return
      }
    }
    try {
      setSaving(true)
      await api.put('/auth/profile', {
        name: editName.trim(),
        email: editEmail.trim(),
        avatar: editAvatar.trim() || null,
      })
      setEditing(false)
      setEmailChanged(false)
      setVerifyCode('')
      await fetchUser()
      await fetchProfile()
      alert('资料保存成功')
    } catch (error: any) {
      alert(error?.response?.data?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('请填写所有密码字段')
      return
    }
    if (newPassword.length < 6) {
      alert('新密码长度不能少于6位')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('两次输入的新密码不一致')
      return
    }
    try {
      setPwdLoading(true)
      await api.post('/auth/change-password', { oldPassword, newPassword })
      alert('密码修改成功')
      setChangingPwd(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      alert(error?.response?.data?.message || '密码修改失败')
    } finally {
      setPwdLoading(false)
    }
  }

  if (loading) return <Loading text="加载个人信息..." />

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900">个人中心</h2>

      {/* 基本信息卡片 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">
              {profile?.avatar ? (
                <img src={profile.avatar} alt={profile.name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                profile?.name?.charAt(0) || 'U'
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{profile?.name}</h3>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <Mail size={14} />
                {profile?.email}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                <Calendar size={14} />
                注册时间：{profile?.createdAt ? formatDate(profile.createdAt) : '-'}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-400 mt-0.5">
                <Fingerprint size={14} />
                ID：{profile?.id}
              </div>
            </div>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Edit3 size={14} />
              编辑资料
            </button>
          )}
        </div>

        {/* 编辑表单 */}
        {editing && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
            {/* 头像上传区域 */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold overflow-hidden">
                {editAvatar ? (
                  <img src={editAvatar} alt="preview" className="w-16 h-16 object-cover" />
                ) : (
                  editName.charAt(0) || 'U'
                )}
              </div>
              <div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Upload size={14} />}
                  loading={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarUploading ? '上传中...' : '上传头像'}
                </Button>
                <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG、GIF、WebP，最大 10MB</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => {
                    setEditEmail(e.target.value)
                    setEmailChanged(e.target.value.trim() !== profile?.email)
                    if (e.target.value.trim() === profile?.email) {
                      setVerifyCode('')
                    }
                  }}
                  placeholder="请输入邮箱地址"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 邮箱验证码 */}
            {emailChanged && (
              <div className="bg-yellow-50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-yellow-800">
                  检测到邮箱已修改，需要验证新邮箱。点击"获取验证码"后，请输入收到的 6 位验证码。
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="请输入验证码"
                    maxLength={6}
                    className="w-40 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={codeSending}
                    disabled={codeCountdown > 0}
                    onClick={handleSendVerifyCode}
                  >
                    {codeCountdown > 0 ? `${codeCountdown}秒后重试` : '获取验证码'}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button size="sm" icon={<Save size={14} />} loading={saving} onClick={handleSaveProfile}>
                保存
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<X size={14} />}
                onClick={() => {
                  setEditing(false)
                  setEditName(profile?.name || '')
                  setEditEmail(profile?.email || '')
                  setEditAvatar(profile?.avatar || '')
                  setEmailChanged(false)
                  setVerifyCode('')
                }}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/student/my-courses')}
          className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
        >
          <BookOpen size={20} className="mx-auto text-blue-500 mb-2" />
          <div className="text-xl font-bold text-gray-900">{stats?.totalCourses || 0}</div>
          <div className="text-xs text-gray-500">已购课程</div>
        </button>
        <button
          onClick={() => navigate('/student/my-courses')}
          className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
        >
          <GraduationCap size={20} className="mx-auto text-green-500 mb-2" />
          <div className="text-xl font-bold text-gray-900">{stats?.completedCourses || 0}</div>
          <div className="text-xs text-gray-500">已完成</div>
        </button>
        <button
          onClick={() => navigate('/student/my-orders')}
          className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
        >
          <ShoppingCart size={20} className="mx-auto text-orange-500 mb-2" />
          <div className="text-xl font-bold text-gray-900">{stats?.totalOrders || 0}</div>
          <div className="text-xs text-gray-500">订单数</div>
        </button>
        <button
          onClick={() => navigate('/student/my-orders')}
          className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
        >
          <User size={20} className="mx-auto text-purple-500 mb-2" />
          <div className="text-xl font-bold text-gray-900">¥{stats?.totalSpent?.toFixed(0) || 0}</div>
          <div className="text-xs text-gray-500">总消费</div>
        </button>
      </div>

      {/* 快捷入口 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">快捷入口</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <button
            onClick={() => navigate('/student/my-courses')}
            className="flex items-center justify-between w-full px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-primary-500" />
              <span className="text-sm text-gray-700">我的课程</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
          <button
            onClick={() => navigate('/student/my-orders')}
            className="flex items-center justify-between w-full px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart size={18} className="text-orange-500" />
              <span className="text-sm text-gray-700">我的订单</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* 修改密码 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">账号安全</h3>
          {!changingPwd && (
            <button
              onClick={() => setChangingPwd(true)}
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Lock size={14} />
              修改密码
            </button>
          )}
        </div>
        {changingPwd && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="请输入当前密码"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少6位）"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <Button size="sm" loading={pwdLoading} onClick={handleChangePassword}>
                确认修改
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setChangingPwd(false)
                  setOldPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
