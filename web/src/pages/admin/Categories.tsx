import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/ui/Loading'
import Empty from '@/components/ui/Empty'

interface Category {
  id: string
  name: string
  description: string
  courseCount?: number
  createdAt: string
}

const emptyCategory = { name: '', description: '' }

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState(emptyCategory)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const res: any = await api.get('/admin/categories')
      const responseData = res.data || res
      setCategories(Array.isArray(responseData) ? responseData : [])
    } catch (error) {
      console.error('获取分类列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingCategory(null)
    setFormData(emptyCategory)
    setModalOpen(true)
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({ name: category.name, description: category.description })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      if (editingCategory) {
        await api.put(`/admin/categories/${editingCategory.id}`, formData)
      } else {
        await api.post('/admin/categories', formData)
      }
      setModalOpen(false)
      fetchCategories()
    } catch (error) {
      console.error('保存分类失败:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定要删除该分类吗？删除后不可恢复。')) return
    try {
      await api.delete(`/admin/categories/${id}`)
      fetchCategories()
    } catch (error) {
      console.error('删除分类失败:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">分类管理</h2>
        <Button icon={<Plus size={18} />} onClick={handleCreate}>
          创建分类
        </Button>
      </div>

      {/* 分类列表 */}
      {loading ? (
        <Loading text="加载分类列表..." />
      ) : categories.length === 0 ? (
        <Empty title="暂无分类" description="点击上方按钮创建第一个分类" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{category.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{category.description || '暂无描述'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
                    title="编辑"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {category.courseCount !== undefined && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    {category.courseCount} 门课程
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 创建/编辑弹窗 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? '编辑分类' : '创建分类'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button loading={submitting} onClick={handleSubmit}>
              {editingCategory ? '保存' : '创建'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="分类名称"
            placeholder="请输入分类名称"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">分类描述</label>
            <textarea
              rows={3}
              placeholder="请输入分类描述（可选）"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
