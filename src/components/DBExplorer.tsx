import { useState } from "react";
import { useAdaptiveTheme } from "./ThemeEngine";
import { POSTGRES_SCHEMA, SCHEMA_EXPLANATION } from "../dbSchema";
import { Database, Copy, Check, ShieldAlert, KeyRound, Code, Award, Eye } from "lucide-react";

export default function DBExplorer() {
  const { tokens } = useAdaptiveTheme();
  const [copied, setCopied] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>("system_tenants");

  // Handle SQL copy action
  const handleCopy = () => {
    navigator.clipboard.writeText(POSTGRES_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Comprehensive interactive documentation chunks for every schema table
  const SCHEMAS_BY_TABLE: Record<
    string,
    {
      sql: string;
      descEn: string;
      descAr: string;
      fields: { name: string; type: string; constr?: string; descAr: string }[];
    }
  > = {
    system_tenants: {
      sql: `CREATE TABLE system_tenants (
    tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    industry_type VARCHAR(50) NOT NULL, -- 'POULTRY', 'PHONES', 'GROCERY', 'CLOTHING', 'ELECTRONICS', 'PARTS'
    theme_profile VARCHAR(50) DEFAULT 'CHROME_INDUSTRIAL'
);`,
      descEn: "Core registry table holding authorized enterprise entities (Tenants). Implements complete B2B tenant logical segregation across Yemen.",
      descAr: "جدول المستأجرين الأساسي في النظام لتطبيق مفهوم الهويات المتعددة وعزل بيانات كل تاجر بشكل كامل وفريد باستخدام مُعرفات UUID مع تفعيل كود العزل المظهري.",
      fields: [
        { name: "tenant_id", type: "UUID", constr: "PRIMARY KEY", descAr: "المعرف الفريد المُولد تلقائياً للمستأجر" },
        { name: "business_name", type: "VARCHAR(255)", constr: "NOT NULL", descAr: "الاسم التجاري الرسمي للشركة أو التاجر" },
        { name: "industry_type", type: "VARCHAR(50)", constr: "NOT NULL", descAr: "القطاع التجاري الأساسي للمستندات والواجهات" },
        { name: "theme_profile", type: "VARCHAR(50)", constr: "DEFAULT", descAr: "الملف المظهري ولون الواجهة المخصصة للـ Tenant" }
      ]
    },
    financial_ledger: {
      sql: `CREATE TABLE financial_ledger (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    account_id VARCHAR(100) NOT NULL,
    debit_micro_units BIGINT NOT NULL DEFAULT 0,  -- المبلغ مضروب في 1000
    credit_micro_units BIGINT NOT NULL DEFAULT 0, -- المبلغ مضروب في 1000
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`,
      descEn: "Standard chart of accounts scaled by 1000 (BIGINT Micro-units) to prevent decimal rounding errors. Supports multi-tenant double-entry audits with Row-Level Security.",
      descAr: "الجدول المالي الموحد بالوحدات المصغرة لتخزين المعاملات من حسابات الأصول والخصوم والمدينين لمنع أخطاء التقريب المحاسبية قاطبة مع حماية مستوى السطر.",
      fields: [
        { name: "entry_id", type: "UUID", constr: "PRIMARY KEY", descAr: "معرف القيد المالي والتحقق المرجعي الفريد" },
        { name: "tenant_id", type: "UUID", constr: "NOT NULL", descAr: "رابط شركة العميل لتطبيق العزل الأمني" },
        { name: "account_id", type: "VARCHAR(100)", constr: "NOT NULL", descAr: "اسم أو معرف الحساب المسمى للموازنة المالية" },
        { name: "debit_micro_units", type: "BIGINT", constr: "DEFAULT 0", descAr: "الرصيد المدين المضروب في 1000 بالريال اليمني لمنع الكسور" },
        { name: "credit_micro_units", type: "BIGINT", constr: "DEFAULT 0", descAr: "الرصيد الدائن المضروب في 1000 بالريال اليمني لمنع الكسور" }
      ]
    },
    industry_phones_spec: {
      sql: `CREATE TABLE industry_phones_spec (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    imei_code VARCHAR(50) UNIQUE,
    hardware_id VARCHAR(100),
    repair_status VARCHAR(50) -- 'DIAGNOSIS', 'PENDING_PARTS', 'COMPLETED'
);`,
      descEn: "Industry 2 Phones spec extension: Tracks mobile devices, hardware IMEI codes, unique HWID diagnostics and repair job status.",
      descAr: "جدول صيانة وعزل الهواتف ومتابعة الـ IMEI للتأكد من هويات الأجهزة والتوالف وبصمة الهاردوير مع تتبع حالة التصليح الفنية باليمن.",
      fields: [
        { name: "item_id", type: "UUID", constr: "PRIMARY KEY", descAr: "معرف الهاتف في صيانة الورشة" },
        { name: "imei_code", type: "VARCHAR(50)", constr: "UNIQUE", descAr: "المعرف الموحد الدولي لمعدات الاتصال IMEI للجوال" },
        { name: "hardware_id", type: "VARCHAR(100)", constr: "NULLABLE", descAr: "بصمة اللوحة الأم للحاسب للتحقق من هوية اللوحات والقطع" },
        { name: "repair_status", type: "VARCHAR(50)", constr: "NOT NULL", descAr: "الحالة الحالية للتشخيص والتصليح (فحص، بانتظار قطع، مكتمل)" }
      ]
    },
    industry_grocery_spec: {
      sql: `CREATE TABLE industry_grocery_spec (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    barcode_package VARCHAR(50), -- باركود الكرتون
    barcode_unit VARCHAR(50),    -- باركود الحبة
    expiration_date DATE NOT NULL
);`,
      descEn: "Industry 3 Grocery spec extension: Handles quick-expiry foods with carton vs single unit barcodes and safety expiration policies.",
      descAr: "إدارة المواد الاستهلاكية والغذائية للتجزئة والجملة، ويدعم الباركود المتعدد (باركود الكرتونة والوحدة الفردية الحبة) وتواريخ الصلاحية الفورية.",
      fields: [
        { name: "item_id", type: "UUID", constr: "PRIMARY KEY", descAr: "معرف المادة الغذائية المستهلكة" },
        { name: "barcode_package", type: "VARCHAR(50)", constr: "NULLABLE", descAr: "الرمز الخطي الملصق على الكرتون الخارجي للبيع بالجملة" },
        { name: "barcode_unit", type: "VARCHAR(50)", constr: "NULLABLE", descAr: "الرمز الخطي الملصق على العبوة الفردية للبيع بالتجزئة" },
        { name: "expiration_date", type: "DATE", constr: "NOT NULL", descAr: "تاريخ انتهاء صلاحية توزيع واستهلاك السلع الغذائية" }
      ]
    },
    industry_apparel_matrix: {
      sql: `CREATE TABLE industry_apparel_matrix (
    matrix_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    item_name VARCHAR(150),
    item_size VARCHAR(20),  -- S, M, L, XL, XXL
    item_color VARCHAR(30)  -- أسود، أبيض، أزرق
);`,
      descEn: "Industry 4 Apparel spec extension: Employs a physical matrix mapping item sizes against colors for complete stock auditing.",
      descAr: "منظومة معاضدة لألبسة والمنسوجات بمستوى محزن عالي الجودة لتفصيل المقاسات (S, M, L, XL) ومطابقتها السريعة بالألوان.",
      fields: [
        { name: "matrix_id", type: "UUID", constr: "PRIMARY KEY", descAr: "المعرف الفريد لخلية المقاس واللون" },
        { name: "item_name", type: "VARCHAR(150)", constr: "NULLABLE", descAr: "اسم الملبوس أو نوع القماش المخزن" },
        { name: "item_size", type: "VARCHAR(20)", constr: "NULLABLE", descAr: "المقاس المحدد مثل S, M, L, XL, XXL لفرز دقيق" },
        { name: "item_color", type: "VARCHAR(30)", constr: "NULLABLE", descAr: "لون القطعة المكتوبة بالتفصيل (أزرق، أسود، أبيض)" }
      ]
    },
    industry_automotive_parts: {
      sql: `CREATE TABLE industry_automotive_parts (
    part_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    part_number VARCHAR(100) NOT NULL,
    compatible_models TEXT[] -- مصفوفة موديلات السيارات المتوافقة
);`,
      descEn: "Industry 5 Motor Parts spec extension: Index compatibility text array mapping specific automobile models against physical OEM code numbers.",
      descAr: "دليل فحص توافق قطع غيار السيارات والمحركات والدراجات، لتجنيب العميل شراء قطعة غير مناسبة لموديل وسنة صنع المركبة باستخدام مصفوفة النصوص المتنامية.",
      fields: [
        { name: "part_id", type: "UUID", constr: "PRIMARY KEY", descAr: "معرف قطعة غيار المحرك" },
        { name: "part_number", type: "VARCHAR(100)", constr: "NOT NULL", descAr: "رقم الفبركة المصنعي الأصلي OEM" },
        { name: "compatible_models", type: "TEXT[]", constr: "NOT NULL", descAr: "قائمة مصفوفة الموديلات المتوافقة برمجياً (مثل: هيلوكس، شاص، صالون)" }
      ]
    },
    industry_electronics_solar: {
      sql: `CREATE TABLE industry_electronics_solar (
    spec_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    serial_number VARCHAR(100) UNIQUE,
    voltage_rating INT,   -- الفولتية
    amperage_rating INT,  -- الأمبير
    warranty_months INT DEFAULT 12
);`,
      descEn: "Industry 6 Solar Panels & Heavy Power spec extension: Verifies engineering power ratings including voltage, amperage and warranty months tracking.",
      descAr: "جدول تتبع الأجهزة الكهربائية الثقيلة ومنظومات المولدات والطاقة الشمسية، ويسجل الأحمال التقنية (أمبير، فولت، فترة الضمان المحددة بالأشهر).",
      fields: [
        { name: "spec_id", type: "UUID", constr: "PRIMARY KEY", descAr: "المعرف الفريد للمعدة الكهربائية أو عقد الطاقة" },
        { name: "serial_number", type: "VARCHAR(100)", constr: "UNIQUE", descAr: "الرقم التسلسلي الفريد للإنفرتر أو البطارية" },
        { name: "voltage_rating", type: "INT", constr: "NULLABLE", descAr: "الفولتية التشغيلية المعتمدة للجهاز الكهربائي" },
        { name: "amperage_rating", type: "INT", constr: "NULLABLE", descAr: "الأمبير والحدود التشغيلية الآمنة" },
        { name: "warranty_months", type: "INT", constr: "DEFAULT 12", descAr: "فترة الضمان بالأشهر المعتمدة للمستوردين" }
      ]
    },
    tenant_categories: {
      sql: `CREATE TABLE tenant_categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    parent_id UUID REFERENCES tenant_categories(category_id) ON DELETE CASCADE,
    category_name VARCHAR(150) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);`,
      descEn: "Nested hierarchical categories mapping with JSONB support for infinite depth categorization inside the tenant inventory flow.",
      descAr: "جدول الفئات الهرمية المتداخلة برابط ذاتي (Self-referencing) لدعم تقسيم السلع والمواد دون نهاية مع مصفوفة متغيرات غير محدودة.",
      fields: [
        { name: "category_id", type: "UUID", constr: "PRIMARY KEY", descAr: "معرف الفئة الفريد" },
        { name: "parent_id", type: "UUID", constr: "REFERENCES", descAr: "رابط الأب لبناء شجرة التصنيفات (مثال: عصائر يتفرع من بقالة)" },
        { name: "category_name", type: "VARCHAR(150)", constr: "NOT NULL", descAr: "اسم التصنيف المدخل للتاجر في اليمن" }
      ]
    },
    tenant_packaging_units: {
      sql: `CREATE TABLE tenant_packaging_units (
    unit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    unit_name VARCHAR(50) NOT NULL,
    base_unit_id UUID REFERENCES tenant_packaging_units(unit_id) ON DELETE CASCADE,
    conversion_factor NUMERIC(15, 6) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`,
      descEn: "Specialized packaging conversion factors allowing precise multi-scale quantity translation (1 Carton = 12 Packs = 24 Pieces) digitally.",
      descAr: "تنظيم مصفوفة عبوات التعبئة الحجمية واحتساب موازين الكميات بالصيغة الرياضية المعتمدة للتحويل للوحدة الحبة الصغرى.",
      fields: [
        { name: "unit_name", type: "VARCHAR(50)", constr: "NOT NULL", descAr: "اسم العبوة المخصصة (كرتون، شوالة، علبة، حبة)" },
        { name: "conversion_factor", type: "NUMERIC", constr: "DEFAULT 1.0", descAr: "معامل الضرب الحسابي لمطابقة الوحدة الصغرى بدقة" }
      ]
    },
    tenant_custom_entities: {
      sql: `CREATE TABLE tenant_custom_entities (
    entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    entity_class VARCHAR(100) NOT NULL,
    entity_name VARCHAR(255) NOT NULL,
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`,
      descEn: "Dynamic metadata schema entity mapper implementing EAV / custom attributes.",
      descAr: "كيان توسيع وتخصيص البيانات لتخزين تفاصيل إضافية للأنشطة والمنتجات عبر تخزين JSONB.",
      fields: [
        { name: "entity_class", type: "VARCHAR", constr: "NOT NULL", descAr: "تصنيف خصائص المتغير المضاف" },
        { name: "attributes", type: "JSONB", constr: "DEFAULT '{}'", descAr: "مخرجات الفهارس الديناميكية المضافة على الطاير من التاجر" }
      ]
    },
    tenant_currencies: {
      sql: `CREATE TABLE tenant_currencies (
    currency_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    currency_code VARCHAR(10) NOT NULL,
    currency_name VARCHAR(100) NOT NULL,
    exchange_rate_to_base NUMERIC(18, 6) DEFAULT 1.0,
    is_base BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`,
      descEn: "Tenant multi-currency system storing fluctuating exchange rates (YER, USD, SAR, etc.) mapped directly with precise conversion parameters.",
      descAr: "إدارة وتخزين قائمة العملات المتداولة وأسعار صرفها المتغيرة لتنفيذ ومطابقة التسويات المتعددة للعملات الأجنبية باليمن.",
      fields: [
        { name: "currency_code", type: "VARCHAR", constr: "NOT NULL", descAr: "كود العملة المعترف به دولياً (YER, USD, SAR)" },
        { name: "exchange_rate_to_base", type: "NUMERIC", constr: "DEFAULT 1.0", descAr: "سعر الصرف الفعلي المعتمد للعملات الأجنبية مقابل العملة الأساس" }
      ]
    },
    tenant_assets: {
      sql: `CREATE TABLE tenant_assets (
    asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    asset_name VARCHAR(255) NOT NULL,
    asset_class VARCHAR(100) NOT NULL,
    acquisition_cost_micro BIGINT NOT NULL,
    salvage_value_micro BIGINT NOT NULL DEFAULT 0,
    useful_life_months INT NOT NULL,
    current_depreciation_micro BIGINT NOT NULL DEFAULT 0,
    depreciation_method VARCHAR(50) DEFAULT 'STRAIGHT_LINE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`,
      descEn: "Fixed Asset ledger registry enabling depreciation calculations safely inside micro-units structure (machinery, land, refrigerator trucks).",
      descAr: "سجل حصر الأصول الثابتة للشركة واحتساب خطط إهلاك القسط المالي بضرب قيم الشراء في 1000 لمنع الفراغات الحسابية.",
      fields: [
        { name: "acquisition_cost_micro", type: "BIGINT", constr: "NOT NULL", descAr: "العائد المالي الأصلي للشراء مضروباً بـ 1000 لتفادي الفلس" },
        { name: "useful_life_months", type: "INT", constr: "NOT NULL", descAr: "العمر التشغيلي الإجمالي للأصل الثابت بالأشهر" }
      ]
    },
    tenant_warehouses: {
      sql: `CREATE TABLE tenant_warehouses (
    warehouse_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    warehouse_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);`,
      descEn: "Multi-warehouse topology supporting logical partition of physical inventories per merchant locally.",
      descAr: "تهيئة قائمة المستودعات المنفصلة وتجهيز قنوات تداول المواد لتمكين تجار التجزئة من العمل على فروع مختلفة ومواقع متعددة باليمن.",
      fields: [
        { name: "warehouse_name", type: "VARCHAR", constr: "NOT NULL", descAr: "الاسم المعتمد للمخزن الفردي أو الفرع المحاسبي" },
        { name: "is_active", type: "BOOLEAN", constr: "DEFAULT TRUE", descAr: "حالة توافر المستودع النشطة لاستقبال وترحيل المواد" }
      ]
    },
    warehouse_transfers: {
      sql: `CREATE TABLE warehouse_transfers (
    transfer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    source_warehouse_id UUID NOT NULL REFERENCES tenant_warehouses(warehouse_id) ON DELETE CASCADE,
    destination_warehouse_id UUID NOT NULL REFERENCES tenant_warehouses(warehouse_id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    quantity_allocated INT NOT NULL,
    approval_status VARCHAR(50) DEFAULT 'PENDING_APPROVAL',
    approved_by VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`,
      descEn: "Inter-warehouse transit tracker implementing high-security supervisor approval workflow before stock balance modification.",
      descAr: "تتبع عمليات النظير والمناقلة البينية للبضائع والسلع بين مخازن المستأجر مع اشتراط موافقة المشرفين لاعتماد النقل المخزني والمالي.",
      fields: [
        { name: "approval_status", type: "VARCHAR", constr: "DEFAULT PENDING", descAr: "حالة طلب النقل الحالي (بانتظار الموافقة، معتمد، مرفوض)" },
        { name: "quantity_allocated", type: "INT", constr: "NOT NULL", descAr: "الكمية المطلوب نقلها وتسويتها بين الفرعين" }
      ]
    },
    inventory_audits: {
      sql: `CREATE TABLE inventory_audits (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES tenant_warehouses(warehouse_id) ON DELETE CASCADE,
    audit_date DATE DEFAULT CURRENT_DATE,
    items_audited JSONB DEFAULT '[]'::jsonb,
    auditor_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED'
);`,
      descEn: "Physical inventory auditing comparing system quantities against real ledger entries with variance calculation.",
      descAr: "عمليات الجرد الفعلي الميداني لمطابقة المتوفر الحقيقي بالمستودعات مع الرصيد الرقمي بالنظام واحتساب العجز المالي بالمايكرو.",
      fields: [
        { name: "items_audited", type: "JSONB", constr: "DEFAULT '[]'", descAr: "جداول الجرد المعبأة متضمنة الفروقات والمبررات" },
        { name: "auditor_name", type: "VARCHAR", constr: "NOT NULL", descAr: "اسم مسؤول أو مفتش الجرد المالي المكلف بالمطابقة" }
      ]
    }
  };

  return (
    <div className={`p-6 rounded-2xl border ${tokens.borderClass} ${tokens.bgCard} transition-all duration-300 ${tokens.shadowColor} shadow-md`}>
      {/* Arabic and English Header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-6 border-dashed ${tokens.borderClass}`}>
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#4A6741] ml-2" />
            <h2 className={`text-xl font-bold ${tokens.textPrimary} tracking-tight`}>
              مستكشف ومصمم الجداول وقواعد البيانات
            </h2>
          </div>
          <p className={`text-xs ${tokens.textSecondary} mt-1`} dir="rtl">
            مستكشف قواعد البيانات المهيكلة ونماذج عزل البيانات لـ 5 قطاعات تجارية تخصصية في اليمن مع الـ RLS وحسابات المايكرو-ريال الموحدة.
          </p>
        </div>
        
        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E6EEE2] text-[#1B3016] border border-[#A4C639]/30 hover:bg-[#F0F4ED] transition-all text-xs font-bold shadow-sm cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied! / تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Entire SQL / نسخ كامل المخطط</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Row level security banner */}
      <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-200 text-xs text-amber-900">
        <div className="flex gap-3 items-start">
          <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-orange-850">
              بروتوكول العزل وتأمين البيانات ثنائي الاتجاه (RLS Protection Policy)
            </h4>
            <p className="text-slate-600">
              {SCHEMA_EXPLANATION.diamondProtocol.descEn}
            </p>
            <p className="text-slate-700 font-medium" dir="rtl">
              {SCHEMA_EXPLANATION.diamondProtocol.descAr}
            </p>
            <div className="mt-2.5 pt-2.5 border-t border-orange-200 flex flex-wrap gap-2 text-[10px] font-mono text-orange-800">
              <span className="bg-orange-100/50 px-2.5 py-0.5 rounded border border-orange-200">ENABLE ROW LEVEL SECURITY</span>
              <span className="bg-orange-100/50 px-2.5 py-0.5 rounded border border-orange-200">session_setting("app.current_tenant_id")</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Table Navigation Selector */}
        <div className="lg:col-span-4 space-y-3">
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${tokens.textSecondary} text-right`}>
            الجداول العلائقية وعزل البيانات / Relational Tables
          </span>
          <nav className="space-y-1 max-h-[460px] overflow-y-auto pr-1" aria-label="Database Tables">
            {Object.keys(SCHEMAS_BY_TABLE).map((tableName) => {
              const active = selectedTable === tableName;
              return (
                <button
                  key={tableName}
                  onClick={() => setSelectedTable(tableName)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    active
                      ? "bg-[#E6EEE2] text-[#1B3016] border-[#A4C639] font-bold shadow-sm"
                      : `${tokens.borderClass} hover:bg-[#F0F4ED] ${tokens.textSecondary}`
                  }`}
                >
                  <span className="font-mono text-xs">{tableName}</span>
                  <Award className={`w-3.5 h-3.5 ${active ? "text-[#4A6741] opacity-100" : "opacity-0"}`} />
                </button>
              );
            })}
          </nav>

          <div className={`p-4 rounded-xl border mt-5 text-xs ${tokens.borderClass} bg-[#F0F4ED] text-slate-700`}>
            <div className="flex items-center gap-2 mb-2 font-bold text-[#1B3016]">
              <KeyRound className="w-4 h-4 text-[#4A6741]" />
              <span>{SCHEMA_EXPLANATION.poultryRation.titleEn}</span>
            </div>
            <p className="opacity-90 leading-relaxed font-medium">
              {SCHEMA_EXPLANATION.poultryRation.descEn}
            </p>
          </div>
        </div>

        {/* Right Side: Interactive DDL Schema Viewer */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="flex items-center justify-between flex-row-reverse">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${tokens.textSecondary}`}>
              قوانين إنشاء وتنظيم الجداول والـ DDL الموصى بها
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-mono bg-[#E6EEE2] text-[#1B3016] rounded-md border border-[#A4C639]/30">
              مستوى الأمان RLS نشط بمُعرّف المستأجر
            </span>
          </div>

          <div className="rounded-xl bg-[#1B3016] border border-[#E1E8DC]/20 p-4 font-mono text-xs overflow-x-auto text-[#E6EEE2] max-h-[320px] shadow-inner font-mono">
            <pre className="whitespace-pre">{SCHEMAS_BY_TABLE[selectedTable]?.sql || ""}</pre>
          </div>

          {/* Description Block */}
          {SCHEMAS_BY_TABLE[selectedTable] && (
            <div className={`p-4 rounded-xl border space-y-2 ${tokens.borderClass} ${tokens.bgPage}`}>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider flex-row-reverse justify-end">
                <Eye className="w-4 h-4 text-[#4A6741] ml-1.5" />
                <span>الهدف والهيكل المعماري للمستأجرين:</span>
              </div>
              <p className={`text-xs ${tokens.textPrimary}`}>
                {SCHEMAS_BY_TABLE[selectedTable].descEn}
              </p>
              <p className="text-xs text-[#4A6741] font-bold pb-2 text-right" dir="rtl">
                {SCHEMAS_BY_TABLE[selectedTable].descAr}
              </p>

              <div className={`border-t pt-3.5 mt-3.5 ${tokens.borderClass} text-right`}>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  دليل تفهيم الحقول والمفاتيح في المخطط لقاعدة البيانات (POSTGRESQL)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  {SCHEMAS_BY_TABLE[selectedTable].fields.map((field, idx) => (
                    <div key={idx} className={`flex justify-between items-center py-1.5 border-b border-dotted ${tokens.borderClass} px-1 hover:bg-[#F0F4ED] rounded transition-colors`}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#1B3016] font-bold">{field.name}</span>
                        <span className="text-slate-400 text-[10px]">({field.type})</span>
                      </div>
                      <span className="text-slate-500 text-right font-medium">{field.descAr}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
