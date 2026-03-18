import React, { useState, useEffect } from 'react';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  Eye, 
  Check, 
  ChevronRight,
  ChevronLeft,
  MapPin,
  Users,
  Calendar,
  UserPlus,
  UserMinus,
  History as HistoryIcon,
  Settings,
  ClipboardList,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Input, Select, Badge, ProgressBar, FormField } from './UI';
import { supabase } from '../lib/supabase';
import { generateAttendanceRecords } from '../lib/attendanceUtils';
import { Course, CourseChangeLog, VenueContract } from '../types';

interface AdminCourseManagementProps {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  contracts: VenueContract[];
}

export const AdminCourseManagement: React.FC<AdminCourseManagementProps> = ({ courses, setCourses, contracts }) => {
  const [loading, setLoading] = useState(true)
  const [coachList, setCoachList] = useState<{id: string, name: string, specialization: string}[]>([])
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [existingStudents, setExistingStudents] = useState<any[]>([])
  const [showImportStudentModal, setShowImportStudentModal] = useState(false)
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [addedStudents, setAddedStudents] = useState<any[]>([])
  const [manualStudentNumber, setManualStudentNumber] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('')
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<any>(null)
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false)
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>('')
  const [courseStudents, setCourseStudents] = useState<any[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, string>>({})
  const [existingAttendance, setExistingAttendance] = useState<any[]>([])
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
  const [makeupCourseMap, setMakeupCourseMap] = useState<Record<string, string>>({})
  const [allCoursesList, setAllCoursesList] = useState<any[]>([])
  const [studentCreditInfo, setStudentCreditInfo] = useState<Record<string, any>>({})
  const [courseHolidays, setCourseHolidays] = useState<any[]>([])
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayReason, setNewHolidayReason] = useState('')
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [importStep, setImportStep] = useState(1)
  const [importCreditSettings, setImportCreditSettings] = useState<Record<string, {
    source: 'existing' | 'manual'
    manualAmount: number
    existingRemaining: number
    selectedDates: string[]
  }>>({})
  const [importCourseDates, setImportCourseDates] = useState<string[]>([])
  const [importHolidays, setImportHolidays] = useState<string[]>([])
  const [importSaving, setImportSaving] = useState(false)

  const fetchCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('id, name, specialization')
      .eq('is_active', true)
      .order('name')
    if (data) setCoachList(data)
  }

  const fetchExistingStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, name, phone, student_code, student_number, category')
      .order('name')
    if (data) setExistingStudents(data)
  }

  const fetchStudentDetail = async (studentId: string) => {
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single()
    if (!student) return

    const { data: credit } = await supabase
      .from('credits')
      .select('*')
      .eq('student_id', studentId)
      .single()

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*, courses(name, day_of_week, start_time, end_time, venues(name))')
      .eq('student_id', studentId)
      .eq('status', '已報名')

    const { data: attendance } = await supabase
      .from('attendance')
      .select('date, status, deducted, course_id, courses(name, day_of_week, start_time, end_time, venues(name))')
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .limit(20)

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    setSelectedStudentDetail({
      ...student,
      credit,
      enrollments: enrollments || [],
      attendance: attendance || [],
      payments: payments || [],
    })
    setShowStudentDetailModal(true)
  }

  const fetchCourseHolidays = async (courseId: string) => {
    const { data } = await supabase
      .from('course_holidays')
      .select('*')
      .eq('course_id', courseId)

    if (data) {
      setCourseHolidays(data.map(h => ({
        id: h.id,
        date: h.date,
        reason: h.reason,
      })))
    }
  }

  const addHoliday = async () => {
    if (!selectedCourse || !newHolidayDate) return

    await supabase.from('course_holidays').insert({
      course_id: selectedCourse.id,
      date: newHolidayDate,
      reason: newHolidayReason || '停課',
    })

    // 自動刪除該停課日所有「待上課」的 attendance 記錄
    const { data: deleted, error } = await supabase
      .from('attendance')
      .delete()
      .eq('course_id', selectedCourse.id)
      .eq('date', newHolidayDate)
      .eq('status', '待上課')
      .select('id')
    if (deleted && deleted.length > 0) {
      console.log(`[停課] 已自動刪除 ${deleted.length} 筆待上課記錄 (${newHolidayDate})`)
    }

    setNewHolidayDate('')
    setNewHolidayReason('')
    fetchCourseHolidays(selectedCourse.id)
  }

  const removeHoliday = async (messageId: string) => {
    await supabase.from('course_holidays').delete().eq('id', messageId)
    if (selectedCourse) fetchCourseHolidays(selectedCourse.id)
  }

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
  }

  const fetchCourses = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('courses')
      .select('*, coaches(name), venues(name, address)')
      .order('name')

    // 從 enrollments 表計算每門課的實際報名人數
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('status', '已報名')

    const enrollmentCounts: Record<string, number> = {}
    enrollments?.forEach(e => {
      enrollmentCounts[e.course_id] = (enrollmentCounts[e.course_id] || 0) + 1
    })

    // 檢查每個課程的未點名狀態
    const todayDate = new Date()
    const weekdayMap: Record<string, number> = {
      '週日': 0, '週一': 1, '週二': 2, '週三': 3,
      '週四': 4, '週五': 5, '週六': 6
    }

    if (data) {
      const coursesWithStatus = await Promise.all(data.map(async (c: any) => {
        const mapped: Course = {
          id: c.id,
          name: c.name,
          category: c.category === '兒童班' ? 'children' : 'adult',
          schedule: c.day_of_week,
          time: `${c.start_time?.slice(0,5)} – ${c.end_time?.slice(0,5)}`,
          location: c.venues?.name || '',
          coaches: c.coaches ? [c.coaches.name] : [],
          thumbnail: `https://picsum.photos/seed/${c.id}/200/200`,
          currentEnrollment: enrollmentCounts[c.id] || 0,
          maxEnrollment: c.max_students || 20,
          price: c.price || 0,
          description: c.description || '',
          tags: [c.day_of_week, c.venues?.name].filter(Boolean),
          students: [],
          changeLogs: [],
          dates: [],
          attendance: {},
        }

        // 計算上一次上課日
        const targetDay = weekdayMap[c.day_of_week]
        if (targetDay !== undefined) {
          const lastClassDate = new Date(todayDate)
          while (lastClassDate.getDay() !== targetDay || lastClassDate >= todayDate) {
            lastClassDate.setDate(lastClassDate.getDate() - 1)
          }
          const lastClassDateStr = formatLocalDate(lastClassDate)

          const { count } = await supabase
            .from('attendance')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', c.id)
            .eq('date', lastClassDateStr)

          mapped.lastClassDate = lastClassDateStr
          mapped.hasAttendance = (count || 0) > 0
          mapped.needsAttendance = !mapped.hasAttendance
        }

        return mapped
      }))

      setCourses(coursesWithStatus)
    }
    setLoading(false)
  }

  const autoMarkAttendance = async () => {
    const today = new Date()
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const wdMap: Record<string, number> = {
      '週日': 0, '週一': 1, '週二': 2, '週三': 3,
      '週四': 4, '週五': 5, '週六': 6
    }

    const { data: allCourses } = await supabase
      .from('courses')
      .select('id, day_of_week')

    if (!allCourses) return

    let autoMarkedCount = 0

    for (const course of allCourses) {
      const targetDay = wdMap[course.day_of_week]
      if (targetDay === undefined) continue

      const checkDate = new Date(today)
      for (let i = 0; i < 28; i++) {
        checkDate.setDate(checkDate.getDate() - 1)
        if (checkDate.getDay() !== targetDay) continue
        if (checkDate > threeDaysAgo) continue

        const dateStr = formatLocalDate(checkDate)

        const { count } = await supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', course.id)
          .eq('date', dateStr)

        if ((count || 0) > 0) continue

        const { data: courseEnrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('course_id', course.id)
          .eq('status', '已報名')

        if (!courseEnrollments || courseEnrollments.length === 0) continue

        // 過濾有堂數的學員
        const enrolledStudentIds = courseEnrollments.map(e => e.student_id)
        const { data: validCredits } = await supabase
          .from('credits')
          .select('student_id')
          .in('student_id', enrolledStudentIds)
          .eq('status', 'active')
          .gt('remaining_credits', 0)

        const validStudentIds = validCredits?.map(c => c.student_id) || []
        if (validStudentIds.length === 0) continue

        // 只對有堂數的學員自動點名
        const attendanceInserts = validStudentIds.map(sid => ({
          course_id: course.id,
          student_id: sid,
          date: dateStr,
          status: '出席',
          deducted: true,
        }))

        // 先刪除該日期該課程的既有紀錄，避免重複寫入
        await supabase.from('attendance').delete().eq('course_id', course.id).eq('date', dateStr)

        await supabase.from('attendance').insert(attendanceInserts)

        for (const e of courseEnrollments) {
          // 扣堂數（找對應 course_id 的 credit）
          const { data: credit } = await supabase
            .from('credits')
            .select('id, used_credits, remaining_credits, status, expiry_date')
            .eq('student_id', e.student_id)
            .eq('course_id', course.id)
            .eq('status', 'active')
            .single()

          // 如果找不到對應 course_id 的，找通用的
          const creditToUse = credit || (await supabase
            .from('credits')
            .select('id, used_credits, remaining_credits, status, expiry_date')
            .eq('student_id', e.student_id)
            .is('course_id', null)
            .eq('status', 'active')
            .single()).data

          if (creditToUse && creditToUse.remaining_credits > 0) {
            // 檢查是否過期
            if (creditToUse.expiry_date && new Date(creditToUse.expiry_date) < new Date()) {
              await supabase.from('credits').update({ status: 'expired' }).eq('id', creditToUse.id)
            } else {
              await supabase.from('credits').update({
                used_credits: creditToUse.used_credits + 1,
              }).eq('id', creditToUse.id)
            }
          }
        }

        autoMarkedCount++
      }
    }

    if (autoMarkedCount > 0) {
      console.log(`自動標記 ${autoMarkedCount} 堂課出席`)
    }
  }

  useEffect(() => {
    fetchCourses()
    fetchCoaches()
    autoMarkAttendance()
  }, [])

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCategory, setImportCategory] = useState<'all' | 'children' | 'adult'>('all');
  const [importedStudents, setImportedStudents] = useState<{name: string, phone: string, category: 'children' | 'adult'}[]>([]);
  const [editTab, setEditTab] = useState<'info' | 'students' | 'coaches' | 'schedule' | 'history' | 'attendance'>('info');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCourseData, setNewCourseData] = useState<any>({
    name: '',
    category: 'children',
    location: '',
    schedule: '',
    startTime: '',
    endTime: '',
    maxEnrollment: 24,
    price: 0,
    description: '',
  });

  const handleAddCourse = async () => {
    const courseName = newCourseData.name || `${newCourseData.location || ''} ${newCourseData.schedule || ''} ${newCourseData.startTime || ''}-${newCourseData.endTime || ''}`.trim()

    const insertData: any = {
      name: courseName,
      category: newCourseData.category === 'children' ? '兒童班' : '成人班',
      coach_id: selectedCoaches[0] || null,
      day_of_week: newCourseData.schedule || null,
      max_students: newCourseData.maxEnrollment || 24,
      price: newCourseData.price || 0,
      description: newCourseData.description || '',
      status: '招生中',
    }

    if (newCourseData.startTime) insertData.start_time = newCourseData.startTime
    if (newCourseData.endTime) insertData.end_time = newCourseData.endTime

    // 場地：查找或新增
    if (newCourseData.location) {
      const { data: existingVenue } = await supabase
        .from('venues')
        .select('id')
        .eq('name', newCourseData.location)
        .single()

      if (existingVenue) {
        insertData.venue_id = existingVenue.id
      } else {
        const { data: newVenue } = await supabase
          .from('venues')
          .insert({ name: newCourseData.location })
          .select('id')
          .single()
        if (newVenue) insertData.venue_id = newVenue.id
      }
    }

    // 上傳圖片
    if (thumbnailFile) {
      try {
        const fileName = `course-${Date.now()}.${thumbnailFile.name.split('.').pop()}`
        const { data: uploadData } = await supabase.storage
          .from('course-images')
          .upload(fileName, thumbnailFile)
        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('course-images')
            .getPublicUrl(fileName)
          // thumbnailUrl available if needed
        }
      } catch (e) {
        console.log('圖片上傳失敗，使用預設圖片')
      }
    }

    const { data: courseData, error } = await supabase
      .from('courses')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      alert('新增課程失敗：' + error.message)
      return
    }

    // 匯入學員（先刪除舊記錄再 insert，避免重複衝突）
    if (courseData && addedStudents.length > 0) {
      for (const s of addedStudents) {
        await supabase.from('enrollments').delete().eq('student_id', s.id).eq('course_id', courseData.id)
      }
      await supabase.from('enrollments').insert(
        addedStudents.map(s => ({
          student_id: s.id,
          course_id: courseData.id,
          status: '已報名',
        }))
      )
      // 為每位學員自動建立待上課記錄
      for (const s of addedStudents) {
        await generateAttendanceRecords(s.id, courseData.id)
      }
    }

    alert('課程新增成功！')
    setShowAddModal(false)
    await fetchCourses()
    setStep(1)
    setSelectedCoaches([])
    setAddedStudents([])
    setThumbnailFile(null)
    setThumbnailPreview('')
    setNewCourseData({
      name: '',
      category: 'children',
      location: '',
      schedule: '',
      startTime: '',
      endTime: '',
      maxEnrollment: 24,
      price: 0,
      description: '',
    })
  };

  const filteredCourses = courses.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditClick = async (course: Course) => {
    const dates = course.dates || ['2024/03/02', '2024/03/09', '2024/03/16'];

    // 從 DB 抓取該課程的已報名學員
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, students(id, name, student_code, student_number, category)')
      .eq('course_id', course.id)
      .eq('status', '已報名')

    const enrolledStudents = (enrollments || []).map((e: any) => ({
      enrollmentId: e.id,
      studentId: e.student_id,
      name: e.students?.name || '未知',
      studentCode: e.students?.student_code || e.students?.student_number || '',
      category: e.students?.category || '',
    }))

    setSelectedCourse({
      ...course,
      students: enrolledStudents.map((s: any) => s.name),
      _enrolledStudents: enrolledStudents,
      dates: dates,
      attendance: course.attendance || {},
      changeLogs: course.changeLogs || [
        { id: 'l1', type: 'info_update', content: '更新課程說明', operator: 'Admin', timestamp: '2024-03-01 12:00' }
      ]
    });
    setSelectedDate(dates[0]);
    setEditTab('info');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCourse) return;
    const { error } = await supabase.from('courses').update({
      name: selectedCourse.name,
      category: selectedCourse.category === 'children' ? '兒童班' : '成人班',
      price: selectedCourse.price,
      description: selectedCourse.description,
      max_students: selectedCourse.maxEnrollment,
    }).eq('id', selectedCourse.id)
    if (!error) await fetchCourses()
    setShowEditModal(false);
  };

  const addLog = (course: Course, type: CourseChangeLog['type'], content: string) => {
    const newLog: CourseChangeLog = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content,
      operator: '管理員',
      timestamp: new Date().toLocaleString()
    };
    setSelectedCourse({
      ...course,
      changeLogs: [newLog, ...(course.changeLogs || [])]
    });
  };

  const handleAddStudentById = async (studentId: string, studentName: string) => {
    if (!selectedCourse || !studentId) return;
    // 先刪除舊記錄再 insert，避免重複衝突
    await supabase.from('enrollments').delete().eq('student_id', studentId).eq('course_id', selectedCourse.id)
    const { data, error } = await supabase.from('enrollments').insert({
      student_id: studentId,
      course_id: selectedCourse.id,
      status: '已報名',
    }).select('id').single()
    if (error) { alert('新增學員失敗：' + error.message); return; }

    // 自動建立待上課記錄
    await generateAttendanceRecords(studentId, selectedCourse.id)

    const enrolled = selectedCourse._enrolledStudents || []
    const student = existingStudents.find((s: any) => s.id === studentId)
    const updated = [...enrolled, {
      enrollmentId: data.id,
      studentId,
      name: studentName,
      studentCode: student?.student_code || student?.student_number || '',
      category: student?.category || '',
    }]
    setSelectedCourse({
      ...selectedCourse,
      students: updated.map((s: any) => s.name),
      _enrolledStudents: updated,
    });
    addLog(selectedCourse, 'student_add', `新增學員：${studentName}`);
  };

  const handleRemoveStudentByEnrollment = async (enrollmentId: string, studentName: string) => {
    if (!selectedCourse) return;
    const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId)
    if (error) { alert('移除學員失敗：' + error.message); return; }

    const enrolled = (selectedCourse._enrolledStudents || []).filter((s: any) => s.enrollmentId !== enrollmentId)
    setSelectedCourse({
      ...selectedCourse,
      students: enrolled.map((s: any) => s.name),
      _enrolledStudents: enrolled,
    });
    addLog(selectedCourse, 'student_remove', `移除學員：${studentName}`);
  };

  const handleAssignCoach = async (coachId: string) => {
    if (!selectedCourse) return;
    const coach = coachList.find(c => c.id === coachId)
    if (!coach) return;
    const { error } = await supabase.from('courses').update({ coach_id: coachId }).eq('id', selectedCourse.id)
    if (error) { alert('指派教練失敗：' + error.message); return; }
    setSelectedCourse({ ...selectedCourse, coaches: [coach.name], _coachId: coachId });
    addLog(selectedCourse, 'coach_add', `指派教練：${coach.name}`);
    await fetchCourses()
  };

  const handleRemoveCoach = async () => {
    if (!selectedCourse) return;
    const { error } = await supabase.from('courses').update({ coach_id: null }).eq('id', selectedCourse.id)
    if (error) { alert('移除教練失敗：' + error.message); return; }
    setSelectedCourse({ ...selectedCourse, coaches: [], _coachId: null });
    addLog(selectedCourse, 'coach_remove', `移除教練`);
    await fetchCourses()
  };

  const fetchCourseAttendance = async (courseId: string, date: string) => {
    // 1. 讀取該課程已報名的學員（含學員資料）
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*, students(id, name, student_number, student_code, category)')
      .eq('course_id', courseId)
      .eq('status', '已報名')

    if (!enrollments) {
      setCourseStudents([])
      return
    }

    // 2. 讀取每位學員的堂數資料
    const studentIds = enrollments.map((e: any) => e.students?.id).filter(Boolean)

    const { data: allCredits } = await supabase
      .from('credits')
      .select('*')
      .in('student_id', studentIds)
      .eq('status', 'active')

    // 3. 所有已報名學員都顯示，不論堂數狀態
    const enrolledStudents = enrollments
      .map((e: any) => {
        const studentId = e.students?.id
        if (!studentId) return null

        // 找到該學員對應這門課的 credits
        const courseCredit = allCredits?.find((c: any) => c.student_id === studentId && c.course_id === courseId)
        // 如果沒有對應這門課的，找通用的
        const generalCredit = allCredits?.find((c: any) => c.student_id === studentId && !c.course_id)
        const credit = courseCredit || generalCredit

        const isExpired = credit?.expiry_date && new Date(credit.expiry_date) < new Date()

        // 判斷課程類型
        let courseType: 'official' | 'trial' | 'makeup' = 'official'
        if (credit?.total_credits === 1) {
          courseType = 'trial'
        }
        // 如果這個 credit 的 course_id 不是當前課程，表示是從其他班來補課
        if (credit?.course_id && credit.course_id !== courseId) {
          courseType = 'makeup'
        }

        return {
          id: studentId,
          name: e.students?.name,
          studentNumber: e.students?.student_code || e.students?.student_number || '',
          category: e.students?.category,
          courseType,
          remainingCredits: credit?.remaining_credits ?? 0,
          totalCredits: credit?.total_credits ?? 0,
          leaveCount: credit?.leave_count || 0,
          maxLeave: credit?.max_leave || 0,
          expiryDate: credit?.expiry_date,
          creditId: credit?.id,
          isExpired: !!isExpired,
        }
      })
      .filter(Boolean)

    // 4. 讀取該日期已有的點名紀錄
    const { data: existing } = await supabase
      .from('attendance')
      .select('*, students(id, name, student_number, student_code, category)')
      .eq('course_id', courseId)
      .eq('date', date)

    if (existing) {
      setExistingAttendance(existing)
      const records: Record<string, string> = {}
      existing.forEach((a: any) => {
        records[a.student_id] = a.status
      })
      setAttendanceRecords(records)

      // 把有點名紀錄但不在 enrollments 裡的學員（補課學員）加進來
      const enrolledIds = new Set(enrolledStudents.map((s: any) => s.id))
      const extraStudents = existing
        .filter((a: any) => !enrolledIds.has(a.student_id) && a.students)
        .map((a: any) => ({
          id: a.student_id,
          name: a.students?.name,
          studentNumber: a.students?.student_code || a.students?.student_number || '',
          category: a.students?.category,
          courseType: 'makeup' as const,
          remainingCredits: 0,
          totalCredits: 0,
          leaveCount: 0,
          maxLeave: 0,
          expiryDate: null,
          creditId: null,
          isExpired: false,
        }))

      setCourseStudents([...enrolledStudents, ...extraStudents])
    } else {
      setAttendanceRecords({})
      setExistingAttendance([])
      setCourseStudents(enrolledStudents)
    }

    // 5. 讀取所有課程（補課選擇用）
    const { data: allCoursesData } = await supabase
      .from('courses')
      .select('id, name')
      .neq('id', courseId)
      .eq('status', '招生中')
    if (allCoursesData) setAllCoursesList(allCoursesData)

    // 6. 讀取歷史點名紀錄
    const { data: history } = await supabase
      .from('attendance')
      .select('date, status, students(name, student_number)')
      .eq('course_id', courseId)
      .order('date', { ascending: false })
      .limit(50)

    if (history) {
      const grouped: Record<string, any[]> = {}
      history.forEach((h: any) => {
        if (!grouped[h.date]) grouped[h.date] = []
        grouped[h.date].push(h)
      })
      setAttendanceHistory(Object.entries(grouped).slice(0, 10).map(([date, records]) => ({
        date,
        records,
        presentCount: records.filter((r: any) => r.status === '出席').length,
        totalCount: records.length,
      })))
    }
  }

  // 根據課程的 day_of_week 計算該月所有上課日
  const getCourseDatesInMonth = () => {
    if (!selectedCourse) return []

    const weekdayMap: Record<string, number> = {
      '週日': 0, '週一': 1, '週二': 2, '週三': 3,
      '週四': 4, '週五': 5, '週六': 6
    }
    const targetDay = weekdayMap[selectedCourse.schedule]
    if (targetDay === undefined) return []

    const [year, month] = attendanceMonth.split('-').map(Number)
    const dates: string[] = []
    const date = new Date(year, month - 1, 1)

    while (date.getMonth() === month - 1) {
      if (date.getDay() === targetDay) {
        dates.push(formatLocalDate(date))
      }
      date.setDate(date.getDate() + 1)
    }
    return dates
  }

  const courseDatesInMonth = getCourseDatesInMonth()
  const currentDateIndex = courseDatesInMonth.indexOf(selectedAttendanceDate)

  // 當月份改變或課程改變時，自動選擇最近的日期
  useEffect(() => {
    const dates = getCourseDatesInMonth()
    if (dates.length > 0) {
      const today = formatLocalDate(new Date())
      const closest = dates.reduce((prev, curr) =>
        Math.abs(new Date(curr).getTime() - new Date(today).getTime()) <
        Math.abs(new Date(prev).getTime() - new Date(today).getTime()) ? curr : prev
      )
      setSelectedAttendanceDate(closest)
    }
  }, [attendanceMonth, selectedCourse, editTab])

  useEffect(() => {
    if (selectedCourse && editTab === 'attendance' && selectedAttendanceDate) {
      fetchCourseAttendance(selectedCourse.id, selectedAttendanceDate)
    }
  }, [selectedCourse, editTab, selectedAttendanceDate])

  useEffect(() => {
    if (selectedCourse && (editTab === 'schedule' || editTab === 'attendance')) {
      fetchCourseHolidays(selectedCourse.id)
    }
  }, [selectedCourse, editTab])

  const saveAttendance = async () => {
    if (!selectedCourse) return
    setAttendanceSaving(true)

    for (const student of courseStudents) {
      const status = attendanceRecords[student.id]
      if (!status) continue

      // 判斷是否扣堂
      let shouldDeduct = false
      let isLeave = false
      let isMakeup = false

      switch (status) {
        case '出席':
        case '遲到':
        case '缺席':
          shouldDeduct = true
          break
        case '請假':
          isLeave = true
          {
            const courseDate = new Date(selectedAttendanceDate)
            const now = new Date()
            const diffDays = Math.ceil((courseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            shouldDeduct = diffDays < 3 // 未滿 3 天扣堂
          }
          break
        case '病假':
          isLeave = true
          shouldDeduct = false
          break
        case '補課':
          shouldDeduct = true
          isMakeup = true
          break
      }

      // 檢查是否已有紀錄
      const existing = existingAttendance.find((a: any) => a.student_id === student.id)

      if (existing) {
        // 更新
        const oldDeducted = existing.deducted
        await supabase.from('attendance').update({
          status,
          deducted: shouldDeduct,
        }).eq('id', existing.id)

        // 調整 credits
        const { data: credit } = await supabase
          .from('credits')
          .select('id, used_credits, remaining_credits, leave_count')
          .eq('student_id', student.id)
          .eq('course_id', selectedCourse.id)
          .single()

        // 如果找不到對應 course_id 的 credit，找不限課程的
        const creditToUpdate = credit || (await supabase
          .from('credits')
          .select('id, used_credits, remaining_credits, leave_count')
          .eq('student_id', student.id)
          .is('course_id', null)
          .single()).data

        if (creditToUpdate) {
          const updates: Record<string, number> = {}

          // 扣堂調整
          if (oldDeducted && !shouldDeduct) {
            updates.used_credits = Math.max(0, creditToUpdate.used_credits - 1)
          } else if (!oldDeducted && shouldDeduct) {
            updates.used_credits = creditToUpdate.used_credits + 1
          }

          // 請假次數調整
          const wasLeave = ['請假', '病假'].includes(existing.status)
          if (wasLeave && !isLeave) {
            updates.leave_count = Math.max(0, (creditToUpdate.leave_count || 0) - 1)
          } else if (!wasLeave && isLeave) {
            updates.leave_count = (creditToUpdate.leave_count || 0) + 1
          }

          if (Object.keys(updates).length > 0) {
            await supabase.from('credits').update(updates).eq('id', creditToUpdate.id)
          }
        }
      } else {
        // 新增
        const insertData: Record<string, any> = {
          course_id: selectedCourse.id,
          student_id: student.id,
          date: selectedAttendanceDate,
          status,
          deducted: shouldDeduct,
        }

        if (isMakeup && makeupCourseMap[student.id]) {
          insertData.makeup_from_course_id = makeupCourseMap[student.id]
        }

        // 先刪除同一筆紀錄，避免重複寫入
        await supabase.from('attendance').delete().eq('student_id', student.id).eq('course_id', selectedCourse.id).eq('date', selectedAttendanceDate)

        await supabase.from('attendance').insert(insertData)

        // 扣堂數 + 更新請假次數
        const { data: credit } = await supabase
          .from('credits')
          .select('id, used_credits, remaining_credits, leave_count')
          .eq('student_id', student.id)
          .eq('course_id', selectedCourse.id)
          .single()

        const creditToUpdate = credit || (await supabase
          .from('credits')
          .select('id, used_credits, remaining_credits, leave_count')
          .eq('student_id', student.id)
          .is('course_id', null)
          .single()).data

        if (creditToUpdate) {
          const updates: Record<string, number> = {}
          if (shouldDeduct) {
            updates.used_credits = creditToUpdate.used_credits + 1
          }
          if (isLeave) {
            updates.leave_count = (creditToUpdate.leave_count || 0) + 1
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from('credits').update(updates).eq('id', creditToUpdate.id)
          }
        }
      }
    }

    setAttendanceSaving(false)
    alert('點名儲存成功！')
    fetchCourseAttendance(selectedCourse.id, selectedAttendanceDate)
  }

  const handleDeleteCourse = async (id: string) => {
    if (confirm('確定要刪除此課程嗎？')) {
      const { error } = await supabase.from('courses').delete().eq('id', id)
      if (!error) await fetchCourses()
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-neutral-100">
            <Button variant="ghost" className="h-auto p-0 text-neutral-400">儀表板</Button>
            <div className="w-1 h-1 bg-neutral-300 rounded-full" />
            <Button variant="ghost" className="h-auto p-0 text-primary font-bold">課程管理</Button>
          </div>
        </div>
        <Button 
          variant="primary" 
          className="w-auto h-12 px-6 rounded-2xl shadow-lg shadow-primary/20"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={20} />
          新增課程
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <Input 
            placeholder="搜尋課程名稱、場地..." 
            className="pl-12 h-14 bg-white border-neutral-100 shadow-sm rounded-2xl"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Select className="h-14 bg-white border-neutral-100 shadow-sm rounded-2xl px-6 min-w-[140px]">
            <option>所有分類</option>
            <option>兒童班</option>
            <option>成人班</option>
          </Select>
          <Button variant="ghost" className="h-14 w-14 bg-white border border-neutral-100 shadow-sm rounded-2xl p-0">
            <Filter size={20} />
          </Button>
        </div>
      </div>

      {/* Course List */}
      <div className="bg-white rounded-[32px] shadow-sm border border-neutral-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-50">
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">課程資訊</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">時段與地點</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">教練</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">名額狀態</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {filteredCourses.map(course => (
              <tr key={course.id} className="hover:bg-neutral-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <img 
                      src={course.thumbnail} 
                      alt="" 
                      className="w-14 h-14 rounded-2xl object-cover shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={course.category === 'children' ? 'primary' : 'secondary'}>
                          {course.category === 'children' ? '兒童班' : '成人班'}
                        </Badge>
                        {course.tags.includes('招生中') && (
                          <Badge variant="accent" className="bg-emerald-50 text-emerald-600">招生中</Badge>
                        )}
                      </div>
                      <h4 className="font-bold text-neutral-900 leading-tight">
                        {course.name}
                        {course.needsAttendance && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium animate-pulse">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                            未點名 {course.lastClassDate?.slice(5)}
                          </span>
                        )}
                      </h4>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-neutral-600 font-medium">
                      <Calendar size={14} className="text-primary" />
                      <span>{course.schedule} {course.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <MapPin size={14} />
                      <span>{course.location}</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex -space-x-2">
                    {course.coaches.map((coach, i) => (
                      <div 
                        key={i} 
                        className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600"
                        title={coach}
                      >
                        {coach[0]}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="w-40 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-neutral-500">{course.currentEnrollment}/{course.maxEnrollment} 人</span>
                      <span className={course.currentEnrollment >= course.maxEnrollment ? 'text-danger' : 'text-primary'}>
                        {Math.round((course.currentEnrollment / course.maxEnrollment) * 100)}%
                      </span>
                    </div>
                    <ProgressBar 
                      current={course.currentEnrollment} 
                      max={course.maxEnrollment} 
                      color={course.currentEnrollment >= course.maxEnrollment ? 'bg-danger' : 'bg-primary'} 
                    />
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleEditClick(course)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCourse(course.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-danger/10 hover:text-danger transition-colors"
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

      {/* Edit Course Modal */}
      <AnimatePresence>
        {showEditModal && selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-10 py-8 border-b border-neutral-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">{selectedCourse.name}</h2>
                    <p className="text-sm text-neutral-500">課程編輯與異動管理</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="w-10 h-10 p-0 rounded-full"
                    onClick={() => setShowEditModal(false)}
                  >
                    <Plus className="rotate-45" size={24} />
                  </Button>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2">
                  {[
                    { id: 'info', label: '基本資訊', icon: Settings },
                    { id: 'students', label: '學員名單', icon: Users },
                    { id: 'coaches', label: '教練管理', icon: ClipboardList },
                    { id: 'schedule', label: '日期管理', icon: Calendar },
                    { id: 'attendance', label: '點名紀錄', icon: UserCheck },
                    { id: 'history', label: '異動紀錄', icon: HistoryIcon }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setEditTab(tab.id as any)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
                        editTab === tab.id 
                          ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                          : 'text-neutral-500 hover:bg-neutral-50'
                      }`}
                    >
                      <tab.icon size={18} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto px-10 py-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={editTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    {editTab === 'info' && (
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <FormField label="課程名稱">
                            <Input defaultValue={selectedCourse.name} />
                          </FormField>
                          <FormField label="上課地點">
                            <Input defaultValue={selectedCourse.location} />
                          </FormField>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField label="上課時段">
                              <Input defaultValue={selectedCourse.time} />
                            </FormField>
                            <FormField label="名額上限">
                              <Input type="number" defaultValue={selectedCourse.maxEnrollment} />
                            </FormField>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <FormField label="課程說明">
                            <textarea 
                              className="w-full min-h-[120px] p-4 rounded-2xl border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                              defaultValue={selectedCourse.description}
                            />
                          </FormField>
                          <FormField label="課程封面">
                            <div className="relative group rounded-3xl overflow-hidden aspect-video bg-neutral-100">
                              <img src={selectedCourse.thumbnail} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <label className="cursor-pointer">
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          setSelectedCourse({...selectedCourse, thumbnail: reader.result as string});
                                          addLog(selectedCourse, 'info_update', '更新課程封面');
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                  <div className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md text-white border border-white/30 font-bold text-sm hover:bg-white/30 transition-colors">
                                    更換圖片
                                  </div>
                                </label>
                              </div>
                            </div>
                          </FormField>
                        </div>
                      </div>
                    )}

                    {editTab === 'students' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">學員名單 ({selectedCourse._enrolledStudents?.length || 0})</h3>
                          <Button
                            variant="primary"
                            className="h-10 px-4 rounded-xl"
                            onClick={() => {
                              fetchExistingStudents()
                              setAddedStudents([])
                              setStudentSearchQuery('')
                              setImportStep(1)
                              setImportCreditSettings({})
                              setShowImportStudentModal(true)
                            }}
                          >
                            <UserPlus size={18} />
                            匯入學員
                          </Button>
                        </div>

                        <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-2xl overflow-hidden">
                          {(selectedCourse._enrolledStudents || []).map((student: any) => (
                            <div
                              key={student.enrollmentId}
                              className="flex items-center justify-between px-4 h-12 bg-white group cursor-pointer hover:bg-neutral-50 transition-colors"
                              onClick={() => fetchStudentDetail(student.studentId)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                  student.category === 'adult' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {student.name?.[0]}
                                </div>
                                <span className="font-medium text-sm text-neutral-900">{student.name}</span>
                                {student.studentCode && (
                                  <span className="text-xs text-neutral-400">{student.studentCode}</span>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveStudentByEnrollment(student.enrollmentId, student.name); }}
                                className="p-1.5 text-neutral-300 hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <UserMinus size={16} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {(selectedCourse._enrolledStudents || []).length === 0 && (
                          <div className="text-center py-8 text-neutral-400 text-sm">尚無已報名學員</div>
                        )}
                      </div>
                    )}

                    {editTab === 'coaches' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">授課教練 ({selectedCourse.coaches.length})</h3>
                          {selectedCourse.coaches.length === 0 && (
                            <div className="flex gap-2 items-center">
                              <Select
                                className="h-10 rounded-xl min-w-[200px]"
                                id="coach-select"
                                defaultValue=""
                              >
                                <option value="" disabled>選擇教練...</option>
                                {coachList.map(coach => (
                                  <option key={coach.id} value={coach.id}>{coach.name}</option>
                                ))}
                              </Select>
                              <Button
                                variant="primary"
                                className="h-10 px-4 rounded-xl"
                                onClick={() => {
                                  const select = document.getElementById('coach-select') as HTMLSelectElement;
                                  if (select.value) handleAssignCoach(select.value);
                                }}
                              >
                                <Plus size={18} />
                              </Button>
                            </div>
                          )}
                        </div>

                        {selectedCourse.coaches.length > 0 ? (
                          <div className="space-y-4">
                            {selectedCourse.coaches.map((coach, i) => (
                              <div key={i} className="flex items-center justify-between p-6 rounded-3xl bg-neutral-50 border border-neutral-100">
                                <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center font-bold text-primary text-xl shadow-sm">
                                    {coach[0]}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-neutral-900">{coach}</h4>
                                    <p className="text-xs text-neutral-500">專業羽球教練</p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  className="text-danger hover:bg-danger/10"
                                  onClick={() => handleRemoveCoach()}
                                >
                                  <Trash2 size={18} />
                                  移除
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-neutral-400 text-sm">尚未指派教練</div>
                        )}
                      </div>
                    )}

                    {editTab === 'schedule' && selectedCourse && (
                      <div className="space-y-6">
                        {/* 月份選擇 + 課程日曆 */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <button onClick={() => {
                              const [y, m] = scheduleMonth.split('-').map(Number)
                              setScheduleMonth(m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2, '0')}`)
                            }} className="p-2 hover:bg-neutral-100 rounded-lg">←</button>
                            <p className="font-bold">{scheduleMonth.replace('-', ' 年 ')} 月</p>
                            <button onClick={() => {
                              const [y, m] = scheduleMonth.split('-').map(Number)
                              setScheduleMonth(m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2, '0')}`)
                            }} className="p-2 hover:bg-neutral-100 rounded-lg">→</button>
                          </div>

                          {/* 顯示該月所有上課日 */}
                          {(() => {
                            const weekdayMap: Record<string, number> = {
                              '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6
                            }
                            const targetDay = weekdayMap[selectedCourse.schedule]
                            const [year, month] = scheduleMonth.split('-').map(Number)
                            const dates: string[] = []
                            const d = new Date(year, month - 1, 1)
                            while (d.getMonth() === month - 1) {
                              if (d.getDay() === targetDay) dates.push(formatLocalDate(d))
                              d.setDate(d.getDate() + 1)
                            }

                            return (
                              <div className="grid grid-cols-4 gap-2">
                                {dates.map((date, idx) => {
                                  const holiday = courseHolidays.find(h => h.date === date)
                                  const isPast = new Date(date) < new Date(new Date().setHours(0,0,0,0))
                                  return (
                                    <div key={date} className={`rounded-xl p-3 text-center border-2 ${
                                      holiday ? 'bg-red-50 border-red-300' : isPast ? 'bg-neutral-50 border-neutral-200' : 'bg-white border-primary/20'
                                    }`}>
                                      <p className="text-xs text-neutral-500">第{idx + 1}週</p>
                                      <p className="font-bold text-sm">{date.slice(5)}</p>
                                      <p className="text-xs text-neutral-500">{selectedCourse.schedule}</p>
                                      {holiday ? (
                                        <div className="mt-1">
                                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">停課</span>
                                          <p className="text-xs text-red-500 mt-0.5">{holiday.reason}</p>
                                          <button onClick={() => removeHoliday(holiday.id)} className="text-xs text-red-400 underline mt-1">取消停課</button>
                                        </div>
                                      ) : !isPast ? (
                                        <button onClick={() => {
                                          setNewHolidayDate(date)
                                          setNewHolidayReason('')
                                        }} className="text-xs text-primary mt-1">標記停課</button>
                                      ) : (
                                        <span className="text-xs text-green-500 mt-1 block">已上課</span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}
                        </div>

                        {/* 新增停課表單 */}
                        {newHolidayDate && (
                          <div className="bg-red-50 rounded-xl p-4 space-y-3">
                            <p className="font-bold text-red-700">標記停課 — {newHolidayDate}</p>
                            <FormField label="停課原因">
                              <Input
                                value={newHolidayReason}
                                onChange={e => setNewHolidayReason(e.target.value)}
                                placeholder="例如：國定假日、場館維修"
                              />
                            </FormField>
                            <div className="flex gap-2">
                              <button onClick={() => setNewHolidayDate('')} className="flex-1 py-2 bg-white rounded-lg border text-sm">取消</button>
                              <button onClick={addHoliday} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">確認停課</button>
                            </div>
                          </div>
                        )}

                        {/* 停課列表 */}
                        {courseHolidays.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-neutral-700 mb-2">已標記的停課日</p>
                            <div className="space-y-2">
                              {courseHolidays.map(h => (
                                <div key={h.id} className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                                  <div>
                                    <p className="font-medium text-sm text-red-700">{h.date}</p>
                                    <p className="text-xs text-red-500">{h.reason}</p>
                                  </div>
                                  <button onClick={() => removeHoliday(h.id)} className="text-xs text-red-400 hover:text-red-600">移除</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {editTab === 'attendance' && (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          {/* 月份選擇 */}
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => {
                                const [y, m] = attendanceMonth.split('-').map(Number)
                                const prev = m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2, '0')}`
                                setAttendanceMonth(prev)
                              }}
                              className="p-2 hover:bg-neutral-100 rounded-lg"
                            >
                              ←
                            </button>
                            <div className="text-center">
                              <p className="font-bold text-lg">{attendanceMonth.replace('-', ' 年 ')} 月</p>
                              <p className="text-sm text-neutral-500">
                                {selectedCourse?.schedule} · {selectedCourse?.time} · 共 {courseDatesInMonth.length} 堂
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                const [y, m] = attendanceMonth.split('-').map(Number)
                                const next = m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2, '0')}`
                                setAttendanceMonth(next)
                              }}
                              className="p-2 hover:bg-neutral-100 rounded-lg"
                            >
                              →
                            </button>
                          </div>

                          {/* 上課日期列表 */}
                          {courseDatesInMonth.length > 0 ? (
                            <div className="space-y-3">
                              {/* 上週/下週快捷鍵 */}
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => {
                                    if (currentDateIndex > 0) {
                                      setSelectedAttendanceDate(courseDatesInMonth[currentDateIndex - 1])
                                    }
                                  }}
                                  disabled={currentDateIndex <= 0}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50"
                                >
                                  ← 上週
                                </button>
                                <span className="text-sm font-medium text-neutral-600">
                                  第 {currentDateIndex + 1} / {courseDatesInMonth.length} 週
                                </span>
                                <button
                                  onClick={() => {
                                    if (currentDateIndex < courseDatesInMonth.length - 1) {
                                      setSelectedAttendanceDate(courseDatesInMonth[currentDateIndex + 1])
                                    }
                                  }}
                                  disabled={currentDateIndex >= courseDatesInMonth.length - 1}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50"
                                >
                                  下週 →
                                </button>
                              </div>

                              {/* 日期橫向選擇器 */}
                              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                {courseDatesInMonth.map((date, idx) => {
                                  const d = new Date(date)
                                  const isSelected = date === selectedAttendanceDate
                                  const isPast = d < new Date(new Date().setHours(0,0,0,0))
                                  const isHoliday = courseHolidays.some(h => h.date === date)
                                  return (
                                    <button
                                      key={date}
                                      onClick={() => !isHoliday && setSelectedAttendanceDate(date)}
                                      className={`flex-shrink-0 w-20 py-3 rounded-xl text-center transition-all ${
                                        isHoliday
                                          ? 'bg-red-50 text-red-400 cursor-not-allowed'
                                          : isSelected
                                            ? 'bg-primary text-white shadow-md'
                                            : isPast
                                              ? 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                                              : 'bg-white border border-neutral-200 text-neutral-700 hover:border-primary'
                                      }`}
                                    >
                                      <p className="text-xs font-medium">{`第${idx + 1}週`}</p>
                                      <p className="text-sm font-bold mt-0.5">{`${d.getMonth()+1}/${d.getDate()}`}</p>
                                      <p className="text-xs mt-0.5">{selectedCourse?.schedule}</p>
                                      {isHoliday && <p className="text-xs text-red-400 mt-0.5">停課</p>}
                                    </button>
                                  )
                                })}
                              </div>

                              {/* 當前選擇的日期資訊 */}
                              {selectedAttendanceDate && (
                                <div className="bg-primary/5 rounded-xl p-3 flex items-center justify-between">
                                  <div>
                                    <p className="font-bold text-primary">{selectedAttendanceDate}</p>
                                    <p className="text-sm text-neutral-600">{selectedCourse?.schedule} {selectedCourse?.time}</p>
                                  </div>
                                  <p className="text-sm text-neutral-500">{courseStudents.length} 位學員</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-6 text-neutral-500">
                              <p>本月沒有上課日</p>
                              <p className="text-sm mt-1">請確認課程的上課星期設定</p>
                            </div>
                          )}
                        </div>

                        {/* 點名表 */}
                        {courseStudents.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-bold text-neutral-900">學員點名</p>
                              <div className="flex gap-1 text-xs">
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">出席</span>
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded">缺席</span>
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">請假</span>
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">遲到</span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">病假</span>
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">補課</span>
                              </div>
                            </div>

                            {courseStudents.map(student => (
                              <div key={student.id} className="bg-white border rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                      student.category === 'adult' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {student.name?.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm">{student.name}</p>
                                        <span className="text-xs text-neutral-500">{student.studentNumber}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                          student.courseType === 'trial' ? 'bg-orange-100 text-orange-600' :
                                          student.courseType === 'makeup' ? 'bg-purple-100 text-purple-600' :
                                          'bg-blue-100 text-blue-600'
                                        }`}>
                                          {student.courseType === 'trial' ? '試上' : student.courseType === 'makeup' ? '補課' : '正式'}
                                        </span>
                                      </div>
                                      <div className="flex gap-2 mt-0.5">
                                        <span className="text-xs text-neutral-500">
                                          剩餘 {student.remainingCredits}/{student.totalCredits} 堂
                                        </span>
                                        {student.leaveCount > 0 && (
                                          <span className={`text-xs ${
                                            student.leaveCount >= student.maxLeave ? 'text-red-500 font-bold' : 'text-yellow-600'
                                          }`}>
                                            請假 {student.leaveCount}/{student.maxLeave}
                                            {student.leaveCount >= student.maxLeave && ' ⚠️'}
                                          </span>
                                        )}
                                        {student.expiryDate && (
                                          <span className={`text-xs ${
                                            new Date(student.expiryDate) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                                              ? 'text-red-500' : 'text-neutral-400'
                                          }`}>
                                            到期 {student.expiryDate}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  {['出席', '缺席', '請假', '遲到', '病假', '補課'].map(status => {
                                    const colorMap: Record<string, string> = {
                                      '出席': attendanceRecords[student.id] === status ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 border border-green-200',
                                      '缺席': attendanceRecords[student.id] === status ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 border border-red-200',
                                      '請假': attendanceRecords[student.id] === status ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 border border-yellow-200',
                                      '遲到': attendanceRecords[student.id] === status ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-700 border border-orange-200',
                                      '病假': attendanceRecords[student.id] === status ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200',
                                      '補課': attendanceRecords[student.id] === status ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-700 border border-purple-200',
                                    }
                                    return (
                                      <button
                                        key={status}
                                        onClick={() => setAttendanceRecords(prev => ({ ...prev, [student.id]: status }))}
                                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${colorMap[status]}`}
                                      >
                                        {status}
                                      </button>
                                    )
                                  })}
                                </div>
                                {attendanceRecords[student.id] === '補課' && (
                                  <div className="mt-2">
                                    <select
                                      value={makeupCourseMap[student.id] || ''}
                                      onChange={e => setMakeupCourseMap(prev => ({ ...prev, [student.id]: e.target.value }))}
                                      className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-purple-50"
                                    >
                                      <option value="">選擇補課班級</option>
                                      {allCoursesList.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* 一鍵全選 */}
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => {
                                  const all: Record<string, string> = {}
                                  courseStudents.forEach(s => { all[s.id] = '出席' })
                                  setAttendanceRecords(all)
                                }}
                                className="flex-1 py-2 text-sm font-medium bg-green-50 text-green-700 rounded-lg border border-green-200"
                              >
                                全部出席
                              </button>
                              <button
                                onClick={() => setAttendanceRecords({})}
                                className="flex-1 py-2 text-sm font-medium bg-neutral-50 text-neutral-600 rounded-lg border border-neutral-200"
                              >
                                清除全部
                              </button>
                            </div>

                            {/* 儲存按鈕 */}
                            <button
                              onClick={saveAttendance}
                              disabled={attendanceSaving || Object.keys(attendanceRecords).length === 0}
                              className="w-full py-3 bg-primary text-white font-bold rounded-xl disabled:opacity-50 transition-colors hover:bg-blue-700"
                            >
                              {attendanceSaving ? '儲存中...' : '儲存點名'}
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-neutral-500">
                            <p>此課程沒有已購買堂數的學員</p>
                            <p className="text-sm mt-1">學員需要先在前端購買堂數，才會出現在點名表</p>
                          </div>
                        )}

                        {/* 歷史點名紀錄 */}
                        {attendanceHistory.length > 0 && (
                          <div className="space-y-3">
                            <p className="font-bold text-neutral-900">歷史點名紀錄</p>
                            {attendanceHistory.map(day => (
                              <div key={day.date} className="bg-neutral-50 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="font-medium text-sm">{day.date}</p>
                                  <p className="text-xs text-neutral-500">
                                    出席 {day.presentCount}/{day.totalCount}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {day.records.map((r: any, idx: number) => {
                                    const colorMap: Record<string, string> = {
                                      '出席': 'bg-green-100 text-green-700',
                                      '缺席': 'bg-red-100 text-red-700',
                                      '請假': 'bg-yellow-100 text-yellow-700',
                                      '遲到': 'bg-orange-100 text-orange-700',
                                      '病假': 'bg-blue-100 text-blue-700',
                                      '補課': 'bg-purple-100 text-purple-700',
                                    }
                                    return (
                                      <span key={idx} className={`text-xs px-2 py-1 rounded ${colorMap[r.status] || 'bg-neutral-100'}`}>
                                        {r.students?.name} {r.status}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {editTab === 'history' && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">異動紀錄</h3>
                        <div className="space-y-4">
                          {(selectedCourse.changeLogs || []).map(log => (
                            <div key={log.id} className="flex gap-4 p-6 rounded-3xl bg-neutral-50 border border-neutral-100">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                log.type.includes('add') ? 'bg-emerald-100 text-emerald-600' : 
                                log.type.includes('remove') ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'
                              }`}>
                                {log.type.includes('student') ? <Users size={20} /> : 
                                 log.type.includes('coach') ? <ClipboardList size={20} /> : <Settings size={20} />}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-neutral-900">{log.content}</span>
                                  <span className="text-xs text-neutral-400">{log.timestamp}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-neutral-500">
                                  <Badge variant="neutral" className="py-0">{log.operator}</Badge>
                                  <span>執行了此項操作</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-8 border-t border-neutral-100 flex items-center justify-end gap-4 bg-neutral-50/50">
                {editTab === 'attendance' ? (
                  <div className="flex gap-3 w-full">
                    <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 text-neutral-500 font-medium">
                      關閉
                    </button>
                    <button
                      onClick={saveAttendance}
                      disabled={attendanceSaving || Object.keys(attendanceRecords).length === 0 || !selectedAttendanceDate}
                      className="flex-1 py-3 bg-primary text-white font-bold rounded-xl disabled:opacity-50"
                    >
                      {attendanceSaving ? '儲存中...' : '儲存點名'}
                    </button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      className="w-auto px-8 h-12 rounded-2xl"
                      onClick={() => setShowEditModal(false)}
                    >
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      className="w-auto px-12 h-12 rounded-2xl shadow-lg shadow-primary/20"
                      onClick={handleSaveEdit}
                    >
                      儲存變更
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Course Modal (Step-by-Step) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-10 py-8 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">新增課程</h2>
                  <p className="text-sm text-neutral-500">請按照步驟填寫課程資訊</p>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        step === i ? 'bg-primary text-white scale-110' :
                        step > i ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      {step > i ? <Check size={14} /> : i}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto px-10 py-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    {step === 1 && (
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 1：填寫課程資料</h3>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <FormField label="課程名稱">
                              <Input
                                placeholder="例如：中和 [景新國小] 週六 10:00-12:00"
                                value={newCourseData.name || ''}
                                onChange={e => setNewCourseData((prev: any) => ({ ...prev, name: e.target.value }))}
                              />
                            </FormField>
                          </div>
                          <div className="w-32">
                            <FormField label="課程分類">
                              <select
                                value={newCourseData.category || 'children'}
                                onChange={e => setNewCourseData((prev: any) => ({ ...prev, category: e.target.value }))}
                                className="w-full px-3 py-3 border border-neutral-300 rounded-xl"
                              >
                                <option value="children">兒童班</option>
                                <option value="adult">成人班</option>
                              </select>
                            </FormField>
                          </div>
                        </div>

                        <FormField label="場地名稱">
                          <Input
                            placeholder="例如：景新國小、頭湖國小"
                            value={newCourseData.location || ''}
                            onChange={e => setNewCourseData((prev: any) => ({ ...prev, location: e.target.value }))}
                          />
                        </FormField>

                        <div className="flex gap-3">
                          <div className="flex-1">
                            <FormField label="上課星期">
                              <select
                                value={newCourseData.schedule || ''}
                                onChange={e => setNewCourseData((prev: any) => ({ ...prev, schedule: e.target.value }))}
                                className="w-full px-3 py-3 border border-neutral-300 rounded-xl"
                              >
                                <option value="">請選擇</option>
                                <option value="週一">週一</option>
                                <option value="週二">週二</option>
                                <option value="週三">週三</option>
                                <option value="週四">週四</option>
                                <option value="週五">週五</option>
                                <option value="週六">週六</option>
                                <option value="週日">週日</option>
                              </select>
                            </FormField>
                          </div>
                          <div className="flex-1">
                            <FormField label="名額上限">
                              <Input
                                type="number"
                                value={newCourseData.maxEnrollment || 24}
                                onChange={e => setNewCourseData((prev: any) => ({ ...prev, maxEnrollment: parseInt(e.target.value) || 24 }))}
                              />
                            </FormField>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-1">
                            <FormField label="開始時間">
                              <Input
                                type="time"
                                value={newCourseData.startTime || ''}
                                onChange={e => setNewCourseData((prev: any) => ({ ...prev, startTime: e.target.value }))}
                              />
                            </FormField>
                          </div>
                          <div className="flex-1">
                            <FormField label="結束時間">
                              <Input
                                type="time"
                                value={newCourseData.endTime || ''}
                                onChange={e => setNewCourseData((prev: any) => ({ ...prev, endTime: e.target.value }))}
                              />
                            </FormField>
                          </div>
                        </div>

                        <FormField label="課程說明（選填）">
                          <textarea
                            placeholder="課程介紹..."
                            value={newCourseData.description || ''}
                            onChange={e => setNewCourseData((prev: any) => ({ ...prev, description: e.target.value }))}
                            className="w-full px-4 py-3 border border-neutral-300 rounded-xl resize-none h-20"
                          />
                        </FormField>

                        <FormField label="課程照片（選填）">
                          <div
                            className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors"
                            onClick={() => document.getElementById('thumbnail-upload')?.click()}
                          >
                            {thumbnailPreview ? (
                              <img src={thumbnailPreview} alt="預覽" className="w-full h-32 object-cover rounded-lg" />
                            ) : (
                              <p className="text-sm text-neutral-500">點擊上傳課程照片</p>
                            )}
                            <input id="thumbnail-upload" type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
                          </div>
                        </FormField>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 2：選擇教練</h3>
                        {coachList.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                            <Users size={32} className="mb-2 opacity-20" />
                            <p className="text-sm">尚無教練，請先到教練管理新增</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {coachList.map(coach => {
                              const isSelected = selectedCoaches.includes(coach.id);
                              return (
                              <div
                                key={coach.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedCoaches(prev => prev.filter(id => id !== coach.id));
                                  } else {
                                    setSelectedCoaches(prev => [...prev, coach.id]);
                                  }
                                }}
                                className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                                  isSelected ? 'border-primary bg-primary/5' : 'border-neutral-100 hover:border-primary/30'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                    isSelected ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600'
                                  }`}>
                                    {coach.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-neutral-900">{coach.name}</p>
                                    <Badge variant="accent" className="text-[10px] py-0">{coach.specialization || '認證教練'}</Badge>
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  className="w-5 h-5 rounded border-neutral-300 text-primary focus:ring-primary"
                                />
                              </div>
                            )})}
                          </div>
                        )}
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">步驟 3：匯入學員（可跳過）</h3>
                          <Button variant="ghost" className="text-primary text-sm font-bold" onClick={() => {
                            fetchExistingStudents();
                            setShowImportStudentModal(true);
                          }}>
                            <Plus size={16} /> 匯入現有學員
                          </Button>
                        </div>
                        <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100">
                          <p className="text-sm font-bold text-neutral-900 mb-4 text-center">已加入學員 ({addedStudents.length})</p>
                          {addedStudents.length > 0 ? (
                            <div className="space-y-2">
                              {addedStudents.map((student) => (
                                <div key={student.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-100">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                                      {student.name?.[0] || '?'}
                                    </div>
                                    <div>
                                      <p className="font-bold text-neutral-900 text-sm">{student.name}</p>
                                      <p className="text-xs text-neutral-500">{student.student_code || ''} {student.phone ? `· ${student.phone}` : ''}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setAddedStudents(prev => prev.filter(a => a.id !== student.id))}
                                    className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                              <Users size={32} className="mb-2 opacity-20" />
                              <p className="text-xs">尚未加入任何學員</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {step === 4 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 4：確認刊登</h3>
                        <div className="space-y-4">
                          <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between">
                              <span className="text-neutral-500">課程名稱</span>
                              <span className="font-medium">{newCourseData.name || `${newCourseData.location} ${newCourseData.schedule} ${newCourseData.startTime}-${newCourseData.endTime}`}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">分類</span>
                              <span className="font-medium">{newCourseData.category === 'children' ? '兒童班' : '成人班'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">場地</span>
                              <span className="font-medium">{newCourseData.location || '未填'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">時間</span>
                              <span className="font-medium">{newCourseData.schedule} {newCourseData.startTime}-{newCourseData.endTime}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">名額上限</span>
                              <span className="font-medium">{newCourseData.maxEnrollment || 24} 人</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">教練</span>
                              <span className="font-medium">{coachList.filter(c => selectedCoaches.includes(c.id)).map(c => c.name).join('、') || '未選擇'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">已加入學員</span>
                              <span className="font-medium">{addedStudents.length} 人</span>
                            </div>
                          </div>

                          {thumbnailPreview && (
                            <img src={thumbnailPreview} alt="課程照片" className="w-full h-40 object-cover rounded-xl" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 text-primary">
                          <Check size={20} className="shrink-0" />
                          <p className="text-xs font-medium">確認無誤後點擊「確認刊登」，課程將立即顯示在前端報名頁面。</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-8 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                {step === 3 ? (
                  <div className="flex gap-3 w-full">
                    <button onClick={() => setStep(2)} className="flex-1 py-3 text-neutral-500 font-medium">
                      上一步
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      className="flex-1 py-3 bg-neutral-100 rounded-xl text-neutral-600 font-medium"
                    >
                      跳過
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      className="flex-1 py-3 bg-primary text-white rounded-xl font-medium"
                    >
                      下一步
                    </button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      className="w-auto px-8 h-12 rounded-2xl"
                      onClick={() => step > 1 ? setStep(step - 1) : setShowAddModal(false)}
                    >
                      {step === 1 ? '取消' : <><ChevronLeft size={18} /> 上一步</>}
                    </Button>
                    <Button
                      variant="primary"
                      className="w-auto px-12 h-12 rounded-2xl shadow-lg shadow-primary/20"
                      onClick={() => {
                        if (step === 1) {
                          if (!newCourseData.name && !newCourseData.location) { alert('請填寫課程名稱或場地'); return }
                          if (!newCourseData.schedule) { alert('請選擇上課星期'); return }
                          if (!newCourseData.startTime || !newCourseData.endTime) { alert('請填寫開始和結束時間'); return }
                          setStep(2)
                        } else if (step < 4) {
                          setStep(step + 1)
                        } else {
                          handleAddCourse()
                        }
                      }}
                    >
                      {step === 4 ? '確認刊登' : <>下一步 <ChevronRight size={18} /></>}
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Detail Modal */}
      {showStudentDetailModal && selectedStudentDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowStudentDetailModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* 頭部 */}
            <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                    selectedStudentDetail.category === 'adult' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedStudentDetail.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold">{selectedStudentDetail.name}</h3>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{selectedStudentDetail.student_number}</span>
                    </div>
                    <p className="text-sm text-neutral-500 mt-1">
                      {selectedStudentDetail.category === 'adult' ? '成人學員' : '兒童學員'}
                      {selectedStudentDetail.school ? ` · ${selectedStudentDetail.school}` : ''}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {selectedStudentDetail.phone} · {selectedStudentDetail.email}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowStudentDetailModal(false)} className="text-neutral-400 hover:text-neutral-600 text-xl">✕</button>
              </div>

              {/* 堂數和繳費摘要 */}
              <div className="flex gap-3">
                <div className="flex-1 bg-white rounded-xl p-3">
                  <p className="text-xs text-neutral-500">剩餘堂數</p>
                  <p className="text-2xl font-bold text-primary">
                    {selectedStudentDetail.credit?.remaining_credits || 0}
                    <span className="text-sm font-normal text-neutral-400"> / {selectedStudentDetail.credit?.total_credits || 0} 堂</span>
                  </p>
                  {selectedStudentDetail.credit?.total_credits > 0 && (
                    <div className="w-full bg-neutral-100 rounded-full h-1.5 mt-2">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${((selectedStudentDetail.credit?.remaining_credits || 0) / (selectedStudentDetail.credit?.total_credits || 1)) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-white rounded-xl p-3">
                  <p className="text-xs text-neutral-500">繳費狀態</p>
                  <p className={`text-lg font-bold ${selectedStudentDetail.payments?.length > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {selectedStudentDetail.payments?.length > 0 ? '已繳費' : '尚未繳費'}
                  </p>
                </div>
              </div>
            </div>

            {/* 報名課程 */}
            <div className="p-6 border-b">
              <p className="font-bold text-neutral-900 mb-3">報名班級 ({selectedStudentDetail.enrollments.length})</p>
              {selectedStudentDetail.enrollments.length > 0 ? (
                <div className="space-y-2">
                  {selectedStudentDetail.enrollments.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between bg-neutral-50 rounded-lg p-3">
                      <div>
                        <p className="font-medium text-sm">{e.courses?.name}</p>
                        <p className="text-xs text-neutral-500">
                          {e.courses?.day_of_week} {e.courses?.start_time?.slice(0,5)}-{e.courses?.end_time?.slice(0,5)} · {e.courses?.venues?.name}
                        </p>
                      </div>
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full">上課中</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">尚未報名任何課程</p>
              )}
            </div>

            {/* 堂數使用紀錄 */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-neutral-900">堂數使用紀錄</p>
                <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded-full">
                  共 {selectedStudentDetail.attendance.length} 筆
                </span>
              </div>
              {selectedStudentDetail.attendance.length > 0 ? (
                <div className="space-y-2">
                  {selectedStudentDetail.attendance.map((a: any, idx: number) => {
                    const colorMap: Record<string, { bg: string, text: string }> = {
                      '出席': { bg: 'bg-green-50', text: 'text-green-600' },
                      '缺席': { bg: 'bg-red-50', text: 'text-red-600' },
                      '請假': { bg: 'bg-yellow-50', text: 'text-yellow-600' },
                      '遲到': { bg: 'bg-orange-50', text: 'text-orange-600' },
                      '病假': { bg: 'bg-blue-50', text: 'text-blue-600' },
                      '補課': { bg: 'bg-purple-50', text: 'text-purple-600' },
                    }
                    const color = colorMap[a.status] || { bg: 'bg-neutral-50', text: 'text-neutral-600' }

                    return (
                      <div key={idx} className={`${color.bg} rounded-lg p-3`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-center min-w-[50px]">
                              <p className="text-sm font-bold text-neutral-900">{a.date?.slice(5)}</p>
                              <p className="text-xs text-neutral-500">{a.courses?.day_of_week}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-neutral-900">
                                {a.courses?.name || '未知課程'}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {a.courses?.venues?.name || ''} · {a.courses?.start_time?.slice(0,5)}-{a.courses?.end_time?.slice(0,5)}
                                {' · '}{selectedStudentDetail.student_number}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {a.deducted && (
                              <span className="text-xs text-neutral-400">-1堂</span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${color.text} ${color.bg} border ${
                              a.status === '出席' ? 'border-green-200' :
                              a.status === '缺席' ? 'border-red-200' :
                              a.status === '請假' ? 'border-yellow-200' :
                              a.status === '遲到' ? 'border-orange-200' :
                              a.status === '病假' ? 'border-blue-200' :
                              a.status === '補課' ? 'border-purple-200' : 'border-neutral-200'
                            }`}>
                              {a.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 bg-neutral-50 rounded-xl text-neutral-400 text-sm">
                  尚無出缺席紀錄
                </div>
              )}
            </div>

            {/* 詳細資訊 */}
            <div className="p-6">
              <p className="font-bold text-neutral-900 mb-3">詳細資訊</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '性別', value: selectedStudentDetail.gender || '未填寫' },
                  { label: '出生日期', value: selectedStudentDetail.birth_date || '未填寫' },
                  { label: '就讀學校', value: selectedStudentDetail.school || '未填寫' },
                  { label: '緊急聯絡人', value: selectedStudentDetail.emergency_contact || '未填寫' },
                  { label: '緊急電話', value: selectedStudentDetail.emergency_phone || '未填寫' },
                  { label: '備註', value: selectedStudentDetail.notes || '無' },
                ].map(item => (
                  <div key={item.label} className="bg-neutral-50 rounded-lg p-3">
                    <p className="text-xs text-neutral-500">{item.label}</p>
                    <p className="font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Students Modal */}
      {showImportStudentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">匯入現有學員</h3>
              <div className="flex items-center gap-2 mt-3">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      importStep >= s ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-400'
                    }`}>{s}</div>
                    <span className={`text-xs ${importStep >= s ? 'text-primary font-medium' : 'text-neutral-400'}`}>
                      {s === 1 ? '選擇學員' : s === 2 ? '設定堂數' : '確認匯入'}
                    </span>
                    {s < 3 && <div className="w-6 h-0.5 bg-neutral-200 mx-1" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: 選擇學員 */}
            {importStep === 1 && (
              <>
                <div className="p-4 border-b space-y-3">
                  <input
                    type="text"
                    placeholder="搜尋學員姓名或電話..."
                    value={studentSearchQuery}
                    onChange={e => setStudentSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg text-sm outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="輸入學生編碼（如 ST-001）"
                      value={manualStudentNumber}
                      onChange={e => setManualStudentNumber(e.target.value)}
                      className="flex-1 px-4 py-2 border rounded-lg text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => {
                        const found = existingStudents.find(s => s.student_code === manualStudentNumber)
                        if (found && !addedStudents.find(a => a.id === found.id)) {
                          setAddedStudents(prev => [...prev, found])
                          setManualStudentNumber('')
                        } else if (!found) {
                          alert('找不到此學生編碼')
                        }
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                    >
                      加入
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {existingStudents
                    .filter(s => {
                      const q = studentSearchQuery.toLowerCase()
                      return !q || s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.student_code?.toLowerCase().includes(q)
                    })
                    .map(student => {
                      const isAdded = addedStudents.find(a => a.id === student.id)
                      return (
                        <div key={student.id}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isAdded ? 'bg-primary/5 border-primary' : 'hover:bg-neutral-50 border-neutral-100'}`}
                          onClick={() => {
                            if (isAdded) {
                              setAddedStudents(prev => prev.filter(a => a.id !== student.id))
                            } else {
                              setAddedStudents(prev => [...prev, student])
                            }
                          }}
                        >
                          <div>
                            <p className="font-medium text-sm">{student.name}</p>
                            <p className="text-xs text-neutral-500">{student.student_code || ''} {student.phone ? `· ${student.phone}` : ''}</p>
                          </div>
                          {isAdded && <span className="text-primary font-bold">✓</span>}
                        </div>
                      )
                    })}
                  {existingStudents.length === 0 && (
                    <p className="text-center text-neutral-500 py-8">尚無學員資料</p>
                  )}
                </div>

                <div className="p-4 border-t flex gap-3">
                  <button onClick={() => setShowImportStudentModal(false)} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium text-sm">
                    取消
                  </button>
                  <button
                    disabled={addedStudents.length === 0}
                    onClick={async () => {
                      // 進入 Step 2：載入每位學員的 credits 與課程日期
                      const studentIds = addedStudents.map(s => s.id)
                      const { data: allCredits } = await supabase.from('credits').select('*').in('student_id', studentIds).eq('status', 'active')
                      const { data: holidays } = await supabase.from('course_holidays').select('date').eq('course_id', selectedCourse?.id)

                      const holidayDates = (holidays || []).map((h: any) => h.date)
                      setImportHolidays(holidayDates)

                      // 生成課程所有可上課日期
                      const weekdayMap: Record<string, number> = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 }
                      const targetDay = weekdayMap[selectedCourse?.schedule || '']
                      const dates: string[] = []
                      if (targetDay !== undefined) {
                        const start = new Date()
                        start.setHours(0, 0, 0, 0)
                        // 往前推 6 個月到往後推 12 個月的範圍
                        const rangeStart = new Date(start)
                        rangeStart.setMonth(rangeStart.getMonth() - 6)
                        const rangeEnd = new Date(start)
                        rangeEnd.setMonth(rangeEnd.getMonth() + 12)
                        const current = new Date(rangeStart)
                        while (current.getDay() !== targetDay) current.setDate(current.getDate() + 1)
                        while (current <= rangeEnd) {
                          const dateStr = formatLocalDate(current)
                          if (!holidayDates.includes(dateStr)) {
                            dates.push(dateStr)
                          }
                          current.setDate(current.getDate() + 7)
                        }
                      }
                      setImportCourseDates(dates)

                      // 初始化每位學員的設定
                      const settings: typeof importCreditSettings = {}
                      for (const student of addedStudents) {
                        const studentCredits = allCredits?.filter((c: any) => c.student_id === student.id) || []
                        const remaining = studentCredits.reduce((sum: number, c: any) => sum + (c.remaining_credits || 0), 0)
                        settings[student.id] = {
                          source: remaining > 0 ? 'existing' : 'manual',
                          manualAmount: 0,
                          existingRemaining: remaining,
                          selectedDates: [],
                        }
                      }
                      setImportCreditSettings(settings)
                      setImportStep(2)
                    }}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm ${addedStudents.length > 0 ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-400'}`}
                  >
                    下一步 ({addedStudents.length})
                  </button>
                </div>
              </>
            )}

            {/* Step 2: 設定堂數與劃位 */}
            {importStep === 2 && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {addedStudents.map(student => {
                    const setting = importCreditSettings[student.id]
                    if (!setting) return null
                    const maxCredits = setting.source === 'existing' ? setting.existingRemaining : setting.manualAmount
                    const today = formatLocalDate(new Date())

                    return (
                      <div key={student.id} className="border border-neutral-200 rounded-2xl p-4 space-y-3">
                        {/* 學員資訊 */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {student.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{student.name}</p>
                            <p className="text-xs text-neutral-500">{student.student_code || ''}</p>
                          </div>
                        </div>

                        {/* 堂數來源選擇 */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-neutral-700">堂數來源</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setImportCreditSettings(prev => ({
                                ...prev,
                                [student.id]: { ...setting, source: 'existing', selectedDates: setting.selectedDates.slice(0, setting.existingRemaining) }
                              }))}
                              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                                setting.source === 'existing' ? 'border-primary bg-primary/5 text-primary' : 'border-neutral-200 text-neutral-500'
                              }`}
                            >
                              使用現有堂數（剩餘 {setting.existingRemaining}）
                            </button>
                            <button
                              onClick={() => setImportCreditSettings(prev => ({
                                ...prev,
                                [student.id]: { ...setting, source: 'manual', selectedDates: setting.selectedDates.slice(0, setting.manualAmount || 0) }
                              }))}
                              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                                setting.source === 'manual' ? 'border-primary bg-primary/5 text-primary' : 'border-neutral-200 text-neutral-500'
                              }`}
                            >
                              手動輸入
                            </button>
                          </div>
                          {setting.source === 'manual' && (
                            <input
                              type="number"
                              min={1}
                              placeholder="輸入堂數"
                              value={setting.manualAmount || ''}
                              onChange={e => {
                                const val = parseInt(e.target.value) || 0
                                setImportCreditSettings(prev => ({
                                  ...prev,
                                  [student.id]: { ...setting, manualAmount: val, selectedDates: setting.selectedDates.slice(0, val) }
                                }))
                              }}
                              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-primary"
                            />
                          )}
                        </div>

                        {/* 日期劃位 */}
                        {maxCredits > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-neutral-700">
                                劃位日期 <span className={`${setting.selectedDates.length === maxCredits ? 'text-green-600' : 'text-primary'}`}>
                                  已選 {setting.selectedDates.length} / {maxCredits} 堂
                                </span>
                              </p>
                              <button
                                onClick={() => {
                                  const futureDates = importCourseDates.filter(d => d >= today)
                                  const autoSelected = futureDates.slice(0, maxCredits)
                                  setImportCreditSettings(prev => ({
                                    ...prev,
                                    [student.id]: { ...setting, selectedDates: autoSelected }
                                  }))
                                }}
                                className="text-xs text-primary font-medium hover:underline"
                              >
                                自動劃位
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                              {importCourseDates.map(date => {
                                const isSelected = setting.selectedDates.includes(date)
                                const isPast = date < today
                                const isFull = !isSelected && setting.selectedDates.length >= maxCredits
                                return (
                                  <button
                                    key={date}
                                    disabled={isPast || (isFull && !isSelected)}
                                    onClick={() => {
                                      setImportCreditSettings(prev => ({
                                        ...prev,
                                        [student.id]: {
                                          ...setting,
                                          selectedDates: isSelected
                                            ? setting.selectedDates.filter(d => d !== date)
                                            : [...setting.selectedDates, date].sort()
                                        }
                                      }))
                                    }}
                                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                                      isPast ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed' :
                                      isSelected ? 'bg-primary text-white' :
                                      isFull ? 'bg-neutral-50 text-neutral-300 cursor-not-allowed' :
                                      'bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-primary'
                                    }`}
                                  >
                                    {date.slice(5)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="p-4 border-t flex gap-3">
                  <button onClick={() => setImportStep(1)} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium text-sm">
                    上一步
                  </button>
                  <button
                    disabled={!addedStudents.every(s => {
                      const setting = importCreditSettings[s.id]
                      if (!setting) return false
                      const max = setting.source === 'existing' ? setting.existingRemaining : setting.manualAmount
                      return max > 0 && setting.selectedDates.length > 0
                    })}
                    onClick={() => setImportStep(3)}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm ${
                      addedStudents.every(s => {
                        const setting = importCreditSettings[s.id]
                        if (!setting) return false
                        const max = setting.source === 'existing' ? setting.existingRemaining : setting.manualAmount
                        return max > 0 && setting.selectedDates.length > 0
                      }) ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-400'
                    }`}
                  >
                    下一步
                  </button>
                </div>
              </>
            )}

            {/* Step 3: 確認匯入 */}
            {importStep === 3 && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {addedStudents.map(student => {
                    const setting = importCreditSettings[student.id]
                    if (!setting) return null
                    const maxCredits = setting.source === 'existing' ? setting.existingRemaining : setting.manualAmount

                    return (
                      <div key={student.id} className="border border-neutral-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {student.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{student.name}</p>
                              <p className="text-xs text-neutral-500">{student.student_code || ''}</p>
                            </div>
                          </div>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                            {setting.selectedDates.length} 堂
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500">
                          <p>堂數來源：{setting.source === 'existing' ? `使用現有堂數（剩餘 ${setting.existingRemaining}）` : `手動新增 ${setting.manualAmount} 堂`}</p>
                          <p>劃位日期：{setting.selectedDates.map(d => d.slice(5)).join('、')}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="p-4 border-t flex gap-3">
                  <button onClick={() => setImportStep(2)} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium text-sm">
                    上一步
                  </button>
                  <button
                    disabled={importSaving}
                    onClick={async () => {
                      if (!selectedCourse) return
                      setImportSaving(true)

                      try {
                        for (const student of addedStudents) {
                          const setting = importCreditSettings[student.id]
                          if (!setting) continue

                          // 1. 手動堂數：新增 credits 記錄
                          if (setting.source === 'manual' && setting.manualAmount > 0) {
                            const expiryDate = new Date()
                            expiryDate.setDate(expiryDate.getDate() + setting.manualAmount * 7 + 14)
                            await supabase.from('credits').insert({
                              student_id: student.id,
                              course_id: selectedCourse.id,
                              total_credits: setting.manualAmount,
                              used_credits: 0,
                              remaining_credits: setting.manualAmount,
                              leave_count: 0,
                              max_leave: 4,
                              plan_weeks: setting.manualAmount + 5,
                              expiry_date: formatLocalDate(expiryDate),
                              status: 'active',
                            })
                          }

                          // 2. 刪除舊 enrollment 再 insert
                          await supabase.from('enrollments').delete().eq('student_id', student.id).eq('course_id', selectedCourse.id)
                          await supabase.from('enrollments').insert({
                            student_id: student.id,
                            course_id: selectedCourse.id,
                            status: '已報名',
                          })

                          // 3. 為每個已選日期 insert attendance（先刪再插避免重複）
                          for (const date of setting.selectedDates) {
                            await supabase.from('attendance').delete()
                              .eq('student_id', student.id)
                              .eq('course_id', selectedCourse.id)
                              .eq('date', date)
                            await supabase.from('attendance').insert({
                              course_id: selectedCourse.id,
                              student_id: student.id,
                              date,
                              status: '待上課',
                              deducted: false,
                            })
                          }
                        }

                        alert('匯入成功！')
                        setShowImportStudentModal(false)
                        setImportStep(1)
                        setAddedStudents([])
                        setImportCreditSettings({})
                        await fetchCourses()
                      } catch (err: any) {
                        alert('匯入失敗：' + (err?.message || '未知錯誤'))
                      } finally {
                        setImportSaving(false)
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm ${importSaving ? 'bg-neutral-300 text-neutral-500' : 'bg-primary text-white'}`}
                  >
                    {importSaving ? '匯入中...' : `確認匯入 (${addedStudents.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
