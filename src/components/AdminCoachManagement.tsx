import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Edit2, Trash2, Mail, Phone, User, Star, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { Button, Input, Badge, FormField } from './UI';
import { supabase } from '../lib/supabase';

export const AdminCoachManagement: React.FC = () => {
  const [coaches, setCoaches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCoaches = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('coaches')
      .select('*')
      .order('name')
    if (data) {
      setCoaches(data.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        specialties: c.specialization ? c.specialization.split(',').map((s: string) => s.trim()) : [],
        rating: 0,
        status: c.is_active ? 'active' : 'inactive',
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCoaches()
  }, [])

  const [showAddModal, setShowAddModal] = useState(false);
  const [newCoach, setNewCoach] = useState({ name: '', phone: '', email: '', specialties: '' });

  const handleAddCoach = async () => {
    if (!newCoach.name) return
    const { error } = await supabase.from('coaches').insert({
      name: newCoach.name,
      phone: newCoach.phone,
      email: newCoach.email,
      specialization: newCoach.specialties,
      is_active: true,
    })
    if (!error) {
      await fetchCoaches()
      setShowAddModal(false)
      setNewCoach({ name: '', phone: '', email: '', specialties: '' })
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900 whitespace-nowrap">教練管理</h2>
        <Button variant="primary" onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
          <Plus size={18} /> 新增教練
        </Button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <Input type="text" placeholder="搜尋教練姓名、專長..." className="pl-12" />
          </div>
          <Button variant="outline" className="w-full sm:w-auto">
            <Filter size={18} /> 篩選
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 text-neutral-500 text-sm">
                <th className="p-4 font-medium first:pl-6">教練資訊</th>
                <th className="p-4 font-medium">聯絡方式</th>
                <th className="p-4 font-medium">專長領域</th>
                <th className="p-4 font-medium">評價</th>
                <th className="p-4 font-medium">狀態</th>
                <th className="p-4 font-medium text-right last:pr-6">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {coaches.map((coach) => (
                <tr key={coach.id} className="hover:bg-neutral-50/50 transition-colors group">
                  <td className="p-4 first:pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {coach.name[0]}
                      </div>
                      <span className="font-bold text-neutral-900">{coach.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 text-sm text-neutral-600">
                      <div className="flex items-center gap-1.5"><Phone size={14} /> {coach.phone}</div>
                      <div className="flex items-center gap-1.5"><Mail size={14} /> {coach.email}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {coach.specialties.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                      <Star size={16} className="fill-current" /> {coach.rating}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={coach.status === 'active' ? 'accent' : 'danger'}>
                      {coach.status === 'active' ? '在職' : '離職'}
                    </Badge>
                  </td>
                  <td className="p-4 text-right last:pr-6">
                    <button className="p-2 text-neutral-400 hover:text-primary transition-colors rounded-lg hover:bg-primary/10">
                      <Edit2 size={18} />
                    </button>
                    <button className="p-2 text-neutral-400 hover:text-danger transition-colors rounded-lg hover:bg-danger/10">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl"
          >
            <h3 className="text-2xl font-bold text-neutral-900 mb-6">新增教練</h3>
            <div className="space-y-4">
              <FormField label="教練姓名">
                <Input value={newCoach.name} onChange={e => setNewCoach({...newCoach, name: e.target.value})} placeholder="例如：林教練" />
              </FormField>
              <FormField label="聯絡電話">
                <Input value={newCoach.phone} onChange={e => setNewCoach({...newCoach, phone: e.target.value})} placeholder="例如：0912-345-678" />
              </FormField>
              <FormField label="電子郵件">
                <Input value={newCoach.email} onChange={e => setNewCoach({...newCoach, email: e.target.value})} placeholder="例如：coach@example.com" />
              </FormField>
              <FormField label="專長領域 (用逗號分隔)">
                <Input value={newCoach.specialties} onChange={e => setNewCoach({...newCoach, specialties: e.target.value})} placeholder="例如：兒童體適能, 初階羽球" />
              </FormField>
              <div className="flex gap-4 pt-4">
                <Button variant="ghost" className="flex-1" onClick={() => setShowAddModal(false)}>取消</Button>
                <Button variant="primary" className="flex-1" onClick={handleAddCoach}>確認新增</Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
