import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Download, Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Button, Badge } from './UI';
import { supabase } from '../lib/supabase';

export const AdminRevenue: React.FC = () => {
  const [revenueData, setRevenueData] = useState<{month: string, revenue: number, expenses: number}[]>([])

  useEffect(() => {
    const fetchRevenue = async () => {
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .order('payment_date')

      if (payments && payments.length > 0) {
        const grouped: Record<string, number> = {}
        payments.forEach(p => {
          const date = new Date(p.payment_date)
          const monthKey = `${date.getMonth() + 1}月`
          grouped[monthKey] = (grouped[monthKey] || 0) + (p.amount || 0)
        })
        setRevenueData(Object.entries(grouped).map(([month, revenue]) => ({
          month,
          revenue,
          expenses: 0,
        })))
      }
    }
    fetchRevenue()
  }, [])

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900 whitespace-nowrap">營收管理</h2>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none"><Filter size={18} /> 篩選</Button>
          <Button variant="primary" className="flex-1 sm:flex-none"><Download size={18} /> 匯出報表</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">本月總營收</p>
              <h3 className="text-2xl font-bold text-neutral-900">NT$ 420,000</h3>
            </div>
          </div>
          <Badge variant="accent" className="text-xs">+8.5% 較上月</Badge>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center text-danger">
              <TrendingUp size={24} className="rotate-180" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">本月總支出</p>
              <h3 className="text-2xl font-bold text-neutral-900">NT$ 180,000</h3>
            </div>
          </div>
          <Badge variant="danger" className="text-xs">+2.1% 較上月</Badge>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">本月淨利潤</p>
              <h3 className="text-2xl font-bold text-neutral-900">NT$ 240,000</h3>
            </div>
          </div>
          <Badge variant="accent" className="text-xs">+12.4% 較上月</Badge>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
        <h3 className="text-lg font-bold text-neutral-900 mb-8">營收與支出趨勢</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3', fontSize: 12 }} dx={-10} tickFormatter={(value) => `$${value / 1000}k`} />
              <Tooltip 
                cursor={{ fill: '#F5F5F5' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
              />
              <Bar dataKey="revenue" name="營收" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="支出" fill="#F43F5E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
