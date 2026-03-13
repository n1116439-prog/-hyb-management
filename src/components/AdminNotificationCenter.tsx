import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Search, 
  Filter, 
  Check, 
  Calendar, 
  Clock, 
  AlertCircle, 
  MessageSquare, 
  CreditCard, 
  UserPlus, 
  Settings,
  X,
  CheckCheck,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Input, Select, Badge, FormField } from './UI';
import { NOTIFICATIONS, NOTIFICATION_SETTINGS } from '../constants';
import { Notification, NotificationSettings } from '../types';

const NOTIFICATION_TYPE_CONFIG = {
  contract_expiry: { label: '合約到期提醒', icon: Calendar, color: '#E53E3E', bg: '#FEF2F2', defaultPriority: 'high' as const },
  credits_low: { label: '堂數不足提醒', icon: MessageSquare, color: '#D97706', bg: '#FFFBEB', defaultPriority: 'medium' as const },
  unpaid: { label: '未繳費提醒', icon: CreditCard, color: '#DC2626', bg: '#FEF2F2', defaultPriority: 'medium' as const },
  waitlist: { label: '候補上線通知', icon: UserPlus, color: '#2563EB', bg: '#EFF6FF', defaultPriority: 'high' as const },
  new_enrollment: { label: '新報名通知', icon: Bell, color: '#059669', bg: '#ECFDF5', defaultPriority: 'low' as const },
  schedule_change: { label: '課程異動通知', icon: AlertCircle, color: '#7C3AED', bg: '#F5F3FF', defaultPriority: 'high' as const },
};

const PRIORITY_CONFIG = {
  high: { label: '高優先級', color: '#DC2626', bg: '#FEF2F2' },
  medium: { label: '中優先級', color: '#D97706', bg: '#FFFBEB' },
  low: { label: '低優先級', color: '#059669', bg: '#ECFDF5' },
};

export const AdminNotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>(NOTIFICATIONS);
  const [settings, setSettings] = useState<NotificationSettings>(NOTIFICATION_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterReadStatus, setFilterReadStatus] = useState<'all' | 'unread' | 'read'>('all');

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            n.message.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'all' || n.type === filterType;
        const matchesRead = filterReadStatus === 'all' || 
                           (filterReadStatus === 'unread' ? !n.read : n.read);
        return matchesSearch && matchesType && matchesRead;
      })
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [notifications, searchQuery, filterType, filterReadStatus]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleAction = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, actionDone: true, read: true } : n));
    alert('操作已執行');
  };

  const toggleReadFilter = () => {
    setFilterReadStatus(prev => {
      if (prev === 'all') return 'unread';
      if (prev === 'unread') return 'read';
      return 'all';
    });
  };

  return (
    <div className="max-w-[900px] mx-auto space-y-6 pb-12">
      {/* Header Tabs */}
      <div className="inline-flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-neutral-100">
        <Button
          variant="ghost"
          className="px-6 py-2 rounded-xl text-neutral-500 font-medium whitespace-nowrap"
          onClick={() => window.dispatchEvent(new CustomEvent('change-tab', { detail: 'admin-dashboard' }))}
        >
          儀表板
        </Button>
        <div className="relative">
          <Button variant="primary" className="px-6 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 whitespace-nowrap">
            通知中心
          </Button>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {unreadCount}
            </div>
          )}
        </div>
      </div>

      {/* Settings Button */}
      <Button 
        variant="outline" 
        className="w-full h-14 bg-white border-neutral-200 text-neutral-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-neutral-50"
        onClick={() => setShowSettings(true)}
      >
        <Settings size={20} />
        通知設定
      </Button>

      {/* Search & Filter Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <Input 
            placeholder="搜尋通知內容..." 
            className="pl-12 h-14 bg-white border-neutral-100 shadow-sm rounded-2xl"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative group">
          <Select 
            className="h-14 bg-white border-neutral-100 shadow-sm rounded-2xl px-6 min-w-[160px] appearance-none"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">所有類型</option>
            {Object.entries(NOTIFICATION_TYPE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </Select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" size={18} />
        </div>
        <Button 
          variant={filterReadStatus !== 'all' ? 'primary' : 'ghost'} 
          className={`h-14 w-14 rounded-2xl p-0 border border-neutral-100 shadow-sm ${filterReadStatus === 'all' ? 'bg-white' : ''}`}
          onClick={toggleReadFilter}
          title={`目前篩選：${filterReadStatus === 'all' ? '全部' : filterReadStatus === 'unread' ? '未讀' : '已讀'}`}
        >
          <Filter size={20} />
        </Button>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-500">
            {filterReadStatus === 'unread' ? '未讀通知' : filterReadStatus === 'read' ? '已讀通知' : '全部通知'} {filteredNotifications.length} 則
          </span>
          {unreadCount > 0 && filterReadStatus !== 'read' && (
            <Badge variant="danger" className="px-2 py-0.5 rounded-full text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-1.5 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
          >
            <CheckCheck size={18} />
            全部標為已讀
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-[32px] shadow-sm border border-neutral-100 overflow-hidden">
        {filteredNotifications.length > 0 ? (
          <div className="divide-y divide-neutral-50">
            {filteredNotifications.map((n) => (
              <NotificationCard 
                key={n.id} 
                notification={n} 
                onMarkAsRead={() => handleMarkAsRead(n.id)}
                onAction={() => handleAction(n.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-4">🔔</div>
            <h3 className="text-xl font-bold text-neutral-900 mb-1">
              {searchQuery ? '找不到符合的通知' : filterReadStatus === 'unread' ? '沒有未讀通知' : '目前沒有通知'}
            </h3>
            <p className="text-neutral-500 text-sm">
              {searchQuery ? '請嘗試更換關鍵字' : '當有新的系統消息時會顯示在此處'}
            </p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-[540px] rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">通知設定</h2>
                  <p className="text-sm text-neutral-500 mt-1">設定各類通知的開關與觸發條件</p>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
                {Object.entries(NOTIFICATION_TYPE_CONFIG).map(([key, config]) => {
                  const setting = settings[key];
                  return (
                    <div key={key} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: config.bg }}
                          >
                            <config.icon size={20} style={{ color: config.color }} />
                          </div>
                          <div>
                            <h4 className="font-bold text-neutral-900">{config.label}</h4>
                            <p className="text-xs text-neutral-400">預設優先級：{PRIORITY_CONFIG[config.defaultPriority].label}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSettings(prev => ({
                            ...prev,
                            [key]: { ...prev[key], enabled: !prev[key].enabled }
                          }))}
                          className={`w-12 h-6 rounded-full transition-colors relative ${setting.enabled ? 'bg-primary' : 'bg-neutral-200'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${setting.enabled ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>

                      {setting.enabled && (key === 'contract_expiry' || key === 'credits_low' || key === 'unpaid') && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="pl-14"
                        >
                          <div className="bg-neutral-50 p-4 rounded-2xl flex items-center gap-3 text-sm text-neutral-600">
                            {key === 'contract_expiry' && (
                              <>
                                <span>合約到期前</span>
                                <Input 
                                  type="number" 
                                  className="w-20 h-9 text-center" 
                                  value={setting.daysBefore}
                                  onChange={e => setSettings(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], daysBefore: parseInt(e.target.value) }
                                  }))}
                                />
                                <span>天提醒</span>
                              </>
                            )}
                            {key === 'credits_low' && (
                              <>
                                <span>剩餘堂數低於</span>
                                <Input 
                                  type="number" 
                                  className="w-20 h-9 text-center" 
                                  value={setting.threshold}
                                  onChange={e => setSettings(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], threshold: parseInt(e.target.value) }
                                  }))}
                                />
                                <span>堂時提醒</span>
                              </>
                            )}
                            {key === 'unpaid' && (
                              <>
                                <span>報名後超過</span>
                                <Input 
                                  type="number" 
                                  className="w-20 h-9 text-center" 
                                  value={setting.daysAfter}
                                  onChange={e => setSettings(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], daysAfter: parseInt(e.target.value) }
                                  }))}
                                />
                                <span>天未繳費提醒</span>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-8 bg-neutral-50/50 border-t border-neutral-100">
                <Button 
                  variant="primary" 
                  className="w-full h-14 rounded-2xl shadow-lg shadow-primary/20"
                  onClick={() => setShowSettings(false)}
                >
                  儲存設定
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface NotificationCardProps {
  notification: Notification;
  onMarkAsRead: () => void;
  onAction: () => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ notification, onMarkAsRead, onAction }) => {
  const config = NOTIFICATION_TYPE_CONFIG[notification.type];
  const priority = PRIORITY_CONFIG[notification.priority];

  return (
    <div className={`relative flex items-start gap-5 p-6 transition-all ${notification.read ? 'bg-white' : 'bg-[#FAFCFF]'}`}>
      {!notification.read && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1" 
          style={{ backgroundColor: config.color }}
        />
      )}

      <div 
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: config.bg, border: `1px solid ${config.color}20` }}
      >
        <config.icon size={22} style={{ color: config.color }} />
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className={`text-base text-neutral-900 ${notification.read ? 'font-medium' : 'font-bold'}`}>
              {notification.title}
            </h4>
            {!notification.read && <div className="w-2 h-2 bg-primary rounded-full" />}
            <div className="flex items-center gap-1.5 ml-2">
              <Badge 
                style={{ color: priority.color, backgroundColor: priority.bg }}
                className="px-2 py-0.5 rounded-full text-[10px] border-none"
              >
                {priority.label}
              </Badge>
              <Badge 
                style={{ color: config.color, backgroundColor: config.bg }}
                className="px-2 py-0.5 rounded-full text-[10px] border-none"
              >
                {config.label}
              </Badge>
            </div>
          </div>
          <span className="text-xs text-neutral-400">{notification.time}</span>
        </div>

        <p className="text-sm text-neutral-500 leading-relaxed">
          {notification.message}
        </p>

        <div className="flex items-center gap-3 pt-2">
          {notification.actionLabel && (
            <Button 
              variant={notification.actionDone ? 'ghost' : 'primary'}
              disabled={notification.actionDone}
              className={`h-9 px-5 rounded-xl text-xs font-bold ${notification.actionDone ? 'bg-neutral-100 text-neutral-400' : 'shadow-md shadow-primary/10'}`}
              onClick={onAction}
            >
              {notification.actionDone ? (
                <span className="flex items-center gap-1"><Check size={14} /> 已處理</span>
              ) : notification.actionLabel}
            </Button>
          )}
          
          {notification.read ? (
            <span className="text-xs text-neutral-400 font-medium flex items-center gap-1 px-2">
              <Check size={14} /> 已讀
            </span>
          ) : (
            <Button 
              variant="ghost" 
              className="h-9 px-5 rounded-xl text-xs text-neutral-500 border border-neutral-200 bg-white hover:bg-neutral-50"
              onClick={onMarkAsRead}
            >
              標記為已讀
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
