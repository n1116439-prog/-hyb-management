import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronRight, User, Phone, Mail, Calendar, Info, Users, Clock, MapPin, AlertCircle, ArrowLeft, DollarSign } from 'lucide-react';
import { RegistrationData, Course, Participant } from '../types';
import { supabase } from '../lib/supabase';
import { Button, FormField, Input, Select, Badge } from './UI';

const PLANS = {
  children: [
    { id: 'trial', name: '試上課程', subName: '單堂課程', price: 600, originalPrice: 900, sessions: 1, desc: '此課程適用於新生試上課程' },
    { id: '8_sessions', name: '彈性選擇方案', subName: '8堂', price: 765, originalPrice: 900, sessions: 8, desc: '適合時間不固定報名，期限12週' },
    { id: '15_sessions', name: '穩步學習方案', subName: '15堂', price: 720, originalPrice: 900, sessions: 15, desc: '適用舊生，期限20週' },
    { id: '12_sessions', name: '新生首選方案', subName: '12堂', price: 650, originalPrice: 900, sessions: 12, desc: '適合新生，期限16週' },
    { id: '25_sessions', name: '高效進階方案', subName: '25堂', price: 675, originalPrice: 900, sessions: 25, desc: '適用舊生，期限32週' },
    { id: '50_sessions', name: '完整培訓方案', subName: '50堂', price: 630, originalPrice: 900, sessions: 50, desc: '適用舊生，期限64週' },
  ],
  adult: [
    { id: 'trial', name: '試上課程', subName: '單堂課程', price: 600, originalPrice: 1000, sessions: 1, desc: '此課程適用於新生試上課程' },
    { id: '8_sessions', name: '彈性選擇方案', subName: '8堂', price: 850, originalPrice: 1000, sessions: 8, desc: '適合時間不固定報名，期限12週' },
    { id: '15_sessions', name: '穩步學習方案', subName: '15堂', price: 800, originalPrice: 1000, sessions: 15, desc: '適用舊生，期限20週' },
    { id: '12_sessions', name: '新生首選方案', subName: '12堂', price: 650, originalPrice: 1000, sessions: 12, desc: '適合新生，期限16週' },
    { id: '25_sessions', name: '高效進階方案', subName: '25堂', price: 750, originalPrice: 1000, sessions: 25, desc: '適用舊生，期限32週' },
    { id: '50_sessions', name: '完整培訓方案', subName: '50堂', price: 700, originalPrice: 1000, sessions: 50, desc: '適用舊生，期限64週' },
  ]
};

export const RegisterPage: React.FC<{ initialCourseId?: string; onComplete: () => void }> = ({ initialCourseId, onComplete }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationData>({
    phone: '',
    email: '',
    emergencyContact: '',
    emergencyPhone: '',
    hasInjury: false,
    injuryDetail: '',
    source: '朋友介紹',
    type: 'trial',
    category: 'children',
    planId: 'trial',
    count: 1,
    participants: [{ name: '', gender: '男', birthday: '' }],
    location: '',
    courseId: initialCourseId || '',
    trialDate: '',
    note: ''
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*, coaches(name), venues(name, address)')
        .order('name');

      if (error) {
        console.error('Error fetching courses:', error);
        setLoadingCourses(false);
        return;
      }

      if (data) {
        const mapped: Course[] = data.map((row: any) => {
          const category: 'children' | 'adult' = row.category === '兒童班' ? 'children' : 'adult';
          const startTime = row.start_time?.slice(0, 5) ?? '';
          const endTime = row.end_time?.slice(0, 5) ?? '';
          const time = startTime && endTime ? `${startTime} – ${endTime}` : '';
          const location = row.venues?.name ?? '';
          const coaches: string[] = Array.isArray(row.coaches)
            ? row.coaches.map((c: any) => c.name)
            : row.coaches?.name ? [row.coaches.name] : [];
          const thumbnail = `https://picsum.photos/seed/${row.id}/200/200`;

          return {
            id: String(row.id),
            name: row.name,
            category,
            schedule: row.day_of_week ?? '',
            time,
            location,
            coaches,
            thumbnail,
            currentEnrollment: row.current_students ?? 0,
            maxEnrollment: row.max_students ?? 0,
            price: row.price ?? 0,
            description: row.description ?? '',
            tags: [],
          };
        });
        setCourses(mapped);
      }
      setLoadingCourses(false);
    };

    fetchCourses();
  }, []);

  // 當課程資料載入完成且有 initialCourseId 時，自動填入課程相關欄位
  useEffect(() => {
    if (initialCourseId && courses.length > 0) {
      const course = courses.find(c => c.id === initialCourseId);
      if (course) {
        setFormData(prev => ({
          ...prev,
          category: course.category,
          location: course.location,
          courseId: initialCourseId,
        }));
      }
    }
  }, [initialCourseId, courses]);

  const updateParticipant = (index: number, field: keyof Participant, value: string) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = { ...newParticipants[index], [field]: value };
    setFormData({ ...formData, participants: newParticipants });
  };

  const handleCountChange = (newCount: number) => {
    let newParticipants = [...formData.participants];
    if (newCount > formData.count) {
      for (let i = formData.count; i < newCount; i++) {
        newParticipants.push({ name: '', gender: '男', birthday: '' });
      }
    } else {
      newParticipants = newParticipants.slice(0, newCount);
    }
    setFormData({ ...formData, count: newCount, participants: newParticipants });
  };

  const locations = Array.from(new Set(courses.filter(c => c.category === formData.category).map(c => c.location)));

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Set<string>>(new Set());

  const steps = [
    { id: 1, label: '填寫資料' },
    { id: 2, label: '選擇班級' },
    { id: 3, label: '確認送出' }
  ];

  const handleNext = () => {
    const newErrors = new Set<string>();

    if (step === 1) {
      if (!formData.phone) newErrors.add('phone');
      if (!formData.emergencyContact) newErrors.add('emergencyContact');
      if (!formData.emergencyPhone) newErrors.add('emergencyPhone');
      
      formData.participants.forEach((p, i) => {
        if (!p.name) newErrors.add(`participant-name-${i}`);
        if (!p.birthday) newErrors.add(`participant-birthday-${i}`);
      });

      if (newErrors.size > 0) {
        setErrors(newErrors);
        alert('請填寫完整資料');
        return;
      }
    }
    if (step === 2) {
      if (!formData.location) newErrors.add('location');
      if (!formData.courseId) newErrors.add('courseId');
      if (!formData.planId) newErrors.add('planId');
      if (formData.type === 'trial' && !formData.trialDate) newErrors.add('trialDate');

      if (newErrors.size > 0) {
        setErrors(newErrors);
        alert('請填寫完整資料');
        return;
      }
    }
    setErrors(new Set());
    setStep(s => Math.min(s + 1, 3));
  };
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = () => {
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center gap-6"
      >
        <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
          >
            <Check size={40} className="text-accent" />
          </motion.div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-neutral-900">報名申請已送出！</h2>
          <p className="text-sm text-neutral-600">我們將於 24 小時內簡訊確認您的試上</p>
        </div>
        
        <div className="w-full bg-white rounded-card p-6 shadow-card border border-neutral-100 text-left space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
              <Clock size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-neutral-600">試上時間</p>
              <p className="text-sm font-bold text-neutral-900">2024/10/17（週四）19:00</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
              <MapPin size={20} className="text-secondary" />
            </div>
            <div>
              <p className="text-xs text-neutral-600">班級</p>
              <p className="text-sm font-bold text-neutral-900">{courses.find(c => c.id === formData.courseId)?.name}</p>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3 mt-4">
          <Button onClick={onComplete}>返回首頁</Button>
          <Button variant="outline" onClick={onComplete}>查看我的堂數</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto pt-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between px-4 mb-4">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > s.id ? 'bg-primary text-white' : 
                step === s.id ? 'bg-primary text-white shadow-active' : 
                'bg-neutral-100 text-neutral-400'
              }`}>
                {step > s.id ? <Check size={16} /> : s.id}
              </div>
              <span className={`text-[10px] font-medium ${step >= s.id ? 'text-primary' : 'text-neutral-400'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 -mt-6 transition-all ${step > s.id ? 'bg-primary' : 'bg-neutral-100'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-6">
              <FormField label="報名人數">
                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Users size={20} className="text-primary" />
                    <span className="text-sm font-medium text-neutral-600">最多一次 4 人</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => handleCountChange(Math.max(1, formData.count - 1))}
                      className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 active:scale-90 transition-all"
                    >
                      −
                    </button>
                    <span className="text-lg font-bold w-4 text-center">{formData.count}</span>
                    <button 
                      onClick={() => handleCountChange(Math.min(4, formData.count + 1))}
                      className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 active:scale-90 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
              </FormField>

              {formData.participants.map((participant, index) => (
                <div key={index} className="p-6 bg-white rounded-card border border-neutral-100 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <h3 className="text-sm font-bold text-neutral-900">學員 {index + 1} 資料</h3>
                  </div>
                  
                  <FormField label="學員姓名">
                    <Input 
                      placeholder="請輸入真實姓名" 
                      value={participant.name} 
                      error={errors.has(`participant-name-${index}`)}
                      onChange={e => {
                        updateParticipant(index, 'name', e.target.value);
                        if (errors.has(`participant-name-${index}`)) {
                          const next = new Set(errors);
                          next.delete(`participant-name-${index}`);
                          setErrors(next);
                        }
                      }} 
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="性別">
                      <div className="flex gap-2">
                        {['男', '女', '不公開'].map(g => (
                          <button
                            key={g}
                            onClick={() => updateParticipant(index, 'gender', g)}
                            className={`flex-1 h-10 rounded-input border transition-all text-xs font-medium ${
                              participant.gender === g 
                                ? 'border-primary bg-primary-light text-primary' 
                                : 'border-neutral-100 bg-white text-neutral-600'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </FormField>

                    <FormField label="出生年月日">
                      <Input 
                        type="date" 
                        value={participant.birthday} 
                        error={errors.has(`participant-birthday-${index}`)}
                        onChange={e => {
                          updateParticipant(index, 'birthday', e.target.value);
                          if (errors.has(`participant-birthday-${index}`)) {
                            const next = new Set(errors);
                            next.delete(`participant-birthday-${index}`);
                            setErrors(next);
                          }
                        }} 
                      />
                    </FormField>
                  </div>
                </div>
              ))}

              <div className="h-px bg-neutral-100 my-6" />
              <h3 className="text-sm font-bold text-neutral-900 px-1">聯絡資訊</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="聯絡電話">
                  <Input 
                    type="tel" 
                    placeholder="09xx-xxx-xxx" 
                    value={formData.phone} 
                    error={errors.has('phone')}
                    onChange={e => {
                      setFormData({...formData, phone: e.target.value});
                      if (errors.has('phone')) {
                        const next = new Set(errors);
                        next.delete('phone');
                        setErrors(next);
                      }
                    }} 
                  />
                </FormField>
                <FormField label="Email">
                  <Input type="email" placeholder="example@mail.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="緊急聯絡人姓名">
                  <Input 
                    placeholder="姓名" 
                    value={formData.emergencyContact} 
                    error={errors.has('emergencyContact')}
                    onChange={e => {
                      setFormData({...formData, emergencyContact: e.target.value});
                      if (errors.has('emergencyContact')) {
                        const next = new Set(errors);
                        next.delete('emergencyContact');
                        setErrors(next);
                      }
                    }} 
                  />
                </FormField>
                <FormField label="緊急聯絡人電話">
                  <Input 
                    type="tel" 
                    placeholder="電話" 
                    value={formData.emergencyPhone} 
                    error={errors.has('emergencyPhone')}
                    onChange={e => {
                      setFormData({...formData, emergencyPhone: e.target.value});
                      if (errors.has('emergencyPhone')) {
                        const next = new Set(errors);
                        next.delete('emergencyPhone');
                        setErrors(next);
                      }
                    }} 
                  />
                </FormField>
              </div>

              <FormField label="有無運動傷病史">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-4 bg-white rounded-input border border-neutral-100">
                    <span className="text-sm font-medium text-neutral-600">是否有傷病史？</span>
                    <button 
                      onClick={() => setFormData({...formData, hasInjury: !formData.hasInjury})}
                      className={`w-12 h-6 rounded-full relative transition-all ${formData.hasInjury ? 'bg-primary' : 'bg-neutral-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.hasInjury ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  {formData.hasInjury && (
                    <motion.textarea
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      placeholder="請說明傷病情況，以便教練留意"
                      className="w-full p-4 rounded-input border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm min-h-[100px]"
                      value={formData.injuryDetail}
                      onChange={e => setFormData({...formData, injuryDetail: e.target.value})}
                    />
                  )}
                </div>
              </FormField>

              <FormField label="如何得知課程">
                <Select value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})}>
                  <option>朋友介紹</option>
                  <option>IG</option>
                  <option>FB</option>
                  <option>其他</option>
                </Select>
              </FormField>
            </div>
            <Button onClick={handleNext} icon={ChevronRight}>下一步：選擇班級</Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="space-y-6">
              <FormField label="課程類別">
                <div className="flex gap-3">
                  {[
                    { id: 'children', label: '兒童班' },
                    { id: 'adult', label: '成人班' }
                  ].map(c => (
                    <button
                      key={c.id}
                      onClick={() => setFormData({
                        ...formData, 
                        category: c.id as any,
                        location: '',
                        courseId: ''
                      })}
                      className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${
                        formData.category === c.id 
                          ? 'border-primary bg-primary-light' 
                          : 'border-neutral-100 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.category === c.id ? 'border-primary' : 'border-neutral-300'
                        }`}>
                          {formData.category === c.id && <div className="w-2 h-2 bg-primary rounded-full" />}
                        </div>
                        <span className={`text-sm font-bold ${formData.category === c.id ? 'text-primary' : 'text-neutral-900'}`}>{c.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="選擇報名方案">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PLANS[formData.category].map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => setFormData({
                        ...formData, 
                        planId: plan.id,
                        type: plan.id === 'trial' ? 'trial' : 'official'
                      })}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all flex flex-col gap-2 ${
                        formData.planId === plan.id 
                          ? 'border-primary bg-primary-light shadow-active' 
                          : 'border-neutral-100 bg-white hover:border-neutral-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className={`text-[10px] font-bold ${formData.planId === plan.id ? 'text-primary' : 'text-neutral-500'}`}>
                          {plan.name}
                        </p>
                        <h4 className="text-lg font-bold text-neutral-900">{plan.subName}</h4>
                      </div>
                      
                      <div className="mt-auto pt-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs text-neutral-400 line-through">原價{plan.originalPrice}</span>
                          <span className="text-xl font-black text-accent">{plan.price}</span>
                          <span className="text-[10px] text-accent font-bold">/堂</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-1 leading-tight">{plan.desc}</p>
                      </div>

                      {formData.planId === plan.id && (
                        <div className="absolute top-2 right-2">
                          <Check size={16} className="text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-400 mt-3 text-center">
                  * 3 位以上團報優惠每人每堂課程可折抵 {formData.category === 'children' ? '20' : '30'} / 堂
                </p>
              </FormField>

              <FormField label="場地選擇">
                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 p-1 rounded-xl transition-all ${errors.has('location') ? 'ring-2 ring-danger/20 bg-danger/5' : ''}`}>
                  {locations.map(loc => (
                    <button
                      key={loc}
                      onClick={() => {
                        setFormData({
                          ...formData, 
                          location: loc,
                          courseId: '' // Reset course when location changes
                        });
                        if (errors.has('location')) {
                          const next = new Set(errors);
                          next.delete('location');
                          setErrors(next);
                        }
                      }}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${
                        formData.location === loc 
                          ? 'border-primary bg-primary-light text-primary font-bold' 
                          : 'border-neutral-100 bg-white text-neutral-600 hover:border-neutral-200'
                      } ${errors.has('location') && formData.location !== loc ? 'border-danger/30' : ''}`}
                    >
                      <MapPin size={18} className={`mx-auto mb-2 ${formData.location === loc ? 'text-primary' : 'text-neutral-400'}`} />
                      <span className="text-sm">{loc}</span>
                    </button>
                  ))}
                </div>
              </FormField>

              {formData.location && (
                <FormField label="班級選擇">
                  <div className={`flex flex-col gap-3 p-1 rounded-xl transition-all ${errors.has('courseId') ? 'ring-2 ring-danger/20 bg-danger/5' : ''}`}>
                    {courses.filter(c => c.location === formData.location && c.category === formData.category).map(course => {
                      const isFull = course.currentEnrollment >= course.maxEnrollment;
                      const isSelected = formData.courseId === course.id;
                      return (
                        <button
                          key={course.id}
                          disabled={isFull}
                          onClick={() => {
                            setFormData({...formData, courseId: course.id});
                            if (errors.has('courseId')) {
                              const next = new Set(errors);
                              next.delete('courseId');
                              setErrors(next);
                            }
                          }}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected ? 'border-primary bg-primary-light' : 
                            isFull ? 'border-neutral-50 bg-neutral-50 opacity-60 grayscale' :
                            'border-neutral-100 bg-white'
                          } ${errors.has('courseId') && !isSelected ? 'border-danger/30' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-primary' : 'border-neutral-300'
                              }`}>
                                {isSelected && <div className="w-2 h-2 bg-primary rounded-full" />}
                              </div>
                              <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-neutral-900'}`}>{course.name}</span>
                            </div>
                            {isFull && <Badge variant="neutral">已額滿</Badge>}
                          </div>
                          <p className="text-xs text-neutral-600 ml-6">{course.schedule} {course.time}</p>
                          <p className="text-xs text-neutral-600 ml-6 mt-1">剩餘名額：{course.maxEnrollment - course.currentEnrollment} / {course.maxEnrollment} 人</p>
                        </button>
                      );
                    })}
                  </div>
                </FormField>
              )}

              <FormField label="選擇試上日期">
                <div className={`bg-white rounded-xl border transition-all p-4 shadow-sm ${errors.has('trialDate') ? 'border-danger ring-2 ring-danger/20 bg-danger/5' : 'border-neutral-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <button className="p-1 hover:bg-neutral-100 rounded-full"><ArrowLeft size={16} /></button>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-primary" />
                      <span className="text-sm font-bold">2024 年 10 月</span>
                    </div>
                    <button className="p-1 hover:bg-neutral-100 rounded-full rotate-180"><ArrowLeft size={16} /></button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                      <span key={d} className="text-[10px] font-bold text-neutral-400">{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                      const isSelected = formData.trialDate === `2024-10-${day}`;
                      const isAvailable = [1, 3, 5, 17, 18, 19].includes(day); // Mock available dates
                      return (
                        <button
                          key={day}
                          disabled={!isAvailable}
                          onClick={() => {
                            setFormData({...formData, trialDate: `2024-10-${day}`});
                            if (errors.has('trialDate')) {
                              const next = new Set(errors);
                              next.delete('trialDate');
                              setErrors(next);
                            }
                          }}
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs transition-all relative ${
                            isSelected ? 'bg-primary text-white font-bold' : 
                            isAvailable ? 'text-neutral-900 hover:bg-primary-light hover:text-primary' : 
                            'text-neutral-300'
                          }`}
                        >
                          {day}
                          {day === 17 && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </FormField>

              <FormField label="備註（選填）">
                <textarea 
                  placeholder="例：有膝蓋舊傷，希望教練特別留意"
                  className="w-full p-4 rounded-input border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm min-h-[100px]"
                  value={formData.note}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                />
              </FormField>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={handleNext} icon={ChevronRight}>下一步：確認報名資料</Button>
              <Button variant="ghost" onClick={handleBack}>上一步</Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-white rounded-card p-6 shadow-card border border-neutral-100 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <User size={18} className="text-primary" />
                  報名學員 ({formData.count} 位)
                </div>
                <div className="space-y-4">
                  {formData.participants.map((p, i) => (
                    <div key={i} className="p-3 bg-neutral-50 rounded-lg grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                      <div className="col-span-2 flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                        <span className="font-bold">{p.name}</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500">生日</p>
                        <p className="font-medium">{p.birthday}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500">性別</p>
                        <p className="font-medium">{p.gender}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm pt-2">
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-600">聯絡電話</p>
                    <p className="font-medium">{formData.phone}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-600">Email</p>
                    <p className="font-medium">{formData.email || '未填寫'}</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <Check size={18} className="text-primary" />
                  課程資訊
                </div>
                <div className="space-y-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-600">場地</p>
                    <p className="font-medium">{formData.location}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-600">班級</p>
                    <p className="font-medium">{courses.find(c => c.id === formData.courseId)?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-600">時間</p>
                    <p className="font-medium">
                      {courses.find(c => c.id === formData.courseId)?.schedule} {courses.find(c => c.id === formData.courseId)?.time}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-1 flex-1">
                      <p className="text-xs text-neutral-600">類別</p>
                      <p className="font-medium">{formData.category === 'children' ? '兒童班' : '成人班'}</p>
                    </div>
                    <div className="space-y-1 flex-1">
                      <p className="text-xs text-neutral-600">方案</p>
                      <p className="font-medium">
                        {PLANS[formData.category].find(p => p.id === formData.planId)?.name} ({PLANS[formData.category].find(p => p.id === formData.planId)?.subName})
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-1 flex-1">
                      <p className="text-xs text-neutral-600">類型</p>
                      <p className="font-medium">{formData.type === 'trial' ? '體驗試上' : '正式報名'}</p>
                    </div>
                    <div className="space-y-1 flex-1">
                      <p className="text-xs text-neutral-600">試上日期</p>
                      <p className="font-medium">{formData.trialDate || '尚未選擇'}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-600">報名人數</p>
                    <p className="font-medium">{formData.count} 人</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <DollarSign size={18} className="text-primary" />
                  費用預估
                </div>
                {(() => {
                  const plan = PLANS[formData.category].find(p => p.id === formData.planId);
                  if (!plan) return null;
                  
                  const basePricePerSession = plan.price;
                  const totalSessions = plan.sessions;
                  const participantCount = formData.count;
                  
                  // Discount logic: 3+ people get discount per session per person
                  const discountPerSession = participantCount >= 3 
                    ? (formData.category === 'children' ? 20 : 30) 
                    : 0;
                  
                  const finalPricePerSession = basePricePerSession - discountPerSession;
                  const totalCost = finalPricePerSession * totalSessions * participantCount;
                  const originalTotal = basePricePerSession * totalSessions * participantCount;
                  const totalDiscount = discountPerSession * totalSessions * participantCount;

                  return (
                    <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-600">方案原價 ({plan.subName} × {participantCount}人)</span>
                        <span className="font-medium">NT$ {originalTotal.toLocaleString()}</span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-sm text-danger">
                          <span className="flex items-center gap-1">
                            <Users size={14} /> 團報優惠 (每人每堂 -{discountPerSession})
                          </span>
                          <span className="font-medium">- NT$ {totalDiscount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="h-px bg-neutral-200" />
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-neutral-900">預計總費用</span>
                        <div className="text-right">
                          <span className="text-2xl font-black text-primary">NT$ {totalCost.toLocaleString()}</span>
                          <p className="text-[10px] text-neutral-500">共 {totalSessions * participantCount} 堂課</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-1">
                  <input type="checkbox" className="hidden" />
                  <div className="w-5 h-5 rounded border-2 border-neutral-300 flex items-center justify-center group-hover:border-primary transition-all">
                    <Check size={14} className="text-white bg-primary rounded-sm opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
                <span className="text-xs text-neutral-600 leading-relaxed">
                  我已閱讀並同意《報名條款》與《隱私權政策》，並確認以上填寫資料皆為真實無誤。
                </span>
              </label>

              <div className="flex flex-col gap-3">
                <Button onClick={handleSubmit}>確認送出報名</Button>
                <Button variant="ghost" onClick={handleBack}>上一步</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
