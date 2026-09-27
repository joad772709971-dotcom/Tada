import React from 'react';
import { Store, CheckCircle, Lock, Unlock, Trash2, AlertCircle, Link as LinkIcon, UserCheck } from 'lucide-react';

interface MarketManagementProps {
  b2bProfile: any;
  setB2bProfile: (prof: any) => void;
  productCategories: string[];
  isCreatingNewWarehouse: boolean;
  setIsCreatingNewWarehouse: (val: boolean) => void;
  newWarehouseInputName: string;
  setNewWarehouseInputName: (val: string) => void;
  handleCreateNewWarehouseInSetup: (name: string) => void;
  buyerBoxes: any[];
  handleAutoFetchBankAccounts: () => void;
  handleSaveB2bProfile: (prof: any) => void;
  connectedSuppliers: any[];
  partnerConnections: any[];
  connectionsModalTab: 'them' | 'me';
  setConnectionsModalTab: (tab: 'them' | 'me') => void;
  handleRemoveSupplierConnection: (id: string, name: string) => void;
  handleDeletePartnerConnectionAsSupplier: (id: string, name: string) => void;
}

export const MarketManagement: React.FC<MarketManagementProps> = ({
  b2bProfile,
  setB2bProfile,
  productCategories,
  isCreatingNewWarehouse,
  setIsCreatingNewWarehouse,
  newWarehouseInputName,
  setNewWarehouseInputName,
  handleCreateNewWarehouseInSetup,
  buyerBoxes,
  handleAutoFetchBankAccounts,
  handleSaveB2bProfile,
  connectedSuppliers,
  partnerConnections,
  connectionsModalTab,
  setConnectionsModalTab,
  handleRemoveSupplierConnection,
  handleDeletePartnerConnectionAsSupplier,
}) => {
  return (
    <div className="space-y-6 animate-fade-in text-right" dir="rtl">
      <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20 p-5 rounded-3xl space-y-2 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-2">
          <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl text-xs font-black animate-pulse">⚙️ إدارة المتجر والارتباطات B2B</span>
          <h3 className="text-sm font-black text-white">لوحة تحكم إعداد الهوية وربط المخازن والصناديق وقنوات الشركاء</h3>
        </div>
        <p className="text-[11px] text-gray-300 leading-relaxed max-w-3xl">
          قم بتهيئة مستودعاتك، ربط صناديقك المالية المعتمدة بصفحة الحسابات لتقييد التدفق المالي، وإدارة الهوية التجارية كوكيل رسمي. كما يمكنك تتبع وإلغاء ارتباطاتك من خلال منصة الارتباطات الموحدة.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column: B2B Profile Form */}
        <div className="bg-[#0b101e]/90 border border-white/5 p-6 rounded-3xl space-y-5 shadow-xl">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Store className="text-amber-400" size={18} />
            <h4 className="text-sm font-black text-white">الهوية السوقية والضبط المالي</h4>
          </div>

          {/* Warehouse selection */}
          <div className="bg-[#11162d]/50 p-4 border border-white/5 rounded-2xl space-y-2.5">
            <label className="text-[11px] text-[#D4AF37] font-black block">🏬 إدارة المستودع الفعال:</label>
            <p className="text-[10px] text-gray-400 leading-tight">
              حدد مستودع سوق التوريد الفعال لتسجيل الواردات والصادرات فيه.
            </p>
            
            {!isCreatingNewWarehouse ? (
              <div className="space-y-2">
                <select
                  value={b2bProfile?.warehouseName || ''}
                  onChange={(e) => setB2bProfile({ ...b2bProfile, warehouseName: e.target.value })}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none focus:border-amber-500 cursor-pointer"
                >
                  {productCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {productCategories.length === 0 && (
                    <option value="المستودع الرئيسي للمحل">المستودع الرئيسي للمحل</option>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewWarehouse(true)}
                  className="text-[9.5px] text-amber-500 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>+ إنشاء مستودع جديد تماماً للسوق</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="مثلاً: مستودع الجملة الذكي"
                  value={newWarehouseInputName}
                  onChange={(e) => setNewWarehouseInputName(e.target.value)}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white outline-none focus:border-amber-500"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCreateNewWarehouseInSetup(newWarehouseInputName)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3 py-1.5 rounded-lg text-[10px] cursor-pointer"
                  >
                    إنشاء وحفظ المستودع
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewWarehouse(false)}
                    className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-[10px] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Safe Boxes selection */}
          <div className="bg-[#11162d]/50 p-4 border border-white/5 rounded-2xl space-y-2.5">
            <label className="text-[11px] text-[#D4AF37] font-black block">💼 ربط الخزائن والصناديق (حسابات المحل):</label>
            <p className="text-[10px] text-gray-400 leading-tight">
              اختر حسابك المالي المعتمد لتقييد حركات الدفع والتحصيل الخاصة بصفقات الجملة فيه مباشرة.
            </p>
            <select
              value={b2bProfile?.linkedBoxId || 'MAIN_CASH'}
              onChange={(e) => setB2bProfile({ ...b2bProfile, linkedBoxId: e.target.value })}
              className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none focus:border-amber-500 cursor-pointer"
            >
              {buyerBoxes.map(box => (
                <option key={box.id} value={box.id}>
                  {box.name} {box.currency ? `(${box.currency})` : ''}
                </option>
              ))}
              {buyerBoxes.length === 0 && (
                <option value="MAIN_CASH">الصندوق الرئيسي للمحل (ريال يمني)</option>
              )}
            </select>
          </div>

          {/* Business identity fields */}
          <div className="bg-[#11162d]/50 p-4 border border-white/5 rounded-2xl space-y-3">
            <label className="text-[11px] text-[#D4AF37] font-black block">🖼️ الهوية السوقية وشعار المتجر:</label>
            <div className="flex items-center gap-3">
              <img
                src={b2bProfile?.logoUrl || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80'}
                alt="Store Logo"
                className="w-12 h-12 rounded-xl object-cover border border-[#D4AF37]/30 bg-slate-800 shrink-0"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80';
                }}
              />
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  placeholder="رابط صورة شعار المتجر (URL)"
                  value={b2bProfile?.logoUrl || ''}
                  onChange={(e) => setB2bProfile({ ...b2bProfile, logoUrl: e.target.value })}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-[10px] text-gray-400 block">نوع النشاط التجاري الرئيسي:</label>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                {[
                  { id: 'mobiles', label: 'موبايلات وجوالات' },
                  { id: 'accessories', label: 'إكسسوارات' },
                  { id: 'parts', label: 'قطع غيار' }
                ].map(act => {
                  const isChecked = (b2bProfile?.activities || []).includes(act.id);
                  return (
                    <label key={act.id} className="flex items-center gap-1.5 p-1.5 bg-black/20 rounded-lg border border-white/5 cursor-pointer hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const current = b2bProfile?.activities || [];
                          const updated = isChecked
                            ? current.filter((x: string) => x !== act.id)
                            : [...current, act.id];
                          setB2bProfile({ ...b2bProfile, activities: updated });
                        }}
                        className="rounded border-white/10 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                      <span>{act.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-[10px] text-gray-400 block">نبذة تعريفية لشركائك بالتوريد:</label>
              <input
                type="text"
                placeholder="مثلاً: متخصصون في بيع الجملة وإكسسوارات الهواتف..."
                value={b2bProfile?.bio || ''}
                onChange={(e) => setB2bProfile({ ...b2bProfile, bio: e.target.value })}
                className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">📍 موقع ومقر البيع الرئيسي:</label>
                <input
                  type="text"
                  placeholder="صنعاء - شارع القيادة"
                  value={b2bProfile?.salesLocation || ''}
                  onChange={(e) => setB2bProfile({ ...b2bProfile, salesLocation: e.target.value })}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">🕒 أوقات الدوام والعمل:</label>
                <input
                  type="text"
                  placeholder="8:00 ص - 10:00 م"
                  value={b2bProfile?.workHours || ''}
                  onChange={(e) => setB2bProfile({ ...b2bProfile, workHours: e.target.value })}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="hasDeliveryCheck"
                checked={b2bProfile?.hasDelivery ?? true}
                onChange={(e) => setB2bProfile({ ...b2bProfile, hasDelivery: e.target.checked })}
                className="rounded border-white/10 text-amber-500 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="hasDeliveryCheck" className="text-[10px] text-gray-300 font-bold cursor-pointer select-none">🚚 يتوفر لدينا خدمة الشحن والتوصيل للمحافظات</label>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-[10px] text-gray-400 block">🏷️ الوكالات التجارية والماركات المعتمدة (مفصولة بفاصلة):</label>
              <input
                type="text"
                placeholder="Ramos, Bemas, Apple, Samsung"
                value={Array.isArray(b2bProfile?.agencies) ? b2bProfile.agencies.join(', ') : ''}
                onChange={(e) => {
                  const list = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
                  setB2bProfile({ ...b2bProfile, agencies: list });
                }}
                className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="bg-[#11162d]/50 p-4 border border-white/5 rounded-2xl space-y-2">
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handleAutoFetchBankAccounts}
                className="text-[9px] bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 border border-[#D4AF37]/20 px-2 py-0.5 rounded font-black cursor-pointer transition-all"
              >
                ⚡ جلب تلقائي من حسابات الصناديق
              </button>
              <label className="text-[11px] text-[#D4AF37] font-black">💳 الحسابات والآيبان البنكي (Bank Accounts):</label>
            </div>
            <textarea
              placeholder="الكريمي: 1234567&#10;النيابة اليمنية: 987654"
              value={b2bProfile?.bankAccounts || ''}
              rows={2}
              onChange={(e) => setB2bProfile({ ...b2bProfile, bankAccounts: e.target.value })}
              className="w-full bg-[#0a0f24] border border-white/10 rounded-xl p-2.5 text-[10.5px] text-white outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <button
            onClick={() => handleSaveB2bProfile(b2bProfile)}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-[#D4AF37] text-slate-950 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            <CheckCircle size={14} />
            <span>حفظ وتحديث الهوية السوقية والضبط 💾</span>
          </button>
        </div>

        {/* Right Column: Connection Desk */}
        <div className="bg-[#0b101e]/90 border border-white/5 p-6 rounded-3xl space-y-5 shadow-xl">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <LinkIcon className="text-amber-400 animate-pulse" size={18} />
            <h4 className="text-sm font-black text-white">منصة إدارة الارتباطات (Connection Desk) 🔗</h4>
          </div>

          {/* Sub tabs for Connection Desk */}
          <div className="flex bg-navy-950/80 p-1 rounded-xl border border-white/5 gap-1.5">
            <button
              onClick={() => setConnectionsModalTab('them')}
              className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                connectionsModalTab === 'them'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Store size={12} />
              <span>المرتبط بهم (الموردين) ({connectedSuppliers.length})</span>
            </button>
            <button
              onClick={() => setConnectionsModalTab('me')}
              className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                connectionsModalTab === 'me'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UserCheck size={12} />
              <span>المرتبط بي (العملاء) ({partnerConnections.length})</span>
            </button>
          </div>

          {connectionsModalTab === 'them' ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {connectedSuppliers.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs font-medium space-y-2">
                  <AlertCircle size={32} className="mx-auto text-gray-700 opacity-40" />
                  <p>لا يوجد موردون مرتبط بهم حالياً.</p>
                  <p className="text-[10px] text-gray-400">يمكنك الذهاب إلى "خزانة الصلاحيات" أعلى الشاشة لإدخال مفتاح ارتباط بموردك.</p>
                </div>
              ) : (
                connectedSuppliers.map(sup => {
                  const payable = Number(sup.payableBalance || 0);
                  const receivable = Number(sup.receivableBalance || 0);
                  const balance = Number(sup.balance || 0);
                  const debt = Number(sup.debt || 0);
                  const hasLiability = payable > 0 || receivable > 0 || balance > 0 || debt > 0;

                  return (
                    <div key={sup.id} className="bg-navy-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between gap-3 transition-all hover:bg-navy-900/60">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <h4 className="text-xs font-black text-white">{sup.supplierName}</h4>
                          </div>
                          <span className="text-[8px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono text-gray-400">
                            {sup.supplierKey || 'B2B-KEY'}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-gray-400">
                          الموقع: {sup.salesLocation || 'اليمن'} • الدوام: {sup.workHours || 'غير محدد'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5 text-[9px] font-black">
                          <span className="text-amber-500 font-sans">حساب له (Payable): {payable.toLocaleString()} YER</span>
                          <span className="text-emerald-400 font-sans">حساب عليك (Receivable): {receivable.toLocaleString()} YER</span>
                          {debt > 0 && <span className="text-red-400 font-sans">ديون معلقة: {debt.toLocaleString()} YER</span>}
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-2.5 flex items-center justify-between flex-wrap gap-2">
                        {hasLiability ? (
                          <div className="text-[9px] text-red-400 flex items-center gap-1 font-bold">
                            <Lock size={10} className="text-red-500 animate-bounce" />
                            <span>قفل: لا يمكن الإلغاء بسبب مديونية معلقة ({(payable + receivable + balance + debt).toLocaleString()} ر.ي)</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-emerald-400 flex items-center gap-1">
                            <Unlock size={10} />
                            <span>الحساب صافي: جاهز للإلغاء</span>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={hasLiability}
                          onClick={() => handleRemoveSupplierConnection(sup.id, sup.supplierName)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                            hasLiability
                              ? 'bg-gray-800 text-gray-500 border border-transparent cursor-not-allowed opacity-50'
                              : 'bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20'
                          }`}
                        >
                          <Trash2 size={11} />
                          <span>إلغاء الارتباط التام</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {partnerConnections.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs font-medium space-y-2">
                  <AlertCircle size={32} className="mx-auto text-gray-700 opacity-40" />
                  <p>لم يرتبط بك أي تجار تجزئة حالياً كعملاء مبيعات.</p>
                  <p className="text-[10px] text-gray-400 font-bold">قم بتوليد مفتاح ارتباط وبثه للتجار ليرتبطوا بك وتلقي طلبياتهم.</p>
                </div>
              ) : (
                partnerConnections.map(conn => {
                  const payable = Number(conn.payableBalance || 0);
                  const receivable = Number(conn.receivableBalance || 0);
                  const balance = Number(conn.balance || 0);
                  const debt = Number(conn.debt || 0);
                  const hasLiability = payable > 0 || receivable > 0 || balance > 0 || debt > 0;

                  return (
                    <div key={conn.id} className="bg-navy-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between gap-3 transition-all hover:bg-navy-900/60 text-right">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                            <h4 className="text-xs font-black text-white">{conn.buyerName || 'شريك B2B'}</h4>
                          </div>
                          <span className="text-[8px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono text-gray-400">
                            {conn.buyerId?.substring(0, 5) || 'CLIENT'}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-gray-400">
                          رقم الاتصال: {conn.buyerPhone || 'لا يوجد'} • الموقع: {conn.buyerLocation || 'اليمن'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5 text-[9px] font-black">
                          <span className="text-amber-500 font-sans">حساب له (Payable): {payable.toLocaleString()} YER</span>
                          <span className="text-emerald-400 font-sans">حساب عليك (Receivable): {receivable.toLocaleString()} YER</span>
                          {debt > 0 && <span className="text-red-400 font-sans">ديون جارية: {debt.toLocaleString()} YER</span>}
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-2.5 flex items-center justify-between flex-wrap gap-2">
                        {hasLiability ? (
                          <div className="text-[9px] text-red-400 flex items-center gap-1 font-bold">
                            <Lock size={10} className="text-red-500 animate-bounce" />
                            <span>قفل: لا يمكن إلغاء الشريك لوجود ديون معلقة ({(payable + receivable + balance + debt).toLocaleString()} ر.ي)</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-emerald-400 flex items-center gap-1">
                            <Unlock size={10} />
                            <span>الحساب صافي: جاهز للإلغاء</span>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={hasLiability}
                          onClick={() => handleDeletePartnerConnectionAsSupplier(conn.id, conn.buyerName)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                            hasLiability
                              ? 'bg-gray-800 text-gray-500 border border-transparent cursor-not-allowed opacity-50'
                              : 'bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20'
                          }`}
                        >
                          <Trash2 size={11} />
                          <span>قطع الشراكة</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
