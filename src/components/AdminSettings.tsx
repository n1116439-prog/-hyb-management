import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Input, FormField } from './UI'
import { Save, CreditCard } from 'lucide-react'

export const AdminSettings: React.FC = () => {
  const [paymentInfo, setPaymentInfo] = useState({
    bank_name: '',
    bank_code: '',
    account_number: '',
    account_name: '',
    line_url: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'payment_info')
          .single()
        if (data?.value) setPaymentInfo(data.value)
      } catch (e) {
        console.log('system_settings 表不存在，請至 Supabase SQL Editor 建立')
      }
      setLoaded(true)
    }
    fetch()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'payment_info',
          value: paymentInfo,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

      if (error) {
        alert('儲存失敗：' + error.message)
      } else {
        alert('匯款資料儲存成功！')
      }
    } catch (e) {
      alert('儲存失敗，請確認 system_settings 表是否已建立')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-8 pb-12">
      <h2 className="text-2xl font-bold text-neutral-900">系統設定</h2>

      {!loaded ? (
        <div className="text-center py-12 text-neutral-500">載入中...</div>
      ) : (
        <>
          {/* 匯款資料 */}
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <CreditCard size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">匯款資料設定</h3>
                <p className="text-sm text-neutral-500">學員報名後顯示的匯款資訊</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="銀行名稱">
                <Input value={paymentInfo.bank_name} onChange={e => setPaymentInfo(prev => ({ ...prev, bank_name: e.target.value }))} placeholder="例如：中國信託" />
              </FormField>
              <FormField label="銀行代碼">
                <Input value={paymentInfo.bank_code} onChange={e => setPaymentInfo(prev => ({ ...prev, bank_code: e.target.value }))} placeholder="例如：822" />
              </FormField>
            </div>

            <FormField label="帳號">
              <Input value={paymentInfo.account_number} onChange={e => setPaymentInfo(prev => ({ ...prev, account_number: e.target.value }))} placeholder="例如：1234-5678-9012-3456" />
            </FormField>

            <FormField label="戶名">
              <Input value={paymentInfo.account_name} onChange={e => setPaymentInfo(prev => ({ ...prev, account_name: e.target.value }))} placeholder="例如：恆躍資訊有限公司" />
            </FormField>

            <FormField label="官方 Line 連結">
              <Input value={paymentInfo.line_url} onChange={e => setPaymentInfo(prev => ({ ...prev, line_url: e.target.value }))} placeholder="https://lin.ee/xxxxx" />
            </FormField>

            <FormField label="匯款提示文字">
              <textarea
                value={paymentInfo.notes}
                onChange={e => setPaymentInfo(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="顯示在匯款資訊下方的提示"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl resize-none h-24"
              />
            </FormField>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? '儲存中...' : '儲存匯款資料'}
            </button>
          </div>

          {/* 預覽 */}
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-bold text-lg mb-4">匯款資訊預覽（學員看到的畫面）</h3>
            <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-neutral-500">銀行</span>
                <span className="font-medium">{paymentInfo.bank_name} ({paymentInfo.bank_code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">帳號</span>
                <span className="font-medium font-mono">{paymentInfo.account_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">戶名</span>
                <span className="font-medium">{paymentInfo.account_name}</span>
              </div>
            </div>
            {paymentInfo.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                <p className="text-amber-800 text-sm">{paymentInfo.notes}</p>
              </div>
            )}
            {paymentInfo.line_url && (
              <a href={paymentInfo.line_url} target="_blank" rel="noopener noreferrer"
                className="block w-full mt-3 py-3 bg-[#06C755] text-white text-center font-bold rounded-xl">
                前往官方 Line 回覆
              </a>
            )}
          </div>

          {/* 建表提示 */}
          <div className="bg-neutral-50 rounded-xl p-4 text-sm text-neutral-500">
            <p className="font-medium text-neutral-700 mb-1">如果儲存失敗，請至 Supabase SQL Editor 執行：</p>
            <pre className="bg-white rounded-lg p-3 text-xs overflow-x-auto border">{`CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON system_settings
  FOR ALL USING (true) WITH CHECK (true);`}</pre>
          </div>
        </>
      )}
    </div>
  )
}
