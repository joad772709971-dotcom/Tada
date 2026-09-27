export type UserRole = 
  | 'superadmin' 
  | 'owner' 
  | 'importer' 
  | 'mega_wholesale' 
  | 'wholesaler' 
  | 'retailer' 
  | 'customer' 
  | 'manager' 
  | 'sales' 
  | 'cashier' 
  | 'engineer' 
  | 'delivery_agent' 
  | 'packer' 
  | 'staff' 
  | 'distributor' 
  | 'supplier' 
  | 'master_wholesale' 
  | 'employee';

export interface NetworkLink {
  id: string;
  wholesalerId: string;
  retailerId: string;
  retailerName: string;
  wholesalerName: string;
  status: 'pending' | 'active' | 'rejected' | 'blocked';
  type?: 'cash_only' | 'both';
  isFinanciallyActive?: boolean; // Added
  creditLimit?: number; 
  openingBalance?: number; 
  balance?: number;
  phone?: string;
  city?: string;
  allowDebt?: boolean;
  rejectCount?: number;
  lastRejectDate?: any;
  overrideCode?: string; 
  createdAt: any;
  updatedAt?: any;
}

export type B2BPriceTier = 'imported' | 'wholesale_wholesale' | 'wholesale' | 'retail';

export interface B2BConnectionRequest {
  id: string;
  senderId: string; // Owner ID / Shop ID of requester
  senderShopName: string;
  senderOwnerName?: string;
  senderPhone?: string;
  senderLocation?: string; // موقع البيع / المدينة
  senderBusinessType?: string;
  senderRole?: UserRole | string;
  receiverId: string; // Supplier Owner ID / Shop ID
  receiverShopName?: string;
  receiverPhone?: string;
  status: 'pending' | 'accepted' | 'rejected';
  assignedPriceTier?: B2BPriceTier;
  creditLimit?: number;
  paymentTerms?: 'cash' | 'net7' | 'net15' | 'net30' | 'credit' | 'open' | string;
  allowedOrderTypes?: ('cash' | 'credit' | 'deposit' | 'jampay')[]; // نوع الطلبات: نقد، آجل، إيداع، jam pay قريباً
  notes?: string; // الملاحظات التجارية من التاجر الطالب
  supplierNotes?: string; // الملاحظات التجارية والشروط من المورد عند الموافقة
  rejectionReason?: string;
  connectionMethod?: 'in_app_request' | 'qr_code' | 'invitation_key';
  createdAt: any;
  updatedAt?: any;
  respondedAt?: any;
}

export interface TechnicalSpecs {
  ram?: string;
  storage?: string;
  battery?: string;
  screenStatus?: string;
  deviceStatus?: 'new' | 'used' | 'refurbished';
  color?: string;
  modelCode?: string;
  [key: string]: any; 
}

export interface WholesaleProduct {
  id: string;
  wholesalerId: string;
  wholesalerName?: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  subCategory?: string;
  specs?: TechnicalSpecs;
  tags?: string[];
  photos: string[];
  agencyName?: string;
  isActive: boolean;
  originalItemId?: string;
  // Tiered Pricing
  price_imported?: number; // سعر المستورد
  price_wholesale_wholesale?: number; // سعر جملة الجملة
  price_wholesale?: number; // سعر الجملة
  price_retail?: number; // سعر التجزئة
  warrantyType?: 'none' | 'operational' | 'limited';
  warrantyDuration?: number;
  compensationOption?: 'refund' | 'replace_same' | 'replace_other';
  subscriberPricingTier?: string;
  createdAt: any;
}

export interface NetworkOrder {
  id: string;
  retailerId: string;
  retailerName: string;
  wholesalerId: string;
  wholesalerName: string;
  Sender_StoreID: string;
  Receiver_StoreID: string;
  ownerId: string; // The parent shop ID for consolidating employee orders
  items: {
    productId: string;
    name: string;
    quantity: number;
    shippedQuantity?: number;
    price: number;
    status?: 'available' | 'shortage';
    warrantyType?: 'none' | 'operational' | 'limited';
    warrantyDuration?: number; // in days
    compensationOption?: 'refund' | 'replace_same' | 'replace_other';
    purchaseDate?: string;
  }[];
  total: number;
  discount?: number;
  status: 'pending' | 'approved' | 'prepping' | 'matched' | 'ready' | 'dispatched' | 'delivered' | 'received' | 'cancelled';
  paymentType: 'cash' | 'debt';
  wholesalerSigned?: boolean;
  retailerSigned?: boolean;
  isOverrideAllowed?: boolean;
  paymentMethod?: string;
  requesterId?: string;
  requesterName?: string;
  rejectionReason?: string;
  overrideNote?: string;
  notes?: string;
  approvedBy?: string;
  approvedByName?: string;
  preparedBy?: string;
  preparedByName?: string;
  matchedBy?: string;
  matchedByName?: string;
  installments?: {
    amount: number;
    date: string;
    addedBy: string;
  }[];
  transferDetails?: {
    referenceNumber: string;
    source: string;
  };
  paidAmount?: number;
  paymentStatus?: 'pending' | 'partial' | 'paid';
  acceptedBy?: string;
  acceptedBy_name?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface ShortageItem {
  id: string;
  ownerId: string;
  name: string;
  quantity: number;
  category: 'shop' | 'spare_part';
  status: 'pending' | 'ordered' | 'received';
  createdAt: any;
  supplierId?: string;
  supplierName?: string;
}

export interface InterfaceCustomization {
  mobilePages: string[];
  desktopPages: string[];
}

export interface Brand {
  id: string;
  name: string;
  logo: string;
  ownerId: string;
}

export interface UnitDefinition {
  id: string;
  name: string;
  ownerId: string;
}

export interface UserQuotas {
  maxEmployees: number;
  maxPrepWorkers: number;
  maxCustomers: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  paymentType: 'commission' | 'salary';
  commissionRate?: number;
  salaryAmount?: number;
  ownerId: string; // The shop owner's ID
  status?: 'active' | 'disabled' | 'suspended' | 'expired' | 'pending';
  hwid?: string; // Browser-based unique ID (Legacy)
  trustedDevices?: string[]; // Multiple browser IDs tracking
  maxDevices?: number; // Maximum allowed devices (1-10)
  registered_pcs?: string[]; // Registered PC HWIDs
  registered_mobiles?: string[]; // Registered Mobile HWIDs
  max_allowed_pcs?: number; // Specific PC limit override
  max_allowed_mobiles?: number; // Specific Mobile limit override
  hwid_bypass?: boolean; // Customer-only hardware limitation override
  mobileAppEnabled?: boolean;
  quotas?: UserQuotas;
  interfaceCustomization?: InterfaceCustomization;
  printerSettings?: {
    type: 'bluetooth' | 'wifi' | 'usb' | 'system';
    printerName?: string;
    paperSize?: '58mm' | '80mm';
    autoPrint?: boolean;
    enabled?: boolean;
  };
  activationKey?: string;
  isActivated?: boolean;
  lastActiveTimestamp?: any; // To prevent time tampering
  currentPassword?: string;
  shopName?: string;
  shopId?: string;
  shopLogo?: string;
  allowSalesForEngineer?: boolean;
  shopPhone?: string;
  shopAddress?: string;
  photo?: string;
  phone?: string;
  isSystemUser?: boolean; // هل الموظف يستخدم النظام ولديه اسم مستخدم وكلمة سر أم موظف عادي
  workSystem?: 'monthly' | 'shifts'; // نظام الدوام: شهري أم ورديات
  shiftPeriods?: string[]; // فترات الورديات المحددة
  dailyWorkHours?: number; // عدد ساعات العمل اليومية
  officialHolidays?: { id: string; name: string; date: string; notes?: string }[]; // الإجازات الرسمية المسجلة
  businessType?: 'mobiles' | 'grocery' | 'construction' | 'clothing' | 'pharmacy' | 'restaurant' | 'wholesale' | 'master_wholesale';
  lastActive?: any;
  isSystemBanned?: boolean;
  systemBanReason?: string;
  systemBanUntil?: any;
  banExpiresAt?: any; // Added for automated bans
  banReason?: string;
  rejectionHistory?: {
    count24h: number;
    distinctMerchants24h: string[];
    lastRejectionAt: any;
  };
  networkRole?: 'wholesaler' | 'retailer' | 'master_wholesale';
  jawaliNumber?: string;
  oneCashNumber?: string;
  kuraimiNumber?: string;
  tier_level?: 'standard' | 'medium' | 'vip';
  followedWholesalerIds?: string[];
  marketVisibilityTiers?: ('imported' | 'wholesale_wholesale' | 'wholesale' | 'retail')[]; // من يستطيع رؤيتي في السوق
  lastAuditDate?: any;
  notificationSettings?: {
    priceMonitorEnabled: boolean;
    currencyMonitorEnabled: boolean;
    debtAlertDays: number;
    installmentAlertEnabled: boolean;
    reviewTime: string; // e.g. "21:00"
    debtMessagingTime: string; // e.g. "10:00"
  };
  uiTheme?: 'classic' | 'modern' | 'touch-pos';
  visualTheme?: 'jam-pro-identity' | 'daylight-pro' | 'safe-vision' | 'clean-minimal' | 'modern-gold' | 'light' | 'dark';
  enableWhatsAppSharing?: boolean;
  enableAutoPrint?: boolean;
  enableAudioUI?: boolean;
  enablePopupNotifications?: boolean;
  enableBarcodeAutoPrice?: boolean;
  enabledModules?: string[];
  distributorId?: string;
  salary?: number;
  joinDate?: any;
  subscriptionType?: 'trial' | 'paid';
  trialStartDate?: any;
  subscriptionEndDate?: any;
  lastRegistrationDate?: any;
  isExcludedFromAutoClean?: boolean;
  trialCode?: string; // Encrypted (Trial Start Date + HWID)
  custodyBalance?: number; // Unreceived money from sales
  isLifetime?: boolean; // Never expires
  lastSyncTimestamp?: any;
  lastCustodyReceivedAt?: any;
  remoteAccessToken?: string;
  remoteAccessEnabled?: boolean;
  isAuthRequired?: boolean; // Toggle for Customer Portal code verification
  autoExposeInventory?: boolean; // Automatically show all in-stock items to customers
  hideFromDiscovery?: boolean; // Hide from public vendor directory
  visibility?: boolean; // Opt-in visibility status
  disableChatRequests?: boolean; // Prevent new chat requests
  
  // Master Admin Controls (Controlled by Developer)
  masterFeatures?: {
    remoteAccess?: boolean;
    cloudSync?: boolean;
    pushNotifications?: boolean;
    mobileScanner?: boolean;
    mobilePrinting?: boolean;
  };
  masterRemotePages?: string[]; // Pages allowed by Master Admin for this shop
  cloudSync?: {
    provider: 'google' | 'mega';
    tokens: any;
    lastSync: string;
  };
  
  // Offline Permissions
  allowOffline?: boolean;
  offlineLimitHours?: number; // How many hours can they stay offline?
  
  // Security 2FA Features
  securityCode?: string; // 8-digit code
  isSecurityCodeSet?: boolean;
  mustChangeSecurityCode?: boolean;
  emergencyRecoveryKey?: string; // For Super Admin
  fcmTokens?: {
    token: string;
    type: 'web' | 'native';
    platform: string;
    updatedAt: string;
  }[];
  customer_app_license?: 'active' | 'inactive';
  hideCostPrice?: boolean;
  hideNetProfit?: boolean;
}

export interface Distributor {
  id: string;
  name: string;
  phone: string;
  email: string;
  debt: number;
  commission: number;
  createdAt: any;
}

export type OrderStatus = 'waiting' | 'working' | 'ready' | 'delivered' | 'failed' | 'awaiting_response';

export interface SparePart {
  id: string;
  name: string;
  cost: number;
  price: number;
  barcode?: string;
}

export interface MaintenanceOrder {
  id: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  deviceBrand: string;
  deviceModel: string;
  deviceSerialNumber?: string; // S/N or IMEI
  orderType: 'hardware' | 'software';
  imei?: string;
  issue: string;
  lockPattern?: string;
  appLockCode?: string; // App Lock PIN / رمز قفل التطبيقات
  status: OrderStatus;
  cost: number;
  advancePayment: number; // Will be labeled as "توصيل" in UI
  sparePartsUsed: SparePart[];
  laborCost?: number;
  damageResponsibility?: number;
  engineerId: string;
  requiredPartName?: string;
  devicePhoto?: string;
  isPartMissing?: boolean;
  createdAt: any;
  updatedAt: any;
}

export type InventoryCategory = string;

export interface InventoryItem {
  id: string;
  ownerId: string;
  name: string;
  category: InventoryCategory;
  type: string;
  stock: number;
  minStock: number;
  price: number;
  wholesalePrice?: number;
  lastBuyPrice?: number;
  replacementPrice?: number; 
  cost: number; 
  model?: string;
  specs?: TechnicalSpecs;
  barcode?: string;
  supplierId?: string;
  // Tiered Pricing
  price_imported?: number; // سعر المستورد
  price_wholesale_wholesale?: number; // سعر جملة الجملة
  price_wholesale?: number; // سعر الجملة
  price_retail?: number; // سعر التجزئة
  photo?: string;
  currency?: string;
  exchangeRate?: number;
  isWholesale?: boolean;
  agencyName?: string;
  images?: string[];
  warehouses?: { [warehouseName: string]: number };
  units?: {
    id: string;
    name: string;
    factor: number; 
    price: number;
    cost: number;
    barcode?: string;
  }[];
  createdAt: any;
  updatedAt?: any;
  compatibilityList?: string[];
  brandId?: string; // Tying product to a Brand
  warrantyType?: 'none' | 'operational' | 'limited';
  warrantyDuration?: number; // in days
  compensationOption?: 'refund' | 'replace_same' | 'replace_other';
}

export interface Warehouse {
  id: string; // e.g., "wh-main" or auto uuid
  name: string; // "المستودع الرئيسي"
  code: string; // "WH_MAIN"
  location?: string;
  ownerId: string;
  createdAt: any;
  updatedAt?: any;
}

export interface WarehouseStock {
  productId: string;
  warehouseId: string;
  stock: number;
  updatedAt: any;
}

export interface FixedAsset {
  id: string;
  ownerId: string;
  name: string; // اسم الأصل (مكيف، سيارة، ديكور)
  value: number;
  purchaseDate: string;
  deductedFromBoxId: string; // الصندوق أو الحساب الذي خصم منه قيمة الأصل (يمكن أن يكون بالريال أو العملات الحرة)
  createdAt: any;
}

export interface AdjustmentVoucher {
  id: string;
  ownerId: string;
  targetBoxId: string; // الصندوق أو الحساب المعدل
  amount: number;
  type: 'INCREMENT' | 'DECREMENT';
  reason: string;
  timestamp: any;
  operatorName: string;
}

export interface Transaction {
  id: string;
  ownerId: string;
  type: 'income' | 'expense';
  amount: number;
  originalAmount?: number;
  category: string;
  description: string;
  currency?: string;
  exchangeRate?: number;
  amountInForeign?: number;
  isUndo?: boolean;
  originalId?: string;
  referenceId?: string;
  accountId?: string;
  orderId?: string;
  addedBy?: string;
  createdAt: any;
}

export interface EngineerTransaction {
  id: string;
  engineerId: string;
  type: 'profit' | 'withdrawal';
  amount: number;
  orderId?: string;
  description: string;
  createdAt: any;
}

export interface BalanceTransaction {
  id: string;
  type: 'purchase' | 'sale';
  amount: number; // The amount sold/bought (e.g. 1000 units)
  cost: number; // Cost in Rial
  price: number; // Price in Rial
  profit: number;
  deductedFromProgram?: number; // Amount deducted from program (e.g. 1000)
  amountReceived?: number; // Amount received from customer (e.g. 1200)
  provider: string; // e.g. Sabafon, Yemen Mobile
  createdAt: any;
}

export interface SIMCard {
  id: string; // The full serial number
  ownerId: string;
  serialNumber: string;
  barcode: string;
  type: 'NEW' | 'REPLACEMENT';
  simType: string; // 4G, 3G
  provider: string;
  purchasePrice: number;
  salesPrice: number;
  status: 'AVAILABLE' | 'SOLD' | 'DAMAGED';
  buyerId?: string;
  buyerType?: 'customer' | 'employee';
  soldAt?: any;
  createdAt: any;
}

export interface BankAccount {
  id: string;
  ownerId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  currency: 'YER' | 'SAR' | 'USD';
  createdAt: any;
}

export interface CustomFinancialBox {
  id: string;
  boxName: string; // مثل: صندوق البيع الحاضر، كاش المحل، الكريمي 5252
  balance: number;
  isLinkedToBank: boolean;
  bankAccountNumber?: string;
  bankAccountId?: string;
  currency?: string;
  createdAt?: any;
}

export interface SIMCardTransaction {
  id: string;
  type: 'purchase' | 'sale_new' | 'sale_replacement';
  simType: string; // e.g. 4G, 3G
  provider: string;
  price: number;
  cost: number;
  barcode: string;
  createdAt: any;
}

export interface Customer {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  shopName?: string;
  address?: string;
  code?: string;
  businessTier?: 'retail' | 'wholesale' | 'mega_wholesale' | 'importer' | 'individual';
  tier?: string;
  allowCredit?: boolean;
  creditLimit?: number;
  isB2BClient?: boolean;
  portalPassword?: string;
  debt: number;
  photo?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface Supplier {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  address?: string;
  debt: number;
  createdAt: any;
}

export interface PrinterSettings {
  enableLabel: boolean;
  enableBarcode: boolean;
  enableInvoice: boolean;
  labelWidth: number;
  labelHeight: number;
  barcodeWidth: number;
  barcodeHeight: number;
  showPriceOnBarcode?: boolean;
  printerName: string;
  printMode?: 'usb' | 'wifi' | 'bluetooth' | 'cloud';
  invoiceTemplate?: 'modern_gold' | 'classic_blue' | 'thermal_compact' | 'royal_black' | 'eco_green';
  labelTemplate?: 'standard_barcode' | 'qr_luxury' | 'jewelry_mini' | 'shipping_bold' | 'tag_simple';
}

export interface MessageTemplates {
  debt: string;
  debt_payment: string;
  device_ready?: string;
  inspection?: string;
  shortage: string;
  installment_reminder: string;
  maintenance_intake?: string;
  maintenance_approval?: string;
  maintenance_shortage?: string;
  account_summary?: string;
}

export interface CurrencyRate {
  id: string;
  name: string; // e.g. 'USD', 'SAR', 'YER'
  rate: number; // rate vs YER
  updatedAt: any;
}

export interface ShopSettings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  shopLogo: string;
  businessType: 'mobiles' | 'grocery' | 'construction' | 'clothing' | 'pharmacy' | 'restaurant' | 'wholesale' | 'master_wholesale';
  max_allowed_posts?: number;

  uiTheme?: 'classic' | 'modern' | 'touch-pos';
  visualTheme?: 'jam-pro-identity' | 'daylight-pro' | 'safe-vision' | 'clean-minimal' | 'modern-gold' | 'emerald-pro' | 'rose-pro' | 'amber-pro' | 'indigo-pro' | 'sky-pro';
  defaultThemeMode?: 'light' | 'dark' | 'system';
  uiCustomization?: {
    headerColor?: string;
    sidebarColor?: string;
    headingFont?: string;
    titleColor?: string;
    cardOpacity?: number; // 0.1 to 1.0
    borderRadius?: string; // 'none' | 'sm' | 'md' | 'lg' | 'full'
  };
  enableWhatsAppSharing?: boolean;
  enableAutoPrint?: boolean;
  enableAudioUI?: boolean;
  enablePopupNotifications?: boolean;
  enableBarcodeAutoPrice?: boolean;
  currency: string;
  licenseExpiry: any;
  smsApiKey: string;
  smsMobileIp: string;
  backupMega: string;
  backupGDrive: string;
  backupMediaFire: string;
  city: string;
  visibility: boolean;
  prayerLockEnabled: boolean;
  maxDiscountPerSale: number;
  salaryAdvanceLimitPercent: number;
  messageTemplates: MessageTemplates;
  printer: PrinterSettings;
  socialLinks?: {
    whatsapp?: string;
    telegram?: string;
    facebook?: string;
  };
  sendSocialLinks?: boolean;
  currencyRates?: {
    [key: string]: {
      buy: number;
      sell: number;
    };
  };
  taxEnabled?: boolean;
  taxPercent?: number;
  discountEnabled?: boolean;
  currentVersion?: string;
  updateUrl?: string;
  emergencyCode?: string;

  // Shop Manager Controls for Remote Access
  remoteAccessPermissions?: {
    [role: string]: string[]; // Allowed pages per role (e.g. 'employee': ['sales', 'dashboard'])
  };
  
  // Cloud Sync Configuration
  cloudSync?: {
    provider?: 'gdrive' | 'mega';
    email?: string;
    isEnabled: boolean;
    lastSyncAt?: any;
  };

  // Push Notifications
  pushNotificationsEnabled?: boolean;
  customBaseUrl?: string;
  productLabels?: string[];
  productCategories?: string[];
  isAuthRequired?: boolean;
  notificationSettings?: {
    priceMonitorEnabled: boolean;
    currencyMonitorEnabled: boolean;
    debtAlertDays: number;
    installmentAlertEnabled: boolean;
    reviewTime: string;
    debtMessagingTime: string;
  };
  autoPricingEnabled?: boolean;
  autoPricingType?: 'buy' | 'sell' | 'both';
  autoPricingProfitMargin?: number;
  autoPricingDirection?: 'cost_to_sale' | 'sale_to_cost' | 'none';
  backupPrices?: { [itemId: string]: { price: number; cost: number } };
  defaultInvoiceType?: 'simplified' | 'detailed';
  warehouseMapping?: {
    suppliers: string;
    customers: string;
    maintenance: string;
    auction: string;
    damaged: string;
    cashSales: string;
  };
  brands?: Brand[];
  units?: UnitDefinition[];
  storeCode?: string;
}

export interface Account {
  id: string;
  ownerId: string;
  accountNumber: string;
  accountName: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parentAccount?: string;
  currency: 'YER' | 'SAR' | 'USD';
  balance: number;
}

export interface VoucherAttachment {
  id: string;
  name: string;
  type: string; // 'image/jpeg', 'image/png', 'application/pdf', etc.
  dataUrl: string; // base64 or storage url
  size?: number;
  uploadedAt?: any;
}

export interface JournalEntryItem {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  currency: string;
  exchangeRate: number;
  baseAmount: number; // Amount in YER
  costCenter?: string;
  reconciled?: boolean;
  reconciledAt?: any;
  reconciliationId?: string;
  notes?: string;
}

export interface JournalEntry {
  id: string;
  ownerId: string;
  date: any;
  description: string;
  reference?: string;
  items: JournalEntryItem[];
  createdAt: any;
  status?: 'approved' | 'pending_approval' | 'rejected' | 'draft';
  costCenter?: string;
  attachments?: VoucherAttachment[];
  createdBy?: {
    uid?: string;
    name?: string;
    role?: string;
  };
  approvedBy?: {
    uid?: string;
    name?: string;
    role?: string;
    at?: any;
  };
  approvedAt?: any;
  rejectedBy?: {
    uid?: string;
    name?: string;
    role?: string;
    reason?: string;
    at?: any;
  };
  rejectedReason?: string;
  type?: string; // 'MANUAL_JV' | 'QUICK_EXPENSE' | 'AUTO_SALE' | 'AUTO_PURCHASE' | 'SYSTEM' | etc.
}

export interface CostCenter {
  id: string;
  ownerId: string;
  code: string;
  name: string;
  type: 'branch' | 'department' | 'project';
  manager?: string;
  budget?: number;
  active: boolean;
  notes?: string;
  createdAt?: any;
}

export interface FinancialAuditLog {
  id: string;
  ownerId: string;
  entityType: 'journal_entry' | 'account' | 'voucher' | 'bank_reconciliation' | 'cost_center' | 'system_closing';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'APPROVE' | 'REJECT' | 'DELETE' | 'RECONCILE' | 'CLOSE_PERIOD';
  actionTitle: string;
  userId: string;
  userName: string;
  userRole?: string;
  timestamp: any;
  details: string;
  beforeState?: any;
  afterState?: any;
  changesSummary?: string;
}

export interface BankReconciliationItem {
  id: string;
  entryId: string;
  date: string;
  reference?: string;
  description: string;
  debit: number;
  credit: number;
  amount: number;
  type: 'deposit' | 'withdrawal';
  reconciled: boolean;
  reconciledAt?: any;
}

export interface BankReconciliation {
  id: string;
  ownerId: string;
  accountId: string;
  accountName: string;
  statementDate: string;
  statementBalance: number;
  bookBalance: number;
  reconciledBalance: number;
  difference: number;
  status: 'completed' | 'draft';
  matchedEntryIds: string[];
  unclearedDeposits: number;
  unclearedWithdrawals: number;
  notes?: string;
  createdAt: any;
  createdBy?: {
    uid?: string;
    name?: string;
    role?: string;
  };
}

export interface GlobalAlert {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  createdAt: any;
  expiresAt?: any;
}

export interface MasterConfig {
  id: string;
  globalAlerts: GlobalAlert[];
  maintenanceMode: boolean;
  latestVersion: string;
}

export type PaymentMatrixMethod = 
  | 'cash' 
  | 'credit' 
  | 'split_cash_debt' 
  | 'transfer' 
  | 'split_deposit_cash' 
  | 'split_deposit_debt' 
  | 'jampay';

export interface DualPaymentInfo {
  enabled: boolean;
  baseCurrency: 'YER' | 'SAR' | 'USD';
  primaryCurrency: 'YER' | 'SAR' | 'USD';
  primaryAmount: number;
  secondaryCurrency: 'YER' | 'SAR' | 'USD';
  secondaryAmount: number;
  exchangeRate: number;
  totalReceivedInBase: number;
  changeAmount: number;
  changeCurrency: 'YER' | 'SAR' | 'USD';
  isFullyPaid: boolean;
  shortageInBase: number;
}

export interface PaymentSplitDetails {
  cashAmount: number;
  debtAmount: number;
  depositAmount: number;
  bankAccountId?: string;
  bankAccountName?: string;
  transferRefNo?: string;
  jamPayRef?: string;
  dueDate?: string;
  notes?: string;
  currency?: string;
  dualPayment?: DualPaymentInfo;
}

export type OrderExecutionMode = 'final_sale' | 'hold_dispatch';

export interface Sale {
  id: string;
  ownerId: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    cost: number;
    returnedAmount?: number;
  }[];
  total: number;
  profit: number;
  paymentMethod: PaymentMatrixMethod | 'cash' | 'transfer' | 'debt' | string;
  paymentDetails?: PaymentSplitDetails;
  orderStatus?: 'completed' | 'held_for_dispatch' | 'in_preparation' | 'delivered';
  dispatchCode?: string;
  accountId?: string; // For transfer
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  networkLinkId?: string; // Linked account ID
  saleType?: 'direct' | 'network'; // Labeling source
  sellerId: string;
  sellerName: string;
  isCustodyReceived?: boolean;
  createdAt: any;
}

export interface VipClient {
  id: string;
  uid: string;
  storeId: string;
  phone: string;
  name?: string;
  password?: string;
  points: number;
  totalSpent: number;
  repairCount: number;
  saleCount: number;
  createdAt?: any;
}

export interface Lead {
  id: string; // phone number
  ownerId: string;
  uid?: string;
  name?: string;
  phone: string;
  points: number;
  totalSpent?: number;
  repairCount?: number;
  saleCount?: number;
  completedQuizzes?: string[];
  lastVisitAt: any;
  createdAt: any;
}

export interface Quiz {
  id: string;
  ownerId: string;
  question: string;
  options: string[];
  correctIndex: number;
  points: number;
  isActive: boolean;
  createdAt: any;
}

export interface QuizAttempt {
  id: string; // phone_quizId
  leadId: string;
  quizId: string;
  isCorrect: boolean;
  pointsEarned: number;
  createdAt: any;
}

export interface PromoOffer {
  id: string;
  ownerId: string;
  itemId: string;
  itemName: string;
  originalPrice: number;
  promoPrice: number;
  description: string;
  image?: string;
  occasion: string;
  specs?: TechnicalSpecs;
  startTime: any;
  endTime: any;
  status: 'active' | 'scheduled' | 'ended';
  createdAt: any;
}

export interface Booking {
  id: string;
  ownerId: string;
  leadId: string; // customer lead doc id
  customerName: string;
  customerPhone: string;
  itemId: string;
  itemName: string;
  promoPrice: number;
  status: 'pending' | 'approved' | 'rejected' | 'accepted';
  acceptedBy?: string;
  acceptedByName?: string;
  createdAt: any;
  updatedAt: any;
  bookingDate?: any;
}

export interface Auction {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category?: string;
  details?: string;
  startPrice: number;
  currentPrice: number;
  minStep: number;
  endTime: any;
  status: 'active' | 'ended' | 'cancelled';
  highestBidderName?: string;
  highestBidderPhone?: string;
  isPublic?: boolean;
  sellerName?: string;
  sellerPhone?: string;
  items?: { name: string; quantity: number }[];
  createdAt: any;
}

export interface Bid {
  id: string;
  auctionId: string;
  ownerId: string;
  amount: number;
  bidderName: string;
  bidderPhone: string;
  createdAt: any;
}

export interface Complaint {
  id: string;
  ownerId: string;
  leadUid?: string;
  userName: string;
  userPhone: string;
  message: string;
  type: 'complaint' | 'suggestion' | 'dev_suggestion';
  status: 'new' | 'read' | 'resolved';
  createdAt: any;
}

export interface Referral {
  id: string;
  ownerId: string;
  referrerPhone: string;
  code: string; 
  discountAmount: number;
  status: 'active' | 'used';
  createdAt: any;
}

export interface ReturnTransaction {
  id: string;
  ownerId: string;
  type: 'customer' | 'supplier';
  itemId: string;
  itemName: string;
  quantity: number;
  price: number; 
  reason: string;
  status: 'completed' | 'pending';
  saleId?: string; 
  purchaseId?: string; 
  createdAt: any;
}

export interface InventoryMatch {
  id: string;
  ownerId: string;
  itemId: string;
  itemName: string;
  softwareStock: number;
  physicalStock: number;
  difference: number;
  valueDifference: number; 
  status: 'pending' | 'adjusted';
  createdAt: any;
  adjustedAt?: any;
}

export interface WarehousePrepOrder {
  id: string;
  ownerId: string;
  orderId: string; 
  customerName: string;
  items: {
    itemId: string;
    name: string;
    requestedQty: number;
    preparedQty: number;
    status: 'pending' | 'ready' | 'missing' | 'short';
    notes?: string;
  }[];
  prepStatus: 'pending' | 'in_progress' | 'ready' | 'completed' | 'with_issues';
  preppedBy?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface MoneyTransfer {
  id: string;
  ownerId: string;
  senderName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'received' | 'cancelled';
  addedBy: string;
  addedByName: string;
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: any;
  notes?: string;
  agencyName?: string;
  images?: string[];
  createdAt: any;
}

export interface DamagedItem {
  id: string;
  ownerId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  cost: number;
  totalLoss: number;
  reason: string;
  createdAt: any;
}

export type ReturnFlowStatus = 'inspection' | 'approval' | 'routing' | 'completed' | 'rejected';

export interface ReturnFlow {
  id: string;
  ownerId: string;
  type: 'customer' | 'supplier';
  itemId: string;
  itemName: string;
  quantity: number;
  totalAmount: number;
  reason: string;
  inspectorId: string;
  inspectorName: string;
  managerId?: string;
  managerName?: string;
  status: ReturnFlowStatus;
  destinationWarehouse?: string;
  financialAction?: 'deduct_debt' | 'credit_balance';
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export interface PublicAuction {
  id: string;
  storeId: string;
  title: string;
  price: number;
  description: string;
  images: string[];
  createdAt: any;
  type: 'supplier_publish' | 'client_view';
}

// =========================================================================
// 🚀 SMART ACCOUNTING MODULES INTERFACES (الوحدات المحاسبية الذكية المتقدمة)
// =========================================================================

export interface SmartInvoiceItem {
  id?: string;
  name: string;
  category?: 'screens' | 'batteries' | 'spare_parts' | 'maintenance' | 'accessories' | 'other';
  quantity: number;
  unitCost: number;
  subtotal: number;
  sellingPrice?: number;
  matchedInventoryId?: string;
  matchedInventoryName?: string;
}

export interface SmartPurchaseInvoiceResult {
  supplierName: string;
  supplierPhone?: string;
  supplierId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  previousBalance: number; // الباقي السابق
  items: SmartInvoiceItem[];
  totalAmount: number; // صافي فاتورة اليوم
  grandTotal: number; // الإجمالي مع الباقي السابق
  paidAmount: number; // المدفوع
  remainingDebt: number; // المتبقي آجل ذمة
  currency: 'YER' | 'SAR' | 'USD';
  notes?: string;
  confidence?: number;
  imageUrl?: string;
  imageStorageRef?: string;
  paymentMethod?: 'cash' | 'debt' | 'partial';
  vaultId?: string; // الخزنة التي تم الدفع منها
  storeId?: string;
  ownerId?: string;
}

export type TelecomServiceType = 
  | 'yemen_mobile_balance'
  | 'yemen_mobile_package'
  | 'sabafon'
  | 'you_mtn'
  | 'yemen_4g'
  | 'feed_balance'
  | 'other';

export interface TelecomOperationRecord {
  id: string;
  storeId: string;
  ownerId: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  operationRef: string;
  serviceType: TelecomServiceType;
  serviceTitle: string;
  targetNumber?: string;
  debitAmount: number; // التكلفة المخصومة من الرصيد
  creditAmount: number; // مبلغ التغذية إن وجد
  status: 'نجاح' | 'فشل' | 'قيد التنفيذ';
  sellingPrice: number; // سعر البيع للزبون
  profit: number; // صافي الربح = sellingPrice - debitAmount
  providerName?: string; // الهادي أونلاين، الشامل، ...
  isDebt?: boolean; // هل تم تحويلها لدين عميل
  debtCustomerId?: string;
  debtCustomerName?: string;
  createdAt?: any;
}

export interface TelecomStatementSummary {
  providerName: string;
  statementDate?: string;
  totalOperations: number;
  totalDebits: number; // إجمالي المخصوم (التكلفة)
  totalCredits: number; // إجمالي التغذية
  totalRevenue: number; // إجمالي سعر البيع
  totalProfit: number; // صافي الأرباح
  byCategory: {
    yemen_mobile_balance: { count: number; cost: number; profit: number };
    yemen_mobile_package: { count: number; cost: number; profit: number };
    sabafon: { count: number; cost: number; profit: number };
    you_mtn: { count: number; cost: number; profit: number };
    yemen_4g: { count: number; cost: number; profit: number };
    feed_balance: { count: number; amount: number };
    other: { count: number; cost: number; profit: number };
  };
}

export interface TelecomPackageCatalogItem {
  id: string;
  storeId: string;
  ownerId: string;
  operator: 'yemen_mobile' | 'sabafon' | 'you' | 'yemen_4g' | 'adsl_landline' | 'other';
  operatorName: string;
  packageName: string;
  category: 'balance' | 'packages' | 'internet' | 'combo';
  wholesaleCost: number; // سعر الشراء من مزود السداد
  retailPrice: number; // سعر البيع للزبون
  profit: number; // الربح المباشر (retailPrice - wholesaleCost)
  unitDescription?: string; // حجم الباقة، الدقائق، الرصيد
  isActive: boolean;
  notes?: string;
  updatedAt?: any;
}

export interface CustomerDebtLinkPayload {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  date: string;
  description: string;
  sourceType: 'telecom_operation' | 'purchase_invoice' | 'service';
  sourceReference: string;
  storeId: string;
  ownerId: string;
  notes?: string;
}



