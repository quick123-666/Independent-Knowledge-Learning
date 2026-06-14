import { useState, useEffect } from 'react'
import { Users, BookOpen, ShoppingCart, DollarSign } from 'lucide-react'
import api from '@/lib/api'
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Loading from '@/components/ui/Loading'
import Empty from '@/components/ui/Empty'

interface Stats {
  totalUsers: number
  totalCourses: number
  totalOrders: number
  totalRevenue: number
}

interface Order {
  id: number
  user: { name: string }
  course: { title: string }
  amount: number
  status: string
  createdAt: string
}

interface DailyOrder {
  date: string
  count: number
  amount: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [dailyOrders, setDailyOrders] = useState<DailyOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [dashboardRes, ordersRes, statsRes]: any[] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/orders?limit=10'),
        api.get('/admin/stats'),
      ])
      // 后端返回 { success, data, message } 格式
      const dashboardData = dashboardRes.data?.data?.overview || dashboardRes.data?.overview || dashboardRes.data || dashboardRes
      const ordersData = ordersRes.data?.data || ordersRes.data || ordersRes
      const statsData = statsRes.data?.data || statsRes.data || statsRes

      setStats(dashboardData)
      setRecentOrders(Array.isArray(ordersData?.list) ? ordersData.list : (Array.isArray(ordersData) ? ordersData : []))
      setDailyOrders(Array.isArray(statsData?.dailyOrders) ? statsData.dailyOrders : (Array.isArray(statsData) ? statsData : []))
    } catch (error) {
      console.error('获取看板数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading text="加载看板数据..." />

  const statCards = [
    {
      label: '用户总数',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: '课程总数',
      value: stats?.totalCourses ?? 0,
      icon: BookOpen,
      color: 'bg-green-50 text-green-600',
    },
    {
      label: '订单总数',
      value: stats?.totalOrders ?? 0,
      icon: ShoppingCart,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: '总收入',
      value: formatPrice(stats?.totalRevenue ?? 0),
      icon: DollarSign,
      color: 'bg-orange-50 text-orange-600',
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">数据看板</h2>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.color}`}>
                <card.icon size={24} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 近 7 天订单趋势 */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">近 7 天订单趋势</h3>
          {dailyOrders.length === 0 ? (
            <Empty title="暂无订单数据" description="近 7 天没有订单记录" />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>订单数</th>
                    <th>金额</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyOrders.map((item) => (
                    <tr key={item.date}>
                      <td className="text-gray-900">{item.date}</td>
                      <td className="text-gray-900">{item.count}</td>
                      <td className="text-gray-900 font-medium">{formatPrice(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 最新订单 */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">最新订单</h3>
          {recentOrders.length === 0 ? (
            <Empty title="暂无订单" description="还没有任何订单记录" />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>课程</th>
                    <th>金额</th>
                    <th>状态</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="text-gray-900">{order.user?.name}</td>
                      <td className="text-gray-900 max-w-[120px] truncate">{order.course?.title}</td>
                      <td className="text-gray-900 font-medium">{formatPrice(order.amount)}</td>
                      <td>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                          {getOrderStatusText(order.status)}
                        </span>
                      </td>
                      <td className="text-gray-500 text-xs">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
