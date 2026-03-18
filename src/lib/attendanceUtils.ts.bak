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
 * 根據課程的 day_of_week、學員堂數，計算未來應有的上課日期，
 * 然後在 attendance 表中補建 status='待上課' 的記錄。
 *
 * 已存在的 attendance 記錄不會被覆蓋。
 * 回傳新建立的日期陣列。
 */
export async function generateAttendanceRecords(
  studentId: string,
  courseId: string,
): Promise<string[]> {
  // 1. 取課程資訊
  const { data: course } = await supabase
    .from('courses')
    .select('day_of_week')
    .eq('id', courseId)
    .single()
  if (!course) return []

  const targetDay = weekdayMap[course.day_of_week]
  if (targetDay === undefined) return []

  // 2. 取學員的 credits（用來決定總堂數）
  const { data: credits } = await supabase
    .from('credits')
    .select('total_credits, plan_weeks')
    .eq('student_id', studentId)
    .eq('status', 'active')

  if (!credits || credits.length === 0) return []

  const totalCredits = credits.reduce((sum, c) => sum + (c.total_credits || 0), 0)
  const planWeeks = credits.reduce((sum, c) => sum + (c.plan_weeks || 0), 0)
  if (totalCredits <= 0) return []

  // 3. 取該課程的停課日
  const { data: holidays } = await supabase
    .from('course_holidays')
    .select('date')
    .eq('course_id', courseId)
  const holidayDates = new Set((holidays || []).map(h => h.date))

  // 4. 取已存在的 attendance 記錄
  const { data: existingAtt } = await supabase
    .from('attendance')
    .select('date, status')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
  const existingDates = new Set((existingAtt || []).map(a => a.date))

  // 已用堂數 = 已有的非請假 attendance 記錄數
  const usedSessions = (existingAtt || []).filter(
    a => !['請假', '病假'].includes(a.status)
  ).length
  const remainingSessions = totalCredits - usedSessions
  if (remainingSessions <= 0) return []

  // 5. 從今天開始，按 day_of_week 推算未來日期
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const current = new Date(today)
  while (current.getDay() !== targetDay) {
    current.setDate(current.getDate() + 1)
  }

  const maxWeeks = planWeeks > 0 ? planWeeks : totalCredits * 3
  const newDates: string[] = []
  let sessionCount = 0
  let weekCount = 0

  while (sessionCount < remainingSessions && weekCount < maxWeeks) {
    const dateStr = formatLocalDate(current)
    if (holidayDates.has(dateStr)) {
      // 停課日跳過，不計週數
    } else {
      weekCount++
      if (!existingDates.has(dateStr)) {
        newDates.push(dateStr)
        sessionCount++
      }
    }
    current.setDate(current.getDate() + 7)
  }

  if (newDates.length === 0) return []

  // 6. 批次建立 attendance 記錄
  const inserts = newDates.map(date => ({
    student_id: studentId,
    course_id: courseId,
    date,
    status: '待上課',
    deducted: false,
  }))

  const { error } = await supabase.from('attendance').insert(inserts)
  if (error) {
    console.error('generateAttendanceRecords insert 失敗:', error)
    return []
  }

  console.log(`[attendanceUtils] 已為學員 ${studentId} 在課程 ${courseId} 建立 ${newDates.length} 筆待上課記錄`)
  return newDates
}
