import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const WEEKDAY_MAP: Record<string, number> = {
  '週日': 0, '週一': 1, '週二': 2, '週三': 3,
  '週四': 4, '週五': 5, '週六': 6
}

Deno.serve(async (req) => {
  try {
    const today = new Date()
    // 檢查昨天的課程
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const yesterdayWeekday = yesterday.getDay()

    // 找出昨天星期幾對應的所有課程
    const weekdayName = Object.entries(WEEKDAY_MAP).find(([_, v]) => v === yesterdayWeekday)?.[0]
    if (!weekdayName) {
      return new Response(JSON.stringify({ message: 'No weekday match' }), { status: 200 })
    }

    const { data: courses } = await supabase
      .from('courses')
      .select('id, name')
      .eq('day_of_week', weekdayName)
      .eq('status', '招生中')

    if (!courses || courses.length === 0) {
      return new Response(JSON.stringify({ message: 'No courses yesterday', date: yesterdayStr }), { status: 200 })
    }

    let totalMarked = 0

    for (const course of courses) {
      // 檢查昨天有沒有已經點名
      const { count: existingCount } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', course.id)
        .eq('date', yesterdayStr)

      if ((existingCount || 0) > 0) continue // 已有點名紀錄，跳過

      // 讀取該課程的已報名學員
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', course.id)
        .eq('status', '已報名')

      if (!enrollments || enrollments.length === 0) continue

      // 自動標記全部出席
      const attendanceInserts = enrollments.map(e => ({
        course_id: course.id,
        student_id: e.student_id,
        date: yesterdayStr,
        status: '出席',
        deducted: true,
      }))

      const { error: insertError } = await supabase.from('attendance').insert(attendanceInserts)
      if (insertError) {
        console.error(`Course ${course.name} attendance insert error:`, insertError)
        continue
      }

      // 扣堂數
      for (const e of enrollments) {
        const { data: credit } = await supabase
          .from('credits')
          .select('id, used_credits, remaining_credits')
          .eq('student_id', e.student_id)
          .single()

        if (credit && credit.remaining_credits > 0) {
          await supabase.from('credits').update({
            used_credits: credit.used_credits + 1,
            remaining_credits: credit.remaining_credits - 1,
          }).eq('id', credit.id)
        }
      }

      totalMarked++
      console.log(`Auto-marked: ${course.name} on ${yesterdayStr}, ${enrollments.length} students`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: yesterdayStr,
        weekday: weekdayName,
        coursesChecked: courses.length,
        coursesAutoMarked: totalMarked,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Auto-attendance error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
