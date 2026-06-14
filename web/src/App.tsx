import React, { useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import Loading from '@/components/ui/Loading'
import AdminLayout from '@/components/Layout'
import StudentLayout from '@/pages/student/Layout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/admin/Dashboard'
import Courses from '@/pages/admin/Courses'
import Users from '@/pages/admin/Users'
import Orders from '@/pages/admin/Orders'
import Categories from '@/pages/admin/Categories'
import CourseList from '@/pages/student/CourseList'
import CourseDetail from '@/pages/student/CourseDetail'
import MyCourses from '@/pages/student/MyCourses'
import MyOrders from '@/pages/student/MyOrders'
import Profile from '@/pages/student/Profile'

function PrivateRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { token, user, fetchUser } = useAuthStore()

  useEffect(() => {
    if (token && !user) {
      fetchUser()
    }
  }, [token, user, fetchUser])

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && user && user.role !== 'ADMIN') {
    return <Navigate to="/student" replace />
  }

  if (token && !user) {
    return <Loading />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 管理后台路由 */}
      <Route
        path="/admin"
        element={
          <PrivateRoute adminOnly>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="courses" element={<Courses />} />
        <Route path="users" element={<Users />} />
        <Route path="orders" element={<Orders />} />
        <Route path="categories" element={<Categories />} />
      </Route>

      {/* 学员端路由 */}
      <Route
        path="/student"
        element={
          <PrivateRoute>
            <StudentLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/student/courses" replace />} />
        <Route path="courses" element={<CourseList />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="my-courses" element={<MyCourses />} />
        <Route path="my-orders" element={<MyOrders />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* 默认重定向 */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
