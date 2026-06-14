import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Star, BookOpen } from 'lucide-react'
import api from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Empty from '@/components/ui/Empty'

interface Course {
  id: string
  title: string
  description: string
  coverImage: string
  price: number
  teacher?: { name: string }
  rating?: number
  studentCount?: number
  category?: { name: string }
}

interface Category {
  id: string
  name: string
}

export default function CourseList() {
  const [courses, setCourses] = useState<Course[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchCourses()
    fetchCategories()
  }, [categoryFilter])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (categoryFilter) params.categoryId = categoryFilter
      const res: any = await api.get('/courses', { params })
      // 后端返回 { success: true, data: { list: [...], pagination: {...} } }
      const responseData = res.data?.data || res.data
      setCourses(responseData?.list || responseData || [])
    } catch (error) {
      console.error('获取课程列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res: any = await api.get('/categories')
      setCategories(res.data || res || [])
    } catch (error) {
      console.error('获取分类列表失败:', error)
    }
  }

  const filteredCourses = courses.filter(
    (c) => !search || c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">课程中心</h2>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="搜索课程..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<Search size={18} />}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">全部分类</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* 课程卡片网格 */}
      {loading ? (
        <Loading text="加载课程列表..." />
      ) : filteredCourses.length === 0 ? (
        <Empty title="暂无课程" description="当前没有可浏览的课程" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              onClick={() => navigate(`/student/courses/${course.id}`)}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
            >
              {/* 封面图 */}
              <div className="relative aspect-video bg-gray-100 overflow-hidden">
                {course.coverImage ? (
                  <img
                    src={course.coverImage}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen size={40} className="text-gray-300" />
                  </div>
                )}
                {course.category && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/50 text-white text-xs">
                    {course.category.name}
                  </span>
                )}
              </div>

              {/* 课程信息 */}
              <div className="p-4">
                <h3 className="text-base font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-500 transition-colors">
                  {course.title}
                </h3>

                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-500">{course.teacher?.name || '讲师'}</span>
                  {course.rating !== undefined && (
                    <div className="flex items-center gap-0.5 ml-auto">
                      <Star size={14} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-sm text-gray-600">{course.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-lg font-bold text-primary-500">
                    {course.price > 0 ? formatPrice(course.price) : '免费'}
                  </span>
                  {course.studentCount !== undefined && (
                    <span className="text-xs text-gray-400">
                      {course.studentCount} 人学习
                    </span>
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
