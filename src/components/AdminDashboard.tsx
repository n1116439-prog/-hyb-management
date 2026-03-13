import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Bell, 
  Filter, 
  Clock, 
  MapPin, 
  ChevronRight,
  ArrowUpRight,
  MoreHorizontal
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion } from 'motion/react';
import { Badge, Button } from './UI';
import { supabase } from '../lib/supabase';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStudentsGrowth: 0,
    todayCourses: 0,
    todayCoursesStatus: '載入中',
    monthlyRevenue: 0,
    monthlyRevenueGrowth: 0,
    averageAttendance: 0,
    averageAttendanceTrend: 0,
  })
  const [trendData, setTrendData] = useState<{month: string, count: number}[]>([])
  const [recentRegistrations, setRecentRegistrations] = useState<any[]>([])
  const [todaySchedule, setTodaySchedule] = useState<any[]>([])

  useEffect(() => {
    const fetchDashboard = async () => {
      // 總學員數
      const { count: studentCount } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })

      // 本月營收
      const now = new Date()
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', firstDay)
      const monthlyRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

      // 今日課程（根據今天星期幾）
      const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
      const todayWeekday = weekdays[now.getDay()]
      const { data: todayCourses } = await supabase
        .from('courses')
        .select('*, coaches(name), venues(name)')
        .eq('day_of_week', todayWeekday)

      // 最近報名
      const { data: recentEnrollments } = await supabase
        .from('enrollments')
        .select('*, students(name), courses(name)')
        .order('enrolled_at', { ascending: false })
        .limit(5)

      setStats({
        totalStudents: studentCount || 0,
        totalStudentsGrowth: 0,
        todayCourses: todayCourses?.length || 0,
        todayCoursesStatus: '穩定',
        monthlyRevenue,
        monthlyRevenueGrowth: 0,
        averageAttendance: 0,
        averageAttendanceTrend: 0,
      })

      setTodaySchedule((todayCourses || []).map(c => ({
        id: c.id,
        time: c.start_time?.slice(0, 5) || '',
        name: c.name,
        coaches: c.coaches ? [c.coaches.name] : [],
        location: c.venues?.name || '',
        status: 'pending',
      })))

      setRecentRegistrations((recentEnrollments || []).map(e => ({
        id: e.id,
        name: e.students?.name || '未知',
        course: e.courses?.name || '未知',
        type: 'official',
        time: e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString('zh-TW') : '',
      })))
    }
    fetchDashboard()
  }, [])

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-neutral-100">
            <Button variant="ghost" className="h-auto p-0 text-primary font-bold">儀表板</Button>
            <div className="w-1 h-1 bg-neutral-300 rounded-full" />
            <Button variant="ghost" className="h-auto p-0 text-neutral-400">課程管理</Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-notifications' }))}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-neutral-100 text-neutral-600 relative"
          >
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-danger rounded-full border-2 border-white" />
          </button>
          <button 
            onClick={() => alert('篩選功能開發中')}
            className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-neutral-100 text-primary font-bold"
          >
            <Filter size={18} />
            篩選
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard 
          label="總註冊學員" 
          value="350" 
          growth={15} 
          icon={<Users className="text-primary" size={24} />} 
          onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-students' }))}
        />
        <StatCard 
          label="總學員數" 
          value={stats.totalStudents.toString()} 
          growth={stats.totalStudentsGrowth} 
          icon={<Users className="text-secondary" size={24} />} 
          onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-students' }))}
        />
        <StatCard 
          label="本月營收" 
          value={`NT$ ${stats.monthlyRevenue / 1000}K`} 
          growth={stats.monthlyRevenueGrowth} 
          icon={<DollarSign className="text-emerald-500" size={24} />} 
          onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-revenue' }))}
        />
        <StatCard 
          label="平均出席率" 
          value={`${stats.averageAttendance}%`} 
          growth={stats.averageAttendanceTrend} 
          icon={<TrendingUp className="text-orange-500" size={24} />} 
          onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-attendance' }))}
        />
        <StatCard 
          label="教練管理" 
          value="12" 
          subValue="名教練"
          icon={<Users className="text-indigo-500" size={24} />} 
          onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-coaches' }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-primary" size={20} />
              <h3 className="text-lg font-bold text-neutral-900">學員增長趨勢</h3>
            </div>
            <select className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm font-medium outline-none">
              <option>最近 6 個月</option>
              <option>最近 1 年</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today Schedule */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Calendar className="text-primary" size={20} />
              <h3 className="text-lg font-bold text-neutral-900">今日課表</h3>
            </div>
            <button 
              onClick={() => alert('即將跳轉至完整課表')}
              className="text-sm font-bold text-primary"
            >
              查看全部
            </button>
          </div>
          <div className="space-y-6">
            {todaySchedule.map((item, idx) => (
              <div key={item.id} className="relative pl-8 pb-6 last:pb-0">
                {/* Timeline Line */}
                {idx !== todaySchedule.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-neutral-100" />
                )}
                {/* Timeline Dot */}
                <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${
                  item.status === 'ongoing' ? 'bg-primary' : 'bg-neutral-200'
                }`}>
                  <Clock size={12} className="text-white" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-400">{item.time}</span>
                    <Badge variant={item.status === 'ongoing' ? 'accent' : 'neutral'}>
                      {item.status === 'ongoing' ? '進行中' : '待開始'}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-neutral-900 leading-tight">{item.name}</h4>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <div className="flex items-center gap-1">
                      <Users size={14} />
                      <span>{item.coaches.join('、')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin size={14} />
                      <span>{item.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button 
            variant="outline" 
            className="mt-8 border-primary text-primary rounded-2xl h-12"
            onClick={() => alert('請至課程管理新增課程')}
          >
            新增課程安排
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Registrations */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-primary" size={20} />
              <h3 className="text-lg font-bold text-neutral-900">近期報名</h3>
            </div>
          </div>
          <div className="space-y-6">
            {recentRegistrations.map(reg => (
              <div key={reg.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-neutral-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {reg.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900">{reg.name}</h4>
                    <p className="text-xs text-neutral-500">{reg.course}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={reg.type === 'trial' ? 'secondary' : 'accent'}>
                    {reg.type === 'trial' ? '體驗試上' : '正式報名'}
                  </Badge>
                  <span className="text-[10px] text-neutral-400">{reg.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Suggestion Card */}
        <div className="bg-primary rounded-3xl p-10 text-white relative overflow-hidden shadow-xl shadow-primary/20">
          <div className="relative z-10 space-y-6">
            <h3 className="text-3xl font-bold leading-tight">準備好擴展您的課程了嗎？</h3>
            <p className="text-primary-light text-lg leading-relaxed opacity-90">
              目前您的課程平均出席率高達 94%，建議可以考慮在週末新增更多「兒童體適能」班級，以滿足目前的高需求。
            </p>
            <div className="flex items-center gap-4 pt-4">
              <button 
                onClick={() => alert('已為您規劃新課程建議')}
                className="bg-white text-primary px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-neutral-50 transition-colors"
              >
                立即行動
              </button>
              <button 
                onClick={() => alert('建議已暫存')}
                className="text-white font-bold text-lg hover:underline"
              >
                稍後再說
              </button>
            </div>
          </div>
          {/* Decorative Elements */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -left-20 -top-20 w-60 h-60 bg-white/5 rounded-full blur-2xl" />
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; growth?: number; subValue?: string; icon: React.ReactNode; onClick?: () => void }> = ({ 
  label, value, growth, subValue, icon, onClick 
}) => (
  <motion.div 
    whileHover={{ y: -4 }}
    onClick={onClick}
    className={`bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 flex items-center gap-5 ${onClick ? 'cursor-pointer hover:border-primary/30' : ''}`}
  >
    <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center">
      {icon}
    </div>
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        {growth !== undefined && (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
            +{growth}%
            <ArrowUpRight size={10} />
          </div>
        )}
        {subValue && (
          <div className="px-1.5 py-0.5 rounded-full bg-neutral-50 text-neutral-400 text-[10px] font-bold">
            {subValue}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-neutral-900">{value}</div>
    </div>
  </motion.div>
);
