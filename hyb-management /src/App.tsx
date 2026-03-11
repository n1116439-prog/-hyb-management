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
import { AdminAttendance } from './components/AdminAttendance';
import { History, LogIn, LogOut, ShieldCheck, User } from 'lucide-react';
import { Button, FormField, Input } from './components/UI';
import { BottomSheet } from './components/BottomSheet';

import { Session, WaitlistEntry, Course, VenueContract } from './types';
import { COURSES, CONTRACTS } from './constants';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [courses, setCourses] = useState<Course[]>(COURSES);
  const [contracts, setContracts] = useState<VenueContract[]>(CONTRACTS);
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
  const [registerData, setRegisterData] = useState({ email: '', account: '', password: '', phone: '' });
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [verifyCode, setVerifyCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);

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

  const handleLogin = () => {
    // Mock login logic
    if (loginMode === 'admin') {
      if (loginStep === 1) {
        if (loginData.account === 'a123' && loginData.password === 'a123') {
          sendVerificationCode();
        } else {
          alert('管理員帳號或密碼錯誤！(提示：a123)');
        }
      } else {
        if (verifyCode === '123456') {
          setUserRole('admin');
          setIsAdminLoggedIn(true);
          setActiveTab('admin-dashboard');
          setIsLoginOpen(false);
          setLoginData({ account: '', password: '' });
          setVerifyCode('');
          setLoginStep(1);
        } else {
          alert('驗證碼錯誤！(提示：123456)');
        }
      }
    } else {
      // Student login logic
      if ((loginData.account === 'a123' && loginData.password === 'a123') || loginData.password === 'user123') {
        setUserRole('student');
        setIsLoginOpen(false);
        setLoginData({ account: '', password: '' });
      } else {
        alert('學員帳號或密碼錯誤！(提示：a123 / a123)');
      }
    }
  };

  const handleRegisterUser = () => {
    if (!registerData.email || !registerData.account || !registerData.password || !registerData.phone) {
      alert('請填寫所有欄位！');
      return;
    }
    alert('註冊成功！請使用新帳號登入。');
    setIsRegisterOpen(false);
    setRegisterData({ email: '', account: '', password: '', phone: '' });
    setLoginMode('student');
    setIsLoginOpen(true);
  };

  const handleLogout = () => {
    setUserRole('user');
    setIsAdminLoggedIn(false);
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
    const avatarUrl = userRole === 'user' 
      ? "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop" // Generic user portrait
      : (userRole === 'admin' || isAdminLoggedIn
          ? "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" 
          : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop");

    return (
      <div className="flex items-center gap-2">
        {activeTab === 'sessions' && (
          <button className="p-2 hover:bg-neutral-100 rounded-full transition-colors hidden sm:block">
            <History size={24} className="text-neutral-600" />
          </button>
        )}
        
        <div className="flex items-center gap-2">
          {userRole === 'user' ? (
            <div className="flex items-center gap-1 mr-1">
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
                className="text-sm font-medium text-white bg-primary hover:bg-primary-hover transition-colors px-3 py-1.5 rounded-lg shadow-sm"
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
              <div className={`hidden sm:block px-2 py-1 rounded text-[10px] font-bold uppercase ${userRole === 'admin' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
                {userRole === 'admin' ? 'Admin' : 'Student'}
              </div>
            </div>
          )}
          
          <button 
            onClick={() => {
              if (userRole === 'user') {
                setLoginMode('student');
                setIsLoginOpen(true);
              } else {
                handleLogout();
              }
            }}
            className="w-10 h-10 rounded-2xl bg-neutral-100 border-2 border-white shadow-sm overflow-hidden transition-all active:scale-95 hover:border-primary/50 group relative"
            title={userRole === 'user' ? '登入' : '登出'}
          >
            <img src={avatarUrl} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {userRole === 'user' ? <LogIn size={16} className="text-white" /> : <LogOut size={16} className="text-white" />}
            </div>
          </button>
        </div>
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
        case 'admin-notifications': return <AdminNotificationCenter />;
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
            onJoinWaitlist={(entry) => setWaitlists(prev => [...prev, { ...entry, id: Math.random().toString(36).substr(2, 9) }])}
          />
        );
      case 'sessions': 
        return <SessionsPage courses={courses} userRole={userRole} waitlists={waitlists} />;
      case 'register': 
        return (
          <RegisterPage 
            courses={courses}
            initialCourseId={selectedCourseId} 
            onComplete={handleComplete} 
            userRole={userRole}
          />
        );
      default: 
        return (
          <CourseOverviewPage 
            courses={courses}
            onRegister={handleRegister} 
            userRole={userRole} 
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
                <FormField label={loginMode === 'admin' ? '管理員帳號' : '學員帳號'}>
                  <Input 
                    placeholder="請輸入帳號" 
                    value={loginData.account}
                    onChange={e => setLoginData({...loginData, account: e.target.value})}
                  />
                </FormField>
                <FormField label="密碼">
                  <Input 
                    type="password" 
                    placeholder={`請輸入密碼 (a123)`}
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
        onClose={() => setIsRegisterOpen(false)}
        title="註冊學員帳號"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
              <User size={32} />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-neutral-900">
                建立新帳號
              </p>
              <p className="text-sm text-neutral-600">
                請填寫以下資訊以完成註冊
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <FormField label="電子信箱">
              <Input 
                type="email"
                placeholder="請輸入電子信箱" 
                value={registerData.email}
                onChange={e => setRegisterData({...registerData, email: e.target.value})}
              />
            </FormField>
            <FormField label="帳號">
              <Input 
                placeholder="請輸入帳號" 
                value={registerData.account}
                onChange={e => setRegisterData({...registerData, account: e.target.value})}
              />
            </FormField>
            <FormField label="密碼">
              <Input 
                type="password" 
                placeholder="請輸入密碼"
                value={registerData.password}
                onChange={e => setRegisterData({...registerData, password: e.target.value})}
              />
            </FormField>
            <FormField label="電話">
              <Input 
                type="tel"
                placeholder="請輸入聯絡電話"
                value={registerData.phone}
                onChange={e => setRegisterData({...registerData, phone: e.target.value})}
              />
            </FormField>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleRegisterUser} 
              icon={User}
              variant="primary"
            >
              完成註冊
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
