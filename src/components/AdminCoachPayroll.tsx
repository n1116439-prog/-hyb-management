import React, { useState, useEffect } from 'react'

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
import { supabase } from '../lib/supabase'
import { Input, FormField } from './UI'
import { DollarSign, Check } from 'lucide-react'

export const AdminCoachPayroll: React.FC = () => {
  const [coaches, setCoaches] = useState<any[]>([])
  const [selectedCoach, setSelectedCoach] = useState<any>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [payrollRecords, setPayrollRecords] = useState<any[]>([])
  const [courseStats, setCourseStats] = useState<any[]>([])
  const [showPayrollModal, setShowPayrollModal] = useState(false)
  const [payrollForm, setPayrollForm] = useState({
    base_salary: 0,
    per_class_rate: 500,
    bonus: 0,
    deduction: 0,
    notes: '',
  })

  const fetchCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('id, name, phone, email, specialization')
      .eq('is_active', true)
      .order('name')
    if (data) setCoaches(data)
  }

  const fetchCoachStats = async (coachId: string, month: string) => {
    const [year, m] = month.split('-').map(Number)
    const startDate = `${year}-${String(m).padStart(2, '0')}-01`
    const endDate = formatLocalDate(new Date(year, m, 0))

    const { data: courses } = await supabase
      .from('courses')
      .select('id, name, day_of_week, start_time, end_time, venues(name)')
      .eq('coach_id', coachId)

    if (!courses) {
      setCourseStats([])
      return 0
    }

    const stats = []

    for (const course of courses) {
      const { count } = await supabase
        .from('attendance')
        .select('date', { count: 'exact', head: true })
        .eq('course_id', course.id)
        .gte('date', startDate)
        .lte('date', endDate)

      const weekdayMap: Record<string, number> = {
        '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6
      }
      const targetDay = weekdayMap[course.day_of_week]
      let expectedClasses = 0
      if (targetDay !== undefined) {
        const d = new Date(year, m - 1, 1)
        while (d.getMonth() === m - 1) {
          if (d.getDay() === targetDay) expectedClasses++
          d.setDate(d.getDate() + 1)
        }
      }

      const actualClasses = count || 0
      const classCount = Math.max(actualClasses, new Date() > new Date(endDate) ? expectedClasses : 0) || expectedClasses

      stats.push({
        courseId: course.id,
        courseName: course.name,
        dayOfWeek: course.day_of_week,
        time: `${course.start_time?.slice(0,5)}-${course.end_time?.slice(0,5)}`,
        venue: (course.venues as any)?.name || '',
        expectedClasses,
        actualClasses,
        classCount,
      })
    }

    setCourseStats(stats)
    return stats.reduce((sum, s) => sum + s.classCount, 0)
  }

  const fetchPayrollRecords = async (coachId: string) => {
    const { data } = await supabase
      .from('coach_payments')
      .select('*')
      .eq('coach_id', coachId)
      .order('period_start', { ascending: false })
    if (data) setPayrollRecords(data)
  }

  useEffect(() => {
    fetchCoaches()
  }, [])

  useEffect(() => {
    if (selectedCoach) {
      fetchCoachStats(selectedCoach.id, selectedMonth)
      fetchPayrollRecords(selectedCoach.id)
    }
  }, [selectedCoach, selectedMonth])

  const totalClasses = courseStats.reduce((sum, s) => sum + s.classCount, 0)
  const classPayment = totalClasses * payrollForm.per_class_rate
  const totalAmount = payrollForm.base_salary + classPayment + payrollForm.bonus - payrollForm.deduction

  const savePayroll = async () => {
    if (!selectedCoach) return

    const [year, m] = selectedMonth.split('-').map(Number)
    const periodStart = `${year}-${String(m).padStart(2, '0')}-01`
    const periodEnd = formatLocalDate(new Date(year, m, 0))

    const { data: existing } = await supabase
      .from('coach_payments')
      .select('id')
      .eq('coach_id', selectedCoach.id)
      .eq('period_start', periodStart)
      .single()

    const payrollData = {
      coach_id: selectedCoach.id,
      period_start: periodStart,
      period_end: periodEnd,
      base_salary: payrollForm.base_salary,
      class_count: totalClasses,
      per_class_rate: payrollForm.per_class_rate,
      bonus: payrollForm.bonus,
      deduction: payrollForm.deduction,
      total_amount: totalAmount,
      status: 'pending',
      notes: payrollForm.notes,
    }

    if (existing) {
      await supabase.from('coach_payments').update(payrollData).eq('id', existing.id)
    } else {
      await supabase.from('coach_payments').insert(payrollData)
    }

    alert('薪資紀錄儲存成功！')
    setShowPayrollModal(false)
    fetchPayrollRecords(selectedCoach.id)
  }

  const markAsPaid = async (payrollId: string) => {
    await supabase.from('coach_payments').update({
      status: 'paid',
      paid_date: formatLocalDate(new Date()),
    }).eq('id', payrollId)
    if (selectedCoach) fetchPayrollRecords(selectedCoach.id)
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900">教練薪資管理</h2>
        <div className="flex gap-2">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border rounded-xl" />
        </div>
      </div>

      {/* 教練選擇 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {coaches.map(coach => (
          <button key={coach.id} onClick={() => setSelectedCoach(coach)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedCoach?.id === coach.id ? 'border-primary bg-primary/5' : 'border-neutral-200 hover:border-neutral-300'
            }`}>
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold mb-2">
              {coach.name?.charAt(0)}
            </div>
            <p className="font-bold text-sm">{coach.name}</p>
            <p className="text-xs text-neutral-500">{coach.specialization || '教練'}</p>
          </button>
        ))}
      </div>

      {selectedCoach && (
        <>
          {/* 課程統計 */}
          <div className="bg-white rounded-2xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{selectedCoach.name} — {selectedMonth.replace('-', '年')}月 課程統計</h3>
              <button onClick={() => setShowPayrollModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium">
                <DollarSign size={16} /> 計算薪資
              </button>
            </div>

            {courseStats.length > 0 ? (
              <div className="space-y-2">
                {courseStats.map(stat => (
                  <div key={stat.courseId} className="flex items-center justify-between bg-neutral-50 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{stat.courseName}</p>
                      <p className="text-xs text-neutral-500">{stat.dayOfWeek} {stat.time} · {stat.venue}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{stat.classCount} 堂</p>
                      <p className="text-xs text-neutral-500">預計 {stat.expectedClasses} 堂</p>
                    </div>
                  </div>
                ))}
                <div className="bg-primary/5 rounded-lg p-3 flex justify-between">
                  <span className="font-bold">本月總計</span>
                  <span className="font-bold text-primary">{totalClasses} 堂</span>
                </div>
              </div>
            ) : (
              <p className="text-center py-6 text-neutral-500">此教練本月沒有排課</p>
            )}
          </div>

          {/* 薪資紀錄 */}
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-bold text-lg mb-4">薪資紀錄</h3>
            {payrollRecords.length > 0 ? (
              <div className="space-y-2">
                {payrollRecords.map(record => (
                  <div key={record.id} className="flex items-center justify-between bg-neutral-50 rounded-lg p-4">
                    <div>
                      <p className="font-medium">{record.period_start} ~ {record.period_end}</p>
                      <p className="text-sm text-neutral-500">
                        底薪 {record.base_salary} + {record.class_count}堂 × {record.per_class_rate}
                        {record.bonus > 0 && ` + 獎金 ${record.bonus}`}
                        {record.deduction > 0 && ` - 扣除 ${record.deduction}`}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-bold text-lg">NT$ {record.total_amount?.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          record.status === 'paid' ? 'bg-green-100 text-green-600' :
                          record.status === 'approved' ? 'bg-blue-100 text-blue-600' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>
                          {record.status === 'paid' ? '已發放' : record.status === 'approved' ? '已核准' : '待核准'}
                        </span>
                      </div>
                      {record.status !== 'paid' && (
                        <button onClick={() => markAsPaid(record.id)}
                          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="標記已發放">
                          <Check size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-neutral-500">尚無薪資紀錄</p>
            )}
          </div>
        </>
      )}

      {/* 計算薪資 Modal */}
      {showPayrollModal && selectedCoach && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPayrollModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">計算薪資 — {selectedCoach.name}</h3>
            <p className="text-sm text-neutral-500">{selectedMonth.replace('-', '年')}月 · 共 {totalClasses} 堂課</p>

            <FormField label="底薪（月薪）">
              <Input type="number" value={payrollForm.base_salary} onChange={e => setPayrollForm(prev => ({ ...prev, base_salary: parseInt(e.target.value) || 0 }))} />
            </FormField>

            <FormField label="每堂課費用">
              <Input type="number" value={payrollForm.per_class_rate} onChange={e => setPayrollForm(prev => ({ ...prev, per_class_rate: parseInt(e.target.value) || 0 }))} />
            </FormField>

            <div className="bg-neutral-50 rounded-lg p-3">
              <p className="text-sm text-neutral-500">課程費用 = {totalClasses} 堂 × NT$ {payrollForm.per_class_rate}</p>
              <p className="font-bold">NT$ {classPayment.toLocaleString()}</p>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <FormField label="獎金">
                  <Input type="number" value={payrollForm.bonus} onChange={e => setPayrollForm(prev => ({ ...prev, bonus: parseInt(e.target.value) || 0 }))} />
                </FormField>
              </div>
              <div className="flex-1">
                <FormField label="扣除">
                  <Input type="number" value={payrollForm.deduction} onChange={e => setPayrollForm(prev => ({ ...prev, deduction: parseInt(e.target.value) || 0 }))} />
                </FormField>
              </div>
            </div>

            <FormField label="備註">
              <Input value={payrollForm.notes} onChange={e => setPayrollForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="選填" />
            </FormField>

            <div className="bg-primary/5 rounded-xl p-4 text-center">
              <p className="text-sm text-neutral-500">本月應付</p>
              <p className="text-3xl font-bold text-primary">NT$ {totalAmount.toLocaleString()}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowPayrollModal(false)} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium">取消</button>
              <button onClick={savePayroll} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium">儲存薪資紀錄</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
