import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Input, FormField } from './UI'
import { Plus, Edit2, Trash2, Eye, Tag, Copy, Check, X } from 'lucide-react'

export const AdminPromoManagement: React.FC = () => {
  const [promos, setPromos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUsageModal, setShowUsageModal] = useState(false)
  const [selectedPromo, setSelectedPromo] = useState<any>(null)
  const [usageRecords, setUsageRecords] = useState<any[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [students, setStudents] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  // Summary stats
  const [activeCount, setActiveCount] = useState(0)
  const [monthUsageCount, setMonthUsageCount] = useState(0)
  const [monthDiscountTotal, setMonthDiscountTotal] = useState(0)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'percentage' as 'percentage' | 'fixed' | 'free_sessions',
    value: 0,
    min_sessions: 0,
    target_type: 'all' as 'all' | 'specific_students' | 'specific_course' | 'new_student',
    target_student_ids: [] as string[],
    target_course_id: '',
    max_uses: '',
    start_date: '',
    end_date: '',
    notes: '',
    description: '',
    first_enrollment_only: false,
  })

  const fetchPromos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      setPromos(data)
      // Calculate active count
      const today = new Date().toISOString().slice(0, 10)
      const active = data.filter(p => p.is_active && (!p.end_date || p.end_date >= today))
      setActiveCount(active.length)
    }
    setLoading(false)
  }

  const fetchMonthStats = async () => {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const { data, count } = await supabase
      .from('promo_code_usage')
      .select('discount_amount', { count: 'exact' })
      .gte('used_at', monthStart)
    setMonthUsageCount(count || 0)
    const total = (data || []).reduce((sum: number, r: any) => sum + (r.discount_amount || 0), 0)
    setMonthDiscountTotal(total)
  }

  const fetchStudentsAndCourses = async () => {
    const { data: studentsData } = await supabase.from('students').select('id, name, student_number')
    if (studentsData) setStudents(studentsData)
    const { data: coursesData } = await supabase.from('courses').select('id, name')
    if (coursesData) setCourses(coursesData)
  }

  useEffect(() => {
    fetchPromos()
    fetchMonthStats()
    fetchStudentsAndCourses()
  }, [])

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = 'HYB-'
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, code }))
  }

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      alert('請填寫優惠碼和名稱')
      return
    }
    setSaving(true)

    const insertData: any = {
      code: formData.code.toUpperCase(),
      name: formData.name,
      type: formData.type,
      value: formData.value,
      min_sessions: formData.min_sessions || 0,
      target_type: formData.target_type,
      target_student_ids: formData.target_type === 'specific_students' ? formData.target_student_ids : [],
      target_course_id: formData.target_type === 'specific_course' ? formData.target_course_id : null,
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      notes: formData.notes,
      description: formData.description || null,
      first_enrollment_only: formData.first_enrollment_only,
      is_active: true,
    }

    if (selectedPromo) {
      const { error } = await supabase.from('promo_codes').update(insertData).eq('id', selectedPromo.id)
      if (error) { alert('更新失敗：' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('promo_codes').insert(insertData)
      if (error) { alert('新增失敗：' + error.message); setSaving(false); return }
    }

    setSaving(false)
    setShowAddModal(false)
    setSelectedPromo(null)
    resetForm()
    fetchPromos()
    fetchMonthStats()
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('promo_codes').update({ is_active: !current }).eq('id', id)
    fetchPromos()
  }

  const deletePromo = async (id: string) => {
    if (!confirm('確定要刪除此優惠碼？相關使用紀錄也會一併刪除。')) return
    await supabase.from('promo_code_usage').delete().eq('promo_code_id', id)
    await supabase.from('promo_codes').delete().eq('id', id)
    fetchPromos()
    fetchMonthStats()
  }

  const viewUsage = async (promo: any) => {
    const { data } = await supabase
      .from('promo_code_usage')
      .select('*, students(name, student_code)')
      .eq('promo_code_id', promo.id)
      .order('used_at', { ascending: false })
    setUsageRecords(data || [])
    setSelectedPromo(promo)
    setShowUsageModal(true)
  }

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const resetForm = () => {
    setFormData({
      code: '', name: '', type: 'percentage', value: 0, min_sessions: 0,
      target_type: 'all', target_student_ids: [], target_course_id: '',
      max_uses: '', start_date: '', end_date: '', notes: '', description: '',
      first_enrollment_only: false,
    })
  }

  const editPromo = (promo: any) => {
    setFormData({
      code: promo.code,
      name: promo.name,
      type: promo.type,
      value: promo.value,
      min_sessions: promo.min_sessions || 0,
      target_type: promo.target_type || 'all',
      target_student_ids: promo.target_student_ids || [],
      target_course_id: promo.target_course_id || '',
      max_uses: promo.max_uses?.toString() || '',
      start_date: promo.start_date || '',
      end_date: promo.end_date || '',
      notes: promo.notes || '',
      description: promo.description || '',
      first_enrollment_only: promo.first_enrollment_only || false,
    })
    setSelectedPromo(promo)
    setShowAddModal(true)
  }

  const formatValue = (promo: any) => {
    if (promo.type === 'percentage') return `打 ${10 - promo.value / 10} 折`
    if (promo.type === 'fixed') return `折 NT$${promo.value}`
    if (promo.type === 'free_sessions') return `贈 ${promo.value} 堂`
    return ''
  }

  const typeBadge = (type: string) => {
    if (type === 'percentage') return { label: '折扣%', color: 'bg-blue-100 text-blue-700' }
    if (type === 'fixed') return { label: '固定折扣', color: 'bg-green-100 text-green-700' }
    if (type === 'free_sessions') return { label: '贈送堂數', color: 'bg-purple-100 text-purple-700' }
    return { label: type, color: 'bg-neutral-100 text-neutral-600' }
  }

  const isExpired = (promo: any) => {
    if (!promo.end_date) return false
    return promo.end_date < new Date().toISOString().slice(0, 10)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900">優惠碼管理</h2>
        <button
          onClick={() => { resetForm(); setSelectedPromo(null); setShowAddModal(true) }}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium shadow-sm hover:shadow-md transition-shadow"
        >
          <Plus size={18} /> 新增優惠碼
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <p className="text-sm text-neutral-500">有效優惠碼</p>
          <p className="text-3xl font-bold text-neutral-900 mt-1">{activeCount}</p>
          <p className="text-xs text-neutral-400 mt-1">啟用中且未過期</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <p className="text-sm text-neutral-500">本月使用次數</p>
          <p className="text-3xl font-bold text-primary mt-1">{monthUsageCount}</p>
          <p className="text-xs text-neutral-400 mt-1">本月累計</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <p className="text-sm text-neutral-500">本月折扣總額</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">NT${monthDiscountTotal.toLocaleString()}</p>
          <p className="text-xs text-neutral-400 mt-1">本月優惠金額</p>
        </div>
      </div>

      {/* Promo Code Cards */}
      {loading ? (
        <div className="text-center py-12 text-neutral-400">載入中...</div>
      ) : promos.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">尚無優惠碼</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {promos.map(promo => {
            const badge = typeBadge(promo.type)
            const expired = isExpired(promo)
            const usagePercent = promo.max_uses ? Math.min(100, Math.round(((promo.current_uses || 0) / promo.max_uses) * 100)) : null

            return (
              <div key={promo.id} className={`bg-white rounded-2xl border border-neutral-100 overflow-hidden transition-opacity ${!promo.is_active || expired ? 'opacity-60' : ''}`}>
                {/* Card Header */}
                <div className="p-5 space-y-3">
                  {/* Code + Copy */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => copyCode(promo.code, promo.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                      <span className="font-mono font-bold text-lg text-neutral-900">{promo.code}</span>
                      {copiedId === promo.id ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-neutral-400" />}
                    </button>
                    {/* Toggle Switch */}
                    <button
                      onClick={() => toggleActive(promo.id, promo.is_active)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${promo.is_active ? 'bg-green-500' : 'bg-neutral-300'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${promo.is_active ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {/* Name + Type Badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-neutral-900">{promo.name}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                    {promo.first_enrollment_only && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">首次限定</span>
                    )}
                    {expired && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">已過期</span>
                    )}
                  </div>

                  {/* Value */}
                  <p className="text-2xl font-bold text-primary">{formatValue(promo)}</p>

                  {/* Details */}
                  <div className="space-y-2 text-sm text-neutral-600">
                    {/* Usage */}
                    <div className="flex items-center justify-between">
                      <span>使用狀況</span>
                      <span className="font-medium">
                        {promo.current_uses || 0} / {promo.max_uses || '無限制'}
                      </span>
                    </div>
                    {usagePercent !== null && (
                      <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    )}

                    {/* Date Range */}
                    <div className="flex items-center justify-between">
                      <span>有效期間</span>
                      <span className="font-medium text-xs">
                        {!promo.start_date && !promo.end_date ? '永久有效' : `${promo.start_date || '不限'} ~ ${promo.end_date || '不限'}`}
                      </span>
                    </div>

                    {/* Target */}
                    <div className="flex items-center justify-between">
                      <span>適用對象</span>
                      <span className="font-medium">
                        {promo.target_type === 'all' ? '所有人' : promo.target_type === 'specific_students' ? '指定學員' : promo.target_type === 'specific_course' ? '指定課程' : '新生限定'}
                      </span>
                    </div>

                    {/* Min Sessions */}
                    <div className="flex items-center justify-between">
                      <span>最低購買堂數</span>
                      <span className="font-medium">{promo.min_sessions > 0 ? promo.min_sessions + ' 堂' : '不限'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="border-t border-neutral-100 px-5 py-3 flex items-center justify-end gap-1">
                  <button onClick={() => viewUsage(promo)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500 transition-colors" title="查看紀錄">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => editPromo(promo)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500 transition-colors" title="編輯">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deletePromo(promo.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors" title="刪除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowAddModal(false); setSelectedPromo(null); resetForm() }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-xl font-bold">{selectedPromo ? '編輯優惠碼' : '新增優惠碼'}</h3>
              <button onClick={() => { setShowAddModal(false); setSelectedPromo(null); resetForm() }} className="p-2 hover:bg-neutral-100 rounded-xl"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <FormField label="優惠碼">
                    <Input value={formData.code} onChange={e => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="例如：HYB-NEW2026" />
                  </FormField>
                </div>
                <button onClick={generateCode} className="mt-6 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-sm font-medium transition-colors">自動產生</button>
              </div>

              <FormField label="優惠名稱">
                <Input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="例如：新生優惠" />
              </FormField>

              <FormField label="優惠說明（選填）">
                <textarea
                  className="w-full border border-neutral-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={2}
                  placeholder="優惠碼說明..."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </FormField>

              <FormField label="優惠類型">
                <div className="flex gap-2">
                  {[
                    { value: 'percentage', label: '折扣 %' },
                    { value: 'fixed', label: '固定折扣' },
                    { value: 'free_sessions', label: '贈送堂數' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setFormData(prev => ({ ...prev, type: opt.value as any }))}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-colors ${formData.type === opt.value ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300'}`}
                    >{opt.label}</button>
                  ))}
                </div>
              </FormField>

              <FormField label={formData.type === 'percentage' ? '折扣百分比（如 20 = 打8折）' : formData.type === 'fixed' ? '折扣金額（NT$）' : '贈送堂數'}>
                <Input type="number" value={formData.value} onChange={e => setFormData(prev => ({ ...prev, value: parseInt(e.target.value) || 0 }))} />
              </FormField>

              <FormField label="最低購買堂數（0 = 不限）">
                <Input type="number" value={formData.min_sessions} onChange={e => setFormData(prev => ({ ...prev, min_sessions: parseInt(e.target.value) || 0 }))} />
              </FormField>

              <FormField label="適用對象">
                <select value={formData.target_type} onChange={e => setFormData(prev => ({ ...prev, target_type: e.target.value as any }))}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="all">所有人</option>
                  <option value="specific_students">指定學員</option>
                  <option value="specific_course">指定課程</option>
                  <option value="new_student">新生限定</option>
                </select>
              </FormField>

              {formData.target_type === 'specific_students' && (
                <FormField label="選擇學員">
                  <div className="max-h-40 overflow-y-auto border border-neutral-200 rounded-xl p-2 space-y-1">
                    {students.map(s => (
                      <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={formData.target_student_ids.includes(s.id)}
                          className="rounded"
                          onChange={e => {
                            if (e.target.checked) setFormData(prev => ({ ...prev, target_student_ids: [...prev.target_student_ids, s.id] }))
                            else setFormData(prev => ({ ...prev, target_student_ids: prev.target_student_ids.filter(id => id !== s.id) }))
                          }} />
                        <span className="text-sm">{s.name} ({s.student_number})</span>
                      </label>
                    ))}
                  </div>
                </FormField>
              )}

              {formData.target_type === 'specific_course' && (
                <FormField label="選擇課程">
                  <select value={formData.target_course_id} onChange={e => setFormData(prev => ({ ...prev, target_course_id: e.target.value }))}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">請選擇</option>
                    {courses.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </FormField>
              )}

              <FormField label="最大使用次數（空 = 無限）">
                <Input value={formData.max_uses} onChange={e => setFormData(prev => ({ ...prev, max_uses: e.target.value }))} placeholder="無限" />
              </FormField>

              <div className="flex gap-3">
                <div className="flex-1">
                  <FormField label="開始日期（選填）">
                    <Input type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} />
                  </FormField>
                </div>
                <div className="flex-1">
                  <FormField label="結束日期（選填）">
                    <Input type="date" value={formData.end_date} onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))} />
                  </FormField>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.first_enrollment_only}
                  onChange={e => setFormData(prev => ({ ...prev, first_enrollment_only: e.target.checked }))}
                  className="rounded"
                />
                <div>
                  <p className="text-sm font-medium text-neutral-900">僅限首次報名使用</p>
                  <p className="text-xs text-neutral-500">勾選後此優惠碼僅限從未報名過的學員使用</p>
                </div>
              </label>

              <FormField label="備註（選填）">
                <Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="內部備註" />
              </FormField>
            </div>

            <div className="p-6 border-t border-neutral-100 flex gap-3">
              <button onClick={() => { setShowAddModal(false); setSelectedPromo(null); resetForm() }} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium">取消</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50">
                {saving ? '儲存中...' : selectedPromo ? '儲存變更' : '建立優惠碼'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Records Modal */}
      {showUsageModal && selectedPromo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowUsageModal(false); setSelectedPromo(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">使用紀錄</h3>
                <p className="text-sm text-neutral-500 font-mono">{selectedPromo.code}</p>
              </div>
              <button onClick={() => { setShowUsageModal(false); setSelectedPromo(null) }} className="p-2 hover:bg-neutral-100 rounded-xl"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {usageRecords.length > 0 ? (
                <div className="space-y-3">
                  {usageRecords.map(r => (
                    <div key={r.id} className="bg-neutral-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-neutral-900">{r.students?.name || '未知學員'}</p>
                          <p className="text-xs text-neutral-500 font-mono">{r.students?.student_code || '—'}</p>
                        </div>
                        <p className="text-xs text-neutral-400">{new Date(r.used_at).toLocaleDateString('zh-TW')}</p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-500">原價</span>
                        <span className="line-through text-neutral-400">NT${r.original_amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-500">折扣</span>
                        <span className="text-red-500">-NT${r.discount_amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-bold border-t border-neutral-200 pt-2">
                        <span>最終金額</span>
                        <span className="text-green-600">NT${r.final_amount?.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-400">
                  <Tag size={32} className="mx-auto mb-3 opacity-50" />
                  <p>尚未被使用</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
