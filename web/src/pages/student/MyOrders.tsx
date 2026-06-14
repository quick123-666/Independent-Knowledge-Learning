import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import Empty from '@/components/ui/Empty'

interface Order {
  id: string
  course: { id: string; title: string; coverImage?: string }
  amount: number
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'
  createdAt: string
}

export default function MyOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)
  const [alipayConfigured, setAlipayConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    fetchOrders()
    checkAlipayStatus()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const res: any = await api.get('/orders')
      const responseData = res.data || res
      setOrders(responseData?.list || responseData || [])
    } catch (error) {
      console.error('获取我的订单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkAlipayStatus = async () => {
    try {
      const res: any = await api.get('/pay/alipay/status')
      setAlipayConfigured(res.data?.configured || false)
    } catch {
      setAlipayConfigured(false)
    }
  }

  const handlePay = async (orderId: string) => {
    // 如果支付宝已配置，使用真实支付；否则使用模拟支付
    if (alipayConfigured) {
      try {
        setPaying(orderId)
        const res: any = await api.post('/pay/alipay/create', { orderId })
        const payUrl = res.data?.payUrl
        if (payUrl) {
          // 跳转到支付宝支付页面
          window.location.href = payUrl
        } else {
          alert('获取支付链接失败')
        }
      } catch (error: any) {
        alert(error?.response?.data?.message || '支付失败')
      } finally {
        setPaying(null)
      }
    } else {
      // 模拟支付（支付宝未配置时）
      try {
        setPaying(orderId)
        await api.post(`/orders/${orderId}/pay`)
        fetchOrders()
      } catch (error: any) {
        alert(error?.response?.data?.message || '支付失败')
      } finally {
        setPaying(null)
      }
    }
  }

  const handleCancel = async (orderId: string) => {
    if (!window.confirm('确定要取消该订单吗？')) return
    try {
      await api.post(`/orders/${orderId}/cancel`)
      fetchOrders()
    } catch (error: any) {
      alert(error?.response?.data?.message || '取消订单失败')
    }
  }

  if (loading) return <Loading text="加载订单列表..." />

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">我的订单</h2>

      {alipayConfigured === false && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          支付宝支付未配置，当前使用模拟支付模式。如需真实支付，请配置环境变量。
        </div>
      )}

      {orders.length === 0 ? (
        <Empty title="暂无订单" description="您还没有任何订单记录" />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* 课程信息 */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {order.course.coverImage ? (
                      <img
                        src={order.course.coverImage}
                        alt={order.course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        无图
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {order.course.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      订单号：#{order.id}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                </div>

                {/* 金额和状态 */}
                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <span className="text-lg font-bold text-gray-900">
                    {formatPrice(order.amount)}
                  </span>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                    {getOrderStatusText(order.status)}
                  </span>
                </div>

                {/* 操作 */}
                <div className="flex items-center gap-2 sm:flex-col">
                  {order.status === 'PENDING' && (
                    <>
                      <Button
                        size="sm"
                        loading={paying === order.id}
                        onClick={() => handlePay(order.id)}
                      >
                        {alipayConfigured ? '支付宝支付' : '去支付'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(order.id)}>
                        取消
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
