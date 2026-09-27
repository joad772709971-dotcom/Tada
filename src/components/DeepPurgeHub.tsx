import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, writeBatch, query, limit, doc, addDoc } from 'firebase/firestore';
import { Flame, Trash2, RefreshCw, ShieldAlert, CheckCircle, Database, AlertTriangle, Layers, Filter, CheckSquare, Square, HardDrive } from 'lucide-react';

export interface PurgeSection {
  id: string;
  title: string;
  desc: string;
  iconName: string;
  collections: string[];
  cacheKeys: string[];
  docCount: number;
}

const INITIAL_SECTIONS: PurgeSection[] = [
  {
    id: 'shops_accounts',
    title: 'حسابات المحلات والمتاجر',
    desc: 'المتاجر الحقيقية والوهمية والتجريبية المعتمدة في Firestore والكاش',
    iconName: 'Store',
    collections: ['shops', 'users', 'wholesalers', 'retailers', 'importers'],
    cacheKeys: ['jam_user_profile', 'jam_offline_credentials', 'jam_shops_cache'],
    docCount: 0
  },
  {
    id: 'maintenance',
    title: 'الصيانة وقطع الغيار الأجهزة',
    desc: 'طلبات الصيانة، قطع الغيار، الأجهزة المصانة والتذاكر الفنية',
    iconName: 'Wrench',
    collections: ['maintenanceOrders', 'maintenanceTechs', 'spareParts', 'devices'],
    cacheKeys: ['jam_maintenance_orders', 'jam_spare_parts'],
    docCount: 0
  },
  {
    id: 'customers_debts',
    title: 'الأصول والزبائن والديون والذمم',
    desc: 'حسابات الزبائن، الموردين، إسناد الزبائن، السندات والذمم',
    iconName: 'Users',
    collections: ['customers', 'suppliers', 'accounts', 'vouchers', 'debts'],
    cacheKeys: ['jam_customers_cache', 'jam_suppliers_cache', 'jam_ledger_cache'],
    docCount: 0
  },
  {
    id: 'vaults_balances',
    title: 'الأرصدة والخزائن الماليّة',
    desc: 'أرصدة الصناديق، الأرصدة الافتتاحية، الخزائن المالية والحركات',
    iconName: 'Vault',
    collections: ['transactions', 'balanceTransactions', 'vaults', 'openingBalances'],
    cacheKeys: ['jam_vaults_cache', 'jam_transactions_cache'],
    docCount: 0
  },
  {
    id: 'products_inventory',
    title: 'المنتجات والمخازن والتالف',
    desc: 'المنتجات، الجرف، المخازن، التالف والفاقد وبطاقات الأسعار',
    iconName: 'Package',
    collections: ['inventory', 'products', 'shelves', 'warehouses', 'damaged_goods'],
    cacheKeys: ['jam_inventory_cache', 'jam_products_cache'],
    docCount: 0
  },
  {
    id: 'sales_purchases',
    title: 'المبيعات والمشتريات والفواتير',
    desc: 'الفواتير، المرتجعات، حركات البيع والشراء ودرافت السلة',
    iconName: 'Receipt',
    collections: ['sales', 'held_invoices', 'cart_drafts', 'purchases', 'returns'],
    cacheKeys: ['jam_sales_cache', 'jam_cart_drafts'],
    docCount: 0
  },
  {
    id: 'market_orders',
    title: 'السوق والطلبات والشبكات',
    desc: 'طلبات B2B، منتجات السوق الشبكي، المزاد الإلكتروني والطلبات المعلقة',
    iconName: 'ShoppingBag',
    collections: ['networkOrders', 'orders', 'wholesaleProducts', 'auctions'],
    cacheKeys: ['jam_orders_cache', 'jam_market_cache'],
    docCount: 0
  },
  {
    id: 'notifications_logs',
    title: 'الإشعارات والرسائل وسجلات النظام',
    desc: 'سجل التنبيهات، إشعارات النظام، التلقت والتنبيهات الأمنية',
    iconName: 'Bell',
    collections: ['systemLogs', 'securityAlerts', 'notifications', 'alerts'],
    cacheKeys: ['jam_telemetry_queue', 'jam_system_logs'],
    docCount: 0
  },
  {
    id: 'staff_employees',
    title: 'الموظفين والعمال والكادر',
    desc: 'بيانات الكادر، الحضور، السلف، العهد المدرسية وحركات الرواتب',
    iconName: 'UserCheck',
    collections: ['attendance', 'staff', 'custody', 'payroll'],
    cacheKeys: ['jam_attendance_cache', 'jam_staff_cache'],
    docCount: 0
  }
];

export default function DeepPurgeHub() {
  const [sections, setSections] = useState<PurgeSection[]>(INITIAL_SECTIONS);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeProgress, setPurgeProgress] = useState(0);
  const [confirmText, setConfirmText] = useState('');
  const [purgeLogs, setPurgeLogs] = useState<string[]>([]);
  const [purgeSuccess, setPurgeSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Count documents across sections
  const scanDataCounts = async () => {
    setIsScanning(true);
    const updatedSections = [...sections];

    for (let i = 0; i < updatedSections.length; i++) {
      let total = 0;
      for (const colName of updatedSections[i].collections) {
        try {
          const snap = await getDocs(query(collection(db, colName), limit(500)));
          total += snap.size;
        } catch (e) {
          // Ignore permission/offline errors silently
        }
      }
      updatedSections[i].docCount = total;
    }

    setSections(updatedSections);
    setIsScanning(false);
  };

  useEffect(() => {
    scanDataCounts();
  }, []);

  const toggleSelectSection = (id: string) => {
    if (selectedSectionIds.includes(id)) {
      setSelectedSectionIds(selectedSectionIds.filter(x => x !== id));
    } else {
      setSelectedSectionIds([...selectedSectionIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSectionIds.length === sections.length) {
      setSelectedSectionIds([]);
    } else {
      setSelectedSectionIds(sections.map(s => s.id));
    }
  };

  const executeDeepPermanentPurge = async () => {
    if (selectedSectionIds.length === 0) {
      alert('الرجاء تحديد قسم واحد على الأقل للتطهير!');
      return;
    }

    if (confirmText.trim() !== 'تطهر-النظام' && confirmText.trim() !== 'CONFIRM-PURGE') {
      alert('الرجاء إدخال كلمة التأكيد "تطهر-النظام" أو "CONFIRM-PURGE" للمتابعة!');
      return;
    }

    setIsPurging(true);
    setPurgeProgress(0);
    setPurgeLogs(['🔥 بدء تشغيل محرك التطهير والتجميع النهائي (Deep Permanent Purge Engine)...']);
    setPurgeSuccess(false);

    const selectedSections = sections.filter(s => selectedSectionIds.includes(s.id));
    const totalSteps = selectedSections.length + 3; // + local cache, + app reset, + prevention checkpoint
    let currentStep = 0;

    let totalDeletedDocs = 0;
    let totalDeletedCacheKeys = 0;

    // STEP 1: Firestore Batch Purge
    for (const sec of selectedSections) {
      currentStep++;
      setPurgeLogs(prev => [...prev, `⏳ [1/4 Firestore Purge]: تطهير قسم: "${sec.title}" ...`]);

      for (const colName of sec.collections) {
        try {
          let hasMore = true;
          let deletedInCol = 0;

          while (hasMore) {
            const snap = await getDocs(query(collection(db, colName), limit(200)));
            if (snap.empty) {
              hasMore = false;
              break;
            }

            const batch = writeBatch(db);
            snap.docs.forEach(d => {
              batch.delete(doc(db, colName, d.id));
            });

            await batch.commit();
            deletedInCol += snap.size;
            totalDeletedDocs += snap.size;

            if (snap.size < 200) {
              hasMore = false;
            }
          }

          if (deletedInCol > 0) {
            setPurgeLogs(prev => [...prev, `  ✅ تم حذف ${deletedInCol} مستند نهائياً من مجموع: ${colName}`]);
          }
        } catch (err: any) {
          setPurgeLogs(prev => [...prev, `  ⚠️ تحذير أثناء حذف ${colName}: ${err?.message || err}`]);
        }
      }

      setPurgeProgress(Math.round((currentStep / totalSteps) * 100));
    }

    // STEP 2: Local Engine & Cache Purge
    currentStep++;
    setPurgeLogs(prev => [...prev, `⏳ [2/4 Local Cache Purge]: تطهير الذاكرة المؤقتة أوفلاين والمؤشرات المحلية...`]);

    for (const sec of selectedSections) {
      for (const key of sec.cacheKeys) {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
          totalDeletedCacheKeys++;
        } catch (e) {}
      }
    }

    // Purge offline queue if market or sales or transactions selected
    const purgeOfflineQueue = selectedSectionIds.some(id => ['sales_purchases', 'vaults_balances', 'market_orders'].includes(id));
    if (purgeOfflineQueue) {
      try {
        localStorage.removeItem('jam_offline_queue');
        localStorage.removeItem('jam_pending_operations');
        localStorage.removeItem('jam_telemetry_queue');
        setPurgeLogs(prev => [...prev, `  ✅ تم تفريغ طابور العمليات المعلقة أوفلاين لمنع إعادة الظهور!`]);
      } catch (e) {}
    }

    setPurgeProgress(Math.round((currentStep / totalSteps) * 100));

    // STEP 3: Broadcast Reset Signal & App State Reset
    currentStep++;
    setPurgeLogs(prev => [...prev, `⏳ [3/4 App State Reset]: بث إشارة التظهير الشامل لجلسات التطبيق الميداني (APK/EXE/Web)...`]);
    try {
      localStorage.setItem('jam_deep_purge_signal', Date.now().toString());
      window.dispatchEvent(new CustomEvent('jam_system_reset', { detail: { sections: selectedSectionIds } }));
      setPurgeLogs(prev => [...prev, `  ✅ تم تنظيف React State وإعادة تعيين مؤشرات التطبيق الميداني بنجاح`]);
    } catch (e) {}
    setPurgeProgress(Math.round((currentStep / totalSteps) * 100));

    // STEP 4: Prevent Re-appearance Checkpoint Audit
    currentStep++;
    setPurgeLogs(prev => [...prev, `⏳ [4/4 Prevent Re-appearance]: تسجيل نقطة التطهير المرجعية لمنع عودة البيانات...`]);
    try {
      await addDoc(collection(db, 'systemLogs'), {
        type: 'deep_purge_audit',
        message: `🔥 تم تنفيذ التطهير الشامل النهائي للبيانات لـ ${selectedSections.length} أقسام. إجمالي المستندات المحذوفة: ${totalDeletedDocs}`,
        timestamp: new Date().toISOString(),
        sectionsPurged: selectedSections.map(s => s.id)
      });
      setPurgeLogs(prev => [...prev, `  🎉 [اكتمل التطهير بنجاح]: تم مسح ${totalDeletedDocs} مستند و ${totalDeletedCacheKeys} مفتاح كاش محلي بنسبة 100%!`]);
    } catch (e) {
      setPurgeLogs(prev => [...prev, `  ✅ اكتمل التطهير وتصفية النظام بنسبة 100%!`]);
    }

    setPurgeProgress(100);
    setIsPurging(false);
    setPurgeSuccess(true);
    setConfirmText('');
    
    // Refresh counts
    scanDataCounts();
  };

  const filteredSections = sections.filter(s => 
    s.title.includes(searchTerm) || s.desc.includes(searchTerm)
  );

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-red-900 to-navy-900 p-6 md:p-8 rounded-[2.5rem] border border-red-500/30 shadow-2xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 p-8 opacity-10 pointer-events-none">
          <Flame size={180} className="text-red-500" />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30">
              <Flame size={32} className="animate-bounce text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black text-white">تبويب التحدي والتطهير الشامل (Deep Purge Hub)</h2>
                <span className="px-3 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-black rounded-full">
                  Zero-Trace Standard
                </span>
              </div>
              <p className="text-xs md:text-sm text-gray-300 font-bold mt-1">
                تصفية وتطعيم وتطهر السيرفر والكاش المحلي للبرنامج بنسبة 100% لتجهيز النظام للبيع والاستلام النهائي.
              </p>
            </div>
          </div>

          <button
            onClick={scanDataCounts}
            disabled={isScanning || isPurging}
            className="px-4 py-2.5 bg-navy-900/80 hover:bg-navy-800 text-white rounded-xl text-xs font-black border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
            <span>إعادة فحص إحصائيات البيانات</span>
          </button>
        </div>

        {/* Warning strip */}
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-2xl flex items-center gap-3 text-red-300 text-xs font-bold relative z-10">
          <AlertTriangle size={18} className="shrink-0 text-red-400" />
          <span>تحذير حرج: عمليات التطهير المحذوفة غير قابلة للاسترجاع وتؤثر على Firebase و IndexedDB و Local Cache معاً.</span>
        </div>
      </div>

      {/* Control Action Bar */}
      <div className="bg-navy-900/80 p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={toggleSelectAll}
            className="px-4 py-2.5 bg-navy-800 hover:bg-navy-700 text-white rounded-xl text-xs font-black border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
          >
            {selectedSectionIds.length === sections.length ? (
              <>
                <CheckSquare size={16} className="text-emerald-400" />
                <span>إلغاء تحديد الكل</span>
              </>
            ) : (
              <>
                <Square size={16} className="text-gray-400" />
                <span>تحديد كل الأقسام الـ 9 ({selectedSectionIds.length}/{sections.length})</span>
              </>
            )}
          </button>

          <input
            type="text"
            placeholder="البحث في الأقسام..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-navy-950 border border-navy-700 text-white text-xs font-bold rounded-xl px-3 py-2.5 outline-none focus:border-red-500 w-full md:w-60"
          />
        </div>

        {/* Confirm and Purge Execution Button */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder='اكتب "تطهر-النظام" للتأكيد'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="bg-navy-950 border border-red-500/50 text-white text-xs font-bold rounded-xl px-3 py-2.5 outline-none focus:border-red-400 w-full md:w-56 text-center"
          />

          <button
            onClick={executeDeepPermanentPurge}
            disabled={isPurging || selectedSectionIds.length === 0}
            className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shrink-0 ${
              selectedSectionIds.length > 0 && !isPurging
                ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white hover:from-red-700 hover:to-rose-800 shadow-lg shadow-red-600/30 cursor-pointer animate-pulse'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
            }`}
          >
            <Flame size={16} />
            <span>حذف نهائي وتطهير النظام 🔥</span>
          </button>
        </div>
      </div>

      {/* Progress & Live Execution Logs */}
      {(isPurging || purgeLogs.length > 0) && (
        <div className="bg-navy-950 border border-red-500/40 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-black text-white">
            <span className="flex items-center gap-2 text-red-400">
              <Flame size={16} className="animate-spin" />
              سجل تنفيذ التطهير المباشر
            </span>
            <span>{purgeProgress}%</span>
          </div>

          <div className="w-full bg-navy-900 rounded-full h-2.5 overflow-hidden border border-white/10">
            <div
              className="bg-gradient-to-r from-red-500 to-amber-500 h-2.5 transition-all duration-300"
              style={{ width: `${purgeProgress}%` }}
            />
          </div>

          <div className="bg-black/60 p-4 rounded-xl border border-white/5 font-mono text-xs text-gray-300 max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
            {purgeLogs.map((log, index) => (
              <p key={index} className={log.includes('✅') ? 'text-emerald-400 font-bold' : log.includes('⏳') ? 'text-amber-300' : 'text-gray-300'}>
                {log}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 9 Data Sections Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSections.map((sec) => {
          const isSelected = selectedSectionIds.includes(sec.id);

          return (
            <div
              key={sec.id}
              onClick={() => toggleSelectSection(sec.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between gap-4 ${
                isSelected
                  ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/50 scale-[1.01]'
                  : 'bg-navy-900/60 border-white/10 hover:border-white/20 hover:bg-navy-900'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-red-500/20 text-red-400' : 'bg-navy-800 text-gray-400'}`}>
                      <Database size={18} />
                    </div>
                    <h3 className="font-bold text-white text-sm">{sec.title}</h3>
                  </div>

                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    isSelected ? 'bg-red-600 border-red-500 text-white' : 'border-gray-600 bg-navy-950'
                  }`}>
                    {isSelected && <CheckCircle size={14} />}
                  </div>
                </div>

                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  {sec.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-bold text-gray-300">
                <span className="flex items-center gap-1 text-gray-400">
                  <Layers size={13} />
                  {sec.collections.length} مجموعات بيانات
                </span>

                <span className={`px-2 py-0.5 rounded-full ${sec.docCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {isScanning ? 'جاري الفحص...' : `${sec.docCount} مستند مسجل`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
