import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Play } from 'lucide-react'
import api from '@/lib/api'
import Loading from '@/components/ui/Loading'
import Empty from '@/components/ui/Empty'
import Button from '@/components/ui/Button'

interface MyCourse {
  id: string
  courseId: string
  course: {
    id: string
    title: string
    coverImage: string
    instructor?: { name: string }
  }
  progress: number
  lastLesson?: string
  updatedAt: string
}

export default function MyCourses() {
  const [courses, setCourses] = useState<MyCourse[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchMyCourses()
  }, [])

  const fetchMyCourses = async () => {
    try {
      setLoading(true)
      const res: any = await api.get('/enrollments')
      // 后端返回数组
      const responseData = res.data || res
      setCourses(Array.isArray(responseData) ? responseData : (responseData?.list || []))
    } catch (error) {
      console.error('获取我的课程失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading text="加载我的课程..." />

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">我的课程</h2>

      {courses.length === 0 ? (
        <Empty
          title="暂无已购课程"
          description="快去课程中心发现感兴趣的课程吧"
          action={
            <Button onClick={() => navigate('/student/courses')}>浏览课程</Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* 封面 */}
              <div className="relative aspect-video bg-gray-100">
                {item.course.coverImage ? (
                  <img
                    src={item.course.coverImage}
                    alt={item.course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen size={40} className="text-gray-300" />
                  </div>
                )}
              </div>

              {/* 课程信息 */}
              <div className="p-4">
                <h3 className="text-base font-semibold text-gray-900 line-clamp-2">
                  {item.course.title}
                </h3>

                {item.course.instructor && (
                  <p className="text-sm text-gray-500 mt-1">
                    讲师：{item.course.instructor.name}
                  </p>
                )}

                {/* 学习进度 */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>学习进度</span>
                    <span>{Math.round(item.progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>

                {/* 继续学习按钮 */}
                <Button
                  className="w-full mt-3"
                  size="sm"
                  icon={<Play size={16} />}
                  onClick={() => navigate(`/student/courses/${item.courseId}`)}
                >
                  {item.progress > 0 ? '继续学习' : '开始学习'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
