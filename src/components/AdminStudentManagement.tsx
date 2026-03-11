import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  Check,
  Download,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  ChevronRight,
  MapPin,
  Clock,
  History,
  Plus,
  X,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Input, Select, Badge, ProgressBar, FormField, useToast, ToastContainer } from './UI';
import { SessionUsage, WaitlistEntry } from '../types';
import { supabase } from '../lib/supabase';

// ─── types ─────────────────────────────────────────────────────────────────────

interface StudentRecord {
  id: string;            // students.id (UUID)
  creditId: string | null;
  paymentId: string | null;
  studentName: string;
  phone: string;
  email: string;
  studentNumber: string;
  lineId: string | null;
  birthDate: string | null;
  gender: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  notes: string | null;
  courseName: string;
  schedule: string;
  remaining: number;
  total: number;
  expiryDate: string;
  paymentStatus: 'paid' | 'unpaid';
  status: 'active' | 'waiting' | 'completed';
  usageHistory: SessionUsage[];
}

interface AddStudentForm {
  name: string;
  phone: string;
  email: string;
  lineId: string;
  birthDate: string;
  gender: string;
  emergencyContact: string;
  emergencyPhone: string;
  notes: string;
}

const DEFAULT_ADD_FORM: AddStudentForm = {
  name: '', phone: '', email: '', lineId: '',
  birthDate: '', gender: '男', emergencyContact: '', emergencyPhone: '', notes: '',
};

// ─── component ─────────────────────────────────────────────────────────────────

export const AdminStudentManagement: React.FC<{
  waitlists?: WaitlistEntry[];
}> = ({ waitlists = [] }) => {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<StudentRecord>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddStudentForm>(DEFAULT_ADD_FORM);
  const { toasts, showToast } = useToast();

  // ── fetch ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);

    // Fetch students with their first enrollment + course
    const { data: studentsData } = await supabase
      .from('students')
      .select('*, enrollments(id, status, courses(id, name, day_of_week, start_time))')
      .order('created_at', { ascending: false });

    // Fetch credits & payments separately (keyed by student_id)
    const [{ data: creditsData }, { data: paymentsData }] = await Promise.all([
      supabase.from('credits').select('id, student_id, remaining, total, expiry_date'),
      supabase
        .from('payments')
        .select('id, student_id, status, amount')
        .order('created_at', { ascending: false }),
    ]);

    if (!studentsData) { setLoading(false); return; }

    const rows: StudentRecord[] = (studentsData as any[]).map(s => {
      const enrollment = s.enrollments?.[0];
      const course = enrollment?.courses;
      const credit = creditsData?.find((c: any) => c.student_id === s.id);
      const payment = paymentsData?.find((p: any) => p.student_id === s.id);

      return {
        id: s.id,
        creditId: credit?.id ?? null,
        paymentId: payment?.id ?? null,
        studentName: s.name,
        phone: s.phone ?? '',
        email: s.email ?? '',
        studentNumber: s.student_number ?? '',
        lineId: s.line_id ?? null,
        birthDate: s.birth_date ?? null,
        gender: s.gender ?? null,
        emergencyContact: s.emergency_contact ?? null,
        emergencyPhone: s.emergency_phone ?? null,
        notes: s.notes ?? null,
        courseName: course?.name ?? '未報名',
        schedule: course ? `${course.day_of_week} ${course.start_time}` : '-',
        remaining: credit?.remaining ?? 0,
        total: credit?.total ?? 0,
        expiryDate: credit?.expiry_date ?? '',
        paymentStatus: payment?.status === 'paid' ? 'paid' : 'unpaid',
        status: 'active',
        usageHistory: [],
      };
    });

    setStudents(rows);
    setLoading(false);
  };

  // Load usage history (attendance) for a student on demand
  const loadUsageHistory = async (studentId: string) => {
    const { data } = await supabase
      .from('attendance')
      .select('id, date, status, courses(name, start_time, venues(name))')
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    if (!data) return;

    const history: SessionUsage[] = (data as any[]).map(a => ({
      id: a.id,
      date: a.date,
      time: a.courses?.start_time ?? '',
      location: a.courses?.venues?.name ?? '',
      courseName: a.courses?.name ?? '',
      status:
        a.status === '出席' ? 'present'
        : a.status === '缺席' ? 'absent'
        : 'excused',
    }));

    setSelectedStudent(prev => prev ? { ...prev, usageHistory: history } : null);
  };

  // ── handlers ─────────────────────────────────────────────────────────────────

  const handleSelectStudent = (student: StudentRecord) => {
    setSelectedStudent(student);
    setIsEditing(false);
    loadUsageHistory(student.id);
  };

  // Credits
  const handleAddSession = async (id: string) => {
    const s = students.find(s => s.id === id);
    if (!s || !s.creditId) return;
    const { error } = await supabase
      .from('credits')
      .update({ remaining: s.remaining + 1 })
      .eq('id', s.creditId);
    if (!error) {
      setStudents(prev => prev.map(x => x.id === id ? { ...x, remaining: x.remaining + 1 } : x));
      setSelectedStudent(prev => prev?.id === id ? { ...prev, remaining: prev.remaining + 1 } : prev);
    }
  };

  const handleDeductSession = async (id: string) => {
    const s = students.find(s => s.id === id);
    if (!s || !s.creditId || s.remaining <= 0) return;
    const { error } = await supabase
      .from('credits')
      .update({ remaining: s.remaining - 1 })
      .eq('id', s.creditId);
    if (!error) {
      setStudents(prev => prev.map(x => x.id === id ? { ...x, remaining: x.remaining - 1 } : x));
      setSelectedStudent(prev => prev?.id === id ? { ...prev, remaining: prev.remaining - 1 } : prev);
    }
  };

  // Attendance
  const handleUpdateUsage = async (studentId: string, usageId: string, newStatus: 'present' | 'absent' | 'excused') => {
    const dbStatus = newStatus === 'present' ? '出席' : newStatus === 'absent' ? '缺席' : '請假';
    const { error } = await supabase.from('attendance').update({ status: dbStatus }).eq('id', usageId);
    if (!error) {
      const update = (arr: SessionUsage[]) =>
        arr.map(u => u.id === usageId ? { ...u, status: newStatus } : u);
      setStudents(prev => prev.map(s =>
        s.id === studentId ? { ...s, usageHistory: update(s.usageHistory) } : s
      ));
      setSelectedStudent(prev =>
        prev?.id === studentId ? { ...prev, usageHistory: update(prev.usageHistory) } : prev
      );
    }
  };

  const handleDeleteUsage = async (studentId: string, usageId: string) => {
    if (!confirm('確定要刪除此筆紀錄嗎？(刪除後將自動補回 1 堂剩餘堂數)')) return;
    const { error } = await supabase.from('attendance').delete().eq('id', usageId);
    if (!error) {
      // Also increment credits
      const s = students.find(x => x.id === studentId);
      if (s?.creditId) {
        await supabase.from('credits').update({ remaining: s.remaining + 1 }).eq('id', s.creditId);
      }
      setStudents(prev => prev.map(s =>
        s.id === studentId
          ? { ...s, remaining: s.remaining + 1, usageHistory: s.usageHistory.filter(u => u.id !== usageId) }
          : s
      ));
      setSelectedStudent(prev =>
        prev?.id === studentId
          ? { ...prev, remaining: prev.remaining + 1, usageHistory: prev.usageHistory.filter(u => u.id !== usageId) }
          : prev
      );
    }
  };

  // Payment
  const handleConfirmPayment = async (id: string) => {
    const s = students.find(x => x.id === id);
    if (!s?.paymentId) return;
    const { error } = await supabase.from('payments').update({ status: 'paid' }).eq('id', s.paymentId);
    if (!error) {
      setStudents(prev => prev.map(x => x.id === id ? { ...x, paymentStatus: 'paid' } : x));
      setSelectedStudent(prev => prev?.id === id ? { ...prev, paymentStatus: 'paid' } : prev);
    }
  };

  // Edit student
  const handleStartEdit = (student: StudentRecord) => {
    setEditForm({ ...student });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('students')
      .update({
        name: editForm.studentName,
        phone: editForm.phone || null,
        email: editForm.email || null,
        line_id: editForm.lineId || null,
        birth_date: editForm.birthDate || null,
        gender: editForm.gender || null,
        emergency_contact: editForm.emergencyContact || null,
        emergency_phone: editForm.emergencyPhone || null,
        notes: editForm.notes || null,
      })
      .eq('id', editForm.id);
    setSaving(false);
    if (error) {
      alert('儲存失敗：' + error.message);
    } else {
      await fetchStudents();
      setIsEditing(false);
      setSelectedStudent(prev => prev ? { ...prev, ...editForm } as StudentRecord : null);
    }
  };

  // Delete student
  const handleDeleteStudent = async (id: string) => {
    if (!confirm('確定要刪除此學員紀錄嗎？')) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) {
      alert('刪除失敗：' + error.message);
    } else {
      await fetchStudents();
      if (selectedStudent?.id === id) setSelectedStudent(null);
    }
  };

  // Add student
  const handleAddStudent = async () => {
    if (!addForm.name) { alert('請填寫學員姓名'); return; }
    setSaving(true);
    const { error } = await supabase.from('students').insert({
      name: addForm.name,
      phone: addForm.phone || null,
      email: addForm.email || null,
      line_id: addForm.lineId || null,
      birth_date: addForm.birthDate || null,
      gender: addForm.gender || null,
      emergency_contact: addForm.emergencyContact || null,
      emergency_phone: addForm.emergencyPhone || null,
      notes: addForm.notes || null,
    });
    setSaving(false);
    if (error) {
      alert('新增失敗：' + error.message);
    } else {
      await fetchStudents();
      setShowAddModal(false);
      setAddForm(DEFAULT_ADD_FORM);
    }
  };

  const handleExportStudents = () => {
    const header = ['姓名', '電話', '郵件', '課程', '剩餘堂數', '總堂數', '到期日', '繳費狀態'];
    const rows = filteredStudents.map(s => [
      s.studentName,
      s.phone,
      s.email,
      s.courseName,
      String(s.remaining),
      String(s.total),
      s.expiryDate,
      s.paymentStatus === 'paid' ? '已繳費' : '未繳費',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `學員名單_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已匯出 ${filteredStudents.length} 筆學員名單`, 'success');
  };

  // ── derived ──────────────────────────────────────────────────────────────────

  const filteredStudents = students.filter(s =>
    (s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     s.phone.includes(searchQuery)) &&
    (filterStatus === 'all' || s.paymentStatus === filterStatus)
  );

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-12">
      <ToastContainer toasts={toasts} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-neutral-100">
            <Button variant="ghost" className="h-auto p-0 text-neutral-400">儀表板</Button>
            <div className="w-1 h-1 bg-neutral-300 rounded-full" />
            <Button variant="ghost" className="h-auto p-0 text-primary font-bold">學員管理</Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="w-auto h-12 px-6 rounded-2xl border-neutral-200 text-neutral-600 bg-white"
            onClick={handleExportStudents}
          >
            <Download size={18} />
            匯出名單
          </Button>
          <Button
            variant="primary"
            className="w-auto h-12 px-6 rounded-2xl shadow-lg shadow-primary/20"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} />
            新增學員
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <Input
            placeholder="搜尋學員姓名、聯絡電話..."
            className="pl-12 h-14 bg-white border-neutral-100 shadow-sm rounded-2xl"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Select
            className="h-14 bg-white border-neutral-100 shadow-sm rounded-2xl px-6 min-w-[140px]"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">所有狀態</option>
            <option value="paid">已繳費</option>
            <option value="unpaid">未繳費</option>
          </Select>
          <Button variant="ghost" className="h-14 w-14 bg-white border border-neutral-100 shadow-sm rounded-2xl p-0">
            <Filter size={20} />
          </Button>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-[32px] shadow-sm border border-neutral-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-neutral-400">載入中...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-neutral-400">尚無學員資料</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-50">
                <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">學員資訊</th>
                <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">報名班級</th>
                <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">剩餘堂數</th>
                <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">繳費狀態</th>
                <th className="px-8 py-6 text-xs font-bold text-neutral-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-neutral-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {student.studentName[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-900 leading-tight">{student.studentName}</h4>
                        <p className="text-xs text-neutral-400">{student.phone || student.studentNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-neutral-900 leading-tight">{student.courseName}</p>
                      {student.schedule !== '-' && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <Calendar size={14} />
                          <span>{student.schedule}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${student.remaining <= 3 ? 'text-danger' : 'text-primary'}`}>
                        {student.remaining}
                      </span>
                      <span className="text-xs text-neutral-400">/ {student.total} 堂</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <Badge
                      variant={student.paymentStatus === 'paid' ? 'accent' : 'danger'}
                      className={student.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}
                    >
                      {student.paymentStatus === 'paid' ? '已繳費' : '尚未繳費'}
                    </Badge>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectStudent(student)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleConfirmPayment(student.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-primary/10 hover:text-primary transition-colors"
                        title="確認繳費"
                      >
                        <CreditCard size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:bg-danger/10 hover:text-danger transition-colors"
                        title="刪除學員"
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

      {/* ── Add Student Modal ──────────────────────────────────────────────── */}
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
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-10 py-8 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">新增學員</h2>
                  <p className="text-sm text-neutral-500">填寫學員基本資料</p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-10 py-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <FormField label="姓名 *">
                    <Input
                      placeholder="學員姓名"
                      value={addForm.name}
                      onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    />
                  </FormField>
                  <FormField label="性別">
                    <Select
                      value={addForm.gender}
                      onChange={e => setAddForm({ ...addForm, gender: e.target.value })}
                    >
                      <option value="男">男</option>
                      <option value="女">女</option>
                      <option value="其他">其他</option>
                    </Select>
                  </FormField>
                  <FormField label="聯絡電話">
                    <Input
                      placeholder="0912-345-678"
                      value={addForm.phone}
                      onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
                    />
                  </FormField>
                  <FormField label="電子郵件">
                    <Input
                      type="email"
                      placeholder="student@example.com"
                      value={addForm.email}
                      onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                    />
                  </FormField>
                  <FormField label="LINE ID">
                    <Input
                      placeholder="LINE ID"
                      value={addForm.lineId}
                      onChange={e => setAddForm({ ...addForm, lineId: e.target.value })}
                    />
                  </FormField>
                  <FormField label="生日">
                    <Input
                      type="date"
                      value={addForm.birthDate}
                      onChange={e => setAddForm({ ...addForm, birthDate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="緊急聯絡人">
                    <Input
                      placeholder="緊急聯絡人姓名"
                      value={addForm.emergencyContact}
                      onChange={e => setAddForm({ ...addForm, emergencyContact: e.target.value })}
                    />
                  </FormField>
                  <FormField label="緊急聯絡電話">
                    <Input
                      placeholder="緊急聯絡電話"
                      value={addForm.emergencyPhone}
                      onChange={e => setAddForm({ ...addForm, emergencyPhone: e.target.value })}
                    />
                  </FormField>
                </div>
                <FormField label="備註">
                  <textarea
                    className="w-full min-h-[80px] p-4 rounded-2xl border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                    placeholder="其他備註..."
                    value={addForm.notes}
                    onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="px-10 py-8 border-t border-neutral-100 flex gap-4 bg-neutral-50/50">
                <Button variant="outline" className="flex-1 h-14 rounded-2xl" onClick={() => setShowAddModal(false)}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 h-14 rounded-2xl shadow-lg shadow-primary/20"
                  onClick={handleAddStudent}
                  disabled={saving}
                >
                  {saving ? '新增中...' : '確認新增'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Student Detail Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelectedStudent(null); setIsEditing(false); }}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
                {/* Profile Header */}
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-[32px] bg-primary/10 flex items-center justify-center text-primary font-bold text-4xl">
                    {selectedStudent.studentName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      {isEditing ? (
                        <Input
                          value={editForm.studentName ?? ''}
                          onChange={e => setEditForm({ ...editForm, studentName: e.target.value })}
                          className="text-2xl font-bold h-10 w-48"
                        />
                      ) : (
                        <h2 className="text-3xl font-bold text-neutral-900">{selectedStudent.studentName}</h2>
                      )}
                      <Badge variant={selectedStudent.paymentStatus === 'paid' ? 'accent' : 'danger'}>
                        {selectedStudent.paymentStatus === 'paid' ? '已繳費' : '尚未繳費'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-neutral-500">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Phone size={16} />
                        {isEditing ? (
                          <Input
                            value={editForm.phone ?? ''}
                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                            className="h-8 w-32 text-sm"
                          />
                        ) : (
                          <span>{selectedStudent.phone || '—'}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Mail size={16} />
                        {isEditing ? (
                          <Input
                            value={editForm.email ?? ''}
                            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                            className="h-8 w-40 text-sm"
                          />
                        ) : (
                          <span>{selectedStudent.email || '—'}</span>
                        )}
                      </div>
                    </div>
                    {selectedStudent.studentNumber && (
                      <p className="text-xs text-neutral-400 mt-1">學員編號：{selectedStudent.studentNumber}</p>
                    )}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 rounded-3xl bg-neutral-50 space-y-2">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">剩餘堂數</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-primary">{selectedStudent.remaining}</span>
                      <span className="text-sm font-medium text-neutral-400">/ {selectedStudent.total} 堂</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleAddSession(selectedStudent.id)}
                        className="flex-1 h-10 bg-white rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-colors"
                      >
                        加堂
                      </button>
                      <button
                        onClick={() => handleDeductSession(selectedStudent.id)}
                        className="flex-1 h-10 bg-white rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-colors"
                      >
                        扣堂
                      </button>
                    </div>
                  </div>
                  <div className="p-6 rounded-3xl bg-neutral-50 space-y-2">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">繳費資訊</p>
                    <div className="space-y-1">
                      <p className="font-bold text-neutral-900">
                        {selectedStudent.paymentStatus === 'paid' ? '已完成繳費' : '尚未繳費'}
                      </p>
                      {selectedStudent.expiryDate && (
                        <p className="text-xs text-neutral-500">到期：{selectedStudent.expiryDate}</p>
                      )}
                    </div>
                    {selectedStudent.paymentStatus === 'unpaid' && (
                      <Button
                        onClick={() => handleConfirmPayment(selectedStudent.id)}
                        variant="primary"
                        className="h-10 rounded-xl text-xs mt-2 w-full"
                      >
                        確認銷帳
                      </Button>
                    )}
                  </div>
                </div>

                {/* Course Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-neutral-900">報名班級</h3>
                  <div className="p-6 rounded-3xl border border-neutral-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-neutral-900">{selectedStudent.courseName}</p>
                          {selectedStudent.schedule !== '-' && (
                            <p className="text-xs text-neutral-500">{selectedStudent.schedule}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="accent">上課中</Badge>
                    </div>
                  </div>
                </div>

                {/* Usage History */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-neutral-900">堂數使用紀錄</h3>
                    <Badge variant="neutral" className="bg-neutral-100 text-neutral-500">
                      共 {selectedStudent.usageHistory.length} 筆
                    </Badge>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedStudent.usageHistory.length > 0 ? (
                      selectedStudent.usageHistory.map(usage => (
                        <div
                          key={usage.id}
                          className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                              <History size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-neutral-900">{usage.date}</span>
                                <div className="flex items-center gap-1">
                                  {(['present', 'absent', 'excused'] as const).map(status => (
                                    <button
                                      key={status}
                                      onClick={() => handleUpdateUsage(selectedStudent.id, usage.id, status)}
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                                        usage.status === status
                                          ? status === 'present' ? 'bg-emerald-500 text-white' : status === 'absent' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                                          : 'bg-white text-neutral-400 border border-neutral-100 hover:bg-neutral-50'
                                      }`}
                                    >
                                      {status === 'present' ? '出席' : status === 'absent' ? '缺席' : '請假'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                {usage.location && (
                                  <div className="flex items-center gap-1 text-xs text-neutral-400">
                                    <MapPin size={12} />
                                    <span>{usage.location}</span>
                                  </div>
                                )}
                                {usage.time && (
                                  <div className="flex items-center gap-1 text-xs text-neutral-400">
                                    <Clock size={12} />
                                    <span>{usage.time}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">扣除 1 堂</p>
                            <button
                              onClick={() => handleDeleteUsage(selectedStudent.id, usage.id)}
                              className="p-2 text-neutral-300 hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                              title="刪除紀錄"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                        <p className="text-sm text-neutral-400">尚無使用紀錄</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Waitlist */}
                {waitlists.filter(w => w.students.some(s => s.name === selectedStudent.studentName)).length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-neutral-900">候補紀錄</h3>
                      <Badge variant="warning" className="bg-amber-50 text-amber-600">候補中</Badge>
                    </div>
                    <div className="space-y-3">
                      {waitlists
                        .filter(w => w.students.some(s => s.name === selectedStudent.studentName))
                        .map(waitlist => (
                          <div key={waitlist.id} className="p-4 rounded-2xl bg-amber-50/30 border border-amber-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-600 shadow-sm">
                                <Clock size={18} />
                              </div>
                              <div>
                                <p className="font-bold text-neutral-900">{waitlist.courseName}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="flex items-center gap-1 text-xs text-neutral-400">
                                    <Calendar size={12} />
                                    <span>申請日期：{waitlist.date}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-neutral-400">
                                    <User size={12} />
                                    <span>聯絡人：{waitlist.contactName}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <Badge variant="warning">候補中</Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-14 rounded-2xl"
                    onClick={() => { setSelectedStudent(null); setIsEditing(false); }}
                  >
                    關閉
                  </Button>
                  {isEditing ? (
                    <Button
                      onClick={handleSaveEdit}
                      variant="primary"
                      className="flex-1 h-14 rounded-2xl shadow-lg shadow-primary/20"
                      disabled={saving}
                    >
                      {saving ? '儲存中...' : '儲存變更'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleStartEdit(selectedStudent)}
                      variant="primary"
                      className="flex-1 h-14 rounded-2xl shadow-lg shadow-primary/20"
                    >
                      編輯資料
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
