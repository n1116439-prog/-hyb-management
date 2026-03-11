import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, History, ChevronDown, ChevronRight, ShoppingCart, CreditCard, Landmark, Wallet } from 'lucide-react';
import { Session, WaitlistEntry } from '../types';
import { SESSIONS } from '../constants';
import { Badge, Button, useToast, ToastContainer } from './UI';
import { BottomSheet } from './BottomSheet';
import { Clock, MapPin, User as UserIcon } from 'lucide-react';

export const SessionsPage: React.FC<{ 
  userRole?: 'user' | 'admin' | 'student';
  waitlists?: WaitlistEntry[];
}> = ({ userRole, waitlists = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [sessions, setSessions] = useState(SESSIONS);
  const { toasts, showToast } = useToast();

  // Mock: If student is logged in, they are "王小美"
  const studentName = userRole === 'student' ? '王小美' : '';

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.studentName.includes(searchQuery) || session.courseName.includes(searchQuery);
    if (userRole === 'student') {
      return session.studentName === studentName && matchesSearch;
    }
    return matchesSearch;
  });

  const getSessionStatus = (remaining: number) => {
    if (remaining <= 4) return { color: 'text-danger', bg: 'bg-danger/10', label: '建議補購' };
    if (remaining <= 10) return { color: 'text-warning', bg: 'bg-warning/5', label: '堂數緊張' };
    return { color: 'text-accent', bg: 'bg-accent/5', label: '堂數充足' };
  };

  if (userRole === 'user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-6">
        <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400">
          <History size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-neutral-900">請登入會員查看課程管理</h3>
          <p className="text-sm text-neutral-500">登入後即可查看您的課程明細與候補狀態。</p>
        </div>
        <Button 
          variant="primary" 
          className="w-full max-w-xs h-12 rounded-xl shadow-active"
          onClick={() => {
            // This button will trigger the login modal in App.tsx
            // Since we don't have direct access to setIsLoginOpen here, 
            // we can dispatch a custom event or just tell the user to click the login button.
            // But usually, we'd want a smoother experience.
            // For now, let's just show the message as requested.
            window.dispatchEvent(new CustomEvent('open-login'));
          }}
        >
          立即登入
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <ToastContainer toasts={toasts} />
      {userRole === 'student' && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary to-secondary rounded-card p-6 text-white shadow-active relative overflow-hidden"
        >
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-1">早安，{studentName}！</h2>
            <p className="text-xs opacity-90">您目前有 2 門進行中的課程，記得準時上課喔。</p>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        </motion.div>
      )}

      {/* Search Bar */}
      {userRole !== 'student' && (
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="搜尋學員姓名或課程..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-white rounded-xl border border-neutral-100 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          />
        </div>
      )}

      {/* Waitlist Section */}
      {waitlists.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-l-4 border-amber-400 pl-4">
            <h2 className="text-xl font-bold text-neutral-900">我的候補</h2>
            <Badge variant="warning">等待中</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {waitlists.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-card p-6 shadow-card border border-amber-100 flex flex-col gap-4 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-neutral-900">{entry.courseName}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                      <p>申請日期：{entry.date}</p>
                      <span>•</span>
                      <p>聯絡人：{entry.contactName}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="warning" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' }}>
                      候補中
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3 py-2 relative z-10">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">候補學員 ({entry.students.length})</p>
                  <div className="space-y-2">
                    {entry.students.map((student, sIndex) => (
                      <div key={sIndex} className="bg-neutral-50 rounded-xl p-3 space-y-1 border border-neutral-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                            <UserIcon size={12} className="text-amber-600" />
                            <span>{student.name}</span>
                            <span className="text-neutral-400 font-normal">({student.age} 歲)</span>
                          </div>
                          <Badge variant="neutral" className="text-[10px] py-0 px-1.5 bg-white">
                            {student.experience === 'none' ? '完全初學' : student.experience === 'basic' ? '已有基礎' : '進階程度'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 mt-auto relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 font-medium">候補編號：#{entry.id.toUpperCase()}</span>
                    <Button variant="ghost" className="h-8 px-3 text-[10px] text-danger hover:bg-danger/5">
                      取消候補
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Session Section Header */}
      <div className="flex items-center gap-3 border-l-4 border-primary pl-4 mt-4">
        <h2 className="text-xl font-bold text-neutral-900">現有課程</h2>
        <Badge variant="accent">進行中</Badge>
      </div>

      {/* Session Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSessions.map((session, index) => {
          const status = getSessionStatus(session.remaining);
          const isExpanded = expandedDetails === session.id;

          return (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-card p-6 shadow-card border flex flex-col gap-6 transition-all hover:shadow-lg ${session.remaining <= 4 ? 'bg-danger/10 border-danger/30' : 'bg-white border-neutral-100'}`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between mb-1">
                  <Badge 
                    variant={session.paymentStatus === 'paid' ? 'accent' : 'danger'}
                    className={session.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}
                  >
                    {session.paymentStatus === 'paid' ? '已繳費' : '尚未繳費'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                    {session.courseName}
                  </h3>
                  <Badge variant={session.remaining <= 4 ? 'danger' : session.remaining <= 10 ? 'warning' : 'accent'}>
                    {status.label}
                  </Badge>
                </div>
                <p className="text-sm text-neutral-600">
                  {session.studentName} ｜ {session.schedule}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-2 py-6">
                <p className="text-xs font-medium text-neutral-600 uppercase tracking-wider">課程管理</p>
                <div className={`text-6xl font-bold ${status.color}`}>
                  {session.remaining} <span className="text-xl font-medium">堂</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-6 border-t border-neutral-100 mt-auto">
                <div className="flex items-center justify-between text-xs text-neutral-600">
                  <span>已購買 {session.total} 堂 · 已使用 {session.total - session.remaining} 堂</span>
                </div>
                <div className="text-xs text-neutral-600">
                  有效期限：{session.expiryDate}
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="ghost" 
                    className="flex-1 h-10 text-xs"
                    onClick={() => setExpandedDetails(isExpanded ? null : session.id)}
                  >
                    堂數明細 <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                  <Button 
                    variant="primary" 
                    className="flex-1 h-10 text-xs"
                    onClick={() => {
                      setSelectedSession(session);
                      setIsPurchaseOpen(true);
                    }}
                  >
                    立即補購 <ChevronRight size={16} />
                  </Button>
                </div>

                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="overflow-hidden pt-2"
                  >
                    <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-neutral-900 mb-2">堂數使用明細</p>
                      <div className="space-y-3">
                        {[1, 3, 5].map(day => (
                          <div key={day} className="flex items-center justify-between text-xs">
                            <span className="text-neutral-600">2024/10/0{day}（週{day === 1 ? '一' : day === 3 ? '三' : '五'}）</span>
                            <div className="flex items-center gap-2">
                              <span className="text-neutral-900 font-medium">上課</span>
                              <span className="text-danger font-bold">-1 堂</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Purchase Bottom Sheet */}
      <BottomSheet 
        isOpen={isPurchaseOpen} 
        onClose={() => setIsPurchaseOpen(false)}
        title="選擇購買方案"
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            {[
              { count: 10, price: 1800 },
              { count: 20, price: 3000, recommended: true },
              { count: 30, price: 4200 }
            ].map(plan => (
              <button
                key={plan.count}
                onClick={() => setSelectedPlan(plan.count)}
                className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  selectedPlan === plan.count
                    ? 'border-primary bg-primary-light shadow-active'
                    : 'border-neutral-100 bg-white hover:border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    plan.recommended ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    {plan.count}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-neutral-900">{plan.count} 堂</p>
                    <p className="text-xs text-neutral-600">NT$ {plan.price.toLocaleString()}</p>
                  </div>
                </div>
                {plan.count === 20 && (
                  <Badge variant="secondary">最划算</Badge>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold text-neutral-900">付款方式</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'card', icon: CreditCard, label: '信用卡' },
                { id: 'atm', icon: Landmark, label: 'ATM' },
                { id: 'line', icon: Wallet, label: 'LINE Pay' }
              ].map(method => (
                <button
                  key={method.id}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-neutral-100 hover:border-primary hover:bg-primary-light transition-all"
                >
                  <method.icon size={20} className="text-neutral-600" />
                  <span className="text-[10px] font-medium text-neutral-600">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => {
              if (!selectedPlan || !selectedSession) return;
              setSessions(prev => prev.map(s =>
                s.id === selectedSession.id
                  ? { ...s, remaining: s.remaining + selectedPlan, total: s.total + selectedPlan }
                  : s
              ));
              showToast(`購買成功！已加購 ${selectedPlan} 堂`, 'success');
              setIsPurchaseOpen(false);
              setSelectedPlan(null);
            }}
            disabled={!selectedPlan}
            icon={ShoppingCart}
          >
            確認購買
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
};
