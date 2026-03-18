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
 * 已停用：不再預建 attendance 紀錄。
 * 保留函式簽名以維持相容性，回傳 0。
 */
export async function batchCreateAttendanceForDate(
  _courseId: string,
  _date: string,
): Promise<number> {
  return 0
}

/**
 * 已停用：不再預建 attendance 紀錄。
 * 保留函式簽名以維持相容性，回傳 0。
 */
export async function batchDeletePendingAttendanceForDate(
  _courseId: string,
  _date: string,
): Promise<number> {
  return 0
}
