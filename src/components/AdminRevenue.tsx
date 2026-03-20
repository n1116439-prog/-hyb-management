import React, { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Download, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Badge } from './UI'
import { supabase } from '../lib/supabase'

function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const AdminRevenue: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [payments, setPayments] = useState<any[]>([])
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [confirmedPayments, setConfirmedPayments] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Summary
  const [confirmedTotal, setConfirmedTotal] = useState(0)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [refundedTotal, setRefundedTotal] = useState(0)
  const [growthPercent, setGrowthPercent] = useState<number | null>(null)

  const getMonthRange = (month: string) => {
    const [y, m] = month.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = formatLocalDate(new Date(y, m, 0))
    return { start, end }
  }

  const fetchPayments = async () => {
    setLoading(true)
    const { start, end } = getMonthRange(selectedMonth)

    // All payments this month with student info
    const { data } = await supabase
      .from('payments')
      .select('*, students(name, student_code)')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59')
      .order('created_at', { ascending: false })

    const all = data || []
    setPayments(all)
    setPendingPayments(all.filter(p => p.status === 'pending'))
    setConfirmedPayments(all.filter(p => p.status === 'confirmed'))

    // Summary
    const cTotal = all.filter(p => p.status === 'confirmed').reduce((s, p) => s + (p.amount || 0), 0)
    const pTotal = all.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0)
    const rTotal = all.filter(p => p.status === 'refunded').reduce((s, p) => s + (p.refund_amount || 0), 0)
    setConfirmedTotal(cTotal)
    setPendingTotal(pTotal)
    setRefundedTotal(rTotal)

    // Growth vs last month
    const [y, m] = selectedMonth.split('-').map(Number)
    const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    const prev = getMonthRange(prevMonth)
    const { data: prevData } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'confirmed')
      .gte('created_at', prev.start + 'T00:00:00')
      .lte('created_at', prev.end + 'T23:59:59')
    const prevTotal = (prevData || []).reduce((s, p) => s + (p.amount || 0), 0)
    if (prevTotal > 0) {
      setGrowthPercent(Math.round(((cTotal - prevTotal) / prevTotal) * 100))
    } else {
      setGrowthPercent(cTotal > 0 ? 100 : null)
    }

    setLoading(false)
  }

  const fetchTrend = async () => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const months: any[] = []

    for (let i = 5; i >= 0; i--) {
      let tm = m - i
      let ty = y
      while (tm <= 0) { tm += 12; ty-- }
      const monthStr = `${ty}-${String(tm).padStart(2, '0')}`
      const { start, end } = getMonthRange(monthStr)

      const { data: confirmed } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'confirmed')
        .gte('created_at', start + 'T00:00:00')
        .lte('created_at', end + 'T23:59:59')

      const { data: refunded } = await supabase
        .from('payments')
        .select('refund_amount')
        .eq('status', 'refunded')
        .gte('created_at', start + 'T00:00:00')
        .lte('created_at', end + 'T23:59:59')

      months.push({
        month: tm + '月',
        confirmed: (confirmed || []).reduce((s, p) => s + (p.amount || 0), 0),
        refunded: (refunded || []).reduce((s, p) => s + (p.refund_amount || 0), 0),
      })
    }
    setTrendData(months)
  }

  useEffect(() => {
    fetchPayments()
    fetchTrend()
  }, [selectedMonth])

  // Actions
  const confirmPayment = async (id: string) => {
    await supabase.from('payments').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: 'admin',
    }).eq('id', id)
    await fetchPayments()
  }

  const refundPayment = async (id: string, amount: number) => {
    const reason = prompt('請輸入退款原因：')
    if (!reason) return
    await supabase.from('payments').update({
      status: 'refunded',
      refund_amount: amount,
      refund_date: formatLocalDate(new Date()),
      refund_reason: reason,
    }).eq('id', id)
    await fetchPayments()
  }

  const batchConfirm = async () => {
    if (selectedIds.size === 0) { alert('請先勾選付款紀錄'); return }
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      await supabase.from('payments').update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: 'admin',
      }).eq('id', id)
    }
    setSelectedIds(new Set())
    await fetchPayments()
    alert(`已確認 ${ids.length} 筆入帳`)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAllPending = () => {
    if (selectedIds.size === pendingPayments.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(pendingPayments.map(p => p.id)))
  }

  // CSV
  const exportCSV = () => {
    const header = '日期,學員姓名,學員編號,方案,堂數,金額,付款方式,狀態,匯款末五碼,確認時間,備註\n'
    const statusMap: Record<string, string> = { confirmed: '已確認', pending: '待確認', refunded: '已退款' }
    const body = payments.map(p =>
      [
        p.created_at?.slice(0, 10) || '',
        p.students?.name || '',
        p.students?.student_code || '',
        p.plan_name || '',
        p.sessions || '',
        p.amount || 0,
        p.payment_method || '',
        statusMap[p.status] || p.status,
        p.bank_last5 || '',
        p.confirmed_at?.slice(0, 16)?.replace('T', ' ') || '',
        p.notes || '',
      ].join(',')
    ).join('\n')

    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `營收報表_${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900 whitespace-nowrap">營收管理</h2>
        <div className="flex gap-3">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-neutral-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl text-sm font-medium hover:bg-neutral-200 transition-colors">
            <Download size={16} /> 匯出 CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-100 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-1">本月已確認營收</p>
          <p className="text-xl font-bold text-green-600">NT$ {confirmedTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock size={20} />
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-1">待確認金額</p>
          <p className="text-xl font-bold text-amber-600">NT$ {pendingTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
              <XCircle size={20} />
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-1">本月退款</p>
          <p className="text-xl font-bold text-red-500">NT$ {refundedTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + (growthPercent !== null && growthPercent >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
              {growthPercent !== null && growthPercent >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-1">較上月成長</p>
          {growthPercent !== null ? (
            <p className={'text-xl font-bold ' + (growthPercent >= 0 ? 'text-green-600' : 'text-red-500')}>
              {growthPercent >= 0 ? '+' : ''}{growthPercent}%
            </p>
          ) : (
            <p className="text-xl font-bold text-neutral-400">—</p>
          )}
        </div>
      </div>

      {/* Pending Payments */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-neutral-900">待確認付款</h3>
            {pendingPayments.length > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">{pendingPayments.length} 筆</span>
            )}
          </div>
          {pendingPayments.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selectedIds.size === pendingPayments.length && pendingPayments.length > 0} onChange={toggleAllPending}
                  className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary" />
                全選
              </label>
              {selectedIds.size > 0 && <span className="text-sm text-neutral-500">已選 {selectedIds.size} 筆</span>}
              <button onClick={batchConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
                <CheckCircle size={16} /> 批次確認入帳
              </button>
            </div>
          )}
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-center py-8 text-neutral-400">載入中...</p>
          ) : pendingPayments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <p className="font-bold text-neutral-700">所有付款已處理完畢</p>
              <p className="text-sm text-neutral-400 mt-1">目前沒有待確認的付款</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPayments.map(p => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                      className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary mt-1" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-neutral-900">{p.students?.name || '—'}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{p.students?.student_code || ''}</span>
                      </div>
                      <p className="text-sm text-neutral-500 mt-0.5">{p.plan_name || '—'} · {p.sessions || 0} 堂</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 sm:gap-8">
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">NT$ {(p.amount || 0).toLocaleString()}</p>
                      <p className="text-xs text-neutral-500">
                        {p.payment_method || '—'}
                        {p.bank_last5 ? ` · 末五碼 ${p.bank_last5}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-400">{p.created_at?.slice(0, 10)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => confirmPayment(p.id)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                        確認入帳
                      </button>
                      <button onClick={() => refundPayment(p.id, p.amount)}
                        className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors">
                        退款
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Report */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-neutral-900">月度收入報表</h3>

        {/* Trend Chart */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-6">
          <p className="font-bold text-sm text-neutral-700 mb-4">營收趨勢（近 6 個月）</p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3', fontSize: 12 }} dx={-10} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  cursor={{ fill: '#F5F5F5' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number, name: string) => [`NT$ ${value.toLocaleString()}`, name === 'confirmed' ? '已確認營收' : '退款']}
                />
                <Legend formatter={(v) => v === 'confirmed' ? '已確認營收' : '退款'} />
                <Bar dataKey="confirmed" name="confirmed" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="refunded" name="refunded" fill="#F43F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Confirmed Payments Table */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <h4 className="font-bold text-neutral-900">已確認收入明細（{selectedMonth.replace('-', '年')}月）</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50/50 text-neutral-500 text-xs">
                  <th className="p-3 pl-6 font-medium">日期</th>
                  <th className="p-3 font-medium">學員姓名</th>
                  <th className="p-3 font-medium">方案</th>
                  <th className="p-3 font-medium text-right">堂數</th>
                  <th className="p-3 font-medium text-right">金額</th>
                  <th className="p-3 font-medium">付款方式</th>
                  <th className="p-3 pr-6 font-medium">確認時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {confirmedPayments.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-neutral-400">本月尚無已確認收入</td></tr>
                ) : confirmedPayments.map(p => (
                  <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors text-sm">
                    <td className="p-3 pl-6 text-neutral-600">{p.created_at?.slice(0, 10)}</td>
                    <td className="p-3 font-medium text-neutral-900">{p.students?.name || '—'}</td>
                    <td className="p-3 text-neutral-600">{p.plan_name || '—'}</td>
                    <td className="p-3 text-right">{p.sessions || '—'}</td>
                    <td className="p-3 text-right font-bold text-primary">NT$ {(p.amount || 0).toLocaleString()}</td>
                    <td className="p-3 text-neutral-600">{p.payment_method || '—'}</td>
                    <td className="p-3 pr-6 text-neutral-400 text-xs">{p.confirmed_at?.slice(0, 16)?.replace('T', ' ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
