import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  Eye, 
  Check, 
  Download,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  User,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Clock,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Input, Select, Badge, ProgressBar, FormField } from './UI';
import { SESSIONS } from '../constants';
import { Session, SessionUsage, WaitlistEntry } from '../types';

export const AdminStudentManagement: React.FC<{
  waitlists?: WaitlistEntry[];
}> = ({ waitlists = [] }) => {
  const [students, setStudents] = useState<Session[]>(SESSIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [categoryTab, setCategoryTab] = useState('所有學員');
  const [selectedStudent, setSelectedStudent] = useState<Session | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Session>>({});

  const filteredStudents = students.filter(s => {
    const matchSearch = s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        s.courseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.paymentStatus === filterStatus;
    
    let matchCategory = true;
    if (categoryTab === '已參加') {
      matchCategory = s.remaining < s.total;
    } else if (categoryTab === '未參加') {
      matchCategory = s.remaining === s.total && s.paymentStatus === 'paid';
    } else if (categoryTab === '新註冊') {
      matchCategory = s.paymentStatus === 'unpaid';
    }

    return matchSearch && matchStatus && matchCategory;
  });

  const handleAddSession = (id: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, remaining: s.remaining + 1 } : s));
    if (selectedStudent?.id === id) {
      setSelectedStudent(prev => prev ? { ...prev, remaining: prev.remaining + 1 } : null);
    }
  };

  const handleDeductSession = (id: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === id && s.remaining > 0) {
        const newUsage: SessionUsage = {
          id: `u${Date.now()}`,
          date: new Date().toLocaleDateString('zh-TW'),
          time: '手動扣除',
          location: '系統操作',
          courseName: s.courseName,
          status: 'present'
        };
        return { 
          ...s, 
          remaining: s.remaining - 1,
          usageHistory: [newUsage, ...(s.usageHistory || [])]
        };
      }
      return s;
    }));
    
    if (selectedStudent?.id === id && selectedStudent.remaining > 0) {
      const newUsage: SessionUsage = {
        id: `u${Date.now()}`,
        date: new Date().toLocaleDateString('zh-TW'),
        time: '手動扣除',
        location: '系統操作',
        courseName: selectedStudent.courseName,
        status: 'present'
      };
      setSelectedStudent(prev => prev ? { 
        ...prev, 
        remaining: prev.remaining - 1,
        usageHistory: [newUsage, ...(prev.usageHistory || [])]
      } : null);
    }
  };

  const handleUpdateUsage = (studentId: string, usageId: string, newStatus: 'present' | 'absent' | 'excused') => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          usageHistory: s.usageHistory?.map(u => u.id === usageId ? { ...u, status: newStatus } : u)
        };
      }
      return s;
    }));
    if (selectedStudent?.id === studentId) {
      setSelectedStudent(prev => prev ? {
        ...prev,
        usageHistory: prev.usageHistory?.map(u => u.id === usageId ? { ...u, status: newStatus } : u)
      } : null);
    }
  };

  const handleDeleteUsage = (studentId: string, usageId: string) => {
    if (!confirm('確定要刪除此筆紀錄嗎？(刪除後將自動補回 1 堂剩餘堂數)')) return;
    
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          remaining: s.remaining + 1,
          usageHistory: s.usageHistory?.filter(u => u.id !== usageId)
        };
      }
      return s;
    }));
    if (selectedStudent?.id === studentId) {
      setSelectedStudent(prev => prev ? {
        ...prev,
        remaining: prev.remaining + 1,
        usageHistory: prev.usageHistory?.filter(u => u.id !== usageId)
      } : null);
    }
  };

  const handleConfirmPayment = (id: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, paymentStatus: 'paid' } : s));
    if (selectedStudent?.id === id) {
      setSelectedStudent(prev => prev ? { ...prev, paymentStatus: 'paid' } : null);
    }
  };

  const handleStartEdit = (student: Session) => {
    setEditForm(student);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!editForm.id) return;
    setStudents(prev => prev.map(s => s.id === editForm.id ? { ...s, ...editForm } as Session : s));
    setSelectedStudent(prev => prev ? { ...prev, ...editForm } as Session : null);
    setIsEditing(false);
  };

  const handleDeleteStudent = (id: string) => {
    if (confirm('確定要刪除此學員紀錄嗎？')) {
      setStudents(prev => prev.filter(s => s.id !== id));
      if (selectedStudent?.id === id) setSelectedStudent(null);
    }
  };

  const handleExportStudents = () => {
    alert('正在匯出學員名單...');
  };

  return (
    <div className="space-y-8 pb-12">
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
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['所有學員', '已參加', '未參加', '新註冊'].map(tab => (
          <button
            key={tab}
            onClick={() => setCategoryTab(tab)}
            className={`whitespace-nowrap px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
              categoryTab === tab 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-white text-neutral-500 hover:bg-neutral-50 border border-neutral-100'
            }`}
          >
            {tab}
          </button>
        ))}
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
                      <p className="text-xs text-neutral-400">{student.phone || '0912-345-678'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-neutral-900 leading-tight">{student.courseName}</p>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <Calendar size={14} />
                      <span>{student.schedule}</span>
                    </div>
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
                      onClick={() => setSelectedStudent(student)}
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
      </div>

      {/* Student Detail Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedStudent(null);
                setIsEditing(false);
              }}
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
                          value={editForm.studentName}
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
                            value={editForm.phone}
                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                            className="h-8 w-32 text-sm"
                          />
                        ) : (
                          <span>{selectedStudent.phone || '0912-345-678'}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Mail size={16} />
                        <span>student@example.com</span>
                      </div>
                    </div>
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
                      <p className="font-bold text-neutral-900">匯款：NT$ 3,200</p>
                      <p className="text-xs text-neutral-500">日期：2024/10/15</p>
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
                          <p className="text-xs text-neutral-500">{selectedStudent.schedule}</p>
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
                      共 {selectedStudent.usageHistory?.length || 0} 筆
                    </Badge>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedStudent.usageHistory && selectedStudent.usageHistory.length > 0 ? (
                      selectedStudent.usageHistory.map((usage) => (
                        <div key={usage.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                              <History size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-neutral-900">{usage.date}</span>
                                <div className="flex items-center gap-1">
                                  {(['present', 'absent', 'excused'] as const).map((status) => (
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
                                <div className="flex items-center gap-1 text-xs text-neutral-400">
                                  <MapPin size={12} />
                                  <span>{usage.location}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-neutral-400">
                                  <Clock size={12} />
                                  <span>{usage.time}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">扣除 1 堂</p>
                            </div>
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

                {/* Waitlist History */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-neutral-900">候補紀錄</h3>
                    <Badge variant="warning" className="bg-amber-50 text-amber-600">
                      候補中
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {waitlists.filter(w => w.students.some(s => s.name === selectedStudent.studentName)).length > 0 ? (
                      waitlists.filter(w => w.students.some(s => s.name === selectedStudent.studentName)).map((waitlist) => (
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
                      ))
                    ) : (
                      <div className="py-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                        <p className="text-sm text-neutral-400">尚無候補紀錄</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-14 rounded-2xl" 
                    onClick={() => {
                      setSelectedStudent(null);
                      setIsEditing(false);
                    }}
                  >
                    關閉
                  </Button>
                  {isEditing ? (
                    <Button 
                      onClick={handleSaveEdit}
                      variant="primary" 
                      className="flex-1 h-14 rounded-2xl shadow-lg shadow-primary/20"
                    >
                      儲存變更
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
