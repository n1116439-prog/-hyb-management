import React, { useState, useEffect } from 'react';
import { User, History } from 'lucide-react';
import { Badge, Button } from './UI';
import { supabase } from '../lib/supabase';
import { WaitlistEntry, Course } from '../types';

interface SessionsPageProps {
  courses: Course[];
  userRole: 'user' | 'admin' | 'student';
  waitlists: WaitlistEntry[];
  userCategory?: 'child' | 'adult' | '';
}

export function SessionsPage({ courses, userRole, waitlists, userCategory }: SessionsPageProps) {
  const [studentCredits, setStudentCredits] = useState<{
    id: string
    name: string
    studentNumber: string
    category: string
    totalCredits: number
    usedCredits: number
    remainingCredits: number
    leaveCount: number
    maxLeave: number
    expiryDate: string
    planWeeks: number
    courses: {
      id: string
      courseName: string
      schedule: string
      time: string
      location: string
      nextClassDate: string
    }[]
    attendance: {
      date: string
      status: string
      deducted: boolean
      courseName: string
      schedule: string
      time: string
      location: string
    }[]
  }[]>([])
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)
  const [activeStudentTab, setActiveStudentTab] = useState<Record<string, 'courses' | 'records'>>({})

  const fetchEnrollments = async (studentIds: string[], studentList: any[]) => {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('*, courses(name, category, day_of_week, start_time, end_time, price, venues(name))')
      .in('student_id', studentIds)
      .eq('status', '已報名')
      .order('enrolled_at', { ascending: false })

    // 讀取每位學員的堂數
    const { data: credits } = await supabase
      .from('credits')
      .select('*')
      .in('student_id', studentIds)

    // 讀取每位學員的出缺席紀錄
    const { data: allAttendance } = await supabase
      .from('attendance')
      .select('*, courses(name, day_of_week, start_time, end_time, venues(name))')
      .in('student_id', studentIds)
      .order('date', { ascending: false })

    setStudentCredits(studentList.map((s: any) => {
      const credit = credits?.find((c: any) => c.student_id === s.id)
      const studentEnrollments = enrollments?.filter((e: any) => e.student_id === s.id) || []
      const studentAttendance = allAttendance?.filter((a: any) => a.student_id === s.id) || []

      return {
        id: s.id,
        name: s.name,
        studentNumber: s.student_code || s.student_number || '',
        category: s.category || 'child',
        totalCredits: credit?.total_credits || 0,
        usedCredits: credit?.used_credits || 0,
        remainingCredits: credit?.remaining_credits || 0,
        leaveCount: credit?.leave_count || 0,
        maxLeave: credit?.max_leave || 0,
        expiryDate: credit?.expiry_date || '',
        planWeeks: credit?.plan_weeks || 0,
        courses: studentEnrollments.map((e: any) => {
          const weekdayMap: Record<string, number> = {
            '週日': 0, '週一': 1, '週二': 2, '週三': 3,
            '週四': 4, '週五': 5, '週六': 6
          }
          const targetDay = weekdayMap[e.courses?.day_of_week || '']
          let nextClassDate = ''
          if (targetDay !== undefined) {
            const next = new Date()
            while (next.getDay() !== targetDay) {
              next.setDate(next.getDate() + 1)
            }
            nextClassDate = `${next.getMonth()+1}/${next.getDate()}`
          }
          return {
            id: e.id,
            courseName: e.courses?.name || '未知',
            schedule: e.courses?.day_of_week || '',
            time: e.courses?.start_time && e.courses?.end_time
              ? `${e.courses.start_time.slice(0, 5)}-${e.courses.end_time.slice(0, 5)}`
              : '',
            location: e.courses?.venues?.name || '',
            nextClassDate,
          }
        }),
        attendance: studentAttendance.map((a: any) => ({
          date: a.date,
          status: a.status,
          deducted: a.deducted,
          courseName: a.courses?.name || '',
          schedule: a.courses?.day_of_week || '',
          time: a.courses?.start_time && a.courses?.end_time
            ? `${a.courses.start_time.slice(0, 5)}-${a.courses.end_time.slice(0, 5)}`
            : '',
          location: a.courses?.venues?.name || '',
        })),
      }
    }))
  }

  const fetchSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: myStudents } = await supabase
      .from('students')
      .select('id, name, student_number, student_code, category')
      .eq('parent_uid', user.id)

    if (!myStudents || myStudents.length === 0) {
      const { data: emailMatch } = await supabase
        .from('students')
        .select('id, name, student_number, student_code, category')
        .eq('email', user.email)

      if (!emailMatch || emailMatch.length === 0) return

      await fetchEnrollments(emailMatch.map(s => s.id), emailMatch)
    } else {
      await fetchEnrollments(myStudents.map(s => s.id), myStudents)
    }
  }

  useEffect(() => {
    fetchSessions()

    // 訂閱 credits 變化，自動刷新
    const channel = supabase
      .channel('credits-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credits' }, () => {
        console.log('Credits changed, refetching...')
        fetchSessions()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (userRole === 'user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
          <History size={40} className="text-neutral-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">請登入會員查看我的課程</h2>
        <p className="text-neutral-500 mb-8 text-center">登入後即可查看您的課程明細與候補狀態。</p>
        <div className="flex gap-4 w-full max-w-sm">
          <Button className="whitespace-nowrap" onClick={() => window.dispatchEvent(new CustomEvent('open-login'))}>
            立即登入
          </Button>
          <Button className="whitespace-nowrap" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('open-register'))}>
            註冊帳號
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-6 px-4">
      {/* 我的堂數 — 每位學員一張卡片，含課程列表 */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-neutral-900">我的堂數</h3>

        {studentCredits.map(student => (
          <div key={student.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            {/* 學員基本資訊（點擊展開/收合）*/}
            <div
              className="p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
              onClick={() => setExpandedStudentId(prev => prev === student.id ? null : student.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    student.category === 'adult' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {student.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-neutral-900">{student.name}</p>
                      <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{student.studentNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        student.category === 'adult' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {student.category === 'adult' ? '成人' : '兒童'}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 mt-0.5">
                      剩餘 <span className={`font-bold ${student.remainingCredits <= 3 && student.totalCredits > 0 ? 'text-orange-500' : 'text-primary'}`}>{student.remainingCredits}</span> 堂
                      {student.totalCredits > 0 && ` / 共 ${student.totalCredits} 堂`}
                      {' · '}{student.courses.length} 門課程
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {student.remainingCredits <= 3 && student.totalCredits > 0 && (
                    <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-full font-medium">堂數不足</span>
                  )}
                  <svg className={`w-5 h-5 text-neutral-400 transition-transform ${expandedStudentId === student.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 展開的課程列表 + 堂數紀錄 */}
            {expandedStudentId === student.id && (
              <div className="border-t border-neutral-100">
                {/* Tab 切換 */}
                <div className="flex border-b border-neutral-100">
                  <button
                    onClick={() => setActiveStudentTab(prev => ({ ...prev, [student.id]: 'courses' }))}
                    className={`flex-1 py-2 text-sm font-medium text-center transition-colors ${
                      (activeStudentTab[student.id] || 'courses') === 'courses'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-neutral-500'
                    }`}
                  >
                    我的課程
                  </button>
                  <button
                    onClick={() => setActiveStudentTab(prev => ({ ...prev, [student.id]: 'records' }))}
                    className={`flex-1 py-2 text-sm font-medium text-center transition-colors ${
                      activeStudentTab[student.id] === 'records'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-neutral-500'
                    }`}
                  >
                    堂數紀錄
                  </button>
                </div>

                {/* 我的課程 tab */}
                {(activeStudentTab[student.id] || 'courses') === 'courses' && (
                  <div>
                    {student.courses.length > 0 ? (
                      <div className="divide-y divide-neutral-100">
                        {student.courses.map(course => (
                          <div key={course.id} className="px-4 py-3 flex items-center justify-between hover:bg-neutral-50">
                            <div>
                              <p className="font-medium text-neutral-900">{course.courseName}</p>
                              <p className="text-sm text-neutral-500">{course.schedule} {course.time} · {course.location}</p>
                              <p className="text-xs text-primary mt-1">下次上課：{course.nextClassDate || '未定'}</p>
                            </div>
                            <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full">進行中</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-neutral-400 text-sm">尚未報名任何課程</div>
                    )}
                  </div>
                )}

                {/* 堂數紀錄 tab */}
                {activeStudentTab[student.id] === 'records' && (
                  <div className="p-4 space-y-3">
                    {/* 堂數摘要 */}
                    <div className="bg-neutral-50 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-neutral-500">堂數使用狀況</p>
                        <p className="text-lg font-bold">
                          已使用 <span className="text-primary">{student.usedCredits}</span> / 共 {student.totalCredits} 堂
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-neutral-500">請假次數</p>
                        <p className={`font-bold ${student.leaveCount >= student.maxLeave && student.maxLeave > 0 ? 'text-red-500' : 'text-neutral-900'}`}>
                          {student.leaveCount} / {student.maxLeave} 次
                        </p>
                      </div>
                    </div>

                    {student.expiryDate && (
                      <div className={`text-xs px-3 py-2 rounded-lg ${
                        new Date(student.expiryDate) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                          ? 'bg-red-50 text-red-600'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}>
                        堂數有效期限至 {student.expiryDate}
                        {student.planWeeks > 0 && `（${student.planWeeks} 週方案）`}
                      </div>
                    )}

                    {/* 使用紀錄列表 */}
                    {student.attendance.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-neutral-700">使用紀錄</p>
                        {student.attendance.map((record, idx) => {
                          const colorMap: Record<string, { bg: string, text: string, border: string }> = {
                            '出席': { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
                            '缺席': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
                            '請假': { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
                            '遲到': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
                            '病假': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
                            '補課': { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
                          }
                          const color = colorMap[record.status] || { bg: 'bg-neutral-50', text: 'text-neutral-600', border: 'border-neutral-200' }

                          return (
                            <div key={idx} className={`${color.bg} border ${color.border} rounded-lg p-3 flex items-center justify-between`}>
                              <div>
                                <p className="text-sm font-medium text-neutral-900">{record.date}</p>
                                <p className="text-xs text-neutral-500">
                                  {record.courseName} · {record.schedule} {record.time}
                                  {record.location && ` · ${record.location}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {record.deducted && <span className="text-xs text-neutral-400">-1堂</span>}
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${color.text} ${color.bg}`}>
                                  {record.status}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-neutral-400 text-sm">
                        尚無使用紀錄
                      </div>
                    )}
                  </div>
                )}

                {/* 堂數進度條 */}
                {student.totalCredits > 0 && (
                  <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50">
                    <div className="flex justify-between text-xs text-neutral-500 mb-1">
                      <span>堂數使用進度</span>
                      <span>{student.usedCredits} / {student.totalCredits}</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${student.remainingCredits <= 3 ? 'bg-orange-500' : 'bg-primary'}`}
                        style={{ width: `${(student.usedCredits / student.totalCredits) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {studentCredits.length === 0 && (
          <div className="text-center py-8 text-neutral-500">
            尚無學員資料
          </div>
        )}

        <button
          onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'register' }))}
          className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
        >
          購買堂數
        </button>
      </div>

      {/* 候補狀態 */}
      {waitlists.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-l-4 border-warning pl-4">
            <h2 className="text-xl font-bold text-neutral-900">我的候補</h2>
            <Badge variant="warning">等待中</Badge>
          </div>
          <div className="grid gap-4">
            {waitlists.map((entry) => {
              const course = courses.find(c => c.id === entry.courseId);
              if (!course) return null;

              return (
                <div key={entry.id} className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900 mb-1">{course.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>申請日期：2026/03/01</span>
                        <span>•</span>
                        <span>聯絡人：{entry.contactName}</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-2 border-warning text-warning flex items-center justify-center font-bold text-sm bg-warning/5 flex-col leading-tight">
                      <span>候補</span>
                      <span>中</span>
                    </div>
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-4 mb-4">
                    <p className="text-xs font-bold text-neutral-500 mb-2">候補學員 ({entry.students.length})</p>
                    <div className="space-y-2">
                      {entry.students.map((student, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-neutral-100">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-primary" />
                            <span className="font-medium text-sm">{student.name}</span>
                            <span className="text-xs text-neutral-500">({student.age} 歲)</span>
                          </div>
                          <Badge variant="secondary">{student.experience === 'beginner' ? '無基礎' : '已有基礎'}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <div className="text-xs text-neutral-500">
                      候補編號：<br/>#{entry.id}
                    </div>
                    <button className="text-sm font-medium text-neutral-500 hover:text-danger transition-colors">
                      取消候補
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
