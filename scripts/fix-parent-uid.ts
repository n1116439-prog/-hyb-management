import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!.trim()
)

async function fix() {
  const { data: students } = await supabase
    .from('students')
    .select('id, name, notes, email, parent_uid')
    .is('parent_uid', null)

  if (!students || students.length === 0) {
    console.log('沒有需要修復的記錄')
    return
  }

  for (const s of students) {
    // 從 notes 欄位解析 auth_uid
    const match = s.notes?.match(/auth_uid:\s*([a-f0-9-]+)/)
    if (match) {
      const uid = match[1]
      const { error } = await supabase
        .from('students')
        .update({ parent_uid: uid })
        .eq('id', s.id)
      console.log(`修復 ${s.name} (${s.id}) → parent_uid: ${uid}`, error ? '失敗:' + error.message : '成功')
    } else {
      console.log(`跳過 ${s.name} (${s.id}) — notes 中沒有 auth_uid`)
    }
  }
}

fix()
