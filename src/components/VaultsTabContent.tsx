import React from 'react';
import { 
  Landmark, 
  PlusCircle, 
  Coins, 
  Briefcase, 
  ArrowLeftRight, 
  Layers, 
  Layers3, 
  Trash2, 
  Wallet, 
  Loader2, 
  Check, 
  Info 
} from 'lucide-react';
import { addDoc, collection, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import BankTransferManager from './BankTransferManager';
import { JamBoxManager } from './JamBoxManager';
import { WalletDepositCard } from './WalletDepositCard';

interface VaultsTabContentProps {
  subVaultTab: 'safes' | 'bank_accounts' | 'transfers' | 'branches' | 'category_vaults';
  setSubVaultTab: (tab: 'safes' | 'bank_accounts' | 'transfers' | 'branches' | 'category_vaults') => void;
  setShowVaultModal: (show: boolean) => void;
  vaults: any[];
  handleDeleteVault: (id: string) => void;
  handleAddBank: (e: React.FormEvent) => void;
  newBank: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    currency?: 'YER' | 'SAR' | 'USD';
    balance?: number;
  };
  setNewBank: (bank: any) => void;
  isAddingBank: boolean;
  isLoadingBanks: boolean;
  bankAccounts: any[];
  handleDeleteBank: (id: string, bankObj?: any) => void;
  profile: any;
  handleUpdateBankBalance: (id: string, newBalance: number, oldBalance: number) => Promise<boolean>;
  categoryMappings: any[];
  inventoryList: any[];
  playBeep: (freq: number, duration: number) => void;
}

export const VaultsTabContent: React.FC<VaultsTabContentProps> = ({
  subVaultTab,
  setSubVaultTab,
  setShowVaultModal,
  vaults,
  handleDeleteVault,
  handleAddBank,
  newBank,
  setNewBank,
  isAddingBank,
  isLoadingBanks,
  bankAccounts,
  handleDeleteBank,
  profile,
  handleUpdateBankBalance,
  categoryMappings,
  inventoryList,
  playBeep
}) => {
  return (
    <div id="tab-vaults-view" className="space-y-6 text-right selection:bg-amber-500/20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-2 gap-2">
        <div className="text-right">
          <h2 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Landmark size={14} />
            <span>الصناديق المالية الفعالة وحسابات البنوك للتسويات</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">تتبع المجموع الكلي، تنظيم الخزائن وإضافة حسابات تداولي ومزامنتها لحظياً</p>
        </div>
        
        {subVaultTab === 'safes' && (
          <button 
            onClick={() => setShowVaultModal(true)}
            className="flex items-center gap-1 bg-amber-500 text-slate-950 text-[11px] font-bold px-3.5 py-1.5 rounded-lg hover:bg-amber-400 transition-all cursor-pointer border-none outline-none"
          >
            <PlusCircle size={12} /> تأسيس حساب بنكي أو صندوق بيع جديد
          </button>
        )}
      </div>

      {/* Sub-Tabs Selector inside Vaults tab */}
      <div className="flex gap-2 p-1 bg-slate-900 rounded-xl w-fit border border-white/10 flex-wrap">
        <button
          onClick={() => setSubVaultTab('safes')}
          className={`px-4 py-2 rounded-lg font-black text-xs flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${
            subVaultTab === 'safes'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-zinc-450 hover:text-white bg-transparent'
          }`}
        >
          <Coins size={13} />
          شيت أرصدة الصناديق والخزائن
        </button>
        <button
          onClick={() => setSubVaultTab('bank_accounts')}
          className={`px-4 py-2 rounded-lg font-black text-xs flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${
            subVaultTab === 'bank_accounts'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-zinc-450 hover:text-white bg-transparent'
          }`}
        >
          <Briefcase size={13} />
          الحسابات والمحافظ البنكية العامة
        </button>
        <button
          onClick={() => setSubVaultTab('transfers')}
          className={`px-4 py-2 rounded-lg font-black text-xs flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${
            subVaultTab === 'transfers'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-zinc-450 hover:text-white bg-transparent'
          }`}
        >
          <ArrowLeftRight size={13} />
          التحويلات المالية والمناقلات
        </button>
        <button
          onClick={() => setSubVaultTab('branches')}
          className={`px-4 py-2 rounded-lg font-black text-xs flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${
            subVaultTab === 'branches'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-zinc-450 hover:text-white bg-transparent'
          }`}
        >
          <Layers size={13} />
          مهايئ غرف وصناديق الفروع
        </button>
        <button
          onClick={() => setSubVaultTab('category_vaults')}
          className={`px-4 py-2 rounded-lg font-black text-xs flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${
            subVaultTab === 'category_vaults'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-zinc-450 hover:text-white bg-transparent'
          }`}
        >
          <Layers3 size={13} />
          ربط الأقسام بالصناديق المالية
        </button>
      </div>

      {/* Sub-Tab 1: Safes View */}
      {subVaultTab === 'safes' && (
        <div className="space-y-6">
          {/* VAULT GROUPINGS: 1. BANK VAULTS */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              <span>المجموعة الأولى: صناديق وحسابات بنكية تداولية</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vaults.filter(v => v.type === 'bank').map(v => (
                <div key={v.id} className="p-4 bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-blue-500/10 flex items-center justify-between hover:border-blue-500/35 transition-all group/v">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                      <Landmark size={18} />
                    </span>
                    <div>
                      <div className="font-bold text-xs text-zinc-250 flex items-center gap-2">
                        <span>{v.name}</span>
                        {!['v1', 'v2', 'v3'].includes(v.id) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteVault(v.id); }}
                            className="p-1 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded transition-all cursor-pointer border-none opacity-0 group-hover/v:opacity-100"
                            title="حذف الصندوق المالي"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                      <div className="text-[9px] text-zinc-500">رقم الحساب: {v.linkedAccount}</div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-zinc-100 tabular-nums">
                      {v.balance.toLocaleString()} <span className="text-[10px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* VAULT GROUPINGS: 2. SALES & CASH BOXES */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              <span>المجموعة الثانية: صناديق مبيعات الكاش والبيع والزبون</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vaults.filter(v => v.type === 'cash' || v.type === 'market').map(v => (
                <div key={v.id} className="p-4 bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-amber-500/10 flex items-center justify-between hover:border-amber-500/35 transition-all group/v">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                      <Wallet size={18} />
                    </span>
                    <div>
                      <div className="font-bold text-xs text-zinc-250 flex items-center gap-2">
                        <span>{v.name}</span>
                        {!['v1', 'v2', 'v3'].includes(v.id) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteVault(v.id); }}
                            className="p-1 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded transition-all cursor-pointer border-none opacity-0 group-hover/v:opacity-100"
                            title="حذف الصندوق المالي"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                      <div className="text-[9px] text-zinc-500">
                        {v.type === 'market' ? 'صندوق مخصص لحركات وحراج السوق الموحد' : 'كاش تداولي يومي'}
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-zinc-100 tabular-nums">
                      {v.balance.toLocaleString()} <span className="text-[10px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* INFO PANEL */}
          <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl text-[11px] text-zinc-400 leading-relaxed space-y-1">
            <div>• يمكنك تأسيس صناديق بيع وإيداع مخصصة حسب رغبة الزبائن أو الشاحنين لضبط التدقيق مع الموردين.</div>
            <div>• تذكر فحص وموازنة مبيعات الكاش وإيداعها في الحساب البنكي للحفاظ على خط الإمداد المحاسبي الموحد سليم تماماً.</div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Bank Accounts Management */}
      {subVaultTab === 'bank_accounts' && (
        <div className="space-y-6">
          {/* Canonical E-Wallets Quick Config Card */}
          <WalletDepositCard
            wallets={bankAccounts}
            ownerId={profile?.ownerId || profile?.uid}
            storeName={profile?.shopName || 'المحل'}
            title="إعداد المحافظ الإلكترونية المعتمدة للمحل (الكريمي، جيب، ون كاش، جوالي، فلوسك)"
            subtitle="اضغط على أيقونة التعديل لإدخال أو تحديث رقم المحفظة واسم مالك الحساب ليظهر تلقائياً في جميع السلال"
            allowEdit={true}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add New Bank Account Form */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-[2rem] shadow-2xl space-y-5">
              <h4 className="font-black text-zinc-100 flex items-center gap-2 text-xs">
                <PlusCircle className="text-amber-500" size={16} />
                إضافة حساب بنكي جديد
              </h4>
              <form onSubmit={handleAddBank} className="space-y-4 text-right">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">اسم البنك / الخدمة المصرفية</label>
                  <input 
                    required
                    type="text" 
                    placeholder="مثلاً: بنك الكريمي، ون كاش، البنك اليمني"
                    className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                    value={newBank.bankName || ''}
                    onChange={(e) => setNewBank({...newBank, bankName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">رقم الحساب / المحفظة</label>
                  <input 
                    required
                    type="text" 
                    placeholder="مثلاً: 30291040552"
                    className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                    value={newBank.accountNumber || ''}
                    onChange={(e) => setNewBank({...newBank, accountNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">اسم صاحب الحساب المعتمد</label>
                  <input 
                    required
                    type="text" 
                    placeholder="الاسم الثلاثي المسجل في البنك"
                    className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                    value={newBank.accountName || ''}
                    onChange={(e) => setNewBank({...newBank, accountName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">العملة</label>
                    <select 
                      className="w-full bg-slate-950 text-zinc-350 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer"
                      value={newBank.currency || 'YER'}
                      onChange={(e) => setNewBank({...newBank, currency: e.target.value as any})}
                    >
                      <option value="YER">ريال يمني</option>
                      <option value="SAR">ريال سعودي</option>
                      <option value="USD">دولار أمريكي</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">الرصيد الافتتاحي</label>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                      value={newBank.balance || ''}
                      onChange={(e) => setNewBank({...newBank, balance: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isAddingBank}
                  className="w-full py-3 bg-amber-500 text-slate-950 rounded-xl font-bold hover:bg-amber-400 transition-all flex items-center justify-center gap-2 cursor-pointer outline-none border-none text-xs"
                >
                  {isAddingBank ? <Loader2 className="animate-spin text-slate-950" size={16} /> : <Check size={16} />}
                  تأكيد وحفظ الحساب البنكي
                </button>
              </form>
            </div>
          </div>

          {/* Existing Accounts List */}
          <div className="lg:col-span-2 space-y-6">
            {isLoadingBanks ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                <Loader2 className="animate-spin text-amber-500" size={40} />
                <p className="font-bold text-xs">جاري تحميل الحسابات البنكية تزامنيّاً...</p>
              </div>
            ) : bankAccounts.length === 0 ? (
              <div className="text-center py-20 bg-slate-900 rounded-[2rem] border border-dashed border-white/10 space-y-4">
                <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Landmark size={32} className="text-zinc-500" />
                </div>
                <div>
                  <p className="font-bold text-zinc-200 text-xs">لا توجد حسابات بنكية مضافة حالياً</p>
                  <p className="text-[10px] text-zinc-500">قم بإضافة حسابك المصرفي الأول لتسجيل الحوالات الموجهة.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bankAccounts.map(account => (
                  <div 
                    key={account.id}
                    className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-2xl border border-white/5 shadow-2xl flex flex-col justify-between hover:border-amber-500/25 transition-all group"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
                          <Landmark size={20} />
                        </span>
                        <button 
                          onClick={() => handleDeleteBank(account.id, account)}
                          className="p-1.5 text-rose-500 opacity-80 hover:opacity-100 bg-rose-500/10 hover:bg-rose-500 hover:text-white rounded-lg transition-all cursor-pointer border-none"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-black text-zinc-100">{account.bankName}</h4>
                        <p className="text-[11px] font-bold text-zinc-400">{account.accountName}</p>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-xl border border-white/5">
                        <p className="text-[9px] font-bold text-zinc-500 mb-0.5">رقم الحساب / الآيبان</p>
                        <p className="font-mono text-xs font-black tracking-wider text-amber-400">{account.accountNumber}</p>
                      </div>
                    </div>

                    <div className="mt-6 flex items-end justify-between border-t border-white/5 pt-3">
                      <div>
                        <p className="text-[9px] font-black text-zinc-500 mb-1">الرصيد الحالي المتوفر</p>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            className="bg-transparent font-black text-sm w-32 border-b-2 border-transparent focus:border-amber-500 text-white focus:outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            defaultValue={account.balance}
                            disabled={!(profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'master_wholesale')}
                            onBlur={async (e) => {
                              const val = Number(e.target.value);
                              if (val !== account.balance) {
                                const success = await handleUpdateBankBalance(account.id, val, account.balance);
                                if (!success) {
                                  e.target.value = String(account.balance);
                                }
                              }
                            }}
                          />
                          <span className="font-bold text-xs text-zinc-450">{account.currency}</span>
                        </div>
                      </div>
                      <div className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-black rounded-full border border-blue-500/20">
                        ACTIVE
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Sub-Tab 3: Transfers */}
      {subVaultTab === 'transfers' && (
        <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl shadow-xl">
          {profile ? (
            <BankTransferManager profile={profile} />
          ) : (
            <div className="text-center py-10 text-zinc-500 text-xs">يرجى تأكيد حساب المالك لتسجيل الحوالات.</div>
          )}
        </div>
      )}

      {/* Sub-Tab 4: Branches Cash Boxes */}
      {subVaultTab === 'branches' && (
        <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl shadow-xl">
          <JamBoxManager storeCode={profile?.ownerId || 'JAM_STORE_1'} profile={profile} />
        </div>
      )}

      {/* Sub-Tab 5: Category to Vault Mapping */}
      {subVaultTab === 'category_vaults' && (
        <div className="space-y-6 animate-fade-in text-right selection:bg-amber-500/20">
          {/* Header */}
          <div className="p-4 bg-gradient-to-l from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl text-right">
            <h3 className="text-xs font-black text-amber-400 flex items-center gap-2">
              <span>🏷️</span>
              <span>تخصيص الصناديق المالية للأقسام والتصنيفات</span>
            </h3>
            <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
              من خلال هذه اللوحة، يستطيع كل تاجر ربط فئة أو قسم معين (مثل الإلكترونيات، قطع الغيار، الصيانة) بصندوق مالي أو حساب بنكي مخصص.
              سيتكفل النظام آلياً بتسجيل دخل مبيعات هذا القسم، وخصم تكاليف مشترياته ومصروفاته مباشرة من الصندوق المرتبط به، مما يوفر لك فصلاً محاسبياً كاملاً وتقارير أرباح دقيقة لكل قسم مستقل!
            </p>
          </div>

          {/* Grid layout: Add mapping & View existing mappings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Mappings List (Take 2 cols on lg) */}
            <div className="lg:col-span-2 space-y-4 text-right">
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5 justify-start">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  <span>خريطة ربط الأقسام بالصناديق والمستودعات الفعالة</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-white/5 text-zinc-400 border-b border-white/5">
                        <th className="p-3 font-bold text-right">اسم القسم / الفئة</th>
                        <th className="p-3 font-bold text-right">المستودع المرتبط (مخزون)</th>
                        <th className="p-3 font-bold text-right">الصندوق المالي المرتبط (نقدية)</th>
                        <th className="p-3 font-bold text-center w-20">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {categoryMappings.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-zinc-500">
                            لا توجد أقسام مسجلة حالياً. قم بإضافة قسم جديد للبدء بالربط!
                          </td>
                        </tr>
                      ) : (
                        categoryMappings.map((mapping, idx) => (
                          <tr key={mapping.id || idx} className="hover:bg-white/[0.02] text-zinc-300">
                            <td className="p-3 font-bold text-amber-500 text-right">{mapping.name}</td>
                            <td className="p-3 text-right">
                              {mapping.warehouseName || 'المستودع الرئيسي'}
                            </td>
                            <td className="p-3 text-right">
                              {mapping.vaultName || 'صندوق المبيعات العام'}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await deleteDoc(doc(db, 'inventory_categories', mapping.id));
                                  } catch (err: any) {
                                    alert('فشل الحذف: ' + err.message);
                                  }
                                }}
                                className="px-2 py-1 bg-red-600/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-600/20 transition-all cursor-pointer text-[10px]"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Add mapping form (1 col on lg) */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-4">
              <h4 className="text-xs font-bold text-zinc-300 border-b border-white/5 pb-2 text-right flex items-center justify-start gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                <span>تسجيل قسم جديد وتوجيهه</span>
              </h4>

              <div className="space-y-3 text-right">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">اسم القسم / التصنيف الجديد *</label>
                  <input
                    type="text"
                    placeholder="مثال: قسم الآيفون، الشواحن..."
                    id="new-cat-name-input"
                    className="w-full bg-slate-950 text-white border border-white/10 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">المستودع الافتراضي للمخزون</label>
                  <select
                    id="new-cat-wh-select"
                    className="w-full bg-slate-950 text-white border border-white/10 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold cursor-pointer"
                  >
                    {Array.from(new Set([
                      ...inventoryList.map(item => item.warehouse || item.store || item.location).filter(Boolean),
                      'المستودع الرئيسي', 'قسم الورشة', 'مخزن الشواحن واكسسوارات'
                    ])).map((wh, idx) => (
                      <option key={idx} value={wh}>{wh}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">الصندوق المالي الافتراضي</label>
                  <select
                    id="new-cat-v-select"
                    className="w-full bg-slate-950 text-white border border-white/10 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold cursor-pointer"
                  >
                    <option value="">🏦 صندوق المبيعات العام (افتراضي)</option>
                    {vaults.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const nameEl = document.getElementById('new-cat-name-input') as HTMLInputElement;
                    const whEl = document.getElementById('new-cat-wh-select') as HTMLSelectElement;
                    const vEl = document.getElementById('new-cat-v-select') as HTMLSelectElement;

                    if (!nameEl || !nameEl.value.trim()) {
                      alert('يرجى إدخال اسم القسم بوضوح.');
                      return;
                    }

                    const selectedVault = vaults.find(v => v.id === vEl.value);

                    try {
                      await addDoc(collection(db, 'inventory_categories'), {
                        ownerId: profile?.ownerId,
                        name: nameEl.value.trim(),
                        warehouseName: whEl.value,
                        vaultId: vEl.value || null,
                        vaultName: selectedVault ? selectedVault.name : null,
                        createdAt: serverTimestamp()
                      });
                      nameEl.value = '';
                      playBeep(880, 0.15);
                    } catch (err: any) {
                      alert('فشلت إضافة القسم: ' + err.message);
                    }
                  }}
                  className="w-full py-2.5 bg-amber-500 text-slate-950 font-black text-xs rounded-xl hover:bg-amber-400 transition-all cursor-pointer border-none"
                >
                  تأكيد وإضافة القسم 💾
                </button>
              </div>
            </div>
          </div>

          {/* Section explaining automatic effects */}
          <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 justify-start">
              <Info size={13} className="text-amber-500" />
              <span>آلية العمل والأثر المالي الذكي للمنظومة</span>
            </h4>
            <ul className="list-disc list-inside text-[10px] text-zinc-400 space-y-1.5 text-right leading-relaxed pr-2">
              <li>
                <strong>الدخل والمبيعات:</strong> عند إتمام فاتورة مبيعات تحتوي على سلعة تابعة لقسم معين، سيتم توجيه مبلغ هذه السلعة آلياً إلى الصندوق أو الحساب البنكي المرتبط بالقسم.
              </li>
              <li>
                <strong>المشتريات والمصروفات:</strong> عند تسجيل مشتريات جديدة أو قطع تتبع قسماً معيناً، سيقوم النظام باقتطاع التكلفة الكلية للسلعة من رصيد الصندوق المالي المرتبط بهذا القسم لتسهيل مطابقة النقدية المتبقية.
              </li>
              <li>
                <strong>صافي الأرباح:</strong> يتيح لك هذا التقسيم حساب صافي الربح الدقيق لكل قسم ومقارنة الأداء والتدفق النقدي الفعلي لكل صندوق وحساب بنكي في لوحة التحليلات المتقدمة.
              </li>
            </ul>
          </div>
        </div>
      )}

    </div>
  );
};
