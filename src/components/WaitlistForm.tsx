import React, { useState } from 'react';
import { User, Phone, MessageSquare, AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Button, FormField, Input, Select } from './UI';
import { Course } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface WaitlistFormProps {
  course: Course;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export const WaitlistForm: React.FC<WaitlistFormProps> = ({ course, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    contactName: '',
    phone: '',
    students: [
      { name: '', age: '', experience: 'none' }
    ],
    note: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const addStudent = () => {
    setFormData({
      ...formData,
      students: [...formData.students, { name: '', age: '', experience: 'none' }]
    });
  };

  const removeStudent = (index: number) => {
    if (formData.students.length <= 1) return;
    setFormData({
      ...formData,
      students: formData.students.filter((_, i) => i !== index)
    });
  };

  const updateStudent = (index: number, field: string, value: string) => {
    const newStudents = [...formData.students];
    newStudents[index] = { ...newStudents[index], [field]: value };
    setFormData({ ...formData, students: newStudents });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    setTimeout(() => {
      setIsSubmitted(true);
      setTimeout(() => {
        onSubmit({
          ...formData,
          courseId: course.id,
          courseName: course.name,
          date: new Date().toLocaleDateString(),
          status: 'waiting'
        });
      }, 1500);
    }, 800);
  };

  if (isSubmitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12 text-center gap-4"
      >
        <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center text-accent">
          <CheckCircle2 size={48} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-neutral-900">候補申請已送出</h3>
          <p className="text-neutral-600">
            我們已收到您的候補申請。<br />
            若有名額釋出，教練將會主動聯繫您！
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar px-1">
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
        <AlertCircle className="text-amber-600 shrink-0" size={20} />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-bold mb-1">候補說明：</p>
          <p>目前「{course.name}」名額已滿，加入候補不代表報名成功。若有學員退課或有名額釋出，系統將依序通知候補人員。</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="聯絡人姓名">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <Input 
                required
                placeholder="請輸入姓名"
                className="pl-11"
                value={formData.contactName}
                onChange={e => setFormData({ ...formData, contactName: e.target.value })}
              />
            </div>
          </FormField>

          <FormField label="聯絡電話">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <Input 
                required
                type="tel"
                placeholder="請輸入手機號碼"
                className="pl-11"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </FormField>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              學員名單 ({formData.students.length})
            </h3>
            <button 
              type="button"
              onClick={addStudent}
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
            >
              <Plus size={14} /> 新增學員
            </button>
          </div>

          <div className="space-y-4">
            {formData.students.map((student, index) => (
              <div key={index} className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 space-y-4 relative group">
                {formData.students.length > 1 && (
                  <button 
                    type="button"
                    onClick={() => removeStudent(index)}
                    className="absolute top-2 right-2 p-1 text-neutral-400 hover:text-danger transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label={`學員 ${index + 1} 姓名`}>
                    <Input 
                      required
                      placeholder="姓名"
                      value={student.name}
                      onChange={e => updateStudent(index, 'name', e.target.value)}
                    />
                  </FormField>
                  <FormField label="年齡">
                    <Input 
                      required
                      placeholder="例如：8歲"
                      value={student.age}
                      onChange={e => updateStudent(index, 'age', e.target.value)}
                    />
                  </FormField>
                  <FormField label="羽球程度">
                    <Select 
                      value={student.experience}
                      onChange={e => updateStudent(index, 'experience', e.target.value)}
                    >
                      <option value="none">完全初學</option>
                      <option value="basic">已有基礎</option>
                      <option value="intermediate">進階程度</option>
                    </Select>
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        </div>

        <FormField label="備註事項 (選填)">
          <div className="relative">
            <MessageSquare className="absolute left-4 top-3 text-neutral-400" size={18} />
            <textarea 
              className="w-full min-h-[80px] p-4 pl-11 rounded-input border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
              placeholder="是否有特殊需求或想詢問教練的事項？"
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
            />
          </div>
        </FormField>
      </div>

      <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" variant="primary" className="flex-[2]">
          確認送出候補
        </Button>
      </div>
    </form>
  );
};
