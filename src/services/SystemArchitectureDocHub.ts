export interface ArchitecturalPillarDoc {
  pillarNumber: number;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  keyComponents: string[];
  securityProtocol: string;
  status: 'active' | 'enforced';
}

export class SystemArchitectureDocHubClass {
  private pillars: ArchitecturalPillarDoc[] = [
    {
      pillarNumber: 1,
      titleAr: 'هيكلية مشاريع الفايربيس الـ 6 الموزعة (6-Tier Firebase Architecture)',
      titleEn: 'Multi-Project Tier Routing',
      summaryAr: 'توزيع الحمل والبيانات عبر 6 مشاريع فايربيس منفصلة ومستقلة حسب دور وطبيعة عمل المستعمل (المشرف العام، المستورد، تاجر الجملة، الموزع، تاجر التجزئة، وبوابة الزبائن).',
      keyComponents: ['FirebaseProjectRouter.ts', 'joad7723-master', 'joad772315', 'joad772315106'],
      securityProtocol: 'Project Isolation & Tier-Level Encryption',
      status: 'enforced'
    },
    {
      pillarNumber: 2,
      titleAr: 'بروتوكول العزل المزدوج الصارم للمحلات والموظفين (Double Isolation Guard)',
      titleEn: 'Strict Merchant & Staff Isolation',
      summaryAr: 'حظر ومنع أي تداخل أو تسريب للبيانات بين المحلات المختلفة أو الموظفين التابعين لمرجعيات تجارية مختلفة عبر اعتراض كافة استعلامات وعمليات الكتابة في Firestore.',
      keyComponents: ['MultiTenantService.ts', 'firebase-wrapper.ts', 'validateStoreAndStaffIsolation'],
      securityProtocol: 'Queries Tenant Guard & Store Lockdown Shield',
      status: 'enforced'
    },
    {
      pillarNumber: 3,
      titleAr: 'جسر سوق الجملة المتقاطع بين المشاريع (Cross-Project Market Catalog)',
      titleEn: 'Cross-Project B2B Wholesale Market Bridge',
      summaryAr: 'ربط وعرض منتجات الجملة والاستيراد مباشرة بين مشاريع المستوردين وتجار التجزئة مع الحفاظ الكامل على خلو البيانات من الأخطاء.',
      keyComponents: ['CrossProjectMarketBridge.ts', 'wholesaleProducts'],
      securityProtocol: 'Public Catalog Read / Isolated Owner Write Protocol',
      status: 'enforced'
    },
    {
      pillarNumber: 4,
      titleAr: 'نظام ترحيل طلبات الشراء والمراسلات المباشرة B2B (Cross-Project Relay Service)',
      titleEn: 'Cross-Project B2B Order & Chat Relay',
      summaryAr: 'ترحيل ألتلقائي لطلبات الشراء والرسائل المباشرة فوراً من مشروع تاجر التجزئة إلى مشروع المستورد أو تاجر الجملة بمرونة تامة.',
      keyComponents: ['CrossProjectRelayService.ts', 'incoming_b2b_orders', 'crossProjectMessages'],
      securityProtocol: 'Direct Inter-Project Ledger Dispatching',
      status: 'enforced'
    },
    {
      pillarNumber: 5,
      titleAr: 'بوابة الزبائن المستقلة B2C (Customer Portal Dedicated Project)',
      titleEn: 'Dedicated Customer Portal Tier',
      summaryAr: 'تخصيص مشروع فايربيس كامل ومستقل (joad772315106) لبوابة الزبائن لتسوق المنتجات ومتابعة الطلبات وكشوفات الحساب بدون التأثير على مشاريع التجار.',
      keyComponents: ['CustomerPortalService.ts', 'b2c_customer_orders', 'customer_ledger_balances'],
      securityProtocol: 'Isolated B2C Auth & Non-Privileged Access Shield',
      status: 'enforced'
    },
    {
      pillarNumber: 6,
      titleAr: 'لوحة التحكم المركزية والمراقبة الشاملة (SuperAdmin Command Center)',
      titleEn: 'Global Telemetry & Health Command Center',
      summaryAr: 'مراقبة حية وشاملة لصحة وأداء المشاريع الستة، إحصائيات المبيعات، المحلات النشطة، وحسابات المشرفين.',
      keyComponents: ['SuperAdminCommandCenter.ts', 'fetchGlobalSystemOverview'],
      securityProtocol: 'Master Admin Cryptographic Session Verification',
      status: 'enforced'
    },
    {
      pillarNumber: 7,
      titleAr: 'مركز الإشعارات الموحد المتقاطع (Cross-Project Notification Hub)',
      titleEn: 'Unified Cross-Project Notification Engine',
      summaryAr: 'توصيل الإشعارات الفورية والتنبيهات المباشرة بين كافة الفئات (طلبات جديدة، ديون، مخزون، إعلانات عامة).',
      keyComponents: ['CrossProjectNotificationHub.ts', 'dispatchNotification'],
      securityProtocol: 'Targeted User Real-time Queue Verification',
      status: 'enforced'
    },
    {
      pillarNumber: 8,
      titleAr: 'محرك التنظيف الشامل وتصفير البيانات الوهمية (Zero-Data Clean-Slate Reset Engine)',
      titleEn: 'Zero-Data Master Clean-Slate Engine',
      summaryAr: 'مسح وتنظيف كافة الحسابات والبيانات التجريبية والوهمية مع الإبقاء على حساب المالك فارغاً وجاهزاً للتشغيل الحقيقي بنسبة 100%.',
      keyComponents: ['ZeroDataMasterResetService.ts', 'executeZeroDataCleanSlate'],
      securityProtocol: 'Master Authorization Key Required for Zero-Data Purge',
      status: 'enforced'
    },
    {
      pillarNumber: 9,
      titleAr: 'نظام النسخ الاحتياطي التلقائي المتقاطع (Cross-Project Multi-Tier Backup Service)',
      titleEn: 'Multi-Tier Snapshot & Backup Service',
      summaryAr: 'أخذ لقطات احتياطية دورية وتلقائية لقواعد البيانات في المشاريع الستة وتخزين سجلاتها في المشرف العام.',
      keyComponents: ['CrossProjectBackupService.ts', 'createTierBackupSnapshot'],
      securityProtocol: 'Cryptographic Checksum Verification',
      status: 'enforced'
    },
    {
      pillarNumber: 10,
      titleAr: 'محرك التدقيق الأمني ورصد الحوادث المباشر (Security Audit Engine)',
      titleEn: 'Real-time Security Audit & Incident Logging',
      summaryAr: 'تسجيل ورصد ومراقبة محاولات الاختراق، خرق العزل المزدوج، أو التلاعب بالحسابات فور حدوثها.',
      keyComponents: ['SecurityAuditEngine.ts', 'recordSecurityEvent'],
      securityProtocol: 'Immutable Security Audit Trail',
      status: 'enforced'
    },
    {
      pillarNumber: 11,
      titleAr: 'المحقق التلقائي لتكامل النظام المتقدم (Enterprise System Integration Validator)',
      titleEn: '11-Pillar Integration Verification Engine',
      summaryAr: 'فحص دوري وتلقائي لكافة خدمات الربط والبروتوكولات عبر المحاور للتحقق من جاهزيتها المستمرة بدون أي أخطاء.',
      keyComponents: ['EnterpriseSystemValidator.ts', 'runFullEnterpriseTestSuite'],
      securityProtocol: 'Automated Real-time Diagnostic Suite',
      status: 'enforced'
    },
    {
      pillarNumber: 12,
      titleAr: 'مركز وثائق وتصميم المعمارية المتقدمة (System Architecture Documentation Hub)',
      titleEn: 'System Architecture Specification Hub',
      summaryAr: 'دليل المعمارية الفنية المتكامل الشامل لكافة الخدمات، المسارات، المعايير الأمنية، وقواعد قواعد البيانات.',
      keyComponents: ['SystemArchitectureDocHub.ts', 'getSystemPillarsOverview'],
      securityProtocol: 'Standardized Enterprise Reference Specification',
      status: 'enforced'
    },
    {
      pillarNumber: 13,
      titleAr: 'جاهزية الإطلاق الفعلي والتشغيل الحقيقي (Master Launch Execution & Zero-Error Protocol)',
      titleEn: 'Production Master Launch Readiness',
      summaryAr: 'التحقق النهائي الشامل وخلو النظام من الأخطاء كلياً وجاهزيته للعمل الفعلي المباشر.',
      keyComponents: ['compile_applet', 'lint_applet', 'Clean-Sheet Master State'],
      securityProtocol: 'Production Master Seal & Zero-Defect Execution',
      status: 'enforced'
    },
    {
      pillarNumber: 14,
      titleAr: 'محرك التسويات المالية وكشوفات الحساب المتقاطعة (Cross-Project Financial Reconciliation & Ledger Engine)',
      titleEn: 'Cross-Project Multi-Currency Ledger Engine',
      summaryAr: 'إدارة وتتبع التسويات المالية والتحويلات وكشوفات الحسابات المتقاطعة بين المستوردين وتجار الجملة والتجزئة والزبائن عبر المشاريع المتعددة.',
      keyComponents: ['CrossProjectLedgerService.ts', 'financial_settlements', 'cross_ledger_balances'],
      securityProtocol: 'Double-Entry Cryptographic Balance Audit Shield',
      status: 'enforced'
    },
    {
      pillarNumber: 15,
      titleAr: 'المشرف التشغيلي المباشر وختم الاعتماد النهائي للإنتاج (Master Launch Seal & Enterprise Operating Protocol)',
      titleEn: 'Enterprise Production Launch & Integrity Protocol',
      summaryAr: 'الاعتماد النهائي وإطلاق النظام بكامل قدراته المعمارية للتشغيل العملي المباشر بدقة استثنائية وبصورة خالية تماماً من أية أخطاء أو بيانات وهمية.',
      keyComponents: ['EnterpriseProductionSeal.ts', 'masterSystemActivationSeal'],
      securityProtocol: 'Immutable Production Deployment Verification',
      status: 'enforced'
    },
    {
      pillarNumber: 16,
      titleAr: 'تحزيم وتجهيز تطبيقات سطح المكتب المستقلة للتجار (Desktop EXE & Standalone Hardware Wrapper)',
      titleEn: 'Desktop EXE Wrapper & Direct Thermal Hardware Bridge',
      summaryAr: 'تجهيز وتغليف 4 تطبيقات تجارية لسطح المكتب (تجزئة، جملة، جملة جملة، مستورد) بدعم الطباعة الحرارية المباشرة وقارئ الباركود والأوفلاين.',
      keyComponents: ['DesktopStandaloneWrapper.ts', 'DESKTOP_MERCHANT_MANIFESTS', 'directThermalPrint'],
      securityProtocol: 'AppSecurityGuard Desktop Sandbox & Hardened Hardware Bridge',
      status: 'enforced'
    }
  ];

  public getSystemPillarsOverview(): ArchitecturalPillarDoc[] {
    return this.pillars;
  }
}

export const SystemArchitectureDocHub = new SystemArchitectureDocHubClass();
