import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  Eye, 
  Check, 
  ChevronRight,
  ChevronLeft,
  Upload,
  MapPin,
  Clock,
  Users,
  Calendar,
  UserPlus,
  UserMinus,
  History as HistoryIcon,
  Settings,
  ClipboardList,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Input, Select, Badge, ProgressBar, FormField } from './UI';
import { COURSES, SESSIONS } from '../constants';
import { Course, CourseChangeLog, Session, VenueContract } from '../types';

interface AdminCourseManagementProps {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  contracts: VenueContract[];
}

export const AdminCourseManagement: React.FC<AdminCourseManagementProps> = ({ courses, setCourses, contracts }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCategory, setImportCategory] = useState<'all' | 'children' | 'adult'>('all');
  const [importedStudents, setImportedStudents] = useState<{name: string, phone: string, category: 'children' | 'adult'}[]>([]);
  const [editTab, setEditTab] = useState<'info' | 'students' | 'coaches' | 'history' | 'attendance'>('info');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCourseData, setNewCourseData] = useState<Partial<Course>>({
    name: '',
    category: 'children',
    location: '',
    time: '',
    schedule: '',
    maxEnrollment: 24,
    currentEnrollment: 0,
    coaches: [],
    status: 'enrolling'
  });

  const handleAddCourse = () => {
    const newCourse: Course = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCourseData.name || '新課程',
      category: newCourseData.category as 'children' | 'adult',
      location: newCourseData.location || '未知場地',
      time: newCourseData.time || '未定',
      schedule: newCourseData.schedule || '未定',
      maxEnrollment: newCourseData.maxEnrollment || 24,
      currentEnrollment: 0,
      coaches: newCourseData.coaches || [],
      status: 'enrolling',
      image: 'https://picsum.photos/seed/badminton/300/300',
      students: [],
      dates: [],
      attendance: {},
      changeLogs: []
    };
    setCourses(prev => [newCourse, ...prev]);
    setShowAddModal(false);
    setStep(1);
    setNewCourseData({
      name: '',
      category: 'children',
      location: '',
      time: '',
      schedule: '',
      maxEnrollment: 24,
      currentEnrollment: 0,
      coaches: [],
      status: 'enrolling'
    });
  };

  const filteredCourses = courses.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditClick = (course: Course) => {
    const dates = course.dates || ['2024/03/02', '2024/03/09', '2024/03/16'];
    setSelectedCourse({
      ...course,
      students: course.students || ['學員 A', '學員 B', '學員 C'],
      dates: dates,
      attendance: course.attendance || {},
      changeLogs: course.changeLogs || [
        { id: 'l1', type: 'info_update', content: '更新課程說明', operator: 'Admin', timestamp: '2024-03-01 12:00' }
      ]
    });
    setSelectedDate(dates[0]);
    setEditTab('info');
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCourse) return;
    setCourses(prev => prev.map(c => c.id === selectedCourse.id ? selectedCourse : c));
    setShowEditModal(false);
  };

  const addLog = (course: Course, type: CourseChangeLog['type'], content: string) => {
    const newLog: CourseChangeLog = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content,
      operator: '管理員',
      timestamp: new Date().toLocaleString()
    };
    setSelectedCourse({
      ...course,
      changeLogs: [newLog, ...(course.changeLogs || [])]
    });
  };

  const handleAddStudent = (name: string) => {
    if (!selectedCourse || !name) return;
    const updatedStudents = [...(selectedCourse.students || []), name];
    setSelectedCourse({ ...selectedCourse, students: updatedStudents });
    addLog(selectedCourse, 'student_add', `新增學員：${name}`);
  };

  const handleRemoveStudent = (name: string) => {
    if (!selectedCourse) return;
    const updatedStudents = (selectedCourse.students || []).filter(s => s !== name);
    setSelectedCourse({ ...selectedCourse, students: updatedStudents });
    addLog(selectedCourse, 'student_remove', `移除學員：${name}`);
  };

  const handleAddCoach = (name: string) => {
    if (!selectedCourse || !name) return;
    const updatedCoaches = [...selectedCourse.coaches, name];
    setSelectedCourse({ ...selectedCourse, coaches: updatedCoaches });
    addLog(selectedCourse, 'coach_add', `新增教練：${name}`);
  };

  const handleRemoveCoach = (name: string) => {
    if (!selectedCourse) return;
    const updatedCoaches = selectedCourse.coaches.filter(c => c !== name);
    setSelectedCourse({ ...selectedCourse, coaches: updatedCoaches });
    addLog(selectedCourse, 'coach_remove', `移除教練：${name}`);
  };

  const handleAttendanceChange = (date: string, student: string, status: 'present' | 'absent' | 'excused' | 'pending') => {
    if (!selectedCourse) return;
    const currentAttendance = selectedCourse.attendance || {};
    const dateAttendance = currentAttendance[date] || {};
    
    setSelectedCourse({
      ...selectedCourse,
      attendance: {
        ...currentAttendance,
        [date]: {
          ...dateAttendance,
          [student]: status
        }
      }
    });
  };

  const handleMarkAllPresent = (date: string) => {
    if (!selectedCourse || !selectedCourse.students) return;
    const currentAttendance = selectedCourse.attendance || {};
    const dateAttendance = { ...(currentAttendance[date] || {}) };
    
    selectedCourse.students.forEach(student => {
      dateAttendance[student] = 'present';
    });

    setSelectedCourse({
      ...selectedCourse,
      attendance: {
        ...currentAttendance,
        [date]: dateAttendance
      }
    });
  };

  const handleDeleteCourse = (id: string) => {
    if (confirm('確定要刪除此課程嗎？')) {
      setCourses(prev => prev.filter(c => c.id !== id));
    }
  };

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
          onClick={() => setShowAddModal(true)}
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
      </div>

      {/* Edit Course Modal */}
      <AnimatePresence>
        {showEditModal && selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                  <Button 
                    variant="ghost" 
                    className="w-10 h-10 p-0 rounded-full"
                    onClick={() => setShowEditModal(false)}
                  >
                    <Plus className="rotate-45" size={24} />
                  </Button>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2">
                  {[
                    { id: 'info', label: '基本資訊', icon: Settings },
                    { id: 'students', label: '學員名單', icon: Users },
                    { id: 'coaches', label: '教練管理', icon: ClipboardList },
                    { id: 'attendance', label: '點名紀錄', icon: UserCheck },
                    { id: 'history', label: '異動紀錄', icon: HistoryIcon }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setEditTab(tab.id as any)}
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
                    {editTab === 'info' && (
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <FormField label="課程名稱">
                            <Input defaultValue={selectedCourse.name} />
                          </FormField>
                          <FormField label="上課地點">
                            <Input defaultValue={selectedCourse.location} />
                          </FormField>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField label="上課時段">
                              <Input defaultValue={selectedCourse.time} />
                            </FormField>
                            <FormField label="名額上限">
                              <Input type="number" defaultValue={selectedCourse.maxEnrollment} />
                            </FormField>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <FormField label="課程說明">
                            <textarea 
                              className="w-full min-h-[120px] p-4 rounded-2xl border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                              defaultValue={selectedCourse.description}
                            />
                          </FormField>
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
                                          setSelectedCourse({...selectedCourse, thumbnail: reader.result as string});
                                          addLog(selectedCourse, 'info_update', '更新課程封面');
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
                        </div>
                      </div>
                    )}

                    {editTab === 'students' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">學員名單 ({selectedCourse.students?.length || 0})</h3>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="輸入學員姓名..." 
                              className="w-64 h-10 rounded-xl"
                              id="student-add-input"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddStudent((e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                            />
                            <Button 
                              variant="primary" 
                              className="h-10 px-4 rounded-xl"
                              onClick={() => {
                                const input = document.getElementById('student-add-input') as HTMLInputElement;
                                if (input.value) {
                                  handleAddStudent(input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              <UserPlus size={18} />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          {(selectedCourse.students || []).map((student, i) => (
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

                    {editTab === 'coaches' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">授課教練 ({selectedCourse.coaches.length})</h3>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="輸入教練姓名..." 
                              className="w-64 h-10 rounded-xl"
                              id="coach-add-input"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddCoach((e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                            />
                            <Button 
                              variant="primary" 
                              className="h-10 px-4 rounded-xl"
                              onClick={() => {
                                const input = document.getElementById('coach-add-input') as HTMLInputElement;
                                if (input.value) {
                                  handleAddCoach(input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              <Plus size={18} />
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
                                  <p className="text-xs text-neutral-500">專業羽球教練</p>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                className="text-danger hover:bg-danger/10"
                                onClick={() => handleRemoveCoach(coach)}
                              >
                                <Trash2 size={18} />
                                移除
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                              onChange={(e) => setSelectedDate(e.target.value)}
                            >
                              {(selectedCourse.dates || []).map(date => (
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
                              {(selectedCourse.students || []).map((student, i) => {
                                const status = selectedCourse.attendance?.[selectedDate]?.[student] || 'pending';
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
                                        variant={
                                          status === 'present' ? 'accent' : 
                                          status === 'absent' ? 'danger' : 
                                          status === 'excused' ? 'secondary' : 'neutral'
                                        }
                                        className={status === 'present' ? 'bg-emerald-50 text-emerald-600' : ''}
                                      >
                                        {status === 'present' ? '出席' : 
                                         status === 'absent' ? '缺席' : 
                                         status === 'excused' ? '請假' : '未點名'}
                                      </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex gap-1">
                                        {[
                                          { id: 'present', label: '出', color: 'hover:bg-emerald-500 hover:text-white' },
                                          { id: 'absent', label: '缺', color: 'hover:bg-red-500 hover:text-white' },
                                          { id: 'excused', label: '假', color: 'hover:bg-amber-500 hover:text-white' }
                                        ].map(btn => (
                                          <button
                                            key={btn.id}
                                            onClick={() => handleAttendanceChange(selectedDate, student, btn.id as any)}
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

                    {editTab === 'history' && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">異動紀錄</h3>
                        <div className="space-y-4">
                          {(selectedCourse.changeLogs || []).map(log => (
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
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-8 border-t border-neutral-100 flex items-center justify-end gap-4 bg-neutral-50/50">
                <Button 
                  variant="ghost" 
                  className="w-auto px-8 h-12 rounded-2xl"
                  onClick={() => setShowEditModal(false)}
                >
                  取消
                </Button>
                <Button 
                  variant="primary" 
                  className="w-auto px-12 h-12 rounded-2xl shadow-lg shadow-primary/20"
                  onClick={handleSaveEdit}
                >
                  儲存變更
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Course Modal (Step-by-Step) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                  {[1, 2, 3, 4, 5, 6].map(i => (
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
                    {step === 1 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 1：選擇場地合約</h3>
                        <div className="grid grid-cols-1 gap-4">
                          {contracts.map(contract => {
                            const locationName = contract.venue;
                            const isSelected = newCourseData.location === locationName;
                            return (
                            <div 
                              key={contract.id} 
                              onClick={() => setNewCourseData({ ...newCourseData, location: locationName })}
                              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer group flex items-center justify-between ${
                                isSelected ? 'border-primary bg-primary/5' : 'border-neutral-100 hover:border-primary/30 hover:bg-primary/5'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl shadow-sm flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'bg-white text-primary'}`}>
                                  <MapPin size={24} />
                                </div>
                                <div>
                                  <p className="font-bold text-neutral-900">{contract.venue} - {contract.contractType}</p>
                                  <p className="text-xs text-neutral-500">有效期至 {contract.endDate}</p>
                                </div>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary' : 'border-neutral-200 group-hover:border-primary'}`}>
                                <div className={`w-3 h-3 rounded-full bg-primary transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                              </div>
                            </div>
                          )})}
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 2：填寫課程資料</h3>
                        <div className="grid grid-cols-2 gap-6">
                          <FormField label="課程名稱">
                            <Input 
                              placeholder="例如：中和 [景新國小] 週六 10:00-12:00" 
                              value={newCourseData.name}
                              onChange={(e) => setNewCourseData({ ...newCourseData, name: e.target.value })}
                            />
                          </FormField>
                          <FormField label="課程分類">
                            <Select
                              value={newCourseData.category}
                              onChange={(e) => setNewCourseData({ ...newCourseData, category: e.target.value as any })}
                            >
                              <option value="children">兒童班</option>
                              <option value="adult">成人班</option>
                            </Select>
                          </FormField>
                          <FormField label="上課時間">
                            <Input 
                              placeholder="例如：每週六 10:00-12:00" 
                              value={newCourseData.schedule}
                              onChange={(e) => setNewCourseData({ ...newCourseData, schedule: e.target.value })}
                            />
                          </FormField>
                          <FormField label="名額上限">
                            <Input 
                              type="number" 
                              placeholder="24" 
                              value={newCourseData.maxEnrollment}
                              onChange={(e) => setNewCourseData({ ...newCourseData, maxEnrollment: parseInt(e.target.value) || 24 })}
                            />
                          </FormField>
                        </div>
                        <FormField label="課程說明">
                          <textarea className="w-full min-h-[120px] p-4 rounded-2xl border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm" placeholder="請輸入課程介紹..." />
                        </FormField>
                        <FormField label="課程封面圖">
                          <div className="w-full h-40 border-2 border-dashed border-neutral-200 rounded-3xl flex flex-col items-center justify-center gap-2 text-neutral-400 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                            <Upload size={32} />
                            <span className="text-sm font-medium">點擊或拖曳圖片至此上傳</span>
                          </div>
                        </FormField>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 3：填寫教練資料</h3>
                        <div className="space-y-4">
                          {['林教練', '王教練', '陳教練', '張教練'].map(coach => {
                            const isSelected = newCourseData.coaches?.includes(coach);
                            return (
                            <div 
                              key={coach} 
                              onClick={() => {
                                const currentCoaches = newCourseData.coaches || [];
                                if (isSelected) {
                                  setNewCourseData({ ...newCourseData, coaches: currentCoaches.filter(c => c !== coach) });
                                } else {
                                  setNewCourseData({ ...newCourseData, coaches: [...currentCoaches, coach] });
                                }
                              }}
                              className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                                isSelected ? 'border-primary bg-primary/5' : 'border-neutral-100 hover:border-primary/30'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                  isSelected ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600'
                                }`}>
                                  {coach[0]}
                                </div>
                                <div>
                                  <p className="font-bold text-neutral-900">{coach}</p>
                                  <Badge variant="accent" className="text-[10px] py-0">認證教練</Badge>
                                </div>
                              </div>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                readOnly
                                className="w-5 h-5 rounded border-neutral-300 text-primary focus:ring-primary" 
                              />
                            </div>
                          )})}
                        </div>
                      </div>
                    )}

                    {step === 4 && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-neutral-900">步驟 4：學生報名與費用</h3>
                          <Button variant="ghost" className="text-primary text-sm font-bold" onClick={() => setShowImportModal(true)}>
                            <Plus size={16} /> 匯入現有學員
                          </Button>
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-6">
                            <FormField label="單堂費用">
                              <Input type="number" placeholder="例如：500" />
                            </FormField>
                            <FormField label="全期優惠價 (10 堂)">
                              <Input type="number" placeholder="例如：4500" />
                            </FormField>
                          </div>
                          <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100">
                            <p className="text-sm font-bold text-neutral-900 mb-4 text-center">已加入學員 ({importedStudents.length})</p>
                            {importedStudents.length > 0 ? (
                              <div className="space-y-2">
                                {importedStudents.map((student, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-100">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                                        {student.name[0]}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="font-bold text-neutral-900 text-sm">{student.name}</p>
                                          <Badge variant={student.category === 'adult' ? 'primary' : 'accent'} className="text-[10px] py-0 px-1.5">
                                            {student.category === 'adult' ? '成人' : '兒童'}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-neutral-500">{student.phone}</p>
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => setImportedStudents(prev => prev.filter((_, i) => i !== idx))}
                                      className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                                <Users size={32} className="mb-2 opacity-20" />
                                <p className="text-xs">尚未加入任何學員</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {step === 5 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 5：上課日期確認</h3>
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            '2024/04/06', '2024/04/13', '2024/04/20', '2024/04/27',
                            '2024/05/04', '2024/05/11', '2024/05/18', '2024/05/25',
                            '2024/06/01', '2024/06/08', '2024/06/15', '2024/06/22'
                          ].map((date, i) => (
                            <div 
                              key={date} 
                              className={`p-3 rounded-2xl border-2 text-center cursor-pointer transition-all ${
                                i < 10 ? 'border-primary bg-primary/5 text-primary font-bold' : 'border-neutral-100 text-neutral-400'
                              }`}
                            >
                              <p className="text-[10px] uppercase opacity-60">第 {i + 1} 堂</p>
                              <p className="text-xs">{date.split('/')[1]}/{date.split('/')[2]}</p>
                            </div>
                          ))}
                        </div>
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                            <Clock size={16} />
                          </div>
                          <p className="text-xs text-amber-700 leading-relaxed">
                            系統已根據合約自動帶入建議日期。若有國定假日或場地維修，請手動取消勾選。
                          </p>
                        </div>
                      </div>
                    )}

                    {step === 6 && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-neutral-900">步驟 6：確認刊登</h3>
                        <div className="p-8 rounded-[32px] bg-neutral-50 border border-neutral-100 space-y-6">
                          <div className="flex gap-6">
                            <div className="w-32 h-32 rounded-3xl bg-neutral-200 overflow-hidden shrink-0">
                              <img src="https://picsum.photos/seed/badminton/300/300" alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="space-y-2">
                              <Badge variant="primary">{newCourseData.category === 'adult' ? '成人班' : '兒童班'}</Badge>
                              <h4 className="text-xl font-bold text-neutral-900">{newCourseData.name || '未命名課程'}</h4>
                              <div className="flex flex-wrap gap-4 text-sm text-neutral-500">
                                <div className="flex items-center gap-1.5">
                                  <MapPin size={14} /> {newCourseData.location || '未選擇場地'}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Users size={14} /> {newCourseData.maxEnrollment || 24} 人上限
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={14} /> 共 10 堂課
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200">
                            <div>
                              <p className="text-xs text-neutral-400 mb-1 uppercase tracking-wider font-bold">教練名單</p>
                              <p className="text-sm font-bold text-neutral-900">{newCourseData.coaches?.join('、') || '尚未選擇教練'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-400 mb-1 uppercase tracking-wider font-bold">費用資訊</p>
                              <p className="text-sm font-bold text-neutral-900">單堂 NT$ 500 / 全期 NT$ 4,500</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 text-primary">
                          <Check size={20} className="shrink-0" />
                          <p className="text-xs font-medium">確認無誤後點擊「確認刊登」，課程將立即顯示在前端報名頁面。</p>
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
                  onClick={() => step < 6 ? setStep(step + 1) : handleAddCourse()}
                >
                  {step === 6 ? '確認刊登' : <>下一步 <ChevronRight size={18} /></>}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Students Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-neutral-100 flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-neutral-900">匯入現有學員</h2>
                  <button 
                    onClick={() => setShowImportModal(false)}
                    className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                  >
                    <X size={20} className="text-neutral-500" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportCategory('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      importCategory === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => setImportCategory('children')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      importCategory === 'children' ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    兒童班
                  </button>
                  <button
                    onClick={() => setImportCategory('adult')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      importCategory === 'adult' ? 'bg-accent text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    成人班
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-4">
                  {[
                    { name: '王小明', phone: '0912-345-678', category: 'children' as const },
                    { name: '李大華', phone: '0923-456-789', category: 'adult' as const },
                    { name: '張小美', phone: '0934-567-890', category: 'children' as const },
                    { name: '陳阿呆', phone: '0945-678-901', category: 'children' as const },
                    { name: '林聰明', phone: '0956-789-012', category: 'adult' as const }
                  ]
                  .filter(student => importCategory === 'all' || student.category === importCategory)
                  .map((student, idx) => {
                    const isSelected = importedStudents.some(s => s.name === student.name);
                    return (
                      <div 
                        key={idx}
                        onClick={() => {
                          if (isSelected) {
                            setImportedStudents(prev => prev.filter(s => s.name !== student.name));
                          } else {
                            setImportedStudents(prev => [...prev, student]);
                          }
                        }}
                        className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected ? 'border-primary bg-primary/5' : 'border-neutral-100 hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            isSelected ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            {student.name[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-neutral-900">{student.name}</p>
                              <Badge variant={student.category === 'adult' ? 'primary' : 'accent'} className="text-[10px] py-0 px-1.5">
                                {student.category === 'adult' ? '成人' : '兒童'}
                              </Badge>
                            </div>
                            <p className="text-xs text-neutral-500">{student.phone}</p>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          readOnly
                          className="w-5 h-5 rounded border-neutral-300 text-primary focus:ring-primary" 
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-neutral-100 bg-neutral-50 shrink-0">
                <Button className="w-full" onClick={() => setShowImportModal(false)}>
                  確認匯入 ({importedStudents.length})
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
