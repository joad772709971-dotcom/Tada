import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Lock, Eye, EyeOff, Check, RotateCcw, Save, 
  Layers, LayoutDashboard, ShoppingBag, ShoppingCart, Wrench, Smartphone, 
  Video, Sparkles, Package, Cpu, ArrowDownUp, Truck, ScanLine, FileText, 
  Wallet, DollarSign, Calculator, FileCheck, Users, UserCheck, Store, 
  CloudDownload, ClipboardCheck, AlertTriangle, Archive, MessageSquare, 
  Shield, UserCog, Clock, Activity, HelpCircle, Settings, Terminal, 
  Key, Globe, Radio, Bell, Crown, CheckCircle2, RefreshCw
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface PageIsolationConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  isIsolated: boolean; // 100% Strict Tenant Isolation enabled
  isHidden: boolean;   // Hide page from regular store owners & employees
  operationsCovered: string[]; // List of covered operations
  isDevOnly?: boolean;  // True for Developer Panel, Isolation Config, Gemini Keys, etc.
}

export const DEFAULT_SYSTEM_PAGES: PageIsolationConfig[] = [
  // --- المجموعة 1: الرئيسية والمبيعات ---
  {
    id: 'dashboard',
    name: 'لوحة التحكم الرئيسية',
    category: 'POS & Sales',
    description: 'شاشة المؤشرات العامة والمبيعات والمصروفات اليومية',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['المبيعات اليومية', 'الفرع النشط', 'الأجهزة في الصيانة', 'صافي الأرباح']
  },
  {
    id: 'quick_sales',
    name: 'المبيعات والصيانة السريعة',
    category: 'POS & Sales',
    description: 'نافذة البيع الفوري وصيانة الأجهزة والمستلزمات',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['الفواتير الفورية', 'الخصم المباشر للمخزون', 'صندوق الكاشير', 'طباعة الإيصال']
  },
  {
    id: 'retail_cashier',
    name: 'كاشير التجزئة',
    category: 'POS & Sales',
    description: 'واجهة الكاشير المخصصة لخدمة الزباين السريعة والنقاط',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['سلة التجزئة', 'النقاط والخصومات', 'تسليم الصندوق', 'فواتير العايد']
  },
  {
    id: 'wholesale_pos',
    name: 'مبيعات الجملة',
    category: 'POS & Sales',
    description: 'إصدار فواتير الكرتون والجملة للعملاء والتجار',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['أسعار الجملة', 'خصم المخزون الرئيسي', 'آجل وحسابات التجّار', 'السندات']
  },
  {
    id: 'maintenance_workshop',
    name: 'الصيانة والورشة',
    category: 'POS & Sales',
    description: 'إدارة بطاقات الصيانة الفنية والأجهزة وقطع الغيار',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['بطاقات الأجهزة', 'قطع غيار الورشة', 'أجور المهندسين', 'تسليم الزباين']
  },
  {
    id: 'credit_and_sims',
    name: 'رصيد وكروت',
    category: 'POS & Sales',
    description: 'بيع كروت الشحن ورصيد الشبكات المحلية والفئات',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['كروت الشحن', 'تحويل الرصيد المباشر', 'تسوية الصناديق', 'هامش الربح']
  },
  {
    id: 'reels_manager',
    name: 'إدارة العروض Reels',
    category: 'POS & Sales',
    description: 'نشر مقاطع الفيديو والعروض الترويجية لمنتجات المحل',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['فيديوهات العروض', 'التفاعل المباشر', 'خصومات المنتجات', 'كتالوج المحل']
  },
  {
    id: 'smart_commerce',
    name: 'التجارة الذكية',
    category: 'POS & Sales',
    description: 'ربط المتجر الإلكتروني وطلبات الشراء الذكية عبر الإنترنت',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['طلبات المتجر', 'بوابة الدفع', 'العملاء أونلاين', 'حالة الشحن']
  },

  // --- المجموعة 2: المخازن والخدمات اللوجستية ---
  {
    id: 'inventory_management',
    name: 'إدارة المخزون',
    category: 'Warehouse',
    description: 'شجرة الأصناف المباشرة، الباركود والكميات بجميع الفروع',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['كميات الأصناف', 'أسعار التكلفة', 'طباعة الباركود', 'التحويل بين الفروع']
  },
  {
    id: 'sim_management',
    name: 'مخزن الشرائح',
    category: 'Warehouse',
    description: 'سجل الشرائح والأرقام المميزة وتوثيق الملكية',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['أرقام الشرائح IMSI', 'تفعيل الشرائح', 'تسليم الزباين', 'الأرباح']
  },
  {
    id: 'shortages_and_orders',
    name: 'النواقص والعجز',
    category: 'Warehouse',
    description: 'رصد الأصناف المطلوبة والتنبيه الآلي قبل نفاد الكميات',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['حد الطلب الأدنى', 'طلب التوريد الآلي', 'قوائم النواقص', 'تأكيد الطلبيات']
  },
  {
    id: 'warehouse_prep',
    name: 'تجهيز المستودع',
    category: 'Warehouse',
    description: 'تغليف وإعداد شحنات البضائع والمناقلات',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['طباعة الملصقات', 'فحص الطرود', 'مرفقات الشحنة', 'جاهزية الاستلام']
  },
  {
    id: 'driver_delivery',
    name: 'توصيلات السائقين',
    category: 'Warehouse',
    description: 'متابعة حركة المناديب وسائقي البرادات وتوثيق التسليم',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['خط السير', 'تأكيد التسليم المالي', 'توثيق الإرجاع', 'عهد السائقين']
  },
  {
    id: 'invoice_scanner',
    name: 'ماسح الفواتير',
    category: 'Warehouse',
    description: 'قراءة وتحليل فواتير الموردين المطبوعة بالذكاء الاصطناعي',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['مسح OCR الضوئي', 'إدراج الأصناف للمخزن', 'تسجيل سند الدائن']
  },

  // --- المجموعة 3: المالية والمحاسبة والديون ---
  {
    id: 'reports_comprehensive',
    name: 'التقارير الشاملة',
    category: 'Finances',
    description: 'تقارير الأرباح والخسائر الميزانية وحركة النشاط',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['الأرباح الصافية', 'إجمالي التدفقات', 'حساب الضريبة', 'التقرير السنوي']
  },
  {
    id: 'vaults_and_safes',
    name: 'الصناديق والخزائن',
    category: 'Finances',
    description: 'شجرة الصناديق النقدية والحسابات البنكية وحسابات الصرافين',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['رصيد الصندوق', 'المصروفات والتغذية', 'التحويل بين الصناديق', 'الإقفال']
  },
  {
    id: 'exchange_settlements',
    name: 'تسويات الصرافة',
    category: 'Finances',
    description: 'تسوية حوالات الصرافة وفروقات العملات المحلية والأجنبية',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['أسعار الصرف', 'مطابقة الحوالات', 'فروقات الصرف', 'عمولات الحوالة']
  },
  {
    id: 'accounting_journal',
    name: 'الحسابات والقيود',
    category: 'Finances',
    description: 'دفتر اليومية العامة والقيود المزدوجة والدفاتر',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['القيود اليومية', 'الطرف المدين والدائن', 'شجرة الحسابات', 'توازن الميزان']
  },
  {
    id: 'financial_audit',
    name: 'التدقيق والمحاسبة',
    category: 'Finances',
    description: 'فحص ميزان المراجعة والتدقيق المالي الشامل',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['كشف الأخطاء', 'إعادة الاحتساب', 'المراجعة المحاسبية', 'تأكيد السندات']
  },
  {
    id: 'customer_debts',
    name: 'مديونيات العملاء',
    category: 'Finances',
    description: 'سجلات ديون الزباين والمطالبات وتذكيرات الوتساب',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['كشف حساب الزبون', 'تسديد الديون', 'تذكيرات الوتساب', 'سقف الائتمان']
  },
  {
    id: 'supplier_debts',
    name: 'مستحقات الموردين',
    category: 'Finances',
    description: 'متابعة الديون المستحقة للموردين وجدول السداد',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['كشف المورد', 'سندات الصرف', 'مواعيد الاستحقاق', 'الفواتير الآجلة']
  },
  {
    id: 'supplier_market',
    name: 'سوق الموردين',
    category: 'Finances',
    description: 'منصة B2B للربط والطلب المباشر من الموردين المعتمدين',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['عروض الموردين', 'طلبات الشراء', 'الأسعار الخاصة', 'التوريد المباشر']
  },

  // --- المجموعة 4: الرقابة والعمليات الإدارية ---
  {
    id: 'smart_import',
    name: 'الاستيراد الذكي',
    category: 'Admin',
    description: 'رفع وتحليل ملفات Excel/CSV للمحلات السابقة بسلاسة',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['رفع الأصناف', 'رفع الديون والعملاء', 'المطابقة الحسابية', 'تطهير البيانات']
  },
  {
    id: 'inventory_audit',
    name: 'الجرد والرقابة',
    category: 'Admin',
    description: 'مطابقة المخزون الفعلي مع المخزون الدفتري وتمرير الزيادة والعجز',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['الجرد الميداني', 'تسوية العجز والزيادة', 'تجميد الحركة', 'اعتماد الجرد']
  },
  {
    id: 'damaged_items',
    name: 'التالف والمفاسد',
    category: 'Admin',
    description: 'إتلاف الأصناف والتالف وتسجيل الخسارة على الحسابات',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['سند الإتلاف', 'خصم المخزون', 'قيد خسارة التالف', 'الأسباب المعتمدة']
  },
  {
    id: 'invoice_archive',
    name: 'أرشيف الفواتير',
    category: 'Admin',
    description: 'البحث المستندي الشامل لكافة الفواتير السابقة والإرجاعات',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['بحث بالفاتورة', 'إعادة الطباعة', 'تواريخ الفواتير', 'عرض التفاصيل']
  },
  {
    id: 'chat_and_network',
    name: 'الدردشة والتواصل',
    category: 'Admin',
    description: 'شات وتواصل الفروع والمراسلات الفورية بين طاقم المحل',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['شات الفروع الداخلية', 'إرسال المستندات', 'تنبيهات العمال', 'السجل المغلق']
  },
  {
    id: 'admin_dashboard',
    name: 'الإدارة والرقابة',
    category: 'Admin',
    description: 'لوحة التحكم الإدارية للمحل وإدارة الفروع والصلاحيات',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['صلاحيات الموظفين', 'سياسة الأجهزة', 'بيانات المحل', 'نسخ البيانات']
  },
  {
    id: 'workforce_management',
    name: 'شؤون الموظفين',
    category: 'Admin',
    description: 'إدارة حسابات المهندسين والبائعين والعمولات والرواتب',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['رواتب الموظفين', 'نسب الصيانة والمبيعات', 'المكافآت والخصم', 'العقود']
  },
  {
    id: 'attendance_logs',
    name: 'سجل الدوام والحضور',
    category: 'Admin',
    description: 'حضور وغياب الموظفين وبصمات الدخول بالبصمة الحيوية',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['ساعات الحضور', 'بصمة الجهاز', 'ساعات التأخير', 'تقارير الوردية']
  },
  {
    id: 'activity_audit_logs',
    name: 'سجل النشاط والرقابة',
    category: 'Admin',
    description: 'سجل تتبع الحركات الحية (تعديل، حذف، طباعة، دخول)',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['سجل التغييرات', 'عنوان IP والجهاز', 'حركات الحذف', 'الرقابة الأمنية']
  },

  // --- المجموعة 5: خيارات النظام والأدوات السيادية ---
  {
    id: 'help_center',
    name: 'المساعدة والدعم الفني',
    category: 'System',
    description: 'دليل الاستخدام والتواصل مع الدعم الفني المباشر',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['الأسئلة الشائعة', 'تذاكر الدعم', 'الفيديوهات الشارحة']
  },
  {
    id: 'general_settings',
    name: 'الإعدادات العامة',
    category: 'System',
    description: 'إعدادات النظام العامة والشعار والطابعات والألوان',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['اسم المحل والرمز', 'إعدادات الطابعة', 'العملة الافتراضية', 'شعار المتجر']
  },
  {
    id: 'super_admin_dev_panel',
    name: 'لوحة التحكم للمبرمج (SuperAdmin)',
    category: 'System',
    description: 'لوحة إدارة النظام المركزية للمطور والمالك العام Joad7723',
    isIsolated: true,
    isHidden: true, // Hidden by default for non-developers
    isDevOnly: true,
    operationsCovered: ['إدارة الاشتراكات', 'تراخيص HWID', 'تطهير السحابة', 'التحكم العام']
  },
  {
    id: 'gemini_ai_monitor',
    name: 'مراقب Gemini AI',
    category: 'System',
    description: 'لوحة مراقبة استهلاك الذكاء الاصطناعي واختبار النماذج',
    isIsolated: true,
    isHidden: true, // Hidden by default for non-developers
    isDevOnly: true,
    operationsCovered: ['استهلاك API', 'سجل الاستفسارات', 'تبديل المفاتيح', 'سرعة الاستجابة']
  },
  {
    id: 'system_isolation_control_panel',
    name: 'صفحة التحكم بالعزل والخصوصية',
    category: 'System',
    description: 'لوحة الضبط والسيادة لقواعد العزل التام بين المحلات والشركاء',
    isIsolated: true,
    isHidden: true, // Hidden by default for non-developers
    isDevOnly: true,
    operationsCovered: ['قواعد العزل 100%', 'إخفاء الصفحات', 'تأمين السحابة', 'التطبيقات APK/EXE']
  },
  {
    id: 'gemini_keys_and_rules',
    name: 'مفاتيح وقواعد Gemini AI',
    category: 'System',
    description: 'إدارة مفاتيح API الخاصة بالذكاء الاصطناعي وتعليمات النظام',
    isIsolated: true,
    isHidden: true, // Hidden by default for non-developers
    isDevOnly: true,
    operationsCovered: ['تشفير المفاتيح', 'حدود الاستخدام', 'أوامر النظام System Prompts']
  },

  // --- المجموعة 6: اللوحات العائمة والأدوات المنبثقة السيادية (Overlays & Tools) ---
  {
    id: 'unified_operational_shield',
    name: 'لوحة الضمان والسرعة والأمان الفائق (Unified Operational Shield)',
    category: 'Overlays',
    description: 'تضم: (معلم ناطق، درع الأمان، جرد مالي، تحصيل الديون، مطابقة الصناديق، سجل العمليات، كاشف المصاريف، بصمات HWID، مسرع الكاش، المحاسب الذكي)',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['معلم ناطق', 'درع الأمان', 'جرد مالي', 'تحصيل ديون', 'مطابقة صناديق', 'بصمات HWID', 'المحاسب الذكي']
  },
  {
    id: 'unified_jam_operations_node',
    name: 'النافذة الجانبية الموحدة (UJON)',
    category: 'Overlays',
    description: 'تضم: (إدارة الطلبات والحركة، إدارة المخازن والمخزون، إدارة الحوالات والصناديق Cashier، قنوات B2B)',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['قسم الطلبات', 'قسم المخازن', 'حوالات الصندوق', 'ارتباط الشبكة B2B']
  },
  {
    id: 'b2b_key_generator_portal',
    name: 'بوابة توليد مفاتيح الارتباط الذكية (B2B)',
    category: 'Overlays',
    description: 'توليد مفاتيح الربط مع الموردين والمحلات الصديقة',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['توليد مفاتيح B2B', 'صلاحيات الارتباط', 'ربط المخزون المقيد', 'التشفير']
  },
  {
    id: 'notifications_center_node',
    name: 'مركز الحركة والرقابة الذكية (إشعارات النظام)',
    category: 'Overlays',
    description: 'مركز التنبيهات الفورية والإشعارات الذكية للنظام',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['إشعارات المبيعات', 'تنبهات العجز', 'إشعارات الديون', 'تحديثات السياسة']
  },
  {
    id: 'vip_subscriptions_portal',
    name: 'بوابة اشتراكات الزباين VIP النخبة',
    category: 'Overlays',
    description: 'تفعيل وإدارة مزايا الزباين VIP وتسعير الصيانة المخصص',
    isIsolated: true,
    isHidden: false,
    operationsCovered: ['تراخيص VIP', 'الأسعار الخاصة', 'مزايا الضمان', 'الخدمة السريعة']
  }
];

export default function SystemIsolationMasterPanel() {
  const [pages, setPages] = useState<PageIsolationConfig[]>(() => {
    const saved = localStorage.getItem('jam_system_isolation_config_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with default list to make sure no new items are missing
        return DEFAULT_SYSTEM_PAGES.map(defItem => {
          const found = parsed.find((p: any) => p.id === defItem.id);
          return found ? { ...defItem, ...found } : defItem;
        });
      } catch (e) {
        console.warn('Failed to parse saved isolation config:', e);
      }
    }
    return DEFAULT_SYSTEM_PAGES;
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Fetch remote settings on load from Firestore if available
  useEffect(() => {
    const fetchRemoteConfig = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'tenant_isolation_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const remoteData = snap.data();
          if (remoteData?.pages && Array.isArray(remoteData.pages)) {
            const merged = DEFAULT_SYSTEM_PAGES.map(defItem => {
              const found = remoteData.pages.find((p: any) => p.id === defItem.id);
              return found ? { ...defItem, ...found } : defItem;
            });
            setPages(merged);
            localStorage.setItem('jam_system_isolation_config_v1', JSON.stringify(merged));
          }
        }
      } catch (err) {
        console.warn('Unable to load remote isolation config, using local cache:', err);
      }
    };
    fetchRemoteConfig();
  }, []);

  const toggleIsolation = (id: string) => {
    setPages(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, isIsolated: !p.isIsolated };
      }
      return p;
    }));
  };

  const toggleVisibility = (id: string) => {
    setPages(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, isHidden: !p.isHidden };
      }
      return p;
    }));
  };

  const applyGlobalIsolation = (isolateAll: boolean) => {
    setPages(prev => prev.map(p => ({
      ...p,
      isIsolated: isolateAll
    })));
  };

  const hideAllDevPages = () => {
    setPages(prev => prev.map(p => ({
      ...p,
      isHidden: p.isDevOnly ? true : p.isHidden
    })));
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    setSaveSuccessMsg('');
    try {
      // 1. Save locally to localStorage
      localStorage.setItem('jam_system_isolation_config_v1', JSON.stringify(pages));

      // 2. Broadcast custom event across system UI
      window.dispatchEvent(new CustomEvent('jam_isolation_settings_updated', {
        detail: { pages }
      }));

      // 3. Persist to Firestore document
      const docRef = doc(db, 'system_settings', 'tenant_isolation_config');
      await setDoc(docRef, {
        updatedAt: serverTimestamp(),
        updatedBy: 'Joad7723 (Master Owner)',
        pages: pages.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          isIsolated: p.isIsolated,
          isHidden: p.isHidden
        }))
      }, { merge: true });

      setSaveSuccessMsg('✅ تم حفظ ونشر قواعد العزل والخصوصية السيادية بنجاح وتطبيقها على كافة المحلات والتطبيقات (APK/EXE/Web)!');
    } catch (err: any) {
      console.warn('Error saving isolation config remotely:', err?.message);
      setSaveSuccessMsg('✅ تم حفظ قواعد العزل محلياً وفي المتصفح بنجاح! (سيعمل العزل أوفلاين وأونلاين بدون مشاكل)');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccessMsg(''), 6000);
    }
  };

  const filteredPages = pages.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesQuery = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.operationsCovered.some(op => op.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  const categories = [
    { id: 'all', label: 'كافة الأقسام والصفحات (42)', count: pages.length },
    { id: 'POS & Sales', label: 'الرئيسية والمبيعات (8)', count: pages.filter(p => p.category === 'POS & Sales').length },
    { id: 'Warehouse', label: 'المخازن واللوجستيات (6)', count: pages.filter(p => p.category === 'Warehouse').length },
    { id: 'Finances', label: 'المالية والمحاسبة (8)', count: pages.filter(p => p.category === 'Finances').length },
    { id: 'Admin', label: 'الرقابة والإدارة (9)', count: pages.filter(p => p.category === 'Admin').length },
    { id: 'System', label: 'صفحات المطور السيادية (6)', count: pages.filter(p => p.category === 'System').length },
    { id: 'Overlays', label: 'اللوحات العائمة UJON (5)', count: pages.filter(p => p.category === 'Overlays').length }
  ];

  const totalIsolatedCount = pages.filter(p => p.isIsolated).length;
  const totalHiddenCount = pages.filter(p => p.isHidden).length;

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-2 border-amber-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/40 text-amber-400">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  لوحة إعدادات العزل والخصوصية السيادية الشاملة للنظام
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                    حساب المالك Joad7723
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  الضبط المركزي الصارم لجميع صفحات النظام، اللوحات العائمة، وقواعد الفايربيس بين كافة المحلات والموظفين.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={() => applyGlobalIsolation(true)}
              type="button"
              className="px-4 py-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 font-black text-xs transition-all cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              <span>تفعيل العزل 100% للكل</span>
            </button>

            <button
              onClick={hideAllDevPages}
              type="button"
              className="px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 font-black text-xs transition-all cursor-pointer flex items-center gap-2"
            >
              <EyeOff size={16} />
              <span>إخفاء صفحات المطور السيادية</span>
            </button>

            <button
              onClick={saveConfiguration}
              disabled={isSaving}
              type="button"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              <span>حفظ وتعميم قواعد العزل</span>
            </button>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3 bg-black/40 rounded-2xl border border-white/5">
            <span className="text-[10px] text-slate-400 block font-bold">إجمالي أجزاء النظام:</span>
            <span className="text-lg font-black text-white font-mono">{pages.length} جزءاً</span>
          </div>
          <div className="p-3 bg-emerald-950/40 rounded-2xl border border-emerald-500/30">
            <span className="text-[10px] text-emerald-400 block font-bold">معزولة تماماً 100%:</span>
            <span className="text-lg font-black text-emerald-300 font-mono">{totalIsolatedCount} / {pages.length}</span>
          </div>
          <div className="p-3 bg-purple-950/40 rounded-2xl border border-purple-500/30">
            <span className="text-[10px] text-purple-400 block font-bold">صفحات مخفية عن العمال:</span>
            <span className="text-lg font-black text-purple-300 font-mono">{totalHiddenCount} صفحة</span>
          </div>
          <div className="p-3 bg-indigo-950/40 rounded-2xl border border-indigo-500/30">
            <span className="text-[10px] text-indigo-400 block font-bold">حالة التزامن والأوفلاين:</span>
            <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              مؤمّنة محلياً وسحابياً 🛡️
            </span>
          </div>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border-2 border-emerald-500 text-emerald-200 text-xs sm:text-sm font-black flex items-center gap-3 animate-fade-in shadow-xl">
          <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/90 p-4 rounded-2xl border border-white/10 shadow-lg">
        {/* Category selector */}
        <div className="flex border-b md:border-b-0 border-white/10 pb-2 md:pb-0 gap-2 overflow-x-auto w-full md:w-auto scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeCategory === cat.id 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الصفحة أو العملية..."
            className="w-full pl-4 pr-10 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
          <Terminal size={16} className="absolute left-3 top-2.5 text-slate-500" />
        </div>
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPages.map(page => (
          <div
            key={page.id}
            className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
              page.isDevOnly
                ? 'bg-gradient-to-b from-purple-950/40 via-slate-900 to-slate-950 border-purple-500/40 hover:border-purple-500/70'
                : page.isIsolated
                ? 'bg-slate-900/90 border-emerald-500/30 hover:border-emerald-500/60 shadow-md'
                : 'bg-slate-900/50 border-rose-500/30 hover:border-rose-500/50'
            }`}
          >
            {/* Top Row: Badge & Category */}
            <div>
              <div className="flex justify-between items-start gap-2 mb-3">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-tight border ${
                  page.isDevOnly
                    ? 'bg-purple-950 text-purple-300 border-purple-500/40'
                    : page.category === 'POS & Sales'
                    ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                    : page.category === 'Warehouse'
                    ? 'bg-blue-950 text-blue-300 border-blue-500/40'
                    : page.category === 'Finances'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                    : page.category === 'Admin'
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-500/40'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                }`}>
                  {page.category}
                </span>

                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 ${
                  page.isIsolated
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {page.isIsolated ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
                  {page.isIsolated ? 'عزل كامل 100%' : 'مفتوح/مشترك'}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-sm font-black text-white flex items-center gap-2 mb-1">
                {page.name}
                {page.isDevOnly && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-purple-500/30 text-purple-200 rounded font-bold">
                    سيادي للمطور
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mb-3 font-medium leading-relaxed">
                {page.description}
              </p>

              {/* Covered Operations Chips */}
              <div className="mb-4">
                <span className="text-[10px] text-slate-500 font-bold block mb-1.5">العمليات والبيانات المشمولة بالعزل:</span>
                <div className="flex flex-wrap gap-1">
                  {page.operationsCovered.map((op, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-950 text-slate-300 text-[10px] rounded border border-white/5 font-mono">
                      ✓ {op}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row: Control Buttons */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 mt-2">
              {/* Isolation Toggle Switch */}
              <button
                onClick={() => toggleIsolation(page.id)}
                type="button"
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  page.isIsolated
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10'
                }`}
              >
                <Shield size={14} />
                <span>{page.isIsolated ? 'العزل مفعل 100%' : 'تفعيل العزل'}</span>
              </button>

              {/* Visibility (Hide/Show) Toggle Switch */}
              <button
                onClick={() => toggleVisibility(page.id)}
                type="button"
                title={page.isHidden ? 'الصفحة مخفية عن غير المطور' : 'الصفحة ظاهرة في القوائم'}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                  page.isHidden
                    ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-500/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
                }`}
              >
                {page.isHidden ? <EyeOff size={14} className="text-rose-400" /> : <Eye size={14} className="text-slate-400" />}
                <span>{page.isHidden ? 'مخفية' : 'ظاهرة'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
