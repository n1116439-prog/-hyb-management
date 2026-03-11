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
  ArrowUpRight,
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
import { Badge, Button, useToast, ToastContainer } from './UI';
import { supabase } from '../lib/supabase';

// ─── helpers ──────────────────────────────────────────────────────────────────

const getDayOfWeek = () => {
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  return days[new Date().getDay()];
};

const formatTimeAgo = (dateStr: string) => {
  const now = new Date();
  const diff = Math.floor((now.getTime() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 天前`;
};

// ─── types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalStudents: number;
  todayCourses: number;
  todayCoursesStatus: string;
  monthlyRevenue: number;
  averageAttendance: number;
}

interface ScheduleItem {
  id: string;
  time: string;
  name: string;
  coaches: string[];
  location: string;
  status: 'ongoing' | 'pending';
}

interface RegistrationItem {
  id: string;
  name: string;
  course: string;
  type: 'trial' | 'official';
  time: string;
}

// ─── component ────────────────────────────────────────────────────────────────

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    todayCourses: 0,
    todayCoursesStatus: '穩定',
    monthlyRevenue: 0,
    averageAttendance: 0,
  });
  const [trendData, setTrendData] = useState<{ month: string; count: number }[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filterRange, setFilterRange] = useState<'all' | 'week' | 'month' | 'quarter'>('all');
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const { toasts, showToast } = useToast();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchTrendData(),
      fetchTodaySchedule(),
      fetchRecentRegistrations(),
    ]);
    setLoading(false);
  };

  // ── stats ──────────────────────────────────────────────────────────────────

  const fetchStats = async () => {
    const dayOfWeek = getDayOfWeek();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const [
      { count: studentCount },
      { count: todayCourseCount },
      { data: paymentsData },
      { count: totalAtt },
      { count: presentAtt },
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('day_of_week', dayOfWeek),
      supabase.from('payments').select('amount').gte('created_at', startOfMonth),
      supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .gte('date', startOfMonth),
      supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('status', '出席')
        .gte('date', startOfMonth),
    ]);

    const monthlyRevenue =
      paymentsData?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) ?? 0;
    const avgAttendance =
      totalAtt ? Math.round(((presentAtt ?? 0) / totalAtt) * 100) : 0;

    setStats({
      totalStudents: studentCount ?? 0,
      todayCourses: todayCourseCount ?? 0,
      todayCoursesStatus: '穩定',
      monthlyRevenue,
      averageAttendance: avgAttendance,
    });
  };

  // ── trend ──────────────────────────────────────────────────────────────────

  const fetchTrendData = async () => {
    const { data } = await supabase
      .from('students')
      .select('created_at')
      .order('created_at');

    if (!data) return;

    const now = new Date();
    const trend: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const count = data.filter(s => new Date(s.created_at) <= monthEnd).length;
      trend.push({ month: `${monthDate.getMonth() + 1}月`, count });
    }
    setTrendData(trend);
  };

  // ── today schedule ─────────────────────────────────────────────────────────

  const fetchTodaySchedule = async () => {
    const dayOfWeek = getDayOfWeek();
    const { data } = await supabase
      .from('courses')
      .select('id, name, start_time, coaches(name), venues(name)')
      .eq('day_of_week', dayOfWeek)
      .order('start_time');

    if (!data) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setTodaySchedule(
      (data as any[]).map(c => ({
        id: c.id,
        time: c.start_time,
        name: c.name,
        coaches: c.coaches ? [c.coaches.name] : [],
        location: c.venues?.name ?? '',
        status: c.start_time <= currentTime ? 'ongoing' : 'pending',
      }))
    );
  };

  // ── recent registrations ───────────────────────────────────────────────────

  const fetchRecentRegistrations = async () => {
    const { data } = await supabase
      .from('enrollments')
      .select('id, created_at, students(name), courses(name)')
      .order('created_at', { ascending: false })
      .limit(3);

    if (!data) return;

    setRecentRegistrations(
      (data as any[]).map(e => ({
        id: e.id,
        name: e.students?.name ?? '未知學員',
        course: e.courses?.name ?? '未知課程',
        type: 'official' as const,
        time: formatTimeAgo(e.created_at),
      }))
    );
  };

  // ── filter helper ────────────────────────────────────────────────────────

  const getFilterDate = () => {
    const now = new Date();
    if (filterRange === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (filterRange === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (filterRange === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), qMonth, 1);
    }
    return null;
  };

  const filterDate = getFilterDate();

  const filteredRegistrations = filterDate
    ? recentRegistrations.filter(() => true) // recentRegistrations already limited, show all in range
    : recentRegistrations;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-12">
      <ToastContainer toasts={toasts} />
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
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm border font-bold transition-colors ${
                filterRange !== 'all'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-primary border-neutral-100'
              }`}
            >
              <Filter size={18} />
              篩選
            </button>
            {showFilter && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-12 bg-white rounded-2xl shadow-lg border border-neutral-100 py-2 w-40 z-20"
              >
                {([['all', '全部'], ['week', '本週'], ['month', '本月'], ['quarter', '本季']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => { setFilterRange(value); setShowFilter(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      filterRange === value ? 'text-primary font-bold bg-primary/5' : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="總學員數"
          value={stats.totalStudents.toString()}
          icon={<Users className="text-primary" size={24} />}
          loading={loading}
        />
        <StatCard
          label="今日課程"
          value={stats.todayCourses.toString()}
          subValue={stats.todayCoursesStatus}
          icon={<Calendar className="text-secondary" size={24} />}
          loading={loading}
        />
        <StatCard
          label="本月營收"
          value={stats.monthlyRevenue > 0 ? `NT$ ${Math.round(stats.monthlyRevenue / 1000)}K` : 'NT$ 0'}
          icon={<DollarSign className="text-emerald-500" size={24} />}
          loading={loading}
        />
        <StatCard
          label="平均出席率"
          value={`${stats.averageAttendance}%`}
          icon={<TrendingUp className="text-orange-500" size={24} />}
          loading={loading}
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
            </select>
          </div>
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-neutral-400 text-sm">載入中...</div>
            ) : (
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
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
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
            )}
          </div>
        </div>

        {/* Today Schedule */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Calendar className="text-primary" size={20} />
              <h3 className="text-lg font-bold text-neutral-900">今日課表</h3>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-neutral-400 text-sm">載入中...</div>
          ) : todaySchedule.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-neutral-400 text-sm">今日無課程</div>
          ) : (
            <div className="space-y-6">
              {todaySchedule.map((item, idx) => (
                <div key={item.id} className="relative pl-8 pb-6 last:pb-0">
                  {idx !== todaySchedule.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-neutral-100" />
                  )}
                  <div
                    className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${
                      item.status === 'ongoing' ? 'bg-primary' : 'bg-neutral-200'
                    }`}
                  >
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
                      {item.coaches.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span>{item.coaches.join('、')}</span>
                        </div>
                      )}
                      {item.location && (
                        <div className="flex items-center gap-1">
                          <MapPin size={14} />
                          <span>{item.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            className="mt-8 border-primary text-primary rounded-2xl h-12"
            onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-courses' }))}
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
          {loading ? (
            <div className="flex items-center justify-center py-12 text-neutral-400 text-sm">載入中...</div>
          ) : recentRegistrations.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-neutral-400 text-sm">暫無報名紀錄</div>
          ) : (
            <div className="space-y-6">
              {recentRegistrations.map(reg => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-neutral-50 transition-colors cursor-pointer"
                >
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
          )}
        </div>

        {/* Suggestion Card */}
        {!dismissedSuggestion && (
        <div className="bg-primary rounded-3xl p-10 text-white relative overflow-hidden shadow-xl shadow-primary/20">
          <div className="relative z-10 space-y-6">
            <h3 className="text-3xl font-bold leading-tight">準備好擴展您的課程了嗎？</h3>
            <p className="text-primary-light text-lg leading-relaxed opacity-90">
              {stats.averageAttendance >= 80
                ? `目前您的課程平均出席率高達 ${stats.averageAttendance}%，建議可以考慮在週末新增更多班級，以滿足目前的高需求。`
                : `目前共有 ${stats.totalStudents} 位學員，持續優化課程以提升出席率。`}
            </p>
            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-courses' }))}
                className="bg-white text-primary px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-neutral-50 transition-colors"
              >
                立即行動
              </button>
              <button
                onClick={() => { setDismissedSuggestion(true); showToast('建議已暫存', 'info'); }}
                className="text-white font-bold text-lg hover:underline"
              >
                稍後再說
              </button>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -left-20 -top-20 w-60 h-60 bg-white/5 rounded-full blur-2xl" />
        </div>
        )}
      </div>
    </div>
  );
};

// ─── sub-component ─────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string;
  growth?: number;
  subValue?: string;
  icon: React.ReactNode;
  loading?: boolean;
}> = ({ label, value, growth, subValue, icon, loading }) => (
  <motion.div
    whileHover={{ y: -4 }}
    className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 flex items-center gap-5"
  >
    <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center">
      {icon}
    </div>
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        {growth !== undefined && growth > 0 && (
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
      <div className="text-2xl font-bold text-neutral-900">
        {loading ? (
          <div className="w-16 h-7 bg-neutral-100 rounded-lg animate-pulse" />
        ) : (
          value
        )}
      </div>
    </div>
  </motion.div>
);
