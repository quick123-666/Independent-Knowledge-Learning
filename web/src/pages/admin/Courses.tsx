import { useState, useEffect, useRef } from 'react'
import {
  Search, Plus, Edit, Eye, EyeOff, Trash2, BookOpen,
  Video, FileText, Music, Image, ChevronDown, ChevronUp,
  Upload,
} from 'lucide-react'
import api from '@/lib/api'
import { formatPrice, formatDate, getCourseStatusText, getCourseStatusColor } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'
import Empty from '@/components/ui/Empty'

type ContentBlockType = 'VIDEO' | 'ARTICLE' | 'AUDIO' | 'IMAGE'

interface ContentBlock {
  id: string
  type: ContentBlockType
  title: string
  content: string
  url: string
  duration: number
  sortOrder: number
}

interface Chapter {
  id: string
  title: string
  sortOrder: number
  isFree: boolean
  createdAt: string
  contentBlocks: ContentBlock[]
}

interface Course {
  id: string
  title: string
  description: string
  categoryId: string
  category?: { name: string }
  price: number
  coverImage: string
  status: 'draft' | 'published' | 'archived'
  createdAt: string
  _count?: { chapters: number; enrollments: number }
  chapters?: Chapter[]
}

interface Category {
  id: string
  name: string
}

const emptyCourse = {
  title: '',
  description: '',
  categoryId: '',
  price: 0,
  coverImage: '',
  status: 'draft' as const,
}

const emptyChapterForm = {
  title: '',
  isFree: false,
  sortOrder: 1,
}

const emptyBlockForm = {
  type: 'VIDEO' as ContentBlockType,
  title: '',
  content: '',
  url: '',
  duration: 0,
  sortOrder: 1,
}

const blockTypeOptions: { value: ContentBlockType; label: string; icon: React.ReactNode }[] = [
  { value: 'VIDEO', label: '视频', icon: <Video size={14} /> },
  { value: 'ARTICLE', label: '文章', icon: <FileText size={14} /> },
  { value: 'AUDIO', label: '音频', icon: <Music size={14} /> },
  { value: 'IMAGE', label: '图片', icon: <Image size={14} /> },
]

function getBlockTypeLabel(type: ContentBlockType) {
  return blockTypeOptions.find((o) => o.value === type)?.label || type
}

function getBlockTypeIcon(type: ContentBlockType) {
  const opt = blockTypeOptions.find((o) => o.value === type)
  return opt?.icon || <FileText size={14} />
}

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [formData, setFormData] = useState(emptyCourse)
  const [submitting, setSubmitting] = useState(false)

  const [chapterModalOpen, setChapterModalOpen] = useState(false)
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapterForm, setChapterForm] = useState({ ...emptyChapterForm })
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)

  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set())

  const [blockForm, setBlockForm] = useState({ ...emptyBlockForm })
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null)
  const [activeChapterForBlock, setActiveChapterForBlock] = useState<Chapter | null>(null)

  // 文件上传相关状态（内容块）
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 封面图片上传相关状态
  const [coverUploading, setCoverUploading] = useState(false)
  const coverFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchCourses()
    fetchCategories()
  }, [statusFilter])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (statusFilter) params.status = statusFilter
      const res: any = await api.get('/admin/courses', { params })
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
      const res: any = await api.get('/admin/categories')
      const responseData = res.data || res
      setCategories(Array.isArray(responseData) ? responseData : [])
    } catch (error) {
      console.error('获取分类列表失败:', error)
    }
  }

  const handleCreate = () => {
    setEditingCourse(null)
    setFormData(emptyCourse)
    setModalOpen(true)
  }

  const handleEdit = (course: Course) => {
    setEditingCourse(course)
    setFormData({
      title: course.title,
      description: course.description,
      categoryId: course.categoryId,
      price: course.price,
      coverImage: course.coverImage,
      status: course.status,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      if (editingCourse) {
        await api.put(`/admin/courses/${editingCourse.id}`, formData)
      } else {
        await api.post('/admin/courses', formData)
      }
      setModalOpen(false)
      fetchCourses()
    } catch (error) {
      console.error('保存课程失败:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (course: Course) => {
    try {
      const newStatus = course.status === 'published' ? 'archived' : 'published'
      await api.put(`/admin/courses/${course.id}/status`, { status: newStatus })
      fetchCourses()
    } catch (error) {
      console.error('修改课程状态失败:', error)
    }
  }

  const handleDelete = async (course: Course) => {
    if (!confirm(`确定要删除课程「${course.title}」吗？此操作不可恢复。`)) return
    try {
      await api.delete(`/admin/courses/${course.id}`)
      fetchCourses()
    } catch (error) {
      console.error('删除课程失败:', error)
      alert('删除课程失败')
    }
  }

  const handleViewChapters = async (course: Course) => {
    setViewingCourse(course)
    setExpandedChapterIds(new Set())
    setActiveChapterForBlock(null)
    setEditingBlock(null)
    setBlockForm({ ...emptyBlockForm })
    try {
      const res: any = await api.get(`/courses/${course.slug || course.id}/chapters`)
      const responseData = res.data || res
      const list = Array.isArray(responseData) ? responseData : (responseData?.list || [])
      setChapters(list.map((ch: any) => ({ ...ch, contentBlocks: ch.contentBlocks || [] })))
    } catch (error) {
      console.error('获取章节失败:', error)
      setChapters([])
    }
    setChapterModalOpen(true)
  }

  const refreshChapters = async () => {
    if (!viewingCourse) return
    try {
      const res: any = await api.get(`/courses/${viewingCourse.slug || viewingCourse.id}/chapters`)
      const responseData = res.data || res
      const list = Array.isArray(responseData) ? responseData : (responseData?.list || [])
      setChapters(list.map((ch: any) => ({ ...ch, contentBlocks: ch.contentBlocks || [] })))
    } catch (error) {
      console.error('刷新章节失败:', error)
    }
  }

  const handleSaveChapter = async () => {
    if (!viewingCourse) return
    try {
      if (editingChapter) {
        await api.put(`/admin/chapters/${editingChapter.id}`, {
          title: chapterForm.title,
          isFree: chapterForm.isFree,
          sortOrder: chapterForm.sortOrder,
        })
      } else {
        const body = {
          title: chapterForm.title,
          isFree: chapterForm.isFree,
          sortOrder: chapterForm.sortOrder,
          contentBlocks: [],
        }
        await api.post(`/admin/courses/${viewingCourse.id}/chapters`, body)
      }
      setChapterForm({ ...emptyChapterForm, sortOrder: chapters.length + 1 })
      setEditingChapter(null)
      await refreshChapters()
      fetchCourses()
    } catch (error) {
      console.error('保存章节失败:', error)
      alert('保存章节失败')
    }
  }

  const handleDeleteChapter = async (chapter: Chapter) => {
    if (!confirm(`确定要删除章节「${chapter.title}」吗？`)) return
    try {
      await api.delete(`/admin/chapters/${chapter.id}`)
      await refreshChapters()
      fetchCourses()
    } catch (error) {
      console.error('删除章节失败:', error)
      alert('删除章节失败')
    }
  }

  const toggleExpandChapter = (chapterId: string) => {
    setExpandedChapterIds((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) {
        next.delete(chapterId)
      } else {
        next.add(chapterId)
      }
      return next
    })
  }

  const handleEditChapterClick = (chapter: Chapter) => {
    setEditingChapter(chapter)
    setChapterForm({
      title: chapter.title,
      isFree: chapter.isFree,
      sortOrder: chapter.sortOrder,
    })
  }

  const handleCancelEditChapter = () => {
    setEditingChapter(null)
    setChapterForm({ ...emptyChapterForm, sortOrder: chapters.length + 1 })
  }

  const handleSaveBlock = async () => {
    if (!activeChapterForBlock) return
    try {
      const payload = {
        type: blockForm.type,
        title: blockForm.title,
        content: blockForm.content,
        url: blockForm.url,
        duration: blockForm.duration,
        sortOrder: blockForm.sortOrder,
      }
      if (editingBlock) {
        await api.put(`/admin/blocks/${editingBlock.id}`, payload)
      } else {
        await api.post(`/admin/chapters/${activeChapterForBlock.id}/blocks`, payload)
      }
      setBlockForm({ ...emptyBlockForm })
      setEditingBlock(null)
      await refreshChapters()
    } catch (error) {
      console.error('保存内容块失败:', error)
      alert('保存内容块失败')
    }
  }

  const handleDeleteBlock = async (block: ContentBlock) => {
    if (!confirm(`确定要删除内容块「${block.title || '未命名'}」吗？`)) return
    try {
      await api.delete(`/admin/blocks/${block.id}`)
      await refreshChapters()
    } catch (error) {
      console.error('删除内容块失败:', error)
      alert('删除内容块失败')
    }
  }

  const handleEditBlockClick = (chapter: Chapter, block: ContentBlock) => {
    setActiveChapterForBlock(chapter)
    setEditingBlock(block)
    setBlockForm({
      type: block.type,
      title: block.title,
      content: block.content,
      url: block.url,
      duration: block.duration,
      sortOrder: block.sortOrder,
    })
  }

  const handleAddBlockClick = (chapter: Chapter) => {
    setActiveChapterForBlock(chapter)
    setEditingBlock(null)
    setBlockForm({
      ...emptyBlockForm,
      sortOrder: (chapter.contentBlocks?.length || 0) + 1,
    })
  }

  const handleCancelEditBlock = () => {
    setEditingBlock(null)
    setBlockForm({ ...emptyBlockForm })
  }

  /** 处理本地文件上传（视频/音频/图片） */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 根据当前内容块类型验证文件
    const currentType = blockForm.type
    const isVideo = file.type.startsWith('video/')
    const isAudio = file.type.startsWith('audio/')
    const isImage = file.type.startsWith('image/')

    if (currentType === 'VIDEO' && !isVideo) {
      alert('请选择视频文件（MP4、WebM、MOV）')
      return
    }
    if (currentType === 'AUDIO' && !isAudio) {
      alert('请选择音频文件（MP3、WAV、OGG、M4A）')
      return
    }
    if (currentType === 'IMAGE' && !isImage) {
      alert('请选择图片文件（JPG、PNG、GIF、WebP）')
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const res: any = await api.post('/admin/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const data = res.data?.data || res.data
      if (data?.url) {
        // 设置上传后的 URL 到表单
        setBlockForm((prev) => ({
          ...prev,
          url: data.url,
        }))
        const typeName = currentType === 'VIDEO' ? '视频' : currentType === 'AUDIO' ? '音频' : '图片'
        alert(`${typeName}上传成功！\n文件名: ${data.originalName}\n大小: ${(data.size / 1024 / 1024).toFixed(2)} MB`)
      }
    } catch (error: any) {
      console.error('上传失败:', error)
      alert(error.message || '文件上传失败')
    } finally {
      setUploading(false)
      // 清空 input 值，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  /** 处理封面图片本地上传 */
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件（JPG、PNG、GIF、WebP）')
      return
    }

    try {
      setCoverUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const res: any = await api.post('/admin/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const data = res.data?.data || res.data
      if (data?.url) {
        setFormData((prev) => ({
          ...prev,
          coverImage: data.url,
        }))
        alert(`封面图片上传成功！\n文件名: ${data.originalName}\n大小: ${(data.size / 1024 / 1024).toFixed(2)} MB`)
      }
    } catch (error: any) {
      console.error('上传失败:', error)
      alert(error.message || '图片上传失败')
    } finally {
      setCoverUploading(false)
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = ''
      }
    }
  }

  const filteredCourses = courses.filter(
    (c) => !search || c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">课程管理</h2>
        <Button icon={<Plus size={18} />} onClick={handleCreate}>
          创建课程
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="搜索课程名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<Search size={18} />}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已下架</option>
        </select>
      </div>

      {/* 课程列表 */}
      {loading ? (
        <Loading text="加载课程列表..." />
      ) : filteredCourses.length === 0 ? (
        <Empty title="暂无课程" description="点击上方按钮创建第一个课程" />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>课程名称</th>
                <th>分类</th>
                <th>价格</th>
                <th>章节数</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course) => (
                <tr key={course.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {course.coverImage ? (
                        <img
                          src={course.coverImage}
                          alt={course.title}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                          无图
                        </div>
                      )}
                      <span className="text-gray-900 font-medium">{course.title}</span>
                    </div>
                  </td>
                  <td className="text-gray-600">{course.category?.name || '-'}</td>
                  <td className="text-gray-900 font-medium">{formatPrice(course.price)}</td>
                  <td>
                    <button
                      onClick={() => handleViewChapters(course)}
                      className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 hover:underline"
                      title="查看章节"
                    >
                      <BookOpen size={14} />
                      {course._count?.chapters || 0} 章
                    </button>
                  </td>
                  <td>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getCourseStatusColor(course.status)}`}>
                      {getCourseStatusText(course.status)}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs">{formatDate(course.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(course)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
                        title="编辑"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleViewChapters(course)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        title="章节管理"
                      >
                        <BookOpen size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(course)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 transition-colors"
                        title={course.status === 'published' ? '下架' : '发布'}
                      >
                        {course.status === 'published' ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(course)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 创建/编辑课程弹窗 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCourse ? '编辑课程' : '创建课程'}
        width="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button loading={submitting} onClick={handleSubmit}>
              {editingCourse ? '保存' : '创建'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="课程名称"
            placeholder="请输入课程名称"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">课程描述</label>
            <textarea
              rows={3}
              placeholder="请输入课程描述"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">分类</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">请选择分类</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="价格（元）"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formData.price || ''}
              onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Input
              label="封面图片 URL"
              placeholder="请输入封面图片地址或本地上传"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
            />
            <div className="flex items-center gap-3">
              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleCoverUpload}
                className="hidden"
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<Upload size={14} />}
                loading={coverUploading}
                onClick={() => coverFileInputRef.current?.click()}
              >
                {coverUploading ? '上传中...' : '本地上传封面'}
              </Button>
              {formData.coverImage && formData.coverImage.startsWith('/uploads/') && (
                <span className="text-xs text-green-600">已选择本地封面图片</span>
              )}
              {formData.coverImage && (
                <img
                  src={formData.coverImage}
                  alt="封面预览"
                  className="h-10 w-16 object-cover rounded border border-gray-200"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* 章节管理弹窗 */}
      <Modal
        open={chapterModalOpen}
        onClose={() => {
          setChapterModalOpen(false)
          setViewingCourse(null)
          setChapters([])
          setEditingChapter(null)
          setChapterForm({ ...emptyChapterForm })
          setExpandedChapterIds(new Set())
          setActiveChapterForBlock(null)
          setEditingBlock(null)
          setBlockForm({ ...emptyBlockForm })
        }}
        title={viewingCourse ? `章节管理 - ${viewingCourse.title}` : '章节管理'}
        width="max-w-3xl"
      >
        <div className="space-y-4">
          {/* 添加/编辑章节表单 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-700">
              {editingChapter ? '编辑章节' : '添加章节'}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="章节标题"
                placeholder="请输入章节标题"
                value={chapterForm.title}
                onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
              />
              <Input
                label="排序"
                type="number"
                min="1"
                value={chapterForm.sortOrder}
                onChange={(e) => setChapterForm({ ...chapterForm, sortOrder: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isFree"
                checked={chapterForm.isFree}
                onChange={(e) => setChapterForm({ ...chapterForm, isFree: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isFree" className="text-sm text-gray-700">免费试看</label>
            </div>
            <div className="flex gap-2">
              {editingChapter && (
                <Button variant="secondary" onClick={handleCancelEditChapter}>
                  取消编辑
                </Button>
              )}
              <Button onClick={handleSaveChapter}>
                {editingChapter ? '保存修改' : '添加章节'}
              </Button>
            </div>
          </div>

          {/* 章节列表 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              章节列表 ({chapters.length})
            </h4>
            {chapters.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg">
                暂无章节，请在上方添加
              </div>
            ) : (
              <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                {chapters.map((chapter, index) => {
                  const isExpanded = expandedChapterIds.has(chapter.id)
                  const blockCount = chapter.contentBlocks?.length || 0
                  const isActiveBlockChapter = activeChapterForBlock?.id === chapter.id
                  return (
                    <div
                      key={chapter.id}
                      className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                    >
                      {/* 章节头部 */}
                      <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                        <div
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                          onClick={() => toggleExpandChapter(chapter.id)}
                        >
                          <button className="text-gray-400 hover:text-gray-600">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <span className="text-xs text-gray-400 w-6">{index + 1}</span>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {chapter.title}
                          </span>
                          {chapter.isFree && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">免费</span>
                          )}
                          <span className="text-xs text-gray-400 ml-1">
                            ({blockCount} 个内容块)
                          </span>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleEditChapterClick(chapter)}
                            className="p-1 rounded text-gray-400 hover:text-primary-500 hover:bg-primary-50"
                            title="编辑章节"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteChapter(chapter)}
                            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                            title="删除章节"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* 展开的内容块区域 */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-3 pb-3">
                          {/* 内容块列表 */}
                          {blockCount === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">
                              暂无内容块
                            </div>
                          ) : (
                            <div className="space-y-2 py-2">
                              {chapter.contentBlocks.map((block, bIndex) => (
                                <div
                                  key={block.id}
                                  className="flex items-start justify-between p-2 bg-gray-50 rounded-md"
                                >
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <span className="text-xs text-gray-400 mt-0.5">{bIndex + 1}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-gray-500">{getBlockTypeIcon(block.type)}</span>
                                        <span className="text-xs font-medium text-gray-700">
                                          {getBlockTypeLabel(block.type)}
                                        </span>
                                        <span className="text-sm text-gray-900 truncate">
                                          {block.title || '未命名'}
                                        </span>
                                      </div>
                                      {block.url && (
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                          URL: {block.url}
                                        </p>
                                      )}
                                      {block.content && (
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                          {block.content}
                                        </p>
                                      )}
                                      {block.duration > 0 && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          时长: {block.duration}s
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 ml-2">
                                    <button
                                      onClick={() => handleEditBlockClick(chapter, block)}
                                      className="p-1 rounded text-gray-400 hover:text-primary-500 hover:bg-primary-50"
                                      title="编辑内容块"
                                    >
                                      <Edit size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteBlock(block)}
                                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                                      title="删除内容块"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 添加/编辑内容块表单 */}
                          {isActiveBlockChapter && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200 space-y-3">
                              <h5 className="text-xs font-medium text-gray-700">
                                {editingBlock ? '编辑内容块' : '添加内容块'}
                              </h5>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">类型</label>
                                  <select
                                    value={blockForm.type}
                                    onChange={(e) => setBlockForm({ ...blockForm, type: e.target.value as ContentBlockType })}
                                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                  >
                                    {blockTypeOptions.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <Input
                                  label="排序"
                                  type="number"
                                  min="1"
                                  value={blockForm.sortOrder}
                                  onChange={(e) => setBlockForm({ ...blockForm, sortOrder: Number(e.target.value) })}
                                />
                              </div>
                              <Input
                                label="标题"
                                placeholder="请输入内容块标题"
                                value={blockForm.title}
                                onChange={(e) => setBlockForm({ ...blockForm, title: e.target.value })}
                              />
                              {(blockForm.type === 'VIDEO' || blockForm.type === 'AUDIO') && (
                                <>
                                  <div className="grid grid-cols-2 gap-3">
                                    <Input
                                      label="URL"
                                      placeholder={`请输入${blockForm.type === 'VIDEO' ? '视频' : '音频'}地址`}
                                      value={blockForm.url}
                                      onChange={(e) => setBlockForm({ ...blockForm, url: e.target.value })}
                                    />
                                    <Input
                                      label="时长（秒）"
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={blockForm.duration || ''}
                                      onChange={(e) => setBlockForm({ ...blockForm, duration: Number(e.target.value) })}
                                    />
                                  </div>
                                  {/* 本地上传按钮（视频/音频） */}
                                  <div className="flex items-center gap-3">
                                    <input
                                      ref={fileInputRef}
                                      type="file"
                                      accept={
                                        blockForm.type === 'VIDEO'
                                          ? 'video/mp4,video/webm,video/quicktime'
                                          : 'audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/m4a'
                                      }
                                      onChange={handleFileUpload}
                                      className="hidden"
                                    />
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      icon={<Upload size={14} />}
                                      loading={uploading}
                                      onClick={() => fileInputRef.current?.click()}
                                    >
                                      {uploading ? '上传中...' : `本地上传${blockForm.type === 'VIDEO' ? '视频' : '音频'}`}
                                    </Button>
                                    {blockForm.url && blockForm.url.startsWith('/uploads/') && (
                                      <span className="text-xs text-green-600">
                                        已选择本地{blockForm.type === 'VIDEO' ? '视频' : '音频'}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                              {blockForm.type === 'ARTICLE' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">内容</label>
                                  <textarea
                                    rows={4}
                                    placeholder="请输入文章内容"
                                    value={blockForm.content}
                                    onChange={(e) => setBlockForm({ ...blockForm, content: e.target.value })}
                                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                  />
                                </div>
                              )}
                              {blockForm.type === 'IMAGE' && (
                                <>
                                  <Input
                                    label="图片 URL"
                                    placeholder="请输入图片地址"
                                    value={blockForm.url}
                                    onChange={(e) => setBlockForm({ ...blockForm, url: e.target.value })}
                                  />
                                  {/* 本地上传按钮（图片） */}
                                  <div className="flex items-center gap-3">
                                    <input
                                      ref={fileInputRef}
                                      type="file"
                                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                                      onChange={handleFileUpload}
                                      className="hidden"
                                    />
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      icon={<Upload size={14} />}
                                      loading={uploading}
                                      onClick={() => fileInputRef.current?.click()}
                                    >
                                      {uploading ? '上传中...' : '本地上传图片'}
                                    </Button>
                                    {blockForm.url && blockForm.url.startsWith('/uploads/') && (
                                      <span className="text-xs text-green-600">
                                        已选择本地图片
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">图片描述</label>
                                    <textarea
                                      rows={2}
                                      placeholder="请输入图片描述"
                                      value={blockForm.content}
                                      onChange={(e) => setBlockForm({ ...blockForm, content: e.target.value })}
                                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                    />
                                  </div>
                                </>
                              )}
                              <div className="flex gap-2">
                                {editingBlock && (
                                  <Button variant="secondary" size="sm" onClick={handleCancelEditBlock}>
                                    取消
                                  </Button>
                                )}
                                <Button size="sm" onClick={handleSaveBlock}>
                                  {editingBlock ? '保存修改' : '添加内容块'}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* 添加内容块按钮 */}
                          {!isActiveBlockChapter && (
                            <div className="mt-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Plus size={14} />}
                                onClick={() => handleAddBlockClick(chapter)}
                              >
                                添加内容块
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
