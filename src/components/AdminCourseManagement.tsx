import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, Edit2, Trash2, Check, ChevronRight, ChevronLeft,
  Upload, MapPin, Clock, Users, Calendar, UserPlus, UserMinus,
  History as HistoryIcon, Settings, X, AlertCircle, Pause, Play,
  CalendarX, CalendarPlus, RefreshCw, ClipboardList, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Input, Select, Badge, ProgressBar, FormField } from './UI';
import { supabase } from '../lib/supabase';
import { generateAttendanceRecords, batchCreateAttendanceForDate, batchDeletePendingAttendanceForDate, generateCourseDatesFromContract } from '../lib/attendanceUtils';
import { addCourseChangeLog } from '../lib/courseChangeLog';
import { Course, CourseChangeLog, VenueContract } from '../types';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

interface AdminCourseManagementProps {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  contracts: VenueContract[];
}

const PRICING_PLANS = [
  { id: 'trial', name: '試上課程', sessions: 1, pricePerSession: 600 },
  { id: '8sessions', name: '彈性選擇方案', sessions: 8, pricePerSession: 765 },
  { id: '12sessions', name: '新生首選方案', sessions: 12, pricePerSession: 650 },
  { id: '15sessions', name: '穩步學習方案', sessions: 15, pricePerSession: 720 },
  { id: '25sessions', name: '高效進階方案', sessions: 25, pricePerSession: 675 },
  { id: '50sessions', name: '完整培訓方案', sessions: 50, pricePerSession: 630 },
];

// ============================================================
// Tab Component: 課程日期
// ============================================================
const CourseDatesTab: React.FC<{
  courseId: string;
  courseName: string;
  dayOfWeek: string;
}> = ({ courseId, courseName, dayOfWeek }) => {
  const [loading, setLoading] = useState(true);
  const [allDates, setAllDates] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, { total: number; present: number; absent: number; pending: number }>>({});
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [contractInfo, setContractInfo] = useState<{ start: string; end: string } | null>(null);
  const [processingDate, setProcessingDate] = useState<string | null>(null);
  const [showAddDatePicker, setShowAddDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);

    // 1. 產生合約日期
    const contractDates: string[] = [];
    const result = await generateCourseDatesFromContract(courseId);
    if (result) {
      contractDates.push(...result.dates);
      setContractInfo({ start: result.contractStart, end: result.contractEnd });
    } else {
      setContractInfo(null);
    }

    // 2. 取得停課日
    const { data: holidayData } = await supabase
      .from('course_holidays')
      .select('date')
      .eq('course_id', courseId);
    setHolidays(new Set((holidayData || []).map(h => h.date)));

    // 3. 取得已報名人數
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('course_id', courseId)
      .eq('status', '已報名');
    setEnrolledCount(enrollments?.length || 0);

    // 4. 統計每日 attendance（同時收集所有已存在的日期）
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('date, status')
      .eq('course_id', courseId);

    const counts: Record<string, { total: number; present: number; absent: number; pending: number }> = {};
    const attendanceDateSet = new Set<string>();
    (attendanceData || []).forEach(a => {
      attendanceDateSet.add(a.date);
      if (!counts[a.date]) counts[a.date] = { total: 0, present: 0, absent: 0, pending: 0 };
      counts[a.date].total++;
      if (a.status === '出席') counts[a.date].present++;
      else if (a.status === '缺席') counts[a.date].absent++;
      else if (a.status === '待上課') counts[a.date].pending++;
    });
    setAttendanceCounts(counts);

    // 5. 合併：合約日期 + attendance 中存在但不在合約中的日期（手動新增的、合約外的）
    //    確保現有資料不會流失
    const mergedDateSet = new Set([...contractDates, ...attendanceDateSet]);
    // 也加入 holidays 中的日期（停課日可能還沒有 attendance 記錄）
    (holidayData || []).forEach(h => mergedDateSet.add(h.date));
    const mergedDates = Array.from(mergedDateSet).sort();
    setAllDates(mergedDates);

    setLoading(false);
  }, [courseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleHoliday = async (date: string) => {
    setProcessingDate(date);
    const isCurrentlyHoliday = holidays.has(date);

    if (isCurrentlyHoliday) {
      // 取消停課 → 刪除 holiday + 批次建立 attendance
      await supabase.from('course_holidays').delete()
        .eq('course_id', courseId)
        .eq('date', date);

      const created = await batchCreateAttendanceForDate(courseId, date);

      await addCourseChangeLog(courseId, 'holiday_unset', {
        date,
        count: created,
        reason: '取消停課，已為所有學員建立待上課記錄',
      });

      setHolidays(prev => {
        const next = new Set(prev);
        next.delete(date);
        return next;
      });
    } else {
      // 設定停課 → 新增 holiday + 批次刪除待上課 attendance
      await supabase.from('course_holidays').insert({
        course_id: courseId,
        date,
      });

      const deleted = await batchDeletePendingAttendanceForDate(courseId, date);

      await addCourseChangeLog(courseId, 'holiday_set', {
        date,
        count: deleted,
        reason: '設定停課，已刪除所有學員待上課記錄',
      });

      setHolidays(prev => new Set(prev).add(date));
    }

    // 重新取得 attendance counts
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('date, status')
      .eq('course_id', courseId);
    const counts: Record<string, { total: number; present: number; absent: number; pending: number }> = {};
    (attendanceData || []).forEach(a => {
      if (!counts[a.date]) counts[a.date] = { total: 0, present: 0, absent: 0, pending: 0 };
      counts[a.date].total++;
      if (a.status === '出席') counts[a.date].present++;
      else if (a.status === '缺席') counts[a.date].absent++;
      else if (a.status === '待上課') counts[a.date].pending++;
    });
    setAttendanceCounts(counts);

    setProcessingDate(null);
  };

  const handleAddExtraDate = async () => {
    if (!customDate) return;
    if (allDates.includes(customDate)) {
      alert('此日期已存在');
      return;
    }

    setProcessingDate(customDate);

    // 批次為所有學員建立 attendance
    const created = await batchCreateAttendanceForDate(courseId, customDate);

    await addCourseChangeLog(courseId, 'date_added', {
      date: customDate,
      count: created,
      reason: '手動新增上課日',
    });

    setAllDates(prev => [...prev, customDate].sort());
    setShowAddDatePicker(false);
    setCustomDate('');
    await fetchData();
    setProcessingDate(null);
  };

  const handleRemoveDate = async (date: string) => {
    if (!confirm(`確定要移除 ${date} 這個上課日嗎？\n將刪除所有學員該日的待上課記錄。`)) return;

    setProcessingDate(date);

    const deleted = await batchDeletePendingAttendanceForDate(courseId, date);

    // 如果是停課日也一併刪除
    await supabase.from('course_holidays').delete()
      .eq('course_id', courseId)
      .eq('date', date);

    await addCourseChangeLog(courseId, 'date_removed', {
      date,
      count: deleted,
      reason: '移除上課日',
    });

    setAllDates(prev => prev.filter(d => d !== date));
    setHolidays(prev => {
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
    await fetchData();
    setProcessingDate(null);
  };

  const today = formatLocalDate(new Date());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="animate-spin text-primary" size={24} />
        <span className="ml-3 text-neutral-500">載入課程日期...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 text-primary">
            <Calendar size={16} />
            <span className="text-sm font-bold">
              共 {allDates.length} 個上課日
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-700">
            <Pause size={16} />
            <span className="text-sm font-bold">
              {holidays.size} 個停課日
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 text-neutral-600">
            <Users size={16} />
            <span className="text-sm font-bold">
              {enrolledCount} 名學員
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowAddDatePicker(!showAddDatePicker)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <CalendarPlus size={16} />
          新增日期
        </button>
      </div>

      {/* Contract Info */}
      {contractInfo && (
        <div className="text-xs text-neutral-500 px-1">
          合約期間：{contractInfo.start} ~ {contractInfo.end} · 每{dayOfWeek}上課
        </div>
      )}

      {/* Add Date Picker */}
      {showAddDatePicker && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
          <input
            type="date"
            value={customDate}
            onChange={e => setCustomDate(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-xl text-sm"
          />
          <button
            onClick={handleAddExtraDate}
            disabled={!customDate}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            確認新增
          </button>
          <button
            onClick={() => { setShowAddDatePicker(false); setCustomDate(''); }}
            className="px-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium"
          >
            取消
          </button>
        </div>
      )}

      {/* Dates List */}
      <div className="rounded-2xl border border-neutral-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100">
              <th className="px-5 py-3 text-xs font-bold text-neutral-400 w-8">#</th>
              <th className="px-5 py-3 text-xs font-bold text-neutral-400">日期</th>
              <th className="px-5 py-3 text-xs font-bold text-neutral-400">狀態</th>
              <th className="px-5 py-3 text-xs font-bold text-neutral-400">出席統計</th>
              <th className="px-5 py-3 text-xs font-bold text-neutral-400 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {allDates.map((date, idx) => {
              const isHoliday = holidays.has(date);
              const isPast = date < today;
              const isToday = date === today;
              const counts = attendanceCounts[date];
              const isProcessing = processingDate === date;
              const d = new Date(date + 'T00:00:00');
              const dayName = DAY_NAMES[d.getDay()];

              return (
                <tr
                  key={date}
                  className={`transition-colors ${
                    isHoliday ? 'bg-amber-50/50' :
                    isToday ? 'bg-blue-50/50' :
                    isPast ? 'bg-neutral-50/30' :
                    'hover:bg-neutral-50/50'
                  }`}
                >
                  <td className="px-5 py-3">
                    <span className="text-xs text-neutral-400">{idx + 1}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isHoliday ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>
                        {date}
                      </span>
                      <span className="text-xs text-neutral-400">({dayName})</span>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">今天</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {isHoliday ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                        <CalendarX size={12} /> 停課
                      </span>
                    ) : isPast ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-500">
                        已結束
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        <Play size={12} /> 正常
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {isHoliday ? (
                      <span className="text-xs text-neutral-400">—</span>
                    ) : counts ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-xs text-neutral-600">{counts.present}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-xs text-neutral-600">{counts.absent}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-neutral-300" />
                          <span className="text-xs text-neutral-600">{counts.pending}</span>
                        </div>
                        <span className="text-[10px] text-neutral-400">
                          / {enrolledCount} 人
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">
                        0 / {enrolledCount} 人
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isProcessing ? (
                        <RefreshCw className="animate-spin text-neutral-400" size={14} />
                      ) : (
                        <>
                          <button
                            onClick={() => handleToggleHoliday(date)}
                            title={isHoliday ? '取消停課' : '標記停課'}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                              isHoliday
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-amber-600 hover:bg-amber-50'
                            }`}
                          >
                            {isHoliday ? <Play size={14} /> : <Pause size={14} />}
                          </button>
                          {!isPast && (
                            <button
                              onClick={() => handleRemoveDate(date)}
                              title="移除日期"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {allDates.length === 0 && (
          <div className="py-12 text-center">
            <AlertCircle className="mx-auto mb-3 text-neutral-300" size={32} />
            <p className="text-sm text-neutral-500">未找到上課日期</p>
            <p className="text-xs text-neutral-400 mt-1">
              {contractInfo
                ? '合約期間內沒有匹配的上課星期'
                : '此課程未關聯場地合約，且尚無任何出席記錄。可手動新增日期。'}
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-[10px] text-neutral-400 px-1">
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> 出席</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> 缺席</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-neutral-300" /> 待上課</span>
      </div>
    </div>
  );
};

// ============================================================
// Tab Component: 學員名單（緊湊表格式）
// ============================================================
const CourseStudentsTab: React.FC<{
  courseId: string;
  courseName: string;
  allStudents: any[];
  onRefresh: () => void;
  onImportClick: () => void;
}> = ({ courseId, courseName, allStudents, onRefresh, onImportClick }) => {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enrollments')
      .select('id, student_id, status, enrolled_at, students(id, name, student_code, phone, category), courses(name)')
      .eq('course_id', courseId)
      .eq('status', '已報名')
      .order('enrolled_at', { ascending: false });
    setEnrollments(data || []);
    setLoading(false);
  }, [courseId]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  const handleWithdraw = async (enrollment: any) => {
    const studentName = (enrollment.students as any)?.name || '學員';
    if (!confirm(`確定要將「${studentName}」退出「${courseName}」嗎？\n堂數不會扣除，但待上課日期會被刪除。`)) return;

    await supabase.from('enrollments').update({
      status: '已退出',
      withdrawn_at: new Date().toISOString(),
    }).eq('id', enrollment.id);

    await supabase.from('attendance').delete()
      .eq('student_id', enrollment.student_id)
      .eq('course_id', courseId)
      .eq('status', '待上課');

    await addCourseChangeLog(courseId, 'student_withdrawn', {
      student_name: studentName,
      student_id: enrollment.student_id,
    });

    fetchEnrollments();
    onRefresh();
  };

  // 取得每個學員的 credits 統計
  const [creditsMap, setCreditsMap] = useState<Record<string, { remaining: number; total: number }>>({});

  useEffect(() => {
    const fetchCredits = async () => {
      const studentIds = enrollments.map(e => e.student_id).filter(Boolean);
      if (studentIds.length === 0) return;

      const { data } = await supabase
        .from('credits')
        .select('student_id, total_credits, used_credits, remaining_credits')
        .in('student_id', studentIds);

      const map: Record<string, { remaining: number; total: number }> = {};
      (data || []).forEach((c: any) => {
        if (!map[c.student_id]) {
          map[c.student_id] = { remaining: 0, total: 0 };
        }
        map[c.student_id].remaining += c.remaining_credits || 0;
        map[c.student_id].total += c.total_credits || 0;
      });
      setCreditsMap(map);
    };
    fetchCredits();
  }, [enrollments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-neutral-900">
          學員名單 <span className="text-primary">({enrollments.length})</span>
        </h3>
        <button
          onClick={onImportClick}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <UserPlus size={16} />
          匯入學員
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100">
              <th className="px-4 py-3 text-xs font-bold text-neutral-400">學員編號</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-400">姓名</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-400">類別</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-400">聯絡電話</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-400">剩餘堂數</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-400">報名時間</th>
              <th className="px-4 py-3 text-xs font-bold text-neutral-400 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {enrollments.map(enrollment => {
              const student = enrollment.students as any;
              if (!student) return null;
              const credit = creditsMap[student.id];

              return (
                <tr key={enrollment.id} className="hover:bg-neutral-50/50 transition-colors group">
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-bold ${
                      student.student_code?.startsWith('ST') ? 'text-blue-600' : 'text-green-600'
                    }`}>
                      {student.student_code || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {student.name?.[0]}
                      </div>
                      <span className="text-sm font-medium text-neutral-900">{student.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      student.category === 'adult' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {student.category === 'adult' ? '成人' : '兒童'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-neutral-500">{student.phone || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {credit ? (
                      <span className={`text-sm font-bold ${credit.remaining <= 3 && credit.total > 0 ? 'text-red-500' : 'text-neutral-900'}`}>
                        {credit.remaining} <span className="text-xs font-normal text-neutral-400">/ {credit.total}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-neutral-400">
                      {enrollment.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleDateString() : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleWithdraw(enrollment)}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      退出班級
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {enrollments.length === 0 && (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-3 text-neutral-300" size={32} />
            <p className="text-sm text-neutral-500">尚未有學員報名此課程</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Tab Component: 教練管理（讀寫 DB）
// ============================================================
const CourseCoachesTab: React.FC<{
  courseId: string;
  coachList: { id: string; name: string; specialization: string }[];
  onRefresh: () => void;
}> = ({ courseId, coachList, onRefresh }) => {
  const [assignedCoaches, setAssignedCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCoach, setShowAddCoach] = useState(false);

  const fetchAssignedCoaches = useCallback(async () => {
    setLoading(true);
    // courses 表目前是 coach_id 單一教練，未來可能改多對多
    // 先查 course 的 coach_id，再從 course_coaches 表查（如果有的話）
    const { data: course } = await supabase
      .from('courses')
      .select('coach_id, coaches(id, name, specialization)')
      .eq('id', courseId)
      .single();

    // 嘗試查 course_coaches 多對多表
    const { data: multiCoaches } = await supabase
      .from('course_coaches')
      .select('coach_id, coaches(id, name, specialization)')
      .eq('course_id', courseId);

    if (multiCoaches && multiCoaches.length > 0) {
      setAssignedCoaches(multiCoaches.map((mc: any) => mc.coaches).filter(Boolean));
    } else if (course?.coaches) {
      // fallback: 單一 coach_id
      setAssignedCoaches([course.coaches]);
    } else {
      setAssignedCoaches([]);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => { fetchAssignedCoaches(); }, [fetchAssignedCoaches]);

  const handleAddCoach = async (coachId: string) => {
    const coach = coachList.find(c => c.id === coachId);
    if (!coach) return;

    // 先嘗試寫入 course_coaches 多對多表
    const { error: multiError } = await supabase
      .from('course_coaches')
      .insert({ course_id: courseId, coach_id: coachId });

    if (multiError) {
      // 如果 course_coaches 表不存在，fallback 到 courses.coach_id
      console.log('course_coaches 表不存在或寫入失敗，fallback 到 coach_id:', multiError.message);
      await supabase.from('courses').update({ coach_id: coachId }).eq('id', courseId);
    }

    await addCourseChangeLog(courseId, 'coach_added', {
      coach_name: coach.name,
    });

    fetchAssignedCoaches();
    onRefresh();
    setShowAddCoach(false);
  };

  const handleRemoveCoach = async (coachId: string, coachName: string) => {
    if (!confirm(`確定要移除教練「${coachName}」嗎？`)) return;

    // 先嘗試從 course_coaches 刪除
    const { error: multiError } = await supabase
      .from('course_coaches')
      .delete()
      .eq('course_id', courseId)
      .eq('coach_id', coachId);

    if (multiError) {
      // fallback: 清除 courses.coach_id
      await supabase.from('courses').update({ coach_id: null }).eq('id', courseId);
    }

    await addCourseChangeLog(courseId, 'coach_removed', {
      coach_name: coachName,
    });

    fetchAssignedCoaches();
    onRefresh();
  };

  const availableCoaches = coachList.filter(
    c => !assignedCoaches.some((ac: any) => ac.id === c.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-neutral-900">
          授課教練 <span className="text-primary">({assignedCoaches.length})</span>
        </h3>
        <button
          onClick={() => setShowAddCoach(!showAddCoach)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          新增教練
        </button>
      </div>

      {/* Add Coach Selector */}
      {showAddCoach && (
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
          <p className="text-xs font-bold text-neutral-500">選擇要加入的教練：</p>
          {availableCoaches.length > 0 ? (
            <div className="space-y-2">
              {availableCoaches.map(coach => (
                <div
                  key={coach.id}
                  onClick={() => handleAddCoach(coach.id)}
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 bg-white hover:border-primary cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {coach.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-neutral-900">{coach.name}</p>
                      <p className="text-xs text-neutral-500">{coach.specialization || '認證教練'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-primary font-medium">+ 加入</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400 text-center py-4">沒有可加入的教練</p>
          )}
          <button
            onClick={() => setShowAddCoach(false)}
            className="w-full py-2 bg-neutral-100 rounded-lg text-sm font-medium"
          >
            取消
          </button>
        </div>
      )}

      {/* Assigned Coaches List */}
      <div className="space-y-4">
        {assignedCoaches.map((coach: any) => (
          <div key={coach.id} className="flex items-center justify-between p-6 rounded-3xl bg-neutral-50 border border-neutral-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center font-bold text-primary text-xl shadow-sm">
                {coach.name?.[0] || '?'}
              </div>
              <div>
                <h4 className="font-bold text-neutral-900">{coach.name}</h4>
                <p className="text-xs text-neutral-500">{coach.specialization || '認證教練'}</p>
              </div>
            </div>
            <button
              onClick={() => handleRemoveCoach(coach.id, coach.name)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <Trash2 size={16} />
              移除
            </button>
          </div>
        ))}
      </div>

      {assignedCoaches.length === 0 && !showAddCoach && (
        <div className="py-12 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
          <ClipboardList className="mx-auto mb-3 text-neutral-300" size={32} />
          <p className="text-sm text-neutral-500">尚未指派教練</p>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Tab Component: 點名紀錄（從 attendance 表讀取真實資料）
// ============================================================
const CourseAttendanceTab: React.FC<{
  courseId: string;
}> = ({ courseId }) => {
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  // 取得這個課程有哪些日期（從 attendance 表）
  const fetchDates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select('date')
      .eq('course_id', courseId)
      .order('date', { ascending: false });

    const uniqueDates = [...new Set((data || []).map(a => a.date))];
    setDates(uniqueDates);

    // 預設選第一個日期（最近的）
    if (uniqueDates.length > 0 && !selectedDate) {
      setSelectedDate(uniqueDates[0]);
    }
    setLoading(false);
  }, [courseId]);

  // 取得選中日期的所有學員出席紀錄
  const fetchAttendanceForDate = useCallback(async () => {
    if (!selectedDate) { setAttendanceRecords([]); return; }

    const { data } = await supabase
      .from('attendance')
      .select('id, student_id, status, deducted, students(name, student_code)')
      .eq('course_id', courseId)
      .eq('date', selectedDate)
      .order('created_at');

    setAttendanceRecords(data || []);
  }, [courseId, selectedDate]);

  useEffect(() => { fetchDates(); }, [fetchDates]);
  useEffect(() => { fetchAttendanceForDate(); }, [fetchAttendanceForDate]);

  const handleStatusChange = async (attendanceId: string, newStatus: string) => {
    setSavingId(attendanceId);

    const record = attendanceRecords.find(r => r.id === attendanceId);
    const oldStatus = record?.status;

    // 更新 attendance 狀態
    const updateData: any = { status: newStatus };

    // 如果標記為「出席」且原本不是出席，則標記 deducted = true
    if (newStatus === '出席' && oldStatus !== '出席') {
      updateData.deducted = true;
    }
    // 如果從「出席」改為其他狀態，取消 deducted
    if (oldStatus === '出席' && newStatus !== '出席') {
      updateData.deducted = false;
    }

    const { error } = await supabase
      .from('attendance')
      .update(updateData)
      .eq('id', attendanceId);

    if (error) {
      alert('更新失敗：' + error.message);
    }

    await fetchAttendanceForDate();
    setSavingId(null);
  };

  const handleMarkAllPresent = async () => {
    if (!selectedDate) return;
    if (!confirm(`確定要將 ${selectedDate} 所有學員標記為「出席」嗎？`)) return;

    const pendingRecords = attendanceRecords.filter(r => r.status === '待上課');
    for (const record of pendingRecords) {
      await supabase
        .from('attendance')
        .update({ status: '出席', deducted: true })
        .eq('id', record.id);
    }

    await fetchAttendanceForDate();
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    '待上課': { label: '待上課', color: 'bg-neutral-100 text-neutral-600' },
    '出席': { label: '出席', color: 'bg-green-100 text-green-700' },
    '缺席': { label: '缺席', color: 'bg-red-100 text-red-700' },
    '請假': { label: '請假', color: 'bg-yellow-100 text-yellow-700' },
    '補課': { label: '補課', color: 'bg-purple-100 text-purple-700' },
    '遲到': { label: '遲到', color: 'bg-orange-100 text-orange-700' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header: date selector + bulk action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-neutral-900">點名紀錄</h3>
          <button
            onClick={handleMarkAllPresent}
            disabled={!selectedDate || attendanceRecords.filter(r => r.status === '待上課').length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check size={14} />
            全部標記出席
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500 font-medium">選擇日期：</span>
          <select
            className="px-4 py-2 border border-neutral-300 rounded-xl text-sm min-w-[180px]"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          >
            {dates.length === 0 && <option value="">無可用日期</option>}
            {dates.map(date => {
              const d = new Date(date + 'T00:00:00');
              const dayName = DAY_NAMES[d.getDay()];
              return (
                <option key={date} value={date}>{date} ({dayName})</option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Stats */}
      {selectedDate && attendanceRecords.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold">
            出席 {attendanceRecords.filter(r => r.status === '出席').length}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold">
            缺席 {attendanceRecords.filter(r => r.status === '缺席').length}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-bold">
            請假 {attendanceRecords.filter(r => r.status === '請假').length}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 text-xs font-bold">
            待上課 {attendanceRecords.filter(r => r.status === '待上課').length}
          </div>
        </div>
      )}

      {/* Attendance Table */}
      {selectedDate ? (
        <div className="bg-neutral-50 rounded-3xl border border-neutral-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-100 bg-white/50">
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">學員</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">出席狀態</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">快速標記</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {attendanceRecords.map((record) => {
                const student = record.students as any;
                const status = record.status || '待上課';
                const sc = statusConfig[status] || statusConfig['待上課'];
                const isSaving = savingId === record.id;

                return (
                  <tr key={record.id} className="hover:bg-white/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-primary text-xs shadow-sm">
                          {student?.name?.[0] || '?'}
                        </div>
                        <div>
                          <span className="font-bold text-neutral-900 text-sm">{student?.name || '未知'}</span>
                          {student?.student_code && (
                            <span className="ml-2 text-[10px] text-neutral-400">{student.student_code}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sc.color}`}>
                        {sc.label}
                      </span>
                      {record.deducted && (
                        <span className="ml-2 text-[10px] text-neutral-400">扣 1 堂</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isSaving ? (
                        <RefreshCw className="animate-spin text-neutral-400" size={14} />
                      ) : (
                        <div className="flex gap-1">
                          {[
                            { id: '出席', label: '出', hoverColor: 'hover:bg-green-500 hover:text-white' },
                            { id: '缺席', label: '缺', hoverColor: 'hover:bg-red-500 hover:text-white' },
                            { id: '請假', label: '假', hoverColor: 'hover:bg-amber-500 hover:text-white' },
                            { id: '遲到', label: '遲', hoverColor: 'hover:bg-orange-500 hover:text-white' },
                          ].map(btn => (
                            <button
                              key={btn.id}
                              onClick={() => handleStatusChange(record.id, btn.id)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all border ${
                                status === btn.id
                                  ? 'bg-primary text-white border-primary'
                                  : 'border-neutral-200 bg-white text-neutral-500 ' + btn.hoverColor
                              }`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {attendanceRecords.length === 0 && (
            <div className="py-12 text-center">
              <UserCheck className="mx-auto mb-3 text-neutral-300" size={32} />
              <p className="text-sm text-neutral-500">此日期尚無出席記錄</p>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
          <UserCheck className="mx-auto mb-3 text-neutral-300" size={32} />
          <p className="text-sm text-neutral-500">尚無可點名的日期</p>
          <p className="text-xs text-neutral-400 mt-1">請先在「課程日期」tab 設定上課日期</p>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Tab Component: 異動紀錄
// ============================================================
const CourseChangeLogsTab: React.FC<{
  courseId: string;
}> = ({ courseId }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('course_change_logs')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs(data || []);
      setLoading(false);
    };
    fetchLogs();
  }, [courseId]);

  const actionConfig: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
    'date_added': { icon: CalendarPlus, label: '新增日期', color: 'text-green-600', bg: 'bg-green-100' },
    'date_removed': { icon: CalendarX, label: '移除日期', color: 'text-red-600', bg: 'bg-red-100' },
    'holiday_set': { icon: Pause, label: '設定停課', color: 'text-amber-600', bg: 'bg-amber-100' },
    'holiday_unset': { icon: Play, label: '取消停課', color: 'text-blue-600', bg: 'bg-blue-100' },
    'student_enrolled': { icon: UserPlus, label: '學員報名', color: 'text-green-600', bg: 'bg-green-100' },
    'student_withdrawn': { icon: UserMinus, label: '學員退出', color: 'text-red-600', bg: 'bg-red-100' },
    'info_updated': { icon: Settings, label: '資訊更新', color: 'text-primary', bg: 'bg-primary/10' },
    'coach_added': { icon: UserPlus, label: '新增教練', color: 'text-green-600', bg: 'bg-green-100' },
    'coach_removed': { icon: UserMinus, label: '移除教練', color: 'text-red-600', bg: 'bg-red-100' },
    'attendance_batch_created': { icon: Users, label: '批次建立出席', color: 'text-primary', bg: 'bg-primary/10' },
    'attendance_batch_deleted': { icon: Trash2, label: '批次刪除出席', color: 'text-red-600', bg: 'bg-red-100' },
  };

  const formatDetail = (log: any): string => {
    const d = log.detail || {};
    const parts: string[] = [];

    if (d.date) parts.push(`日期: ${d.date}`);
    if (d.dates?.length) parts.push(`日期: ${d.dates.join(', ')}`);
    if (d.student_name) parts.push(`學員: ${d.student_name}`);
    if (d.coach_name) parts.push(`教練: ${d.coach_name}`);
    if (d.field) parts.push(`欄位: ${d.field}`);
    if (d.old_value !== undefined) parts.push(`舊值: ${d.old_value}`);
    if (d.new_value !== undefined) parts.push(`新值: ${d.new_value}`);
    if (d.count !== undefined) parts.push(`影響 ${d.count} 筆`);
    if (d.reason) parts.push(d.reason);

    return parts.join(' · ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-neutral-900">異動紀錄</h3>
        <Badge variant="neutral" className="bg-neutral-100 text-neutral-500">
          共 {logs.length} 筆
        </Badge>
      </div>

      {logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log) => {
            const config = actionConfig[log.action] || {
              icon: HistoryIcon,
              label: log.action,
              color: 'text-neutral-600',
              bg: 'bg-neutral-100',
            };
            const Icon = config.icon;
            const detail = formatDetail(log);
            const timeStr = log.created_at
              ? new Date(log.created_at).toLocaleString('zh-TW', {
                  month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })
              : '';

            return (
              <div key={log.id} className="flex gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-100 hover:bg-white hover:shadow-sm transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.bg}`}>
                  <Icon size={18} className={config.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-sm text-neutral-900">{config.label}</span>
                    <span className="text-[10px] text-neutral-400 shrink-0">{timeStr}</span>
                  </div>
                  {detail && (
                    <p className="text-xs text-neutral-500 mt-1 truncate">{detail}</p>
                  )}
                  <p className="text-[10px] text-neutral-400 mt-0.5">操作人: {log.operator}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
          <HistoryIcon className="mx-auto mb-3 text-neutral-300" size={32} />
          <p className="text-sm text-neutral-500">尚無異動紀錄</p>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================
export const AdminCourseManagement: React.FC<AdminCourseManagementProps> = ({ courses, setCourses, contracts }) => {
  const [loading, setLoading] = useState(true);
  const [coachList, setCoachList] = useState<{ id: string; name: string; specialization: string }[]>([]);
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [existingStudents, setExistingStudents] = useState<any[]>([]);
  const [showImportStudentModal, setShowImportStudentModal] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [addedStudents, setAddedStudents] = useState<any[]>([]);
  const [manualStudentNumber, setManualStudentNumber] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [venueContracts, setVenueContracts] = useState<any[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [venueList, setVenueList] = useState<any[]>([]);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editTab, setEditTab] = useState<'info' | 'dates' | 'students' | 'coaches' | 'attendance' | 'history'>('info');
  const [editForm, setEditForm] = useState<any>({});

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCourseData, setNewCourseData] = useState<any>({
    name: '', category: 'children', location: '', time: '', schedule: '',
    maxEnrollment: 24, currentEnrollment: 0, coaches: [], status: 'enrolling',
  });

  // Import students for edit modal
  const [showEditImportModal, setShowEditImportModal] = useState(false);

  const fetchVenues = async () => {
    const { data } = await supabase.from('venues').select('id, name, address').order('name');
    if (data) setVenueList(data);
  };

  const fetchCoaches = async () => {
    const { data } = await supabase.from('coaches').select('id, name, specialization').eq('is_active', true).order('name');
    if (data) setCoachList(data);
  };

  const fetchExistingStudents = async () => {
    const { data } = await supabase.from('students').select('id, name, phone, student_code, category').order('name');
    if (data) setExistingStudents(data);
  };

  const fetchVenueContracts = async () => {
    const { data } = await supabase.from('venue_contracts').select('*, venues(id, name)').order('end_date', { ascending: false });
    if (data) setVenueContracts(data);
  };

  const fetchCourses = async () => {
    setLoading(true);
    const { data } = await supabase.from('courses').select('*, coaches(name), venues(name, address)').order('name');
    if (data) {
      // 同時取得每個課程的 enrollment count
      const { data: enrollCounts } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('status', '已報名');

      const countMap: Record<string, number> = {};
      (enrollCounts || []).forEach((e: any) => {
        countMap[e.course_id] = (countMap[e.course_id] || 0) + 1;
      });

      setCourses(data.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category === '兒童班' ? 'children' : 'adult',
        schedule: c.day_of_week,
        time: `${c.start_time?.slice(0, 5)} – ${c.end_time?.slice(0, 5)}`,
        location: c.venues?.name || '',
        coaches: c.coaches ? [c.coaches.name] : [],
        thumbnail: `https://picsum.photos/seed/${c.id}/200/200`,
        currentEnrollment: countMap[c.id] || c.current_students || 0,
        maxEnrollment: c.max_students || 20,
        price: c.price || 0,
        description: c.description || '',
        tags: [c.day_of_week, c.venues?.name].filter(Boolean),
        students: [],
        changeLogs: [],
        dates: [],
        attendance: {},
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCourses();
    fetchCoaches();
    fetchVenueContracts();
    fetchVenues();
  }, []);

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const selectedContract = venueContracts.find(c => c.id === selectedContractId);

  const generateDates = () => {
    if (!selectedContract || !newCourseData.schedule) return [];
    const weekdayMap: Record<string, number> = {
      '週日': 0, '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6,
    };
    const targetDay = weekdayMap[newCourseData.schedule];
    if (targetDay === undefined) return [];
    const start = new Date(selectedContract.start_date);
    const end = new Date(selectedContract.end_date);
    const dates: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      if (current.getDay() === targetDay) dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const generatedCourseDates = generateDates();

  const handleAddCourse = async () => {
    const insertData: any = {
      name: newCourseData.name || `${newCourseData.location || ''} ${newCourseData.schedule || ''} ${newCourseData.startTime || ''}-${newCourseData.endTime || ''}`.trim(),
      category: newCourseData.category === 'children' ? '兒童班' : '成人班',
      coach_id: selectedCoaches[0] || null,
      day_of_week: newCourseData.schedule || null,
      max_students: newCourseData.maxEnrollment || 24,
      price: newCourseData.price || 0,
      description: newCourseData.description || '',
      status: '招生中',
    };
    if (newCourseData.startTime) insertData.start_time = newCourseData.startTime;
    if (newCourseData.endTime) insertData.end_time = newCourseData.endTime;
    if (selectedVenueId) insertData.venue_id = selectedVenueId;

    // 上傳圖片
    if (thumbnailFile) {
      try {
        const fileName = `course-${Date.now()}.${thumbnailFile.name.split('.').pop()}`;
        const { data: uploadData } = await supabase.storage
          .from('course-images')
          .upload(fileName, thumbnailFile);
        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('course-images')
            .getPublicUrl(fileName);
          // thumbnail URL 可存到 courses 表（如果有 thumbnail_url 欄位）
          console.log('圖片上傳成功:', urlData.publicUrl);
        }
      } catch (e) {
        console.log('圖片上傳失敗，使用預設圖片');
      }
    }

    const { data: courseData, error } = await supabase.from('courses').insert(insertData).select('id').single();
    if (error) { alert('新增課程失敗：' + error.message); return; }

    if (courseData && addedStudents.length > 0) {
      const enrollments = addedStudents.map(s => ({
        student_id: s.id, course_id: courseData.id, status: '已報名',
      }));
      await supabase.from('enrollments').insert(enrollments);

      for (const s of addedStudents) {
        await generateAttendanceRecords(s.id, courseData.id);
      }
    }

    alert('課程新增成功！');
    setShowAddModal(false);
    await fetchCourses();
    setStep(1);
    setSelectedCoaches([]);
    setAddedStudents([]);
    setSelectedVenueId(null);
    setSelectedContractId(null);
    setThumbnailFile(null);
    setThumbnailPreview('');
    setNewCourseData({ name: '', category: 'children', location: '', time: '', schedule: '', maxEnrollment: 24, currentEnrollment: 0, coaches: [], status: 'enrolling' });
  };

  const handleEditClick = (course: Course) => {
    setSelectedCourse(course);
    setEditForm({
      name: course.name,
      category: course.category,
      price: course.price,
      description: course.description,
      maxEnrollment: course.maxEnrollment,
    });
    setEditTab('info');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCourse) return;

    const updates: any = {};
    const changes: { field: string; old_value: string; new_value: string }[] = [];

    if (editForm.name !== selectedCourse.name) {
      updates.name = editForm.name;
      changes.push({ field: 'name', old_value: selectedCourse.name, new_value: editForm.name });
    }
    if (editForm.price !== selectedCourse.price) {
      updates.price = editForm.price;
      changes.push({ field: 'price', old_value: String(selectedCourse.price), new_value: String(editForm.price) });
    }
    if (editForm.description !== selectedCourse.description) {
      updates.description = editForm.description;
      changes.push({ field: 'description', old_value: selectedCourse.description || '', new_value: editForm.description });
    }
    if (editForm.maxEnrollment !== selectedCourse.maxEnrollment) {
      updates.max_students = editForm.maxEnrollment;
      changes.push({ field: 'max_students', old_value: String(selectedCourse.maxEnrollment), new_value: String(editForm.maxEnrollment) });
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('courses').update(updates).eq('id', selectedCourse.id);
      if (error) { alert('儲存失敗: ' + error.message); return; }

      for (const change of changes) {
        await addCourseChangeLog(selectedCourse.id, 'info_updated', change);
      }
    }

    await fetchCourses();
    setShowEditModal(false);
  };

  const handleDeleteCourse = async (id: string) => {
    if (confirm('確定要刪除此課程嗎？所有報名和出席紀錄也會一併刪除。')) {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (!error) await fetchCourses();
    }
  };

  const handleImportToEditCourse = async (student: any) => {
    if (!selectedCourse) return;

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', student.id)
      .eq('course_id', selectedCourse.id)
      .eq('status', '已報名');

    if (existing && existing.length > 0) {
      alert('該學員已報名此課程');
      return;
    }

    await supabase.from('enrollments').insert({
      student_id: student.id,
      course_id: selectedCourse.id,
      status: '已報名',
    });

    await generateAttendanceRecords(student.id, selectedCourse.id);

    await addCourseChangeLog(selectedCourse.id, 'student_enrolled', {
      student_name: student.name,
      student_id: student.id,
    });

    alert(`${student.name} 已報名成功`);
    fetchCourses();
  };

  const filteredCourses = courses.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-neutral-100">
          <Button variant="ghost" className="h-auto p-0 text-neutral-400">儀表板</Button>
          <div className="w-1 h-1 bg-neutral-300 rounded-full" />
          <Button variant="ghost" className="h-auto p-0 text-primary font-bold">課程管理</Button>
        </div>
        <Button variant="primary" className="w-auto h-12 px-6 rounded-2xl shadow-lg shadow-primary/20" onClick={() => setShowAddModal(true)}>
          <Plus size={20} /> 新增課程
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <Input placeholder="搜尋課程名稱、場地..." className="pl-12 h-14 bg-white border-neutral-100 shadow-sm rounded-2xl" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <Select className="h-14 bg-white border-neutral-100 shadow-sm rounded-2xl px-6 min-w-[140px]">
            <option>所有分類</option>
            <option>兒童班</option>
            <option>成人班</option>
          </Select>
        </div>
      </div>

      {/* Course List Table */}
      <div className="bg-white rounded-[32px] shadow-sm border border-neutral-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-50">
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">課程資訊</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">時段與地點</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">教練</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">名額狀態</th>
              <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {filteredCourses.map(course => (
              <tr key={course.id} className="hover:bg-neutral-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <img src={course.thumbnail} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-sm" referrerPolicy="no-referrer" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={course.category === 'children' ? 'primary' : 'secondary'}>
                          {course.category === 'children' ? '兒童班' : '成人班'}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-neutral-900 leading-tight">{course.name}</h4>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-neutral-600 font-medium">
                      <Calendar size={14} className="text-primary" />
                      <span>{course.schedule} {course.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <MapPin size={14} />
                      <span>{course.location}</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex -space-x-2">
                    {course.coaches.map((coach, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600" title={coach}>
                        {coach[0]}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="w-40 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-neutral-500">{course.currentEnrollment}/{course.maxEnrollment} 人</span>
                      <span className={course.currentEnrollment >= course.maxEnrollment ? 'text-danger' : 'text-primary'}>
                        {Math.round((course.currentEnrollment / course.maxEnrollment) * 100)}%
                      </span>
                    </div>
                    <ProgressBar current={course.currentEnrollment} max={course.maxEnrollment} color={course.currentEnrollment >= course.maxEnrollment ? 'bg-danger' : 'bg-primary'} />
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEditClick(course)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-primary/10 hover:text-primary transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteCourse(course.id)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-danger/10 hover:text-danger transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* EDIT COURSE MODAL (改造版) */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showEditModal && selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="px-10 py-8 border-b border-neutral-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">{selectedCourse.name}</h2>
                    <p className="text-sm text-neutral-500">{selectedCourse.schedule} {selectedCourse.time} · {selectedCourse.location}</p>
                  </div>
                  <button onClick={() => setShowEditModal(false)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors">
                    <X size={24} className="text-neutral-400" />
                  </button>
                </div>

                {/* Tabs — 6 tabs */}
                <div className="flex gap-1 overflow-x-auto">
                  {[
                    { id: 'info', label: '基本資訊', icon: Settings },
                    { id: 'dates', label: '課程日期', icon: Calendar },
                    { id: 'students', label: '學員名單', icon: Users },
                    { id: 'coaches', label: '教練管理', icon: ClipboardList },
                    { id: 'attendance', label: '點名紀錄', icon: UserCheck },
                    { id: 'history', label: '異動紀錄', icon: HistoryIcon },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setEditTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                        editTab === tab.id
                          ? 'bg-primary text-white shadow-lg shadow-primary/20'
                          : 'text-neutral-500 hover:bg-neutral-50'
                      }`}
                    >
                      <tab.icon size={18} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-10 py-8">
                <AnimatePresence mode="wait">
                  <motion.div key={editTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

                    {editTab === 'info' && (
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <FormField label="課程名稱">
                            <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                          </FormField>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField label="單堂價格">
                              <Input type="number" value={editForm.price || ''} onChange={e => setEditForm({ ...editForm, price: parseInt(e.target.value) || 0 })} />
                            </FormField>
                            <FormField label="名額上限">
                              <Input type="number" value={editForm.maxEnrollment || ''} onChange={e => setEditForm({ ...editForm, maxEnrollment: parseInt(e.target.value) || 24 })} />
                            </FormField>
                          </div>
                          <FormField label="課程說明">
                            <textarea
                              className="w-full min-h-[160px] p-4 rounded-2xl border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                              value={editForm.description || ''}
                              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                            />
                          </FormField>
                        </div>
                        <div className="space-y-6">
                          <FormField label="課程封面">
                            <div className="relative group rounded-3xl overflow-hidden aspect-video bg-neutral-100">
                              <img src={selectedCourse.thumbnail} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          setSelectedCourse({ ...selectedCourse, thumbnail: reader.result as string });
                                          addCourseChangeLog(selectedCourse.id, 'info_updated', {
                                            field: 'thumbnail',
                                            old_value: '(舊圖片)',
                                            new_value: '(新圖片)',
                                          });
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                  <div className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md text-white border border-white/30 font-bold text-sm hover:bg-white/30 transition-colors">
                                    更換圖片
                                  </div>
                                </label>
                              </div>
                            </div>
                          </FormField>
                          <div className="p-4 rounded-2xl bg-neutral-50 space-y-3">
                            <p className="text-xs font-bold text-neutral-400">課程資訊（唯讀）</p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-neutral-400 text-xs">星期</span>
                                <p className="font-medium">{selectedCourse.schedule}</p>
                              </div>
                              <div>
                                <span className="text-neutral-400 text-xs">時間</span>
                                <p className="font-medium">{selectedCourse.time}</p>
                              </div>
                              <div>
                                <span className="text-neutral-400 text-xs">場地</span>
                                <p className="font-medium">{selectedCourse.location}</p>
                              </div>
                              <div>
                                <span className="text-neutral-400 text-xs">教練</span>
                                <p className="font-medium">{selectedCourse.coaches.join('、') || '—'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {editTab === 'dates' && (
                      <CourseDatesTab
                        courseId={selectedCourse.id}
                        courseName={selectedCourse.name}
                        dayOfWeek={selectedCourse.schedule}
                      />
                    )}

                    {editTab === 'students' && (
                      <CourseStudentsTab
                        courseId={selectedCourse.id}
                        courseName={selectedCourse.name}
                        allStudents={existingStudents}
                        onRefresh={fetchCourses}
                        onImportClick={() => {
                          fetchExistingStudents();
                          setShowEditImportModal(true);
                        }}
                      />
                    )}

                    {editTab === 'coaches' && (
                      <CourseCoachesTab
                        courseId={selectedCourse.id}
                        coachList={coachList}
                        onRefresh={fetchCourses}
                      />
                    )}

                    {editTab === 'attendance' && (
                      <CourseAttendanceTab
                        courseId={selectedCourse.id}
                      />
                    )}

                    {editTab === 'history' && (
                      <CourseChangeLogsTab courseId={selectedCourse.id} />
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-10 py-6 border-t border-neutral-100 flex items-center justify-end gap-4 bg-neutral-50/50">
                <Button variant="ghost" className="w-auto px-8 h-12 rounded-2xl" onClick={() => setShowEditModal(false)}>
                  關閉
                </Button>
                {editTab === 'info' && (
                  <Button variant="primary" className="w-auto px-12 h-12 rounded-2xl shadow-lg shadow-primary/20" onClick={handleSaveEdit}>
                    儲存變更
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Students to Edit Course Modal */}
      {showEditImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowEditImportModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">匯入學員至「{selectedCourse?.name}」</h3>
            </div>
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="搜尋學員姓名或電話..."
                value={studentSearchQuery}
                onChange={e => setStudentSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {existingStudents
                .filter(s => {
                  const q = studentSearchQuery.toLowerCase();
                  return !q || s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.student_code?.toLowerCase().includes(q);
                })
                .map(student => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{student.name}</p>
                      <p className="text-xs text-neutral-500">{student.student_code || ''} {student.phone ? `· ${student.phone}` : ''}</p>
                    </div>
                    <button
                      onClick={() => handleImportToEditCourse(student)}
                      className="px-3 py-1 bg-primary text-white text-xs rounded-lg hover:bg-primary/90"
                    >
                      報名
                    </button>
                  </div>
                ))}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setShowEditImportModal(false)} className="w-full py-3 bg-neutral-100 rounded-xl font-medium text-sm">
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ADD COURSE MODAL (保留原有邏輯) */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="px-10 py-8 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">新增課程</h2>
                  <p className="text-sm text-neutral-500">請按照步驟填寫課程資訊</p>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === i ? 'bg-primary text-white scale-110' : step > i ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                      {step > i ? <Check size={14} /> : i}
                    </div>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-10 py-8">
                <AnimatePresence mode="wait">
                  <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">

                    {step === 1 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 1：選擇場地</h3>
                        <FormField label="場地">
                          <select value={selectedVenueId || ''} onChange={e => { const vid = e.target.value || null; setSelectedVenueId(vid); const venue = venueList.find(v => v.id === vid); if (venue) setNewCourseData((prev: any) => ({ ...prev, location: venue.name })); }} className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-sm">
                            <option value="">請選擇場地</option>
                            {venueList.map(v => <option key={v.id} value={v.id}>{v.name}{v.address ? ` - ${v.address}` : ''}</option>)}
                          </select>
                        </FormField>
                        {selectedVenueId && (() => {
                          const matched = venueContracts.filter(c => c.venue_id === selectedVenueId || c.venues?.id === selectedVenueId);
                          if (matched.length === 0) return <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-xs text-amber-700">此場地目前沒有合約紀錄。</div>;
                          return (
                            <div className="space-y-3">
                              <p className="text-sm font-bold text-neutral-700">關聯合約</p>
                              {matched.map(c => (
                                <div key={c.id} onClick={() => setSelectedContractId(c.id)} className={`p-4 rounded-xl cursor-pointer transition-all ${selectedContractId === c.id ? 'border-2 border-primary bg-primary/5' : 'border border-neutral-200 hover:border-neutral-300'}`}>
                                  <p className="font-bold">{c.venues?.name} - {c.contract_type}</p>
                                  <p className="text-sm text-neutral-500">{c.start_date} ~ {c.end_date}</p>
                                  {selectedContractId === c.id && <span className="text-primary text-sm font-medium mt-1 block">✓ 已選取</span>}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 2：填寫課程資料</h3>
                        <div className="grid grid-cols-2 gap-6">
                          <FormField label="課程名稱"><Input placeholder="例如：中和 [景新國小] 週六 10:00-12:00" value={newCourseData.name} onChange={e => setNewCourseData({ ...newCourseData, name: e.target.value })} /></FormField>
                          <FormField label="課程分類"><Select value={newCourseData.category} onChange={e => setNewCourseData({ ...newCourseData, category: e.target.value })}><option value="children">兒童班</option><option value="adult">成人班</option></Select></FormField>
                          <FormField label="上課星期"><Select value={newCourseData.schedule} onChange={e => setNewCourseData({ ...newCourseData, schedule: e.target.value })}><option value="">請選擇</option>{['週一', '週二', '週三', '週四', '週五', '週六', '週日'].map(d => <option key={d} value={d}>{d}</option>)}</Select></FormField>
                          <FormField label="名額上限"><Input type="number" value={newCourseData.maxEnrollment} onChange={e => setNewCourseData({ ...newCourseData, maxEnrollment: parseInt(e.target.value) || 24 })} /></FormField>
                          <FormField label="開始時間"><Input type="time" value={newCourseData.startTime || ''} onChange={e => setNewCourseData((prev: any) => ({ ...prev, startTime: e.target.value }))} /></FormField>
                          <FormField label="結束時間"><Input type="time" value={newCourseData.endTime || ''} onChange={e => setNewCourseData((prev: any) => ({ ...prev, endTime: e.target.value }))} /></FormField>
                          <FormField label="單堂價格"><Input type="number" placeholder="0" value={newCourseData.price || ''} onChange={e => setNewCourseData({ ...newCourseData, price: parseInt(e.target.value) || 0 })} /></FormField>
                        </div>
                        <FormField label="課程說明"><textarea className="w-full min-h-[120px] p-4 rounded-2xl border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm" value={newCourseData.description || ''} onChange={e => setNewCourseData({ ...newCourseData, description: e.target.value })} /></FormField>
                        <FormField label="課程封面圖">
                          <div className="w-full h-40 border-2 border-dashed border-neutral-200 rounded-3xl flex flex-col items-center justify-center gap-2 text-neutral-400 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer overflow-hidden" onClick={() => document.getElementById('thumbnail-upload')?.click()}>
                            {thumbnailPreview ? <img src={thumbnailPreview} alt="預覽" className="w-full h-full object-cover" /> : <><Upload size={32} /><span className="text-sm font-medium">點擊上傳課程照片</span></>}
                            <input id="thumbnail-upload" type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
                          </div>
                        </FormField>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 3：填寫教練資料</h3>
                        {coachList.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-neutral-400"><Users size={32} className="mb-2 opacity-20" /><p className="text-sm">尚無教練資料</p></div>
                        ) : (
                          <div className="space-y-4">
                            {coachList.map(coach => {
                              const isSelected = selectedCoaches.includes(coach.id);
                              return (
                                <div key={coach.id} onClick={() => setSelectedCoaches(prev => isSelected ? prev.filter(id => id !== coach.id) : [...prev, coach.id])} className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-neutral-100 hover:border-primary/30'}`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isSelected ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600'}`}>{coach.name.charAt(0)}</div>
                                    <div><p className="font-bold text-neutral-900">{coach.name}</p><Badge variant="accent" className="text-[10px] py-0">{coach.specialization || '認證教練'}</Badge></div>
                                  </div>
                                  <input type="checkbox" checked={isSelected} readOnly className="w-5 h-5 rounded border-neutral-300 text-primary" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {step === 4 && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">步驟 4：學生報名與費用</h3>
                          <Button variant="ghost" className="text-primary text-sm font-bold" onClick={() => { fetchExistingStudents(); setShowImportStudentModal(true); }}>
                            <Plus size={16} /> 匯入現有學員
                          </Button>
                        </div>
                        <div className="bg-neutral-50 rounded-xl p-4">
                          <p className="text-sm font-medium text-neutral-500 mb-2">課程方案定價</p>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            {PRICING_PLANS.map(plan => <div key={plan.id} className="bg-white rounded-lg p-2 text-center border"><p className="font-bold">{plan.sessions}堂</p><p className="text-primary font-medium">${plan.pricePerSession}/堂</p></div>)}
                          </div>
                        </div>
                        <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100">
                          <p className="text-sm font-bold text-neutral-900 mb-4 text-center">已加入學員 ({addedStudents.length})</p>
                          {addedStudents.length > 0 ? (
                            <div className="space-y-2">
                              {addedStudents.map(student => (
                                <div key={student.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-100">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{student.name?.[0] || '?'}</div>
                                    <div><p className="font-bold text-neutral-900 text-sm">{student.name}</p><p className="text-xs text-neutral-500">{student.student_code || ''}</p></div>
                                  </div>
                                  <button onClick={() => setAddedStudents(prev => prev.filter(a => a.id !== student.id))} className="p-2 text-danger hover:bg-danger/10 rounded-lg"><Trash2 size={16} /></button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center py-8 text-neutral-400"><Users size={32} className="mb-2 opacity-20" /><p className="text-xs">尚未加入任何學員</p></div>
                          )}
                        </div>
                      </div>
                    )}

                    {step === 5 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 5：上課日期確認</h3>
                        {generatedCourseDates.length > 0 ? (
                          <>
                            <p className="text-sm text-neutral-600">依據合約 {selectedContract?.start_date} ~ {selectedContract?.end_date}，每{newCourseData.schedule}共 <span className="font-bold text-primary">{generatedCourseDates.length}</span> 堂課</p>
                            <div className="grid grid-cols-4 gap-2">
                              {generatedCourseDates.map((date: string, idx: number) => (
                                <div key={date} className="bg-primary/5 border border-primary/20 rounded-lg p-2 text-center"><p className="text-xs text-primary font-medium">第{idx + 1}堂</p><p className="text-sm font-bold">{date.slice(5)}</p></div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-neutral-500"><p>未找到對應場地合約</p></div>
                        )}
                      </div>
                    )}

                    {step === 6 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 6：確認刊登</h3>
                        <div className="p-8 rounded-[32px] bg-neutral-50 border border-neutral-100 space-y-6">
                          <div className="flex gap-6">
                            <div className="w-32 h-32 rounded-3xl bg-neutral-200 overflow-hidden shrink-0">
                              <img src={thumbnailPreview || `https://picsum.photos/seed/badminton/300/300`} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="space-y-2">
                              <Badge variant="primary">{newCourseData.category === 'adult' ? '成人班' : '兒童班'}</Badge>
                              <h4 className="text-xl font-bold text-neutral-900">{newCourseData.name || `${newCourseData.location || ''} ${newCourseData.schedule || ''}`.trim()}</h4>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200">
                            <div><p className="text-xs text-neutral-400 mb-1 uppercase font-bold">場地</p><p className="text-sm font-bold">{venueList.find(v => v.id === selectedVenueId)?.name || '未選擇'}</p></div>
                            <div><p className="text-xs text-neutral-400 mb-1 uppercase font-bold">上課時間</p><p className="text-sm font-bold">{newCourseData.schedule} {newCourseData.startTime}-{newCourseData.endTime}</p></div>
                            <div><p className="text-xs text-neutral-400 mb-1 uppercase font-bold">名額上限</p><p className="text-sm font-bold">{newCourseData.maxEnrollment || 24} 人</p></div>
                            <div><p className="text-xs text-neutral-400 mb-1 uppercase font-bold">教練</p><p className="text-sm font-bold">{coachList.filter(c => selectedCoaches.includes(c.id)).map(c => c.name).join('、') || '—'}</p></div>
                            <div><p className="text-xs text-neutral-400 mb-1 uppercase font-bold">上課堂數</p><p className="text-sm font-bold">{generatedCourseDates.length}堂</p></div>
                            <div><p className="text-xs text-neutral-400 mb-1 uppercase font-bold">已加入學員</p><p className="text-sm font-bold">{addedStudents.length}人</p></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 text-primary"><Check size={20} /><p className="text-xs font-medium">確認無誤後點擊「確認刊登」。</p></div>
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-10 py-8 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <Button variant="ghost" className="w-auto px-8 h-12 rounded-2xl" onClick={() => step > 1 ? setStep(step - 1) : setShowAddModal(false)}>
                  {step === 1 ? '取消' : <><ChevronLeft size={18} /> 上一步</>}
                </Button>
                <Button variant="primary" className="w-auto px-12 h-12 rounded-2xl shadow-lg shadow-primary/20" onClick={() => {
                  if (step === 1) { if (!selectedVenueId) { alert('請選擇場地'); return; } if (!selectedContractId) { alert('請選擇合約'); return; } setStep(2); }
                  else if (step === 2) { if (!newCourseData.schedule) { alert('請選擇上課星期'); return; } if (!newCourseData.startTime || !newCourseData.endTime) { alert('請填寫時間'); return; } setStep(3); }
                  else if (step < 6) setStep(step + 1);
                  else handleAddCourse();
                }}>
                  {step === 6 ? '確認刊登' : <>下一步 <ChevronRight size={18} /></>}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Students Modal (for Add Course) */}
      {showImportStudentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b"><h3 className="text-lg font-bold">匯入現有學員</h3></div>
            <div className="p-4 border-b space-y-3">
              <input type="text" placeholder="搜尋學員姓名或電話..." value={studentSearchQuery} onChange={e => setStudentSearchQuery(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm outline-none focus:border-primary" />
              <div className="flex gap-2">
                <input type="text" placeholder="輸入學生編碼" value={manualStudentNumber} onChange={e => setManualStudentNumber(e.target.value)} className="flex-1 px-4 py-2 border rounded-lg text-sm outline-none focus:border-primary" />
                <button onClick={() => { const found = existingStudents.find(s => s.student_code === manualStudentNumber); if (found && !addedStudents.find(a => a.id === found.id)) { setAddedStudents(prev => [...prev, found]); setManualStudentNumber(''); } else if (!found) alert('找不到此學生編碼'); }} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">加入</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {existingStudents.filter(s => { const q = studentSearchQuery.toLowerCase(); return !q || s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.student_code?.toLowerCase().includes(q); }).map(student => {
                const isAdded = addedStudents.find(a => a.id === student.id);
                return (
                  <div key={student.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isAdded ? 'bg-primary/5 border-primary' : 'hover:bg-neutral-50 border-neutral-100'}`} onClick={() => { if (isAdded) setAddedStudents(prev => prev.filter(a => a.id !== student.id)); else setAddedStudents(prev => [...prev, student]); }}>
                    <div><p className="font-medium text-sm">{student.name}</p><p className="text-xs text-neutral-500">{student.student_code || ''} {student.phone ? `· ${student.phone}` : ''}</p></div>
                    {isAdded && <span className="text-primary font-bold">✓</span>}
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowImportStudentModal(false)} className="flex-1 py-3 bg-neutral-100 rounded-xl font-medium text-sm">取消</button>
              <button onClick={() => setShowImportStudentModal(false)} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium text-sm">確認匯入 ({addedStudents.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};