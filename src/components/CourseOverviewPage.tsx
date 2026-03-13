import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Clock, MapPin, User, ChevronRight, Info, 
  Users, TrendingUp, BookOpen, DollarSign, Bell, 
  Activity, ArrowUpRight, Filter, ChevronDown
} from 'lucide-react';
import { Course, WaitlistEntry } from '../types';
import { Badge, ProgressBar, Button, Select } from './UI';
import { BottomSheet } from './BottomSheet';
import { WaitlistForm } from './WaitlistForm';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';

const ENROLLMENT_DATA = [
  { name: '10月', students: 120, revenue: 180000 },
  { name: '11月', students: 150, revenue: 225000 },
  { name: '12月', students: 180, revenue: 270000 },
  { name: '1月', students: 210, revenue: 315000 },
  { name: '2月', students: 238, revenue: 357000 },
  { name: '3月', students: 280, revenue: 420000 },
];

const TODAY_SCHEDULE = [
  { time: '10:00', name: '板橋 [江翠國小] 羽球班', coaches: ['張教練', '王教練'], room: '體育館', status: '進行中' },
  { time: '14:00', name: '林口 [頭湖國小] 羽球班', coaches: ['王教練', '陳教練'], room: '體育館', status: '待開始' },
  { time: '19:00', name: '永和 [永平國小] 羽球班', coaches: ['陳教練', '李教練'], room: '體育館', status: '待開始' },
];

export const CourseOverviewPage: React.FC<{
  courses: Course[];
  onRegister: (courseId: string) => void;
  userRole: 'user' | 'admin' | 'student';
  onJoinWaitlist: (entry: Omit<WaitlistEntry, 'id'>) => void;
  userCategory?: 'child' | 'adult' | '';
}> = ({ courses, onRegister, userRole, onJoinWaitlist, userCategory }) => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [waitlistCourse, setWaitlistCourse] = useState<Course | null>(null);
  const [activeFilter, setActiveFilter] = useState('全部');
  const [viewMode, setViewMode] = useState<'dashboard' | 'courses'>(userRole === 'admin' ? 'dashboard' : 'courses');

  // Sync viewMode when userRole changes (e.g. on logout)
  useMemo(() => {
    if (userRole === 'admin') {
      setViewMode('dashboard');
    } else {
      setViewMode('courses');
    }
  }, [userRole]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const filters = ['全部', '兒童班', '成人班', '林口', '板橋', '永和', '中和', '文山', '有名額'];

  const filteredCourses = courses.filter(course => {
    if (activeFilter === '全部') return true;
    if (activeFilter === '有名額') return course.currentEnrollment < course.maxEnrollment;
    if (activeFilter === '兒童班') return course.category === 'children';
    if (activeFilter === '成人班') return course.category === 'adult';
    return course.location.includes(activeFilter);
  });

  const getStatus = (course: Course) => {
    const isFull = course.currentEnrollment >= course.maxEnrollment;
    const ratio = (course.maxEnrollment - course.currentEnrollment) / course.maxEnrollment;
    
    if (isFull) return { 
      label: '名額已滿', 
      variant: 'danger', 
      color: 'bg-danger',
      style: {
        background: '#fef2f2',
        color: '#991b1b',
        border: '1px solid #fca5a5'
      }
    };
    
    if (ratio < 0.2) return { label: '即將額滿', variant: 'danger', color: 'bg-danger' };
    if (ratio < 0.5) return { label: '名額緊張', variant: 'warning', color: 'bg-warning' };
    return { label: '名額充足', variant: 'accent', color: 'bg-accent' };
  };

  const stats = [
    { label: '總學員數', value: '238', icon: Users, color: 'text-primary', bg: 'bg-primary/10', trend: '+12%' },
    { label: '今日課程', value: '3', icon: BookOpen, color: 'text-secondary', bg: 'bg-secondary/10', trend: '穩定' },
    { label: '本月營收', value: 'NT$ 420K', icon: DollarSign, color: 'text-accent', bg: 'bg-accent/10', trend: '+8.5%' },
    { label: '平均出席率', value: '94%', icon: Activity, color: 'text-warning', bg: 'bg-warning/10', trend: '+2%' },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Banner (Only show for users or when not in dashboard) */}
      {viewMode === 'courses' && (
        <div className="px-4">
          <div className="relative h-[140px] bg-gradient-to-br from-primary to-secondary rounded-[24px] p-6 flex flex-col justify-end text-white overflow-hidden shadow-active">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10"
            >
              <h2 className="text-2xl font-bold mb-1">本週開放課程</h2>
              <p className="text-sm opacity-90 mb-3">共 {courses.length} 個班級 · 本月 238 人</p>
              <button className="flex items-center gap-1 text-xs font-semibold bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors">
                立即申請試上 <ChevronRight size={14} />
              </button>
            </motion.div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          </div>
        </div>
      )}

      {viewMode === 'dashboard' ? (
        <div className="flex flex-col gap-8 px-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-5 rounded-card shadow-card border border-neutral-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon size={24} className={stat.color} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-600">{stat.label}</p>
                    <p className="text-xl font-bold text-neutral-900">{stat.value}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    stat.trend.startsWith('+') ? 'bg-accent/10 text-accent' : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    {stat.trend}
                  </span>
                  <TrendingUp size={14} className={stat.trend.startsWith('+') ? 'text-accent' : 'text-neutral-400'} />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Enrollment Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-card shadow-card border border-neutral-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <TrendingUp size={20} className="text-primary" />
                  學員增長趨勢
                </h3>
                <Select className="h-8 text-xs w-32">
                  <option>最近 6 個月</option>
                  <option>最近 12 個月</option>
                </Select>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ENROLLMENT_DATA}>
                    <defs>
                      <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: '#2563EB', strokeWidth: 2 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="students" 
                      stroke="#2563EB" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorStudents)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Today's Schedule */}
            <div className="bg-white p-6 rounded-card shadow-card border border-neutral-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <Calendar size={20} className="text-secondary" />
                  今日課表
                </h3>
                <span className="text-xs font-bold text-primary">查看全部</span>
              </div>
              <div className="space-y-6">
                {TODAY_SCHEDULE.map((item, i) => (
                  <div key={i} className="flex gap-4 relative">
                    {i !== TODAY_SCHEDULE.length - 1 && (
                      <div className="absolute left-[19px] top-10 bottom-[-24px] w-0.5 bg-neutral-100" />
                    )}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                      item.status === '進行中' ? 'bg-primary text-white shadow-active' : 'bg-neutral-100 text-neutral-400'
                    }`}>
                      <Clock size={18} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-400">{item.time}</span>
                        <Badge variant={item.status === '進行中' ? 'accent' : 'neutral'}>{item.status}</Badge>
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900">{item.name}</h4>
                      <div className="flex items-center gap-3 text-xs text-neutral-600">
                        <span className="flex items-center gap-1"><User size={12} /> {item.coaches.join('、')}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {item.room}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-8 h-12 w-full text-sm">
                新增課程安排
              </Button>
            </div>
          </div>

          {/* Quick Actions / Recent Registrations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-card shadow-card border border-neutral-100">
              <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                <Activity size={20} className="text-accent" />
                近期報名
              </h3>
              <div className="space-y-4">
                {[
                  { name: '王小美', course: '成人羽球進階班', time: '2 小時前', type: '體驗試上' },
                  { name: '李大華', course: '青少年羽球基礎班', time: '5 小時前', type: '正式報名' },
                  { name: '張小明', course: '兒童體適能趣味班', time: '1 天前', type: '正式報名' },
                ].map((reg, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 transition-all border border-transparent hover:border-neutral-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold">
                        {reg.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900">{reg.name}</p>
                        <p className="text-xs text-neutral-600">{reg.course}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={reg.type === '體驗試上' ? 'secondary' : 'accent'}>{reg.type}</Badge>
                      <p className="text-[10px] text-neutral-400 mt-1">{reg.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-primary rounded-card p-8 text-white relative overflow-hidden shadow-active">
              <div className="relative z-10 space-y-4">
                <h3 className="text-2xl font-bold">準備好擴展您的課程了嗎？</h3>
                <p className="text-sm opacity-90 max-w-md">
                  目前您的課程平均出席率高達 94%，建議可以考慮在週末新增更多「兒童體適能」班級，以滿足目前的高需求。
                </p>
                <div className="flex gap-3 pt-4">
                  <Button className="bg-white text-primary hover:bg-neutral-100 w-auto px-8">
                    查看建議分析
                  </Button>
                  <Button variant="ghost" className="text-white hover:bg-white/10 w-auto px-6">
                    稍後再說
                  </Button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Filters */}
          <div className="px-4 space-y-3">
            <div className="lg:hidden">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-neutral-100 shadow-sm text-neutral-600 font-bold"
              >
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-primary" />
                  <span>課程篩選：{activeFilter}</span>
                </div>
                <ChevronDown size={18} className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Desktop Filters (Always Visible) */}
            <div className="hidden lg:block">
              <div className="flex flex-row gap-2 overflow-x-auto no-scrollbar pb-2">
                {filters.map(filter => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all text-center ${
                      activeFilter === filter 
                        ? 'bg-primary text-white shadow-active' 
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Filters (Toggleable) */}
            <div className="lg:hidden">
              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2 pb-2">
                      {filters.map(filter => (
                        <button
                          key={filter}
                          onClick={() => {
                            setActiveFilter(filter);
                            setIsFilterOpen(false);
                          }}
                          className={`px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all text-left ${
                            activeFilter === filter 
                              ? 'bg-primary text-white shadow-active' 
                              : 'bg-white text-neutral-600 border border-neutral-100 hover:bg-neutral-200'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Course List */}
          <div className="flex flex-col gap-12 px-4">
            {/* Upcoming Classes */}
            {filteredCourses.some(c => c.tags.includes('招生中')) && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
                  <h2 className="text-xl font-bold text-neutral-900">即將開班</h2>
                  <Badge variant="secondary">尚未開班</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCourses.filter(c => c.tags.includes('招生中')).map((course, index) => {
                    const status = getStatus(course);
                    const isFull = course.currentEnrollment >= course.maxEnrollment;
                    
                    return (
                      <motion.div
                        key={course.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => setSelectedCourse(course)}
                        className="bg-white rounded-card p-5 shadow-card border border-neutral-100 flex flex-col gap-4 active:scale-[0.98] transition-all cursor-pointer hover:shadow-lg"
                      >
                        <div className="flex gap-4">
                          <img 
                            src={course.thumbnail} 
                            alt={course.name} 
                            className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex flex-col justify-between flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={course.category === 'children' ? 'primary' : 'secondary'}>
                                {course.category === 'children' ? '兒童班' : '成人班'}
                              </Badge>
                              {isFull && course.waitlistCount && (
                                <div 
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
                                  style={{
                                    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                                    color: '#92400e',
                                    border: '1px solid #fbbf24',
                                    fontSize: '10px'
                                  }}
                                >
                                  <Clock size={10} /> 候補 {course.waitlistCount} 人
                                </div>
                              )}
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900 leading-tight">{course.name}</h3>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                                <Calendar size={14} className="text-primary" />
                                <span>{course.schedule}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                                <Clock size={14} className="text-primary" />
                                <span>{course.time}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                            <MapPin size={14} className="text-primary" />
                            <span>{course.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                            <User size={14} className="text-primary" />
                            <span>{course.coaches.slice(0, Math.max(1, Math.min(4, Math.ceil(course.currentEnrollment / 6)))).join('、')} 教練</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-neutral-100 space-y-3 mt-auto">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-neutral-600">
                              名額：{course.currentEnrollment} / {course.maxEnrollment} 人
                              {isFull && '（已滿）'}
                            </span>
                            <Badge 
                              variant={status.variant as any}
                              style={status.style}
                            >
                              {status.label}
                            </Badge>
                          </div>
                          <ProgressBar 
                            current={course.currentEnrollment} 
                            max={course.maxEnrollment} 
                            color={isFull ? 'bg-danger' : status.color} 
                          />
                          
                          {isFull && course.waitlistCount && (
                            <div className="space-y-1 mt-2">
                              <p className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                                <Clock size={10} /> 候補中 {course.waitlistCount} 人排隊等待
                              </p>
                              <div className="h-1.5 w-full rounded-full overflow-hidden border border-amber-100" style={{ background: '#fef3c7' }}>
                                <div 
                                  className="h-full rounded-full"
                                  style={{ 
                                    width: '30%', 
                                    background: 'linear-gradient(90deg, #f59e0b, #d97706)' 
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <div className={`flex items-center pt-2 ${isFull ? 'justify-between' : 'justify-end'}`}>
                            <span className="text-sm font-semibold text-primary flex items-center gap-0.5">
                              查看詳情 <ChevronRight size={16} />
                            </span>
                            {isFull && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWaitlistCourse(course);
                                }}
                                className="flex items-center gap-1 font-bold shadow-sm active:scale-95 transition-all"
                                style={{
                                  background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                                  color: '#92400e',
                                  border: '1.5px solid #fbbf24',
                                  borderRadius: '20px',
                                  padding: '5px 14px',
                                  fontSize: '12px'
                                }}
                              >
                                + 加入候補
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ongoing Classes */}
            {filteredCourses.some(c => !c.tags.includes('招生中')) && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-accent pl-4">
                  <h2 className="text-xl font-bold text-neutral-900">已開班</h2>
                  <Badge variant="accent">可直接報名試上</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCourses.filter(c => !c.tags.includes('招生中')).map((course, index) => {
                    const status = getStatus(course);
                    const isFull = course.currentEnrollment >= course.maxEnrollment;
                    
                    return (
                      <motion.div
                        key={course.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => setSelectedCourse(course)}
                        className="bg-white rounded-card p-5 shadow-card border border-neutral-100 flex flex-col gap-4 active:scale-[0.98] transition-all cursor-pointer hover:shadow-lg"
                      >
                        <div className="flex gap-4">
                          <img 
                            src={course.thumbnail} 
                            alt={course.name} 
                            className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex flex-col justify-between flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={course.category === 'children' ? 'primary' : 'secondary'}>
                                {course.category === 'children' ? '兒童班' : '成人班'}
                              </Badge>
                              {isFull && course.waitlistCount && (
                                <div 
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
                                  style={{
                                    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                                    color: '#92400e',
                                    border: '1px solid #fbbf24',
                                    fontSize: '10px'
                                  }}
                                >
                                  <Clock size={10} /> 候補 {course.waitlistCount} 人
                                </div>
                              )}
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900 leading-tight">{course.name}</h3>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                                <Calendar size={14} className="text-primary" />
                                <span>{course.schedule}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                                <Clock size={14} className="text-primary" />
                                <span>{course.time}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                            <MapPin size={14} className="text-primary" />
                            <span>{course.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                            <User size={14} className="text-primary" />
                            <span>{course.coaches.slice(0, Math.max(1, Math.min(4, Math.ceil(course.currentEnrollment / 6)))).join('、')} 教練</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-neutral-100 space-y-3 mt-auto">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-neutral-600">
                              名額：{course.currentEnrollment} / {course.maxEnrollment} 人
                              {isFull && '（已滿）'}
                            </span>
                            <Badge 
                              variant={status.variant as any}
                              style={status.style}
                            >
                              {status.label}
                            </Badge>
                          </div>
                          <ProgressBar 
                            current={course.currentEnrollment} 
                            max={course.maxEnrollment} 
                            color={isFull ? 'bg-danger' : status.color} 
                          />
                          
                          {isFull && course.waitlistCount && (
                            <div className="space-y-1 mt-2">
                              <p className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                                <Clock size={10} /> 候補中 {course.waitlistCount} 人排隊等待
                              </p>
                              <div className="h-1.5 w-full rounded-full overflow-hidden border border-amber-100" style={{ background: '#fef3c7' }}>
                                <div 
                                  className="h-full rounded-full"
                                  style={{ 
                                    width: '30%', 
                                    background: 'linear-gradient(90deg, #f59e0b, #d97706)' 
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <div className={`flex items-center pt-2 ${isFull ? 'justify-between' : 'justify-end'}`}>
                            <span className="text-sm font-semibold text-primary flex items-center gap-0.5">
                              查看詳情 <ChevronRight size={16} />
                            </span>
                            {isFull && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWaitlistCourse(course);
                                }}
                                className="flex items-center gap-1 font-bold shadow-sm active:scale-95 transition-all"
                                style={{
                                  background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                                  color: '#92400e',
                                  border: '1.5px solid #fbbf24',
                                  borderRadius: '20px',
                                  padding: '5px 14px',
                                  fontSize: '12px'
                                }}
                              >
                                + 加入候補
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details Bottom Sheet */}
      <BottomSheet 
        isOpen={!!selectedCourse} 
        onClose={() => setSelectedCourse(null)}
        title={selectedCourse?.name}
      >
        {selectedCourse && (
          <div className="space-y-6">
            <div className="flex gap-2">
              {selectedCourse.tags.map(tag => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-neutral-600 flex items-center gap-1"><Calendar size={12} /> 時間</p>
                  <p className="text-sm font-semibold">{selectedCourse.schedule} {selectedCourse.time}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-neutral-600 flex items-center gap-1"><Clock size={12} /> 時長</p>
                  <p className="text-sm font-semibold">90 分鐘</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-neutral-600 flex items-center gap-1"><Users size={12} /> 名額</p>
                  <p className="text-sm font-semibold">{selectedCourse.currentEnrollment} / {selectedCourse.maxEnrollment} 人</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-xs text-neutral-600 flex items-center gap-1"><MapPin size={12} /> 地點</p>
                  <p className="text-sm font-semibold">{selectedCourse.location}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-xs text-neutral-600 flex items-center gap-1"><User size={12} /> 教練</p>
                  <p className="text-sm font-semibold">
                    {selectedCourse.coaches.slice(0, Math.max(1, Math.min(4, Math.ceil(selectedCourse.currentEnrollment / 6)))).join('、')}
                    （認證教練）
                  </p>
                </div>
              </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
                <Info size={18} className="text-primary" />
                課程說明
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {selectedCourse.description}
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button 
                disabled={selectedCourse.currentEnrollment >= selectedCourse.maxEnrollment}
                onClick={() => {
                  onRegister(selectedCourse.id);
                  setSelectedCourse(null);
                }}
              >
                立即報名（正式）
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  onRegister(selectedCourse.id);
                  setSelectedCourse(null);
                }}
              >
                申請體驗試上
              </Button>
              {selectedCourse.currentEnrollment >= selectedCourse.maxEnrollment && (
                <Button 
                  variant="ghost" 
                  className="text-danger"
                  onClick={() => {
                    setWaitlistCourse(selectedCourse);
                    setSelectedCourse(null);
                  }}
                >
                  加入候補名單
                </Button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Waitlist Bottom Sheet */}
      <BottomSheet 
        isOpen={!!waitlistCourse} 
        onClose={() => setWaitlistCourse(null)}
        title="加入候補名單"
      >
        {waitlistCourse && (
          <WaitlistForm 
            course={waitlistCourse}
            onSubmit={(data) => {
              onJoinWaitlist(data);
              setWaitlistCourse(null);
            }}
            onCancel={() => setWaitlistCourse(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
};

