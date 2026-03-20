import React, { useState, useEffect } from 'react';
import { Calendar, Phone, Check, X, RefreshCw, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

type StatusFilter = '全部' | '待確認' | '已確認' | '已試上' | '已取消'

export const AdminTrialManagement: React.FC<{ courses?: any[] }> = ({ courses: propCourses }) => {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('全部')
  const [allCourses, setAllCourses] = useState<any[]>([])

  // 編輯狀態
  const [editingDateId, setEditingDateId] = useState<string | null>(null)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [editDateValue, setEditDateValue] = useState('')
  const [editCourseValue, setEditCourseValue] = useState('')

  // 代理報名 modal
  const [enrollModalBooking, setEnrollModalBooking] = useState<any>(null)
  const [enrollCredits, setEnrollCredits] = useState(8)
  const [enrolling, setEnrolling] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  const fetchBookings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('trial_bookings')
      .select('*, students(id, name, phone, student_code, student_number), courses(id, name, day_of_week, start_time, end_time, venues(name))')
      .order('created_at', { ascending: false })
    console.log('trial_bookings data:', data, 'error:', error)
    setBookings(data || [])
    setLoading(false)
  }

  const fetchCourses = async () => {
    if (propCourses && propCourses.length > 0) {
      setAllCourses(propCourses)
      return
    }
    const { data } = await supabase.from('courses').select('id, name, day_of_week, start_time, end_time').order('name')
    setAllCourses(data || [])
  }

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('course_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (data) setPlans(data)
  }

  useEffect(() => {
    fetchBookings()
    fetchCourses()
    fetchPlans()
  }, [])

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('trial_bookings').update({ status }).eq('id', id)
    if (error) { alert('更新失敗：' + error.message); return }
    await fetchBookings()
  }

  const saveDate = async (id: string) => {
    if (!editDateValue) return
    const { error } = await supabase.from('trial_bookings').update({ trial_date: editDateValue }).eq('id', id)
    if (error) { alert('更新失敗：' + error.message); return }
    setEditingDateId(null)
    setEditDateValue('')
    await fetchBookings()
  }

  const saveCourse = async (id: string) => {
    if (!editCourseValue) return
    const { error } = await supabase.from('trial_bookings').update({ course_id: editCourseValue }).eq('id', id)
    if (error) { alert('更新失敗：' + error.message); return }
    setEditingCourseId(null)
    setEditCourseValue('')
    await fetchBookings()
  }

  const handleEnroll = async () => {
    if (!enrollModalBooking || enrollCredits <= 0) return
    setEnrolling(true)

    const studentId = enrollModalBooking.student_id
    const courseId = enrollModalBooking.course_id

    // 1. insert enrollment
    const { error: enrollErr } = await supabase.from('enrollments').insert({
      student_id: studentId,
      course_id: courseId,
      status: '已報名',
    })
    if (enrollErr) {
      if (enrollErr.code === '23505') {
        alert('此學員已報名過此課程')
      } else {
        alert('報名失敗：' + enrollErr.message)
      }
      setEnrolling(false)
      return
    }

    // 2. insert credits
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 12 * 7)
    const { data: creditRow, error: creditErr } = await supabase.from('credits').insert({
      student_id: studentId,
      total_credits: enrollCredits,
      used_credits: 0,
      leave_count: 0,
      max_leave: 4,
      plan_weeks: 12,
      plan_name: '正式報名',
      purchase_date: formatLocalDate(new Date()),
      expiry_date: formatLocalDate(expiryDate),
      status: 'active',
    }).select('id').single()

    if (creditErr) {
      alert('建立堂數失敗：' + creditErr.message)
      setEnrolling(false)
      return
    }

    // 3. 建立 attendance 已劃位記錄
    const course = enrollModalBooking.courses
    const dayMap: Record<string, number> = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 }
    const targetDay = course ? dayMap[course.day_of_week] : undefined

    if (targetDay !== undefined) {
      const { data: holidayData } = await supabase
        .from('course_holidays')
        .select('date')
        .or(`course_id.eq.${courseId},course_id.is.null`)
      const holidaySet = new Set((holidayData || []).map((h: any) => h.date))

      const current = new Date()
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1)
      }

      const dates: string[] = []
      while (dates.length < enrollCredits) {
        const dateStr = formatLocalDate(current)
        if (!holidaySet.has(dateStr)) {
          dates.push(dateStr)
        }
        current.setDate(current.getDate() + 7)
      }

      if (dates.length > 0) {
        const inserts = dates.map(date => ({
          student_id: studentId,
          course_id: courseId,
          date,
          status: '已劃位',
          deducted: false,
          credit_id: creditRow?.id || null,
        }))
        await supabase.from('attendance').insert(inserts)
      }

      // sync credits from attendance count
      const { count: totalCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', studentId)
      const { count: usedCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', studentId).eq('deducted', true)
      if (creditRow?.id) {
        await supabase.from('credits').update({
          total_credits: totalCount || 0,
          used_credits: usedCount || 0,
        }).eq('id', creditRow.id)
      }
    }

    // 4. update trial_bookings status
    await supabase.from('trial_bookings').update({ status: '已試上' }).eq('id', enrollModalBooking.id)

    alert('報名成功！')
    setEnrollModalBooking(null)
    setEnrollCredits(8)
    setEnrolling(false)
    await fetchBookings()
  }

  const filtered = statusFilter === '全部' ? bookings : bookings.filter(b => b.status === statusFilter)

  const statusColors: Record<string, string> = {
    '待確認': 'bg-yellow-100 text-yellow-700',
    '已確認': 'bg-blue-100 text-blue-700',
    '已試上': 'bg-green-100 text-green-700',
    '已取消': 'bg-neutral-100 text-neutral-500',
  }

  const tabs: StatusFilter[] = ['全部', '待確認', '已確認', '已試上', '已取消']

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="animate-spin text-primary" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 狀態篩選 */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              statusFilter === tab
                ? 'bg-primary text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {tab}
            {tab !== '全部' && (
              <span className="ml-1 text-xs">({bookings.filter(b => b.status === tab).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <Calendar className="mx-auto mb-3" size={32} />
          <p className="text-sm">目前沒有試上預約紀錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(booking => {
            const student = booking.students
            const course = booking.courses
            const trialDate = booking.trial_date
            const d = trialDate ? new Date(trialDate + 'T00:00:00') : null
            const weekday = d ? `週${weekdays[d.getDay()]}` : ''

            return (
              <div key={booking.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                {/* 上方資訊 */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-neutral-900">{student?.name || '未知學員'}</p>
                      <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                        {student?.student_code || student?.student_number || '未編號'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-neutral-500">
                      {student?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {student.phone}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-700">
                      {course?.name || '未知課程'}
                      {course?.start_time && ` · ${course.start_time.slice(0, 5)}-${course.end_time?.slice(0, 5)}`}
                      {course?.venues?.name && ` · ${course.venues.name}`}
                    </p>
                    <p className="text-sm font-medium text-primary">
                      <Calendar size={14} className="inline mr-1" />
                      {trialDate || '未選日期'} {weekday}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[booking.status] || 'bg-neutral-100 text-neutral-500'}`}>
                    {booking.status}
                  </span>
                </div>

                {/* 編輯區 */}
                {editingDateId === booking.id && (
                  <div className="flex items-center gap-2 bg-neutral-50 rounded-xl p-3">
                    <input
                      type="date"
                      value={editDateValue}
                      onChange={e => setEditDateValue(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                    <button onClick={() => saveDate(booking.id)} className="px-3 py-2 bg-primary text-white rounded-lg text-sm">儲存</button>
                    <button onClick={() => setEditingDateId(null)} className="px-3 py-2 bg-neutral-200 text-neutral-600 rounded-lg text-sm">取消</button>
                  </div>
                )}

                {editingCourseId === booking.id && (
                  <div className="flex items-center gap-2 bg-neutral-50 rounded-xl p-3">
                    <select
                      value={editCourseValue}
                      onChange={e => setEditCourseValue(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">選擇班級</option>
                      {allCourses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button onClick={() => saveCourse(booking.id)} className="px-3 py-2 bg-primary text-white rounded-lg text-sm">儲存</button>
                    <button onClick={() => setEditingCourseId(null)} className="px-3 py-2 bg-neutral-200 text-neutral-600 rounded-lg text-sm">取消</button>
                  </div>
                )}

                {/* 操作按鈕 */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setEditingDateId(booking.id); setEditDateValue(booking.trial_date || '') }}
                    className="px-3 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors"
                  >
                    更換日期
                  </button>
                  <button
                    onClick={() => { setEditingCourseId(booking.id); setEditCourseValue(booking.course_id || '') }}
                    className="px-3 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors"
                  >
                    更換班級
                  </button>
                  {booking.status === '待確認' && (
                    <button
                      onClick={() => updateStatus(booking.id, '已確認')}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                      <Check size={12} /> 確認試上
                    </button>
                  )}
                  {(booking.status === '已確認' || booking.status === '待確認') && (
                    <button
                      onClick={() => updateStatus(booking.id, '已試上')}
                      className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
                    >
                      <Check size={12} /> 標記已試上
                    </button>
                  )}
                  {booking.status !== '已取消' && (
                    <button
                      onClick={() => updateStatus(booking.id, '已取消')}
                      className="px-3 py-1.5 text-xs font-medium bg-neutral-50 text-neutral-500 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      <X size={12} /> 取消
                    </button>
                  )}
                  {(booking.status === '已確認' || booking.status === '已試上') && (
                    <button
                      onClick={() => { setEnrollModalBooking(booking); setEnrollCredits(8); setSelectedPlanId('') }}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1"
                    >
                      <UserPlus size={12} /> 代理報名
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 代理報名 Modal */}
      {enrollModalBooking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setEnrollModalBooking(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-neutral-900">代理報名</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-neutral-500">學員：</span>{enrollModalBooking.students?.name}</p>
              <p><span className="text-neutral-500">班級：</span>{enrollModalBooking.courses?.name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">選擇方案</label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {plans.map(plan => {
                  const isSelected = selectedPlanId === plan.id
                  return (
                    <button
                      key={plan.id}
                      onClick={() => { setSelectedPlanId(plan.id); setEnrollCredits(plan.sessions) }}
                      className={'w-full p-3 rounded-xl border-2 text-left transition-all ' + (isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-neutral-200 hover:border-neutral-300')}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-neutral-900">{plan.name}</p>
                          <p className="text-xs text-neutral-500">{plan.sessions} 堂 · {plan.description || ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">NT$ {(plan.price_per_session * plan.sessions).toLocaleString()}</p>
                          <p className="text-xs text-neutral-400">{plan.price_per_session}/堂</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEnroll}
                disabled={enrolling || !selectedPlanId}
                className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {enrolling ? '處理中...' : '確認報名'}
              </button>
              <button
                onClick={() => setEnrollModalBooking(null)}
                className="px-6 py-3 bg-neutral-100 text-neutral-600 font-medium rounded-xl hover:bg-neutral-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
