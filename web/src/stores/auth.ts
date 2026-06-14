import { create } from 'zustand'
import api from '@/lib/api'

interface User {
  id: string
  email: string
  name: string
  avatar: string | null
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAdmin: false,

  login: async (email: string, password: string) => {
    const res: any = await api.post('/auth/login', { email, password })
    const responseData = res.data?.data || res.data || res
    const { token, user } = responseData
    localStorage.setItem('token', token)
    set({
      token,
      user,
      isAdmin: user.role === 'ADMIN',
    })
  },

  register: async (email: string, password: string, name: string) => {
    const res: any = await api.post('/auth/register', { email, password, name })
    const responseData = res.data?.data || res.data || res
    const { token, user } = responseData
    localStorage.setItem('token', token)
    set({
      token,
      user,
      isAdmin: user.role === 'ADMIN',
    })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({
      user: null,
      token: null,
      isAdmin: false,
    })
  },

  fetchUser: async () => {
    try {
      const res: any = await api.get('/auth/me')
      // 后端返回 { success, data: { user: {...} }, message }
      // axios interceptor 已解包一层，res = { success, data: { user: {...} }, message }
      const responseData = res.data?.user || res.data?.data || res.data || res
      set({
        user: responseData,
        isAdmin: responseData?.role === 'ADMIN',
      })
    } catch {
      localStorage.removeItem('token')
      set({
        user: null,
        token: null,
        isAdmin: false,
      })
    }
  },
}))
