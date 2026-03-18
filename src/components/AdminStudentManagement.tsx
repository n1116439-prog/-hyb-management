import React, { useState, useEffect } from 'react';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

import {
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye,
  Check,
  Download,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  User,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Clock,
  History,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Input, Select, Badge, ProgressBar, FormField } from './UI';
import { supabase } from '../lib/supabase';
import { Session, SessionUsage, WaitlistEntry } from '../types';

export const AdminStudentManagement: React.FC<{
  waitlists?: WaitlistEntry[];
}> = ({ waitlists = [] }) => {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStudents = async () => {
    setLoading(true)

    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })

    console.log('學員原始資料:', studentsData)
    if (!studentsData) { setLoading(false); return }

    const { data: enrollmentsData } = await supabase
      .from('enrollments')
      .select('student_id, course_id, status, courses(name)')
      .eq('status', '已報名')

    const { data: creditsData } = await supabase
      .from('credits')
      .select('student_id, total_credits, used_credits, remaining_credits')

    const { data: paymentsData } = await supabase
      .from('payments')
      .select('student_id, amount, payment_date')

    setStudents(studentsData.map(s => {
      const studentEnrollments = enrollmentsData?.filter((e: any) => e.student_id === s.id) || []
      const studentCredits = creditsData?.filter((c: any) => c.student_id === s.id) || []
      const studentPayments = paymentsData?.filter((p: any) => p.student_id === s.id) || []
      const totalPaid = studentPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

      return {
        id: s.id,
        studentName: s.name || '',
        phone: s.phone || '',
        email: s.email || '',
        gender: s.gender || '',
        birthDate: s.birth_date || '',
        school: s.school || '',
        category: s.category || 'child',
        emergencyContact: s.emergency_contact || '',
        emergencyPhone: s.emergency_phone || '',
        notes: s.notes || '',
        parentUid: s.parent_uid || '',
        studentNumber: s.student_number || s.student_code || '',
        studentCode: s.student_code || s.student_number || '',
        createdAt: s.created_at || '',
        // 報名班級
        courses: studentEnrollments.map((e: any) => (e.courses as any)?.name || '').filter(Boolean),
        coursesDisplay: studentEnrollments.map((e: any) => (e.courses as any)?.name || '').filter(Boolean).join('、') || '未報名',
        // 堂數
        totalCredits: studentCredits.reduce((sum: number, c: any) => sum + (c.total_credits || 0), 0),
        usedCredits: studentCredits.reduce((sum: number, c: any) => sum + (c.used_credits || 0), 0),
        remainingCredits: studentCredits.reduce((sum: number, c: any) => sum + (c.remaining_credits || 0), 0),
        // 繳費狀態
        paymentStatus: totalPaid > 0 ? '已繳費' : '尚未繳費',
        totalPaid,
      }
    }))
    setLoading(false)
  }

  useEffect(() => {
    fetchStudents()
    fetchAllCourses()
  }, [])

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [categoryTab, setCategoryTab] = useState('所有學員');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [usageHistory, setUsageHistory] = useState<any[]>([])

  const [showCreditModal, setShowCreditModal] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [operatingStudent, setOperatingStudent] = useState<any>(null)
  const [creditAction, setCreditAction] = useState<'add' | 'subtract'>('add')
  const [creditAmount, setCreditAmount] = useState(1)
  const [creditReason, setCreditReason] = useState('')
  const [allCourses, setAllCourses] = useState<any[]>([])
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([])
  const [studentCreditsDetail, setStudentCreditsDetail] = useState<any[]>([])
  const [detailTab, setDetailTab] = useState<'classes' | 'dates'>('classes')
  const [courseAttendanceMap, setCourseAttendanceMap] = useState<Record<string, any[]>>({})
  const [courseHolidays, setCourseHolidays] = useState<any[]>([])
  const [addingDateCourseId, setAddingDateCourseId] = useState<string | null>(null)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedNewDates, setSelectedNewDates] = useState<string[]>([])
  const [loadingDates, setLoadingDates] = useState(false)

  const fetchStudentAttendance = async (studentId: string) => {
    const { data } = await supabase
      .from('attendance')
      .select('id, date, status, deducted, courses(name, time, venues(name))')
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .limit(50)
    setUsageHistory((data || []).map((a: any) => ({
      id: a.id,
      date: a.date,
      status: a.status,
      deducted: a.deducted,
      courseName: (a.courses as any)?.name || '',
      courseTime: (a.courses as any)?.time || '',
      location: (a.courses as any)?.venues?.name || '',
    })))
  }

  const fetchAllCourses = async () => {
    const { data } = await supabase.from('courses').select('id, name, category, day_of_week, start_time, end_time, venue_id, venues(name)')
    if (data) setAllCourses(data)
  }

  const fetchStudentDetail = async (studentId: string) => {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*, courses(id, name, day_of_week, start_time, end_time, venues(name))')
      .eq('student_id', studentId)
    setStudentEnrollments(enrollments || [])

    const { data: credits } = await supabase
      .from('credits')
      .select('*')
      .eq('student_id', studentId)
    setStudentCreditsDetail(credits || [])
  }

  const fetchCourseAttendance = async (studentId: string) => {
    // 直接從 DB 查，不依賴 state
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id, status')
      .eq('student_id', studentId)
      .eq('status', '已報名')

    if (!enrollments || enrollments.length === 0) {
      setCourseAttendanceMap({})
      return
    }

    const map: Record<string, any[]> = {}
    for (const enrollment of enrollments) {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .eq('course_id', enrollment.course_id)
        .order('date')
      console.log('課程', enrollment.course_id, 'attendance:', data)
      map[enrollment.course_id] = data || []
    }
    setCourseAttendanceMap(map)
  }

  const fetchHolidays = async () => {
    const { data } = await supabase.from('course_holidays').select('*')
    setCourseHolidays(data || [])
  }

  const dayOfWeekToNumber = (dow: string): number => {
    const map: Record<string, number> = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 }
    return map[dow] ?? -1
  }

  const computeAvailableDates = async (courseId: string, studentId: string) => {
    setLoadingDates(true)
    setAvailableDates([])
    setSelectedNewDates([])

    // Get course info
    const course = allCourses.find((c: any) => c.id === courseId)
    if (!course) { setLoadingDates(false); return }

    const targetDay = dayOfWeekToNumber(course.day_of_week)
    if (targetDay < 0) { setLoadingDates(false); return }

    // Try to get venue_contract date range
    let startDate = new Date()
    let endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 6)

    if (course.venue_id) {
      const { data: contracts } = await supabase
        .from('venue_contracts')
        .select('start_date, end_date')
        .eq('venue_id', course.venue_id)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1)
      if (contracts && contracts.length > 0) {
        const contractEnd = new Date(contracts[0].end_date + 'T00:00:00')
        if (contractEnd > endDate) endDate = contractEnd
        // Don't go before today
      }
    }

    // Get holidays for this course
    const { data: holidays } = await supabase
      .from('course_holidays')
      .select('date')
      .eq('course_id', courseId)
    const holidayDates = new Set((holidays || []).map((h: any) => h.date))

    // Get existing attendance dates
    const existingDates = new Set((courseAttendanceMap[courseId] || []).map((a: any) => a.date))

    // Generate available dates
    const dates: string[] = []
    const current = new Date()
    // Start from today, find next matching day_of_week
    while (current.getDay() !== targetDay) {
      current.setDate(current.getDate() + 1)
    }

    while (current <= endDate && dates.length < 26) {
      const dateStr = formatLocalDate(current)
      if (!holidayDates.has(dateStr) && !existingDates.has(dateStr)) {
        dates.push(dateStr)
      }
      current.setDate(current.getDate() + 7)
    }

    setAvailableDates(dates)
    setLoadingDates(false)
  }

  const handleAddAttendanceDates = async (courseId: string, studentId: string) => {
    if (selectedNewDates.length === 0) return
    const inserts = selectedNewDates.map(date => ({
      student_id: studentId,
      course_id: courseId,
      date,
      status: '待上課',
      deducted: false,
    }))
    const { error } = await supabase.from('attendance').insert(inserts)
    if (error) {
      alert('新增失敗：' + error.message)
      return
    }
    alert(`已新增 ${selectedNewDates.length} 個上課日期`)
    setAddingDateCourseId(null)
    setSelectedNewDates([])
    setAvailableDates([])
    // Refresh data
    await fetchCourseAttendance(studentId)
    fetchStudentAttendance(studentId)
  }

  const handleDeleteAttendance = async (attendanceId: string, studentId: string) => {
    if (!confirm('確定要刪除此待上課日期？')) return
    const { error } = await supabase.from('attendance').delete().eq('id', attendanceId)
    if (error) {
      alert('刪除失敗：' + error.message)
      return
    }
    await fetchCourseAttendance(studentId)
    fetchStudentAttendance(studentId)
  }

  const handleCreditChange = async () => {
    if (!operatingStudent || creditAmount <= 0) return

    // 從資料庫即時讀取最新 credits
    const { data: credits } = await supabase
      .from('credits')
      .select('*')
      .eq('student_id', operatingStudent.id)
      .eq('status', 'active')

    const credit = credits?.[0]

    if (!credit && creditAction === 'subtract') {
      alert('該學員沒有可用堂數')
      return
    }

    if (credit) {
      const updateData: any = {}
      if (creditAction === 'add') {
        updateData.total_credits = credit.total_credits + creditAmount
      } else {
        updateData.used_credits = (credit.used_credits || 0) + creditAmount
      }

      const { error } = await supabase.from('credits').update(updateData).eq('id', credit.id)

      if (error) {
        alert('更新失敗：' + error.message)
        return
      }
    } else {
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + 12 * 7)

      const { error } = await supabase.from('credits').insert({
        student_id: operatingStudent.id,
        total_credits: creditAmount,
        used_credits: 0,
        leave_count: 0,
        max_leave: 4,
        plan_weeks: 12,
        expiry_date: formatLocalDate(expiryDate),
        status: 'active',
      })

      if (error) {
        alert('新增失敗：' + error.message)
        return
      }
    }

    // 寫入操作日誌
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      user_id: user?.id || null,
      user_email: user?.email || 'admin',
      action: creditAction === 'add' ? '管理員加堂' : '管理員減堂',
      table_name: 'credits',
      record_id: credit?.id || null,
      old_data: credit ? { remaining: credit.remaining_credits, total: credit.total_credits } : null,
      new_data: {
        amount: creditAmount,
        reason: creditReason,
        action: creditAction,
      },
    })

    alert(`${creditAction === 'add' ? '加' : '減'} ${creditAmount} 堂成功！`)

    setShowCreditModal(false)
    setCreditAmount(1)
    setCreditReason('')
    setOperatingStudent(null)

    // 重新載入學員資料
    await fetchStudents()
  }

  const handleEnrollCourse = async (courseId: string) => {
    if (!operatingStudent) return

    const existing = studentEnrollments.find((e: any) => e.course_id === courseId && e.status === '已報名')
    if (existing) {
      alert('該學員已報名此班級')
      return
    }

    const hasCredits = studentCreditsDetail.some((c: any) => c.status === 'active' && c.remaining_credits > 0)
    if (!hasCredits) {
      alert('該學員沒有可用堂數，請先加堂')
      return
    }

    await supabase.from('enrollments').insert({
      student_id: operatingStudent.id,
      course_id: courseId,
      status: '已報名',
    })

    alert('劃位成功')
    fetchStudentDetail(operatingStudent.id)
    fetchStudents()
  }

  const handleTransfer = async (fromEnrollmentId: string, toCourseId: string) => {
    if (!operatingStudent) return

    await supabase.from('enrollments').update({
      status: '已退出',
      withdrawn_at: new Date().toISOString(),
    }).eq('id', fromEnrollmentId)

    await supabase.from('enrollments').insert({
      student_id: operatingStudent.id,
      course_id: toCourseId,
      status: '已報名',
    })

    alert('轉班成功')
    fetchStudentDetail(operatingStudent.id)
    fetchStudents()
  }

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student)
    fetchStudentAttendance(student.id)
    fetchStudentDetail(student.id)
  }

  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchSearch = s.studentName.toLowerCase().includes(q) ||
                        (s.coursesDisplay || '').toLowerCase().includes(q) ||
                        (s.phone || '').toLowerCase().includes(q) ||
                        (s.studentCode || '').toLowerCase().includes(q) ||
                        (s.studentNumber || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'paid' && s.paymentStatus === '已繳費') ||
      (filterStatus === 'unpaid' && s.paymentStatus === '尚未繳費');

    let matchCategory = true;
    if (categoryTab === '已參加') {
      matchCategory = s.courses.length > 0;
    } else if (categoryTab === '未參加') {
      matchCategory = s.courses.length === 0;
    } else if (categoryTab === '新註冊') {
      const created = new Date(s.createdAt || '');
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      matchCategory = created > weekAgo;
    }

    return matchSearch && matchStatus && matchCategory;
  });

  const handleConfirmPayment = (id: string) => {
    // TODO: integrate with payments table
    setStudents(prev => prev.map(s => s.id === id ? { ...s, paymentStatus: '已繳費' } : s));
    if (selectedStudent?.id === id) {
      setSelectedStudent(prev => prev ? { ...prev, paymentStatus: '已繳費' } : null);
    }
  };

  const handleStartEdit = (student: any) => {
    setEditForm(student);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.id) return;
    const { error } = await supabase.from('students').update({
      name: editForm.studentName,
      phone: editForm.phone,
      email: editForm.email,
      gender: editForm.gender,
      birth_date: editForm.birthDate,
      school: editForm.school,
      emergency_contact: editForm.emergencyContact,
      emergency_phone: editForm.emergencyPhone,
      notes: editForm.notes,
    }).eq('id', editForm.id)
    if (!error) await fetchStudents()
    setSelectedStudent(prev => prev ? { ...prev, ...editForm } : null);
    setIsEditing(false);
  };

  const handleDeleteStudent = async (id: string) => {
    if (confirm('確定要刪除此學員紀錄嗎？')) {
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (!error) await fetchStudents()
      if (selectedStudent?.id === id) setSelectedStudent(null);
    }
  };

  const handleExportStudents = () => {
    alert('正在匯出學員名單...');
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-neutral-100">
            <Button variant="ghost" className="h-auto p-0 text-neutral-400">儀表板</Button>
            <div className="w-1 h-1 bg-neutral-300 rounded-full" />
            <Button variant="ghost" className="h-auto p-0 text-primary font-bold">學員管理</Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="w-auto h-12 px-6 rounded-2xl border-neutral-200 text-neutral-600 bg-white"
            onClick={handleExportStudents}
          >
            <Download size={18} />
            匯出名單
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['所有學員', '已參加', '未參加', '新註冊'].map(tab => (
          <button
            key={tab}
            onClick={() => setCategoryTab(tab)}
            className={`whitespace-nowrap px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
              categoryTab === tab 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-white text-neutral-500 hover:bg-neutral-50 border border-neutral-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <Input 
            placeholder="搜尋學員姓名、聯絡電話..." 
            className="pl-12 h-14 bg-white border-neutral-100 shadow-sm rounded-2xl"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Select 
            className="h-14 bg-white border-neutral-100 shadow-sm rounded-2xl px-6 min-w-[140px]"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">所有狀態</option>
            <option value="paid">已繳費</option>
            <option value="unpaid">未繳費</option>
          </Select>
          <Button variant="ghost" className="h-14 w-14 bg-white border border-neutral-100 shadow-sm rounded-2xl p-0">
            <Filter size={20} />
          </Button>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-[32px] shadow-sm border border-neutral-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-50">
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">學員編號</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">學員資訊</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">報名班級</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">剩餘堂數</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">繳費狀態</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {filteredStudents.map(student => (
              <tr key={student.id} className="hover:bg-neutral-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <span className={`text-sm font-bold ${
                    (student.studentCode || student.studentNumber)?.startsWith('ST')
                      ? 'text-blue-600'
                      : 'text-green-600'
                  }`}>
                    {student.studentCode || student.studentNumber || '未編號'}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {student.studentName[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 leading-tight">{student.studentName}</h4>
                      <p className="text-xs text-neutral-400">{student.phone || '未填寫'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <p className="text-sm font-bold text-neutral-900 leading-tight">{student.coursesDisplay}</p>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${student.remainingCredits <= 3 && student.totalCredits > 0 ? 'text-danger' : 'text-primary'}`}>
                      {student.remainingCredits}
                    </span>
                    <span className="text-xs text-neutral-400">/ {student.totalCredits} 堂</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <Badge
                    variant={student.paymentStatus === '已繳費' ? 'accent' : 'danger'}
                    className={student.paymentStatus === '已繳費' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}
                  >
                    {student.paymentStatus}
                  </Badge>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSelectStudent(student)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOperatingStudent(student)
                        fetchStudentDetail(student.id)
                        setShowCreditModal(true)
                      }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="加減堂"
                    >
                      <span className="text-sm font-bold">±</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOperatingStudent(student)
                        fetchStudentDetail(student.id)
                        setShowEnrollModal(true)
                      }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                      title="劃位/轉班"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => handleConfirmPayment(student.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-primary/10 hover:text-primary transition-colors"
                      title="確認繳費"
                    >
                      <CreditCard size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(student.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-danger/10 hover:text-danger transition-colors"
                      title="刪除學員"
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

      {/* Student Detail Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedStudent(null);
                setIsEditing(false);
                setDetailTab('classes');
                setAddingDateCourseId(null);
                setCourseAttendanceMap({});
              }}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
                {/* Profile Header */}
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-[32px] bg-primary/10 flex items-center justify-center text-primary font-bold text-4xl">
                    {selectedStudent.studentName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      {isEditing ? (
                        <Input
                          value={editForm.studentName}
                          onChange={e => setEditForm({ ...editForm, studentName: e.target.value })}
                          className="text-2xl font-bold h-10 w-48"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <h2 className="text-3xl font-bold text-neutral-900">{selectedStudent.studentName}</h2>
                          {selectedStudent.studentCode && (
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              selectedStudent.studentCode.startsWith('ST')
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {selectedStudent.studentCode}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            selectedStudent.category === 'adult' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {selectedStudent.category === 'adult' ? '成人學員' : '兒童學員'}
                          </span>
                        </div>
                      )}
                      <Badge variant={selectedStudent.paymentStatus === '已繳費' ? 'accent' : 'danger'}>
                        {selectedStudent.paymentStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-neutral-500">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Phone size={16} />
                        {isEditing ? (
                          <Input 
                            value={editForm.phone}
                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                            className="h-8 w-32 text-sm"
                          />
                        ) : (
                          <span>{selectedStudent.phone || '未填寫'}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Mail size={16} />
                        {isEditing ? (
                          <Input
                            value={editForm.email}
                            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                            className="h-8 w-48 text-sm"
                          />
                        ) : (
                          <span>{selectedStudent.email || '未填寫'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 rounded-3xl bg-neutral-50 space-y-2">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">剩餘堂數</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-bold ${selectedStudent.remainingCredits <= 3 && selectedStudent.totalCredits > 0 ? 'text-danger' : 'text-primary'}`}>{selectedStudent.remainingCredits}</span>
                      <span className="text-sm font-medium text-neutral-400">/ {selectedStudent.totalCredits} 堂</span>
                    </div>
                    {selectedStudent.totalCredits > 0 && (
                      <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-2">
                        <div
                          className={`h-1.5 rounded-full ${selectedStudent.remainingCredits <= 3 ? 'bg-danger' : 'bg-primary'}`}
                          style={{ width: `${(selectedStudent.usedCredits / selectedStudent.totalCredits) * 100}%` }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-neutral-500">已使用 {selectedStudent.usedCredits} 堂</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-neutral-50 space-y-2">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">繳費資訊</p>
                    <div className="space-y-1">
                      <p className="font-bold text-neutral-900">{selectedStudent.paymentStatus}</p>
                      {selectedStudent.totalPaid > 0 && (
                        <p className="text-xs text-neutral-500">累計繳費：NT$ {selectedStudent.totalPaid.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Course Details - Tabbed */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-1">
                    <button
                      onClick={() => setDetailTab('classes')}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                        detailTab === 'classes' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      報名班級
                    </button>
                    <button
                      onClick={() => {
                        setDetailTab('dates')
                        if (Object.keys(courseAttendanceMap).length === 0) {
                          fetchCourseAttendance(selectedStudent.id)
                          fetchHolidays()
                        }
                      }}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                        detailTab === 'dates' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      課程日期
                    </button>
                  </div>

                  {detailTab === 'classes' ? (
                    /* Tab 1: 報名班級 */
                    <>
                      {studentEnrollments.filter((e: any) => e.status === '已報名').length > 0 ? (
                        <div className="space-y-3">
                          {studentEnrollments.filter((e: any) => e.status === '已報名').map((enrollment: any) => (
                            <div key={enrollment.id} className="p-4 rounded-2xl border border-neutral-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                                  <Calendar size={20} />
                                </div>
                                <p className="font-bold text-neutral-900">{(enrollment.courses as any)?.name || '未知課程'}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="accent" className="bg-emerald-50 text-emerald-600">上課中</Badge>
                                <button
                                  onClick={async () => {
                                    const courseName = (enrollment.courses as any)?.name || '此課程';
                                    if (!confirm(`⚠️ 警告：確定要取消 ${selectedStudent.studentName} 在「${courseName}」的報名嗎？\n\n取消後該學員將退出此班級，需要重新劃位才能恢復。\n堂數不會扣除。`)) return;
                                    await supabase.from('enrollments').update({
                                      status: '已退出',
                                      withdrawn_at: new Date().toISOString(),
                                    }).eq('id', enrollment.id);
                                    fetchStudentDetail(selectedStudent.id);
                                    fetchStudents();
                                    alert('已取消報名。如需恢復，請使用劃位功能重新報名。');
                                  }}
                                  className="text-xs text-neutral-400 hover:text-neutral-600 font-medium px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors"
                                >
                                  退出班級
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                          <p className="text-sm text-neutral-400">尚未報名任何課程</p>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Tab 2: 課程日期 */
                    <div className="space-y-6">
                      {studentEnrollments.filter((e: any) => e.status === '已報名').length > 0 ? (
                        studentEnrollments.filter((e: any) => e.status === '已報名').map((enrollment: any) => {
                          const course = enrollment.courses as any
                          const courseId = enrollment.course_id
                          const attendances = courseAttendanceMap[courseId] || []
                          const statusColorMap: Record<string, string> = {
                            '待上課': 'bg-neutral-100 text-neutral-600',
                            '出席': 'bg-green-100 text-green-700',
                            '缺席': 'bg-red-100 text-red-700',
                            '請假': 'bg-yellow-100 text-yellow-700',
                            '補課': 'bg-purple-100 text-purple-700',
                          }
                          const dayNames = ['日', '一', '二', '三', '四', '五', '六']

                          return (
                            <div key={enrollment.id} className="border border-neutral-100 rounded-2xl overflow-hidden">
                              {/* Course header */}
                              <div className="px-4 py-3 bg-neutral-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                                    <Calendar size={16} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm text-neutral-900">{course?.name || '未知課程'}</p>
                                    <p className="text-xs text-neutral-500">
                                      {course?.day_of_week} {course?.start_time?.slice(0,5)}-{course?.end_time?.slice(0,5)}
                                      {course?.venues?.name && ` · ${course.venues.name}`}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="neutral" className="bg-neutral-100 text-neutral-500 text-xs">
                                  {attendances.length} 堂
                                </Badge>
                              </div>

                              {/* Attendance list */}
                              <div className="divide-y divide-neutral-50">
                                {attendances.length > 0 ? attendances.map((att: any) => {
                                  const d = new Date(att.date + 'T00:00:00')
                                  const dayName = dayNames[d.getDay()]
                                  return (
                                    <div key={att.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-neutral-50/50">
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-neutral-900 w-28">{att.date} ({dayName})</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColorMap[att.status] || 'bg-neutral-100 text-neutral-600'}`}>
                                          {att.status}
                                        </span>
                                        {att.deducted && <span className="text-[10px] text-neutral-400">扣 1 堂</span>}
                                      </div>
                                      {att.status === '待上課' && (
                                        <button
                                          onClick={() => handleDeleteAttendance(att.id, selectedStudent.id)}
                                          className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                          <X size={14} />
                                        </button>
                                      )}
                                    </div>
                                  )
                                }) : (
                                  <div className="px-4 py-4 text-center text-sm text-neutral-400">尚無排定日期</div>
                                )}
                              </div>

                              {/* Add dates section */}
                              <div className="px-4 py-3 border-t border-neutral-100">
                                {addingDateCourseId === courseId ? (
                                  <div className="space-y-3">
                                    <p className="text-xs font-bold text-neutral-500">選擇要新增的上課日期：</p>
                                    {loadingDates ? (
                                      <p className="text-sm text-neutral-400 text-center py-2">計算中...</p>
                                    ) : availableDates.length > 0 ? (
                                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                        {availableDates.map(date => {
                                          const d = new Date(date + 'T00:00:00')
                                          const dayName = dayNames[d.getDay()]
                                          const isSelected = selectedNewDates.includes(date)
                                          return (
                                            <button
                                              key={date}
                                              onClick={() => {
                                                setSelectedNewDates(prev =>
                                                  isSelected ? prev.filter(d => d !== date) : [...prev, date]
                                                )
                                              }}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                isSelected
                                                  ? 'bg-primary text-white shadow-sm'
                                                  : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                                              }`}
                                            >
                                              {date} ({dayName})
                                            </button>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-neutral-400 text-center py-2">沒有可用的日期</p>
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setAddingDateCourseId(null)
                                          setSelectedNewDates([])
                                          setAvailableDates([])
                                        }}
                                        className="flex-1 py-2 text-sm font-medium bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                                      >
                                        取消
                                      </button>
                                      {selectedNewDates.length > 0 && (
                                        <button
                                          onClick={() => handleAddAttendanceDates(courseId, selectedStudent.id)}
                                          className="flex-1 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                        >
                                          確認新增 {selectedNewDates.length} 個日期
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setAddingDateCourseId(courseId)
                                      computeAvailableDates(courseId, selectedStudent.id)
                                    }}
                                    className="w-full py-2 flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                  >
                                    <Plus size={16} />
                                    新增日期
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="py-6 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                          <p className="text-sm text-neutral-400">尚未報名任何課程，無法管理日期</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Additional Info */}
                {isEditing ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-neutral-900">詳細資訊</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="性別">
                        <Select value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })} className="h-10 rounded-xl">
                          <option value="">未填寫</option>
                          <option value="male">男</option>
                          <option value="female">女</option>
                        </Select>
                      </FormField>
                      <FormField label="出生日期">
                        <input type="date" value={editForm.birthDate} onChange={e => setEditForm({ ...editForm, birthDate: e.target.value })} className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm" />
                      </FormField>
                      <FormField label="就讀學校">
                        <Input value={editForm.school || ''} onChange={e => setEditForm({ ...editForm, school: e.target.value })} className="h-10 rounded-xl" />
                      </FormField>
                      <FormField label="緊急聯絡人">
                        <Input value={editForm.emergencyContact} onChange={e => setEditForm({ ...editForm, emergencyContact: e.target.value })} className="h-10 rounded-xl" />
                      </FormField>
                      <FormField label="緊急聯絡電話">
                        <Input value={editForm.emergencyPhone} onChange={e => setEditForm({ ...editForm, emergencyPhone: e.target.value })} className="h-10 rounded-xl" />
                      </FormField>
                      <FormField label="備註">
                        <Input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="h-10 rounded-xl" />
                      </FormField>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-neutral-900">詳細資訊</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: '性別', value: selectedStudent.gender === 'male' ? '男' : selectedStudent.gender === 'female' ? '女' : '未填寫' },
                        { label: '出生日期', value: selectedStudent.birthDate || '未填寫' },
                        { label: '就讀學校', value: selectedStudent.school || '未填寫' },
                        { label: '緊急聯絡人', value: selectedStudent.emergencyContact || '未填寫' },
                        { label: '緊急聯絡電話', value: selectedStudent.emergencyPhone || '未填寫' },
                        { label: '備註', value: selectedStudent.notes || '無' },
                      ].map(item => (
                        <div key={item.label} className="p-3 rounded-xl bg-neutral-50">
                          <p className="text-xs text-neutral-400 mb-1">{item.label}</p>
                          <p className="text-sm font-medium text-neutral-900">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Usage History */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-neutral-900">堂數使用紀錄</h3>
                    <Badge variant="neutral" className="bg-neutral-100 text-neutral-500">
                      共 {usageHistory.length} 筆
                    </Badge>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {usageHistory.length > 0 ? (
                      usageHistory.map((usage) => {
                        const colorMap: Record<string, string> = {
                          '出席': 'bg-green-100 text-green-700',
                          '缺席': 'bg-red-100 text-red-700',
                          '請假': 'bg-yellow-100 text-yellow-700',
                          '遲到': 'bg-orange-100 text-orange-700',
                          '病假': 'bg-blue-100 text-blue-700',
                          '補課': 'bg-purple-100 text-purple-700',
                        }
                        return (
                          <div key={usage.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                                <History size={18} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-neutral-900">{usage.date}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colorMap[usage.status] || 'bg-neutral-100 text-neutral-600'}`}>
                                    {usage.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  {usage.courseName && (
                                    <span className="text-xs text-neutral-500">{usage.courseName}</span>
                                  )}
                                  {usage.courseTime && (
                                    <span className="text-xs text-neutral-400">{usage.courseTime}</span>
                                  )}
                                  {usage.location && (
                                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                                      <MapPin size={12} />
                                      <span>{usage.location}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {usage.deducted && (
                              <span className="text-[10px] font-bold text-neutral-400">扣 1 堂</span>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div className="py-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                        <p className="text-sm text-neutral-400">尚無使用紀錄</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Waitlist History */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-neutral-900">候補紀錄</h3>
                    <Badge variant="warning" className="bg-amber-50 text-amber-600">
                      候補中
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {waitlists.filter(w => w.students.some(s => s.name === selectedStudent.studentName)).length > 0 ? (
                      waitlists.filter(w => w.students.some(s => s.name === selectedStudent.studentName)).map((waitlist) => (
                        <div key={waitlist.id} className="p-4 rounded-2xl bg-amber-50/30 border border-amber-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-600 shadow-sm">
                              <Clock size={18} />
                            </div>
                            <div>
                              <p className="font-bold text-neutral-900">{waitlist.courseName}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-1 text-xs text-neutral-400">
                                  <Calendar size={12} />
                                  <span>申請日期：{waitlist.date}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-neutral-400">
                                  <User size={12} />
                                  <span>聯絡人：{waitlist.contactName}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <Badge variant="warning">候補中</Badge>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                        <p className="text-sm text-neutral-400">尚無候補紀錄</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-14 rounded-2xl" 
                    onClick={() => {
                      setSelectedStudent(null);
                      setIsEditing(false);
                      setDetailTab('classes');
                      setAddingDateCourseId(null);
                      setCourseAttendanceMap({});
                    }}
                  >
                    關閉
                  </Button>
                  {isEditing ? (
                    <Button 
                      onClick={handleSaveEdit}
                      variant="primary" 
                      className="flex-1 h-14 rounded-2xl shadow-lg shadow-primary/20"
                    >
                      儲存變更
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleStartEdit(selectedStudent)}
                      variant="primary" 
                      className="flex-1 h-14 rounded-2xl shadow-lg shadow-primary/20"
                    >
                      編輯資料
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 加堂/減堂 Modal */}
      {showCreditModal && operatingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreditModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">加減堂數 — {operatingStudent.studentName} ({operatingStudent.studentNumber})</h3>

            <div className="bg-neutral-50 rounded-xl p-3 text-center">
              <p className="text-sm text-neutral-500">目前剩餘堂數</p>
              <p className="text-3xl font-bold text-primary">{operatingStudent.remainingCredits || 0}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setCreditAction('add')}
                className={`flex-1 py-2 rounded-lg font-medium ${creditAction === 'add' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 border border-green-200'}`}
              >+ 加堂</button>
              <button onClick={() => setCreditAction('subtract')}
                className={`flex-1 py-2 rounded-lg font-medium ${creditAction === 'subtract' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 border border-red-200'}`}
              >- 減堂</button>
            </div>

            <FormField label="堂數">
              <Input type="number" min={1} value={creditAmount} onChange={e => setCreditAmount(parseInt(e.target.value) || 1)} />
            </FormField>

            <FormField label="原因（選填）">
              <Input value={creditReason} onChange={e => setCreditReason(e.target.value)} placeholder="例如：補償、退費調整" />
            </FormField>

            <div className="flex gap-3">
              <button onClick={() => setShowCreditModal(false)} className="flex-1 py-3 bg-neutral-100 rounded-xl">取消</button>
              <button onClick={handleCreditChange} className={`flex-1 py-3 text-white rounded-xl font-medium ${creditAction === 'add' ? 'bg-green-500' : 'bg-red-500'}`}>
                確認{creditAction === 'add' ? '加' : '減'} {creditAmount} 堂
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 劃位/轉班 Modal */}
      {showEnrollModal && operatingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEnrollModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">劃位/轉班 — {operatingStudent.studentName} ({operatingStudent.studentNumber})</h3>

            {/* 目前報名的班級 */}
            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">目前班級</p>
              {studentEnrollments.filter((e: any) => e.status === '已報名').length > 0 ? (
                <div className="space-y-2">
                  {studentEnrollments.filter((e: any) => e.status === '已報名').map((e: any) => (
                    <div key={e.id} className="bg-blue-50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{e.courses?.name}</p>
                        <p className="text-xs text-neutral-500">{e.courses?.day_of_week} {e.courses?.start_time?.slice(0,5)}-{e.courses?.end_time?.slice(0,5)}</p>
                      </div>
                      <select
                        onChange={async (ev) => {
                          if (ev.target.value && confirm(`確定要將此學員從「${e.courses?.name}」轉到新班級？`)) {
                            await handleTransfer(e.id, ev.target.value)
                          }
                          ev.target.value = ''
                        }}
                        className="text-sm border rounded-lg px-2 py-1"
                        defaultValue=""
                      >
                        <option value="">轉班 →</option>
                        {allCourses.filter((c: any) => c.id !== e.course_id).map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">尚未報名任何班級</p>
              )}
            </div>

            {/* 劃位新班級 */}
            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">劃位新班級</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {allCourses
                  .filter((c: any) => !studentEnrollments.some((e: any) => e.course_id === c.id && e.status === '已報名'))
                  .map((course: any) => (
                    <div key={course.id} className="border rounded-lg p-3 flex items-center justify-between hover:bg-neutral-50">
                      <div>
                        <p className="font-medium text-sm">{course.name}</p>
                        <p className="text-xs text-neutral-500">
                          {course.day_of_week} {course.start_time?.slice(0,5)}-{course.end_time?.slice(0,5)}
                          {course.venues?.name && ` · ${course.venues.name}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEnrollCourse(course.id)}
                        className="px-3 py-1 bg-primary text-white text-sm rounded-lg"
                      >
                        劃位
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <button onClick={() => setShowEnrollModal(false)} className="w-full py-3 bg-neutral-100 rounded-xl font-medium">關閉</button>
          </div>
        </div>
      )}
    </div>
  );
};
