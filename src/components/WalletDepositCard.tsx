import React, { useState } from 'react';
import { Wallet, Copy, Check, AlertCircle, Edit3, Save, ExternalLink } from 'lucide-react';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface WalletInfo {
  id: string;
  name: string;
  provider: 'AL_KURIMI' | 'JEEB' | 'ONE_CASH' | 'JAWALI' | 'FLOOSAK' | string;
  accountNumber?: string;
  accountName?: string;
  currency?: string;
  balance?: number;
  iconColor?: string;
  bgGradient?: string;
}

export const CANONICAL_WALLETS_DEF: {
  id: string;
  name: string;
  provider: string;
  chartOfAccountsCode: string;
  chartOfAccountsName: string;
  iconColor: string;
  badgeBg: string;
}[] = [
  {
    id: 'AL_KURIMI',
    name: 'بنك الكريمي (حاسب / مميز)',
    provider: 'الكريمي',
    chartOfAccountsCode: '1102',
    chartOfAccountsName: 'أرصدة لدى البنوك - الكريمي',
    iconColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-300'
  },
  {
    id: 'JEEB',
    name: 'محفظة جيب الإلكترونية (JEEB)',
    provider: 'جيب',
    chartOfAccountsCode: '1103',
    chartOfAccountsName: 'أرصدة لدى البنوك - جيب',
    iconColor: 'text-sky-400',
    badgeBg: 'bg-sky-500/10 border-sky-500/20 text-sky-300'
  },
  {
    id: 'ONE_CASH',
    name: 'محفظة ون كاش (OneCash)',
    provider: 'ون كاش',
    chartOfAccountsCode: '1104',
    chartOfAccountsName: 'أرصدة لدى البنوك - ون كاش',
    iconColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
  },
  {
    id: 'JAWALI',
    name: 'محفظة جوالي الإلكترونية',
    provider: 'جوالي',
    chartOfAccountsCode: '1105',
    chartOfAccountsName: 'صناديق الحوالات - جوالي',
    iconColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300'
  },
  {
    id: 'FLOOSAK',
    name: 'محفظة فلوسك (Floosak)',
    provider: 'فلوسك',
    chartOfAccountsCode: '1106',
    chartOfAccountsName: 'صناديق الحوالات - فلوسك',
    iconColor: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 border-rose-500/20 text-rose-300'
  }
];

interface WalletDepositCardProps {
  wallets?: any[];
  ownerId?: string;
  storeName?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  onSelectWallet?: (wallet: any) => void;
  selectedWalletId?: string;
  allowEdit?: boolean;
}

export const WalletDepositCard: React.FC<WalletDepositCardProps> = ({
  wallets = [],
  ownerId,
  storeName = 'المحل',
  title = 'بيانات الإيداع والمحافظ الإلكترونية المعتمدة',
  subtitle = 'يرجى اختيار المحفظة وتحويل المبلغ إلى حساب المحل الموضح أدناه:',
  compact = false,
  onSelectWallet,
  selectedWalletId,
  allowEdit = true
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNum, setEditNum] = useState('');
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Map incoming wallets with canonical ones
  const mappedWallets = CANONICAL_WALLETS_DEF.map(def => {
    const existing = wallets.find(
      w => w.id === def.id || 
           w.bankName?.includes(def.provider) || 
           w.boxName?.includes(def.provider) ||
           w.provider === def.provider
    );
    return {
      id: def.id,
      name: def.name,
      provider: def.provider,
      badgeBg: def.badgeBg,
      iconColor: def.iconColor,
      accountNumber: existing?.accountNumber || existing?.walletNumber || existing?.phone || '',
      accountName: existing?.accountName || existing?.ownerName || '',
      rawObj: existing
    };
  });

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEdit = (wallet: any) => {
    setEditingId(wallet.id);
    setEditNum(wallet.accountNumber || '');
    setEditName(wallet.accountName || '');
  };

  const handleSaveWallet = async (walletDef: typeof CANONICAL_WALLETS_DEF[0]) => {
    if (!ownerId) {
      alert('⚠️ لم يتم تحديد معرف المالك حفظ البيانات!');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        id: walletDef.id,
        boxName: walletDef.name,
        bankName: walletDef.name,
        chartOfAccountsCode: walletDef.chartOfAccountsCode,
        chartOfAccountsName: walletDef.chartOfAccountsName,
        type: 'bank',
        currency: 'YER',
        accountNumber: editNum.trim(),
        accountName: editName.trim(),
        ownerId,
        updatedAt: serverTimestamp()
      };

      // 1. Update bank_accounts doc
      await setDoc(doc(db, 'bank_accounts', walletDef.id), payload, { merge: true });
      // 2. Update customBoxes doc
      await setDoc(doc(db, 'stores', ownerId, 'customBoxes', walletDef.id), payload, { merge: true });
      // 3. Update vaults doc
      await setDoc(doc(db, 'vaults', `${ownerId}-${walletDef.id}`), {
        id: walletDef.id,
        name: walletDef.name,
        type: 'bank',
        ownerId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setEditingId(null);
      alert(`✅ تم تحديث بيانات محفظة [${walletDef.provider}] بنجاح!`);
    } catch (err: any) {
      console.error('Error saving wallet:', err);
      alert(`⚠️ حدث خطأ أثناء حفظ بيانات المحفظة: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-amber-500/20 rounded-2xl p-4 space-y-3 text-right">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
            <Wallet size={16} />
          </span>
          <div>
            <h4 className="text-xs font-black text-amber-400">{title}</h4>
            <p className="text-[10px] text-zinc-400">{subtitle}</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-zinc-500 bg-slate-950 px-2 py-1 rounded-lg border border-white/5">
          {storeName}
        </span>
      </div>

      <div className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5'}`}>
        {mappedWallets.map(w => {
          const isSelected = selectedWalletId === w.id;
          const isConfigured = Boolean(w.accountNumber && w.accountName);
          const isEditing = editingId === w.id;

          return (
            <div
              key={w.id}
              onClick={() => onSelectWallet && onSelectWallet(w)}
              className={`p-3 rounded-xl border transition-all relative ${
                isSelected 
                  ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500' 
                  : 'bg-slate-950/70 border-white/10 hover:border-amber-500/40'
              } ${onSelectWallet ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${w.badgeBg}`}>
                  {w.provider}
                </span>

                {allowEdit && ownerId && !isEditing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(w);
                    }}
                    className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-white/5 rounded-md transition-colors"
                    title="تعديل رقم المحفظة واسم الحساب"
                  >
                    <Edit3 size={12} />
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2 mt-2" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <label className="text-[9px] text-amber-400 font-bold block">رقم المحفظة / الحساب:</label>
                    <input
                      type="text"
                      placeholder="مثال: 30291040"
                      value={editNum}
                      onChange={(e) => setEditNum(e.target.value)}
                      className="w-full bg-slate-900 border border-amber-500/30 p-1.5 rounded text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-amber-400 font-bold block">اسم مالك الحساب:</label>
                    <input
                      type="text"
                      placeholder="اسم صاحب الحساب الثلاثي"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-slate-900 border border-amber-500/30 p-1.5 rounded text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-1 pt-1">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveWallet(CANONICAL_WALLETS_DEF.find(d => d.id === w.id)!)}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-1 rounded text-[10px] flex items-center justify-center gap-1"
                    >
                      <Save size={10} />
                      <span>حفظ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="bg-slate-800 text-zinc-400 hover:text-white py-1 px-2 rounded text-[10px]"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : isConfigured ? (
                <div className="space-y-1 mt-1 text-[11px]">
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded border border-white/5">
                    <span className="text-zinc-400 text-[10px]">الرقم:</span>
                    <div className="flex items-center gap-1 font-mono font-bold text-white">
                      <span>{w.accountNumber}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(w.accountNumber, `${w.id}-num`);
                        }}
                        className="text-amber-400 hover:text-amber-300 transition-colors p-0.5"
                        title="نسخ رقم المحفظة"
                      >
                        {copiedId === `${w.id}-num` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-300 pt-0.5">
                    <span className="text-zinc-500">المالك:</span>
                    <span className="font-bold text-amber-200 truncate max-w-[140px]">{w.accountName}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-500/5 border border-rose-500/20 p-2 rounded-lg text-center mt-1 space-y-1">
                  <p className="text-[10px] text-rose-400 font-bold flex items-center justify-center gap-1">
                    <AlertCircle size={10} />
                    <span>بيانات المحفظة فارغة</span>
                  </p>
                  <p className="text-[9px] text-zinc-500">يتوجب على صاحب المحل إدخال رقم المحفظة واسم المالك</p>
                  {allowEdit && ownerId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(w);
                      }}
                      className="text-[9px] text-amber-400 hover:underline font-bold"
                    >
                      + إدخال البيانات الآن
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
