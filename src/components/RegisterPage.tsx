import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
import { Check, ChevronRight, User, Calendar, Clock, MapPin, DollarSign, CreditCard } from 'lucide-react';
import { Course } from '../types';
import { supabase } from '../lib/supabase';
import { Button, FormField, Badge } from './UI';

export const RegisterPage: React.FC<{ courses: Course[]; initialCourseId?: string; onComplete: () => void; onRefreshCourses?: () => void; userRole: 'user' | 'admin' | 'student'; userCategory?: 'child' | 'adult' | '' }> = ({ courses, initialCourseId, onComplete, onRefreshCourses, userRole, userCategory }) => {
  const [step, setStep] = useState(1);
  const [myStudents, setMyStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  // 優惠碼
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<any>(null);
  const [promoError, setPromoError] = useState('');

  const [formData, setFormData] = useState({
    category: initialCourseId ? (courses.find(c => c.id === initialCourseId)?.category || 'children') : 'children' as 'children' | 'adult',
    planId: '',
    type: 'trial' as 'trial' | 'official',
    location: initialCourseId ? (courses.find(c => c.id === initialCourseId)?.location || '') : '',
    courseId: initialCourseId || '',
    trialDate: '',
    note: '',
  });

  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [agreed, setAgreed] = useState(false);
  const [trialDateSlots, setTrialDateSlots] = useState<{date: string, weekday: string, enrolled: number, maxStudents: number, available: boolean}[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [paymentInfo, setPaymentInfo] = useState({
    bank_name: '中國信託',
    bank_code: '822',
    account_number: '1234-5678-9012-3456',
    account_name: '恆躍資訊有限公司',
    line_url: 'https://lin.ee/placeholder',
    notes: '匯款完成後，請至官方 Line 回覆匯款資訊（匯款帳號末五碼），我們將於確認後開通您的堂數。',
  })

  // 讀取匯款資料
  useEffect(() => {
    const fetchPaymentInfo = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'payment_info')
          .single()
        if (data?.value) setPaymentInfo(data.value)
      } catch (e) {
        console.log('system_settings 表不存在，使用預設值')
      }
    }
    fetchPaymentInfo()
  }, [])

  // 從 Supabase 讀取方案
  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('course_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (data) setPlans(data)
    }
    fetchPlans()
  }, [])

  // 讀取當前登入帳號底下的學員
  useEffect(() => {
    const fetchMyStudents = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 用 parent_uid 查匹配的學員
      const { data } = await supabase
        .from('students')
        .select('id, name, student_number, student_code, category, birth_date, school, age_type, parent_uid, email, notes')
        .eq('parent_uid', user.id)

      // 如果 parent_uid 沒匹配到，嘗試用 email 匹配
      if (!data || data.length === 0) {
        const { data: emailMatch } = await supabase
          .from('students')
          .select('id, name, student_number, student_code, category, birth_date, school, age_type, parent_uid, email, notes')
          .eq('email', user.email)

        if (emailMatch && emailMatch.length > 0) {
          setMyStudents(emailMatch)
        }
      } else {
        setMyStudents(data)
      }
    }
    fetchMyStudents()
  }, []);

  const fetchTrialSlots = async (courseId: string) => {
    setLoadingSlots(true)
    setTrialDateSlots([])

    const { data: course } = await supabase
      .from('courses')
      .select('day_of_week, max_students')
      .eq('id', courseId)
      .single()

    if (!course) { setLoadingSlots(false); return }

    const weekdayMap: Record<string, number> = {
      '週日': 0, '週一': 1, '週二': 2, '週三': 3,
      '週四': 4, '週五': 5, '週六': 6
    }
    const weekdayNames = ['日', '一', '二', '三', '四', '五', '六']
    const targetDay = weekdayMap[course.day_of_week]
    if (targetDay === undefined) { setLoadingSlots(false); return }

    const { data: holidays } = await supabase
      .from('course_holidays')
      .select('date')
      .or('course_id.eq.' + courseId + ',course_id.is.null')
    const holidaySet = new Set((holidays || []).map((h: any) => h.date))

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const current = new Date(today)
    while (current.getDay() !== targetDay) {
      current.setDate(current.getDate() + 1)
    }

    const candidateDates: string[] = []
    const maxWeeks = 8
    for (let i = 0; i < maxWeeks; i++) {
      const dateStr = formatLocalDate(current)
      if (!holidaySet.has(dateStr)) {
        candidateDates.push(dateStr)
      }
      current.setDate(current.getDate() + 7)
    }

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('date')
      .eq('course_id', courseId)
      .in('date', candidateDates)
      .in('status', ['已劃位', '出席', '遲到'])

    const { data: trialData } = await supabase
      .from('trial_bookings')
      .select('trial_date')
      .eq('course_id', courseId)
      .in('trial_date', candidateDates)
      .in('status', ['待確認', '已確認'])

    const attendanceCountMap: Record<string, number> = {}
    for (const a of (attendanceData || [])) {
      attendanceCountMap[a.date] = (attendanceCountMap[a.date] || 0) + 1
    }
    for (const t of (trialData || [])) {
      attendanceCountMap[t.trial_date] = (attendanceCountMap[t.trial_date] || 0) + 1
    }

    const maxStudents = course.max_students || 24
    const slots = []
    let availableCount = 0

    for (const dateStr of candidateDates) {
      const enrolled = attendanceCountMap[dateStr] || 0
      const available = enrolled < maxStudents
      if (available) availableCount++

      const d = new Date(dateStr + 'T00:00:00')
      slots.push({
        date: dateStr,
        weekday: '週' + weekdayNames[d.getDay()],
        enrolled,
        maxStudents,
        available,
      })

      if (availableCount >= 4) break
    }

    setTrialDateSlots(slots)
    setLoadingSlots(false)
  }

  useEffect(() => {
    if (formData.courseId && formData.type === 'trial') {
      fetchTrialSlots(formData.courseId)
    }
  }, [formData.courseId])

  if (userRole === 'user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
          <User size={40} className="text-neutral-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">請先登入會員</h2>
        <p className="text-neutral-500 mb-8 text-center">登入後即可開始報名課程。</p>
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

  const selectedStudents = myStudents.filter(s => selectedStudentIds.includes(s.id));
  const hasAdult = selectedStudents.some(s => s.category === 'adult');
  const hasChildren = selectedStudents.some(s => s.category !== 'adult');
  const isMixed = hasAdult && hasChildren;
  const autoCategory: 'children' | 'adult' = hasAdult ? 'adult' : 'children';

  const steps = [
    { id: 1, label: '選擇學員' },
    { id: 2, label: '選擇班級' },
    { id: 3, label: '確認送出' }
  ];

  const handleNext = () => {
    const newErrors = new Set<string>();

    if (step === 1) {
      if (selectedStudentIds.length === 0) {
        alert('請至少選擇一位學員');
        return;
      }
    }
    if (step === 2) {
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

  const selectedPlan = plans.find(p => p.id === formData.planId);
  const selectedCourse = courses.find(c => c.id === formData.courseId);
  const participantCount = selectedStudentIds.length;

  // 費用計算（含優惠碼）
  let totalPrice = selectedPlan ? selectedPlan.price_per_session * selectedPlan.sessions * participantCount : 0;
  let discountAmount = 0;
  let bonusSessions = 0;

  if (promoResult) {
    if (promoResult.type === 'percentage') {
      discountAmount = Math.round(totalPrice * promoResult.value / 100);
    } else if (promoResult.type === 'fixed') {
      discountAmount = promoResult.value;
    } else if (promoResult.type === 'free_sessions') {
      bonusSessions = promoResult.value;
    }
  }

  const finalPrice = Math.max(0, totalPrice - discountAmount);

  // 驗證優惠碼
  const validatePromoCode = async () => {
    if (!promoCode.trim()) return
    setPromoError('')
    setPromoResult(null)

    const { data: promo } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', promoCode.trim().toUpperCase())
      .eq('is_active', true)
      .single()

    if (!promo) {
      setPromoError('無效的優惠碼')
      return
    }

    // 檢查日期
    const today = formatLocalDate(new Date())
    if (promo.start_date && today < promo.start_date) {
      setPromoError('此優惠碼尚未開始')
      return
    }
    if (promo.end_date && today > promo.end_date) {
      setPromoError('此優惠碼已過期')
      return
    }

    // 檢查使用次數
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      setPromoError('此優惠碼已達使用上限')
      return
    }

    // 檢查指定學員
    if (promo.target_type === 'specific_students' && promo.target_student_ids?.length > 0) {
      const hasMatch = selectedStudentIds.some(id => promo.target_student_ids.includes(id))
      if (!hasMatch) {
        setPromoError('此優惠碼不適用於所選學員')
        return
      }
    }

    // 檢查最低堂數
    if (promo.min_sessions && selectedPlan && selectedPlan.sessions < promo.min_sessions) {
      setPromoError(`此優惠碼需購買 ${promo.min_sessions} 堂以上`)
      return
    }

    setPromoResult(promo)
  }

  const handleSubmit = async () => {
    try {
      if (formData.type === 'trial') {
        // 防重複：查詢是否已有進行中的試上申請
        for (const studentId of selectedStudentIds) {
          const { data: existingTrial } = await supabase
            .from('trial_bookings')
            .select('id')
            .eq('student_id', studentId)
            .in('status', ['待確認', '已確認'])
            .maybeSingle()

          if (existingTrial) {
            alert('此學員已有進行中的試上申請，每位學員僅能試上一次。如需更改時間，請聯絡管理員。')
            return
          }

          // 寫入 trial_bookings
          const { error } = await supabase.from('trial_bookings').insert({
            student_id: studentId,
            course_id: formData.courseId,
            trial_date: formData.trialDate,
            status: '待確認',
            notes: formData.note || '',
          })

          if (error) {
            alert('試上申請失敗：' + error.message)
            return
          }
        }

        // 寫入付款紀錄（試上費用）
        await supabase.from('payments').insert({
          student_id: selectedStudentIds[0],
          amount: finalPrice,
          payment_method: '轉帳',
          description: `試上課程 - ${selectedCourse?.name || ''}`,
        })

        // 優惠碼處理
        if (promoResult) {
          await supabase.from('promo_codes').update({
            current_uses: promoResult.current_uses + 1
          }).eq('id', promoResult.id)
          await supabase.from('promo_code_usage').insert({
            promo_code_id: promoResult.id,
            student_id: selectedStudentIds[0],
            discount_amount: discountAmount,
            original_amount: totalPrice,
            final_amount: finalPrice,
          })
        }

        onRefreshCourses?.()
        setShowCheckout(true)
        return  // 不繼續執行正式報名流程
      }

      // 為每位選擇的學員建立報名紀錄
      for (const studentId of selectedStudentIds) {
        const { error: enrollError } = await supabase
          .from('enrollments')
          .insert({
            student_id: studentId,
            course_id: formData.courseId,
            status: '已報名',
            notes: formData.note || '',
          });

        if (enrollError) {
          console.error('報名失敗:', enrollError);
          if (enrollError.code === '23505') {
            alert('此學員已報名過此課程');
          } else {
            alert('報名失敗：' + enrollError.message);
          }
          return;
        }
      }

      // 為每位學員寫入堂數（使用 course_plans 資料）


      const selectedPlanForCredits = plans.find(p => p.id === formData.planId)
      const planSessions = selectedPlanForCredits?.sessions || 1
      const planWeeks = selectedPlanForCredits?.weeks_limit || 12
      const planMaxLeave = selectedPlanForCredits?.max_leave || 0
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + planWeeks * 7)



      if (!selectedPlanForCredits) {
        console.warn('找不到 selectedPlan！formData.planId:', formData.planId, '類型:', typeof formData.planId)
        console.warn('所有 plan ids:', plans.map(p => ({ id: p.id, name: p.name, idType: typeof p.id })))
      }

      for (const studentId of selectedStudentIds) {


        const { data: existingCredit } = await supabase
          .from('credits')
          .select('id, total_credits, remaining_credits')
          .eq('student_id', studentId)
          .eq('status', 'active')
          .maybeSingle()



        const creditSessions = planSessions + bonusSessions;

        if (existingCredit) {
          const { error: creditError } = await supabase.from('credits').update({
            total_credits: existingCredit.total_credits + creditSessions,
            expiry_date: formatLocalDate(expiryDate),
            plan_weeks: planWeeks,
            max_leave: planMaxLeave,
            status: 'active',
          }).eq('id', existingCredit.id)

        } else {
          const { error: creditError } = await supabase.from('credits').insert({
            student_id: studentId,
            total_credits: creditSessions,
            used_credits: 0,
            leave_count: 0,
            max_leave: planMaxLeave,
            plan_weeks: planWeeks,
            plan_name: selectedPlanForCredits?.name || '報名方案',
            purchase_date: formatLocalDate(new Date()),
            expiry_date: formatLocalDate(expiryDate),
            status: 'active',
          })

        }
      }

      // 為每位學員自動建立已劃位的 attendance 記錄
      const courseForAtt = courses.find(c => c.id === formData.courseId);
      const dayMap: Record<string, number> = { '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6 };
      const targetDay = courseForAtt ? dayMap[courseForAtt.schedule] : undefined;

      // 讀取停課日（含 course_id=null 全域停課）
      const { data: holidayData } = await supabase
        .from('course_holidays')
        .select('date')
        .or(`course_id.eq.${formData.courseId},course_id.is.null`);
      const holidaySet = new Set((holidayData || []).map(h => h.date));

      const creditSessions = (selectedPlanForCredits?.sessions || 1) + bonusSessions;

      for (const studentId of selectedStudentIds) {
        // 取得該學員的 credit_id
        const { data: creditRow } = await supabase
          .from('credits')
          .select('id')
          .eq('student_id', studentId)
          .eq('status', 'active')
          .limit(1)
          .single();

        if (targetDay !== undefined) {
          const dates: string[] = [];
          const current = new Date();
          // 找到下一個目標星期幾
          while (current.getDay() !== targetDay) {
            current.setDate(current.getDate() + 1);
          }
          while (dates.length < creditSessions) {
            const dateStr = formatLocalDate(current);
            if (!holidaySet.has(dateStr)) {
              dates.push(dateStr);
            }
            current.setDate(current.getDate() + 7);
          }

          if (dates.length > 0) {
            const inserts = dates.map(date => ({
              student_id: studentId,
              course_id: formData.courseId,
              date,
              status: '已劃位',
              deducted: false,
              credit_id: creditRow?.id || null,
            }));
            await supabase.from('attendance').insert(inserts);
          }
        }
      }

      // 寫入付款紀錄
      await supabase.from('payments').insert({
        student_id: selectedStudentIds[0],
        amount: finalPrice,
        payment_method: '轉帳',
        description: `${selectedStudentIds.length}位學員 - ${selectedPlan?.name || ''}`,
      });

      // 優惠碼使用紀錄
      if (promoResult) {
        await supabase.from('promo_codes').update({
          current_uses: promoResult.current_uses + 1
        }).eq('id', promoResult.id)

        await supabase.from('promo_code_usage').insert({
          promo_code_id: promoResult.id,
          student_id: selectedStudentIds[0],
          discount_amount: discountAmount,
          original_amount: totalPrice,
          final_amount: finalPrice,
        })
      }

      // 重新讀取課程資料（更新名額顯示）
      onRefreshCourses?.();

      setShowCheckout(true);
    } catch (err) {
      console.error('報名錯誤:', err);
      alert('報名失敗，請稍後再試');
    }
  };

  // 結帳畫面
  if (showCheckout) {
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
          <p className="text-sm text-neutral-600">請依以下匯款資訊完成繳費</p>
        </div>

        <div className="w-full bg-white rounded-card p-6 shadow-card border border-neutral-100 text-left space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 mb-2">
            <CreditCard size={18} className="text-primary" />
            匯款資訊
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">銀行</span>
              <span className="font-bold">{paymentInfo.bank_name}（{paymentInfo.bank_code}）</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">帳號</span>
              <span className="font-bold">{paymentInfo.account_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">戶名</span>
              <span className="font-bold">{paymentInfo.account_name}</span>
            </div>
            <div className="h-px bg-neutral-100" />
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">應付金額</span>
              <span className="text-xl font-black text-primary">NT$ {finalPrice.toLocaleString()}</span>
            </div>
            {paymentInfo.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                <p className="text-amber-800 text-xs">{paymentInfo.notes}</p>
              </div>
            )}
          </div>
        </div>

        {formData.trialDate && (
          <div className="w-full bg-white rounded-card p-6 shadow-card border border-neutral-100 text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                <Clock size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-neutral-600">試上時間</p>
                <p className="text-sm font-bold text-neutral-900">
                  {(() => {
                    const d = new Date(formData.trialDate);
                    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}（週${weekdays[d.getDay()]}）${selectedCourse?.time || ''}`;
                  })()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                <MapPin size={20} className="text-secondary" />
              </div>
              <div>
                <p className="text-xs text-neutral-600">班級</p>
                <p className="text-sm font-bold text-neutral-900">{selectedCourse?.name}</p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full flex flex-col gap-3 mt-4">
          <Button onClick={() => window.open(paymentInfo.line_url || 'https://line.me/R/', '_blank')}>
            前往官方 Line 回覆
          </Button>
          <Button variant="outline" onClick={() => {
            window.dispatchEvent(new CustomEvent('change-tab', { detail: 'sessions' }));
          }}>查看我的堂數</Button>
          <Button variant="ghost" onClick={() => onComplete()}>返回首頁</Button>
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
        {/* 步驟 1：選擇學員 */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">選擇報名學員</h3>
                <span className="text-sm text-neutral-500">已選 {selectedStudentIds.length} 位</span>
              </div>

              {myStudents.length === 0 ? (
                <div className="text-center py-8 bg-neutral-50 rounded-xl">
                  <p className="text-neutral-500">尚無學員資料</p>
                  <p className="text-sm text-neutral-400 mt-1">請先到註冊頁面建立學員</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myStudents.map(student => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    const school = student.notes?.match(/學校: ([^；]+)/)?.[1] || '';
                    return (
                      <div
                        key={student.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                          } else {
                            setSelectedStudentIds(prev => [...prev, student.id]);
                          }
                        }}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected ? 'border-primary bg-primary/5' : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                              student.category === 'adult' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {student.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-neutral-900">{student.name}</p>
                              <p className="text-sm text-neutral-500">
                                {student.student_code} · {student.category === 'adult' ? '成人學員' : '兒童學員'}
                                {school ? ` · ${school}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-primary bg-primary' : 'border-neutral-300'
                          }`}>
                            {isSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Button onClick={handleNext} icon={ChevronRight} disabled={selectedStudentIds.length === 0}>
              下一步：選擇班級
            </Button>
          </motion.div>
        )}

        {/* 步驟 2：選擇班級 + 方案 */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-700">
                已選 {selectedStudents.length} 位{isMixed ? '混合' : autoCategory === 'adult' ? '成人' : '兒童'}學員，顯示對應班級
              </div>

              <FormField label="選擇報名方案">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                  {plans.filter(p => p.category === 'all' || p.category === autoCategory).map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => setFormData({
                        ...formData,
                        planId: plan.id,
                        type: plan.is_trial ? 'trial' : 'official'
                      })}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all flex flex-col gap-2 ${
                        formData.planId === plan.id
                          ? 'border-primary bg-primary-light shadow-active'
                          : 'border-neutral-100 bg-white hover:border-neutral-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className={`text-[10px] font-bold ${formData.planId === plan.id ? 'text-primary' : 'text-neutral-500'}`}>
                          {plan.is_trial ? '試上課程' : plan.name}
                        </p>
                        <h4 className="text-lg font-bold text-neutral-900">{plan.sessions}堂</h4>
                      </div>

                      <div className="mt-auto pt-2">
                        <div className="flex items-baseline gap-1">
                          {plan.original_price && (
                            <span className="text-xs text-neutral-400 line-through">原價{plan.original_price}</span>
                          )}
                          <span className="text-xl font-black text-accent">{plan.price_per_session}</span>
                          <span className="text-[10px] text-accent font-bold">/堂</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-1 leading-tight">{plan.description}</p>
                      </div>

                      {formData.planId === plan.id && (
                        <div className="absolute top-2 right-2">
                          <Check size={16} className="text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </FormField>

              <div className={`space-y-3 ${errors.has('courseId') ? 'ring-2 ring-danger/20 bg-danger/5 rounded-xl p-1' : ''}`}>
                <p className="font-bold text-sm text-neutral-700">選擇班級</p>
                {(() => {
                  const filteredCourses = courses.filter(c => {
                    if (isMixed) return true
                    if (autoCategory === 'adult') return c.category === 'adult'
                    return c.category === 'children'
                  });
                  // 如果篩選後無課程，顯示全部課程
                  const displayCourses = filteredCourses.length > 0 ? filteredCourses : courses;
                  return displayCourses.length === 0 ? (
                    <p className="text-center text-neutral-500 py-4">目前沒有可報名的課程</p>
                  ) : (
                    displayCourses.map(course => {
                      const isFull = course.currentEnrollment >= course.maxEnrollment;
                      return (
                        <div
                          key={course.id}
                          onClick={() => {
                            if (isFull) return;
                            setFormData({ ...formData, courseId: course.id, location: course.location });
                            if (errors.has('courseId')) {
                              const next = new Set(errors);
                              next.delete('courseId');
                              setErrors(next);
                            }
                          }}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.courseId === course.id
                              ? 'border-primary bg-primary/5'
                              : isFull
                                ? 'border-neutral-50 bg-neutral-50 opacity-60 grayscale cursor-not-allowed'
                                : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-neutral-900">{course.name}</p>
                            {isFull && <Badge variant="neutral">已額滿</Badge>}
                          </div>
                          <p className="text-sm text-neutral-500">
                            {course.location} · {course.schedule} {course.time}{course.coaches?.length > 0 ? ` · ${course.coaches.join('、')}` : ''}
                          </p>
                          <p className="text-sm text-primary font-medium mt-1">
                            {course.currentEnrollment}/{course.maxEnrollment} 人
                          </p>
                        </div>
                      );
                    })
                  );
                })()}
              </div>

              {formData.type === 'trial' && (
                <FormField label="選擇試上日期">
                  <div className={errors.has('trialDate') ? 'ring-2 ring-danger/20 bg-danger/5 rounded-xl p-1' : ''}>
                    {loadingSlots ? (
                      <div className="text-center py-8 text-neutral-400 text-sm">載入可選日期中...</div>
                    ) : trialDateSlots.length === 0 ? (
                      <div className="text-center py-8 text-neutral-400 text-sm">
                        {formData.courseId ? '目前無可選日期' : '請先選擇班級'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {trialDateSlots.map(slot => {
                          const isSelected = formData.trialDate === slot.date
                          const remaining = slot.maxStudents - slot.enrolled
                          return (
                            <button
                              key={slot.date}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => {
                                setFormData({ ...formData, trialDate: slot.date })
                                if (errors.has('trialDate')) {
                                  const next = new Set(errors)
                                  next.delete('trialDate')
                                  setErrors(next)
                                }
                              }}
                              className={
                                isSelected
                                  ? 'relative p-4 rounded-xl border-2 border-primary bg-primary/5 text-left transition-all'
                                  : slot.available
                                    ? 'relative p-4 rounded-xl border-2 border-neutral-200 hover:border-primary/50 text-left transition-all'
                                    : 'relative p-4 rounded-xl border-2 border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed text-left'
                              }
                            >
                              <p className={'text-sm font-bold ' + (isSelected ? 'text-primary' : slot.available ? 'text-neutral-900' : 'text-neutral-400')}>
                                {slot.date}
                              </p>
                              <p className={'text-xs mt-1 ' + (isSelected ? 'text-primary/70' : 'text-neutral-500')}>
                                {slot.weekday}
                              </p>
                              <p className={'text-xs mt-2 font-medium ' + (slot.available ? (remaining <= 3 ? 'text-orange-500' : 'text-green-600') : 'text-red-400')}>
                                {slot.available ? '剩餘 ' + remaining + ' 個名額' : '已額滿'}
                              </p>
                              {isSelected && (
                                <div className="absolute top-2 right-2">
                                  <Check size={16} className="text-primary" />
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </FormField>
              )}

              <FormField label="備註（選填）">
                <textarea
                  placeholder="例：有膝蓋舊傷，希望教練特別留意"
                  className="w-full p-4 rounded-input border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm min-h-[100px]"
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                />
              </FormField>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={handleNext} icon={ChevronRight}>下一步：確認報名資料</Button>
              <Button variant="ghost" onClick={handleBack}>上一步</Button>
            </div>
          </motion.div>
        )}

        {/* 步驟 3：確認送出 */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-white rounded-card p-6 shadow-card border border-neutral-100 space-y-6">
              {/* 已選學員 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <User size={18} className="text-primary" />
                  報名學員 ({selectedStudentIds.length} 位)
                </div>
                <div className="space-y-3">
                  {selectedStudentIds.map((id, i) => {
                    const student = myStudents.find(s => s.id === id);
                    if (!student) return null;
                    return (
                      <div key={id} className="p-3 bg-neutral-50 rounded-lg flex items-center gap-3">
                        <span className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                        <span className="font-bold flex-1">{student.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          student.student_code?.startsWith('AD')
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {student.student_code}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-neutral-100" />

              {/* 課程資訊 */}
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
                    <p className="font-medium">{selectedCourse?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-600">時間</p>
                    <p className="font-medium">{selectedCourse?.schedule} {selectedCourse?.time}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-1 flex-1">
                      <p className="text-xs text-neutral-600">類別</p>
                      <p className="font-medium">{autoCategory === 'children' ? '兒童班' : '成人班'}</p>
                    </div>
                    <div className="space-y-1 flex-1">
                      <p className="text-xs text-neutral-600">方案</p>
                      <p className="font-medium">{selectedPlan?.name} ({selectedPlan?.sessions}堂)</p>
                    </div>
                  </div>
                  {formData.type === 'trial' && (
                    <div className="space-y-1">
                      <p className="text-xs text-neutral-600">試上日期</p>
                      <p className="font-medium">{formData.trialDate || '尚未選擇'}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-neutral-100" />

              {/* 優惠碼 */}
              <div className="space-y-2">
                <p className="font-medium text-sm">優惠碼</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="輸入優惠碼"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2 border rounded-xl"
                  />
                  <button
                    onClick={validatePromoCode}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium"
                  >
                    套用
                  </button>
                </div>
                {promoError && <p className="text-sm text-red-500">{promoError}</p>}
                {promoResult && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-green-700 font-medium text-sm">✓ {promoResult.name}</p>
                    <p className="text-green-600 text-xs">
                      {promoResult.type === 'percentage' && `打 ${100 - promoResult.value} 折`}
                      {promoResult.type === 'fixed' && `折扣 NT$ ${promoResult.value}`}
                      {promoResult.type === 'free_sessions' && `贈送 ${promoResult.value} 堂`}
                    </p>
                  </div>
                )}
              </div>

              {/* 費用 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <DollarSign size={18} className="text-primary" />
                  費用預估
                </div>
                {selectedPlan && (
                  <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">原價 ({selectedPlan.sessions}堂 × {participantCount}人)</span>
                      <span className="font-medium">NT$ {totalPrice.toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-danger">
                        <span>折扣</span>
                        <span className="font-medium">- NT$ {discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {bonusSessions > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>贈送堂數</span>
                        <span className="font-medium">+ {bonusSessions} 堂</span>
                      </div>
                    )}
                    <div className="h-px bg-neutral-200" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-neutral-900">預計總費用</span>
                      <div className="text-right">
                        <span className="text-2xl font-black text-primary">NT$ {finalPrice.toLocaleString()}</span>
                        <p className="text-[10px] text-neutral-500">共 {(selectedPlan.sessions + bonusSessions) * participantCount} 堂課</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group" onClick={() => setAgreed(v => !v)}>
                <div className="mt-1">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    agreed ? 'border-primary bg-primary' : 'border-neutral-300 group-hover:border-primary'
                  }`}>
                    {agreed && <Check size={14} className="text-white" />}
                  </div>
                </div>
                <span className="text-xs text-neutral-600 leading-relaxed">
                  我已閱讀並同意《報名條款》與《隱私權政策》，並確認以上資料皆為真實無誤。
                </span>
              </label>

              <div className="flex flex-col gap-3">
                <Button onClick={handleSubmit} disabled={!agreed} className={!agreed ? 'opacity-50 cursor-not-allowed' : ''}>確認送出報名</Button>
                <Button variant="ghost" onClick={handleBack}>上一步</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
