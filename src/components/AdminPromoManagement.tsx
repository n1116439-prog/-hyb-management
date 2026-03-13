import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Input, FormField } from './UI'
import { Plus, Edit2, Trash2, Eye, Tag, Copy, Check } from 'lucide-react'

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
  })

  const fetchPromos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setPromos(data)
    setLoading(false)
  }

  const fetchStudentsAndCourses = async () => {
    const { data: studentsData } = await supabase.from('students').select('id, name, student_number')
    if (studentsData) setStudents(studentsData)
    const { data: coursesData } = await supabase.from('courses').select('id, name')
    if (coursesData) setCourses(coursesData)
  }

  useEffect(() => {
    fetchPromos()
    fetchStudentsAndCourses()
  }, [])

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = 'HYB-'
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, code }))
  }

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      alert('請填寫優惠碼和名稱')
      return
    }

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
      is_active: true,
    }

    if (selectedPromo) {
      const { error } = await supabase.from('promo_codes').update(insertData).eq('id', selectedPromo.id)
      if (error) { alert('更新失敗：' + error.message); return }
    } else {
      const { error } = await supabase.from('promo_codes').insert(insertData)
      if (error) { alert('新增失敗：' + error.message); return }
    }

    setShowAddModal(false)
    setSelectedPromo(null)
    resetForm()
    fetchPromos()
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('promo_codes').update({ is_active: !current }).eq('id', id)
    fetchPromos()
  }

  const deletePromo = async (id: string) => {
    if (!confirm('確定要刪除此優惠碼？')) return
    await supabase.from('promo_codes').delete().eq('id', id)
    fetchPromos()
  }

  const viewUsage = async (promo: any) => {
    const { data } = await supabase
      .from('promo_code_usage')
      .select('*, students(name, student_number)')
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
      max_uses: '', start_date: '', end_date: '', notes: '',
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
    })
    setSelectedPromo(promo)
    setShowAddModal(true)
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900">優惠碼管理</h2>
        <button
          onClick={() => { resetForm(); setSelectedPromo(null); setShowAddModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium"
        >
          <Plus size={18} /> 新增優惠碼
        </button>
      </div>

      {/* 優惠碼列表 */}
      <div className="space-y-3">
        {promos.length === 0 && !loading && (
          <div className="text-center py-12 text-neutral-500">尚無優惠碼</div>
        )}
        {promos.map(promo => (
          <div key={promo.id} className={`bg-white rounded-xl border p-4 ${!promo.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Tag size={20} className="text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-neutral-900">{promo.name}</p>
                    <button
                      onClick={() => copyCode(promo.code, promo.id)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded text-xs font-mono"
                    >
                      {promo.code}
                      {copiedId === promo.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${promo.is_active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {promo.is_active ? '啟用中' : '已停用'}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {promo.type === 'percentage' && `打 ${100 - promo.value} 折`}
                    {promo.type === 'fixed' && `折扣 NT$ ${promo.value}`}
                    {promo.type === 'free_sessions' && `贈送 ${promo.value} 堂`}
                    {promo.min_sessions > 0 && ` · 最低 ${promo.min_sessions} 堂`}
                    {' · '}已使用 {promo.current_uses || 0}{promo.max_uses ? `/${promo.max_uses}` : ''} 次
                    {promo.target_type !== 'all' && ` · ${promo.target_type === 'specific_students' ? '指定學員' : promo.target_type === 'specific_course' ? '指定課程' : '新生限定'}`}
                  </p>
                  {(promo.start_date || promo.end_date) && (
                    <p className="text-xs text-neutral-400">{promo.start_date || '無限'} ~ {promo.end_date || '無限'}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => viewUsage(promo)} className="p-2 hover:bg-neutral-100 rounded-lg"><Eye size={16} /></button>
                <button onClick={() => editPromo(promo)} className="p-2 hover:bg-neutral-100 rounded-lg"><Edit2 size={16} /></button>
                <button onClick={() => toggleActive(promo.id, promo.is_active)} className="p-2 hover:bg-neutral-100 rounded-lg text-yellow-600">
                  {promo.is_active ? '停用' : '啟用'}
                </button>
                <button onClick={() => deletePromo(promo.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 新增/編輯 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold">{selectedPromo ? '編輯優惠碼' : '新增優惠碼'}</h3>

            <div className="flex gap-2">
              <div className="flex-1">
                <FormField label="優惠碼">
                  <Input value={formData.code} onChange={e => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="例如：HYB-NEW2026" />
                </FormField>
              </div>
              <button onClick={generateCode} className="mt-6 px-3 py-2 bg-neutral-100 rounded-lg text-sm">自動產生</button>
            </div>

            <FormField label="優惠名稱">
              <Input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="例如：新生優惠" />
            </FormField>

            <FormField label="優惠類型">
              <div className="flex gap-2">
                {[
                  { value: 'percentage', label: '折扣 %' },
                  { value: 'fixed', label: '固定折扣' },
                  { value: 'free_sessions', label: '贈送堂數' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setFormData(prev => ({ ...prev, type: opt.value as any }))}
                    className={`flex-1 py-2 text-sm rounded-lg border ${formData.type === opt.value ? 'bg-primary text-white border-primary' : 'border-neutral-300'}`}
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
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl">
                <option value="all">所有人</option>
                <option value="specific_students">指定學員</option>
                <option value="specific_course">指定課程</option>
                <option value="new_student">新生限定</option>
              </select>
            </FormField>

            {formData.target_type === 'specific_students' && (
              <FormField label="選擇學員">
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-2 p-1 hover:bg-neutral-50 rounded cursor-pointer">
                      <input type="checkbox" checked={formData.target_student_ids.includes(s.id)}
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
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl">
                  <option value="">請選擇</option>
                  {courses.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </FormField>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <FormField label="最大使用次數（空 = 無限）">
                  <Input value={formData.max_uses} onChange={e => setFormData(prev => ({ ...prev, max_uses: e.target.value }))} placeholder="無限" />
                </FormField>
              </div>
            </div>

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

            <FormField label="備註（選填）">
              <Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="內部備註" />
            </FormField>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowAddModal(false); setSelectedPromo(null); resetForm() }} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium">取消</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium">{selectedPromo ? '儲存變更' : '建立優惠碼'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 使用紀錄 Modal */}
      {showUsageModal && selectedPromo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowUsageModal(false); setSelectedPromo(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">使用紀錄 — {selectedPromo.code}</h3>
            {usageRecords.length > 0 ? (
              <div className="space-y-2">
                {usageRecords.map(r => (
                  <div key={r.id} className="bg-neutral-50 rounded-lg p-3 flex justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.students?.name} ({r.students?.student_number})</p>
                      <p className="text-xs text-neutral-500">{new Date(r.used_at).toLocaleDateString('zh-TW')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm line-through text-neutral-400">NT$ {r.original_amount}</p>
                      <p className="font-bold text-green-600">NT$ {r.final_amount}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-neutral-500">尚無使用紀錄</p>
            )}
            <button onClick={() => { setShowUsageModal(false); setSelectedPromo(null) }} className="w-full mt-4 py-3 bg-neutral-100 rounded-xl font-medium">關閉</button>
          </div>
        </div>
      )}
    </div>
  )
}
