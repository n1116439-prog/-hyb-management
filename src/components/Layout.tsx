import React, { useState } from 'react';
import { Home, ClipboardList, PenTool, Search, Menu, X, ChevronLeft, Users, FileText, Bell, LayoutDashboard, UserCheck, DollarSign, Activity, Tag, Settings, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from './UI';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  userRole?: 'user' | 'admin' | 'student';
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  title = "恆躍羽球學院", 
  showBack = false, 
  onBack, 
  rightAction,
  userRole = 'user'
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const studentTabs = [
    { id: 'home', icon: Home, label: '課程班級' },
    { id: 'sessions', icon: ClipboardList, label: '我的課程' },
    { id: 'register', icon: PenTool, label: '立即報名' },
    { id: 'profile', icon: User, label: '個人資料' },
  ];

  const adminTabs = [
    { id: 'admin-dashboard', icon: LayoutDashboard, label: '儀表板' },
    { id: 'admin-courses', icon: ClipboardList, label: '課程管理' },
    { id: 'admin-students', icon: Users, label: '學員管理' },
    { id: 'admin-coaches', icon: UserCheck, label: '教練管理' },
    { id: 'admin-payroll', icon: DollarSign, label: '教練薪資' },
    { id: 'admin-revenue', icon: DollarSign, label: '營收管理' },
    { id: 'admin-attendance', icon: Activity, label: '出席率' },
    { id: 'admin-contracts', icon: FileText, label: '場地合約' },
    { id: 'admin-promo', icon: Tag, label: '優惠碼' },
    { id: 'admin-notifications', icon: Bell, label: '通知中心' },
    { id: 'admin-settings', icon: Settings, label: '設定' },
  ];

  const tabs = userRole === 'admin' ? adminTabs : studentTabs.filter(t => t.id !== 'profile' || userRole !== 'user');

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 relative overflow-x-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:h-20 lg:items-center justify-between py-4 lg:py-0">
          <div className={`flex items-center justify-between w-full lg:w-auto ${isMenuOpen ? 'mb-4' : 'mb-0'} lg:mb-0 transition-all`}>
            <div className="flex items-center gap-3">
              {showBack ? (
                <button onClick={onBack} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <ChevronLeft size={24} className="text-neutral-900" />
                </button>
              ) : (
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 bg-primary/10 rounded-xl lg:cursor-default transition-transform active:scale-95"
                >
                  <div className="lg:hidden">
                    {isMenuOpen ? <X size={24} className="text-primary" /> : <Menu size={24} className="text-primary" />}
                  </div>
                  <div className="hidden lg:block">
                    {userRole === 'admin' ? <LayoutDashboard size={24} className="text-primary" /> : <Home size={24} className="text-primary" />}
                  </div>
                </button>
              )}
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-neutral-900 truncate">
                  {userRole === 'admin' ? '管理後台' : title}
                </h1>
                {userRole === 'admin' && <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Admin</span>}
              </div>
            </div>

            <div className="flex items-center gap-3 lg:hidden">
              {rightAction}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center lg:gap-0 flex-1 min-w-0">
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 flex-nowrap overflow-x-auto min-w-0 flex-1 scrollbar-hide">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all relative whitespace-nowrap ${
                      isActive ? 'text-primary bg-primary/5' : 'text-neutral-500 hover:bg-neutral-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute -bottom-[26px] left-0 right-0 h-1 bg-primary rounded-t-full"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Mobile Navigation - Expanded List */}
            <AnimatePresence>
              {isMenuOpen && (
                <motion.nav
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="lg:hidden flex flex-col gap-1 w-full overflow-hidden"
                >
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          onTabChange(tab.id);
                          setIsMenuOpen(false);
                        }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                          isActive ? 'text-primary bg-primary/5' : 'text-neutral-500 hover:bg-neutral-50'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="font-bold text-sm">{tab.label}</span>
                      </button>
                    );
                  })}
                </motion.nav>
              )}
            </AnimatePresence>

            <div className="h-8 w-px bg-neutral-100 mx-2 hidden lg:block flex-shrink-0" />

            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              {rightAction}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer (Web version usually has a footer) */}
      <footer className="bg-white border-t border-neutral-100 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col items-center md:items-start gap-2">
              <h2 className="text-xl font-bold text-primary">恆躍羽球學院</h2>
              <p className="text-sm text-neutral-600">專業團隊課程管理系統，為您打造最佳運動體驗。</p>
            </div>
            <div className="flex gap-8 text-sm text-neutral-600 font-medium">
              <a href="#" className="hover:text-primary transition-colors">關於我們</a>
              <a href="#" className="hover:text-primary transition-colors">服務條款</a>
              <a href="#" className="hover:text-primary transition-colors">隱私政策</a>
              <a href="#" className="hover:text-primary transition-colors">聯絡我們</a>
            </div>
            <p className="text-xs text-neutral-400">© 2026 恆躍羽球學院. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
