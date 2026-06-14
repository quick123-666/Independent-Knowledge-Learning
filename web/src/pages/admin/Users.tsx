import { useState, useEffect } from 'react'
import { Search, Eye, BookOpen, CheckCircle, XCircle, DollarSign, GraduationCap, Ban, Unlock, KeyRound, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Empty from '@/components/ui/Empty'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface User {
  id: string
  name: string
  email: string
  avatar: string | null
  role: string
  isBanned: boolean
  bannedAt: string | null
  bannedReason: string | null
  createdAt: string
}

interface ChapterInfo {
  id: string
  title: string
}

interface UserCourse {
  orderId: string
  courseId: string
  title: string
  coverImage: string | null
  price: number
  purchasedAt: string
  orderStatus: string
  progress: number
  isCompleted: boolean
  totalChapters: number
  completedCount: number
  completedChapters: ChapterInfo[]
  uncompletedChapters: ChapterInfo[]
}

interface UserDetail {
  user: User
  totalSpent: number
  totalOrders: number
  totalEnrollments: number
  courses: UserCourse[]
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  // 用户详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)

  // 封号弹窗
  const [banModalOpen, setBanModalOpen] = useState(false)
  const [banUserId, setBanUserId] = useState<string | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banLoading, setBanLoading] = useState(false)

  // 解封确认弹窗
  const [unbanModalOpen, setUnbanModalOpen] = useState(false)
  const [unbanUserId, setUnbanUserId] = useState<string | null>(null)
  const [unbanLoading, setUnbanLoading] = useState(false)

  // 重置密码弹窗
  const [resetPwdModalOpen, setResetPwdModalOpen] = useState(false)
  const [resetPwdUserId, setResetPwdUserId] = useState<string | null>(null)
  const [resetPwdUserName, setResetPwdUserName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetPwdLoading, setResetPwdLoading] = useState(false)

  // 退款弹窗
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null)
  const [refundCourseTitle, setRefundCourseTitle] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundLoading, setRefundLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [roleFilter])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (roleFilter) params.role = roleFilter
      const res: any = await api.get('/admin/users', { params })
      const responseData = res.data?.data || res.data
      setUsers(responseData?.list || responseData || [])
    } catch (error) {
      console.error('获取用户列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDetail = async (user: User) => {
    try {
      setDetailLoading(true)
      setSelectedUser(user)
      setDetailModalOpen(true)
      const res: any = await api.get(`/admin/users/${user.id}`)
      const data = res.data?.data || res.data
      setUserDetail(data)
    } catch (error) {
      console.error('获取用户详情失败:', error)
      alert('获取用户详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleCourseExpand = (courseId: string) => {
    setExpandedCourseId((prev) => (prev === courseId ? null : courseId))
  }

  // 封号操作
  const handleBanClick = (userId: string) => {
    setBanUserId(userId)
    setBanReason('')
    setBanModalOpen(true)
  }

  const handleBanConfirm = async () => {
    if (!banUserId || !banReason.trim()) return

    try {
      setBanLoading(true)
      await api.post(`/admin/users/${banUserId}/ban`, { reason: banReason.trim() })
      setBanModalOpen(false)
      setBanUserId(null)
      setBanReason('')
      await fetchUsers()
    } catch (error: any) {
      const message = error?.response?.data?.message || '封号失败，请稍后重试'
      alert(message)
    } finally {
      setBanLoading(false)
    }
  }

  // 解封操作
  const handleUnbanClick = (userId: string) => {
    setUnbanUserId(userId)
    setUnbanModalOpen(true)
  }

  const handleUnbanConfirm = async () => {
    if (!unbanUserId) return

    try {
      setUnbanLoading(true)
      await api.post(`/admin/users/${unbanUserId}/unban`)
      setUnbanModalOpen(false)
      setUnbanUserId(null)
      await fetchUsers()
    } catch (error: any) {
      const message = error?.response?.data?.message || '解封失败，请稍后重试'
      alert(message)
    } finally {
      setUnbanLoading(false)
    }
  }

  // 重置密码操作
  const handleResetPwdClick = (userId: string, userName: string) => {
    setResetPwdUserId(userId)
    setResetPwdUserName(userName)
    setNewPassword('')
    setResetPwdModalOpen(true)
  }

  const handleResetPwdConfirm = async () => {
    if (!resetPwdUserId || !newPassword.trim()) return
    if (newPassword.trim().length < 6) {
      alert('密码长度不能少于6位')
      return
    }

    try {
      setResetPwdLoading(true)
      await api.post(`/admin/users/${resetPwdUserId}/reset-password`, {
        newPassword: newPassword.trim(),
      })
      setResetPwdModalOpen(false)
      setResetPwdUserId(null)
      setResetPwdUserName('')
      setNewPassword('')
      alert('密码重置成功')
    } catch (error: any) {
      const message = error?.response?.data?.message || '密码重置失败，请稍后重试'
      alert(message)
    } finally {
      setResetPwdLoading(false)
    }
  }

  // 退款操作
  const handleRefundClick = (orderId: string, courseTitle: string) => {
    setRefundOrderId(orderId)
    setRefundCourseTitle(courseTitle)
    setRefundReason('')
    setRefundModalOpen(true)
  }

  const handleRefundConfirm = async () => {
    if (!refundOrderId || !refundReason.trim()) return

    try {
      setRefundLoading(true)
      await api.post(`/admin/orders/${refundOrderId}/refund`, {
        reason: refundReason.trim(),
      })
      setRefundModalOpen(false)
      setRefundOrderId(null)
      setRefundCourseTitle('')
      setRefundReason('')
      // 刷新用户详情
      if (selectedUser) {
        await fetchUserDetail(selectedUser)
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || '退款失败，请稍后重试'
      alert(message)
    } finally {
      setRefundLoading(false)
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="搜索用户姓名或邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<Search size={18} />}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">全部角色</option>
          <option value="admin">管理员</option>
          <option value="student">学员</option>
        </select>
      </div>

      {/* 用户列表 */}
      {loading ? (
        <Loading text="加载用户列表..." />
      ) : filteredUsers.length === 0 ? (
        <Empty title="暂无用户" description="还没有注册用户" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>用户</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className={user.isBanned ? 'bg-red-50' : ''}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-medium">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          user.name.charAt(0)
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-medium">{user.name}</span>
                        {user.isBanned && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium text-red-600 bg-red-100">
                            已封号
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-gray-600">{user.email}</td>
                  <td>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'ADMIN'
                          ? 'text-purple-600 bg-purple-50'
                          : 'text-blue-600 bg-blue-50'
                      }`}
                    >
                      {user.role === 'ADMIN' ? '管理员' : '学员'}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs">{formatDate(user.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchUserDetail(user)}
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        <Eye size={14} />
                        查看详情
                      </button>
                      <button
                        onClick={() => handleResetPwdClick(user.id, user.name)}
                        className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                      >
                        <KeyRound size={14} />
                        重置密码
                      </button>
                      {user.isBanned ? (
                        <button
                          onClick={() => handleUnbanClick(user.id)}
                          className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
                        >
                          <Unlock size={14} />
                          解封
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBanClick(user.id)}
                          className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          <Ban size={14} />
                          封号
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 用户详情弹窗 */}
      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedUser(null)
          setUserDetail(null)
          setExpandedCourseId(null)
        }}
        title={selectedUser ? `${selectedUser.name} 的详情` : '用户详情'}
        width="max-w-3xl"
        footer={
          <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>
        }
      >
        {detailLoading ? (
          <Loading text="加载用户详情..." />
        ) : !userDetail ? (
          <Empty title="暂无数据" description="无法获取用户详情" />
        ) : (
          <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <DollarSign size={20} className="mx-auto text-blue-600 mb-1" />
                <div className="text-xl font-bold text-blue-700">¥{userDetail.totalSpent.toFixed(2)}</div>
                <div className="text-xs text-blue-600">总消费</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <BookOpen size={20} className="mx-auto text-green-600 mb-1" />
                <div className="text-xl font-bold text-green-700">{userDetail.totalOrders}</div>
                <div className="text-xs text-green-600">已购课程</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <GraduationCap size={20} className="mx-auto text-purple-600 mb-1" />
                <div className="text-xl font-bold text-purple-700">{userDetail.totalEnrollments}</div>
                <div className="text-xs text-purple-600">学习中</div>
              </div>
            </div>

            {/* 已购课程列表 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">已购课程与学习进度</h3>
              {userDetail.courses.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                  该用户尚未购买任何课程
                </div>
              ) : (
                <div className="space-y-3">
                  {userDetail.courses.map((course) => (
                    <div
                      key={course.courseId}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* 课程头部 */}
                      <div
                        className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleCourseExpand(course.courseId)}
                      >
                        {course.coverImage ? (
                          <img
                            src={course.coverImage}
                            alt={course.title}
                            className="w-12 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center">
                            <BookOpen size={16} className="text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {course.title}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500">
                              ¥{course.price.toFixed(2)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(course.purchasedAt)}
                            </span>
                            {course.isCompleted ? (
                              <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                                <CheckCircle size={10} />
                                已完成
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-xs text-orange-600">
                                <XCircle size={10} />
                                学习中
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-primary-600">
                              {course.progress}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {course.completedCount}/{course.totalChapters} 章
                            </div>
                          </div>
                          {course.orderStatus === 'PAID' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRefundClick(course.orderId, course.title)
                              }}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium bg-red-50 px-2 py-1 rounded"
                            >
                              <RotateCcw size={12} />
                              退款
                            </button>
                          )}
                          {course.orderStatus === 'REFUNDED' && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              已退款
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 展开的章节详情 */}
                      {expandedCourseId === course.courseId && (
                        <div className="p-3 border-t border-gray-100 space-y-3">
                          {/* 进度条 */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>学习进度</span>
                              <span>{course.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary-500 h-2 rounded-full transition-all"
                                style={{ width: `${course.progress}%` }}
                              />
                            </div>
                          </div>

                          {/* 已学习章节 */}
                          {course.completedChapters.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-green-700 mb-1.5 flex items-center gap-1">
                                <CheckCircle size={12} />
                                已学习 ({course.completedChapters.length})
                              </div>
                              <div className="space-y-1">
                                {course.completedChapters.map((ch) => (
                                  <div
                                    key={ch.id}
                                    className="text-xs text-gray-600 bg-green-50 rounded px-2 py-1"
                                  >
                                    {ch.title}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 未学习章节 */}
                          {course.uncompletedChapters.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                                <XCircle size={12} />
                                未学习 ({course.uncompletedChapters.length})
                              </div>
                              <div className="space-y-1">
                                {course.uncompletedChapters.map((ch) => (
                                  <div
                                    key={ch.id}
                                    className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1"
                                  >
                                    {ch.title}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 封号弹窗 */}
      <Modal
        open={banModalOpen}
        onClose={() => {
          setBanModalOpen(false)
          setBanUserId(null)
          setBanReason('')
        }}
        title="确认封号"
        width="max-w-md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setBanModalOpen(false)
                setBanUserId(null)
                setBanReason('')
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleBanConfirm}
              disabled={!banReason.trim() || banLoading}
            >
              {banLoading ? '封号中...' : '确认封号'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            封号后该用户将无法登录和使用平台功能。此操作可随时撤销。
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              封号原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="请输入封号原因..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* 解封确认弹窗 */}
      <Modal
        open={unbanModalOpen}
        onClose={() => {
          setUnbanModalOpen(false)
          setUnbanUserId(null)
        }}
        title="确认解封"
        width="max-w-md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setUnbanModalOpen(false)
                setUnbanUserId(null)
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleUnbanConfirm}
              disabled={unbanLoading}
            >
              {unbanLoading ? '解封中...' : '确认解封'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          确认解除该用户的封号状态？解封后用户将恢复正常使用权限。
        </p>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        open={resetPwdModalOpen}
        onClose={() => {
          setResetPwdModalOpen(false)
          setResetPwdUserId(null)
          setResetPwdUserName('')
          setNewPassword('')
        }}
        title={`重置密码 - ${resetPwdUserName}`}
        width="max-w-md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setResetPwdModalOpen(false)
                setResetPwdUserId(null)
                setResetPwdUserName('')
                setNewPassword('')
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleResetPwdConfirm}
              disabled={!newPassword.trim() || newPassword.trim().length < 6 || resetPwdLoading}
            >
              {resetPwdLoading ? '重置中...' : '确认重置'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            请输入新密码（至少6位）。重置后该用户需使用新密码登录。
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* 退款弹窗 */}
      <Modal
        open={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false)
          setRefundOrderId(null)
          setRefundCourseTitle('')
          setRefundReason('')
        }}
        title={`退款 - ${refundCourseTitle}`}
        width="max-w-md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setRefundModalOpen(false)
                setRefundOrderId(null)
                setRefundCourseTitle('')
                setRefundReason('')
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleRefundConfirm}
              disabled={!refundReason.trim() || refundLoading}
            >
              {refundLoading ? '退款中...' : '确认退款'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            退款后该用户将失去此课程的学习权限，此操作不可撤销。
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              退款原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="请输入退款原因..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
