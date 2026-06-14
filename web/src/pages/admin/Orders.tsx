import { useState, useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '@/lib/utils'
import Loading from '@/components/ui/Loading'
import Empty from '@/components/ui/Empty'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Order {
  id: string
  user: { name: string; email: string }
  course: { title: string }
  amount: number
  status: string
  createdAt: string
  refundedAt?: string | null
  refundReason?: string | null
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  // 退款弹窗
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundLoading, setRefundLoading] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [statusFilter])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (statusFilter) params.status = statusFilter
      const res: any = await api.get('/admin/orders', { params })
      // 后端返回 { success: true, data: { list: [...], pagination: {...} } }
      const responseData = res.data?.data || res.data
      setOrders(responseData?.list || responseData || [])
    } catch (error) {
      console.error('获取订单列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefundClick = (orderId: string) => {
    setRefundOrderId(orderId)
    setRefundReason('')
    setRefundModalOpen(true)
  }

  const handleRefundConfirm = async () => {
    if (!refundOrderId || !refundReason.trim()) return

    try {
      setRefundLoading(true)
      await api.post(`/admin/orders/${refundOrderId}/refund`, { reason: refundReason.trim() })
      setRefundModalOpen(false)
      setRefundOrderId(null)
      setRefundReason('')
      // 刷新列表
      await fetchOrders()
    } catch (error: any) {
      const message = error?.response?.data?.message || '退款失败，请稍后重试'
      alert(message)
    } finally {
      setRefundLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">订单管理</h2>

      {/* 状态筛选 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">全部状态</option>
          <option value="pending">待支付</option>
          <option value="paid">已支付</option>
          <option value="cancelled">已取消</option>
          <option value="refunded">已退款</option>
        </select>
      </div>

      {/* 订单列表 */}
      {loading ? (
        <Loading text="加载订单列表..." />
      ) : orders.length === 0 ? (
        <Empty title="暂无订单" description="还没有任何订单记录" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>订单号</th>
                <th>用户</th>
                <th>课程</th>
                <th>金额</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="text-gray-500 font-mono text-xs">#{order.id}</td>
                  <td>
                    <div>
                      <p className="text-gray-900 font-medium">{order.user?.name}</p>
                      <p className="text-gray-400 text-xs">{order.user?.email}</p>
                    </div>
                  </td>
                  <td className="text-gray-900 max-w-[200px] truncate">{order.course?.title}</td>
                  <td className="text-gray-900 font-medium">{formatPrice(order.amount)}</td>
                  <td>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                      {getOrderStatusText(order.status)}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs">{formatDate(order.createdAt)}</td>
                  <td>
                    {order.status === 'PAID' && (
                      <button
                        onClick={() => handleRefundClick(order.id)}
                        className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                      >
                        <RotateCcw size={14} />
                        退款
                      </button>
                    )}
                    {order.status === 'REFUNDED' && order.refundReason && (
                      <span className="text-xs text-gray-500" title={order.refundReason}>
                        已退款
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 退款确认弹窗 */}
      <Modal
        open={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false)
          setRefundOrderId(null)
          setRefundReason('')
        }}
        title="确认退款"
        width="max-w-md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setRefundModalOpen(false)
                setRefundOrderId(null)
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
            退款后该订单将变为"已退款"状态，同时取消该用户对应课程的学习资格。此操作不可撤销。
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
