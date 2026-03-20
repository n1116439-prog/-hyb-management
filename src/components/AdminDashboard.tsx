import React, { useState, useEffect } from 'react'
import { Users, DollarSign, Calendar, AlertCircle, Clock, ChevronRight, ChevronDown, ChevronUp, CheckCircle, MapPin, User, CreditCard, TrendingUp } from 'lucide-react'
import { Badge } from './UI'
import { supabase } from '../lib/supabase'

function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins <= 0 ? '剛剛' : mins + ' 分鐘前'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours + ' 小時前'
  const days = Math.floor(hours / 24)
  if (days < 7) return days + ' 天前'
  return dateStr.slice(0, 10)
}

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)

  // Summary
  const [totalStudents, setTotalStudents] = useState(0)
  const [newStudentsThisMonth, setNewStudentsThisMonth] = useState(0)
  const [confirmedRevenue, setConfirmedRevenue] = useState(0)
  const [pendingRevenue, setPendingRevenue] = useState(0)
  const [monthlyClasses, setMonthlyClasses] = useState(0)
  const [activeCourses, setActiveCourses] = useState(0)
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0)
  const [expiringStudentCount, setExpiringStudentCount] = useState(0)

  // Lists
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [expiringCredits, setExpiringCredits] = useState<any[]>([])
  const [todayCourses, setTodayCourses] = useState<any[]>([])
  const [weekCourses, setWeekCourses] = useState<any[]>([])
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([])
  const [showWeek, setShowWeek] = useState(false)

  const now = new Date()
  const todayWeekday = WEEKDAYS[now.getDay()]
  const todayStr = formatLocalDate(now)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([
      fetchSummary(),
      fetchPendingPayments(),
      fetchExpiringCredits(),
      fetchTodayCourses(),
      fetchWeekCourses(),
      fetchRecentEnrollments(),
    ])
    setLoading(false)
  }

  const fetchSummary = async () => {
    // Total students
    const { count: sCount } = await supabase.from('students').select('id', { count: 'exact', head: true })
    setTotalStudents(sCount || 0)

    // New students this month
    const { count: newCount } = await supabase.from('students').select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart + 'T00:00:00')
    setNewStudentsThisMonth(newCount || 0)

    // Confirmed revenue this month
    const { data: confirmedData } = await supabase.from('payments').select('amount')
      .eq('status', 'confirmed')
      .gte('confirmed_at', monthStart + 'T00:00:00')
      .lte('confirmed_at', monthEnd + 'T23:59:59')
    setConfirmedRevenue((confirmedData || []).reduce((s, p) => s + (p.amount || 0), 0))

    // Pending revenue
    const { data: pendingData } = await supabase.from('payments').select('amount').eq('status', 'pending')
    setPendingRevenue((pendingData || []).reduce((s, p) => s + (p.amount || 0), 0))
    setPendingPaymentCount((pendingData || []).length)

    // Monthly classes (distinct date+course_id combos in attendance)
    const { data: attData } = await supabase.from('attendance').select('date, course_id')
      .gte('date', monthStart).lte('date', monthEnd)
    const uniqueClasses = new Set((attData || []).map(a => `${a.date}_${a.course_id}`))
    setMonthlyClasses(uniqueClasses.size)

    // Active courses
    const { count: cCount } = await supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_active', true)
    setActiveCourses(cCount || 0)

    // Expiring credits (within 14 days)
    const in14 = formatLocalDate(new Date(now.getTime() + 14 * 86400000))
    const { count: expCount } = await supabase.from('credits').select('id', { count: 'exact', head: true })
      .eq('status', 'active').lte('expiry_date', in14).gte('expiry_date', todayStr)
    setExpiringStudentCount(expCount || 0)
  }

  const fetchPendingPayments = async () => {
    const { data } = await supabase.from('payments').select('*, students(name, student_code)')
      .eq('status', 'pending').order('created_at', { ascending: false }).limit(5)
    setPendingPayments(data || [])
  }

  const fetchExpiringCredits = async () => {
    const in14 = formatLocalDate(new Date(now.getTime() + 14 * 86400000))
    const { data } = await supabase.from('credits').select('*, students(name, student_code)')
      .eq('status', 'active').lte('expiry_date', in14).gte('expiry_date', todayStr)
      .order('expiry_date').limit(5)
    setExpiringCredits(data || [])
  }

  const fetchTodayCourses = async () => {
    const { data } = await supabase.from('courses').select('*, coaches(name), venues(name)')
      .eq('day_of_week', todayWeekday).eq('is_active', true).order('start_time')

    // Get enrollment counts
    const courseIds = (data || []).map(c => c.id)
    const { data: enrollments } = await supabase.from('enrollments').select('course_id')
      .eq('status', '已報名').in('course_id', courseIds.length > 0 ? courseIds : ['none'])
    const counts: Record<string, number> = {}
    enrollments?.forEach(e => { counts[e.course_id] = (counts[e.course_id] || 0) + 1 })

    setTodayCourses((data || []).map(c => ({ ...c, enrolledCount: counts[c.id] || 0 })))
  }

  const fetchWeekCourses = async () => {
    const { data } = await supabase.from('courses').select('*, coaches(name), venues(name)')
      .eq('is_active', true).order('start_time')
    setWeekCourses(data || [])
  }

  const fetchRecentEnrollments = async () => {
    const sevenDaysAgo = formatLocalDate(new Date(now.getTime() - 7 * 86400000))
    const { data } = await supabase.from('enrollments').select('*, students(name, student_code), courses(name)')
      .gte('enrolled_at', sevenDaysAgo + 'T00:00:00')
      .order('enrolled_at', { ascending: false }).limit(5)
    setRecentEnrollments(data || [])
  }

  const confirmPayment = async (id: string) => {
    await supabase.from('payments').update({
      status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: 'admin'
    }).eq('id', id)
    await fetchPendingPayments()
    await fetchSummary()
  }

  const todoCount = pendingPaymentCount + expiringStudentCount

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Students */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5 cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-students' }))}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Users size={22} />
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-0.5">總學員數</p>
          <p className="text-2xl font-bold text-neutral-900">{totalStudents}</p>
          <p className="text-xs text-neutral-400 mt-1">本月新增 {newStudentsThisMonth} 位</p>
        </div>

        {/* Card 2: Revenue */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5 cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-revenue' }))}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <DollarSign size={22} />
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-0.5">本月營收</p>
          <p className="text-2xl font-bold text-green-600">NT$ {confirmedRevenue.toLocaleString()}</p>
          <p className="text-xs text-neutral-400 mt-1">待確認 NT$ {pendingRevenue.toLocaleString()}</p>
        </div>

        {/* Card 3: Classes */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Calendar size={22} />
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-0.5">本月授課堂數</p>
          <p className="text-2xl font-bold text-neutral-900">{monthlyClasses}</p>
          <p className="text-xs text-neutral-400 mt-1">共 {activeCourses} 門課程</p>
        </div>

        {/* Card 4: Todos */}
        <div className={'bg-white rounded-2xl border p-5 ' + (todoCount > 0 ? 'border-amber-300' : 'border-neutral-100')}>
          <div className="flex items-center gap-3 mb-3">
            <div className={'w-12 h-12 rounded-xl flex items-center justify-center ' + (todoCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-neutral-50 text-neutral-400')}>
              <AlertCircle size={22} />
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-0.5">待處理事項</p>
          <p className={'text-2xl font-bold ' + (todoCount > 0 ? 'text-amber-600' : 'text-neutral-900')}>{todoCount}</p>
          <p className="text-xs text-neutral-400 mt-1">{pendingPaymentCount} 筆付款 / {expiringStudentCount} 位待續約</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Pending Payments */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-neutral-900">待確認付款</h3>
                {pendingPayments.length > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{pendingPaymentCount}</span>
                )}
              </div>
              <button onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-revenue' }))}
                className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                查看全部 <ChevronRight size={14} />
              </button>
            </div>
            <div className="p-5">
              {pendingPayments.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">所有付款已確認</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {p.students?.name?.[0] || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm text-neutral-900 truncate">{p.students?.name || '—'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{p.students?.student_code || ''}</span>
                          </div>
                          <p className="text-xs text-neutral-400">{getRelativeTime(p.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-sm text-primary">NT$ {(p.amount || 0).toLocaleString()}</span>
                        <button onClick={() => confirmPayment(p.id)}
                          className="px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                          確認
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Expiring Credits */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-neutral-900">堂數即將到期</h3>
                {expiringCredits.length > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">{expiringStudentCount}</span>
                )}
              </div>
            </div>
            <div className="p-5">
              {expiringCredits.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">目前沒有即將到期的學員</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expiringCredits.map(c => {
                    const daysLeft = Math.ceil((new Date(c.expiry_date).getTime() - now.getTime()) / 86400000)
                    const urgent = daysLeft <= 7
                    return (
                      <div key={c.id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ' + (urgent ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')}>
                            {c.students?.name?.[0] || '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm">{c.students?.name || '—'}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{c.students?.student_code || ''}</span>
                            </div>
                            <p className="text-xs text-neutral-400">
                              剩餘 {(c.total_credits || 0) - (c.used_credits || 0)} / {c.total_credits || 0} 堂
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={'text-xs font-bold ' + (urgent ? 'text-red-500' : 'text-amber-600')}>
                            {daysLeft} 天後到期
                          </p>
                          <p className="text-[10px] text-neutral-400">{c.expiry_date}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Today's Schedule */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-neutral-900">今日課表</h3>
                <span className="text-xs text-neutral-400">{todayStr} {todayWeekday}</span>
              </div>
            </div>
            <div className="p-5">
              {todayCourses.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={32} className="text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">今日無課程</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayCourses.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-neutral-900">{c.name}</p>
                        <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5">
                          <span className="flex items-center gap-1"><Clock size={12} /> {c.start_time?.slice(0, 5)}-{c.end_time?.slice(0, 5)}</span>
                          <span className="flex items-center gap-1"><User size={12} /> {c.coaches?.name || '—'}</span>
                          <span className="flex items-center gap-1"><MapPin size={12} /> {c.venues?.name || '—'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-neutral-500">{c.enrolledCount}/{c.max_students || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Week toggle */}
              <button onClick={() => setShowWeek(!showWeek)}
                className="w-full mt-3 py-2 text-sm text-neutral-500 hover:text-primary flex items-center justify-center gap-1 transition-colors">
                {showWeek ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showWeek ? '收合本週課表' : '展開本週課表'}
              </button>

              {showWeek && (
                <div className="mt-3 space-y-4 border-t border-neutral-100 pt-4">
                  {WEEKDAYS.map(day => {
                    const dayCourses = weekCourses.filter(c => c.day_of_week === day)
                    if (dayCourses.length === 0) return null
                    return (
                      <div key={day}>
                        <p className={'text-xs font-bold mb-1.5 ' + (day === todayWeekday ? 'text-primary' : 'text-neutral-400')}>{day}</p>
                        <div className="space-y-1.5">
                          {dayCourses.map(c => (
                            <div key={c.id} className="flex items-center justify-between text-sm px-3 py-2 bg-neutral-50 rounded-lg">
                              <span className="text-neutral-700">{c.name}</span>
                              <span className="text-xs text-neutral-400">{c.start_time?.slice(0, 5)}-{c.end_time?.slice(0, 5)} · {c.venues?.name || ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Enrollments */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900">近期報名</h3>
              <button onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-students' }))}
                className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                查看全部 <ChevronRight size={14} />
              </button>
            </div>
            <div className="p-5">
              {recentEnrollments.length === 0 ? (
                <div className="text-center py-8">
                  <Users size={32} className="text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">近 7 天無新報名</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEnrollments.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {e.students?.name?.[0] || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm">{e.students?.name || '—'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{e.students?.student_code || ''}</span>
                          </div>
                          <p className="text-xs text-neutral-400">{e.courses?.name || '—'}</p>
                        </div>
                      </div>
                      <span className="text-xs text-neutral-400 shrink-0">{getRelativeTime(e.enrolled_at || e.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
