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
 * 根據合約 (venue_contracts) 或 fallback 產生課程日期列表。
 */
export async function generateCourseDatesFromContract(
  courseId: string,
): Promise<{ dates: string[]; contractStart: string; contractEnd: string } | null> {
  const { data: course } = await supabase
    .from('courses')
    .select('day_of_week, venue_id')
    .eq('id', courseId)
    .single()
  if (!course) return null

  const targetDay = weekdayMap[course.day_of_week]
  if (targetDay === undefined) return null

  let rangeStart!: Date
  let rangeEnd!: Date
  let fromContract = false

  // 優先從合約取日期範圍
  if (course.venue_id) {
    const { data: contracts } = await supabase
      .from('venue_contracts')
      .select('start_date, end_date')
      .eq('venue_id', course.venue_id)
      .order('end_date', { ascending: false })
      .limit(1)

    if (contracts && contracts.length > 0) {
      rangeStart = new Date(contracts[0].start_date + 'T00:00:00')
      rangeEnd = new Date(contracts[0].end_date + 'T00:00:00')
      fromContract = true
    }
  }

  // fallback：從 attendance 推算
  if (!fromContract) {
    const { data: existingAtt } = await supabase
      .from('attendance')
      .select('date')
      .eq('course_id', courseId)
      .order('date', { ascending: true })

    const existingDates = (existingAtt || []).map(a => a.date).sort()

    if (existingDates.length > 0) {
      rangeStart = new Date(existingDates[0] + 'T00:00:00')
      const lastDate = new Date(existingDates[existingDates.length - 1] + 'T00:00:00')
      rangeEnd = new Date(lastDate)
      rangeEnd.setDate(rangeEnd.getDate() + 12 * 7)
    } else {
      rangeStart = new Date()
      rangeStart.setHours(0, 0, 0, 0)
      while (rangeStart.getDay() !== targetDay) {
        rangeStart.setDate(rangeStart.getDate() + 1)
      }
      rangeEnd = new Date(rangeStart)
      rangeEnd.setDate(rangeEnd.getDate() + 24 * 7)
    }
  }

  // 生成每週日期
  const dates: string[] = []
  const current = new Date(rangeStart)
  while (current.getDay() !== targetDay) {
    current.setDate(current.getDate() + 1)
  }
  while (current <= rangeEnd) {
    dates.push(formatLocalDate(current))
    current.setDate(current.getDate() + 7)
  }

  return {
    dates,
    contractStart: formatLocalDate(rangeStart),
    contractEnd: formatLocalDate(rangeEnd),
  }
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
