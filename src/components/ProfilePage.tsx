import React, { useState, useEffect } from 'react'
import { User, Edit2, Plus, ChevronDown, ChevronUp, Lock, Phone, Mail, Save, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Input, FormField } from './UI'
import { validateName, validatePhone, validatePassword, validateConfirmPassword, validateBirthDate } from '../lib/validators'

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function calculateAge(birthday: string): number {
  const birth = new Date(birthday)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export const ProfilePage: React.FC = () => {
  const [userInfo, setUserInfo] = useState({ name: '', email: '', phone: '', userId: '' })
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' })
  const [students, setStudents] = useState<any[]>([])
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [studentForm, setStudentForm] = useState<any>({})
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', gender: '', birthDate: '', level: '', school: '' })
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState(false)
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [studentFormErrors, setStudentFormErrors] = useState<Record<string, string>>({})
  const [newStudentErrors, setNewStudentErrors] = useState<Record<string, string>>({})
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})

  const getParentUid = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) return user.id
    // LINE 登入 fallback
    try {
      const lineUser = localStorage.getItem('line_user')
      if (lineUser) {
        const profile = JSON.parse(lineUser)
        const { data } = await supabase
          .from('students')
          .select('parent_uid')
          .eq('line_uid', profile.userId)
          .limit(1)
          .single()
        if (data?.parent_uid) return data.parent_uid
      }
    } catch (e) {}
    return null
  }

  const fetchUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const metadata = user.user_metadata || {}
      setUserInfo({
        name: metadata.parentName || metadata.name || '',
        email: user.email || '',
        phone: metadata.phone || '',
        userId: user.id,
      })
      setProfileForm({
        name: metadata.parentName || metadata.name || '',
        phone: metadata.phone || '',
      })
      return
    }
    // LINE 登入 fallback
    try {
      const lineUser = localStorage.getItem('line_user')
      if (lineUser) {
        const profile = JSON.parse(lineUser)
        const { data: student } = await supabase
          .from('students')
          .select('parent_uid, name, phone, email')
          .eq('line_uid', profile.userId)
          .limit(1)
          .single()
        if (student) {
          setUserInfo({
            name: profile.displayName || student.name || '',
            email: student.email || '',
            phone: student.phone || '',
            userId: student.parent_uid || '',
          })
          setProfileForm({
            name: profile.displayName || student.name || '',
            phone: student.phone || '',
          })
        }
      }
    } catch (e) {}
  }

  const fetchStudents = async () => {
    const parentUid = await getParentUid()
    if (!parentUid) return
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('parent_uid', parentUid)
      .order('created_at')
    setStudents(data || [])
  }

  useEffect(() => {
    fetchUserInfo()
    fetchStudents()
  }, [])

  const handleSaveProfile = async () => {
    const errs: Record<string, string> = {}
    const nameErr = validateName(profileForm.name)
    if (nameErr) errs.name = nameErr
    const phoneErr = validatePhone(profileForm.phone)
    if (phoneErr) errs.phone = phoneErr
    setProfileErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    const { error } = await supabase.auth.updateUser({
      data: { parentName: profileForm.name, phone: profileForm.phone }
    })
    if (error) {
      alert('更新失敗：' + error.message)
    } else {
      setUserInfo(prev => ({ ...prev, name: profileForm.name, phone: profileForm.phone }))
      setEditingProfile(false)
    }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    const errs: Record<string, string> = {}
    const pwErr = validatePassword(passwordForm.newPassword)
    if (pwErr) errs.newPassword = pwErr
    const cfErr = validateConfirmPassword(passwordForm.newPassword, passwordForm.confirmPassword)
    if (cfErr) errs.confirmPassword = cfErr
    setPasswordErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword })
    if (error) {
      alert('密碼更新失敗：' + error.message)
    } else {
      alert('密碼已更新')
      setShowPasswordForm(false)
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      setPasswordErrors({})
    }
    setSaving(false)
  }

  const handleEditStudent = (student: any) => {
    const level = student.notes?.match(/程度: ([^；]+)/)?.[1] || ''
    const school = student.notes?.match(/學校: ([^；]+)/)?.[1] || ''
    setStudentForm({
      id: student.id,
      name: student.name || '',
      gender: student.gender || '',
      birthDate: student.birth_date || '',
      level,
      school,
    })
    setEditingStudentId(student.id)
  }

  const handleSaveStudent = async () => {
    if (!studentForm.id) return
    const errs: Record<string, string> = {}
    const nameErr = validateName(studentForm.name, '學員姓名')
    if (nameErr) errs.name = nameErr
    const bdErr = validateBirthDate(studentForm.birthDate, true)
    if (bdErr) errs.birthDate = bdErr
    setStudentFormErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    const notes = [
      studentForm.school ? '學校: ' + studentForm.school : '',
      studentForm.level ? '程度: ' + studentForm.level : '',
    ].filter(Boolean).join('；')

    const { error } = await supabase.from('students').update({
      name: studentForm.name,
      gender: studentForm.gender || null,
      birth_date: studentForm.birthDate || null,
      notes,
    }).eq('id', studentForm.id)

    if (error) {
      alert('更新失敗：' + error.message)
    } else {
      setEditingStudentId(null)
      await fetchStudents()
    }
    setSaving(false)
  }

  const handleAddStudent = async () => {
    const errs: Record<string, string> = {}
    const nameErr = validateName(newStudent.name, '學員姓名')
    if (nameErr) errs.name = nameErr
    const bdErr = validateBirthDate(newStudent.birthDate, true)
    if (bdErr) errs.birthDate = bdErr
    setNewStudentErrors(errs)
    if (Object.keys(errs).length > 0) return

    // 確認 parent_uid 有值
    const parentUid = userInfo.userId || await getParentUid()
    if (!parentUid) {
      alert('請先綁定帳號後再新增學員')
      return
    }

    setSaving(true)
    const age = calculateAge(newStudent.birthDate)
    const isAdult = age >= 16
    const prefix = isAdult ? 'AD' : 'ST'

    const { data: studentCode } = await supabase.rpc('generate_student_code', { p_prefix: prefix })

    const notes = [
      newStudent.school ? '學校: ' + newStudent.school : '',
      newStudent.level ? '程度: ' + newStudent.level : '',
    ].filter(Boolean).join('；')

    const { error } = await supabase.from('students').insert({
      name: newStudent.name,
      gender: newStudent.gender || null,
      birth_date: newStudent.birthDate,
      phone: userInfo.phone,
      email: userInfo.email,
      emergency_contact: userInfo.name,
      emergency_phone: userInfo.phone,
      parent_uid: parentUid,
      student_code: studentCode,
      age_type: isAdult ? 'adult' : 'child',
      category: isAdult ? 'adult' : 'child',
      notes,
    })

    if (error) {
      alert('新增失敗：' + error.message)
    } else {
      setShowAddStudent(false)
      setNewStudent({ name: '', gender: '', birthDate: '', level: '', school: '' })
      await fetchStudents()
    }
    setSaving(false)
  }

  const levels = ['初學', '有基礎', '進階', '高階', '校隊']

  return (
    <div className='max-w-2xl mx-auto space-y-6 pb-12'>
      {/* 帳號資料 */}
      <div className='bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-bold text-neutral-900'>帳號資料</h3>
          {!editingProfile ? (
            <button onClick={() => setEditingProfile(true)} className='text-sm text-primary font-medium flex items-center gap-1'><Edit2 size={14} /> 編輯</button>
          ) : (
            <button onClick={() => setEditingProfile(false)} className='text-sm text-neutral-500'><X size={14} /></button>
          )}
        </div>

        {editingProfile ? (
          <div className='space-y-3'>
            <FormField label='姓名'>
              <Input value={profileForm.name}
                className={profileErrors.name ? 'border-red-400 ring-1 ring-red-200' : ''}
                onChange={e => { setProfileForm({...profileForm, name: e.target.value}); if (profileErrors.name) { const err = validateName(e.target.value); setProfileErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); } }}
                onBlur={() => { const err = validateName(profileForm.name); setProfileErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); }}
              />
              {profileErrors.name && <p className='text-xs text-red-500 mt-1'>{profileErrors.name}</p>}
            </FormField>
            <FormField label='聯絡電話'>
              <Input value={profileForm.phone}
                className={profileErrors.phone ? 'border-red-400 ring-1 ring-red-200' : ''}
                onChange={e => { setProfileForm({...profileForm, phone: e.target.value}); if (profileErrors.phone) { const err = validatePhone(e.target.value); setProfileErrors(prev => { const n = {...prev}; if (err) n.phone = err; else delete n.phone; return n; }); } }}
                onBlur={() => { const err = validatePhone(profileForm.phone); setProfileErrors(prev => { const n = {...prev}; if (err) n.phone = err; else delete n.phone; return n; }); }}
              />
              {profileErrors.phone && <p className='text-xs text-red-500 mt-1'>{profileErrors.phone}</p>}
            </FormField>
            <div className='flex items-center gap-2 text-sm text-neutral-500'>
              <Mail size={14} /> {userInfo.email}
              <span className='text-xs text-neutral-400'>（Email 無法修改）</span>
            </div>
            <Button onClick={handleSaveProfile} variant='primary' loading={saving}>儲存</Button>
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='flex items-center gap-3'>
              <div className='w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl'>
                {userInfo.name?.charAt(0) || '?'}
              </div>
              <div>
                <p className='font-bold text-neutral-900 text-lg'>{userInfo.name || '未設定'}</p>
                <p className='text-sm text-neutral-500'>{userInfo.email}</p>
              </div>
            </div>
            <div className='flex items-center gap-2 text-sm text-neutral-600'>
              <Phone size={14} /> {userInfo.phone || '未設定'}
            </div>
          </div>
        )}
      </div>

      {/* 修改密碼 */}
      <div className='bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-bold text-neutral-900'>安全設定</h3>
          <button onClick={() => setShowPasswordForm(!showPasswordForm)} className='text-sm text-primary font-medium flex items-center gap-1'>
            <Lock size={14} /> {showPasswordForm ? '取消' : '修改密碼'}
          </button>
        </div>
        {showPasswordForm && (
          <div className='space-y-3'>
            <FormField label='新密碼（至少 6 位）'>
              <Input type='password' placeholder='請輸入新密碼' value={passwordForm.newPassword}
                className={passwordErrors.newPassword ? 'border-red-400 ring-1 ring-red-200' : ''}
                onChange={e => { setPasswordForm({...passwordForm, newPassword: e.target.value}); if (passwordErrors.newPassword) { const err = validatePassword(e.target.value); setPasswordErrors(prev => { const n = {...prev}; if (err) n.newPassword = err; else delete n.newPassword; return n; }); } }}
                onBlur={() => { const err = validatePassword(passwordForm.newPassword); setPasswordErrors(prev => { const n = {...prev}; if (err) n.newPassword = err; else delete n.newPassword; return n; }); }}
              />
              {passwordErrors.newPassword && <p className='text-xs text-red-500 mt-1'>{passwordErrors.newPassword}</p>}
            </FormField>
            <FormField label='確認新密碼'>
              <Input type='password' placeholder='再次輸入新密碼' value={passwordForm.confirmPassword}
                className={passwordErrors.confirmPassword ? 'border-red-400 ring-1 ring-red-200' : ''}
                onChange={e => { setPasswordForm({...passwordForm, confirmPassword: e.target.value}); if (passwordErrors.confirmPassword) { const err = validateConfirmPassword(passwordForm.newPassword, e.target.value); setPasswordErrors(prev => { const n = {...prev}; if (err) n.confirmPassword = err; else delete n.confirmPassword; return n; }); } }}
                onBlur={() => { const err = validateConfirmPassword(passwordForm.newPassword, passwordForm.confirmPassword); setPasswordErrors(prev => { const n = {...prev}; if (err) n.confirmPassword = err; else delete n.confirmPassword; return n; }); }}
              />
              {passwordErrors.confirmPassword && <p className='text-xs text-red-500 mt-1'>{passwordErrors.confirmPassword}</p>}
            </FormField>
            <Button onClick={handleChangePassword} variant='primary' loading={saving}>更新密碼</Button>
          </div>
        )}
      </div>

      {/* 學員列表 */}
      <div className='bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-bold text-neutral-900'>我的學員</h3>
          <button onClick={() => setShowAddStudent(!showAddStudent)} className='text-sm text-primary font-medium flex items-center gap-1'>
            <Plus size={14} /> 新增學員
          </button>
        </div>

        {/* 新增學員表單 */}
        {showAddStudent && (
          <div className='bg-blue-50 rounded-xl p-4 space-y-3'>
            <p className='text-sm font-bold text-blue-700'>新增學員</p>
            <FormField label='真實姓名'>
              <Input placeholder='學員姓名' value={newStudent.name}
                className={newStudentErrors.name ? 'border-red-400 ring-1 ring-red-200' : ''}
                onChange={e => { setNewStudent({...newStudent, name: e.target.value}); if (newStudentErrors.name) { const err = validateName(e.target.value, '學員姓名'); setNewStudentErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); } }}
                onBlur={() => { const err = validateName(newStudent.name, '學員姓名'); setNewStudentErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); }}
              />
              {newStudentErrors.name && <p className='text-xs text-red-500 mt-1'>{newStudentErrors.name}</p>}
            </FormField>
            <div className='flex gap-3'>
              <div className='flex-1'>
                <FormField label='出生日期'>
                  <Input type='date' value={newStudent.birthDate}
                    className={newStudentErrors.birthDate ? 'border-red-400 ring-1 ring-red-200' : ''}
                    onChange={e => { setNewStudent({...newStudent, birthDate: e.target.value}); if (newStudentErrors.birthDate) { const err = validateBirthDate(e.target.value, true); setNewStudentErrors(prev => { const n = {...prev}; if (err) n.birthDate = err; else delete n.birthDate; return n; }); } }}
                    onBlur={() => { const err = validateBirthDate(newStudent.birthDate, true); setNewStudentErrors(prev => { const n = {...prev}; if (err) n.birthDate = err; else delete n.birthDate; return n; }); }}
                  />
                  {newStudentErrors.birthDate && <p className='text-xs text-red-500 mt-1'>{newStudentErrors.birthDate}</p>}
                </FormField>
              </div>
              <div className='flex-1'>
                <FormField label='性別'>
                  <div className='flex gap-1'>
                    {['男', '女'].map(g => (
                      <button key={g} type='button' onClick={() => setNewStudent({...newStudent, gender: g})}
                        className={'flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ' + (newStudent.gender === g ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300')}>
                        {g}
                      </button>
                    ))}
                  </div>
                </FormField>
              </div>
            </div>
            {newStudent.birthDate && (
              <div className='text-xs text-neutral-500'>
                {calculateAge(newStudent.birthDate)} 歲 · {calculateAge(newStudent.birthDate) >= 16 ? '成人學員 (AD)' : '兒童學員 (ST)'}
              </div>
            )}
            <FormField label='程度'>
              <div className='flex flex-wrap gap-2'>
                {levels.map(l => (
                  <button key={l} type='button' onClick={() => setNewStudent({...newStudent, level: l})}
                    className={'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ' + (newStudent.level === l ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300')}>
                    {l}
                  </button>
                ))}
              </div>
            </FormField>
            {newStudent.birthDate && calculateAge(newStudent.birthDate) < 16 && (
              <FormField label='就讀學校（選填）'>
                <Input placeholder='例如：頭湖國小' value={newStudent.school} onChange={e => setNewStudent({...newStudent, school: e.target.value})} />
              </FormField>
            )}
            <div className='flex gap-2'>
              <Button onClick={handleAddStudent} variant='primary' loading={saving}>確認新增</Button>
              <Button onClick={() => { setShowAddStudent(false); setNewStudent({ name: '', gender: '', birthDate: '', level: '', school: '' }); setNewStudentErrors({}) }} variant='ghost'>取消</Button>
            </div>
          </div>
        )}

        {/* 學員卡片 */}
        {students.length === 0 ? (
          <div className='text-center py-8 text-neutral-400 text-sm'>尚無學員資料</div>
        ) : (
          <div className='space-y-3'>
            {students.map(student => {
              const age = student.birth_date ? calculateAge(student.birth_date) : null
              const isAdult = age !== null && age >= 16
              const level = student.notes?.match(/程度: ([^；]+)/)?.[1] || '未設定'
              const school = student.notes?.match(/學校: ([^；]+)/)?.[1] || ''
              const isExpanded = expandedStudentId === student.id
              const isEditing = editingStudentId === student.id

              return (
                <div key={student.id} className='border border-neutral-200 rounded-xl overflow-hidden'>
                  <div
                    onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                    className='p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50'
                  >
                    <div className='flex items-center gap-3'>
                      <div className={'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ' + (isAdult ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                        {student.name?.charAt(0)}
                      </div>
                      <div>
                        <div className='flex items-center gap-2'>
                          <p className='font-bold text-neutral-900'>{student.name}</p>
                          <span className={'text-xs px-2 py-0.5 rounded-full ' + (isAdult ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600')}>
                            {student.student_code || student.student_number || '未編號'}
                          </span>
                        </div>
                        <p className='text-xs text-neutral-500'>
                          {age !== null ? age + ' 歲' : ''} · {isAdult ? '成人' : '兒童'} · {level}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className='text-neutral-400' /> : <ChevronDown size={16} className='text-neutral-400' />}
                  </div>

                  {isExpanded && (
                    <div className='border-t border-neutral-100 p-4 bg-neutral-50'>
                      {isEditing ? (
                        <div className='space-y-3'>
                          <FormField label='姓名'>
                            <Input value={studentForm.name}
                              className={studentFormErrors.name ? 'border-red-400 ring-1 ring-red-200' : ''}
                              onChange={e => { setStudentForm({...studentForm, name: e.target.value}); if (studentFormErrors.name) { const err = validateName(e.target.value, '學員姓名'); setStudentFormErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); } }}
                              onBlur={() => { const err = validateName(studentForm.name, '學員姓名'); setStudentFormErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); }}
                            />
                            {studentFormErrors.name && <p className='text-xs text-red-500 mt-1'>{studentFormErrors.name}</p>}
                          </FormField>
                          <div className='flex gap-3'>
                            <div className='flex-1'>
                              <FormField label='出生日期'>
                                <Input type='date' value={studentForm.birthDate}
                                  className={studentFormErrors.birthDate ? 'border-red-400 ring-1 ring-red-200' : ''}
                                  onChange={e => { setStudentForm({...studentForm, birthDate: e.target.value}); if (studentFormErrors.birthDate) { const err = validateBirthDate(e.target.value, true); setStudentFormErrors(prev => { const n = {...prev}; if (err) n.birthDate = err; else delete n.birthDate; return n; }); } }}
                                  onBlur={() => { const err = validateBirthDate(studentForm.birthDate, true); setStudentFormErrors(prev => { const n = {...prev}; if (err) n.birthDate = err; else delete n.birthDate; return n; }); }}
                                />
                                {studentFormErrors.birthDate && <p className='text-xs text-red-500 mt-1'>{studentFormErrors.birthDate}</p>}
                              </FormField>
                            </div>
                            <div className='flex-1'>
                              <FormField label='性別'>
                                <div className='flex gap-1'>
                                  {['男', '女'].map(g => (
                                    <button key={g} type='button' onClick={() => setStudentForm({...studentForm, gender: g})}
                                      className={'flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ' + (studentForm.gender === g ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300')}>
                                      {g}
                                    </button>
                                  ))}
                                </div>
                              </FormField>
                            </div>
                          </div>
                          <FormField label='程度'>
                            <div className='flex flex-wrap gap-2'>
                              {levels.map(l => (
                                <button key={l} type='button' onClick={() => setStudentForm({...studentForm, level: l})}
                                  className={'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ' + (studentForm.level === l ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300')}>
                                  {l}
                                </button>
                              ))}
                            </div>
                          </FormField>
                          {studentForm.birthDate && calculateAge(studentForm.birthDate) < 16 && (
                            <FormField label='就讀學校'>
                              <Input value={studentForm.school} onChange={e => setStudentForm({...studentForm, school: e.target.value})} />
                            </FormField>
                          )}
                          <div className='flex gap-2'>
                            <Button onClick={handleSaveStudent} variant='primary' loading={saving}>儲存</Button>
                            <Button onClick={() => { setEditingStudentId(null); setStudentFormErrors({}) }} variant='ghost'>取消</Button>
                          </div>
                        </div>
                      ) : (
                        <div className='space-y-2'>
                          <div className='grid grid-cols-2 gap-3 text-sm'>
                            <div><span className='text-neutral-400'>學員編號：</span><span className='font-medium'>{student.student_code || student.student_number}</span></div>
                            <div><span className='text-neutral-400'>性別：</span><span className='font-medium'>{student.gender || '未設定'}</span></div>
                            <div><span className='text-neutral-400'>出生日期：</span><span className='font-medium'>{student.birth_date || '未設定'}</span></div>
                            <div><span className='text-neutral-400'>程度：</span><span className='font-medium'>{level}</span></div>
                            {school && <div><span className='text-neutral-400'>學校：</span><span className='font-medium'>{school}</span></div>}
                          </div>
                          <button onClick={() => handleEditStudent(student)} className='text-sm text-primary font-medium flex items-center gap-1 mt-2'>
                            <Edit2 size={14} /> 編輯資料
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
