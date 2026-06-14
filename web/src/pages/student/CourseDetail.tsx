import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Star, Lock, PlayCircle, ChevronDown, ChevronUp, ShoppingCart, BookOpen, Video, FileText, Music, Image } from 'lucide-react'
import api from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'

interface Course {
  id: string
  title: string
  description: string
  coverImage: string
  price: number
  instructor?: { name: string; avatar?: string }
  averageRating?: number
  _count?: { enrollments: number; reviews: number }
  category?: { name: string }
  chapters?: Chapter[]
  purchased?: boolean
}

interface Chapter {
  id: string
  title: string
  sortOrder: number
  isFree: boolean
  contentBlocks: ContentBlock[]
}

interface ContentBlock {
  id: string
  type: 'VIDEO' | 'ARTICLE' | 'AUDIO' | 'IMAGE'
  title: string
  content?: string
  url?: string
  duration?: number
  sortOrder: number
}

interface Review {
  id: string
  user: { name: string; avatar?: string }
  rating: number
  content: string
  createdAt: string
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    if (id) {
      fetchCourseDetail()
      fetchReviews()
    }
  }, [id])

  const fetchCourseDetail = async () => {
    try {
      setLoading(true)
      const res: any = await api.get(`/courses/${id}`)
      // 详情接口返回 { success: true, data: { ...course, chapters } }
      const data = res.data?.data || res.data
      setCourse(data || null)
    } catch (error) {
      console.error('获取课程详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReviews = async () => {
    try {
      const res: any = await api.get(`/courses/${id}/reviews`)
      // 评价接口可能返回数组或分页格式，做兼容处理
      const responseData = res.data?.data || res.data
      setReviews(Array.isArray(responseData) ? responseData : (responseData?.list || []))
    } catch (error) {
      console.error('获取评价列表失败:', error)
    }
  }

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) {
        next.delete(chapterId)
      } else {
        next.add(chapterId)
      }
      return next
    })
  }

  const handlePurchase = async () => {
    if (!course) return
    try {
      setPurchasing(true)
      const res: any = await api.post('/orders', { courseId: course.id })
      // 创建订单成功后跳转到我的订单页面进行支付
      navigate('/student/my-orders')
    } catch (error: any) {
      const msg = error?.response?.data?.message || error.message || '购买失败'
      alert(msg)
    } finally {
      setPurchasing(false)
    }
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        className={i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
      />
    ))
  }

  const renderContentBlockIcon = (type: ContentBlock['type']) => {
    switch (type) {
      case 'VIDEO':
        return <Video size={18} className="text-primary-500" />
      case 'ARTICLE':
        return <FileText size={18} className="text-blue-500" />
      case 'AUDIO':
        return <Music size={18} className="text-purple-500" />
      case 'IMAGE':
        return <Image size={18} className="text-green-500" />
      default:
        return <PlayCircle size={18} className="text-primary-500" />
    }
  }

  const renderContentBlock = (block: ContentBlock, isLocked: boolean) => {
    if (isLocked) {
      return (
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Lock size={18} className="text-gray-400" />
          <span className="text-sm text-gray-500 blur-sm select-none">{block.title}</span>
        </div>
      )
    }

    return (
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          {renderContentBlockIcon(block.type)}
          <span className="text-sm font-medium text-gray-800">{block.title}</span>
          {block.duration !== undefined && block.duration > 0 && (
            <span className="text-xs text-gray-400 ml-auto">{block.duration} 分钟</span>
          )}
        </div>

        {block.type === 'VIDEO' && block.url && (
          <div className="mt-2">
            <video
              src={block.url}
              controls
              className="w-full max-h-64 rounded-lg bg-black"
              preload="metadata"
            />
          </div>
        )}

        {block.type === 'ARTICLE' && block.content && (
          <div className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
            {block.content}
          </div>
        )}

        {block.type === 'AUDIO' && block.url && (
          <div className="mt-2">
            <audio src={block.url} controls className="w-full" preload="metadata" />
          </div>
        )}

        {block.type === 'IMAGE' && block.url && (
          <div className="mt-2">
            <img
              src={block.url}
              alt={block.title}
              className="max-w-full max-h-64 rounded-lg object-contain border border-gray-100"
            />
          </div>
        )}
      </div>
    )
  }

  if (loading) return <Loading text="加载课程详情..." />

  if (!course) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">课程不存在或已被删除</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/student/courses')}>
          返回课程列表
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 课程头部信息 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
          {/* 封面 */}
          <div className="lg:col-span-1 aspect-video lg:aspect-auto bg-gray-100">
            {course.coverImage ? (
              <img
                src={course.coverImage}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full min-h-[200px] flex items-center justify-center">
                <BookOpen size={60} className="text-gray-300" />
              </div>
            )}
          </div>

          {/* 信息 */}
          <div className="lg:col-span-2 p-6">
            <div className="flex items-start justify-between">
              <div>
                {course.category && (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 text-xs font-medium mb-2">
                    {course.category.name}
                  </span>
                )}
                <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
              </div>
            </div>

            <p className="text-gray-600 mt-3 leading-relaxed">{course.description}</p>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
              <span>讲师：{course.instructor?.name || '未知'}</span>
              {course.averageRating !== undefined && (
                <div className="flex items-center gap-1">
                  {renderStars(Math.round(course.averageRating))}
                  <span className="ml-1">{course.averageRating.toFixed(1)}</span>
                </div>
              )}
              {course._count?.enrollments !== undefined && (
                <span>{course._count.enrollments} 人学习</span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-6">
              <span className="text-3xl font-bold text-primary-500">
                {course.price > 0 ? formatPrice(course.price) : '免费'}
              </span>
              {course.purchased ? (
                <Button size="lg" onClick={() => navigate('/student/my-courses')}>
                  开始学习
                </Button>
              ) : (
                <Button
                  size="lg"
                  icon={<ShoppingCart size={18} />}
                  loading={purchasing}
                  onClick={handlePurchase}
                >
                  {course.price > 0 ? '立即购买' : '免费领取'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 章节列表 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">课程目录</h2>
        {(!course.chapters || course.chapters.length === 0) ? (
          <p className="text-gray-500 text-sm">暂无章节内容</p>
        ) : (
          <div className="space-y-2">
            {course.chapters.map((chapter) => {
              const isLocked = !chapter.isFree && !course.purchased
              return (
                <div key={chapter.id} className="border border-gray-100 rounded-lg overflow-hidden">
                  {/* 章节标题 */}
                  <button
                    onClick={() => toggleChapter(chapter.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedChapters.has(chapter.id) ? (
                        <ChevronUp size={18} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={18} className="text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900">{chapter.title}</span>
                      {isLocked && (
                        <Lock size={14} className="text-gray-400" />
                      )}
                      {chapter.isFree && !course.purchased && (
                        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          免费
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {chapter.contentBlocks?.length || 0} 内容
                    </span>
                  </button>

                  {/* 内容块列表 */}
                  {expandedChapters.has(chapter.id) && chapter.contentBlocks && (
                    <div className="border-t border-gray-100">
                      {chapter.contentBlocks.map((block) => (
                        <div
                          key={block.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {renderContentBlock(block, isLocked)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 评价列表 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          学员评价 ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无评价</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-medium">
                    {review.user.avatar ? (
                      <img src={review.user.avatar} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      review.user.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-900">{review.user.name}</span>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">{review.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
