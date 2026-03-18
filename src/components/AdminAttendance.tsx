import React, { useState, useEffect } from 'react';
import { Activity, Download, Filter, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button, Badge } from './UI';
import { supabase } from '../lib/supabase';

export const AdminAttendance: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<{week: string, rate: number}[]>([])

  useEffect(() => {
    const fetchAttendance = async () => {
      const { data } = await supabase
        .from('attendance')
        .select('date, status')
        .order('date')

      if (data && data.length > 0) {
        const grouped: Record<string, { total: number, present: number }> = {}
        data.forEach((a, idx) => {
          const weekNum = `第${Math.floor(idx / 7) + 1}週`
          if (!grouped[weekNum]) grouped[weekNum] = { total: 0, present: 0 }
          grouped[weekNum].total++
          if (a.status === '出席') grouped[weekNum].present++
        })
        setAttendanceData(Object.entries(grouped).map(([week, v]) => ({
          week,
          rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
        })))
      }
    }
    fetchAttendance()
  }, [])

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900 whitespace-nowrap">出席率統計</h2>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none"><Filter size={18} /> 篩選</Button>
          <Button variant="primary" className="flex-1 sm:flex-none"><Download size={18} /> 匯出報表</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">本月平均出席率</p>
              <h3 className="text-2xl font-bold text-neutral-900">-</h3>
            </div>
          </div>
          <Badge variant="accent" className="text-xs">—</Badge>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">最高出席班級</p>
              <h3 className="text-lg font-bold text-neutral-900 truncate">-</h3>
            </div>
          </div>
          <Badge variant="accent" className="text-xs">-</Badge>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center text-danger">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">需關注班級</p>
              <h3 className="text-lg font-bold text-neutral-900 truncate">-</h3>
            </div>
          </div>
          <Badge variant="danger" className="text-xs">-</Badge>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
        <h3 className="text-lg font-bold text-neutral-900 mb-8">整體出席率趨勢</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={attendanceData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3', fontSize: 12 }} dx={-10} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="rate" 
                name="出席率"
                stroke="#F97316" 
                strokeWidth={4}
                dot={{ r: 6, fill: '#F97316', strokeWidth: 0 }}
                activeDot={{ r: 8, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
