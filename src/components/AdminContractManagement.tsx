import React, { useState, useMemo, useEffect } from 'react';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

import {
  Plus,
  FileText,
  Clock,
  Calendar, 
  MapPin, 
  AlertCircle, 
  ChevronRight, 
  Pause, 
  Play, 
  Trash2, 
  Upload, 
  X,
  History,
  CheckCircle2,
  Image as ImageIcon,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Badge, Input, Select, FormField } from './UI';
import { supabase } from '../lib/supabase';
import { 
  VenueContract, 
  ContractSlot, 
  WeeklyScheduleItem, 
  ContractLog, 
  ContractPhoto 
} from '../types';

// --- Helper Functions ---

const getDaysUntilExpiry = (endDate: string) => {
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(amount);
};

const generateWeeklySchedule = (startDate: string, endDate: string, slots: ContractSlot[]): WeeklyScheduleItem[] => {
  if (!startDate || !endDate || slots.length === 0) return [];
  
  const schedule: WeeklyScheduleItem[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysMap: { [key: string]: number } = {
    '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6, '週日': 0
  };

  const targetDays = slots.map(slot => daysMap[slot.day]);
  
  let current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (targetDays.includes(dayOfWeek)) {
      const weekdayStr = Object.keys(daysMap).find(key => daysMap[key] === dayOfWeek) || '';
      const daySlots = slots.filter(s => s.day === weekdayStr).map(s => `${s.time} (${s.courts})`);
      
      schedule.push({
        dateStr: formatLocalDate(current).replace(/-/g, '/'),
        weekday: weekdayStr,
        timeSlots: daySlots,
        paused: false,
        note: ''
      });
    }
    current.setDate(current.getDate() + 1);
  }
  
  return schedule;
};

// --- Sub-components ---

const SlotEditor: React.FC<{ 
  slots: ContractSlot[]; 
  onChange: (slots: ContractSlot[]) => void 
}> = ({ slots, onChange }) => {
  const addSlot = () => {
    onChange([...slots, { day: '週一', time: '10:00-12:00', courts: '1 面' }]);
  };

  const removeSlot = (index: number) => {
    onChange(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof ContractSlot, value: string) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    onChange(newSlots);
  };

  return (
    <div className="space-y-3">
      {slots.map((slot, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select 
            value={slot.day} 
            onChange={(e) => updateSlot(index, 'day', e.target.value)}
            className="w-24"
          >
            {['週一', '週二', '週三', '週四', '週五', '週六', '週日'].map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
          <Input 
            type="text" 
            value={slot.time} 
            onChange={(e) => updateSlot(index, 'time', e.target.value)}
            placeholder="時段 (如 14:00-16:00)"
            className="w-40"
          />
          <Input 
            type="text" 
            value={slot.courts} 
            onChange={(e) => updateSlot(index, 'courts', e.target.value)}
            placeholder="場地/面數 (如 羽球A場, 羽球B場)"
            className="flex-1"
          />
          <button 
            onClick={() => removeSlot(index)}
            className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
      <button 
        onClick={addSlot}
        className="w-full py-3 border-2 border-dashed border-primary/30 text-primary rounded-xl hover:bg-primary/5 transition-all flex items-center justify-center gap-2 font-medium"
      >
        <Plus size={18} />
        新增時段
      </button>
    </div>
  );
};

const WeeklySchedule: React.FC<{ 
  schedule: WeeklyScheduleItem[]; 
  onTogglePause: (index: number) => void;
  onNoteChange: (index: number, note: string) => void;
  readOnly?: boolean;
}> = ({ schedule, onTogglePause, onNoteChange, readOnly }) => {
  const stats = useMemo(() => {
    const total = schedule.length;
    const paused = schedule.filter(s => s.paused).length;
    return { total, paused, normal: total - paused };
  }, [schedule]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Badge variant="neutral" className="bg-primary/10 text-primary">共 {stats.total} 週</Badge>
        <Badge variant="accent">正常 {stats.normal} 週</Badge>
        {stats.paused > 0 && <Badge variant="warning">暫停 {stats.paused} 週</Badge>}
      </div>
      
      <div className="max-h-[360px] overflow-y-auto pr-2 space-y-2 no-scrollbar border border-neutral-100 rounded-xl p-2">
        {schedule.map((item, index) => (
          <div 
            key={index} 
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${item.paused ? 'bg-warning/5 border border-warning/20' : 'bg-white border border-neutral-50'}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${item.paused ? 'bg-warning text-white' : 'bg-primary/10 text-primary'}`}>
              W{index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm ${item.paused ? 'text-warning' : 'text-neutral-900'}`}>{item.dateStr}</span>
                <Badge variant={item.paused ? 'warning' : 'accent'} className="text-[10px] py-0 px-1.5">
                  {item.paused ? '暫停' : '正常'}
                </Badge>
              </div>
              <p className="text-[10px] text-neutral-400 truncate">
                {item.weekday} {item.timeSlots.join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input 
                placeholder={item.paused ? "暫停原因" : "備註"}
                value={item.note}
                onChange={(e) => onNoteChange(index, e.target.value)}
                className={`h-8 text-xs w-32 ${item.paused ? 'bg-warning/10 border-warning/30' : ''}`}
                disabled={readOnly}
              />
              {!readOnly && (
                <button 
                  onClick={() => onTogglePause(index)}
                  className={`p-1.5 rounded-lg transition-colors ${item.paused ? 'text-accent hover:bg-accent/10' : 'text-warning hover:bg-warning/10'}`}
                >
                  {item.paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChangeLog: React.FC<{ logs: ContractLog[] }> = ({ logs }) => {
  const [expanded, setExpanded] = useState(false);
  const displayedLogs = expanded ? logs : logs.slice(-5).reverse();

  const getLogBadge = (type: string) => {
    const map: { [key: string]: { text: string; variant: any } } = {
      created: { text: '新增合約', variant: 'accent' },
      renewed: { text: '續約', variant: 'secondary' },
      edit_venue: { text: '場館名稱', variant: 'secondary' },
      edit_address: { text: '場地地址', variant: 'secondary' },
      edit_dates: { text: '合約期間', variant: 'warning' },
      edit_rent: { text: '場租費用', variant: 'warning' },
      edit_paid: { text: '繳費狀態', variant: 'accent' },
      edit_type: { text: '合約類型', variant: 'neutral' },
      edit_slots: { text: '場租時段', variant: 'secondary' },
      edit_schedule_pause: { text: '週次暫停', variant: 'warning' },
      edit_schedule_resume: { text: '週次恢復', variant: 'accent' },
      edit_photos: { text: '合約照片', variant: 'neutral' },
    };
    const info = map[type] || { text: '變更', variant: 'neutral' };
    return <Badge variant={info.variant}>{info.text}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-neutral-600">
        <Clock size={18} />
        <h4 className="font-bold">異動紀錄 <span className="text-neutral-400 font-normal">(共 {logs.length} 筆)</span></h4>
      </div>
      <div className="border border-neutral-100 rounded-xl overflow-hidden divide-y divide-neutral-50">
        {displayedLogs.map((log, index) => (
          <div key={index} className="p-3 flex items-start gap-4 text-xs">
            <span className="text-neutral-400 w-32 flex-shrink-0">{log.time}</span>
            <div className="flex-shrink-0">{getLogBadge(log.type)}</div>
            <div className="flex-1 text-neutral-600">
              {log.from && log.to ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-danger/10 text-danger px-1 line-through">{log.from}</span>
                  <ChevronRight size={12} className="text-neutral-300" />
                  <span className="bg-accent/10 text-accent px-1">{log.to}</span>
                </div>
              ) : (
                <span>{log.desc}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {logs.length > 5 && (
        <Button variant="ghost" onClick={() => setExpanded(!expanded)} className="h-10 text-xs">
          {expanded ? '收合紀錄 ▲' : `展開全部 ${logs.length} 筆 ▼`}
        </Button>
      )}
    </div>
  );
};

const PhotoUploader: React.FC<{ 
  photos: ContractPhoto[]; 
  onChange: (photos: ContractPhoto[]) => void 
}> = ({ photos, onChange }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = (Array.from(files) as File[]).filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );

    if (fileList.length === 0) {
      alert('只允許上傳圖片或 PDF 檔案');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const uploadedPhotos: ContractPhoto[] = [];
    let processed = 0;

    fileList.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          uploadedPhotos.push({ 
            name: file.name, 
            url: event.target.result as string 
          });
        }
        processed++;
        if (processed === fileList.length) {
          onChange([...photos, ...uploadedPhotos]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  const isImage = (url: string) => {
    return url.startsWith('data:image/') || 
           url.match(/\.(jpeg|jpg|gif|png)$/i);
  };

  return (
    <div className="space-y-3">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*,.pdf"
        multiple
      />
      <div className="grid grid-cols-4 gap-3">
        {photos.map((photo, index) => (
          <div key={index} className="relative group aspect-[3/4] rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
            {isImage(photo.url) ? (
              <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-neutral-400">
                <FileText size={32} />
                <span className="text-[10px] mt-2 text-center break-all line-clamp-2">{photo.name}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button onClick={() => removePhoto(index)} className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white">
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="aspect-[3/4] rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-2 text-neutral-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
        >
          <Upload size={24} />
          <span className="text-xs font-medium text-center px-2">上傳照片/PDF</span>
        </button>
      </div>
    </div>
  );
};

// --- Main Component ---

interface AdminContractManagementProps {
  contracts: VenueContract[];
  setContracts: React.Dispatch<React.SetStateAction<VenueContract[]>>;
}

export const AdminContractManagement: React.FC<AdminContractManagementProps> = ({ contracts, setContracts }) => {
  const [loading, setLoading] = useState(true)

  const fetchContracts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('venue_contracts')
      .select('*, venues(name, address)')
      .order('end_date')
    if (data) {
      setContracts(data.map(c => ({
        id: c.id,
        venue: c.venues?.name || '',
        address: c.venues?.address || '',
        startDate: c.start_date,
        endDate: c.end_date,
        rent: c.rent || 0,
        paid: c.paid || false,
        contractType: c.contract_type || '',
        slots: c.slots || [],
        schedule: c.schedule || [],
        photos: c.photos || [],
        logs: c.logs || [],
        daysUntilExpiry: Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchContracts()
  }, [])

  const [modalMode, setModalMode] = useState<'add' | 'view' | 'edit' | 'renew' | null>(null);
  const [selectedContract, setSelectedContract] = useState<VenueContract | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<VenueContract>>({});

  const expiringContracts = useMemo(() => {
    return contracts.filter(c => c.daysUntilExpiry <= 30);
  }, [contracts]);

  const openModal = (mode: 'add' | 'view' | 'edit' | 'renew', contract?: VenueContract) => {
    setModalMode(mode);
    if (contract) {
      setSelectedContract(contract);
      setFormData({ ...contract });
    } else {
      setSelectedContract(null);
      setFormData({
        venue: '',
        address: '',
        startDate: '',
        endDate: '',
        rent: 0,
        contractType: '季租',
        paid: false,
        slots: [],
        schedule: [],
        photos: [],
        logs: []
      });
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedContract(null);
    setFormData({});
  };

  // Auto-generate schedule when dates or slots change
  useEffect(() => {
    if (modalMode === 'add' || modalMode === 'edit' || modalMode === 'renew') {
      if (formData.startDate && formData.endDate && formData.slots && formData.slots.length > 0) {
        const newSchedule = generateWeeklySchedule(formData.startDate, formData.endDate, formData.slots);
        
        // Preserve paused state if editing
        if (selectedContract && selectedContract.schedule) {
          newSchedule.forEach(item => {
            const oldItem = selectedContract.schedule.find(oi => oi.dateStr === item.dateStr);
            if (oldItem) {
              item.paused = oldItem.paused;
              item.note = oldItem.note;
            }
          });
        }
        
        setFormData(prev => ({ ...prev, schedule: newSchedule }));
      }
    }
  }, [formData.startDate, formData.endDate, formData.slots, modalMode]);

  const handleSave = async () => {
    const now = new Date().toLocaleString('zh-TW', { hour12: false }).replace(/\//g, '/');

    if (modalMode === 'add') {
      // 先新增或查找場地
      let venueId = null
      const { data: existingVenue } = await supabase
        .from('venues')
        .select('id')
        .eq('name', formData.venue)
        .single()

      if (existingVenue) {
        venueId = existingVenue.id
      } else {
        const { data: newVenue } = await supabase
          .from('venues')
          .insert({ name: formData.venue, address: formData.address })
          .select('id')
          .single()
        venueId = newVenue?.id
      }

      // 新增合約
      const { error } = await supabase.from('venue_contracts').insert({
        venue_id: venueId,
        start_date: formData.startDate,
        end_date: formData.endDate,
        rent: formData.rent,
        paid: formData.paid || false,
        contract_type: formData.contractType,
        slots: formData.slots || [],
        schedule: formData.schedule || [],
        photos: formData.photos || [],
        logs: [{ time: now, type: 'created', desc: '初始合約建立' }],
      })
      if (!error) await fetchContracts()
    } else if (modalMode === 'edit' && selectedContract) {
      const newLogs: ContractLog[] = [...(selectedContract.logs || [])];
      
      // Diffing
      const diffFields: { field: keyof VenueContract; type: ContractLog['type']; label: string }[] = [
        { field: 'venue', type: 'edit_venue', label: '場館名稱' },
        { field: 'address', type: 'edit_address', label: '場地地址' },
        { field: 'startDate', type: 'edit_dates', label: '合約起始日' },
        { field: 'endDate', type: 'edit_dates', label: '合約到期日' },
        { field: 'rent', type: 'edit_rent', label: '場租費用' },
        { field: 'paid', type: 'edit_paid', label: '繳費狀態' },
        { field: 'contractType', type: 'edit_type', label: '合約類型' },
      ];

      diffFields.forEach(({ field, type }) => {
        if (formData[field] !== selectedContract[field]) {
          newLogs.push({
            time: now,
            type,
            from: String(selectedContract[field]),
            to: String(formData[field])
          });
        }
      });

      const updatedContract: VenueContract = {
        ...selectedContract,
        ...formData,
        logs: newLogs,
        daysUntilExpiry: getDaysUntilExpiry(formData.endDate!)
      } as VenueContract;

      setContracts(contracts.map(c => c.id === selectedContract.id ? updatedContract : c));

      // Supabase update
      const { error } = await supabase.from('venue_contracts').update({
        rent: formData.rent,
        paid: formData.paid,
        contract_type: formData.contractType,
        start_date: formData.startDate,
        end_date: formData.endDate,
        slots: formData.slots,
        schedule: formData.schedule,
        photos: formData.photos,
        logs: newLogs,
      }).eq('id', selectedContract.id)
      if (!error) await fetchContracts()
    } else if (modalMode === 'renew' && selectedContract) {
      const updatedContract: VenueContract = {
        ...selectedContract,
        ...formData,
        logs: [
          ...(selectedContract.logs || []),
          { 
            time: now, 
            type: 'renewed', 
            from: `${selectedContract.startDate} - ${selectedContract.endDate}`,
            to: `${formData.startDate} - ${formData.endDate}` 
          }
        ],
        daysUntilExpiry: getDaysUntilExpiry(formData.endDate!)
      } as VenueContract;
      setContracts(contracts.map(c => c.id === selectedContract.id ? updatedContract : c));

      // Supabase update for renew
      const { error } = await supabase.from('venue_contracts').update({
        rent: formData.rent,
        paid: formData.paid,
        contract_type: formData.contractType,
        start_date: formData.startDate,
        end_date: formData.endDate,
        slots: formData.slots,
        schedule: formData.schedule,
        photos: formData.photos,
        logs: updatedContract.logs,
      }).eq('id', selectedContract.id)
      if (!error) await fetchContracts()
    }

    closeModal();
  };

  const handleConfirmPayment = (id: number) => {
    const now = new Date().toLocaleString('zh-TW', { hour12: false }).replace(/\//g, '/');
    setContracts(contracts.map(c => {
      if (c.id === id) {
        return {
          ...c,
          paid: true,
          logs: [...c.logs, { time: now, type: 'edit_paid', from: '待繳費', to: '已繳費' }]
        };
      }
      return c;
    }));
    if (selectedContract?.id === id) {
      setSelectedContract(prev => prev ? { ...prev, paid: true } : null);
    }
  };

  return (
    <div className="max-w-[1120px] mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          onClick={() => openModal('add')}
          className="h-14 rounded-2xl shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          新增合約
        </Button>
      </div>

      {/* Contract Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {contracts.map(contract => (
          <motion.div 
            key={contract.id}
            whileHover={{ y: -4 }}
            className="bg-white rounded-card shadow-card border border-neutral-100 overflow-hidden flex flex-col"
          >
            <div className="p-6 space-y-6 flex-1">
              {/* Title Row */}
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">{contract.venue}</h3>
                    <p className="text-xs text-neutral-400">{contract.address}</p>
                  </div>
                </div>
                <Badge variant={contract.paid ? 'accent' : 'danger'}>
                  {contract.paid ? '已繳費' : '待繳費'}
                </Badge>
              </div>

              {/* Info Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-50 p-3 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">合約期間</p>
                  <p className="text-xs font-bold text-neutral-700">{contract.startDate} - {contract.endDate}</p>
                </div>
                <div className="bg-neutral-50 p-3 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">場租費用</p>
                  <p className="text-xs font-bold text-neutral-700">{formatCurrency(contract.rent)}</p>
                </div>
              </div>

              {/* Slots */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">場租時間表</p>
                <div className="flex flex-wrap gap-2">
                  {contract.slots.map((slot, i) => (
                    <Badge key={i} variant="neutral" className="bg-primary/5 text-primary border border-primary/10">
                      {slot.day} {slot.time} ({slot.courts})
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-neutral-400">
                <div className="flex items-center gap-1.5 text-xs">
                  <Calendar size={14} />
                  <span>共 {contract.schedule.length} 週，暫停 {contract.schedule.filter(s => s.paused).length} 週</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-secondary">
                  <Clock size={14} />
                  <span>已有 {contract.logs.length} 筆異動紀錄</span>
                </div>
              </div>

              {/* Expiry Warning */}
              {contract.daysUntilExpiry <= 30 && (
                <div className="bg-danger/10 p-3 rounded-xl flex items-center gap-2 text-danger">
                  <AlertCircle size={16} />
                  <span className="text-xs font-bold">合約將於 {contract.daysUntilExpiry} 天後到期</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 bg-neutral-50/50 border-t border-neutral-50 flex gap-2">
              <Button variant="outline" onClick={() => openModal('view', contract)} className="h-10 text-xs border-neutral-200 text-neutral-600 bg-white">查看</Button>
              <Button 
                variant="outline" 
                onClick={() => openModal('edit', contract)} 
                className="h-10 text-xs border-secondary/30 text-secondary bg-secondary/5 hover:bg-secondary/10"
              >
                異動
              </Button>
              <Button onClick={() => openModal('renew', contract)} className="h-10 text-xs">續約</Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Expiry Alert Section */}
      {expiringContracts.length > 0 && (
        <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center text-danger flex-shrink-0">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h4 className="text-danger font-bold text-lg">合約即將到期提醒</h4>
              <div className="space-y-2 mt-2">
                {expiringContracts.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-danger/10 last:border-0">
                    <p className="text-sm text-neutral-700">
                      <span className="font-bold">{c.venue}</span> 將於 {c.daysUntilExpiry} 天後到期
                    </p>
                    <Button 
                      variant="primary" 
                      onClick={() => openModal('renew', c)}
                      className="h-8 px-4 text-[10px] bg-danger hover:bg-danger/90 w-auto"
                    >
                      立即處理
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-[720px] rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 overflow-y-auto no-scrollbar space-y-8">
                {/* Modal Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-neutral-900">
                    {modalMode === 'add' ? '新增場地合約' : 
                     modalMode === 'view' ? '合約詳理' : 
                     modalMode === 'edit' ? '合約異動' : '續約新一季'}
                  </h2>
                  <button onClick={closeModal} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                    <X size={24} className="text-neutral-400" />
                  </button>
                </div>

                {modalMode === 'edit' && (
                  <div className="bg-secondary/5 p-4 rounded-xl flex items-center gap-3 text-secondary border border-secondary/10">
                    <Clock size={18} />
                    <p className="text-sm font-medium">修改後系統將自動記錄所有異動項目與時間</p>
                  </div>
                )}

                {modalMode === 'renew' && (
                  <div className="bg-primary/5 p-4 rounded-xl flex items-center gap-3 text-primary border border-primary/10">
                    <History size={18} />
                    <p className="text-sm font-medium">目前合約：{selectedContract?.startDate} ~ {selectedContract?.endDate}，場租 {formatCurrency(selectedContract?.rent || 0)}</p>
                  </div>
                )}

                {/* Form Content */}
                <div className="space-y-6">
                  {modalMode === 'view' ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-50 p-4 rounded-2xl flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">場館名稱</p>
                            <p className="font-bold text-neutral-900">{selectedContract?.venue}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={selectedContract?.paid ? 'accent' : 'danger'}>
                              {selectedContract?.paid ? '已繳費' : '待繳費'}
                            </Badge>
                            {!selectedContract?.paid && (
                              <Button 
                                onClick={() => handleConfirmPayment(selectedContract!.id)}
                                className="h-8 px-3 text-[10px] bg-accent hover:bg-accent/90 w-auto"
                              >
                                確認繳費
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="bg-neutral-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">場地地址</p>
                          <p className="font-bold text-neutral-900">{selectedContract?.address}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">合約期間</p>
                          <p className="font-bold text-neutral-900">{selectedContract?.startDate} - {selectedContract?.endDate}</p>
                        </div>
                        <div className="bg-neutral-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">場租費用</p>
                          <p className="font-bold text-neutral-900">{formatCurrency(selectedContract?.rent || 0)}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-neutral-900">場租時間表</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedContract?.slots.map((slot, i) => (
                            <Badge key={i} variant="neutral" className="bg-primary/5 text-primary border border-primary/10 py-1.5 px-3">
                              {slot.day} {slot.time} ({slot.courts})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="場館名稱">
                          <Input 
                            value={formData.venue} 
                            onChange={e => setFormData({ ...formData, venue: e.target.value })}
                            placeholder="如：景新國小"
                          />
                        </FormField>
                        <FormField label="場地地址">
                          <Input 
                            value={formData.address} 
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            placeholder="完整地址"
                          />
                        </FormField>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="合約起始日">
                          <Input 
                            type="date"
                            value={formData.startDate?.replace(/\//g, '-')} 
                            onChange={e => setFormData({ ...formData, startDate: e.target.value.replace(/-/g, '/') })}
                          />
                        </FormField>
                        <FormField label="合約到期日">
                          <Input 
                            type="date"
                            value={formData.endDate?.replace(/\//g, '-')} 
                            onChange={e => setFormData({ ...formData, endDate: e.target.value.replace(/-/g, '/') })}
                          />
                        </FormField>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="合約類型">
                          <Select 
                            value={formData.contractType} 
                            onChange={e => setFormData({ ...formData, contractType: e.target.value })}
                          >
                            <option value="季租">季租</option>
                            <option value="半年租">半年租</option>
                            <option value="年租">年租</option>
                          </Select>
                        </FormField>
                        <FormField label="場租費用 (NT$)">
                          <Input 
                            type="number"
                            value={formData.rent} 
                            onChange={e => setFormData({ ...formData, rent: Number(e.target.value) })}
                          />
                        </FormField>
                      </div>
                      <FormField label="場租時間表">
                        <SlotEditor 
                          slots={formData.slots || []} 
                          onChange={slots => setFormData({ ...formData, slots })}
                        />
                      </FormField>
                    </>
                  )}

                  {/* Weekly Schedule Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-neutral-900">每週上課日期明細</h3>
                    <WeeklySchedule 
                      schedule={formData.schedule || []} 
                      onTogglePause={(index) => {
                        const newSchedule = [...(formData.schedule || [])];
                        newSchedule[index].paused = !newSchedule[index].paused;
                        setFormData({ ...formData, schedule: newSchedule });
                      }}
                      onNoteChange={(index, note) => {
                        const newSchedule = [...(formData.schedule || [])];
                        newSchedule[index].note = note;
                        setFormData({ ...formData, schedule: newSchedule });
                      }}
                      readOnly={modalMode === 'view'}
                    />
                  </div>

                  {/* Photos Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-neutral-900">合約照片/掃描檔</h3>
                    <PhotoUploader 
                      photos={formData.photos || []} 
                      onChange={photos => setFormData({ ...formData, photos })}
                    />
                  </div>

                  {/* Logs Section (View/Edit only) */}
                  {(modalMode === 'view' || modalMode === 'edit') && selectedContract && (
                    <ChangeLog logs={selectedContract.logs} />
                  )}
                </div>

                {/* Modal Footer */}
                <div className="pt-4">
                  {modalMode === 'view' ? (
                    <Button onClick={closeModal} className="w-full h-14 rounded-2xl">關閉</Button>
                  ) : (
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={closeModal} className="flex-1 h-14 rounded-2xl">取消</Button>
                      <Button 
                        onClick={handleSave}
                        className="flex-1 h-14 rounded-2xl shadow-lg shadow-primary/20"
                        disabled={!formData.venue || !formData.startDate || !formData.endDate || !formData.slots?.length}
                      >
                        {modalMode === 'add' ? '確認新增' : modalMode === 'edit' ? '確認異動' : '確認續約'}
                      </Button>
                    </div>
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
