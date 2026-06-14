import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 className，支持 Tailwind CSS 类名去重 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 格式化金额 */
export function formatPrice(price: number): string {
  return `¥${price.toFixed(2)}`
}

/** 格式化日期 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 格式化相对时间 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 30) {
    return formatDate(date)
  }
  if (days > 0) return `${days} 天前`
  if (hours > 0) return `${hours} 小时前`
  if (minutes > 0) return `${minutes} 分钟前`
  return '刚刚'
}

/** 订单状态映射 */
export function getOrderStatusText(status: string): string {
  const map: Record<string, string> = {
    PENDING: '待支付',
    PAID: '已支付',
    CANCELLED: '已取消',
    REFUNDED: '已退款',
  }
  return map[status] || status
}

/** 订单状态颜色 */
export function getOrderStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'text-yellow-600 bg-yellow-50',
    PAID: 'text-green-600 bg-green-50',
    CANCELLED: 'text-gray-600 bg-gray-50',
    REFUNDED: 'text-red-600 bg-red-50',
  }
  return map[status] || 'text-gray-600 bg-gray-50'
}

/** 课程状态映射 */
export function getCourseStatusText(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '草稿',
    PUBLISHED: '已发布',
    ARCHIVED: '已下架',
  }
  return map[status] || status
}

/** 课程状态颜色 */
export function getCourseStatusColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'text-gray-600 bg-gray-100',
    PUBLISHED: 'text-green-600 bg-green-50',
    ARCHIVED: 'text-red-600 bg-red-50',
  }
  return map[status] || 'text-gray-600 bg-gray-100'
}
