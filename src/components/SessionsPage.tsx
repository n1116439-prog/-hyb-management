import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Calendar, Clock, MapPin, User, CheckCircle2, AlertCircle, History } from 'lucide-react';
import { Badge, Button, ProgressBar } from './UI';
import { COURSES } from '../constants';
import { WaitlistEntry, Course } from '../types';

interface SessionsPageProps {
  courses: Course[];
  userRole: 'user' | 'admin' | 'student';
  waitlists: WaitlistEntry[];
}

export function SessionsPage({ courses, userRole, waitlists }: SessionsPageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const remaining = 15;

  const getStatusInfo = () => {
    if (remaining <= 10) return { color: 'text-warning', bg: 'bg-warning/5', label: '堂數緊張' };
    return { color: 'text-accent', bg: 'bg-accent/5', label: '堂數充足' };
  };

  const status = getStatusInfo();

  if (userRole === 'user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
          <History size={40} className="text-neutral-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">請登入會員查看我的課程</h2>
        <p className="text-neutral-500 mb-8 text-center">登入後即可查看您的課程明細與候補狀態。</p>
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

  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-6 px-4">
      {/* 堂數總覽 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">我的總堂數</h2>
            <p className="text-sm text-neutral-500 mt-1">目前可用總堂數</p>
          </div>
          <Badge variant={remaining <= 10 ? 'warning' : 'accent'}>{status.label}</Badge>
        </div>

        <div className="flex items-baseline gap-2 mb-8">
          <span className="text-5xl font-black text-neutral-900">{remaining}</span>
          <span className="text-neutral-500 font-medium">堂</span>
        </div>

        <div className="space-y-4">
          <Button 
            className="w-full" 
            onClick={() => alert('購買成功！堂數已更新。')}
          >
            購買堂數
          </Button>
          
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 rounded-xl transition-colors"
          >
            堂數明細 <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-neutral-100">
                <p className="text-xs font-bold text-neutral-900 mb-2">堂數使用明細</p>
                <div className="space-y-3">
                  {[1, 2, 3].map((_, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                          <History size={14} className="text-neutral-500" />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">扣除堂數</p>
                          <p className="text-xs text-neutral-500">2026/03/0{i + 1}</p>
                        </div>
                      </div>
                      <span className="font-bold text-danger">-1</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 候補狀態 */}
      {waitlists.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-l-4 border-warning pl-4">
            <h2 className="text-xl font-bold text-neutral-900">我的候補</h2>
            <Badge variant="warning">等待中</Badge>
          </div>
          <div className="grid gap-4">
            {waitlists.map((entry) => {
              const course = courses.find(c => c.id === entry.courseId);
              if (!course) return null;

              return (
                <div key={entry.id} className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900 mb-1">{course.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>申請日期：2026/03/01</span>
                        <span>•</span>
                        <span>聯絡人：{entry.contactName}</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-2 border-warning text-warning flex items-center justify-center font-bold text-sm bg-warning/5 flex-col leading-tight">
                      <span>候補</span>
                      <span>中</span>
                    </div>
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-4 mb-4">
                    <p className="text-xs font-bold text-neutral-500 mb-2">候補學員 ({entry.students.length})</p>
                    <div className="space-y-2">
                      {entry.students.map((student, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-neutral-100">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-primary" />
                            <span className="font-medium text-sm">{student.name}</span>
                            <span className="text-xs text-neutral-500">({student.age} 歲)</span>
                          </div>
                          <Badge variant="secondary">{student.experience === 'beginner' ? '無基礎' : '已有基礎'}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <div className="text-xs text-neutral-500">
                      候補編號：<br/>#{entry.id}
                    </div>
                    <button className="text-sm font-medium text-neutral-500 hover:text-danger transition-colors">
                      取消候補
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 現有課程 */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
          <h2 className="text-xl font-bold text-neutral-900">現有課程</h2>
          <Badge variant="accent">進行中</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* 課程 1 */}
          <div className="bg-danger/5 rounded-2xl p-5 border border-danger/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-danger/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <Badge variant="accent">已繳費</Badge>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-3">林口 [頭湖國小] 週六 14:00-16:00</h3>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Calendar size={16} className="text-primary" />
                  <span>2026/03/01 - 2026/06/30</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <MapPin size={16} className="text-primary" />
                  <span>頭湖國小體育館</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-danger/10">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">剩餘堂數</p>
                  <p className="text-xl font-bold text-danger">3 堂</p>
                </div>
                <div className="w-12 h-12 rounded-full border-2 border-danger text-danger flex items-center justify-center font-bold text-sm bg-danger/5 flex-col leading-tight">
                  <span>建議補</span>
                  <span>購</span>
                </div>
              </div>
            </div>
          </div>

          {/* 課程 2 */}
          <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <Badge variant="accent">已繳費</Badge>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-3">板橋 [江翠國小] 週六 10:00-12:00</h3>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Calendar size={16} className="text-primary" />
                  <span>2026/03/01 - 2026/06/30</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <MapPin size={16} className="text-primary" />
                  <span>江翠國小體育館</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">剩餘堂數</p>
                  <p className="text-xl font-bold text-neutral-900">12 堂</p>
                </div>
                <div className="w-12 h-12 rounded-full border-2 border-accent text-accent flex items-center justify-center font-bold text-sm bg-accent/5 flex-col leading-tight">
                  <span>堂數充</span>
                  <span>足</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
