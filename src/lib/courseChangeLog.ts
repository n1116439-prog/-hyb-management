import { supabase } from './supabase'

export async function addCourseChangeLog(
  courseId: string,
  type: string,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('course_change_logs').insert({
    course_id: courseId,
    type,
    details,
  })
  if (error) {
    console.error('[courseChangeLog] insert 失敗:', error)
  }
}
