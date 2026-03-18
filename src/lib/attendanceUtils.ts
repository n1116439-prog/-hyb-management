import { supabase } from './supabase'

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const weekdayMap: Record<string, number> = {
  '週日': 0, '週一': 1, '週二': 2, '週三': 3,
  '週四': 4, '週五': 5, '週六': 6,
}

/**
 * 已停用：attendance 表現在只記錄已發生的出缺席，
 * 前端 SessionsPage 會自動計算未來日程，不再預建任何 attendance 紀錄。
 */
export async function generateAttendanceRecords(
  _studentId: string,
  _courseId: string,
): Promise<string[]> {
  return []
}

/**
 * 根據合約 (venue_contracts) 產生課程日期列表。
 */
export async function generateCourseDatesFromContract(
  courseId: string,
): Promise<{ dates: string[]; contractStart: string; contractEnd: string } | null> {
  // 取課程資訊
  const { data: course } = await supabase
    .from('courses')
    .select('day_of_week')
    .eq('id', courseId)
    .single()
  if (!course) return null

  const targetDay = weekdayMap[course.day_of_week]
  if (targetDay === undefined) return null

  // 取合約
  const { data: contracts } = await supabase
    .from('venue_contracts')
    .select('start_date, end_date')
    .eq('course_id', courseId)
    .order('start_date', { ascending: true })

  if (!contracts || contracts.length === 0) return null

  const contractStart = contracts[0].start_date
  const contractEnd = contracts[contracts.length - 1].end_date

  // 取停課日
  const { data: holidays } = await supabase
    .from('course_holidays')
    .select('date')
    .eq('course_id', courseId)
  const holidayDates = new Set((holidays || []).map((h: { date: string }) => h.date))

  // 產生日期
  const dates: string[] = []
  const start = new Date(contractStart + 'T00:00:00')
  const end = new Date(contractEnd + 'T00:00:00')

  const current = new Date(start)
  while (current.getDay() !== targetDay) {
    current.setDate(current.getDate() + 1)
  }

  while (current <= end) {
    const dateStr = formatLocalDate(current)
    if (!holidayDates.has(dateStr)) {
      dates.push(dateStr)
    }
    current.setDate(current.getDate() + 7)
  }

  return { dates, contractStart, contractEnd }
}

/**
 * 為指定課程+日期，批次建立所有已報名學員的 attendance 紀錄。
 * 已存在紀錄的學員會跳過。
 */
export async function batchCreateAttendanceForDate(
  courseId: string,
  date: string,
  status: string = '出席',
): Promise<number> {
  // 1. 查所有已報名的 student_id
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('course_id', courseId)
    .eq('status', '已報名')
  if (!enrollments || enrollments.length === 0) return 0

  // 2. 查該日期已存在的 student_id
  const { data: existing } = await supabase
    .from('attendance')
    .select('student_id')
    .eq('course_id', courseId)
    .eq('date', date)
  const existingSet = new Set((existing || []).map(a => a.student_id))

  // 3. 過濾掉已存在的
  const inserts = enrollments
    .filter(e => !existingSet.has(e.student_id))
    .map(e => ({
      student_id: e.student_id,
      course_id: courseId,
      date,
      status,
      deducted: status === '出席',
    }))

  if (inserts.length === 0) return 0

  // 4. 批次 insert
  const { error } = await supabase.from('attendance').insert(inserts)
  if (error) {
    console.error('[attendanceUtils] batchCreateAttendanceForDate 失敗:', error)
    return 0
  }

  return inserts.length
}

/**
 * 刪除指定課程+日期中 status='待上課' 的 attendance 紀錄。
 */
export async function batchDeletePendingAttendanceForDate(
  courseId: string,
  date: string,
): Promise<number> {
  // 1. 查詢待刪除的紀錄數量
  const { data: pending } = await supabase
    .from('attendance')
    .select('id')
    .eq('course_id', courseId)
    .eq('date', date)
    .eq('status', '待上課')

  const count = pending?.length || 0
  if (count === 0) return 0

  // 2. 刪除
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('course_id', courseId)
    .eq('date', date)
    .eq('status', '待上課')

  if (error) {
    console.error('[attendanceUtils] batchDeletePendingAttendanceForDate 失敗:', error)
    return 0
  }

  return count
}
