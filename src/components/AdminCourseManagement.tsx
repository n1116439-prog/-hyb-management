import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Clock,
  Users,
  Calendar,
  UserPlus,
  UserMinus,
  History as HistoryIcon,
  Settings,
  ClipboardList,
  UserCheck,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Input, Select, Badge, ProgressBar, FormField } from './UI';
import { Course, CourseChangeLog } from '../types';
import { supabase } from '../lib/supabase';

// ─── DB types ──────────────────────────────────────────────────────────────────

interface DbCoach { id: string; name: string; }
interface DbVenue { id: string; name: string; address: string; }

interface DbCourse {
  id: string;
  name: string;
  category: string;
  coach_id: string | null;
  venue_id: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  max_students: number;
  current_students: number;
  price: number;
  status: string | null;
  description: string | null;
  coaches: DbCoach | null;
  venues: DbVenue | null;
}

interface AddForm {
  venueId: string;
  name: string;
  category: '兒童班' | '成人班';
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  maxStudents: number;
  price: number;
  description: string;
  coachId: string;
}

interface EditFormData {
  name: string;
  maxStudents: number;
  description: string;
  coachId: string;
  venueId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  category: '兒童班' | '成人班';
}

// ─── mapper ────────────────────────────────────────────────────────────────────

const mapDbToUi = (c: DbCourse): Course => ({
  id: c.id,
  name: c.name,
  category: c.category === '兒童班' ? 'children' : 'adult',
  schedule: c.day_of_week,
  time: `${c.start_time} – ${c.end_time}`,
  location: c.venues?.name ?? '',
  coaches: c.coaches ? [c.coaches.name] : [],
  thumbnail: `https://picsum.photos/seed/course-${c.id}/200/200`,
  currentEnrollment: c.current_students,
  maxEnrollment: c.max_students,
  price: c.price,
  description: c.description ?? '',
  tags: c.current_students < c.max_students ? ['招生中'] : [],
  students: [],
  changeLogs: [],
  dates: [],
  attendance: {},
});

const DAYS_OF_WEEK = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

// ─── component ────────────────────────────────────────────────────────────────

export const AdminCourseManagement: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [coaches, setCoaches] = useState<DbCoach[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editTab, setEditTab] = useState<'info' | 'students' | 'coaches' | 'history' | 'attendance'>('info');
  const [selectedDate, setSelectedDate] = useState('');
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const [addForm, setAddForm] = useState<AddForm>({
    venueId: '',
    name: '',
    category: '兒童班',
    dayOfWeek: '週六',
    startTime: '10:00',
    endTime: '12:00',
    maxStudents: 24,
    price: 3200,
    description: '',
    coachId: '',
  });

  const [editForm, setEditForm] = useState<EditFormData>({
    name: '',
    maxStudents: 24,
    description: '',
    coachId: '',
    venueId: '',
    dayOfWeek: '週六',
    startTime: '10:00',
    endTime: '12:00',
    category: '兒童班',
  });

  // ── fetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCourses();
    fetchCoaches();
    fetchVenues();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*, coaches(id, name), venues(id, name, address)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCourses((data as unknown as DbCourse[]).map(mapDbToUi));
    }
    setLoading(false);
  };

  const fetchCoaches = async () => {
    const { data } = await supabase.from('coaches').select('id, name').order('name');
    if (data) setCoaches(data as DbCoach[]);
  };

  const fetchVenues = async () => {
    const { data } = await supabase.from('venues').select('id, name, address').order('name');
    if (data) setVenues(data as DbVenue[]);
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const filteredCourses = courses.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleEditClick = (course: Course) => {
    setSelectedCourse({ ...course, students: [], dates: [], attendance: {}, changeLogs: [] });
    setEditForm({
      name: course.name,
      maxStudents: course.maxEnrollment,
      description: course.description,
      coachId: '',
      venueId: '',
      dayOfWeek: course.schedule,
      startTime: course.time.split(' – ')[0] ?? '',
      endTime: course.time.split(' – ')[1] ?? '',
      category: course.category === 'children' ? '兒童班' : '成人班',
    });
    setSelectedDate(course.dates?.[0] ?? '');
    setEditTab('info');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCourse) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      name: editForm.name,
      max_students: editForm.maxStudents,
      description: editForm.description,
      category: editForm.category,
      day_of_week: editForm.dayOfWeek,
      start_time: editForm.startTime,
      end_time: editForm.endTime,
    };
    if (editForm.coachId) updates.coach_id = editForm.coachId;
    if (editForm.venueId) updates.venue_id = editForm.venueId;

    const { error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', selectedCourse.id);

    setSaving(false);
    if (error) {
      alert('儲存失敗：' + error.message);
    } else {
      await fetchCourses();
      setShowEditModal(false);
    }
  };

  const resetAddForm = () => {
    setAddForm({
      venueId: '', name: '', category: '兒童班', dayOfWeek: '週六',
      startTime: '10:00', endTime: '12:00', maxStudents: 24, price: 3200,
      description: '', coachId: '',
    });
    setStep(1);
  };

  const handleAddCourse = async () => {
    if (!addForm.name || !addForm.venueId) {
      alert('請填寫課程名稱並選擇場地');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('courses').insert({
      name: addForm.name,
      category: addForm.category,
      coach_id: addForm.coachId || null,
      venue_id: addForm.venueId,
      day_of_week: addForm.dayOfWeek,
      start_time: addForm.startTime,
      end_time: addForm.endTime,
      max_students: addForm.maxStudents,
      current_students: 0,
      price: addForm.price,
      status: '招生中',
      description: addForm.description,
    });
    setSaving(false);
    if (error) {
      alert('新增失敗：' + error.message);
    } else {
      await fetchCourses();
      setShowAddModal(false);
      resetAddForm();
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm('確定要刪除此課程嗎？')) return;
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) {
      alert('刪除失敗：' + error.message);
    } else {
      await fetchCourses();
    }
  };

  // ── local-only handlers (students / attendance tab) ───────────────────────

  const addLog = (course: Course, type: CourseChangeLog['type'], content: string) => {
    const newLog: CourseChangeLog = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content,
      operator: '管理員',
      timestamp: new Date().toLocaleString(),
    };
    setSelectedCourse({ ...course, changeLogs: [newLog, ...(course.changeLogs ?? [])] });
  };

  const handleAddStudent = (name: string) => {
    if (!selectedCourse || !name) return;
    setSelectedCourse({ ...selectedCourse, students: [...(selectedCourse.students ?? []), name] });
    addLog(selectedCourse, 'student_add', `新增學員：${name}`);
  };

  const handleRemoveStudent = (name: string) => {
    if (!selectedCourse) return;
    setSelectedCourse({ ...selectedCourse, students: (selectedCourse.students ?? []).filter(s => s !== name) });
    addLog(selectedCourse, 'student_remove', `移除學員：${name}`);
  };

  const handleAttendanceChange = (date: string, student: string, status: 'present' | 'absent' | 'excused' | 'pending') => {
    if (!selectedCourse) return;
    const att = selectedCourse.attendance ?? {};
    setSelectedCourse({
      ...selectedCourse,
      attendance: { ...att, [date]: { ...(att[date] ?? {}), [student]: status } },
    });
  };

  const handleMarkAllPresent = (date: string) => {
    if (!selectedCourse?.students) return;
    const dateAtt: Record<string, 'present'> = {};
    selectedCourse.students.forEach(s => { dateAtt[s] = 'present'; });
    setSelectedCourse({
      ...selectedCourse,
      attendance: { ...(selectedCourse.attendance ?? {}), [date]: dateAtt },
    });
  };

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-neutral-100">
            <Button variant="ghost" className="h-auto p-0 text-neutral-400">儀表板</Button>
            <div className="w-1 h-1 bg-neutral-300 rounded-full" />
            <Button variant="ghost" className="h-auto p-0 text-primary font-bold">課程管理</Button>
          </div>
        </div>
        <Button
          variant="primary"
          className="w-auto h-12 px-6 rounded-2xl shadow-lg shadow-primary/20"
          onClick={() => { resetAddForm(); setShowAddModal(true); }}
        >
          <Plus size={20} />
          新增課程
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <Input
            placeholder="搜尋課程名稱、場地..."
            className="pl-12 h-14 bg-white border-neutral-100 shadow-sm rounded-2xl"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Select className="h-14 bg-white border-neutral-100 shadow-sm rounded-2xl px-6 min-w-[140px]">
            <option>所有分類</option>
            <option>兒童班</option>
            <option>成人班</option>
          </Select>
          <Button variant="ghost" className="h-14 w-14 bg-white border border-neutral-100 shadow-sm rounded-2xl p-0">
            <Filter size={20} />
          </Button>
        </div>
      </div>

      {/* Course List */}
      <div className="bg-white rounded-[32px] shadow-sm border border-neutral-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-neutral-400">載入中...</div>
        ) : filteredCourses.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-neutral-400">尚無課程資料</div>
        ) : (
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
                      <img
                        src={course.thumbnail}
                        alt=""
                        className="w-14 h-14 rounded-2xl object-cover shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={course.category === 'children' ? 'primary' : 'secondary'}>
                            {course.category === 'children' ? '兒童班' : '成人班'}
                          </Badge>
                          {course.tags.includes('招生中') && (
                            <Badge variant="accent" className="bg-emerald-50 text-emerald-600">招生中</Badge>
                          )}
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
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600"
                          title={coach}
                        >
                          {coach[0]}
                        </div>
                      ))}
                      {course.coaches.length === 0 && (
                        <span className="text-xs text-neutral-400">未指定</span>
                      )}
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
                      <ProgressBar
                        current={course.currentEnrollment}
                        max={course.maxEnrollment}
                        color={course.currentEnrollment >= course.maxEnrollment ? 'bg-danger' : 'bg-primary'}
                      />
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditClick(course)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-danger/10 hover:text-danger transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEditModal && selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-10 py-8 border-b border-neutral-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">{selectedCourse.name}</h2>
                    <p className="text-sm text-neutral-500">課程編輯與異動管理</p>
                  </div>
                  <Button variant="ghost" className="w-10 h-10 p-0 rounded-full" onClick={() => setShowEditModal(false)}>
                    <X size={24} />
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: 'info', label: '基本資訊', icon: Settings },
                    { id: 'students', label: '學員名單', icon: Users },
                    { id: 'coaches', label: '教練管理', icon: ClipboardList },
                    { id: 'attendance', label: '點名紀錄', icon: UserCheck },
                    { id: 'history', label: '異動紀錄', icon: HistoryIcon },
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setEditTab(tab.id)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
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

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto px-10 py-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={editTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    {/* ── Info Tab ── */}
                    {editTab === 'info' && (
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <FormField label="課程名稱">
                            <Input
                              value={editForm.name}
                              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            />
                          </FormField>
                          <FormField label="課程分類">
                            <Select
                              value={editForm.category}
                              onChange={e => setEditForm({ ...editForm, category: e.target.value as '兒童班' | '成人班' })}
                            >
                              <option value="兒童班">兒童班</option>
                              <option value="成人班">成人班</option>
                            </Select>
                          </FormField>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField label="上課星期">
                              <Select
                                value={editForm.dayOfWeek}
                                onChange={e => setEditForm({ ...editForm, dayOfWeek: e.target.value })}
                              >
                                {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                              </Select>
                            </FormField>
                            <FormField label="名額上限">
                              <Input
                                type="number"
                                value={editForm.maxStudents}
                                onChange={e => setEditForm({ ...editForm, maxStudents: Number(e.target.value) })}
                              />
                            </FormField>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField label="開始時間">
                              <Input
                                type="time"
                                value={editForm.startTime}
                                onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                              />
                            </FormField>
                            <FormField label="結束時間">
                              <Input
                                type="time"
                                value={editForm.endTime}
                                onChange={e => setEditForm({ ...editForm, endTime: e.target.value })}
                              />
                            </FormField>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <FormField label="課程說明">
                            <textarea
                              className="w-full min-h-[120px] p-4 rounded-2xl border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                              value={editForm.description}
                              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                            />
                          </FormField>
                          <FormField label="場地（留空則不更換）">
                            <Select
                              value={editForm.venueId}
                              onChange={e => setEditForm({ ...editForm, venueId: e.target.value })}
                            >
                              <option value="">-- 不更換 --</option>
                              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </Select>
                          </FormField>
                        </div>
                      </div>
                    )}

                    {/* ── Students Tab ── */}
                    {editTab === 'students' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">
                            學員名單 ({selectedCourse.students?.length ?? 0})
                          </h3>
                          <div className="flex gap-2">
                            <Input
                              placeholder="輸入學員姓名..."
                              className="w-64 h-10 rounded-xl"
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  handleAddStudent((e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                            />
                            <Button variant="primary" className="h-10 px-4 rounded-xl">
                              <UserPlus size={18} />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {(selectedCourse.students ?? []).map((student, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 border border-neutral-100 group">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-primary shadow-sm">
                                  {student[0]}
                                </div>
                                <span className="font-bold text-neutral-900">{student}</span>
                              </div>
                              <button
                                onClick={() => handleRemoveStudent(student)}
                                className="p-2 text-neutral-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <UserMinus size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Coaches Tab ── */}
                    {editTab === 'coaches' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">
                            授課教練 ({selectedCourse.coaches.length})
                          </h3>
                          <div className="flex gap-2">
                            <Select
                              className="w-64 h-10 rounded-xl"
                              value={editForm.coachId}
                              onChange={e => setEditForm({ ...editForm, coachId: e.target.value })}
                            >
                              <option value="">選擇教練...</option>
                              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                            <Button variant="primary" className="h-10 px-4 rounded-xl" onClick={handleSaveEdit}>
                              <Check size={18} />
                              更新
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {selectedCourse.coaches.map((coach, i) => (
                            <div key={i} className="flex items-center justify-between p-6 rounded-3xl bg-neutral-50 border border-neutral-100">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center font-bold text-primary text-xl shadow-sm">
                                  {coach[0]}
                                </div>
                                <div>
                                  <h4 className="font-bold text-neutral-900">{coach}</h4>
                                  <p className="text-xs text-neutral-500">授課教練</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Attendance Tab ── */}
                    {editTab === 'attendance' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <h3 className="text-xl font-bold text-neutral-900">點名紀錄</h3>
                            <Button
                              variant="outline"
                              className="h-8 px-3 text-xs rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => handleMarkAllPresent(selectedDate)}
                            >
                              全部標記出席
                            </Button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-neutral-500 font-medium">選擇日期：</span>
                            <Select
                              className="w-48 h-10 rounded-xl"
                              value={selectedDate}
                              onChange={e => setSelectedDate(e.target.value)}
                            >
                              {(selectedCourse.dates ?? []).map(date => (
                                <option key={date} value={date}>{date}</option>
                              ))}
                            </Select>
                          </div>
                        </div>
                        <div className="bg-neutral-50 rounded-3xl border border-neutral-100 overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-neutral-100 bg-white/50">
                                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">學員姓名</th>
                                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">出席狀態</th>
                                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">快速標記</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {(selectedCourse.students ?? []).map((student, i) => {
                                const status = selectedCourse.attendance?.[selectedDate]?.[student] ?? 'pending';
                                return (
                                  <tr key={i} className="hover:bg-white/50 transition-colors">
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-primary text-xs shadow-sm">
                                          {student[0]}
                                        </div>
                                        <span className="font-bold text-neutral-900">{student}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <Badge
                                        variant={status === 'present' ? 'accent' : status === 'absent' ? 'danger' : status === 'excused' ? 'secondary' : 'neutral'}
                                        className={status === 'present' ? 'bg-emerald-50 text-emerald-600' : ''}
                                      >
                                        {status === 'present' ? '出席' : status === 'absent' ? '缺席' : status === 'excused' ? '請假' : '未點名'}
                                      </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex gap-1">
                                        {[
                                          { id: 'present', label: '出', color: 'hover:bg-emerald-500 hover:text-white' },
                                          { id: 'absent', label: '缺', color: 'hover:bg-red-500 hover:text-white' },
                                          { id: 'excused', label: '假', color: 'hover:bg-amber-500 hover:text-white' },
                                        ].map(btn => (
                                          <button
                                            key={btn.id}
                                            onClick={() => handleAttendanceChange(selectedDate, student, btn.id as 'present' | 'absent' | 'excused')}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all border border-neutral-200 bg-white text-neutral-500 ${btn.color}`}
                                          >
                                            {btn.label}
                                          </button>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ── History Tab ── */}
                    {editTab === 'history' && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">異動紀錄</h3>
                        {(selectedCourse.changeLogs ?? []).length === 0 ? (
                          <div className="py-12 text-center text-neutral-400 text-sm">尚無異動紀錄</div>
                        ) : (
                          <div className="space-y-4">
                            {(selectedCourse.changeLogs ?? []).map(log => (
                              <div key={log.id} className="flex gap-4 p-6 rounded-3xl bg-neutral-50 border border-neutral-100">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                  log.type.includes('add') ? 'bg-emerald-100 text-emerald-600' :
                                  log.type.includes('remove') ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'
                                }`}>
                                  {log.type.includes('student') ? <Users size={20} /> :
                                   log.type.includes('coach') ? <ClipboardList size={20} /> : <Settings size={20} />}
                                </div>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-neutral-900">{log.content}</span>
                                    <span className="text-xs text-neutral-400">{log.timestamp}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                                    <Badge variant="neutral" className="py-0">{log.operator}</Badge>
                                    <span>執行了此項操作</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-8 border-t border-neutral-100 flex items-center justify-end gap-4 bg-neutral-50/50">
                <Button variant="ghost" className="w-auto px-8 h-12 rounded-2xl" onClick={() => setShowEditModal(false)}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  className="w-auto px-12 h-12 rounded-2xl shadow-lg shadow-primary/20"
                  onClick={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? '儲存中...' : '儲存變更'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Add Course Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-10 py-8 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">新增課程</h2>
                  <p className="text-sm text-neutral-500">請按照步驟填寫課程資訊</p>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        step === i ? 'bg-primary text-white scale-110' :
                        step > i ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      {step > i ? <Check size={14} /> : i}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto px-10 py-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    {/* Step 1: Select Venue */}
                    {step === 1 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 1：選擇場地</h3>
                        {venues.length === 0 ? (
                          <div className="py-8 text-center text-neutral-400 text-sm">載入場地資料中...</div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4">
                            {venues.map(venue => (
                              <div
                                key={venue.id}
                                onClick={() => setAddForm({ ...addForm, venueId: venue.id })}
                                className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                                  addForm.venueId === venue.id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-neutral-100 hover:border-primary/30 hover:bg-primary/5'
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary">
                                    <MapPin size={24} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-neutral-900">{venue.name}</p>
                                    <p className="text-xs text-neutral-500">{venue.address}</p>
                                  </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                  addForm.venueId === venue.id ? 'border-primary bg-primary' : 'border-neutral-200'
                                }`}>
                                  {addForm.venueId === venue.id && <Check size={14} className="text-white" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 2: Course Info */}
                    {step === 2 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 2：填寫課程資料</h3>
                        <div className="grid grid-cols-2 gap-6">
                          <FormField label="課程名稱">
                            <Input
                              placeholder="例如：中和 [景新國小] 週六 10:00-12:00"
                              value={addForm.name}
                              onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                            />
                          </FormField>
                          <FormField label="課程分類">
                            <Select
                              value={addForm.category}
                              onChange={e => setAddForm({ ...addForm, category: e.target.value as '兒童班' | '成人班' })}
                            >
                              <option value="兒童班">兒童班</option>
                              <option value="成人班">成人班</option>
                            </Select>
                          </FormField>
                          <FormField label="上課星期">
                            <Select
                              value={addForm.dayOfWeek}
                              onChange={e => setAddForm({ ...addForm, dayOfWeek: e.target.value })}
                            >
                              {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                            </Select>
                          </FormField>
                          <FormField label="名額上限">
                            <Input
                              type="number"
                              value={addForm.maxStudents}
                              onChange={e => setAddForm({ ...addForm, maxStudents: Number(e.target.value) })}
                            />
                          </FormField>
                          <FormField label="開始時間">
                            <Input
                              type="time"
                              value={addForm.startTime}
                              onChange={e => setAddForm({ ...addForm, startTime: e.target.value })}
                            />
                          </FormField>
                          <FormField label="結束時間">
                            <Input
                              type="time"
                              value={addForm.endTime}
                              onChange={e => setAddForm({ ...addForm, endTime: e.target.value })}
                            />
                          </FormField>
                          <FormField label="費用 (NT$)">
                            <Input
                              type="number"
                              value={addForm.price}
                              onChange={e => setAddForm({ ...addForm, price: Number(e.target.value) })}
                            />
                          </FormField>
                        </div>
                        <FormField label="課程說明">
                          <textarea
                            className="w-full min-h-[120px] p-4 rounded-2xl border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                            placeholder="請輸入課程介紹..."
                            value={addForm.description}
                            onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                          />
                        </FormField>
                      </div>
                    )}

                    {/* Step 3: Select Coach */}
                    {step === 3 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 3：選擇教練</h3>
                        {coaches.length === 0 ? (
                          <div className="py-8 text-center text-neutral-400 text-sm">載入教練資料中...</div>
                        ) : (
                          <div className="space-y-4">
                            {coaches.map(coach => (
                              <div
                                key={coach.id}
                                onClick={() => setAddForm({ ...addForm, coachId: coach.id })}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                  addForm.coachId === coach.id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-neutral-100 hover:border-primary/30'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-neutral-600">
                                    {coach.name[0]}
                                  </div>
                                  <div>
                                    <p className="font-bold text-neutral-900">{coach.name}</p>
                                    <Badge variant="accent" className="text-[10px] py-0">認證教練</Badge>
                                  </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                  addForm.coachId === coach.id ? 'border-primary bg-primary' : 'border-neutral-200'
                                }`}>
                                  {addForm.coachId === coach.id && <Check size={14} className="text-white" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 4: Confirm */}
                    {step === 4 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 4：確認刊登</h3>
                        <div className="p-8 rounded-[32px] bg-neutral-50 border border-neutral-100 space-y-6">
                          <div className="space-y-2">
                            <Badge variant={addForm.category === '兒童班' ? 'primary' : 'secondary'}>
                              {addForm.category}
                            </Badge>
                            <h4 className="text-xl font-bold text-neutral-900">{addForm.name || '（未填寫課程名稱）'}</h4>
                            <div className="flex flex-wrap gap-4 text-sm text-neutral-500">
                              <div className="flex items-center gap-1.5">
                                <MapPin size={14} />
                                {venues.find(v => v.id === addForm.venueId)?.name ?? '（未選擇場地）'}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock size={14} />
                                {addForm.dayOfWeek} {addForm.startTime}–{addForm.endTime}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users size={14} />
                                {addForm.maxStudents} 人上限
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Calendar size={14} />
                                NT$ {addForm.price.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200">
                            <div>
                              <p className="text-xs text-neutral-400 mb-1 uppercase tracking-wider font-bold">教練</p>
                              <p className="text-sm font-bold text-neutral-900">
                                {coaches.find(c => c.id === addForm.coachId)?.name ?? '（未選擇）'}
                              </p>
                            </div>
                            {addForm.description && (
                              <div>
                                <p className="text-xs text-neutral-400 mb-1 uppercase tracking-wider font-bold">說明</p>
                                <p className="text-sm text-neutral-700 line-clamp-2">{addForm.description}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 text-primary">
                          <Check size={20} className="shrink-0" />
                          <p className="text-xs font-medium">確認無誤後點擊「確認刊登」，課程將立即寫入資料庫。</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-8 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <Button
                  variant="ghost"
                  className="w-auto px-8 h-12 rounded-2xl"
                  onClick={() => step > 1 ? setStep(step - 1) : setShowAddModal(false)}
                >
                  {step === 1 ? '取消' : <><ChevronLeft size={18} /> 上一步</>}
                </Button>
                <Button
                  variant="primary"
                  className="w-auto px-12 h-12 rounded-2xl shadow-lg shadow-primary/20"
                  disabled={saving}
                  onClick={() => {
                    if (step < 4) setStep(step + 1);
                    else handleAddCourse();
                  }}
                >
                  {step === 4
                    ? saving ? '新增中...' : '確認刊登'
                    : <>下一步 <ChevronRight size={18} /></>
                  }
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
