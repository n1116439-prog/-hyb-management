import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AdminTrialManagement } from './AdminTrialManagement';

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
  X,
  Upload,
  Key,
  Copy,
  CheckCircle
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

  // 匯入歷史資料
  const [showImportModal, setShowImportModal] = useState(false)
  const [importStep, setImportStep] = useState(1)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importSheet1, setImportSheet1] = useState<any[][]>([])
  const [importSheet2, setImportSheet2] = useState<any[][]>([])
  const [importSheet1Errors, setImportSheet1Errors] = useState<(string | null)[]>([])
  const [importSheet2Errors, setImportSheet2Errors] = useState<(string | null)[]>([])
  const [importPreviewTab, setImportPreviewTab] = useState<1 | 2>(1)
  const [importProgress, setImportProgress] = useState(0)
  const [importProgressText, setImportProgressText] = useState('')
  const [importResult, setImportResult] = useState<{
    enrollNew: number; enrollSkip: number; enrollFail: number;
    creditNew: number; creditUpdate: number; creditFail: number;
    attendNew: number; attendSkip: number; attendFail: number;
    failures: { row: number; sheet: string; reason: string }[];
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importMode, setImportMode] = useState<'excel' | 'paste'>('excel')
  const [pasteText1, setPasteText1] = useState('')
  const [pasteText2, setPasteText2] = useState('')
  const [pasteErrors, setPasteErrors] = useState<string[]>([])
  const [pasteParsing, setPasteParsing] = useState(false)

  // 重設密碼
  const [showResetPwModal, setShowResetPwModal] = useState(false)
  const [resetPwStudent, setResetPwStudent] = useState<any>(null)
  const [resetPwLoading, setResetPwLoading] = useState(false)
  const [resetPwResult, setResetPwResult] = useState<string | null>(null)
  const [resetPwCopied, setResetPwCopied] = useState(false)

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
      .select('student_id, course_id, status, courses(name, course_code)')
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
        coursesRaw: studentEnrollments.map((e: any) => ({ name: (e.courses as any)?.name || '', course_code: (e.courses as any)?.course_code || '' })).filter((c: any) => c.name),
        coursesDisplay: studentEnrollments.map((e: any) => (e.courses as any)?.name || '').filter(Boolean).join('、') || '未報名',
        // 堂數
        totalCredits: studentCredits.reduce((sum: number, c: any) => sum + (c.total_credits || 0), 0),
        usedCredits: studentCredits.reduce((sum: number, c: any) => sum + (c.used_credits || 0), 0),
        remainingCredits: studentCredits.reduce((sum: number, c: any) => sum + (c.remaining_credits || 0), 0),
        // 繳費狀態
        paymentStatus: s.payment_status || '尚未繳費',
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
  const [showMakeupModal, setShowMakeupModal] = useState(false)
  const [makeupSourceAttendance, setMakeupSourceAttendance] = useState<any>(null)
  const [makeupCourseId, setMakeupCourseId] = useState('')
  const [makeupDate, setMakeupDate] = useState('')
  const [makeupAvailableDates, setMakeupAvailableDates] = useState<string[]>([])
  const [loadingMakeupDates, setLoadingMakeupDates] = useState(false)

  const fetchStudentAttendance = async (studentId: string) => {
    const { data } = await supabase
      .from('attendance')
      .select('id, date, status, deducted, courses(name, course_code, start_time, end_time, venues(name))')
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
    const { data } = await supabase.from('courses').select('id, name, course_code, category, day_of_week, start_time, end_time, venue_id, venues(name)').or('is_deleted.is.null,is_deleted.eq.false')
    if (data) setAllCourses(data)
  }

  const fetchStudentDetail = async (studentId: string) => {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*, courses(id, name, course_code, day_of_week, start_time, end_time, venues(name))')
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
      .select('course_id, status, courses(id, name, course_code, day_of_week, start_time, end_time, venues(name))')
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

  const fetchMakeupDates = async (courseId: string) => {
    setLoadingMakeupDates(true)
    setMakeupAvailableDates([])
    setMakeupDate('')

    const { data: course } = await supabase
      .from('courses')
      .select('day_of_week')
      .eq('id', courseId)
      .single()
    if (!course) { setLoadingMakeupDates(false); return }

    const weekdayMap: Record<string, number> = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 }
    const targetDay = weekdayMap[course.day_of_week]
    if (targetDay === undefined) { setLoadingMakeupDates(false); return }

    const { data: holidays } = await supabase
      .from('course_holidays')
      .select('date')
      .or('course_id.eq.' + courseId + ',course_id.is.null')
    const holidaySet = new Set((holidays || []).map((h: any) => h.date))

    const today = new Date()
    const current = new Date(today)
    while (current.getDay() !== targetDay) {
      current.setDate(current.getDate() + 1)
    }

    const dates: string[] = []
    for (let i = 0; i < 8; i++) {
      const dateStr = formatLocalDate(current)
      if (!holidaySet.has(dateStr)) {
        dates.push(dateStr)
      }
      current.setDate(current.getDate() + 7)
    }

    setMakeupAvailableDates(dates)
    setLoadingMakeupDates(false)
  }

  const handleMakeupClass = async () => {
    if (!makeupSourceAttendance || !makeupCourseId || !makeupDate || !selectedStudent) return

    const { data: creditData } = await supabase
      .from('credits')
      .select('id, expiry_date')
      .eq('student_id', selectedStudent.id)
      .eq('status', 'active')
      .limit(1)

    const credit = creditData?.[0]
    if (credit?.expiry_date && makeupDate > credit.expiry_date) {
      alert('補課日期超過方案期限（' + credit.expiry_date + '），無法安排')
      return
    }

    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('student_id', selectedStudent.id)
      .eq('course_id', makeupCourseId)
      .eq('date', makeupDate)

    if (existing && existing.length > 0) {
      alert('該學員在此日期已有出席記錄')
      return
    }

    const { error } = await supabase.from('attendance').insert({
      student_id: selectedStudent.id,
      course_id: makeupCourseId,
      date: makeupDate,
      status: '補課',
      deducted: true,
      credit_id: credit?.id || null,
    })

    if (error) {
      alert('安排補課失敗：' + error.message)
      return
    }

    await logStudentActivity(selectedStudent.id, 'makeup_class', {
      from_date: makeupSourceAttendance.date,
      to_course_id: makeupCourseId,
      to_date: makeupDate,
    })

    alert('補課安排成功！')
    setShowMakeupModal(false)
    setMakeupSourceAttendance(null)
    setMakeupCourseId('')
    setMakeupDate('')

    fetchCourseAttendance(selectedStudent.id)
    fetchStudentAttendance(selectedStudent.id)
  }

  const handleAttendanceStatusChange = async (attendanceId: string, studentId: string, newStatus: string) => {
    const deductedStatuses = ['出席', '缺席', '遲到']
    const deducted = deductedStatuses.includes(newStatus)

    // 請假次數檢查
    if (['請假', '病假'].includes(newStatus)) {
      const { data: creditData } = await supabase
        .from('credits')
        .select('id, leave_count, max_leave')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .limit(1)

      const credit = creditData?.[0]
      if (credit) {
        const currentLeave = credit.leave_count || 0
        const maxLeave = credit.max_leave || 0

        if (maxLeave > 0 && currentLeave >= maxLeave) {
          alert('此學員請假次數已達上限（' + currentLeave + '/' + maxLeave + '），無法再請假。\n建議安排到其他班級補課。')
          return
        }

        await supabase.from('credits').update({
          leave_count: currentLeave + 1
        }).eq('id', credit.id)
      }
    }

    // 如果從請假改回其他狀態，要扣回 leave_count
    const { data: oldAtt } = await supabase.from('attendance').select('status').eq('id', attendanceId).single()
    if (oldAtt && ['請假', '病假'].includes(oldAtt.status) && !['請假', '病假'].includes(newStatus)) {
      const { data: creditData } = await supabase
        .from('credits')
        .select('id, leave_count')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .limit(1)
      const credit = creditData?.[0]
      if (credit && (credit.leave_count || 0) > 0) {
        await supabase.from('credits').update({
          leave_count: (credit.leave_count || 0) - 1
        }).eq('id', credit.id)
      }
    }

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

    // === 更新 credits（直接加減） ===
    const delta = creditAction === 'add' ? creditAmount : -creditAmount
    await supabase.from('credits').update({
      total_credits: Math.max(0, (credit.total_credits || 0) + delta),
      remaining_credits: Math.max(0, (credit.remaining_credits || 0) + delta),
    }).eq('id', credit.id)

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

  const handleConfirmPayment = async (id: string) => {
    const { error } = await supabase
      .from('students')
      .update({ payment_status: '已繳費' })
      .eq('id', id)
    if (!error) {
      await fetchStudents()
      if (selectedStudent?.id === id) {
        setSelectedStudent((prev: any) => prev ? { ...prev, paymentStatus: '已繳費' } : null)
      }
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
      payment_status: editForm.paymentStatus,
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

  // ── 匯入歷史資料 ──
  const resetImport = () => {
    setImportStep(1)
    setImportFile(null)
    setImportSheet1([])
    setImportSheet2([])
    setImportSheet1Errors([])
    setImportSheet2Errors([])
    setImportPreviewTab(1)
    setImportProgress(0)
    setImportProgressText('')
    setImportResult(null)
    setImporting(false)
    setDragOver(false)
    setPasteText1('')
    setPasteText2('')
    setPasteErrors([])
    setPasteParsing(false)
  }

  // 民國年日期轉西元 YYYY-MM-DD
  const normalizeDate = (raw: string): string => {
    // 已經是 YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    // 民國年格式：111/3/24 或 111-3-24 或 111.3.24
    const rocMatch = raw.match(/^(\d{2,3})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
    if (rocMatch) {
      const year = parseInt(rocMatch[1]) + 1911
      const month = rocMatch[2].padStart(2, '0')
      const day = rocMatch[3].padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    return raw
  }

  const handleParsePaste = async () => {
    setPasteErrors([])
    setPasteParsing(true)

    // 偵測分隔符
    const detectDelimiter = (text: string): string => {
      const tabCount = (text.match(/\t/g) || []).length
      const commaCount = (text.match(/,/g) || []).length
      if (tabCount >= commaCount && tabCount > 0) return '\t'
      if (commaCount > 0) return ','
      // 嘗試多空格分隔（2個以上連續空格）
      const multiSpaceCount = (text.match(/  +/g) || []).length
      if (multiSpaceCount > 0) return '  +'
      return ''
    }

    const parseRows = (text: string, label: string): { rows: any[][], formatError: string | null } => {
      if (!text.trim()) return { rows: [], formatError: null }
      const delimiter = detectDelimiter(text)
      if (!delimiter) {
        return { rows: [], formatError: `${label}：格式無法辨識，請確認是從表格軟體複製的（Tab、逗號或空格分隔）` }
      }
      const rows = text.trim().split('\n')
        .map(line => {
          if (delimiter === '  +') {
            return line.split(/\s{2,}/).map(cell => cell.trim())
          }
          return line.split(delimiter).map(cell => cell.trim())
        })
        .filter(row => row.some(c => c !== ''))
      return { rows, formatError: null }
    }

    const errors: string[] = []

    const { rows: dataRows1, formatError: fe1 } = parseRows(pasteText1, '學員堂數')
    const { rows: dataRows2Raw, formatError: fe2 } = parseRows(pasteText2, '出席紀錄')
    if (fe1) errors.push(fe1)
    if (fe2) errors.push(fe2)

    // 日期正規化（民國年→西元）
    const dataRows2 = dataRows2Raw.map(row => {
      if (row[2]) row[2] = normalizeDate(String(row[2]).trim())
      return row
    })

    if (dataRows1.length === 0 && dataRows2.length === 0 && errors.length === 0) {
      errors.push('請至少貼上一種資料（學員堂數或出席紀錄）')
    }

    if (errors.length > 0) {
      setPasteErrors(errors)
      setPasteParsing(false)
      return
    }

    setImportSheet1(dataRows1)
    setImportSheet2(dataRows2)

    // 複用和 Excel 相同的驗證邏輯
    const { data: allStu } = await supabase.from('students').select('id, student_code, name')
    const { data: allCrs } = await supabase.from('courses').select('id, name')
    const studentMap = new Map((allStu || []).map(s => [s.student_code, { id: s.id, name: s.name }]))
    const courseMap = new Map((allCrs || []).map(c => [c.name, c.id]))

    const s1Errors = dataRows1.map((row, i) => {
      const code = String(row[0] || '').trim()
      const courseName = String(row[1] || '').trim()
      const total = Number(row[2])
      const used = Number(row[3])
      if (!code) return `第 ${i + 1} 行：學員編號不能為空`
      if (!studentMap.has(code)) return `第 ${i + 1} 行：找不到學員 ${code}`
      if (!courseName) return `第 ${i + 1} 行：課程名稱不能為空`
      if (!courseMap.has(courseName)) return `第 ${i + 1} 行：找不到課程「${courseName}」`
      if (!Number.isInteger(total) || total <= 0) return `第 ${i + 1} 行：總堂數必須是正整數`
      if (!Number.isInteger(used) || used < 0) return `第 ${i + 1} 行：已用堂數必須是非負整數`
      return null
    })

    const validStatuses = ['出席', '請假', '缺席', '補課']
    const s2Errors = dataRows2.map((row, i) => {
      const code = String(row[0] || '').trim()
      const courseName = String(row[1] || '').trim()
      const date = String(row[2] || '').trim()
      const status = String(row[3] || '').trim()
      if (!code) return `第 ${i + 1} 行：學員編號不能為空`
      if (!studentMap.has(code)) return `第 ${i + 1} 行：找不到學員 ${code}`
      if (!courseName) return `第 ${i + 1} 行：課程名稱不能為空`
      if (!courseMap.has(courseName)) return `第 ${i + 1} 行：找不到課程「${courseName}」`
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return `第 ${i + 1} 行：日期格式錯誤「${date}」（需 YYYY-MM-DD 或民國年如 113/3/24）`
      if (!validStatuses.includes(status)) return `第 ${i + 1} 行：狀態必須是 ${validStatuses.join('/')}`
      return null
    })

    // 收集所有驗證錯誤
    const allErrors: string[] = []
    const s1ErrList = s1Errors.filter(e => e !== null) as string[]
    const s2ErrList = s2Errors.filter(e => e !== null) as string[]
    if (s1ErrList.length > 0) allErrors.push(`【學員堂數】${s1ErrList.length} 筆錯誤：`, ...s1ErrList.slice(0, 10))
    if (s1ErrList.length > 10) allErrors.push(`...還有 ${s1ErrList.length - 10} 筆錯誤`)
    if (s2ErrList.length > 0) allErrors.push(`【出席紀錄】${s2ErrList.length} 筆錯誤：`, ...s2ErrList.slice(0, 10))
    if (s2ErrList.length > 10) allErrors.push(`...還有 ${s2ErrList.length - 10} 筆錯誤`)

    if (allErrors.length > 0) {
      setPasteErrors(allErrors)
      setPasteParsing(false)
      // 仍然設定 errors 讓 Step 2 也能看到
      setImportSheet1Errors(s1Errors.map(e => e ?? null))
      setImportSheet2Errors(s2Errors.map(e => e ?? null))
      return
    }

    setImportSheet1Errors(s1Errors.map(e => e ?? null))
    setImportSheet2Errors(s2Errors.map(e => e ?? null))
    setPasteParsing(false)
    setImportStep(2)
  }

  const handleImportFile = async (file: File) => {
    setImportFile(file)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })

      const ws1 = wb.Sheets[wb.SheetNames[0]]
      const ws2 = wb.Sheets[wb.SheetNames[1]]
      const rows1: any[][] = ws1 ? XLSX.utils.sheet_to_json(ws1, { header: 1 }) : []
      const rows2: any[][] = ws2 ? XLSX.utils.sheet_to_json(ws2, { header: 1 }) : []

      // 跳過前5行，過濾空行
      const dataRows1 = rows1.slice(5).filter(r => r.some(c => c != null && c !== ''))
      const dataRows2 = rows2.slice(5).filter(r => r.some(c => c != null && c !== ''))
      setImportSheet1(dataRows1)
      setImportSheet2(dataRows2)

      // 一次性查對照表
      const { data: allStu } = await supabase.from('students').select('id, student_code, name')
      const { data: allCrs } = await supabase.from('courses').select('id, name')
      const studentMap = new Map((allStu || []).map(s => [s.student_code, { id: s.id, name: s.name }]))
      const courseMap = new Map((allCrs || []).map(c => [c.name, c.id]))

      // 驗證 Sheet 1
      const s1Errors = dataRows1.map((row, _i) => {
        const code = String(row[0] || '').trim()
        const courseName = String(row[1] || '').trim()
        const total = Number(row[2])
        const used = Number(row[3])
        if (!code) return '學員編號不能為空'
        if (!studentMap.has(code)) return `找不到學員 ${code}`
        if (!courseName) return '課程名稱不能為空'
        if (!courseMap.has(courseName)) return `找不到課程「${courseName}」`
        if (!Number.isInteger(total) || total <= 0) return '總堂數必須是正整數'
        if (!Number.isInteger(used) || used < 0) return '已用堂數必須是非負整數'
        return null
      })
      setImportSheet1Errors(s1Errors)

      // 驗證 Sheet 2
      const validStatuses = ['出席', '請假', '缺席', '補課']
      const s2Errors = dataRows2.map((row, _i) => {
        const code = String(row[0] || '').trim()
        const courseName = String(row[1] || '').trim()
        const date = String(row[2] || '').trim()
        const status = String(row[3] || '').trim()
        if (!code) return '學員編號不能為空'
        if (!studentMap.has(code)) return `找不到學員 ${code}`
        if (!courseName) return '課程名稱不能為空'
        if (!courseMap.has(courseName)) return `找不到課程「${courseName}」`
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return `日期格式錯誤：${date}`
        if (!validStatuses.includes(status)) return `狀態必須是 ${validStatuses.join('/')}`
        return null
      })
      setImportSheet2Errors(s2Errors)

      setImportStep(2)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImportConfirm = async () => {
    setImporting(true)
    setImportStep(3)
    setImportProgress(0)

    const { data: allStu } = await supabase.from('students').select('id, student_code, name')
    const { data: allCrs } = await supabase.from('courses').select('id, name')
    const studentMap = new Map((allStu || []).map(s => [s.student_code, { id: s.id, name: s.name }]))
    const courseMap = new Map((allCrs || []).map(c => [c.name, c.id]))

    const result = {
      enrollNew: 0, enrollSkip: 0, enrollFail: 0,
      creditNew: 0, creditUpdate: 0, creditFail: 0,
      attendNew: 0, attendSkip: 0, attendFail: 0,
      failures: [] as { row: number; sheet: string; reason: string }[],
    }

    // Sheet 1
    const valid1 = importSheet1.filter((_, i) => !importSheet1Errors[i])
    for (let i = 0; i < valid1.length; i++) {
      const row = valid1[i]
      setImportProgressText(`正在處理堂數 ${i + 1}/${valid1.length}...`)
      setImportProgress(Math.round(((i + 1) / (valid1.length + importSheet2.filter((_, j) => !importSheet2Errors[j]).length)) * 100))

      const code = String(row[0]).trim()
      const courseName = String(row[1]).trim()
      const total = Number(row[2])
      const used = Number(row[3])
      const planName = String(row[5] || '歷史匯入').trim()
      const expiryDate = row[6] ? String(row[6]).trim() : null

      const stu = studentMap.get(code)
      const courseId = courseMap.get(courseName)
      if (!stu || !courseId) { result.enrollFail++; result.creditFail++; continue }

      try {
        // Enrollment
        const { data: existEnroll } = await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', stu.id)
          .eq('course_id', courseId)
          .limit(1)
        if (existEnroll && existEnroll.length > 0) {
          result.enrollSkip++
        } else {
          const { error: eErr } = await supabase.from('enrollments').insert({
            student_id: stu.id, course_id: courseId, status: '已報名', notes: '歷史資料匯入',
          })
          if (eErr) { result.enrollFail++; result.failures.push({ row: i + 6, sheet: 'Sheet1', reason: eErr.message }) }
          else result.enrollNew++
        }

        // Credits
        const { data: existCred } = await supabase
          .from('credits')
          .select('id, total_credits, used_credits')
          .eq('student_id', stu.id)
          .eq('status', 'active')
          .limit(1)

        if (existCred && existCred.length > 0) {
          const { error: cErr } = await supabase.from('credits').update({
            total_credits: existCred[0].total_credits + total,
            used_credits: existCred[0].used_credits + used,
          }).eq('id', existCred[0].id)
          if (cErr) { result.creditFail++; result.failures.push({ row: i + 6, sheet: 'Sheet1', reason: cErr.message }) }
          else result.creditUpdate++
        } else {
          const { error: cErr } = await supabase.from('credits').insert({
            student_id: stu.id,
            total_credits: total,
            used_credits: used,
            remaining_credits: total - used,
            plan_name: planName,
            expiry_date: expiryDate || null,
            purchase_date: formatLocalDate(new Date()),
            status: 'active',
            leave_count: 0,
            max_leave: 3,
            plan_weeks: 12,
          })
          if (cErr) { result.creditFail++; result.failures.push({ row: i + 6, sheet: 'Sheet1', reason: cErr.message }) }
          else result.creditNew++
        }
      } catch (err: any) {
        result.enrollFail++
        result.creditFail++
        result.failures.push({ row: i + 6, sheet: 'Sheet1', reason: err.message || '未知錯誤' })
      }
    }

    // Sheet 2
    const valid2 = importSheet2.filter((_, i) => !importSheet2Errors[i])
    for (let i = 0; i < valid2.length; i++) {
      const row = valid2[i]
      setImportProgressText(`正在處理出席紀錄 ${i + 1}/${valid2.length}...`)
      setImportProgress(Math.round(((valid1.length + i + 1) / (valid1.length + valid2.length)) * 100))

      const code = String(row[0]).trim()
      const courseName = String(row[1]).trim()
      const date = String(row[2]).trim()
      const status = String(row[3]).trim()
      const notes = row[4] ? String(row[4]).trim() : '歷史資料匯入'

      const stu = studentMap.get(code)
      const courseId = courseMap.get(courseName)
      if (!stu || !courseId) { result.attendFail++; continue }

      try {
        const { data: existAtt } = await supabase
          .from('attendance')
          .select('id')
          .eq('student_id', stu.id)
          .eq('course_id', courseId)
          .eq('date', date)
          .limit(1)
        if (existAtt && existAtt.length > 0) {
          result.attendSkip++
        } else {
          const { error: aErr } = await supabase.from('attendance').insert({
            student_id: stu.id,
            course_id: courseId,
            date,
            status,
            deducted: status === '出席' || status === '補課',
            notes,
          })
          if (aErr) { result.attendFail++; result.failures.push({ row: i + 6, sheet: 'Sheet2', reason: aErr.message }) }
          else result.attendNew++
        }
      } catch (err: any) {
        result.attendFail++
        result.failures.push({ row: i + 6, sheet: 'Sheet2', reason: err.message || '未知錯誤' })
      }
    }

    setImportProgress(100)
    setImportResult(result)
    setImportStep(4)
    setImporting(false)
  }

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
            onClick={() => { resetImport(); setShowImportModal(true) }}
          >
            <Upload size={18} />
            匯入歷史資料
          </Button>
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
        {['所有學員', '已參加', '未參加', '新註冊', '試上名單'].map(tab => (
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
      {categoryTab === '試上名單' ? (
        <AdminTrialManagement />
      ) : (
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
                  <div className="space-y-1">
                    {(student.coursesRaw && student.coursesRaw.length > 0) ? student.coursesRaw.map((c: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-neutral-900 leading-tight">{c.name}</span>
                        {c.course_code && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">{c.course_code}</span>}
                      </div>
                    )) : <p className="text-sm font-bold text-neutral-900 leading-tight">未報名</p>}
                  </div>
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
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!student.parentUid) {
                          alert('此學員尚未註冊帳號')
                          return
                        }
                        setResetPwStudent(student)
                        setResetPwResult(null)
                        setResetPwCopied(false)
                        setShowResetPwModal(true)
                      }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                      title="重設密碼"
                    >
                      <Key size={16} />
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
      )}

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
                    {selectedStudent.paymentStatus !== '已繳費' && (
                      <button
                        onClick={() => handleConfirmPayment(selectedStudent.id)}
                        className="mt-2 w-full py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 transition-colors"
                      >
                        確認收款
                      </button>
                    )}
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
                                {(enrollment.courses as any)?.course_code && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">{(enrollment.courses as any).course_code}</span>}
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
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm text-neutral-900">{course?.name || '未知課程'}</p>
                                      {course?.course_code && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">{course.course_code}</span>}
                                    </div>
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
                                          {['請假', '病假'].includes(entry.status) && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setMakeupSourceAttendance(entry)
                                                setShowMakeupModal(true)
                                              }}
                                              className='text-xs text-blue-500 hover:text-blue-700 font-medium ml-1'
                                              title='安排補課'
                                            >
                                              補課
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

      {/* 補課 Modal */}
      {showMakeupModal && makeupSourceAttendance && selectedStudent && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4' onClick={() => setShowMakeupModal(false)}>
          <div className='bg-white rounded-2xl w-full max-w-sm p-6 space-y-4' onClick={e => e.stopPropagation()}>
            <h3 className='text-lg font-bold'>安排補課</h3>
            <div className='bg-neutral-50 rounded-xl p-3 text-sm'>
              <p><span className='text-neutral-500'>學員：</span>{selectedStudent.studentName}</p>
              <p><span className='text-neutral-500'>請假日期：</span>{makeupSourceAttendance.date}</p>
            </div>

            <FormField label='選擇補課班級'>
              <Select value={makeupCourseId} onChange={e => { setMakeupCourseId(e.target.value); if (e.target.value) fetchMakeupDates(e.target.value) }}>
                <option value=''>請選擇班級</option>
                {allCourses.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.day_of_week} {c.start_time?.slice(0,5)}-{c.end_time?.slice(0,5)})</option>
                ))}
              </Select>
            </FormField>

            {makeupCourseId && (
              <FormField label='選擇補課日期'>
                {loadingMakeupDates ? (
                  <p className='text-sm text-neutral-400'>載入中...</p>
                ) : makeupAvailableDates.length === 0 ? (
                  <p className='text-sm text-neutral-400'>無可選日期</p>
                ) : (
                  <div className='flex flex-wrap gap-2'>
                    {makeupAvailableDates.map(date => (
                      <button
                        key={date}
                        onClick={() => setMakeupDate(date)}
                        className={'px-3 py-2 rounded-lg text-sm border transition-all ' + (makeupDate === date ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary')}
                      >
                        {date}
                      </button>
                    ))}
                  </div>
                )}
              </FormField>
            )}

            <div className='flex gap-3'>
              <button onClick={() => setShowMakeupModal(false)} className='flex-1 py-3 bg-neutral-100 rounded-xl'>取消</button>
              <button onClick={handleMakeupClass} disabled={!makeupCourseId || !makeupDate} className='flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50'>
                確認補課
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* 匯入歷史資料 Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => { if (!importing) { resetImport(); setShowImportModal(false) } }} />
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col mx-4 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-neutral-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900">匯入學員歷史資料</h3>
                  <p className="text-sm text-neutral-500 mt-1">上傳填好的 Excel 模板，系統會自動建立報名、堂數包和出席紀錄</p>
                </div>
                {!importing && (
                  <button onClick={() => { resetImport(); setShowImportModal(false) }} className="p-2 hover:bg-neutral-100 rounded-xl"><X size={20} /></button>
                )}
              </div>
              {/* Import Mode Tabs */}
              {importStep === 1 && (
                <div className="flex bg-neutral-100 p-1 rounded-xl mb-4">
                  <button
                    onClick={() => { setImportMode('excel'); setPasteText1(''); setPasteText2('') }}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${importMode === 'excel' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}
                  >
                    上傳 Excel
                  </button>
                  <button
                    onClick={() => { setImportMode('paste'); setImportFile(null) }}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${importMode === 'paste' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}
                  >
                    貼上資料
                  </button>
                </div>
              )}
              {/* Step Indicator */}
              <div className="flex items-center justify-between gap-2">
                {[(importMode === 'paste' && importStep === 1 ? '貼上資料' : '上傳檔案'), '資料預覽', '匯入中', '匯入結果'].map((label, i) => {
                  const s = i + 1
                  const active = importStep === s
                  const done = importStep > s
                  return (
                    <div key={s} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${active ? 'bg-primary text-white scale-110' : done ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                        {done ? <Check size={14} /> : s}
                      </div>
                      <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-neutral-400'}`}>{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Step 1: Upload or Paste */}
              {importStep === 1 && importMode === 'excel' && (
                <div className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-neutral-300 hover:border-primary'}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImportFile(f) }}
                    onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls'; inp.onchange = (ev: any) => { const f = ev.target.files?.[0]; if (f) handleImportFile(f) }; inp.click() }}
                  >
                    <Upload size={40} className="mx-auto mb-4 text-neutral-400" />
                    <p className="text-neutral-700 font-medium">拖放 Excel 檔案到此處</p>
                    <p className="text-neutral-400 text-sm mt-1">或點擊選擇 .xlsx 檔案</p>
                  </div>
                  <div className="bg-neutral-50 rounded-xl p-4 space-y-2 text-sm text-neutral-600">
                    <p className="font-bold text-neutral-700">Excel 模板格式說明</p>
                    <p>Sheet 1（學員堂數）欄位：學員編號、課程名稱、總堂數、已用堂數、剩餘堂數、方案名稱、到期日</p>
                    <p>Sheet 2（出席紀錄）欄位：學員編號、課程名稱、日期(YYYY-MM-DD)、狀態(出席/請假/缺席/補課)、備註</p>
                    <p className="text-neutral-400">前 5 行為標題列，第 6 行起為資料</p>
                  </div>
                </div>
              )}

              {importStep === 1 && importMode === 'paste' && (
                <div className="space-y-6">
                  {/* Textarea 1: 學員堂數 */}
                  <div className="space-y-2">
                    <div>
                      <p className="font-bold text-neutral-700">學員堂數資料</p>
                      <p className="text-sm text-neutral-500">從 Numbers/Excel 複製表格後貼上，每行一位學員</p>
                    </div>
                    <div className="bg-neutral-50 rounded-lg px-3 py-2 text-xs text-neutral-400 font-mono">
                      格式：學員編號 [Tab] 課程名稱 [Tab] 總堂數 [Tab] 已用堂數 [Tab] 剩餘堂數 [Tab] 方案名稱 [Tab] 到期日
                    </div>
                    <textarea
                      value={pasteText1}
                      onChange={e => setPasteText1(e.target.value)}
                      placeholder={'ST-001\t兒童班 週六 16:00\t12\t3\t9\t兒童12堂方案\t2026-06-30'}
                      className="w-full h-[200px] border border-neutral-200 rounded-xl p-4 font-mono text-sm whitespace-pre resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    />
                  </div>

                  {/* Textarea 2: 出席紀錄 */}
                  <div className="space-y-2">
                    <div>
                      <p className="font-bold text-neutral-700">出席紀錄資料</p>
                      <p className="text-sm text-neutral-500">每行一筆出席紀錄，可留空（只匯入堂數不匯入出席）</p>
                    </div>
                    <div className="bg-neutral-50 rounded-lg px-3 py-2 text-xs text-neutral-400 font-mono">
                      格式：學員編號 [Tab] 課程名稱 [Tab] 日期 [Tab] 狀態 [Tab] 備註
                    </div>
                    <textarea
                      value={pasteText2}
                      onChange={e => setPasteText2(e.target.value)}
                      placeholder={'ST-001\t兒童班 週六 16:00\t2026-01-04\t出席\t'}
                      className="w-full h-[200px] border border-neutral-200 rounded-xl p-4 font-mono text-sm whitespace-pre resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    />
                  </div>

                  {/* 錯誤回報 */}
                  {pasteErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                      <p className="text-sm font-bold text-red-700">解析錯誤，請修正後重試：</p>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {pasteErrors.map((err, i) => (
                          <p key={i} className={`text-xs ${err.startsWith('【') || err.startsWith('...') ? 'font-medium text-red-700 mt-1' : 'text-red-600'}`}>{err}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { setPasteErrors([]); handleParsePaste() }}
                    disabled={(!pasteText1.trim() && !pasteText2.trim()) || pasteParsing}
                    className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {pasteParsing ? '解析中...' : '解析資料'}
                  </button>
                </div>
              )}

              {/* Step 2: Preview */}
              {importStep === 2 && (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="flex gap-4">
                    <div className="flex-1 bg-neutral-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-neutral-500">Sheet 1 學員堂數</p>
                      <p className="font-bold">{importSheet1.length} 行</p>
                      <p className="text-xs"><span className="text-green-600">{importSheet1Errors.filter(e => !e).length} 通過</span> / <span className="text-red-500">{importSheet1Errors.filter(e => e).length} 錯誤</span></p>
                    </div>
                    <div className="flex-1 bg-neutral-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-neutral-500">Sheet 2 出席紀錄</p>
                      <p className="font-bold">{importSheet2.length} 行</p>
                      <p className="text-xs"><span className="text-green-600">{importSheet2Errors.filter(e => !e).length} 通過</span> / <span className="text-red-500">{importSheet2Errors.filter(e => e).length} 錯誤</span></p>
                    </div>
                  </div>

                  {/* Tab */}
                  <div className="flex gap-2">
                    <button onClick={() => setImportPreviewTab(1)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${importPreviewTab === 1 ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600'}`}>Sheet 1 學員堂數</button>
                    <button onClick={() => setImportPreviewTab(2)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${importPreviewTab === 2 ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600'}`}>Sheet 2 出席紀錄</button>
                  </div>

                  {/* Table */}
                  <div className="border rounded-xl overflow-x-auto max-h-[40vh] overflow-y-auto">
                    {importPreviewTab === 1 ? (
                      <table className="w-full text-xs">
                        <thead className="bg-neutral-50 sticky top-0">
                          <tr>
                            <th className="p-2 text-left font-medium">行</th>
                            <th className="p-2 text-left font-medium">狀態</th>
                            <th className="p-2 text-left font-medium">學員編號</th>
                            <th className="p-2 text-left font-medium">課程名稱</th>
                            <th className="p-2 text-left font-medium">總堂數</th>
                            <th className="p-2 text-left font-medium">已用堂數</th>
                            <th className="p-2 text-left font-medium">方案</th>
                            <th className="p-2 text-left font-medium">到期日</th>
                            <th className="p-2 text-left font-medium">錯誤原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importSheet1.map((row, i) => (
                            <tr key={i} className={importSheet1Errors[i] ? 'bg-red-50' : ''}>
                              <td className="p-2 text-neutral-400">{i + 6}</td>
                              <td className="p-2">{importSheet1Errors[i] ? <span className="text-red-500">✗</span> : <span className="text-green-500">✓</span>}</td>
                              <td className="p-2 font-mono">{row[0]}</td>
                              <td className="p-2">{row[1]}</td>
                              <td className="p-2">{row[2]}</td>
                              <td className="p-2">{row[3]}</td>
                              <td className="p-2">{row[5]}</td>
                              <td className="p-2">{row[6]}</td>
                              <td className="p-2 text-red-500">{importSheet1Errors[i]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="bg-neutral-50 sticky top-0">
                          <tr>
                            <th className="p-2 text-left font-medium">行</th>
                            <th className="p-2 text-left font-medium">狀態</th>
                            <th className="p-2 text-left font-medium">學員編號</th>
                            <th className="p-2 text-left font-medium">課程名稱</th>
                            <th className="p-2 text-left font-medium">日期</th>
                            <th className="p-2 text-left font-medium">出席狀態</th>
                            <th className="p-2 text-left font-medium">備註</th>
                            <th className="p-2 text-left font-medium">錯誤原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importSheet2.map((row, i) => (
                            <tr key={i} className={importSheet2Errors[i] ? 'bg-red-50' : ''}>
                              <td className="p-2 text-neutral-400">{i + 6}</td>
                              <td className="p-2">{importSheet2Errors[i] ? <span className="text-red-500">✗</span> : <span className="text-green-500">✓</span>}</td>
                              <td className="p-2 font-mono">{row[0]}</td>
                              <td className="p-2">{row[1]}</td>
                              <td className="p-2">{row[2]}</td>
                              <td className="p-2">{row[3]}</td>
                              <td className="p-2">{row[4]}</td>
                              <td className="p-2 text-red-500">{importSheet2Errors[i]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Footer buttons */}
                  <div className="flex gap-3">
                    <button onClick={() => { resetImport() }} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium">重新選擇</button>
                    <button onClick={handleImportConfirm} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium">
                      確認匯入（{importSheet1Errors.filter(e => !e).length} 筆堂數 + {importSheet2Errors.filter(e => !e).length} 筆出席）
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Importing */}
              {importStep === 3 && (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload size={28} className="text-primary animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-neutral-900">正在匯入資料...</p>
                    <p className="text-sm text-neutral-500 mt-1">{importProgressText}</p>
                  </div>
                  <div className="w-full max-w-md">
                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${importProgress}%` }} />
                    </div>
                    <p className="text-xs text-neutral-400 text-center mt-2">{importProgress}%</p>
                  </div>
                </div>
              )}

              {/* Step 4: Result */}
              {importStep === 4 && importResult && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center py-6">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                      <Check size={32} className="text-green-600" />
                    </div>
                    <p className="text-xl font-bold text-neutral-900">匯入完成</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-neutral-50 rounded-xl p-4 space-y-1">
                      <p className="text-sm font-bold text-neutral-700">報名紀錄</p>
                      <p className="text-xs"><span className="text-green-600 font-medium">新增 {importResult.enrollNew}</span></p>
                      <p className="text-xs"><span className="text-amber-600 font-medium">跳過 {importResult.enrollSkip}</span></p>
                      <p className="text-xs"><span className="text-red-500 font-medium">失敗 {importResult.enrollFail}</span></p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-4 space-y-1">
                      <p className="text-sm font-bold text-neutral-700">堂數包</p>
                      <p className="text-xs"><span className="text-green-600 font-medium">新增 {importResult.creditNew}</span></p>
                      <p className="text-xs"><span className="text-blue-600 font-medium">更新 {importResult.creditUpdate}</span></p>
                      <p className="text-xs"><span className="text-red-500 font-medium">失敗 {importResult.creditFail}</span></p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-4 space-y-1">
                      <p className="text-sm font-bold text-neutral-700">出席紀錄</p>
                      <p className="text-xs"><span className="text-green-600 font-medium">新增 {importResult.attendNew}</span></p>
                      <p className="text-xs"><span className="text-amber-600 font-medium">跳過 {importResult.attendSkip}</span></p>
                      <p className="text-xs"><span className="text-red-500 font-medium">失敗 {importResult.attendFail}</span></p>
                    </div>
                  </div>

                  {importResult.failures.length > 0 && (
                    <div className="bg-red-50 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-bold text-red-700">失敗詳情</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importResult.failures.map((f, i) => (
                          <p key={i} className="text-xs text-red-600">{f.sheet} 第 {f.row} 行：{f.reason}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => { resetImport(); setShowImportModal(false); fetchStudents() }} className="w-full py-3 bg-primary text-white rounded-xl font-medium">關閉</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 重設密碼 Modal */}
      {showResetPwModal && resetPwStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setShowResetPwModal(false); setResetPwResult(null); }}>
          <div className="absolute inset-0 bg-neutral-900/40" />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">重設學員密碼</h3>
              <button onClick={() => { setShowResetPwModal(false); setResetPwResult(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100">
                <X size={18} />
              </button>
            </div>

            <div className="bg-neutral-50 rounded-xl p-4 space-y-1">
              <p className="text-sm"><span className="text-neutral-500">學員姓名：</span><span className="font-medium">{resetPwStudent.studentName}</span></p>
              <p className="text-sm"><span className="text-neutral-500">學員編號：</span><span className="font-mono">{resetPwStudent.studentCode || '—'}</span></p>
            </div>

            {!resetPwResult ? (
              <>
                <p className="text-sm text-neutral-600">將為此學員產生臨時密碼，學員登入後需立即更改密碼。</p>
                <button
                  disabled={resetPwLoading}
                  onClick={async () => {
                    setResetPwLoading(true)
                    try {
                      const tempPassword = Math.random().toString(36).slice(-6).toUpperCase()
                      const { error } = await supabase.rpc('admin_reset_password', {
                        target_user_id: resetPwStudent.parentUid,
                        new_password: tempPassword,
                      })
                      if (error) {
                        alert('重設密碼失敗：' + error.message)
                        setResetPwLoading(false)
                        return
                      }
                      await supabase.from('students').update({ force_password_change: true }).eq('parent_uid', resetPwStudent.parentUid)
                      setResetPwResult(tempPassword)
                    } catch (err: any) {
                      alert('重設密碼失敗：' + (err.message || err))
                    }
                    setResetPwLoading(false)
                  }}
                  className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {resetPwLoading ? '處理中...' : '產生臨時密碼'}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-green-700 font-medium">密碼已重設成功！請將以下臨時密碼提供給學員：</p>
                <div className="relative">
                  <div className="text-2xl font-mono bg-neutral-100 p-4 rounded-xl text-center tracking-widest select-all">
                    {resetPwResult}
                  </div>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(resetPwResult)
                      setResetPwCopied(true)
                      setTimeout(() => setResetPwCopied(false), 2000)
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-neutral-200 transition-colors"
                    title="複製密碼"
                  >
                    {resetPwCopied ? <CheckCircle size={18} className="text-green-600" /> : <Copy size={18} className="text-neutral-400" />}
                  </button>
                </div>
                {resetPwCopied && <p className="text-xs text-green-600 text-center">已複製！</p>}
                <button
                  onClick={() => { setShowResetPwModal(false); setResetPwResult(null); }}
                  className="w-full py-3 bg-neutral-100 text-neutral-700 rounded-xl font-medium hover:bg-neutral-200 transition-colors"
                >
                  關閉
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
