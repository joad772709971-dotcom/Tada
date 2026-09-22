/**
 * JAM System Pro - Database Architecture (PostgreSQL Schema)
 * Implements the "Diamond Isolation Protocol" using Tenant-key Row-Level Security (RLS)
 * Features High-Precision Micro-Unit Arithmetic (BIGINT representing currency unit x 1000 to prevent JS float errors)
 * Supports morphing B2B industry verticals concurrently.
 */

export const POSTGRES_SCHEMA = `-- تفعيل الامتدادات الأمنية وعزل الهويات المتعددة
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE system_tenants (
    tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    industry_type VARCHAR(50) NOT NULL, -- 'POULTRY', 'PHONES', 'GROCERY', 'CLOTHING', 'ELECTRONICS', 'PARTS'
    theme_profile VARCHAR(50) DEFAULT 'CHROME_INDUSTRIAL'
);

-- الجدول المالي الموحد بالوحدات المصغرة لمنع أخطاء الحسابات
CREATE TABLE financial_ledger (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    account_id VARCHAR(100) NOT NULL,
    debit_micro_units BIGINT NOT NULL DEFAULT 0,  -- المبلغ مضروب في 1000
    credit_micro_units BIGINT NOT NULL DEFAULT 0, -- المبلغ مضروب في 1000
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE financial_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_tenant_isolation ON financial_ledger FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 1. امتداد قسم الجوالات والصيانة
CREATE TABLE industry_phones_spec (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    imei_code VARCHAR(50) UNIQUE,
    hardware_id VARCHAR(100),
    repair_status VARCHAR(50) -- 'DIAGNOSIS', 'PENDING_PARTS', 'COMPLETED'
);

-- 2. امتداد قسم المواد الغذائية (تواريخ الانتهاء والباركود المتعدد)
CREATE TABLE industry_grocery_spec (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    barcode_package VARCHAR(50), -- باركود الكرتون
    barcode_unit VARCHAR(50),    -- باركود الحبة
    expiration_date DATE NOT NULL
);

-- 3. امتداد قسم الملابس والأقمشة (مصفوفة المقاس واللون)
CREATE TABLE industry_apparel_matrix (
    matrix_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    item_name VARCHAR(150),
    item_size VARCHAR(20),  -- S, M, L, XL, XXL
    item_color VARCHAR(30)  -- أسود، أبيض، أزرق
);

-- 4. amtdad قسم قطع الغيار (التوافقية والـ Part Number)
CREATE TABLE industry_automotive_parts (
    part_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    part_number VARCHAR(100) NOT NULL,
    compatible_models TEXT[] -- مصفوفة موديلات السيارات المتوافقة
);

-- 5. امتداد قسم الإلكترونيات الثقيلة والطاقة الشمسية
CREATE TABLE industry_electronics_solar (
    spec_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id),
    serial_number VARCHAR(100) UNIQUE,
    voltage_rating INT,   -- الفولتية
    amperage_rating INT,  -- الأمبير
    warranty_months INT DEFAULT 12
);

-- ==========================================
-- ABSOLUTE EXTENSIBILITY ENGINE ADDITIONS --
-- ==========================================

-- 1. الفئات المتداخلة (Nested Categories) لجميع القطاعات
CREATE TABLE tenant_categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    parent_id UUID REFERENCES tenant_categories(category_id) ON DELETE CASCADE,
    category_name VARCHAR(150) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb -- يدعم خصائص لا نهائية وتخصيصات ديناميكية
);

-- 2. عبوات التعبئة التخصصية وقواعد التحويل الرياضي للوحدات
CREATE TABLE tenant_packaging_units (
    unit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    unit_name VARCHAR(50) NOT NULL, -- كرتون، علبة، كيس، قطعة
    base_unit_id UUID REFERENCES tenant_packaging_units(unit_id) ON DELETE CASCADE, -- الوحدة الأساسية المقابلة
    conversion_factor NUMERIC(15, 6) DEFAULT 1.0, -- معامل الضرب بالوحدة الحبة (مثال الكرتون = 12 عبوة)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول الكيانات والخصائص الديناميكية (EAV Pattern) لتخصيص الكيانات والمواصفات بالتفصيل
CREATE TABLE tenant_custom_entities (
    entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    entity_class VARCHAR(100) NOT NULL, -- 'POULTRY_BARN', 'POULTRY_SLAUGHTER', 'POULTRY_DISTRIB', 'POULTRY_STAFF', 'APPAREL_STUDIO', 'APPAREL_STAFF'
    entity_name VARCHAR(255) NOT NULL,
    attributes JSONB DEFAULT '{}'::jsonb, -- تخزين ديناميكي للخصائص مثل (رقم العنبر، مساحة المخزن، الوردية، الألوان، المقاسات)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. أسعار الصرف المتغيرة والعملات المعتمدة لكل تاجر (Multi-Currency)
CREATE TABLE tenant_currencies (
    currency_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    currency_code VARCHAR(10) NOT NULL, -- YER, USD, SAR
    currency_name VARCHAR(100) NOT NULL, -- ريال يمني، دولار، ريال سعودي
    exchange_rate_to_base NUMERIC(18, 6) DEFAULT 1.0, -- سعر الصرف الفعلي
    is_base BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. الأصول الثابتة وتسجيل استهلاكاتها الدورية (Fixed Assets & Depreciation)
CREATE TABLE tenant_assets (
    asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    asset_name VARCHAR(255) NOT NULL, -- شاحنة نقل مبردة، عقار مزرعة، مكائن فرز
    asset_class VARCHAR(100) NOT NULL, -- REAL_ESTATE, FLEET, MACHINERY, ELECTRONICS
    acquisition_cost_micro BIGINT NOT NULL, -- تكلفة الشراء بالمايكرو-ريال لمنع الكسور
    salvage_value_micro BIGINT NOT NULL DEFAULT 0, -- القيمة التخريدية المتوقعة
    useful_life_months INT NOT NULL, -- عمر الخدمة الإفتراضي بالأشهر
    current_depreciation_micro BIGINT NOT NULL DEFAULT 0, -- الإهلاك المتراكم الفعلي
    depreciation_method VARCHAR(50) DEFAULT 'STRAIGHT_LINE', -- طريقة قسط الإهلاك الثابت
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. المستودعات لا تناهية للـ Tenant والتحويل البيني المعتمد من المشرفين
CREATE TABLE tenant_warehouses (
    warehouse_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    warehouse_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);

-- 7. عمليات نقل البضائع بين المستودعات مع مراحل التدقيق والموافقة
CREATE TABLE warehouse_transfers (
    transfer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    source_warehouse_id UUID NOT NULL REFERENCES tenant_warehouses(warehouse_id) ON DELETE CASCADE,
    destination_warehouse_id UUID NOT NULL REFERENCES tenant_warehouses(warehouse_id) ON DELETE CASCADE,
    item_id UUID NOT NULL, -- الصنف المنقول
    quantity_allocated INT NOT NULL,
    approval_status VARCHAR(50) DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'
    approved_by VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. الجرد الفعلي للمستودعات ومطابقة الفروقات المالية (Physical Inventory Auditing)
CREATE TABLE inventory_audits (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system_tenants(tenant_id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES tenant_warehouses(warehouse_id) ON DELETE CASCADE,
    audit_date DATE DEFAULT CURRENT_DATE,
    items_audited JSONB DEFAULT '[]'::jsonb, -- مصفوفة العناصر، والكمية النظامية، والكمية الفعلية، والفرق الإجمالي
    auditor_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED' -- STATUS: DRAFT, COMPLETED
);

-- وحدة الحراج العام الموحد (Public Auctions Engine)
CREATE TABLE public_auctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storeId VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    price INT NOT NULL DEFAULT 0,
    description TEXT,
    images TEXT[],
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) DEFAULT 'supplier_publish' -- 'supplier_publish' | 'client_view'
);
`;

export const SCHEMA_EXPLANATION = {
  diamondProtocol: {
    titleAr: "بروتوكول عزل الحسابات الفيدرالي (Diamond Isolation)",
    titleEn: "Diamond Isolation Protocol & Tenant Vaults",
    descAr: "تقنية تعتمد على تفعيل Row Level Security (RLS) على مستوى محرك قاعدة البيانات، لمنع تداخل العمليات أو استعلامات البيانات بين التجار والشركات المنافسة بشكل قاطع. يتم تمرير معرف المستأجر بشكل معزول ومغلف داخل جلسة الاستعلام (Session Context).",
    descEn: "Database-enforced Multi-Tenant Isolation via Row-Level Security (RLS). A custom session variable, `app.current_tenant_id`, acts as a cryptographic gatekeeper, preventing any query bleed or accidental co-mingling of supplier ledger details under high concurrency."
  },
  poultryRation: {
    titleAr: "الجدول المالي الموحد ومقاصد المايكرو-ريال",
    titleEn: "Unified Financial Ledger & Micro-Units",
    descAr: "يسجل محرك القيد المزدوج كافة المعاملات المالية بوحدات مصغرة (Mils/Micro-units) عن طريق ضرب القيم المدخلة في 1000، مما يحمي النظام كلياً من أخطاء التقريب والكسور الناتجة عن لغات البرمجة.",
    descEn: "Handles micro-units bookkeeping where each YER is multiplied by 1000 (BIGINT Micro-Fils value) to preserve 100% precision in banking audits and wholesale calculations."
  }
};
