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
import { generateAttendanceRecords } from '../lib/attendanceUtils';
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
  const [creditCourseId, setCreditCourseId] = useState<string>('')
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
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [courseScheduleMap, setCourseScheduleMap] = useState<Record<string, any[]>>({})

  const fetchStudentAttendance = async (studentId: string) => {
    const { data } = await supabase
      .from('attendance')
      .select('id, date, status, deducted, courses(name, start_time, end_time, venues(name))')
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .limit(50)
    setUsageHistory((data || []).map((a: any) => ({
      id: a.id,
      date: a.date,
      status: a.status,
      deducted: a.deducted,
      courseName: (a.courses as any)?.name || '',
      courseTime: (a.courses as any)?.start_time?.slice(0,5) || '',
      location: (a.courses as any)?.venues?.name || '',
    })))
  }

  const fetchActivityLogs = async (studentId: string) => {
    const { data } = await supabase
      .from('student_activity_logs')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(50)
    setActivityLogs(data || [])
  }

  const logStudentActivity = async (studentId: string, action: string, details: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('student_activity_logs').insert({
      student_id: studentId,
      action,
      details,
      changed_by: user?.id || null,
    })
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
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id, status, courses(id, name, day_of_week, start_time, end_time, venues(name))')
      .eq('student_id', studentId)
      .eq('status', '已報名')

    if (!enrollments || enrollments.length === 0) {
      setCourseAttendanceMap({})
      setCourseScheduleMap({})
      return
    }

    const map: Record<string, any[]> = {}
    const scheduleMap: Record<string, any[]> = {}

    for (const enrollment of enrollments) {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .eq('course_id', enrollment.course_id)
        .order('date')

      const attList = data || []
      map[enrollment.course_id] = attList

      const entries: any[] = []
      let sessionCount = 0

      for (const att of attList) {
        const isLeave = ['請假', '病假'].includes(att.status)
        if (!isLeave) sessionCount++

        entries.push({
          id: att.id,
          date: att.date,
          type: 'class',
          session: isLeave ? null : sessionCount,
          status: att.status,
          deducted: att.deducted || false,
        })
      }

      scheduleMap[enrollment.course_id] = entries
    }

    setCourseAttendanceMap(map)
    setCourseScheduleMap(scheduleMap)
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
      status: '已劃位',
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
    if (!confirm('確定要刪除此日期？')) return
    const { error } = await supabase.from('attendance').delete().eq('id', attendanceId)
    if (error) {
      alert('刪除失敗：' + error.message)
      return
    }
    // 同步 credits used_credits
    const { data: allAtt } = await supabase.from('attendance').select('id').eq('student_id', studentId).eq('deducted', true)
    const newUsed = allAtt?.length || 0
    const { data: cred } = await supabase.from('credits').select('id').eq('student_id', studentId).eq('status', 'active').limit(1)
    if (cred && cred.length > 0) {
      await supabase.from('credits').update({ used_credits: newUsed }).eq('id', cred[0].id)
    }
    await fetchCourseAttendance(studentId)
    fetchStudentAttendance(studentId)
  }

  const handleAttendanceStatusChange = async (attendanceId: string, studentId: string, newStatus: string) => {
    const deductedStatuses = ['出席', '缺席', '遲到']
    const deducted = deductedStatuses.includes(newStatus)

    const { error } = await supabase.from('attendance').update({ status: newStatus, deducted }).eq('id', attendanceId)
    if (error) {
      alert('更新失敗：' + error.message)
      return
    }

    // 同步 credits used_credits
    const { data: allAtt } = await supabase.from('attendance').select('id').eq('student_id', studentId).eq('deducted', true)
    const newUsed = allAtt?.length || 0
    const { data: cred } = await supabase.from('credits').select('id').eq('student_id', studentId).eq('status', 'active').limit(1)
    if (cred && cred.length > 0) {
      await supabase.from('credits').update({ used_credits: newUsed }).eq('id', cred[0].id)
    }
    await fetchCourseAttendance(studentId)
    fetchStudentAttendance(studentId)
  }

  const handleCreditChange = async () => {
    if (!operatingStudent || creditAmount <= 0) return

    // 確定要操作的課程
    const enrolledCourses = studentEnrollments.filter((e: any) => e.status === '已報名')
    const targetCourseId = creditCourseId || (enrolledCourses.length === 1 ? enrolledCourses[0].course_id : '')

    if (!targetCourseId) {
      alert('請選擇要加減堂的課程')
      return
    }

    // 讀取課程資訊
    const course = allCourses.find((c: any) => c.id === targetCourseId)
    const dayMap: Record<string, number> = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 }
    const targetDay = course ? dayMap[course.day_of_week] : undefined

    // 確保有 credit 記錄
    const { data: existingCredits } = await supabase
      .from('credits')
      .select('*')
      .eq('student_id', operatingStudent.id)
      .eq('status', 'active')
    let credit = existingCredits?.[0]

    if (!credit) {
      // 沒有 credit 記錄，建立一筆
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + 12 * 7)
      const { error } = await supabase.from('credits').insert({
        student_id: operatingStudent.id,
        plan_name: '管理員手動新增',
        purchase_date: formatLocalDate(new Date()),
        total_credits: 0,
        used_credits: 0,
        leave_count: 0,
        max_leave: 4,
        plan_weeks: 12,
        expiry_date: formatLocalDate(expiryDate),
        status: 'active',
      })
      if (error) { alert('建立堂數記錄失敗：' + error.message); return }
      const { data: newCred } = await supabase.from('credits').select('*').eq('student_id', operatingStudent.id).eq('status', 'active').limit(1).single()
      credit = newCred
    }

    if (creditAction === 'add') {
      // === 加堂：新增 attendance 記錄 ===
      if (targetDay === undefined) {
        alert('無法取得課程的上課星期')
        return
      }

      // 找該學員在該課程最後一筆 attendance 日期
      const { data: lastAtt } = await supabase
        .from('attendance')
        .select('date')
        .eq('student_id', operatingStudent.id)
        .eq('course_id', targetCourseId)
        .order('date', { ascending: false })
        .limit(1)

      // 讀取停課日（含全域停課）
      const { data: holidayData } = await supabase
        .from('course_holidays')
        .select('date')
        .or(`course_id.eq.${targetCourseId},course_id.is.null`)
      const holidaySet = new Set((holidayData || []).map((h: any) => h.date))

      // 讀取已存在的 attendance 日期（避免重複）
      const { data: existingAtt } = await supabase
        .from('attendance')
        .select('date')
        .eq('student_id', operatingStudent.id)
        .eq('course_id', targetCourseId)
      const existingDates = new Set((existingAtt || []).map((a: any) => a.date))

      // 從最後一筆日期的下一週開始
      const current = new Date()
      if (lastAtt && lastAtt.length > 0) {
        const lastDate = new Date(lastAtt[0].date + 'T00:00:00')
        lastDate.setDate(lastDate.getDate() + 7)
        current.setTime(lastDate.getTime())
      }
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1)
      }

      const newDates: string[] = []
      while (newDates.length < creditAmount) {
        const dateStr = formatLocalDate(current)
        if (!holidaySet.has(dateStr) && !existingDates.has(dateStr)) {
          newDates.push(dateStr)
        }
        current.setDate(current.getDate() + 7)
      }

      if (newDates.length > 0) {
        const inserts = newDates.map(date => ({
          student_id: operatingStudent.id,
          course_id: targetCourseId,
          date,
          status: '已劃位',
          deducted: false,
          credit_id: credit?.id || null,
        }))
        const { error } = await supabase.from('attendance').insert(inserts)
        if (error) { alert('新增日期失敗：' + error.message); return }
      }
    } else {
      // === 減堂：刪除最後 N 筆已劃位/待上課 attendance ===
      const { data: deletable } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', operatingStudent.id)
        .eq('course_id', targetCourseId)
        .in('status', ['已劃位', '待上課'])
        .order('date', { ascending: false })
        .limit(creditAmount)

      if (deletable && deletable.length > 0) {
        const ids = deletable.map((a: any) => a.id)
        const { error } = await supabase.from('attendance').delete().in('id', ids)
        if (error) { alert('刪除失敗：' + error.message); return }
        if (deletable.length < creditAmount) {
          alert(`注意：只找到 ${deletable.length} 筆可刪除的劃位記錄（需要 ${creditAmount} 筆）`)
        }
      } else {
        alert('沒有可刪除的已劃位/待上課記錄')
      }
    }

    // === 重新計算 credits（從 attendance COUNT） ===
    const { count: totalCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', operatingStudent.id)
    const { count: usedCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', operatingStudent.id).eq('deducted', true)

    const { data: activeCred } = await supabase.from('credits').select('id').eq('student_id', operatingStudent.id).eq('status', 'active').limit(1)
    if (activeCred && activeCred.length > 0) {
      await supabase.from('credits').update({
        total_credits: totalCount || 0,
        used_credits: usedCount || 0,
      }).eq('id', activeCred[0].id)
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

    await logStudentActivity(operatingStudent.id, creditAction === 'add' ? 'credits_added' : 'credits_deducted', {
      amount: creditAmount,
      reason: creditReason || '管理員手動調整',
      old_total: credit?.total_credits || 0,
      old_used: credit?.used_credits || 0,
    })

    alert(`${creditAction === 'add' ? '加' : '減'} ${creditAmount} 堂成功！`)

    setShowCreditModal(false)
    setCreditAmount(1)
    setCreditReason('')
    setCreditCourseId('')

    // 重新載入學員資料
    await fetchStudents()
    if (operatingStudent) {
      fetchStudentDetail(operatingStudent.id)
    }
    setOperatingStudent(null)
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

    // 自動建立待上課的 attendance 記錄
    await generateAttendanceRecords(operatingStudent.id, courseId)

    const courseName = allCourses.find(c => c.id === courseId)?.name || ''
    await logStudentActivity(operatingStudent.id, 'enrolled', {
      course_id: courseId,
      course_name: courseName,
    })

    alert('劃位成功')
    fetchStudentDetail(operatingStudent.id)
    fetchStudents()
  }

  const handleTransfer = async (fromEnrollmentId: string, toCourseId: string) => {
    if (!operatingStudent) return

    // 1. 取得舊 enrollment 的 course_id
    const { data: oldEnrollment } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('id', fromEnrollmentId)
      .single()

    // 2. 舊 enrollment 改為已退出
    await supabase.from('enrollments').update({
      status: '已退出',
      withdrawn_at: new Date().toISOString(),
    }).eq('id', fromEnrollmentId)

    // 3. 刪除舊課程的已劃位/待上課 attendance
    if (oldEnrollment) {
      await supabase.from('attendance').delete()
        .eq('student_id', operatingStudent.id)
        .eq('course_id', oldEnrollment.course_id)
        .in('status', ['已劃位', '待上課'])
    }

    // 4. 建立新 enrollment
    await supabase.from('enrollments').insert({
      student_id: operatingStudent.id,
      course_id: toCourseId,
      status: '已報名',
    })

    // 5. 計算剩餘可劃位堂數
    const { data: activeCred } = await supabase
      .from('credits')
      .select('id, remaining_credits')
      .eq('student_id', operatingStudent.id)
      .eq('status', 'active')
      .limit(1)
    const remainingCredits = activeCred?.[0]?.remaining_credits || 0
    const creditId = activeCred?.[0]?.id || null

    // 6. 在新課程建立已劃位 attendance
    if (remainingCredits > 0) {
      const newCourse = allCourses.find((c: any) => c.id === toCourseId)
      const dayMap: Record<string, number> = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 }
      const targetDay = newCourse ? dayMap[newCourse.day_of_week] : undefined

      if (targetDay !== undefined) {
        // 讀取停課日（含全域停課）
        const { data: holidayData } = await supabase
          .from('course_holidays')
          .select('date')
          .or(`course_id.eq.${toCourseId},course_id.is.null`)
        const holidaySet = new Set((holidayData || []).map((h: any) => h.date))

        const current = new Date()
        while (current.getDay() !== targetDay) {
          current.setDate(current.getDate() + 1)
        }

        const newDates: string[] = []
        while (newDates.length < remainingCredits) {
          const dateStr = formatLocalDate(current)
          if (!holidaySet.has(dateStr)) {
            newDates.push(dateStr)
          }
          current.setDate(current.getDate() + 7)
        }

        if (newDates.length > 0) {
          const inserts = newDates.map(date => ({
            student_id: operatingStudent.id,
            course_id: toCourseId,
            date,
            status: '已劃位',
            deducted: false,
            credit_id: creditId,
          }))
          await supabase.from('attendance').insert(inserts)
        }
      }
    }

    // 7. sync credits
    const { count: totalCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', operatingStudent.id)
    const { count: usedCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', operatingStudent.id).eq('deducted', true)
    if (creditId) {
      await supabase.from('credits').update({
        total_credits: totalCount || 0,
        used_credits: usedCount || 0,
      }).eq('id', creditId)
    }

    // 8. activity log
    const fromCourseName = allCourses.find(c => c.id === oldEnrollment?.course_id)?.name || ''
    const toCourseName = allCourses.find(c => c.id === toCourseId)?.name || ''
    await logStudentActivity(operatingStudent.id, 'transferred', {
      from_course: fromCourseName,
      to_course: toCourseName,
    })

    alert('轉班成功')
    fetchStudentDetail(operatingStudent.id)
    fetchStudents()
  }

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student)
    fetchStudentAttendance(student.id)
    fetchStudentDetail(student.id)
    fetchActivityLogs(student.id)
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
    await logStudentActivity(editForm.id, 'info_updated', {
      fields_changed: Object.keys(editForm).filter(k => editForm[k] !== selectedStudent?.[k]),
    })
    setSelectedStudent(prev => prev ? { ...prev, ...editForm } : null);
    setIsEditing(false);
  };

  const handleDeleteStudent = async (id: string) => {
    if (confirm('確定要刪除此學員紀錄嗎？')) {
      await logStudentActivity(id, 'deleted', { student_name: students.find(s => s.id === id)?.studentName })
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
                                    // 刪除該學員在此課程的所有「待上課」attendance 記錄
                                    await supabase.from('attendance').delete()
                                      .eq('student_id', selectedStudent.id)
                                      .eq('course_id', enrollment.course_id)
                                      .eq('status', '待上課');
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
                          const schedule = courseScheduleMap[courseId] || []
                          const classCount = schedule.filter((e: any) => e.type === 'class').length

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
                                  {classCount} 堂
                                </Badge>
                              </div>

                              {/* Schedule list */}
                              {/* 新增日期按鈕 */}
                              <div className="px-4 py-2 border-b border-neutral-100">
                                {addingDateCourseId === courseId ? (
                                  <div className="space-y-2">
                                    {loadingDates ? (
                                      <p className="text-xs text-neutral-400">載入中...</p>
                                    ) : availableDates.length === 0 ? (
                                      <p className="text-xs text-neutral-400">無可選日期</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-1">
                                        {availableDates.map(date => (
                                          <button
                                            key={date}
                                            onClick={() => setSelectedNewDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date])}
                                            className={`text-xs px-2 py-1 rounded-lg border transition-all ${selectedNewDates.includes(date) ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary'}`}
                                          >
                                            {date}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleAddAttendanceDates(courseId, selectedStudent!.id)}
                                        disabled={selectedNewDates.length === 0}
                                        className="text-xs px-3 py-1 bg-primary text-white rounded-lg disabled:opacity-50"
                                      >
                                        新增 {selectedNewDates.length} 個日期
                                      </button>
                                      <button
                                        onClick={() => { setAddingDateCourseId(null); setSelectedNewDates([]); setAvailableDates([]) }}
                                        className="text-xs px-3 py-1 bg-neutral-100 text-neutral-600 rounded-lg"
                                      >
                                        取消
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setAddingDateCourseId(courseId); computeAvailableDates(courseId, selectedStudent!.id) }}
                                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                                  >
                                    <Plus size={14} /> 新增日期
                                  </button>
                                )}
                              </div>

                              {/* Schedule list */}
                              <div className="divide-y divide-neutral-50">
                                {schedule.length > 0 ? (
                                  schedule.map((entry: any, idx: number) => {
                                    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
                                    const d = new Date(entry.date + 'T00:00:00')
                                    const weekday = `(${weekdays[d.getDay()]})`
                                    const todayStr = formatLocalDate(new Date())
                                    const isToday = entry.date === todayStr

                                    const statusColors: Record<string, string> = {
                                      '出席': 'bg-green-100 text-green-700',
                                      '缺席': 'bg-red-100 text-red-700',
                                      '請假': 'bg-yellow-100 text-yellow-700',
                                      '遲到': 'bg-orange-100 text-orange-700',
                                      '病假': 'bg-blue-100 text-blue-700',
                                      '待上課': 'bg-blue-50 text-blue-500 border border-dashed border-blue-200',
                                      '已劃位': 'bg-purple-50 text-purple-500 border border-dashed border-purple-200',
                                      '未記錄': 'bg-neutral-50 text-neutral-400 border border-dashed border-neutral-300',
                                    }

                                    const canEdit = ['待上課', '已劃位', '未記錄'].includes(entry.status) || entry.id
                                    const canDelete = ['待上課', '已劃位'].includes(entry.status) && entry.id

                                    if (entry.type === 'holiday') {
                                      return (
                                        <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-50">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-neutral-400 w-10 text-right">—</span>
                                            <span className="text-sm text-neutral-400 line-through">{entry.date} {weekday}</span>
                                          </div>
                                          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400 italic">{entry.status}</span>
                                        </div>
                                      )
                                    }

                                    return (
                                      <div key={idx} className={`flex items-center justify-between py-2 px-3 rounded-lg ${isToday ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : 'hover:bg-neutral-50'}`}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-neutral-400 w-10 text-right">{entry.session ? `第${entry.session}堂` : '—'}</span>
                                          <span className="text-sm text-neutral-700">{entry.date} {weekday}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {entry.deducted && <span className="text-[10px] text-neutral-400">-1堂</span>}
                                          {entry.id ? (
                                            <select
                                              value={entry.status}
                                              onChange={(e) => handleAttendanceStatusChange(entry.id, selectedStudent!.id, e.target.value)}
                                              className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${statusColors[entry.status] || 'bg-neutral-100 text-neutral-500'}`}
                                            >
                                              {['出席', '缺席', '請假', '病假', '遲到', '已劃位'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                              ))}
                                            </select>
                                          ) : (
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[entry.status] || 'bg-neutral-100 text-neutral-500'}`}>{entry.status}</span>
                                          )}
                                          {canDelete && (
                                            <button
                                              onClick={() => handleDeleteAttendance(entry.id, selectedStudent!.id)}
                                              className="text-neutral-300 hover:text-red-500 transition-colors"
                                            >
                                              <X size={14} />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })
                                ) : (
                                  <div className="px-4 py-4 text-center text-sm text-neutral-400">尚無排定日期</div>
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

                {/* 異動紀錄 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-neutral-900">異動紀錄</h3>
                    <span className="text-xs text-neutral-400">{activityLogs.length} 筆紀錄</span>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {activityLogs.length > 0 ? (
                      activityLogs.map((log: any) => {
                        const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
                          'enrolled': { label: '報名班級', color: 'text-green-600 bg-green-50', icon: '📝' },
                          'withdrawn': { label: '退出班級', color: 'text-red-600 bg-red-50', icon: '🚪' },
                          'transferred': { label: '轉班', color: 'text-blue-600 bg-blue-50', icon: '🔄' },
                          'credits_added': { label: '加堂', color: 'text-green-600 bg-green-50', icon: '➕' },
                          'credits_deducted': { label: '扣堂', color: 'text-red-600 bg-red-50', icon: '➖' },
                          'credits_purchased': { label: '購買堂數', color: 'text-primary bg-blue-50', icon: '💰' },
                          'attendance_changed': { label: '出缺席變更', color: 'text-amber-600 bg-amber-50', icon: '📋' },
                          'payment': { label: '繳費', color: 'text-green-600 bg-green-50', icon: '💳' },
                          'refund': { label: '退費', color: 'text-red-600 bg-red-50', icon: '💸' },
                          'info_updated': { label: '資料變更', color: 'text-neutral-600 bg-neutral-50', icon: '✏️' },
                          'deleted': { label: '刪除學員', color: 'text-red-600 bg-red-50', icon: '🗑️' },
                        }
                        const info = actionLabels[log.action] || { label: log.action, color: 'text-neutral-600 bg-neutral-50', icon: '📌' }
                        const time = new Date(log.created_at)
                        const timeStr = `${time.getFullYear()}-${String(time.getMonth()+1).padStart(2,'0')}-${String(time.getDate()).padStart(2,'0')} ${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`

                        let detail = ''
                        const d = log.details || {}
                        if (log.action === 'enrolled') detail = d.course_name || ''
                        else if (log.action === 'withdrawn') detail = d.course_name || ''
                        else if (log.action === 'transferred') detail = `${d.from_course} → ${d.to_course}`
                        else if (log.action === 'credits_added') detail = `+${d.amount} 堂${d.reason ? '（' + d.reason + '）' : ''}`
                        else if (log.action === 'credits_deducted') detail = `-${d.amount} 堂${d.reason ? '（' + d.reason + '）' : ''}`
                        else if (log.action === 'payment') detail = `NT$ ${d.amount?.toLocaleString()}`
                        else if (log.action === 'refund') detail = `NT$ ${d.amount?.toLocaleString()}`
                        else if (log.action === 'attendance_changed') detail = `${d.date} ${d.course_name || ''}: ${d.old_status} → ${d.new_status}`
                        else if (log.action === 'info_updated') detail = '個人資料已更新'

                        return (
                          <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl border border-neutral-100 hover:bg-neutral-50/50">
                            <span className="text-lg">{info.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                                <span className="text-xs text-neutral-400">{timeStr}</span>
                              </div>
                              {detail && <p className="text-sm text-neutral-600 mt-1 truncate">{detail}</p>}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="py-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                        <p className="text-sm text-neutral-400">尚無異動紀錄</p>
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

            {(() => {
              const enrolledCourses = studentEnrollments.filter((e: any) => e.status === '已報名');
              if (enrolledCourses.length > 1) {
                return (
                  <FormField label="選擇課程">
                    <Select value={creditCourseId} onChange={e => setCreditCourseId(e.target.value)}>
                      <option value="">請選擇課程</option>
                      {enrolledCourses.map((e: any) => (
                        <option key={e.course_id} value={e.course_id}>{e.courses?.name || e.course_id}</option>
                      ))}
                    </Select>
                  </FormField>
                );
              } else if (enrolledCourses.length === 1) {
                return (
                  <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                    課程：{enrolledCourses[0].courses?.name || '未知'}
                  </div>
                );
              } else {
                return (
                  <div className="bg-red-50 rounded-xl p-3 text-sm text-red-600">
                    此學員尚未報名任何課程，無法加減堂
                  </div>
                );
              }
            })()}

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
