import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, Mail, Phone, User, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Button, Input, Badge, FormField } from './UI';
import { supabase } from '../lib/supabase';
import { validateName, validatePhone, validateEmail, validateIdNumber, validateBirthDate, validateAddress, validateRequired, validateBankAccount } from '../lib/validators';

/* ── iOS-style wheel column ── */
const ITEM_HEIGHT = 40
const VISIBLE_COUNT = 5

const WheelColumn: React.FC<{
  items: { value: string; label: string }[]
  selectedValue: string
  onChange: (v: string) => void
}> = ({ items, selectedValue, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isUserScroll = useRef(true)

  const scrollToValue = useCallback((val: string, smooth = false) => {
    const idx = items.findIndex(i => i.value === val)
    if (idx < 0 || !containerRef.current) return
    isUserScroll.current = false
    containerRef.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: smooth ? 'auto' : 'auto' })
    setTimeout(() => { isUserScroll.current = true }, 120)
  }, [items])

  useEffect(() => { scrollToValue(selectedValue) }, [selectedValue, scrollToValue])

  const handleScroll = () => {
    if (!isUserScroll.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!containerRef.current) return
      const idx = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT)
      const clamped = Math.max(0, Math.min(idx, items.length - 1))
      containerRef.current.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' })
      if (items[clamped] && items[clamped].value !== selectedValue) onChange(items[clamped].value)
    }, 80)
  }

  const padH = ((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT

  return (
    <div className="relative" style={{ height: VISIBLE_COUNT * ITEM_HEIGHT }}>
      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-2 z-10 pointer-events-none border-t border-b border-neutral-200" style={{ top: padH, height: ITEM_HEIGHT }} />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        <div style={{ height: padH }} />
        {items.map(item => {
          const active = item.value === selectedValue
          return (
            <div
              key={item.value}
              style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'start' }}
              className={`flex items-center justify-center text-sm transition-colors ${active ? 'text-neutral-900 font-semibold' : 'text-neutral-400'}`}
            >
              {item.label}
            </div>
          )
        })}
        <div style={{ height: padH }} />
      </div>
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    </div>
  )
}

/* ── Coach date wheel picker ── */
const CoachDateWheelPicker: React.FC<{
  value: string
  onChange: (dateStr: string) => void
  label?: string
  yearRange?: [number, number]
}> = ({ value, onChange, label, yearRange = [1950, 2008] }) => {
  const [startYear, endYear] = yearRange

  const parseDate = (v: string) => {
    if (!v) return { y: String(endYear), m: '01', d: '01' }
    const [y, m, d] = v.split('-')
    return { y: y || String(endYear), m: m || '01', d: d || '01' }
  }

  const parsed = parseDate(value)
  const [year, setYear] = useState(parsed.y)
  const [month, setMonth] = useState(parsed.m)
  const [day, setDay] = useState(parsed.d)

  useEffect(() => {
    const p = parseDate(value)
    setYear(p.y)
    setMonth(p.m)
    setDay(p.d)
  }, [value])

  useEffect(() => {
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate()
    const clampedDay = Number(day) > daysInMonth ? String(daysInMonth).padStart(2, '0') : day
    const dateStr = `${year}-${month}-${clampedDay}`
    if (dateStr !== value) onChange(dateStr)
  }, [year, month, day])

  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const y = String(endYear - i)
    return { value: y, label: y + '年' }
  })
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    return { value: m, label: (i + 1) + '月' }
  })
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return { value: d, label: (i + 1) + '日' }
  })

  return (
    <div>
      {label && <p className="text-xs font-medium text-neutral-500 mb-1">{label}</p>}
      <div className="bg-white rounded-xl border border-neutral-200 p-3">
        <div className="flex gap-1">
          <div className="flex-[1.2]"><WheelColumn items={years} selectedValue={year} onChange={setYear} /></div>
          <div className="flex-1"><WheelColumn items={months} selectedValue={month} onChange={setMonth} /></div>
          <div className="flex-1"><WheelColumn items={days} selectedValue={day} onChange={setDay} /></div>
        </div>
        <p className="text-center text-xs text-neutral-400 mt-2">{year}/{month}/{day}</p>
      </div>
    </div>
  )
}

/* ── Helper ── */
function calculateAge(birthday: string): number {
  const birth = new Date(birthday)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const md = today.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function calcTenure(hireDate: string): string {
  if (!hireDate) return ''
  const hire = new Date(hireDate)
  const today = new Date()
  let years = today.getFullYear() - hire.getFullYear()
  let months = today.getMonth() - hire.getMonth()
  if (today.getDate() < hire.getDate()) months--
  if (months < 0) { years--; months += 12 }
  if (years <= 0 && months <= 0) return '未滿1月'
  if (years <= 0) return months + '個月'
  if (months <= 0) return years + '年'
  return years + '年' + months + '個月'
}

const EMPLOYMENT_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'full_time', label: '全職', color: 'bg-blue-100 text-blue-700' },
  { value: 'part_time', label: '兼職', color: 'bg-amber-100 text-amber-700' },
  { value: 'hourly', label: '鐘點', color: 'bg-green-100 text-green-700' },
]

const emptyForm = {
  name: '', gender: '', birth_date: '1990-01-01', id_number: '',
  phone: '', email: '', address: '',
  emergency_contact: '', emergency_phone: '',
  hire_date: '2026-01-01', job_title: '', employment_type: '',
  contract_start: '', contract_end: '',
  bank_name: '', bank_branch: '', bank_account: '', account_holder: '',
  specialties: [] as string[], certifications: [] as string[],
  experience: '', notes: '',
}

export const AdminCoachManagement: React.FC = () => {
  const [coaches, setCoaches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ ...emptyForm })
  const [tagInput, setTagInput] = useState('')
  const [certInput, setCertInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successInfo, setSuccessInfo] = useState({ name: '', employment_type: '', hire_date: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const fetchCoaches = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('coaches')
      .select('id, name, phone, email, specialization, is_active, gender, birth_date, hire_date, job_title, employment_type, bank_name, bank_account, certifications, experience, notes, address, emergency_contact, emergency_phone, id_number, bank_branch, account_holder, termination_date')
      .order('name')
    if (data) {
      setCoaches(data.map(c => ({
        ...c,
        specialties: c.specialization ? c.specialization.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      })))
    }
    setLoading(false)
  }

  useEffect(() => { fetchCoaches() }, [])

  const resetForm = () => {
    setForm({ ...emptyForm })
    setStep(1)
    setTagInput('')
    setCertInput('')
    setShowSuccess(false)
    setFormErrors({})
  }

  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {}
    if (s === 1) {
      const nameErr = validateName(form.name, '教練姓名')
      if (nameErr) errs.name = nameErr
      const phoneErr = validatePhone(form.phone, true)
      if (phoneErr) errs.phone = phoneErr
      if (form.email) { const emailErr = validateEmail(form.email); if (emailErr) errs.email = emailErr }
      const idErr = validateIdNumber(form.id_number)
      if (idErr) errs.id_number = idErr
      const bdErr = validateBirthDate(form.birth_date)
      if (bdErr) errs.birth_date = bdErr
      const epErr = validatePhone(form.emergency_phone)
      if (epErr) errs.emergency_phone = epErr
      const addrErr = validateAddress(form.address)
      if (addrErr) errs.address = addrErr
    }
    if (s === 2) {
      const hdErr = validateRequired(form.hire_date, '入職日期')
      if (hdErr) errs.hire_date = hdErr
      const etErr = validateRequired(form.employment_type, '僱用類型')
      if (etErr) errs.employment_type = etErr
    }
    if (s === 3) {
      const baErr = validateBankAccount(form.bank_account)
      if (baErr) errs.bank_account = baErr
    }
    setFormErrors(prev => ({ ...prev, ...errs }))
    if (Object.keys(errs).length > 0) return false
    return true
  }

  const handleNext = () => {
    if (!validateStep(step)) return
    setStep(step + 1)
  }

  const handleAddCoach = async () => {
    if (!validateStep(1) || !validateStep(2)) return
    setSaving(true)
    const { error } = await supabase.from('coaches').insert({
      name: form.name,
      gender: form.gender || null,
      birth_date: form.birth_date || null,
      id_number: form.id_number || null,
      phone: form.phone,
      email: form.email || null,
      address: form.address || null,
      emergency_contact: form.emergency_contact || null,
      emergency_phone: form.emergency_phone || null,
      hire_date: form.hire_date || null,
      job_title: form.job_title || null,
      employment_type: form.employment_type || null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      bank_name: form.bank_name || null,
      bank_branch: form.bank_branch || null,
      bank_account: form.bank_account || null,
      account_holder: form.account_holder || null,
      specialization: Array.isArray(form.specialties) ? form.specialties.join(', ') : (form.specialties || ''),
      certifications: form.certifications.length > 0 ? form.certifications : null,
      experience: form.experience || null,
      notes: form.notes || null,
      is_active: true,
    })
    setSaving(false)
    if (error) {
      alert('新增失敗：' + error.message)
      return
    }
    setSuccessInfo({ name: form.name, employment_type: form.employment_type, hire_date: form.hire_date })
    setShowSuccess(true)
    await fetchCoaches()
  }

  const handleDeleteCoach = async (id: string) => {
    if (!confirm('確定要刪除此教練？')) return
    await supabase.from('coaches').delete().eq('id', id)
    await fetchCoaches()
  }

  const filteredCoaches = coaches.filter(c =>
    !searchQuery || c.name?.includes(searchQuery) || c.specialties?.some((s: string) => s.includes(searchQuery))
  )

  const empLabel = (t: string) => EMPLOYMENT_TYPES.find(e => e.value === t)?.label || t || '—'
  const empColor = (t: string) => EMPLOYMENT_TYPES.find(e => e.value === t)?.color || 'bg-neutral-100 text-neutral-600'

  const addTag = (field: 'specialties' | 'certifications', val: string) => {
    const trimmed = val.trim()
    if (!trimmed) return
    if (!form[field].includes(trimmed)) {
      setForm(prev => ({ ...prev, [field]: [...prev[field], trimmed] }))
    }
  }

  const removeTag = (field: 'specialties' | 'certifications', idx: number) => {
    setForm(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== idx) }))
  }

  /* ── Step content renderers ── */
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <p className="font-bold text-sm text-neutral-700">基本資料</p>
        <FormField label="教練姓名 *">
          <Input placeholder="請輸入姓名" value={form.name}
            className={formErrors.name ? 'border-red-400 ring-1 ring-red-200' : ''}
            onChange={e => { setForm({ ...form, name: e.target.value }); if (formErrors.name) { const err = validateName(e.target.value, '教練姓名'); setFormErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); } }}
            onBlur={() => { const err = validateName(form.name, '教練姓名'); setFormErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); }}
          />
          {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
        </FormField>
        <FormField label="性別 *">
          <div className="flex gap-2">
            {['男', '女'].map(g => (
              <button key={g} type="button" onClick={() => setForm({ ...form, gender: g })}
                className={'flex-1 py-2.5 text-sm font-medium rounded-xl border transition-colors ' + (form.gender === g ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300')}>
                {g}
              </button>
            ))}
          </div>
        </FormField>
        <CoachDateWheelPicker label="出生日期" value={form.birth_date} onChange={v => { setForm({ ...form, birth_date: v }); if (formErrors.birth_date) { const err = validateBirthDate(v); setFormErrors(prev => { const n = {...prev}; if (err) n.birth_date = err; else delete n.birth_date; return n; }); } }} yearRange={[1950, 2008]} />
        {formErrors.birth_date && <p className="text-xs text-red-500 mt-1">{formErrors.birth_date}</p>}
        {form.birth_date && !formErrors.birth_date && (
          <p className="text-xs text-neutral-500">年齡：{calculateAge(form.birth_date)} 歲</p>
        )}
        <FormField label="身分證字號">
          <Input placeholder="例如：A123456789" value={form.id_number}
            className={formErrors.id_number ? 'border-red-400 ring-1 ring-red-200' : ''}
            onChange={e => { setForm({ ...form, id_number: e.target.value }); if (formErrors.id_number) { const err = validateIdNumber(e.target.value); setFormErrors(prev => { const n = {...prev}; if (err) n.id_number = err; else delete n.id_number; return n; }); } }}
            onBlur={() => { const err = validateIdNumber(form.id_number); setFormErrors(prev => { const n = {...prev}; if (err) n.id_number = err; else delete n.id_number; return n; }); }}
          />
          {formErrors.id_number && <p className="text-xs text-red-500 mt-1">{formErrors.id_number}</p>}
        </FormField>
      </div>
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <p className="font-bold text-sm text-neutral-700">聯絡方式</p>
        <FormField label="聯絡電話 *">
          <Input type="tel" placeholder="例如：0912345678" value={form.phone}
            className={formErrors.phone ? 'border-red-400 ring-1 ring-red-200' : ''}
            onChange={e => { setForm({ ...form, phone: e.target.value }); if (formErrors.phone) { const err = validatePhone(e.target.value, true); setFormErrors(prev => { const n = {...prev}; if (err) n.phone = err; else delete n.phone; return n; }); } }}
            onBlur={() => { const err = validatePhone(form.phone, true); setFormErrors(prev => { const n = {...prev}; if (err) n.phone = err; else delete n.phone; return n; }); }}
          />
          {formErrors.phone && <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>}
        </FormField>
        <FormField label="電子郵件">
          <Input type="email" placeholder="例如：coach@example.com" value={form.email}
            className={formErrors.email ? 'border-red-400 ring-1 ring-red-200' : ''}
            onChange={e => { setForm({ ...form, email: e.target.value }); if (formErrors.email) { const err = form.email || e.target.value ? validateEmail(e.target.value) : ''; setFormErrors(prev => { const n = {...prev}; if (err) n.email = err; else delete n.email; return n; }); } }}
            onBlur={() => { if (form.email) { const err = validateEmail(form.email); setFormErrors(prev => { const n = {...prev}; if (err) n.email = err; else delete n.email; return n; }); } }}
          />
          {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
        </FormField>
        <FormField label="通訊地址">
          <Input placeholder="請輸入地址" value={form.address}
            className={formErrors.address ? 'border-red-400 ring-1 ring-red-200' : ''}
            onChange={e => { setForm({ ...form, address: e.target.value }); if (formErrors.address) { const err = validateAddress(e.target.value); setFormErrors(prev => { const n = {...prev}; if (err) n.address = err; else delete n.address; return n; }); } }}
            onBlur={() => { const err = validateAddress(form.address); setFormErrors(prev => { const n = {...prev}; if (err) n.address = err; else delete n.address; return n; }); }}
          />
          {formErrors.address && <p className="text-xs text-red-500 mt-1">{formErrors.address}</p>}
        </FormField>
      </div>
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <p className="font-bold text-sm text-neutral-700">緊急聯絡人</p>
        <FormField label="姓名">
          <Input placeholder="緊急聯絡人姓名" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} />
        </FormField>
        <FormField label="電話">
          <Input type="tel" placeholder="緊急聯絡人電話" value={form.emergency_phone}
            className={formErrors.emergency_phone ? 'border-red-400 ring-1 ring-red-200' : ''}
            onChange={e => { setForm({ ...form, emergency_phone: e.target.value }); if (formErrors.emergency_phone) { const err = validatePhone(e.target.value); setFormErrors(prev => { const n = {...prev}; if (err) n.emergency_phone = err; else delete n.emergency_phone; return n; }); } }}
            onBlur={() => { const err = validatePhone(form.emergency_phone); setFormErrors(prev => { const n = {...prev}; if (err) n.emergency_phone = err; else delete n.emergency_phone; return n; }); }}
          />
          {formErrors.emergency_phone && <p className="text-xs text-red-500 mt-1">{formErrors.emergency_phone}</p>}
        </FormField>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <p className="font-bold text-sm text-neutral-700">入職資訊</p>
        <CoachDateWheelPicker label="入職日期 *" value={form.hire_date} onChange={v => setForm({ ...form, hire_date: v })} yearRange={[2020, 2026]} />
        {form.hire_date && (
          <p className="text-xs text-neutral-500">年資：{calcTenure(form.hire_date)}</p>
        )}
        <FormField label="職稱">
          <Input placeholder="例如：主任教練、助理教練" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
        </FormField>
        <FormField label="僱用類型 *">
          <div className="flex gap-2">
            {EMPLOYMENT_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setForm({ ...form, employment_type: t.value })}
                className={'flex-1 py-2.5 text-sm font-medium rounded-xl border transition-colors ' + (form.employment_type === t.value ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300')}>
                {t.label}
              </button>
            ))}
          </div>
        </FormField>
      </div>
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <p className="font-bold text-sm text-neutral-700">合約期間</p>
        <CoachDateWheelPicker label="合約起始日" value={form.contract_start || '2026-01-01'} onChange={v => setForm({ ...form, contract_start: v })} yearRange={[2020, 2028]} />
        <CoachDateWheelPicker label="合約結束日（不填代表長期）" value={form.contract_end || '2027-01-01'} onChange={v => setForm({ ...form, contract_end: v })} yearRange={[2020, 2030]} />
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <p className="font-bold text-sm text-neutral-700">匯款資訊</p>
        <FormField label="銀行名稱">
          <Input placeholder="例如：中國信託" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
        </FormField>
        <FormField label="分行名稱">
          <Input placeholder="例如：忠孝分行" value={form.bank_branch} onChange={e => setForm({ ...form, bank_branch: e.target.value })} />
        </FormField>
        <FormField label="匯款帳號">
          <Input placeholder="請輸入帳號" value={form.bank_account}
            className={formErrors.bank_account ? 'border-red-400 ring-1 ring-red-200' : ''}
            onChange={e => { setForm({ ...form, bank_account: e.target.value }); if (formErrors.bank_account) { const err = validateBankAccount(e.target.value); setFormErrors(prev => { const n = {...prev}; if (err) n.bank_account = err; else delete n.bank_account; return n; }); } }}
            onBlur={() => { const err = validateBankAccount(form.bank_account); setFormErrors(prev => { const n = {...prev}; if (err) n.bank_account = err; else delete n.bank_account; return n; }); }}
          />
          {formErrors.bank_account && <p className="text-xs text-red-500 mt-1">{formErrors.bank_account}</p>}
        </FormField>
        <FormField label="戶名">
          <Input placeholder="請輸入戶名" value={form.account_holder} onChange={e => setForm({ ...form, account_holder: e.target.value })} />
        </FormField>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <p className="font-bold text-sm text-neutral-700">專長領域</p>
        <div className="flex flex-wrap gap-2">
          {form.specialties.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full">
              {s}
              <button onClick={() => removeTag('specialties', i)} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="輸入專長後按 Enter" value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('specialties', tagInput); setTagInput('') } }}
          />
          <button onClick={() => { addTag('specialties', tagInput); setTagInput('') }} className="px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium">新增</button>
        </div>
      </div>

      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <p className="font-bold text-sm text-neutral-700">證照</p>
        <div className="flex flex-wrap gap-2">
          {form.certifications.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full">
              {c}
              <button onClick={() => removeTag('certifications', i)} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="輸入證照後按 Enter" value={certInput}
            onChange={e => setCertInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('certifications', certInput); setCertInput('') } }}
          />
          <button onClick={() => { addTag('certifications', certInput); setCertInput('') }} className="px-3 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium">新增</button>
        </div>
      </div>

      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        <p className="font-bold text-sm text-neutral-700">經歷與備註</p>
        <FormField label="經歷">
          <textarea className="w-full border border-neutral-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" rows={3} placeholder="教練經歷" value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} />
        </FormField>
        <FormField label="備註">
          <textarea className="w-full border border-neutral-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" rows={3} placeholder="其他備註" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </FormField>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 space-y-2">
        <p className="font-bold text-sm text-blue-700">確認摘要</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-neutral-500">姓名：</span><span className="font-medium">{form.name}</span></div>
          <div><span className="text-neutral-500">年齡：</span><span className="font-medium">{form.birth_date ? calculateAge(form.birth_date) + ' 歲' : '—'}</span></div>
          <div><span className="text-neutral-500">電話：</span><span className="font-medium">{form.phone}</span></div>
          <div><span className="text-neutral-500">入職日期：</span><span className="font-medium">{form.hire_date}</span></div>
          <div><span className="text-neutral-500">僱用類型：</span><span className="font-medium">{empLabel(form.employment_type)}</span></div>
          <div><span className="text-neutral-500">帳號末四碼：</span><span className="font-medium">{form.bank_account ? '****' + form.bank_account.slice(-4) : '—'}</span></div>
        </div>
      </div>
    </div>
  )

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
        <Check size={40} className="text-green-600" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-2xl font-bold text-neutral-900">新增成功！</p>
        <p className="text-neutral-500">教練已加入系統</p>
      </div>
      <div className="bg-neutral-50 rounded-xl p-5 w-full max-w-xs space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-neutral-500">姓名</span><span className="font-bold">{successInfo.name}</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">僱用類型</span><span className={'font-bold px-2 py-0.5 rounded-full text-xs ' + empColor(successInfo.employment_type)}>{empLabel(successInfo.employment_type)}</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">入職日期</span><span className="font-bold">{successInfo.hire_date}</span></div>
      </div>
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={() => { resetForm(); }} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium">繼續新增</button>
        <button onClick={() => { resetForm(); setShowAddModal(false) }} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium">關閉</button>
      </div>
    </div>
  )

  const stepLabels = ['基本資料', '入職資訊', '財務匯款', '專業備註']

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900 whitespace-nowrap">教練管理</h2>
        <Button variant="primary" onClick={() => { resetForm(); setShowAddModal(true) }} className="w-full sm:w-auto">
          <Plus size={18} /> 新增教練
        </Button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-6 border-b border-neutral-100">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <Input type="text" placeholder="搜尋教練姓名、專長..." className="pl-12" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 text-neutral-500 text-sm">
                <th className="p-4 font-medium first:pl-6">教練資訊</th>
                <th className="p-4 font-medium">聯絡方式</th>
                <th className="p-4 font-medium">入職 / 年資</th>
                <th className="p-4 font-medium">僱用類型</th>
                <th className="p-4 font-medium">專長領域</th>
                <th className="p-4 font-medium">狀態</th>
                <th className="p-4 font-medium text-right last:pr-6">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-neutral-400">載入中...</td></tr>
              ) : filteredCoaches.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-neutral-400">無教練資料</td></tr>
              ) : filteredCoaches.map((coach) => (
                <tr key={coach.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="p-4 first:pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {coach.name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-neutral-900">{coach.name}</p>
                        {coach.job_title && <p className="text-xs text-neutral-500">{coach.job_title}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 text-sm text-neutral-600">
                      {coach.phone && <div className="flex items-center gap-1.5"><Phone size={14} /> {coach.phone}</div>}
                      {coach.email && <div className="flex items-center gap-1.5"><Mail size={14} /> {coach.email}</div>}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <p className="text-neutral-900">{coach.hire_date || '—'}</p>
                      {coach.hire_date && <p className="text-xs text-neutral-500">{calcTenure(coach.hire_date)}</p>}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={'text-xs font-medium px-2.5 py-1 rounded-full ' + empColor(coach.employment_type)}>
                      {empLabel(coach.employment_type)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {coach.specialties?.map((s: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={coach.is_active ? 'accent' : 'danger'}>
                      {coach.is_active ? '在職' : '離職'}
                    </Badge>
                  </td>
                  <td className="p-4 text-right last:pr-6">
                    <button className="p-2 text-neutral-400 hover:text-danger transition-colors rounded-lg hover:bg-danger/10"
                      onClick={() => handleDeleteCoach(coach.id)}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Coach Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => { resetForm(); setShowAddModal(false) }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-3xl shadow-xl flex flex-col mx-4"
          >
            {showSuccess ? (
              <div className="p-8">{renderSuccess()}</div>
            ) : (
              <>
                {/* Header + Steps */}
                <div className="p-6 pb-4 border-b border-neutral-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-neutral-900">新增教練</h3>
                    <button onClick={() => { resetForm(); setShowAddModal(false) }} className="p-2 hover:bg-neutral-100 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {stepLabels.map((label, i) => {
                      const s = i + 1
                      const active = step === s
                      const done = step > s
                      return (
                        <div key={s} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${active ? 'bg-primary text-white scale-110' : done ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                            {done ? <Check size={14} /> : s}
                          </div>
                          <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-neutral-400'}`}>{label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  {step === 1 && renderStep1()}
                  {step === 2 && renderStep2()}
                  {step === 3 && renderStep3()}
                  {step === 4 && renderStep4()}
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 border-t border-neutral-100 flex gap-3">
                  {step > 1 && (
                    <button onClick={() => setStep(step - 1)} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium flex items-center justify-center gap-1">
                      <ChevronLeft size={16} /> 上一步
                    </button>
                  )}
                  {step < 4 ? (
                    <button onClick={handleNext} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-1">
                      下一步 <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button onClick={handleAddCoach} disabled={saving} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50">
                      {saving ? '新增中...' : '確認新增教練'}
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};
