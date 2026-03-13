import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!.trim()
)

async function check() {
  const tables = ['students', 'coaches', 'venues', 'courses', 'enrollments', 'venue_contracts', 'payments', 'attendance', 'credits']

  for (const table of tables) {
    const { data, count, error } = await supabase.from(table).select('*', { count: 'exact' }).limit(3)
    console.log(`\n=== ${table} (${count} 筆) ===`)
    if (error) console.log('錯誤:', error.message)
    else console.log(JSON.stringify(data, null, 2))
  }

  // 檢查 parent_uid 為空的學員
  const { data: orphanStudents } = await supabase
    .from('students')
    .select('id, name, parent_uid, email')
    .is('parent_uid', null)
  console.log('\n=== parent_uid 為空的學員 ===')
  console.log(JSON.stringify(orphanStudents, null, 2))

  // 檢查重複 email
  const { data: allStudents } = await supabase
    .from('students')
    .select('id, name, email, student_number, category')
  if (allStudents) {
    const emailCount: Record<string, number> = {}
    for (const s of allStudents) {
      if (s.email) {
        emailCount[s.email] = (emailCount[s.email] || 0) + 1
      }
    }
    const duplicates = Object.entries(emailCount).filter(([, c]) => c > 1)
    console.log('\n=== 重複 email ===')
    console.log(duplicates.length ? JSON.stringify(duplicates) : '無')

    // 檢查 student_number 格式
    const badNumbers = allStudents.filter(s => s.student_number && !/^(ST|AD)-\d+$/.test(s.student_number))
    console.log('\n=== student_number 格式不正確 ===')
    console.log(badNumbers.length ? JSON.stringify(badNumbers.map(s => ({ id: s.id, name: s.name, student_number: s.student_number }))) : '無')

    // 檢查 category 欄位
    const noCategory = allStudents.filter(s => !s.category)
    console.log('\n=== category 為空的學員 ===')
    console.log(noCategory.length ? JSON.stringify(noCategory.map(s => ({ id: s.id, name: s.name, category: s.category }))) : '無')
  }

  // 檢查 FK 一致性
  console.log('\n=== FK 一致性檢查 ===')

  // courses -> venues, coaches
  const { data: allCourses } = await supabase.from('courses').select('id, name, venue_id, coach_id')
  const { data: allVenues } = await supabase.from('venues').select('id')
  const { data: allCoaches } = await supabase.from('coaches').select('id')

  if (allCourses && allVenues && allCoaches) {
    const venueIds = new Set(allVenues.map(v => v.id))
    const coachIds = new Set(allCoaches.map(c => c.id))

    const badVenue = allCourses.filter(c => c.venue_id && !venueIds.has(c.venue_id))
    const badCoach = allCourses.filter(c => c.coach_id && !coachIds.has(c.coach_id))

    console.log('courses -> venues 孤兒:', badVenue.length ? JSON.stringify(badVenue) : '無')
    console.log('courses -> coaches 孤兒:', badCoach.length ? JSON.stringify(badCoach) : '無')
  }

  // enrollments -> students, courses
  const { data: allEnrollments } = await supabase.from('enrollments').select('id, student_id, course_id')
  if (allEnrollments && allStudents && allCourses) {
    const studentIds = new Set(allStudents.map(s => s.id))
    const courseIds = new Set(allCourses.map(c => c.id))

    const badStudent = allEnrollments.filter(e => e.student_id && !studentIds.has(e.student_id))
    const badCourse = allEnrollments.filter(e => e.course_id && !courseIds.has(e.course_id))

    console.log('enrollments -> students 孤兒:', badStudent.length ? JSON.stringify(badStudent) : '無')
    console.log('enrollments -> courses 孤兒:', badCourse.length ? JSON.stringify(badCourse) : '無')
  }
}

check()
