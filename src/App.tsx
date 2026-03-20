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
import { LogIn, ShieldCheck, User } from 'lucide-react';
import { Button, FormField, Input } from './components/UI';
import { BottomSheet } from './components/BottomSheet';

import { Session, WaitlistEntry, Course, VenueContract } from './types';
import { supabase } from './lib/supabase';

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
  const [loginMode, setLoginMode] = useState<'admin' | 'student'>('student');
  const [loginData, setLoginData] = useState({ account: '', password: '' });
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    students: [{ name: '', gender: '', birthDate: '', level: '', school: '' }] as {name: string, gender: string, birthDate: string, level: string, school: string}[],
  });
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [registeredStudents, setRegisteredStudents] = useState<{name: string, student_code: string, student_number: string}[]>([]);
  const [showRegistrationResult, setShowRegistrationResult] = useState(false);
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [verifyCode, setVerifyCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userCategory, setUserCategory] = useState<'child' | 'adult' | ''>('');

  useEffect(() => {
    const handleOpenLogin = () => {
      setLoginMode('student');
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

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserRole('student');
        setUserEmail(session.user.email || '');

        // 查詢用戶類型
        const { data: myStudents } = await supabase
          .from('students')
          .select('category')
          .eq('parent_uid', session.user.id);
        if (myStudents && myStudents.length > 0) {
          setUserCategory(myStudents.some(s => s.category === 'adult') ? 'adult' : 'child');
        }
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserRole('user');
        setIsAdminLoggedIn(false);
        setUserEmail('');
      } else if (session) {
        setUserEmail(session.user.email || '');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchCourses = async () => {
    const { data: coursesData } = await supabase
      .from('courses')
      .select('*, coaches(name), venues(name, address)')
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

  const sendVerificationCode = () => {
    setIsSendingCode(true);
    // Simulate sending code
    setTimeout(() => {
      setIsSendingCode(false);
      alert('驗證碼已發送至您的 Gmail 信箱！(提示：123456)');
      setLoginStep(2);
    }, 1000);
  };

  const handleLogin = async () => {
    // 管理員登入判斷：暫時用帳號 a11 判斷
    if (loginMode === 'admin') {
      if (loginData.account === 'a11' && loginData.password === 'a11') {
        // 寫入 user_roles（如果不存在）— 表可能尚未建立，忽略錯誤
        try {
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('id')
            .eq('role', 'super_admin')
            .single();

          if (!existingRole) {
            await supabase.from('user_roles').insert({
              user_id: '00000000-0000-0000-0000-000000000000',
              role: 'super_admin',
              name: 'Admin',
              email: 'admin',
            });
          }
        } catch (e) {
          console.warn('user_roles 表查詢失敗，跳過:', e)
        }

        setUserRole('admin');
        setIsAdminLoggedIn(true);
        setActiveTab('admin-dashboard');
        setUserEmail('admin');
        setIsLoginOpen(false);
        setLoginData({ account: '', password: '' });
        setLoginStep(1);
        return;
      } else {
        alert('管理員帳號或密碼錯誤！');
        return;
      }
    } else {
      // 學員登入：用 email + password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.account,
        password: loginData.password,
      });
      if (error) {
        alert('學員帳號或密碼錯誤！請用註冊時的 Email 和密碼登入。');
        return;
      }
      setUserRole('student');
      setUserEmail(loginData.account);

      // 查詢用戶類型
      const { data: myStudents } = await supabase
        .from('students')
        .select('category')
        .eq('parent_uid', data.user?.id);
      if (myStudents && myStudents.length > 0) {
        setUserCategory(myStudents.some(s => s.category === 'adult') ? 'adult' : 'child');
      }

      setIsLoginOpen(false);
      setLoginData({ account: '', password: '' });
    }
  };

  const addStudent = () => {
    setRegisterData(prev => ({
      ...prev,
      students: [...prev.students, { name: '', gender: '', birthDate: '', level: '', school: '' }]
    }));
  };

  const removeStudent = (index: number) => {
    if (registerData.students.length <= 1) return;
    setRegisterData(prev => ({
      ...prev,
      students: prev.students.filter((_, i) => i !== index)
    }));
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
  };

  const handleRegisterUser = async () => {
    if (registerStep === 1) {
      if (!registerData.name || !registerData.email || !registerData.password || !registerData.phone) {
        alert('請填寫所有欄位！');
        return;
      }
      if (registerData.password.length < 6) {
        alert('密碼至少需要 6 位');
        return;
      }
      setRegisterStep(2);
      return;
    }

    // 步驟二驗證
    if (registerData.students.some(s => !s.name)) {
      alert('請填寫所有學員的姓名！');
      return;
    }
    if (registerData.students.some(s => !s.birthDate)) {
      alert('請填寫所有學員的出生日期！');
      return;
    }

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserRole('user');
    setIsAdminLoggedIn(false);
    setUserCategory('');
    setActiveTab('home');
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
              onClick={() => {
                setLoginMode('student');
                setIsLoginOpen(true);
              }}
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
          setVerifyCode('');
        }}
        title={loginMode === 'admin' ? (loginStep === 1 ? '管理員登入' : 'Gmail 身份驗證') : '學員登入'}
      >
        <div className="space-y-6">
          {loginStep === 1 && (
            <div className="flex bg-neutral-100 p-1 rounded-xl">
              <button 
                onClick={() => setLoginMode('student')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === 'student' ? 'bg-white text-primary shadow-sm' : 'text-neutral-500'}`}
              >
                學員登入
              </button>
              <button 
                onClick={() => setLoginMode('admin')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === 'admin' ? 'bg-white text-danger shadow-sm' : 'text-neutral-500'}`}
              >
                管理員登入
              </button>
            </div>
          )}

          <div className="flex flex-col items-center gap-4 py-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${loginMode === 'admin' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
              <ShieldCheck size={32} />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-neutral-900">
                {loginStep === 1 ? '歡迎回來' : '安全驗證'}
              </p>
              <p className="text-sm text-neutral-600">
                {loginMode === 'admin' 
                  ? (loginStep === 1 ? '請輸入管理員帳號與密碼' : '請輸入發送至您 Gmail 的 6 位數驗證碼') 
                  : '請輸入學員帳號與密碼'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {loginStep === 1 ? (
              <>
                <FormField label={loginMode === 'admin' ? '管理員帳號' : 'Email'}>
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
              <FormField label="Gmail 驗證碼">
                <Input 
                  placeholder="請輸入 6 位數驗證碼 (123456)" 
                  value={verifyCode}
                  maxLength={6}
                  onChange={e => setVerifyCode(e.target.value)}
                />
              </FormField>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleLogin} 
              icon={LogIn}
              loading={isSendingCode}
              variant={loginMode === 'admin' ? 'primary' : 'primary'}
              className={loginMode === 'admin' ? 'bg-danger hover:bg-danger/90' : ''}
            >
              {loginStep === 1 ? '確認登入' : '驗證並登入'}
            </Button>
            
            {loginStep === 2 && (
              <Button 
                variant="ghost" 
                onClick={() => setLoginStep(1)}
                className="text-neutral-500"
              >
                返回上一步
              </Button>
            )}
          </div>
          
          <p className="text-center text-xs text-neutral-400">
            忘記密碼？請聯繫系統管理員
          </p>
        </div>
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
                <Button variant="primary" onClick={() => { resetRegisterForm(); setIsRegisterOpen(false); setLoginMode('student'); setIsLoginOpen(true); }}>前往登入</Button>
                <Button variant="ghost" onClick={() => { resetRegisterForm(); setIsRegisterOpen(false); }}>返回首頁</Button>
              </div>
            </div>
          ) : registerStep === 1 ? (
            /* === 步驟一：帳號資料 === */
            <div className="space-y-4">
              <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                <p className="font-bold text-sm text-neutral-700">帳號資訊</p>
                <FormField label="真實姓名">
                  <Input placeholder="請填寫真實姓名" value={registerData.name} onChange={e => setRegisterData({...registerData, name: e.target.value})} />
                </FormField>
                <FormField label="電子信箱（用於登入）">
                  <Input type="email" placeholder="請輸入 Email" value={registerData.email} onChange={e => setRegisterData({...registerData, email: e.target.value})} />
                </FormField>
                <FormField label="密碼（至少 6 位）">
                  <Input type="password" placeholder="請輸入密碼" value={registerData.password} onChange={e => setRegisterData({...registerData, password: e.target.value})} />
                </FormField>
                <FormField label="聯絡電話">
                  <Input type="tel" placeholder="請輸入手機號碼" value={registerData.phone} onChange={e => setRegisterData({...registerData, phone: e.target.value})} />
                </FormField>
              </div>
              <Button onClick={handleRegisterUser} variant="primary">下一步：新增學員</Button>
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
                      <Input placeholder="請填寫學員真實姓名" value={student.name} onChange={e => updateStudent(index, 'name', e.target.value)} />
                    </FormField>

                    <RegisterDateWheelPicker
                      label="出生日期"
                      value={student.birthDate || '2010-01-01'}
                      onChange={(dateStr) => updateStudent(index, 'birthDate', dateStr)}
                    />
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
    </>
  );
}
