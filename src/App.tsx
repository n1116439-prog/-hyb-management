import { useState, useEffect } from 'react';
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
import { LogIn, ShieldCheck, User } from 'lucide-react';
import { Button, FormField, Input } from './components/UI';
import { BottomSheet } from './components/BottomSheet';

import { Session, WaitlistEntry, Course, VenueContract } from './types';
import { supabase } from './lib/supabase';

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
    registerType: '' as '' | 'parent' | 'adult',
    email: '', password: '', phone: '', parentName: '',
    children: [{ name: '', gender: '', birthDate: '', school: '' }],
    adultName: '', adultGender: '', adultBirthDate: '',
  });
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
        // 寫入 user_roles（如果不存在）
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

  const addChild = () => {
    setRegisterData(prev => ({
      ...prev,
      children: [...prev.children, { name: '', gender: '', birthDate: '', school: '' }]
    }));
  };

  const removeChild = (index: number) => {
    if (registerData.children.length <= 1) return;
    setRegisterData(prev => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index)
    }));
  };

  const updateChild = (index: number, field: string, value: string) => {
    setRegisterData(prev => ({
      ...prev,
      children: prev.children.map((c, i) => i === index ? { ...c, [field]: value } : c)
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
    setRegisterData({ registerType: '', email: '', password: '', phone: '', parentName: '', children: [{ name: '', gender: '', birthDate: '', school: '' }], adultName: '', adultGender: '', adultBirthDate: '' });
    setShowRegistrationResult(false);
    setRegisteredStudents([]);
  };

  const handleRegisterUser = async () => {
    if (!registerData.email || !registerData.password || !registerData.phone) {
      alert('請填寫所有欄位！');
      return;
    }

    if (registerData.registerType === 'parent') {
      if (!registerData.parentName) {
        alert('請填寫家長姓名！');
        return;
      }
      if (registerData.children.some(c => !c.name)) {
        alert('請填寫所有小朋友的姓名！');
        return;
      }
    } else if (registerData.registerType === 'adult') {
      if (!registerData.adultName) {
        alert('請填寫您的姓名！');
        return;
      }
    }

    // 0. 檢查 email 是否已有學員紀錄
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('email', registerData.email)
      .limit(1);

    if (existingStudent && existingStudent.length > 0) {
      alert('此 Email 已有註冊紀錄，請直接登入或使用其他 Email');
      return;
    }

    // 1. Supabase Auth 建立帳號
    const displayName = registerData.registerType === 'parent' ? registerData.parentName : registerData.adultName;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: registerData.email,
      password: registerData.password,
      options: {
        data: {
          parentName: displayName,
          phone: registerData.phone,
          registerType: registerData.registerType,
        }
      }
    });

    if (authError) {
      alert('註冊失敗：' + authError.message);
      return;
    }

    const authUid = authData.user?.id;
    console.log('Auth user id:', authUid);

    if (!authUid) {
      alert('註冊失敗：無法取得用戶 ID');
      return;
    }

    const results: {name: string, student_code: string, student_number: string}[] = [];

    // 建立家庭群組
    let familyId = null;
    if (registerData.registerType === 'parent') {
      const { data: familyData } = await supabase
        .from('families')
        .insert({
          parent_auth_uid: authUid,
          parent_name: registerData.parentName,
          phone: registerData.phone,
          email: registerData.email,
        })
        .select('id')
        .single();
      familyId = familyData?.id;
    } else if (registerData.registerType === 'adult') {
      const { data: familyData } = await supabase
        .from('families')
        .insert({
          parent_auth_uid: authUid,
          parent_name: registerData.adultName,
          phone: registerData.phone,
          email: registerData.email,
        })
        .select('id')
        .single();
      familyId = familyData?.id;
    }

    if (registerData.registerType === 'parent') {
      // 2a. 家長模式：依序為每位小朋友建立 student 紀錄（確保連號）
      for (const child of registerData.children) {
        const age = child.birthDate ? calculateAge(child.birthDate) : 0;
        const prefix = age >= 16 ? 'AD' : 'ST';
        const ageType = age >= 16 ? 'adult' : 'child';

        const { data: studentCode } = await supabase
          .rpc('generate_student_code', { p_prefix: prefix });

        const { data: insertedData, error: studentError } = await supabase
          .from('students')
          .insert({
            name: child.name,
            gender: child.gender || null,
            birth_date: child.birthDate || null,
            phone: registerData.phone,
            email: registerData.email,
            emergency_contact: registerData.parentName,
            emergency_phone: registerData.phone,
            parent_uid: authUid,
            family_id: familyId,
            notes: [
              child.school ? `學校: ${child.school}` : '',
            ].filter(Boolean).join('；'),
            student_code: studentCode,
            age_type: ageType,
            category: ageType === 'adult' ? 'adult' : 'child',
          })
          .select('id')
          .single();

        if (studentError) {
          console.error('學員建立失敗:', studentError);
          alert('學員資料建立失敗：' + studentError.message);
          return;
        }

        // 重新查詢以取得 trigger 產生的 student_number
        if (insertedData) {
          const { data: studentWithNumber } = await supabase
            .from('students')
            .select('name, student_code, student_number')
            .eq('id', insertedData.id)
            .single();
          console.log('學員編號:', studentWithNumber);
          if (studentWithNumber) results.push(studentWithNumber);
        }
      }
    } else {
      // 2b. 成人模式：建立一筆成人 student 紀錄
      const age = registerData.adultBirthDate ? calculateAge(registerData.adultBirthDate) : 18;
      const prefix = age >= 16 ? 'AD' : 'ST';
      const ageType = age >= 16 ? 'adult' : 'child';

      const { data: studentCode } = await supabase
        .rpc('generate_student_code', { p_prefix: prefix });

      const { data: insertedData, error: studentError } = await supabase
        .from('students')
        .insert({
          name: registerData.adultName,
          gender: registerData.adultGender || null,
          birth_date: registerData.adultBirthDate || null,
          phone: registerData.phone,
          email: registerData.email,
          emergency_contact: registerData.adultName,
          emergency_phone: registerData.phone,
          parent_uid: authUid,
          family_id: familyId,
          student_code: studentCode,
          age_type: ageType,
          category: 'adult',
        })
        .select('id')
        .single();

      if (studentError) {
        console.error('學員建立失敗:', studentError);
        alert('學員資料建立失敗：' + studentError.message);
        return;
      }

      // 重新查詢以取得 trigger 產生的 student_number
      if (insertedData) {
        const { data: studentWithNumber } = await supabase
          .from('students')
          .select('name, student_number')
          .eq('id', insertedData.id)
          .single();
        console.log('學員編號:', studentWithNumber);
        if (studentWithNumber) results.push(studentWithNumber);
      }
    }

    // 3. 寫入 user_roles
    await supabase.from('user_roles').insert({
      user_id: authUid,
      role: 'parent',
      name: registerData.registerType === 'parent' ? registerData.parentName : registerData.adultName,
      email: registerData.email,
      phone: registerData.phone,
    });

    // 4. 顯示結果
    console.log('註冊回傳的學員資料:', results);
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
        title="註冊學員帳號"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
              <User size={32} />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-neutral-900">建立新帳號</p>
              <p className="text-sm text-neutral-600">
                {!registerData.registerType
                  ? '請選擇您的身分'
                  : registerData.registerType === 'parent'
                    ? '請填寫家長資訊及小朋友資料'
                    : '請填寫您的個人資料'}
              </p>
            </div>
          </div>

          {showRegistrationResult ? (
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
                      {(student.student_code || student.student_number || '')?.startsWith('AD') ? '成人學員' : '兒童學員'}
                    </p>
                  </div>
                  <div className="bg-primary/10 px-4 py-2 rounded-lg">
                    <p className="font-bold text-primary text-xl">{student.student_code || student.student_number || '產生中...'}</p>
                  </div>
                </div>
              ))}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-amber-800 text-sm text-center">
                  學員編號為報名及管理的唯一識別碼，請妥善保存。
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    resetRegisterForm();
                    setIsRegisterOpen(false);
                    setLoginMode('student');
                    setIsLoginOpen(true);
                  }}
                >
                  前往登入
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    resetRegisterForm();
                    setIsRegisterOpen(false);
                  }}
                >
                  返回首頁
                </Button>
              </div>
            </div>
          ) : !registerData.registerType ? (
            /* 身分選擇 */
            <div className="space-y-4">
              <button
                onClick={() => setRegisterData({...registerData, registerType: 'parent'})}
                className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-2xl p-5 text-left transition-colors"
              >
                <p className="font-bold text-blue-900 text-lg">我是家長</p>
                <p className="text-blue-600 text-sm mt-1">幫小朋友註冊學員帳號</p>
              </button>
              <button
                onClick={() => setRegisterData({...registerData, registerType: 'adult'})}
                className="w-full bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-2xl p-5 text-left transition-colors"
              >
                <p className="font-bold text-green-900 text-lg">我是成人學員</p>
                <p className="text-green-600 text-sm mt-1">自己註冊學員帳號</p>
              </button>
            </div>
          ) : registerData.registerType === 'parent' ? (
            /* 家長模式 */
            <div className="space-y-4">
              <button
                onClick={() => setRegisterData({...registerData, registerType: ''})}
                className="text-sm text-neutral-500 hover:text-neutral-700"
              >
                &larr; 重新選擇身分
              </button>

              <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                <p className="font-bold text-sm text-neutral-700">家長資訊</p>
                <FormField label="家長姓名">
                  <Input
                    placeholder="請輸入家長姓名"
                    value={registerData.parentName}
                    onChange={e => setRegisterData({...registerData, parentName: e.target.value})}
                  />
                </FormField>
                <FormField label="電子信箱">
                  <Input
                    type="email"
                    placeholder="請輸入 Email（用於登入）"
                    value={registerData.email}
                    onChange={e => setRegisterData({...registerData, email: e.target.value})}
                  />
                </FormField>
                <FormField label="密碼">
                  <Input
                    type="password"
                    placeholder="請輸入密碼（至少6位）"
                    value={registerData.password}
                    onChange={e => setRegisterData({...registerData, password: e.target.value})}
                  />
                </FormField>
                <FormField label="聯絡電話">
                  <Input
                    type="tel"
                    placeholder="請輸入聯絡電話"
                    value={registerData.phone}
                    onChange={e => setRegisterData({...registerData, phone: e.target.value})}
                  />
                </FormField>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-neutral-700">學員資料（小朋友）</p>
                  <button
                    onClick={addChild}
                    className="text-sm font-medium text-primary hover:text-primary/80"
                  >
                    + 新增學員
                  </button>
                </div>

                {registerData.children.map((child, index) => (
                  <div key={index} className="bg-blue-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-primary">學員 {index + 1}</p>
                      {registerData.children.length > 1 && (
                        <button onClick={() => removeChild(index)} className="text-sm text-red-500">移除</button>
                      )}
                    </div>
                    <FormField label="姓名">
                      <Input placeholder="小朋友姓名" value={child.name} onChange={e => updateChild(index, 'name', e.target.value)} />
                    </FormField>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <FormField label="性別">
                          <div className="flex gap-2">
                            {['男', '女', '不公開'].map(g => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => updateChild(index, 'gender', g)}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                                  child.gender === g ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400'
                                }`}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        </FormField>
                      </div>
                      <div className="flex-1">
                        <FormField label="出生日期">
                          <Input type="date" value={child.birthDate} onChange={e => updateChild(index, 'birthDate', e.target.value)} />
                        </FormField>
                      </div>
                    </div>
                    <FormField label="就讀學校">
                      <Input placeholder="例如：頭湖國小" value={child.school} onChange={e => updateChild(index, 'school', e.target.value)} />
                    </FormField>
                  </div>
                ))}
              </div>

              <Button onClick={handleRegisterUser} icon={User} variant="primary">
                完成註冊
              </Button>
            </div>
          ) : (
            /* 成人模式 */
            <div className="space-y-4">
              <button
                onClick={() => setRegisterData({...registerData, registerType: ''})}
                className="text-sm text-neutral-500 hover:text-neutral-700"
              >
                &larr; 重新選擇身分
              </button>

              <div className="bg-green-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-green-700">學員資料</p>
                <FormField label="姓名">
                  <Input
                    placeholder="請輸入姓名"
                    value={registerData.adultName}
                    onChange={e => setRegisterData({...registerData, adultName: e.target.value})}
                  />
                </FormField>
                <FormField label="性別">
                  <div className="flex gap-2">
                    {['男', '女', '不公開'].map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setRegisterData({...registerData, adultGender: g})}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          registerData.adultGender === g ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </FormField>
                <FormField label="出生日期（選填）">
                  <Input
                    type="date"
                    value={registerData.adultBirthDate}
                    onChange={e => setRegisterData({...registerData, adultBirthDate: e.target.value})}
                  />
                </FormField>
              </div>

              <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                <p className="font-bold text-sm text-neutral-700">帳號資訊</p>
                <FormField label="電子信箱">
                  <Input
                    type="email"
                    placeholder="請輸入 Email（用於登入）"
                    value={registerData.email}
                    onChange={e => setRegisterData({...registerData, email: e.target.value})}
                  />
                </FormField>
                <FormField label="密碼">
                  <Input
                    type="password"
                    placeholder="請輸入密碼（至少6位）"
                    value={registerData.password}
                    onChange={e => setRegisterData({...registerData, password: e.target.value})}
                  />
                </FormField>
                <FormField label="聯絡電話">
                  <Input
                    type="tel"
                    placeholder="請輸入聯絡電話"
                    value={registerData.phone}
                    onChange={e => setRegisterData({...registerData, phone: e.target.value})}
                  />
                </FormField>
              </div>

              <Button onClick={handleRegisterUser} icon={User} variant="primary">
                完成註冊
              </Button>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
