import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Input, FormField, Badge } from './UI'
import { DollarSign, Check, ChevronDown, ChevronUp, Download, Calculator, CheckCircle, X } from 'lucide-react'

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const EMPLOYMENT_LABELS: Record<string, string> = { full_time: '全職', part_time: '兼職', hourly: '鐘點' }
const EMPLOYMENT_COLORS: Record<string, string> = { full_time: 'bg-blue-100 text-blue-700', part_time: 'bg-amber-100 text-amber-700', hourly: 'bg-green-100 text-green-700' }

export const AdminCoachPayroll: React.FC = () => {
  const [coaches, setCoaches] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Expanded detail state
  const [detailStats, setDetailStats] = useState<any[]>([])
  const [detailHistory, setDetailHistory] = useState<any[]>([])
  const [detailForm, setDetailForm] = useState({ base_salary: 0, per_class_rate: 500, bonus: 0, deduction: 0, notes: '' })
  const [detailLoading, setDetailLoading] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)

  const getMonthRange = (month: string) => {
    const [y, m] = month.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = formatLocalDate(new Date(y, m, 0))
    return { start, end }
  }

  const fetchCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('id, name, phone, email, specialization, is_active, hire_date, employment_type, default_per_class_rate, default_base_salary, bank_account')
      .eq('is_active', true)
      .order('name')
    if (data) setCoaches(data)
  }

  const fetchPayments = async () => {
    const { start } = getMonthRange(selectedMonth)
    const { data } = await supabase
      .from('coach_payments')
      .select('*')
      .eq('period_start', start)
    setPayments(data || [])
  }

  const loadData = async () => {
    setLoading(true)
    await fetchCoaches()
    await fetchPayments()
    setLoading(false)
  }

  useEffect(() => { loadData() }, [selectedMonth])

  // Merge coaches + payments
  const rows = coaches.map(c => {
    const p = payments.find((p: any) => p.coach_id === c.id)
    return {
      ...c,
      payment: p || null,
      class_count: p?.class_count || 0,
      per_class_rate: p?.per_class_rate || c.default_per_class_rate || 0,
      base_salary: p?.base_salary || c.default_base_salary || 0,
      bonus: p?.bonus || 0,
      deduction: p?.deduction || 0,
      total_amount: p?.total_amount || 0,
      status: p?.status || 'none',
    }
  })

  // Summary
  const totalPayable = rows.reduce((s, r) => s + r.total_amount, 0)
  const paidCount = rows.filter(r => r.status === 'paid').length
  const pendingCount = rows.filter(r => r.status === 'pending').length
  const totalClasses = rows.reduce((s, r) => s + r.class_count, 0)

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(rows.map(r => r.id)))
  }

  // Calculate all
  const calculateAll = async () => {
    setCalculating(true)
    const { start, end } = getMonthRange(selectedMonth)
    const [yearNum, monthNum] = selectedMonth.split('-').map(Number)

    // Fetch holidays
    const { data: holidays } = await supabase
      .from('course_holidays')
      .select('date, course_id')
      .gte('date', start)
      .lte('date', end)

    for (const coach of coaches) {
      // Get courses for this coach
      const { data: courses } = await supabase
        .from('courses')
        .select('id, day_of_week')
        .eq('coach_id', coach.id)

      if (!courses || courses.length === 0) continue

      const weekdayMap: Record<string, number> = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 }

      let totalCount = 0
      for (const course of courses) {
        const targetDay = weekdayMap[course.day_of_week]
        if (targetDay === undefined) continue

        const courseHolidays = new Set(
          (holidays || []).filter((h: any) => h.course_id === course.id || h.course_id === null).map((h: any) => h.date)
        )

        const d = new Date(yearNum, monthNum - 1, 1)
        let count = 0
        while (d.getMonth() === monthNum - 1) {
          if (d.getDay() === targetDay && !courseHolidays.has(formatLocalDate(d))) count++
          d.setDate(d.getDate() + 1)
        }
        totalCount += count
      }

      const baseSalary = coach.default_base_salary || 0
      const perClassRate = coach.default_per_class_rate || 500
      const total = baseSalary + totalCount * perClassRate

      // Upsert
      const { data: existing } = await supabase
        .from('coach_payments')
        .select('id, bonus, deduction, notes')
        .eq('coach_id', coach.id)
        .eq('period_start', start)
        .single()

      const payData = {
        coach_id: coach.id,
        period_start: start,
        period_end: end,
        base_salary: baseSalary,
        class_count: totalCount,
        per_class_rate: perClassRate,
        bonus: existing?.bonus || 0,
        deduction: existing?.deduction || 0,
        total_amount: total + (existing?.bonus || 0) - (existing?.deduction || 0),
        status: 'pending',
        notes: existing?.notes || '',
      }

      if (existing) {
        await supabase.from('coach_payments').update(payData).eq('id', existing.id)
      } else {
        await supabase.from('coach_payments').insert(payData)
      }
    }

    await fetchPayments()
    setCalculating(false)
    alert('全部教練薪資計算完成！')
  }

  // Batch mark paid
  const batchMarkPaid = async () => {
    if (selectedIds.size === 0) { alert('請先勾選教練'); return }
    const paidDate = formatLocalDate(new Date())
    const paymentIds = rows.filter(r => selectedIds.has(r.id) && r.payment?.id && r.status !== 'paid').map(r => r.payment.id)
    if (paymentIds.length === 0) { alert('所選教練無待發放紀錄'); return }

    for (const pid of paymentIds) {
      await supabase.from('coach_payments').update({ status: 'paid', paid_date: paidDate }).eq('id', pid)
    }
    await fetchPayments()
    setSelectedIds(new Set())
    alert(`已標記 ${paymentIds.length} 筆為已發放`)
  }

  // CSV export
  const exportCSV = () => {
    const header = '教練姓名,僱用類型,堂數,單堂費用,底薪,獎金,扣除,應付總額,狀態,匯款帳號\n'
    const body = rows.map(r =>
      [
        r.name,
        EMPLOYMENT_LABELS[r.employment_type] || r.employment_type || '',
        r.class_count,
        r.per_class_rate,
        r.base_salary,
        r.bonus,
        r.deduction,
        r.total_amount,
        r.status === 'paid' ? '已發放' : r.status === 'pending' ? '待發放' : '未計算',
        r.bank_account || '',
      ].join(',')
    ).join('\n')

    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `教練薪資_${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Expand detail
  const expandCoach = async (coachId: string) => {
    if (expandedId === coachId) { setExpandedId(null); return }
    setExpandedId(coachId)
    setDetailLoading(true)

    const coach = coaches.find(c => c.id === coachId)
    const payment = payments.find((p: any) => p.coach_id === coachId)
    setDetailForm({
      base_salary: payment?.base_salary ?? coach?.default_base_salary ?? 0,
      per_class_rate: payment?.per_class_rate ?? coach?.default_per_class_rate ?? 500,
      bonus: payment?.bonus ?? 0,
      deduction: payment?.deduction ?? 0,
      notes: payment?.notes ?? '',
    })

    // Fetch course stats
    const { start, end } = getMonthRange(selectedMonth)
    const [yearNum, monthNum] = selectedMonth.split('-').map(Number)

    const { data: courses } = await supabase
      .from('courses')
      .select('id, name, day_of_week, start_time, end_time, venues(name)')
      .eq('coach_id', coachId)

    const { data: holidays } = await supabase
      .from('course_holidays')
      .select('date, course_id')
      .gte('date', start)
      .lte('date', end)

    const weekdayMap: Record<string, number> = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 }
    const stats: any[] = []

    for (const course of (courses || [])) {
      const targetDay = weekdayMap[course.day_of_week]
      if (targetDay === undefined) continue

      const courseHolidays = new Set(
        (holidays || []).filter((h: any) => h.course_id === course.id || h.course_id === null).map((h: any) => h.date)
      )

      const d = new Date(yearNum, monthNum - 1, 1)
      let count = 0
      while (d.getMonth() === monthNum - 1) {
        if (d.getDay() === targetDay && !courseHolidays.has(formatLocalDate(d))) count++
        d.setDate(d.getDate() + 1)
      }

      stats.push({
        courseId: course.id,
        courseName: course.name,
        dayOfWeek: course.day_of_week,
        time: `${course.start_time?.slice(0, 5)}-${course.end_time?.slice(0, 5)}`,
        venue: (course.venues as any)?.name || '',
        classCount: count,
      })
    }
    setDetailStats(stats)

    // Fetch history
    const { data: history } = await supabase
      .from('coach_payments')
      .select('*')
      .eq('coach_id', coachId)
      .order('period_start', { ascending: false })
      .limit(12)
    setDetailHistory(history || [])

    setDetailLoading(false)
  }

  const detailTotalClasses = detailStats.reduce((s, st) => s + st.classCount, 0)
  const detailClassPayment = detailTotalClasses * detailForm.per_class_rate
  const detailTotal = detailForm.base_salary + detailClassPayment + detailForm.bonus - detailForm.deduction

  const saveDetail = async () => {
    if (!expandedId) return
    setSavingDetail(true)
    const { start, end } = getMonthRange(selectedMonth)

    const { data: existing } = await supabase
      .from('coach_payments')
      .select('id')
      .eq('coach_id', expandedId)
      .eq('period_start', start)
      .single()

    const data = {
      coach_id: expandedId,
      period_start: start,
      period_end: end,
      base_salary: detailForm.base_salary,
      class_count: detailTotalClasses,
      per_class_rate: detailForm.per_class_rate,
      bonus: detailForm.bonus,
      deduction: detailForm.deduction,
      total_amount: detailTotal,
      status: 'pending',
      notes: detailForm.notes,
    }

    if (existing) {
      await supabase.from('coach_payments').update(data).eq('id', existing.id)
    } else {
      await supabase.from('coach_payments').insert(data)
    }

    await fetchPayments()
    setSavingDetail(false)
    alert('薪資紀錄已儲存')
  }

  const markDetailPaid = async () => {
    if (!expandedId) return
    const { start } = getMonthRange(selectedMonth)
    const payment = payments.find((p: any) => p.coach_id === expandedId && p.period_start === start)
    if (!payment) { alert('請先儲存薪資紀錄'); return }
    await supabase.from('coach_payments').update({ status: 'paid', paid_date: formatLocalDate(new Date()) }).eq('id', payment.id)
    await fetchPayments()
    alert('已標記為已發放')
  }

  const statusBadge = (status: string) => {
    if (status === 'paid') return <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">已發放</span>
    if (status === 'pending') return <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">待發放</span>
    return <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-500">未計算</span>
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900">教練薪資管理</h2>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="px-4 py-2 border border-neutral-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-100 p-6">
          <p className="text-sm text-neutral-500 mb-1">本月應付總額</p>
          <p className="text-2xl font-bold text-primary">NT$ {totalPayable.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-6">
          <p className="text-sm text-neutral-500 mb-1">發放進度</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">已發放 {paidCount} 筆</span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">待發放 {pendingCount} 筆</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-6">
          <p className="text-sm text-neutral-500 mb-1">總授課堂數</p>
          <p className="text-2xl font-bold text-neutral-900">{totalClasses} <span className="text-base font-normal text-neutral-500">堂</span></p>
        </div>
      </div>

      {/* Batch Actions */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
        <div className="p-4 border-b border-neutral-100 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={selectedIds.size === rows.length && rows.length > 0} onChange={toggleAll}
              className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary" />
            全選
          </label>
          {selectedIds.size > 0 && <span className="text-sm text-neutral-500">已選 {selectedIds.size} 位</span>}
          <div className="flex-1" />
          <button onClick={calculateAll} disabled={calculating}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
            <Calculator size={16} /> {calculating ? '計算中...' : '一鍵計算全部'}
          </button>
          <button onClick={batchMarkPaid}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
            <CheckCircle size={16} /> 批次標記已發放
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl text-sm font-medium hover:bg-neutral-200 transition-colors">
            <Download size={16} /> 匯出 CSV
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 text-neutral-500 text-xs">
                <th className="p-3 pl-4 font-medium w-10"></th>
                <th className="p-3 font-medium">教練</th>
                <th className="p-3 font-medium">僱用類型</th>
                <th className="p-3 font-medium text-right">堂數</th>
                <th className="p-3 font-medium text-right">單堂費用</th>
                <th className="p-3 font-medium text-right">底薪</th>
                <th className="p-3 font-medium text-right">獎金</th>
                <th className="p-3 font-medium text-right">扣除</th>
                <th className="p-3 font-medium text-right">應付總額</th>
                <th className="p-3 font-medium text-center">狀態</th>
                <th className="p-3 pr-4 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr><td colSpan={11} className="p-8 text-center text-neutral-400">載入中...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-neutral-400">無教練資料</td></tr>
              ) : rows.map(row => (
                <React.Fragment key={row.id}>
                  <tr className={'hover:bg-neutral-50/50 transition-colors ' + (expandedId === row.id ? 'bg-neutral-50/30' : '')}>
                    <td className="p-3 pl-4">
                      <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)}
                        className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary" />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {row.name?.[0] || '?'}
                        </div>
                        <span className="font-medium text-neutral-900 text-sm">{row.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (EMPLOYMENT_COLORS[row.employment_type] || 'bg-neutral-100 text-neutral-600')}>
                        {EMPLOYMENT_LABELS[row.employment_type] || row.employment_type || '—'}
                      </span>
                    </td>
                    <td className="p-3 text-right text-sm font-medium">{row.class_count || '—'}</td>
                    <td className="p-3 text-right text-sm">{row.per_class_rate ? '$' + row.per_class_rate.toLocaleString() : '—'}</td>
                    <td className="p-3 text-right text-sm">{row.base_salary ? '$' + row.base_salary.toLocaleString() : '—'}</td>
                    <td className="p-3 text-right text-sm text-green-600">{row.bonus > 0 ? '+$' + row.bonus.toLocaleString() : '—'}</td>
                    <td className="p-3 text-right text-sm text-red-500">{row.deduction > 0 ? '-$' + row.deduction.toLocaleString() : '—'}</td>
                    <td className="p-3 text-right">
                      <span className="font-bold text-primary text-sm">${row.total_amount.toLocaleString()}</span>
                    </td>
                    <td className="p-3 text-center">{statusBadge(row.status)}</td>
                    <td className="p-3 pr-4">
                      <button onClick={() => expandCoach(row.id)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                        {expandedId === row.id ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Detail */}
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={11} className="p-0">
                        <div className="bg-neutral-50 border-t border-neutral-100 p-6">
                          {detailLoading ? (
                            <p className="text-center py-6 text-neutral-400">載入中...</p>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Left: course stats */}
                              <div className="space-y-3">
                                <p className="font-bold text-sm text-neutral-700">課程堂數明細</p>
                                {detailStats.length === 0 ? (
                                  <p className="text-sm text-neutral-400 py-4">此教練本月無排課</p>
                                ) : (
                                  <div className="space-y-2">
                                    {detailStats.map(st => (
                                      <div key={st.courseId} className="flex items-center justify-between bg-white rounded-lg p-3 border border-neutral-100">
                                        <div>
                                          <p className="font-medium text-sm">{st.courseName}</p>
                                          <p className="text-xs text-neutral-500">{st.dayOfWeek} {st.time} · {st.venue}</p>
                                        </div>
                                        <span className="font-bold text-primary text-sm">{st.classCount} 堂</span>
                                      </div>
                                    ))}
                                    <div className="bg-primary/5 rounded-lg p-3 flex justify-between">
                                      <span className="font-bold text-sm">總計</span>
                                      <span className="font-bold text-primary">{detailTotalClasses} 堂</span>
                                    </div>
                                  </div>
                                )}

                                {/* History */}
                                <p className="font-bold text-sm text-neutral-700 mt-4">歷史薪資紀錄</p>
                                {detailHistory.length === 0 ? (
                                  <p className="text-sm text-neutral-400">無歷史紀錄</p>
                                ) : (
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {detailHistory.map(h => (
                                      <div key={h.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-neutral-100 text-sm">
                                        <span className="text-neutral-600">{h.period_start?.slice(0, 7).replace('-', '/')}月</span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">${h.total_amount?.toLocaleString()}</span>
                                          {statusBadge(h.status)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Right: payroll form */}
                              <div className="space-y-3">
                                <p className="font-bold text-sm text-neutral-700">薪資計算</p>
                                <div className="bg-white rounded-xl border border-neutral-100 p-4 space-y-3">
                                  <div className="flex gap-3">
                                    <div className="flex-1">
                                      <FormField label="底薪">
                                        <Input type="number" value={detailForm.base_salary} onChange={e => setDetailForm(f => ({ ...f, base_salary: parseInt(e.target.value) || 0 }))} />
                                      </FormField>
                                    </div>
                                    <div className="flex-1">
                                      <FormField label="每堂費用">
                                        <Input type="number" value={detailForm.per_class_rate} onChange={e => setDetailForm(f => ({ ...f, per_class_rate: parseInt(e.target.value) || 0 }))} />
                                      </FormField>
                                    </div>
                                  </div>

                                  <div className="bg-neutral-50 rounded-lg p-3 text-sm">
                                    <p className="text-neutral-500">課程費用 = {detailTotalClasses} 堂 × ${detailForm.per_class_rate.toLocaleString()}</p>
                                    <p className="font-bold">NT$ {detailClassPayment.toLocaleString()}</p>
                                  </div>

                                  <div className="flex gap-3">
                                    <div className="flex-1">
                                      <FormField label="獎金">
                                        <Input type="number" value={detailForm.bonus} onChange={e => setDetailForm(f => ({ ...f, bonus: parseInt(e.target.value) || 0 }))} />
                                      </FormField>
                                    </div>
                                    <div className="flex-1">
                                      <FormField label="扣除">
                                        <Input type="number" value={detailForm.deduction} onChange={e => setDetailForm(f => ({ ...f, deduction: parseInt(e.target.value) || 0 }))} />
                                      </FormField>
                                    </div>
                                  </div>

                                  <FormField label="備註">
                                    <Input value={detailForm.notes} onChange={e => setDetailForm(f => ({ ...f, notes: e.target.value }))} placeholder="選填" />
                                  </FormField>

                                  <div className="bg-primary/5 rounded-xl p-4 text-center">
                                    <p className="text-xs text-neutral-500">應付總額</p>
                                    <p className="text-2xl font-bold text-primary">NT$ {detailTotal.toLocaleString()}</p>
                                  </div>

                                  <div className="flex gap-3">
                                    <button onClick={saveDetail} disabled={savingDetail}
                                      className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50">
                                      {savingDetail ? '儲存中...' : '儲存'}
                                    </button>
                                    <button onClick={markDetailPaid}
                                      className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
                                      標記已發放
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
