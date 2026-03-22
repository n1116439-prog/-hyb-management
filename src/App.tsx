import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { CourseOverviewPage } from './components/CourseOverviewPage';
import { SessionsPage } from './components/SessionsPage';
import { RegisterPage } from './components/RegisterPage';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminCourseManagement } from './components/AdminCourseManagement';
import { AdminStudentManagement } from './components/AdminStudentManagement';
import { AdminContractManagement } from './components/AdminContractManagement';
import { AdminNotificationCenter } from './components/AdminNotificationCenter';
import { AdminCoachManagement } from './components/AdminCoachManagement';
import { AdminRevenue } from './components/AdminRevenue';
import { AdminPromoManagement } from './components/AdminPromoManagement';
import { AdminSettings } from './components/AdminSettings';
import { AdminCoachPayroll } from './components/AdminCoachPayroll';
import { AdminAttendance } from './components/AdminAttendance';
import { ProfilePage } from './components/ProfilePage';
import { LogIn, ShieldCheck, User, Lock, Mail } from 'lucide-react';
import { Button, FormField, Input } from './components/UI';
import { BottomSheet } from './components/BottomSheet';

import { Session, WaitlistEntry, Course, VenueContract } from './types';
import { supabase } from './lib/supabase';
import { validateName, validateEmail, validatePassword, validatePhone, validateBirthDate } from './lib/validators';
import { getLineLoginUrl, exchangeLineToken, getLineProfile } from './lib/lineLogin';

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
    containerRef.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' })
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

/* ── Register date wheel picker ── */
const RegisterDateWheelPicker: React.FC<{
  value: string
  onChange: (dateStr: string) => void
  label?: string
}> = ({ value, onChange, label }) => {
  const currentYear = 2024
  const minYear = 1950

  const parseDate = (v: string) => {
    if (!v) return { y: '2010', m: '01', d: '01' }
    const [y, m, d] = v.split('-')
    return { y: y || '2010', m: m || '01', d: d || '01' }
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

  const years = Array.from({ length: currentYear - minYear + 1 }, (_, i) => {
    const y = String(currentYear - i)
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

export default function App() {
  const isLoginInProgress = useRef(false);
  const [activeTab, setActiveTab] = useState('home');
  const [courses, setCourses] = useState<Course[]>([]);
  const [contracts, setContracts] = useState<VenueContract[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined);
  const [userRole, setUserRole] = useState<'user' | 'admin' | 'student'>('user');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [waitlists, setWaitlists] = useState<WaitlistEntry[]>([
    {
      id: 'w1',
      courseId: '2',
      courseName: '林口 [頭湖國小] 週六 16:00-18:00 招生中',
      contactName: '王大明',
      phone: '0912345678',
      students: [
        { name: '王小美', age: '8歲', experience: 'basic' }
      ],
      date: '2026/03/01',
      status: 'waiting'
    }
  ]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [loginData, setLoginData] = useState({ account: '', password: '' });
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    students: [{ name: '', gender: '', birthDate: '', level: '', school: '' }] as {name: string, gender: string, birthDate: string, level: string, school: string}[],
  });
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});
  const [studentErrors, setStudentErrors] = useState<Record<string, string>[]>([{}]);
  const [registeredStudents, setRegisteredStudents] = useState<{name: string, student_code: string, student_number: string}[]>([]);
  const [showRegistrationResult, setShowRegistrationResult] = useState(false);
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [pendingAdminEmail, setPendingAdminEmail] = useState('');
  const [pendingAdminUserId, setPendingAdminUserId] = useState('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userCategory, setUserCategory] = useState<'child' | 'adult' | ''>('');

  // 忘記密碼
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);

  // 重設密碼
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetForm, setResetForm] = useState({ password: '', confirm: '' });
  const [resetSaving, setResetSaving] = useState(false);

  // 強制更改密碼
  const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);
  const [forceChangeForm, setForceChangeForm] = useState({ password: '', confirm: '' });
  const [forceChangeSaving, setForceChangeSaving] = useState(false);

  // LINE Login
  const [lineProfile, setLineProfile] = useState<{ userId: string; displayName: string; pictureUrl?: string } | null>(null);
  const [showLineBindModal, setShowLineBindModal] = useState(false);
  const [lineBindData, setLineBindData] = useState({ email: '', password: '' });

  useEffect(() => {
    const handleOpenLogin = () => {
      setIsLoginOpen(true);
    };
    const handleOpenRegister = () => {
      setIsRegisterOpen(true);
    };
    const handleChangeTab = (e: any) => {
      setActiveTab(e.detail);
    };
    window.addEventListener('open-login', handleOpenLogin);
    window.addEventListener('open-register', handleOpenRegister);
    window.addEventListener('change-tab', handleChangeTab);
    return () => {
      window.removeEventListener('open-login', handleOpenLogin);
      window.removeEventListener('open-register', handleOpenRegister);
      window.removeEventListener('change-tab', handleChangeTab);
    };
  }, []);

  // LINE callback 處理
  useEffect(() => {
    const handleLineCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const savedState = localStorage.getItem('line_state');

      if (!code || !state) return;

      // 清除 URL 參數
      window.history.replaceState({}, '', window.location.pathname);

      if (state !== savedState) {
        console.warn('LINE state mismatch, proceeding anyway (mobile browser context switch)');
      }
      localStorage.removeItem('line_state');

      try {
        const { access_token } = await exchangeLineToken(code);
        const profile = await getLineProfile(access_token);
        setLineProfile(profile);

        const { data: linkedStudents } = await supabase
          .from('students')
          .select('parent_uid, name, student_code, category')
          .eq('line_uid', profile.userId);

        if (linkedStudents && linkedStudents.length > 0) {
          setUserRole('student');
          setUserEmail(profile.displayName + ' (LINE)');
          const categories = linkedStudents.map(s => s.category);
          setUserCategory(categories.includes('adult') ? 'adult' : 'child');
          localStorage.setItem('line_user', JSON.stringify(profile));
        } else {
          setShowLineBindModal(true);
        }
      } catch (err) {
        console.error('LINE login error:', err);
        alert('LINE 登入失敗，請稍後再試');
      }
    };

    handleLineCallback();
  }, []);

  // 偵測重設密碼 URL
  useEffect(() => {
    if (window.location.pathname === '/reset-password') {
      setShowResetPassword(true);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const email = session.user.email || '';
          setUserEmail(email);

          // 檢查是否為管理員且已驗證 OTP
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role, otp_verified')
            .eq('user_id', session.user.id)
            .in('role', ['super_admin', 'admin'])
            .maybeSingle();

          if (roleData && roleData.otp_verified === true) {
            setUserRole('admin');
            setIsAdminLoggedIn(true);
            setActiveTab(prev => prev.startsWith('admin-') ? prev : 'admin-dashboard');
          } else {
            setUserRole('student');
            // 查詢用戶類型
            const { data: myStudents } = await supabase
              .from('students')
              .select('category')
              .eq('parent_uid', session.user.id);
            if (myStudents && myStudents.length > 0) {
              setUserCategory(myStudents.some(s => s.category === 'adult') ? 'adult' : 'child');
            }
            // 檢查是否需要強制更改密碼
            try {
              const { data: forceChange } = await supabase
                .from('students')
                .select('force_password_change')
                .eq('parent_uid', session.user.id)
                .eq('force_password_change', true)
                .maybeSingle();
              if (forceChange) {
                setShowForcePasswordChange(true);
              }
            } catch (err) {
              console.warn('檢查強制改密碼失敗:', err);
            }
          }
        } else {
          // 檢查 LINE 登入狀態
          const savedLineUser = localStorage.getItem('line_user');
          if (savedLineUser) {
            const profile = JSON.parse(savedLineUser);
            const { data: linkedStudents } = await supabase
              .from('students')
              .select('parent_uid, category')
              .eq('line_uid', profile.userId);
            if (linkedStudents && linkedStudents.length > 0) {
              setUserRole('student');
              setUserEmail(profile.displayName + ' (LINE)');
              setLineProfile(profile);
              setUserCategory(linkedStudents.some((s: any) => s.category === 'adult') ? 'adult' : 'child');
            } else {
              localStorage.removeItem('line_user');
            }
          }
        }
      } catch (err) {
        console.warn('checkSession 錯誤:', err);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserRole('user');
        setIsAdminLoggedIn(false);
        setUserEmail('');
        return;
      }

      // 登入中由 handleLogin 自己處理角色判斷，避免 lock 衝突
      if (isLoginInProgress.current) return;

      if (session) {
        setUserEmail(session.user.email || '');

        try {
          // 檢查是否為管理員且已驗證 OTP
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role, otp_verified')
            .eq('user_id', session.user.id)
            .in('role', ['super_admin', 'admin'])
            .maybeSingle();

          if (roleData && roleData.otp_verified === true) {
            setUserRole('admin');
            setIsAdminLoggedIn(true);
            setActiveTab(prev => prev.startsWith('admin-') ? prev : 'admin-dashboard');
          }
        } catch (err) {
          console.warn('onAuthStateChange user_roles 查詢失敗:', err);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchCourses = async () => {
    const { data: coursesData } = await supabase
      .from('courses')
      .select('*, coaches(name), venues(name, address)')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('name')

    // 從 enrollments 表計算每門課的實際報名人數
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('status', '已報名')

    const enrollmentCounts: Record<string, number> = {}
    enrollments?.forEach(e => {
      enrollmentCounts[e.course_id] = (enrollmentCounts[e.course_id] || 0) + 1
    })

    if (coursesData) {
      setCourses(coursesData.map(c => ({
        id: c.id,
        name: c.name,
        category: (c.category === '成人班' || c.category === 'adult') ? 'adult' : 'children',
        schedule: c.day_of_week,
        time: `${c.start_time?.slice(0,5)} – ${c.end_time?.slice(0,5)}`,
        location: c.venues?.name || '',
        coaches: c.coaches ? [c.coaches.name] : [],
        thumbnail: `https://picsum.photos/seed/${c.id}/200/200`,
        currentEnrollment: enrollmentCounts[c.id] || 0,
        maxEnrollment: c.max_students || 20,
        price: c.price || 0,
        description: c.description || '',
        tags: [c.day_of_week, c.venues?.name].filter(Boolean),
        course_code: c.course_code,
        status: c.status,
      })))
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchCourses()

      // 讀取合約
      const { data: contractsData } = await supabase
        .from('venue_contracts')
        .select('*, venues(name, address)')
        .order('end_date')
      if (contractsData) {
        setContracts(contractsData.map(c => ({
          id: c.id,
          venue: c.venues?.name || '',
          address: c.venues?.address || '',
          startDate: c.start_date,
          endDate: c.end_date,
          rent: c.rent || 0,
          paid: c.paid || false,
          contractType: c.contract_type || '',
          slots: c.slots || [],
          schedule: c.schedule || [],
          photos: c.photos || [],
          logs: c.logs || [],
          daysUntilExpiry: Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        })))
      }
    }
    fetchData()
  }, [])

  const handleRegister = (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveTab('register');
  };

  const handleComplete = () => {
    setActiveTab('home');
    setSelectedCourseId(undefined);
  };

  const generateAndSendOtp = async (userId: string, email: string) => {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from('user_roles').update({
      otp_code: otp,
      otp_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      otp_verified: false,
    }).eq('user_id', userId);
    console.log(`[管理員 OTP] ${email}: ${otp}`);
    return otp;
  };

  const startOtpCooldown = () => {
    setOtpCooldown(60);
    const timer = setInterval(() => {
      setOtpCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    if (loginStep === 2) {
      // Step 2: 驗證 OTP
      const code = otpCode.join('');
      if (code.length !== 6) return;

      setIsSendingCode(true);
      try {
        const { data: otpData } = await supabase
          .from('user_roles')
          .select('otp_code, otp_expires_at')
          .eq('user_id', pendingAdminUserId)
          .single();

        if (!otpData || otpData.otp_code !== code) {
          alert('驗證碼錯誤，請重新輸入');
          setOtpCode(['', '', '', '', '', '']);
          setIsSendingCode(false);
          return;
        }

        if (otpData.otp_expires_at && new Date(otpData.otp_expires_at) < new Date()) {
          alert('驗證碼已過期，請重新發送');
          setOtpCode(['', '', '', '', '', '']);
          setIsSendingCode(false);
          return;
        }

        // OTP 驗證通過，清除 OTP
        await supabase.from('user_roles').update({ otp_code: null, otp_expires_at: null, otp_verified: true }).eq('user_id', pendingAdminUserId);

        sessionStorage.setItem('admin_verified', pendingAdminEmail);
        setUserRole('admin');
        setIsAdminLoggedIn(true);
        setActiveTab('admin-dashboard');
        setUserEmail(pendingAdminEmail);
        setIsLoginOpen(false);
        setLoginData({ account: '', password: '' });
        setLoginStep(1);
        setOtpCode(['', '', '', '', '', '']);
        setPendingAdminEmail('');
        setPendingAdminUserId('');
        setIsSendingCode(false);
      } catch (err) {
        console.error('OTP 驗證錯誤:', err);
        alert('驗證過程發生錯誤');
        setIsSendingCode(false);
      }
      return;
    }

    // Step 1: Email + 密碼
    setIsSendingCode(true);
    isLoginInProgress.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.account,
        password: loginData.password,
      });

      if (error || !data.user) {
        console.error('signInWithPassword 失敗:', error);
        alert('帳號或密碼錯誤');
        setIsSendingCode(false);
        isLoginInProgress.current = false;
        return;
      }

      console.log('登入成功', data.user.email);

      // 檢查是否為管理員
      console.log('開始查 user_roles');
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role, requires_otp')
        .eq('user_id', data.user.id)
        .in('role', ['super_admin', 'admin'])
        .maybeSingle();

      if (roleError) {
        console.error('user_roles 查詢失敗:', roleError);
      }
      console.log('user_roles 結果:', roleData);

      if (roleData) {
        if (roleData.requires_otp === false) {
          // 不需要 OTP → 直接進入管理員，同時設 otp_verified 讓 checkSession 能恢復
          await supabase.from('user_roles').update({ otp_verified: true }).eq('user_id', data.user.id);
          sessionStorage.setItem('admin_verified', loginData.account);
          setUserRole('admin');
          setIsAdminLoggedIn(true);
          setActiveTab('admin-dashboard');
          setUserEmail(loginData.account);
          setIsLoginOpen(false);
          setLoginData({ account: '', password: '' });
          setIsSendingCode(false);
          isLoginInProgress.current = false;
          return;
        }
        // 需要 OTP → 發送 OTP 進入第二步
        await generateAndSendOtp(data.user.id, loginData.account);
        setPendingAdminUserId(data.user.id);
        setPendingAdminEmail(loginData.account);
        startOtpCooldown();
        setLoginStep(2);
        setIsSendingCode(false);
        isLoginInProgress.current = false;
        return;
      }

      // 不是管理員 → 普通學員登入
      console.log('學員登入流程');
      setUserRole('student');
      setUserEmail(loginData.account);

      const { data: myStudents, error: studentsError } = await supabase
        .from('students')
        .select('category')
        .eq('parent_uid', data.user.id);
      if (studentsError) {
        console.error('students 查詢失敗:', studentsError);
      }
      if (myStudents && myStudents.length > 0) {
        setUserCategory(myStudents.some(s => s.category === 'adult') ? 'adult' : 'child');
      }

      // 檢查是否需要強制更改密碼
      try {
        const { data: forceChange } = await supabase
          .from('students')
          .select('force_password_change')
          .eq('parent_uid', data.user.id)
          .eq('force_password_change', true)
          .maybeSingle();
        if (forceChange) {
          setShowForcePasswordChange(true);
        }
      } catch (err) {
        console.warn('檢查強制改密碼失敗:', err);
      }

      setIsLoginOpen(false);
      setLoginData({ account: '', password: '' });
      setIsSendingCode(false);
      isLoginInProgress.current = false;
    } catch (err) {
      console.error('登入錯誤:', err);
      alert('登入過程發生錯誤');
      setIsSendingCode(false);
      isLoginInProgress.current = false;
    }
  };

  const addStudent = () => {
    setRegisterData(prev => ({
      ...prev,
      students: [...prev.students, { name: '', gender: '', birthDate: '', level: '', school: '' }]
    }));
    setStudentErrors(prev => [...prev, {}]);
  };

  const removeStudent = (index: number) => {
    if (registerData.students.length <= 1) return;
    setRegisterData(prev => ({
      ...prev,
      students: prev.students.filter((_, i) => i !== index)
    }));
    setStudentErrors(prev => prev.filter((_, i) => i !== index));
  };

  const updateStudent = (index: number, field: string, value: string) => {
    setRegisterData(prev => ({
      ...prev,
      students: prev.students.map((s, i) => i === index ? { ...s, [field]: value } : s)
    }));
  };

  const calculateAge = (birthday: string): number => {
    const birth = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const resetRegisterForm = () => {
    setRegisterData({
      name: '', email: '', password: '', phone: '',
      students: [{ name: '', gender: '', birthDate: '', level: '', school: '' }],
    });
    setRegisterStep(1);
    setShowRegistrationResult(false);
    setRegisteredStudents([]);
    setRegisterErrors({});
    setStudentErrors([{}]);
  };

  const handleRegisterUser = async () => {
    if (registerStep === 1) {
      const errs: Record<string, string> = {};
      const nameErr = validateName(registerData.name, '姓名');
      if (nameErr) errs.name = nameErr;
      const emailErr = validateEmail(registerData.email);
      if (emailErr) errs.email = emailErr;
      const pwErr = validatePassword(registerData.password);
      if (pwErr) errs.password = pwErr;
      const phoneErr = validatePhone(registerData.phone, true);
      if (phoneErr) errs.phone = phoneErr;
      setRegisterErrors(errs);
      if (Object.keys(errs).length > 0) return;
      setRegisterStep(2);
      return;
    }

    // 步驟二驗證
    const sErrs = registerData.students.map(s => {
      const e: Record<string, string> = {};
      const nameErr = validateName(s.name, '學員姓名');
      if (nameErr) e.name = nameErr;
      const bdErr = validateBirthDate(s.birthDate, true);
      if (bdErr) e.birthDate = bdErr;
      return e;
    });
    setStudentErrors(sErrs);
    if (sErrs.some(e => Object.keys(e).length > 0)) return;

    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('email', registerData.email)
      .limit(1);
    if (existingStudent && existingStudent.length > 0) {
      alert('此 Email 已有註冊紀錄，請直接登入或使用其他 Email');
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: registerData.email,
      password: registerData.password,
      options: {
        data: {
          parentName: registerData.name,
          phone: registerData.phone,
        }
      }
    });
    if (authError) {
      alert('註冊失敗：' + authError.message);
      return;
    }
    const authUid = authData.user?.id;
    if (!authUid) {
      alert('註冊失敗：無法取得用戶 ID');
      return;
    }

    const { data: familyData } = await supabase
      .from('families')
      .insert({
        parent_auth_uid: authUid,
        parent_name: registerData.name,
        phone: registerData.phone,
        email: registerData.email,
      })
      .select('id')
      .single();
    const familyId = familyData?.id;

    const results: {name: string, student_code: string, student_number: string}[] = [];

    for (const student of registerData.students) {
      const age = calculateAge(student.birthDate);
      const isAdult = age >= 16;
      const prefix = isAdult ? 'AD' : 'ST';
      const category = isAdult ? 'adult' : 'child';

      const { data: studentCode } = await supabase
        .rpc('generate_student_code', { p_prefix: prefix });

      const { data: insertedData, error: studentError } = await supabase
        .from('students')
        .insert({
          name: student.name,
          gender: student.gender || null,
          birth_date: student.birthDate || null,
          phone: registerData.phone,
          email: registerData.email,
          emergency_contact: registerData.name,
          emergency_phone: registerData.phone,
          parent_uid: authUid,
          family_id: familyId,
          notes: [
            student.school ? '學校: ' + student.school : '',
            student.level ? '程度: ' + student.level : '',
          ].filter(Boolean).join('；'),
          student_code: studentCode,
          age_type: isAdult ? 'adult' : 'child',
          category: category,
        })
        .select('id')
        .single();

      if (studentError) {
        console.error('學員建立失敗:', studentError);
        alert('學員資料建立失敗：' + studentError.message);
        return;
      }

      if (insertedData) {
        const { data: studentWithNumber } = await supabase
          .from('students')
          .select('name, student_code, student_number')
          .eq('id', insertedData.id)
          .single();
        if (studentWithNumber) results.push(studentWithNumber);
      }
    }

    try {
      await supabase.from('user_roles').insert({
        user_id: authUid,
        role: 'parent',
        name: registerData.name,
        email: registerData.email,
        phone: registerData.phone,
      });
    } catch (e) {
      console.warn('user_roles 寫入失敗，跳過:', e);
    }

    setRegisteredStudents(results);
    setShowRegistrationResult(true);
  };

  const handleLineBind = async () => {
    if (!lineProfile) return;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: lineBindData.email,
      password: lineBindData.password,
    });

    if (authError) {
      alert('帳號或密碼錯誤，請確認後重試');
      return;
    }

    const { error: updateError } = await supabase
      .from('students')
      .update({ line_uid: lineProfile.userId })
      .eq('parent_uid', authData.user.id);

    if (updateError) {
      console.error('LINE bind error:', updateError);
      alert('綁定失敗：' + updateError.message);
      return;
    }

    setUserRole('student');
    setUserEmail(authData.user.email || '');
    setShowLineBindModal(false);
    setLineBindData({ email: '', password: '' });

    const { data: myStudents } = await supabase
      .from('students')
      .select('category')
      .eq('parent_uid', authData.user.id);
    if (myStudents && myStudents.length > 0) {
      setUserCategory(myStudents.some(s => s.category === 'adult') ? 'adult' : 'child');
    }

    localStorage.setItem('line_user', JSON.stringify(lineProfile));
    alert('LINE 帳號綁定成功！下次可直接用 LINE 登入');
  };

  const handleLogout = async () => {
    // 登出前重設 otp_verified，強制下次登入重新驗證
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_roles').update({ otp_verified: false }).eq('user_id', user.id);
    }
    await supabase.auth.signOut();
    localStorage.removeItem('line_user');
    sessionStorage.removeItem('admin_verified');
    setLineProfile(null);
    setUserRole('user');
    setIsAdminLoggedIn(false);
    setUserCategory('');
    setActiveTab('home');
    setPendingAdminUserId('');
    setPendingAdminEmail('');
  };

  const getPageTitle = () => {
    if (userRole === 'admin') return '管理後台';
    switch (activeTab) {
      case 'home': 
        if (userRole === 'student') return '學員專區';
        return '恆躍羽球學院';
      case 'sessions': return '我的課程';
      case 'register': return '立即報名';
      case 'profile': return '個人資料中心';
      default: return '恆躍羽球學院';
    }
  };

  const getRightAction = () => {
    return (
      <div className="flex items-center gap-2">
        {userRole === 'user' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="text-sm font-medium text-neutral-600 hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-100"
            >
              註冊
            </button>
            <button
              onClick={() => setIsLoginOpen(true)}
              className="text-sm font-medium text-white bg-primary hover:bg-blue-700 transition-colors px-3 py-1.5 rounded-lg shadow-sm"
            >
              登入
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {userRole === 'admin' && (
              <button
                onClick={() => {
                  setUserRole('student');
                  setActiveTab('home');
                }}
                className="text-sm font-medium text-neutral-600 hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-100"
              >
                切換前端
              </button>
            )}
            {userRole === 'student' && isAdminLoggedIn && (
              <button
                onClick={() => {
                  setUserRole('admin');
                  setActiveTab('admin-dashboard');
                }}
                className="text-sm font-medium text-neutral-600 hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-100"
              >
                切換後端
              </button>
            )}

            <div className={`hidden sm:block px-2 py-1 rounded text-[10px] font-bold uppercase ${
              userRole === 'admin' ? 'bg-red-100 text-red-600' :
              userCategory === 'adult' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {userRole === 'admin' ? 'Admin' : userCategory === 'adult' ? 'Adult' : 'Student'}
            </div>

            <span className="hidden sm:block text-sm text-neutral-600 max-w-[160px] truncate">
              {userEmail}
            </span>

            <button
              onClick={handleLogout}
              className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              登出
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    // 前端路由防護：admin- 開頭的頁面需要管理員權限
    if (activeTab.startsWith('admin-') && userRole !== 'admin') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-100 text-red-500 mb-4">
            <ShieldCheck size={32} />
          </div>
          <p className="text-lg font-bold text-neutral-900 mb-2">無權限存取</p>
          <p className="text-sm text-neutral-500 mb-6">此頁面僅限管理員使用，請先登入管理員帳號。</p>
          <Button variant="primary" onClick={() => setActiveTab('home')}>返回首頁</Button>
        </div>
      );
    }

    if (userRole === 'admin') {
      switch (activeTab) {
        case 'admin-dashboard': return <AdminDashboard />;
        case 'admin-courses': return <AdminCourseManagement courses={courses} setCourses={setCourses} contracts={contracts} />;
        case 'admin-students': return <AdminStudentManagement waitlists={waitlists} />;
        case 'admin-coaches': return <AdminCoachManagement />;
        case 'admin-revenue': return <AdminRevenue />;
        case 'admin-attendance': return <AdminAttendance />;
        case 'admin-contracts': return <AdminContractManagement contracts={contracts} setContracts={setContracts} />;
        case 'admin-promo': return <AdminPromoManagement />;
        case 'admin-notifications': return <AdminNotificationCenter />;
        case 'admin-settings': return <AdminSettings />;
        case 'admin-payroll': return <AdminCoachPayroll />;
        default: return <AdminDashboard />;
      }
    }

    switch (activeTab) {
      case 'home': 
        return (
          <CourseOverviewPage
            courses={courses}
            onRegister={handleRegister}
            userRole={userRole}
            userCategory={userCategory}
            onJoinWaitlist={(entry) => setWaitlists(prev => [...prev, { ...entry, id: Math.random().toString(36).substr(2, 9) }])}
          />
        );
      case 'sessions':
        return <SessionsPage courses={courses} userRole={userRole} waitlists={waitlists} userCategory={userCategory} />;
      case 'register':
        return (
          <RegisterPage
            courses={courses}
            initialCourseId={selectedCourseId}
            onComplete={handleComplete}
            onRefreshCourses={fetchCourses}
            userRole={userRole}
            userCategory={userCategory}
          />
        );
      case 'profile':
        return <ProfilePage />;
      default:
        return (
          <CourseOverviewPage
            courses={courses}
            onRegister={handleRegister}
            userRole={userRole}
            userCategory={userCategory}
            onJoinWaitlist={(entry) => setWaitlists(prev => [...prev, { ...entry, id: Math.random().toString(36).substr(2, 9) }])}
          />
        );
    }
  };

  // 強制更改密碼全屏頁面
  if (showForcePasswordChange) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-amber-100">
              <Lock size={32} className="text-amber-600" />
            </div>
            <p className="text-xl font-bold text-neutral-900">請更改密碼</p>
            <p className="text-sm text-neutral-500 text-center">您使用的是臨時密碼，為了帳號安全請立即設定新密碼</p>
          </div>
          <div className="space-y-4">
            <FormField label="新密碼">
              <Input
                type="password"
                placeholder="請輸入新密碼（至少 6 位）"
                value={forceChangeForm.password}
                onChange={e => setForceChangeForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </FormField>
            <FormField label="確認密碼">
              <Input
                type="password"
                placeholder="再次輸入新密碼"
                value={forceChangeForm.confirm}
                onChange={e => setForceChangeForm(prev => ({ ...prev, confirm: e.target.value }))}
              />
            </FormField>
            <Button
              variant="primary"
              loading={forceChangeSaving}
              className="w-full h-14 rounded-2xl"
              onClick={async () => {
                if (forceChangeForm.password.length < 6) { alert('密碼至少 6 位'); return; }
                if (forceChangeForm.password !== forceChangeForm.confirm) { alert('兩次密碼不一致'); return; }
                setForceChangeSaving(true);
                try {
                  console.log('開始更新密碼...');
                  const { error } = await supabase.auth.updateUser({ password: forceChangeForm.password });
                  console.log('updateUser 結果:', error);
                  if (error) { alert('更新失敗：' + error.message); setForceChangeSaving(false); return; }
                  const { data: { user } } = await supabase.auth.getUser();
                  console.log('getUser:', user?.id);
                  if (user) {
                    await supabase.from('students').update({ force_password_change: false }).eq('parent_uid', user.id);
                  }
                  setForceChangeSaving(false);
                  setShowForcePasswordChange(false);
                  setForceChangeForm({ password: '', confirm: '' });
                  alert('密碼已更新！');
                } catch (err) {
                  console.error('強制改密碼錯誤:', err);
                  alert('更新過程發生錯誤');
                  setForceChangeSaving(false);
                }
              }}
            >
              確認更改
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 重設密碼全屏頁面
  if (showResetPassword) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
              <Lock size={32} />
            </div>
            <p className="text-lg font-bold text-neutral-900">設定新密碼</p>
          </div>
          <div className="space-y-4">
            <FormField label="新密碼（至少 6 位）">
              <Input
                type="password"
                placeholder="請輸入新密碼"
                value={resetForm.password}
                onChange={e => setResetForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </FormField>
            <FormField label="確認新密碼">
              <Input
                type="password"
                placeholder="再次輸入新密碼"
                value={resetForm.confirm}
                onChange={e => setResetForm(prev => ({ ...prev, confirm: e.target.value }))}
              />
            </FormField>
            <Button
              variant="primary"
              loading={resetSaving}
              onClick={async () => {
                if (resetForm.password.length < 6) { alert('密碼至少需要 6 個字元'); return; }
                if (resetForm.password !== resetForm.confirm) { alert('兩次密碼輸入不一致'); return; }
                setResetSaving(true);
                const { error } = await supabase.auth.updateUser({ password: resetForm.password });
                setResetSaving(false);
                if (error) { alert('更新失敗：' + error.message); return; }
                alert('密碼已更新，請用新密碼登入');
                setShowResetPassword(false);
                setResetForm({ password: '', confirm: '' });
                window.history.replaceState({}, '', '/');
                setIsLoginOpen(true);
              }}
            >
              確認更新
            </Button>
            <Button
              variant="ghost"
              className="text-neutral-500"
              onClick={() => {
                setShowResetPassword(false);
                setResetForm({ password: '', confirm: '' });
                window.history.replaceState({}, '', '/');
              }}
            >
              返回首頁
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'register') setSelectedCourseId(undefined);
        }}
        title={getPageTitle()}
        rightAction={getRightAction()}
        userRole={userRole}
      >
        {renderContent()}
      </Layout>

      {/* Login Bottom Sheet */}
      <BottomSheet
        isOpen={isLoginOpen}
        onClose={() => {
          setIsLoginOpen(false);
          setLoginStep(1);
          setOtpCode(['', '', '', '', '', '']);
          setPendingAdminEmail('');
          setPendingAdminUserId('');
          setShowForgotPassword(false);
          setForgotEmail('');
          setForgotSent(false);
        }}
        title={showForgotPassword ? '忘記密碼' : loginStep === 1 ? '登入' : '安全驗證'}
      >
        {showForgotPassword ? (
          /* === 忘記密碼畫面 === */
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${forgotSent ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
                {forgotSent ? <Mail size={32} /> : <Lock size={32} />}
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-900">
                  {forgotSent ? '已發送重設連結' : '忘記密碼'}
                </p>
                <p className="text-sm text-neutral-600">
                  {forgotSent
                    ? `請到 ${forgotEmail} 信箱查看郵件，點擊連結重設密碼`
                    : '輸入你的 Email，我們會寄送重設密碼連結'}
                </p>
              </div>
            </div>

            {forgotSent ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-amber-800 text-sm text-center">沒收到？請檢查垃圾郵件，或等冷卻結束後重新發送</p>
                </div>
                <Button
                  variant="primary"
                  loading={forgotSending}
                  disabled={forgotCooldown > 0}
                  onClick={async () => {
                    setForgotSending(true);
                    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                      redirectTo: window.location.origin + '/reset-password',
                    });
                    setForgotSending(false);
                    if (error) { alert('發送失敗：' + error.message); return; }
                    setForgotCooldown(60);
                    const timer = setInterval(() => {
                      setForgotCooldown(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
                    }, 1000);
                  }}
                >
                  {forgotCooldown > 0 ? `重新發送 (${forgotCooldown}s)` : '重新發送'}
                </Button>
                <Button variant="ghost" onClick={() => { setShowForgotPassword(false); setForgotEmail(''); setForgotSent(false); }} className="text-neutral-500">
                  返回登入
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <FormField label="Email">
                  <Input
                    type="email"
                    placeholder="請輸入註冊時的 Email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                  />
                </FormField>
                <Button
                  variant="primary"
                  loading={forgotSending}
                  onClick={async () => {
                    if (!forgotEmail.trim()) { alert('請輸入 Email'); return; }
                    setForgotSending(true);
                    const redirectUrl = window.location.origin + '/reset-password';
                    console.log('忘記密碼 - 發送重設連結到:', forgotEmail, '導向:', redirectUrl);
                    const { data: resetData, error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                      redirectTo: redirectUrl,
                    });
                    console.log('resetPasswordForEmail 結果:', { resetData, error });
                    setForgotSending(false);
                    if (error) { alert('發送失敗：' + error.message); return; }
                    setForgotSent(true);
                    setForgotCooldown(60);
                    const timer = setInterval(() => {
                      setForgotCooldown(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
                    }, 1000);
                  }}
                >
                  發送重設連結
                </Button>
                <Button variant="ghost" onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }} className="text-neutral-500">
                  返回登入
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* === 登入畫面 === */
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${loginStep === 2 ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
                <ShieldCheck size={32} />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-900">
                  {loginStep === 1 ? '歡迎回來' : '安全驗證'}
                </p>
                <p className="text-sm text-neutral-600">
                  {loginStep === 1
                    ? '請輸入 Email 與密碼，系統自動判斷角色'
                    : `驗證碼已發送至 ${pendingAdminEmail}`}
                </p>
                {loginStep === 2 && (
                  <p className="text-xs text-amber-600 mt-1">開發模式：請查看瀏覽器 Console</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {loginStep === 1 ? (
                <>
                  <FormField label="Email">
                    <Input
                      placeholder="請輸入 Email"
                      value={loginData.account}
                      onChange={e => setLoginData({...loginData, account: e.target.value})}
                    />
                  </FormField>
                  <FormField label="密碼">
                    <Input
                      type="password"
                      placeholder="請輸入密碼"
                      value={loginData.password}
                      onChange={e => setLoginData({...loginData, password: e.target.value})}
                    />
                  </FormField>
                </>
              ) : (
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-2">6 位數驗證碼</p>
                  <div className="flex gap-2 justify-center">
                    {otpCode.map((digit, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        className="w-12 h-14 text-center text-xl font-bold border-2 border-neutral-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          const newCode = [...otpCode];
                          newCode[i] = val;
                          setOtpCode(newCode);
                          if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Backspace' && !otpCode[i] && i > 0) {
                            document.getElementById(`otp-${i - 1}`)?.focus();
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleLogin}
                icon={LogIn}
                loading={isSendingCode}
                variant="primary"
                className={loginStep === 2 ? 'bg-danger hover:bg-danger/90' : ''}
              >
                {loginStep === 1 ? '確認登入' : '驗證並登入'}
              </Button>

              {loginStep === 2 && (
                <>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={async () => {
                        if (otpCooldown > 0) return;
                        await generateAndSendOtp(pendingAdminUserId, pendingAdminEmail);
                        startOtpCooldown();
                      }}
                      disabled={otpCooldown > 0}
                      className={`text-sm font-medium ${otpCooldown > 0 ? 'text-neutral-400' : 'text-primary hover:text-primary/80'}`}
                    >
                      {otpCooldown > 0 ? `重新發送 (${otpCooldown}s)` : '重新發送驗證碼'}
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => { setLoginStep(1); setOtpCode(['', '', '', '', '', '']); setPendingAdminEmail(''); setPendingAdminUserId(''); }}
                    className="text-neutral-500"
                  >
                    返回上一步
                  </Button>
                </>
              )}

              {loginStep === 1 && (
                <>
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-neutral-200" />
                    <span className="text-xs text-neutral-400">或</span>
                    <div className="flex-1 h-px bg-neutral-200" />
                  </div>
                  <button
                    onClick={() => { setIsLoginOpen(false); window.location.href = getLineLoginUrl(); }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                    style={{ backgroundColor: '#06C755', color: 'white' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                    </svg>
                    LINE 登入
                  </button>
                </>
              )}
            </div>

            <p className="text-center text-xs text-neutral-400">
              <button onClick={() => setShowForgotPassword(true)} className="text-primary hover:text-primary/80 font-medium">
                忘記密碼？
              </button>
            </p>
          </div>
        )}
      </BottomSheet>

      {/* Register Bottom Sheet */}
      <BottomSheet
        isOpen={isRegisterOpen}
        onClose={() => {
          setIsRegisterOpen(false);
          resetRegisterForm();
        }}
        title={showRegistrationResult ? '註冊成功' : registerStep === 1 ? '建立帳號' : '新增學員資料'}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
              <User size={32} />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-neutral-900">
                {showRegistrationResult ? '註冊成功！' : registerStep === 1 ? '建立帳號' : '新增學員'}
              </p>
              <p className="text-sm text-neutral-600">
                {showRegistrationResult ? '請記住以下學員編號' : registerStep === 1 ? '填寫帳號資料' : '可同時新增成人與兒童學員，依出生日期自動判斷'}
              </p>
            </div>
          </div>

          {showRegistrationResult ? (
            /* === 成功畫面 === */
            <div className="space-y-4">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-green-700 font-bold text-lg">註冊成功！</p>
                <p className="text-green-600 text-sm mt-1">請記住以下學員編號</p>
              </div>
              {registeredStudents.map((student, index) => (
                <div key={index} className="bg-white border-2 border-primary/20 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-neutral-900 text-lg">{student.name}</p>
                    <p className="text-sm text-neutral-500">
                      {(student.student_code || student.student_number || '').startsWith('AD') ? '成人學員' : '兒童學員'}
                    </p>
                  </div>
                  <div className="bg-primary/10 px-4 py-2 rounded-lg">
                    <p className="font-bold text-primary text-xl">{student.student_code || student.student_number || '產生中...'}</p>
                  </div>
                </div>
              ))}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-amber-800 text-sm text-center">學員編號為報名及管理的唯一識別碼，請妥善保存。</p>
              </div>
              <div className="space-y-3 pt-2">
                <Button variant="primary" onClick={() => { resetRegisterForm(); setIsRegisterOpen(false); setIsLoginOpen(true); }}>前往登入</Button>
                <Button variant="ghost" onClick={() => { resetRegisterForm(); setIsRegisterOpen(false); }}>返回首頁</Button>
              </div>
            </div>
          ) : registerStep === 1 ? (
            /* === 步驟一：帳號資料 === */
            <div className="space-y-4">
              <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                <p className="font-bold text-sm text-neutral-700">帳號資訊</p>
                <FormField label="真實姓名">
                  <Input placeholder="請填寫真實姓名" value={registerData.name}
                    className={registerErrors.name ? 'border-red-400 ring-1 ring-red-200' : ''}
                    onChange={e => { setRegisterData({...registerData, name: e.target.value}); if (registerErrors.name) { const err = validateName(e.target.value, '姓名'); setRegisterErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); } }}
                    onBlur={() => { const err = validateName(registerData.name, '姓名'); setRegisterErrors(prev => { const n = {...prev}; if (err) n.name = err; else delete n.name; return n; }); }}
                  />
                  {registerErrors.name && <p className="text-xs text-red-500 mt-1">{registerErrors.name}</p>}
                </FormField>
                <FormField label="電子信箱（用於登入）">
                  <Input type="email" placeholder="請輸入 Email" value={registerData.email}
                    className={registerErrors.email ? 'border-red-400 ring-1 ring-red-200' : ''}
                    onChange={e => { setRegisterData({...registerData, email: e.target.value}); if (registerErrors.email) { const err = validateEmail(e.target.value); setRegisterErrors(prev => { const n = {...prev}; if (err) n.email = err; else delete n.email; return n; }); } }}
                    onBlur={() => { const err = validateEmail(registerData.email); setRegisterErrors(prev => { const n = {...prev}; if (err) n.email = err; else delete n.email; return n; }); }}
                  />
                  {registerErrors.email && <p className="text-xs text-red-500 mt-1">{registerErrors.email}</p>}
                </FormField>
                <FormField label="密碼（至少 6 位）">
                  <Input type="password" placeholder="請輸入密碼" value={registerData.password}
                    className={registerErrors.password ? 'border-red-400 ring-1 ring-red-200' : ''}
                    onChange={e => { setRegisterData({...registerData, password: e.target.value}); if (registerErrors.password) { const err = validatePassword(e.target.value); setRegisterErrors(prev => { const n = {...prev}; if (err) n.password = err; else delete n.password; return n; }); } }}
                    onBlur={() => { const err = validatePassword(registerData.password); setRegisterErrors(prev => { const n = {...prev}; if (err) n.password = err; else delete n.password; return n; }); }}
                  />
                  {registerErrors.password && <p className="text-xs text-red-500 mt-1">{registerErrors.password}</p>}
                </FormField>
                <FormField label="聯絡電話">
                  <Input type="tel" placeholder="請輸入手機號碼" value={registerData.phone}
                    className={registerErrors.phone ? 'border-red-400 ring-1 ring-red-200' : ''}
                    onChange={e => { setRegisterData({...registerData, phone: e.target.value}); if (registerErrors.phone) { const err = validatePhone(e.target.value, true); setRegisterErrors(prev => { const n = {...prev}; if (err) n.phone = err; else delete n.phone; return n; }); } }}
                    onBlur={() => { const err = validatePhone(registerData.phone, true); setRegisterErrors(prev => { const n = {...prev}; if (err) n.phone = err; else delete n.phone; return n; }); }}
                  />
                  {registerErrors.phone && <p className="text-xs text-red-500 mt-1">{registerErrors.phone}</p>}
                </FormField>
              </div>
              <Button onClick={handleRegisterUser} variant="primary">下一步：新增學員</Button>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-xs text-neutral-400">或</span>
                <div className="flex-1 h-px bg-neutral-200" />
              </div>
              <button
                onClick={() => { setIsRegisterOpen(false); window.location.href = getLineLoginUrl(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                style={{ backgroundColor: '#06C755', color: 'white' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                LINE 登入
              </button>
            </div>
          ) : (
            /* === 步驟二：新增學員 === */
            <div className="space-y-4">
              <button onClick={() => setRegisterStep(1)} className="text-sm text-neutral-500 hover:text-neutral-700">&larr; 上一步修改帳號資料</button>

              <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-700">
                帳號：{registerData.name}（{registerData.email}）
              </div>

              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-neutral-700">學員資料</p>
                <button onClick={addStudent} className="text-sm font-medium text-primary hover:text-primary/80">+ 新增學員</button>
              </div>

              {registerData.students.map((student, index) => {
                const age = student.birthDate ? calculateAge(student.birthDate) : null;
                const isAdult = age !== null && age >= 16;
                const bgColor = isAdult ? 'bg-green-50' : 'bg-blue-50';
                const textColor = isAdult ? 'text-green-700' : 'text-blue-700';

                return (
                  <div key={index} className={bgColor + ' rounded-xl p-4 space-y-3'}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className={'text-sm font-bold ' + textColor}>學員 {index + 1}</p>
                        {age !== null && (
                          <span className={'text-xs px-2 py-0.5 rounded-full ' + (isAdult ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600')}>
                            {age} 歲 · {isAdult ? '成人' : '兒童'}
                          </span>
                        )}
                      </div>
                      {registerData.students.length > 1 && (
                        <button onClick={() => removeStudent(index)} className="text-sm text-red-500">移除</button>
                      )}
                    </div>

                    <FormField label="真實姓名">
                      <Input placeholder="請填寫學員真實姓名" value={student.name}
                        className={studentErrors[index]?.name ? 'border-red-400 ring-1 ring-red-200' : ''}
                        onChange={e => { updateStudent(index, 'name', e.target.value); if (studentErrors[index]?.name) { const err = validateName(e.target.value, '學員姓名'); setStudentErrors(prev => { const n = [...prev]; n[index] = {...(n[index] || {})}; if (err) n[index].name = err; else delete n[index].name; return n; }); } }}
                        onBlur={() => { const err = validateName(student.name, '學員姓名'); setStudentErrors(prev => { const n = [...prev]; n[index] = {...(n[index] || {})}; if (err) n[index].name = err; else delete n[index].name; return n; }); }}
                      />
                      {studentErrors[index]?.name && <p className="text-xs text-red-500 mt-1">{studentErrors[index].name}</p>}
                    </FormField>

                    <RegisterDateWheelPicker
                      label="出生日期"
                      value={student.birthDate || '2010-01-01'}
                      onChange={(dateStr) => { updateStudent(index, 'birthDate', dateStr); if (studentErrors[index]?.birthDate) { const err = validateBirthDate(dateStr, true); setStudentErrors(prev => { const n = [...prev]; n[index] = {...(n[index] || {})}; if (err) n[index].birthDate = err; else delete n[index].birthDate; return n; }); } }}
                    />
                    {studentErrors[index]?.birthDate && <p className="text-xs text-red-500 mt-1">{studentErrors[index].birthDate}</p>}
                    <FormField label="性別">
                      <div className="flex gap-1">
                        {['男', '女'].map(g => (
                          <button key={g} type="button" onClick={() => updateStudent(index, 'gender', g)}
                            className={'flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ' + (student.gender === g ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300')}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </FormField>

                    <FormField label="程度">
                      <div className="flex flex-wrap gap-2">
                        {['初學', '有基礎', '進階', '高階', '校隊'].map(l => (
                          <button key={l} type="button" onClick={() => updateStudent(index, 'level', l)}
                            className={'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ' + (student.level === l ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300')}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </FormField>

                    {age !== null && !isAdult && (
                      <FormField label="就讀學校（選填）">
                        <Input placeholder="例如：頭湖國小" value={student.school} onChange={e => updateStudent(index, 'school', e.target.value)} />
                      </FormField>
                    )}
                  </div>
                );
              })}

              <Button onClick={handleRegisterUser} icon={User} variant="primary">完成註冊</Button>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* LINE Bind Modal */}
      <BottomSheet
        isOpen={showLineBindModal}
        onClose={() => setShowLineBindModal(false)}
        title="綁定 LINE 帳號"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 py-4">
            {lineProfile?.pictureUrl && (
              <img src={lineProfile.pictureUrl} className="w-16 h-16 rounded-full" alt="" />
            )}
            <div className="text-center">
              <p className="text-lg font-bold text-neutral-900">{lineProfile?.displayName}</p>
              <p className="text-sm text-neutral-500">首次使用 LINE 登入，請綁定現有帳號</p>
              <p className="text-xs text-neutral-400 mt-1">輸入你註冊時的 Email 和密碼</p>
            </div>
          </div>
          <div className="space-y-4">
            <FormField label="Email">
              <Input placeholder="註冊時的 Email" value={lineBindData.email} onChange={e => setLineBindData({...lineBindData, email: e.target.value})} />
            </FormField>
            <FormField label="密碼">
              <Input type="password" placeholder="密碼" value={lineBindData.password} onChange={e => setLineBindData({...lineBindData, password: e.target.value})} />
            </FormField>
          </div>
          <Button onClick={handleLineBind} variant="primary">確認綁定</Button>
          <p className="text-center text-xs text-neutral-400">
            還沒有帳號？請先<button className="text-primary font-medium" onClick={() => { setShowLineBindModal(false); setIsRegisterOpen(true); }}>註冊</button>，註冊後再用 LINE 登入綁定
          </p>
        </div>
      </BottomSheet>
    </>
  );
}
