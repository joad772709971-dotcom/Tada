import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DevicePermissionsService } from '../services/DevicePermissionsService';
import { 
  FileUp, 
  Table, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Database, 
  Users as UsersIcon, 
  ShoppingBasket, 
  UserPlus, 
  Loader2, 
  ChevronRight,
  ChevronLeft,
  X,
  FileSpreadsheet,
  AlertTriangle,
  Barcode,
  Search,
  Check,
  ShieldCheck,
  Wrench,
  PlusCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  writeBatch, 
  doc, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, InventoryItem, Customer, UserRole } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { generateTransactionId } from '../services/securityService';
import InvoiceScanner from './InvoiceScanner';

const getApiUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  
  // Try environment variables first
  let env_url = (import.meta as any).env?.VITE_APP_URL || '';
  if (env_url && !env_url.includes('localhost')) {
    const domain = env_url.endsWith('/') ? env_url.slice(0, -1) : env_url;
    return `${domain}${endpoint}`;
  }
  
  // Try window.location if not local or capacitor
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const origin = window.location.origin;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !origin.includes('capacitor://')) {
      return `${origin}${endpoint}`;
    }
  }

  // Fallback to active system Run URL
  const backend = 'https://ais-dev-cpravmzzzjg3jsiayido7z-320469830981.europe-west1.run.app';
  return `${backend}${endpoint}`;
};


type ImportType = 'inventory' | 'customers' | 'employees' | 'sales' | 'suppliers' | 'maintenance' | 'custom';

interface ColumnMapping {
  fileColumn: string;
  appField: string;
}

interface SmartImportProps {
  profile: UserProfile | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("SmartImport Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6 text-center text-navy-900 font-sans" dir="rtl">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-black mb-2">عذراً، حدث خطأ غير متوقع في واجهة الاستيراد</h2>
          <p className="text-gray-500 mb-6 max-w-md">يرجى إعادة تعيين الإعدادات والمحاولة من جديد.</p>
          <div className="flex gap-4">
            <button
              onClick={() => {
                localStorage.removeItem('smart_import_step');
                localStorage.removeItem('smart_import_type');
                localStorage.removeItem('smart_import_data');
                localStorage.removeItem('smart_import_cols');
                localStorage.removeItem('smart_import_mappings');
                window.location.reload();
              }}
              className="px-6 py-3 font-bold bg-brand-primary text-white rounded-xl hover:bg-opacity-90 transition-all cursor-pointer"
            >
              إعادة تعيين واجهة الاستيراد
            </button>
            <button
              onClick={() => {
                window.location.hash = '/dashboard';
              }}
              className="px-6 py-3 font-bold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all cursor-pointer"
            >
              الرجوع للوحة التحكم
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SmartImportWithErrorBoundary(props: SmartImportProps) {
  return (
    <ErrorBoundary>
      <SmartImport {...props} />
    </ErrorBoundary>
  );
}

function SmartImport({ profile }: SmartImportProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => {
    try {
      const saved = localStorage.getItem('smart_import_step');
      const val = saved ? parseInt(saved) : 1;
      return (val >= 1 && val <= 4 ? val : 1) as 1 | 2 | 3 | 4;
    } catch {
      return 1;
    }
  });
  const [importType, setImportType] = useState<ImportType | null>(() => {
    try {
      return localStorage.getItem('smart_import_type') as ImportType | null;
    } catch {
      return null;
    }
  });
  const [fileData, setFileData] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('smart_import_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });
  const [columns, setColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('smart_import_cols');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });
  const [mappings, setMappings] = useState<ColumnMapping[]>(() => {
    try {
      const saved = localStorage.getItem('smart_import_mappings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [generateBarcodes, setGenerateBarcodes] = useState(false);
  const [customRoute, setCustomRoute] = useState<string>(() => {
    try {
      return localStorage.getItem('smart_import_custom_route') || '/api/v1/custom-target-route';
    } catch {
      return '/api/v1/custom-target-route';
    }
  });

  const [customFields, setCustomFields] = useState<Array<{ systemKey: string, fileColumn: string }>>(() => {
    try {
      const saved = localStorage.getItem('smart_import_custom_fields');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });

  const [mappedColumns, setMappedColumns] = useState<Record<string, string>>({});
  const [editableRows, setEditableRows] = useState<any[]>([]);

  // Anchor state for the upcoming operational user request
  const [nextFeatureConfig, setNextFeatureConfig] = useState<Record<string, any>>({});
  const [importMethod, setImportMethod] = useState<'excel' | 'ai_scanner'>('excel');

  const executeNextFeaturePipeline = () => {
    console.log("JAM Pro Optimization: Preparing to inject the next user feature layout...");
  };

  // App Fields per Import Type
  const appFields = useMemo(() => {
    switch (importType) {
      case 'inventory':
        return [
          { key: 'item_name', label: 'اسم الصنف', required: true, hints: ["البيان", "اسم الصنف", "الصنف", "اسم المادة", "المادة", "الوصف", "اسم القطعة"] },
          { key: 'cost_price', label: 'سعر التكلفة', required: true, hints: ["تكلفتها", "سعر التكلفة", "التكلفة", "شراء", "سعر الشراء", "تكلفة الصنف"] },
          { key: 'sale_price', label: 'سعر البيع', required: true, hints: ["سعر الحبة", "سعر البيع", "البيع", "سعر التجزئة", "الجملة", "سعر الصنف"] },
          { key: 'quantity', label: 'الكمية الحالية', required: true, hints: ["الكمية الحالية", "الكمية", "المخزون", "الرصيد الحالي", "الكمية المتوفرة", "عدد", "حبات"] },
          { key: 'item_code', label: 'الباركود/رمز الصنف', required: false, hints: ["كود المادة", "رقم الباركود", "الباركود", "كود الصنف", "رقم الصنف", "رمز الصنف", "الرقم التسلسلي"] },
          { key: 'category', label: 'القسم/التصنيف', required: false, hints: ["القسم", "المجموعة", "الفئة", "نوع الصنف", "تصنيف", "قسم البضاعة", "العائلة"] },
          { key: 'model', label: 'الموديل/الماركة', required: false, hints: ["الموديل", "موديل", "النوع", "رقم الموديل", "الموديل/الماركة"] },
          { key: 'new_price', label: 'سعر جديد', required: false, hints: ["السعر الجديد", "سعر جديد", "التسعيرة الجديدة"] },
          { key: 'wholesale_price', label: 'جملة', required: false, hints: ["سعر الجملة", "جملة", "موزع"] },
          { key: 'retail_price', label: 'تجزئة', required: false, hints: ["سعر التجزئة", "تجزئة", "مفرد", "سعر المستهلك"] },
          { key: 'lost_damaged_allowance', label: 'بدل فاقد / تالف', required: false, hints: ["بدل فاقد", "تالف", "استهلاك", "الضياع"] }
        ];
      case 'customers':
        return [
          { key: 'customer_name', label: 'اسم العميل/الحساب', required: true, hints: ["اسم العميل", "العميل", "اسم الحساب", "الحساب", "التفاصيل", "البيان", "المورد", "اسم المورد", "الجهة", "الزبون"] },
          { key: 'total_amount', label: 'المبلغ الإجمالي/عليه', required: true, hints: ["عليه", "له", "الرصيد", "المدين", "الدائن", "المبلغ", "المبلغ الإجمالي", "القيمة", "الصافي", "رصيد الحساب"] },
          { key: 'phone', label: 'رقم الهاتف', required: true, hints: ["رقم الهاتف", "تلفون", "الهاتف", "رقم الجوال", "جوال", "موبايل", "الرقم"] },
          { key: 'date', label: 'التاريخ', required: true, hints: ["التاريخ", "تاريخ الحركة", "تاريخ السند", "التاريخ"] },
          { key: 'paid_amount_le', label: 'له / الحساب الدائن / المسلم', required: false, hints: ["له", "المسلم", "المدفوع", "الدائن", "المسدد"] },
          { key: 'charged_amount_aleih', label: 'عليه / الحساب المدين / المطلوب', required: false, hints: ["عليه", "المطلوب", "المدين", "المستحق عليه"] },
          { key: 'remaining_balance', label: 'الرصيد المتبقي / الحالي', required: false, hints: ["الرصيد المتبقي", "الرصيد الحالي", "المتبقي"] },
          { key: 'notes_details', label: 'البيان / تفاصيل العمليات', required: false, hints: ["البيان", "تفاصيل", "ملاحظات", "البيان والطلب"] }
        ];
      case 'employees':
        return [
          { key: 'employee_name', label: 'اسم الموظف', required: true, hints: ["اسم الموظف", "الموظف", "الاسم رباعي", "اسم العامل"] },
          { key: 'phone', label: 'رقم الهاتف', required: true, hints: ["رقم الهاتف", "تلفون", "الهاتف", "رقم الجوال", "جوال", "موبايل", "الرقم"] },
          { key: 'salary', label: 'الراتب', required: false, hints: ["الراتب", "الراتب الأساسي", "المستحق", "الأجر"] },
          { key: 'role', label: 'الصلاحية والوظيفة', required: false, hints: ["الصلاحية والوظيفة", "الصلاحية", "الوظيفة", "الدور"] },
          { key: 'basic_salary', label: 'راتب أساسي', required: false, hints: ["راتب أساسي", "الأساسي", "الراتب الأساسي"] },
          { key: 'lost_damaged_allowance', label: 'بدل فاقد / استقطاعات', required: false, hints: ["بدل فاقد", "استقطاعات", "خصومات"] }
        ];
      case 'sales':
        return [
          { key: 'invoice_id', label: 'رقم الفاتورة', required: true, hints: ["رقم الفاتورة", "الفاتورة", "رقم السند", "السند", "الرقم الآلي"] },
          { key: 'total_amount', label: 'المبلغ الإجمالي', required: true, hints: ["عليه", "له", "الرصيد", "المدين", "الدائن", "المبلغ", "المبلغ الإجمالي", "القيمة", "الصافي", "رصيد الحساب"] },
          { key: 'date', label: 'تاريخ الفاتورة', required: true, hints: ["التاريخ", "تاريخ الحركة", "تاريخ السند", "التاريخ"] },
          { key: 'customer_name', label: 'اسم العميل/الحساب', required: false, hints: ["اسم العميل", "العميل", "اسم الحساب", "الحساب", "التفاصيل", "البيان", "المورد", "اسم المورد", "الجهة", "الزبون"] },
          { key: 'tax', label: 'الضريبة', required: false, hints: ["الضريبة", "نسبة الضريبة", "المضاف"] },
          { key: 'discount', label: 'الخصم', required: false, hints: ["الخصم", "إجمالي الخصم", "الخصم الممنوح"] },
          { key: 'new_price', label: 'سعر جديد', required: false, hints: ["سعر جديد", "التسعيرة الجديدة"] },
          { key: 'wholesale_price', label: 'جملة', required: false, hints: ["سعر جملة", "سعر الجملة", "جملة"] },
          { key: 'retail_price', label: 'تجزئة', required: false, hints: ["سعر التجزئة", "تجزئة", "مفرد"] },
          { key: 'lost_damaged_allowance', label: 'بدل فاقد / تالف', required: false, hints: ["بدل فاقد", "تالف", "استرجاع"] }
        ];
      case 'suppliers':
        return [
          { key: 'vendor_name', label: 'اسم المورد', required: true, hints: ["اسم العميل", "العميل", "اسم الحساب", "الحساب", "التفاصيل", "البيان", "المورد", "اسم المورد", "الجهة", "الزبون"] },
          { key: 'balance', label: 'الرصيد/عليه', required: true, hints: ["عليه", "له", "الرصيد", "المدين", "الدائن", "المبلغ", "المبلغ الإجمالي", "القيمة", "الصافي", "رصيد الحساب"] },
          { key: 'phone', label: 'رقم الهاتف', required: true, hints: ["رقم الهاتف", "تلفون", "الهاتف", "رقم الجوال", "جوال", "موبايل", "الرقم"] },
          { key: 'date', label: 'التاريخ', required: false, hints: ["التاريخ", "تاريخ الحركة", "تاريخ السند", "التاريخ"] },
          { key: 'company', label: 'اسم الشركة', required: false, hints: ["اسم الشركة", "الشركة", "المؤسسة"] },
          { key: 'supplier_invoice_no', label: 'رقم فاتورة التوريد / الشراء', required: false, hints: ["رقم فاتورة التوريد", "رقم فاتورة الشراء", "رقم الفاتورة", "فاتورة التوريد", "فاتورة الشراء", "المستند", "سند توريد"] },
          { key: 'item_cost_price', label: 'سعر التكلفة / سعر التوريد للقطعة', required: false, hints: ["سعر التكلفة", "سعر التوريد للقطعة", "سعر التوريد", "تكلفة الصنف", "سعر الشراء", "شراء"] },
          { key: 'discount_earned', label: 'الخصم المكتسب / الخصم الممنوح من المورد', required: false, hints: ["الخصم المكتسب", "خصم مكتسب", "خصم المورد", "الخصم الممنوح من المورد"] },
          { key: 'batch_expiry_date', label: 'تاريخ الانتهاء للمجموعات / الدفعات', required: false, hints: ["تاريخ الانتهاء للمجموعات", "تاريخ الانتهاء للدفعات", "تاريخ الانتهاء", "تاريخ الصلاحية", "الانتهاء", "الصلاحية"] },
          { key: 'bonus_quantity', label: 'الكمية المجانية / البونص الممنوح على الكميات', required: false, hints: ["الكمية المجانية", "البونص", "بونص", "الكمية البونص", "مجاني"] },
          { key: 'paid_amount_le', label: 'له / الحساب الدائن / المسلم', required: false, hints: ["له", "المسلم", "المدفوع", "الدائن", "المسدد"] },
          { key: 'charged_amount_aleih', label: 'عليه / الحساب المدين / المطلوب', required: false, hints: ["عليه", "المطلوب", "المدين", "المستحق عليه"] },
          { key: 'remaining_balance', label: 'الرصيد المتبقي / الحالي', required: false, hints: ["الرصيد المتبقي", "الرصيد الحالي", "المتبقي"] },
          { key: 'notes_details', label: 'البيان / تفاصيل العمليات', required: false, hints: ["البيان", "تفاصيل", "ملاحظات", "البيان والطلب"] }
        ];
      case 'maintenance':
        return [
          { key: 'device_model', label: 'موديل الجهاز / النوع', required: true, hints: ["موديل", "النوع", "موديل الجهاز", "الجهاز", "اسم الجهاز"] },
          { key: 'fault_description', label: 'العطل / المشكلة المشكو منها', required: true, hints: ["العطل", "المشكلة", "سبب العطل", "المشكلة المشكو منها", "بيان العطل"] },
          { key: 'repair_cost', label: 'تكلفة الصيانة / أجور اليد', required: false, hints: ["تكلفة الصيانة", "أجور اليد", "أجرة اليد", "سعر الصيانة", "التكلفة"] },
          { key: 'spare_parts_cost', label: 'قطع الغيار المستهلكة', required: false, hints: ["قطع الغيار", "القطع", "قيمة القطع", "قطع غيار"] },
          { key: 'technician_name', label: 'المهندس المسؤول / الفني', required: false, hints: ["المهندس", "الفني", "اسم الفني", "الفني المسؤول"] },
          { key: 'repair_status', label: 'حالة الجهاز / جاهز - قيد الفحص', required: false, hints: ["الحالة", "حالة الجهاز", "حالة الصيانة"] }
        ];
      case 'custom':
        return [
          { key: 'custom_field_1', label: 'حقل مخصص 1', required: false, hints: ["مخصص 1", "حقل 1"] },
          { key: 'custom_field_2', label: 'حقل مخصص 2', required: false, hints: ["مخصص 2", "حقل 2"] },
          { key: 'custom_field_3', label: 'حقل مخصص 3', required: false, hints: ["مخصص 3", "حقل 3"] },
          { key: 'custom_field_4', label: 'حقل مخصص 4', required: false, hints: ["مخصص 4", "حقل 4"] },
          { key: 'custom_field_5', label: 'حقل مخصص 5', required: false, hints: ["مخصص 5", "حقل 5"] },
          { key: 'custom_field_6', label: 'حقل مخصص 6', required: false, hints: ["مخصص 6", "حقل 6"] },
          { key: 'custom_field_7', label: 'حقل مخصص 7', required: false, hints: ["مخصص 7", "حقل 7"] },
          { key: 'custom_field_8', label: 'حقل مخصص 8', required: false, hints: ["مخصص 8", "حقل 8"] }
        ];
      default:
        return [];
    }
  }, [importType]);

  const previewFields = useMemo(() => {
    const fields = [...appFields];
    customFields.forEach(cf => {
      if (cf.systemKey && !fields.some(f => f.key === cf.systemKey)) {
        fields.push({
          key: cf.systemKey,
          label: `${cf.systemKey} (مخصص)`,
          required: false,
          hints: []
        });
      }
    });
    return fields;
  }, [appFields, customFields]);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('smart_import_step', step.toString());
    if (importType) localStorage.setItem('smart_import_type', importType);
    localStorage.setItem('smart_import_data', JSON.stringify(fileData));
    localStorage.setItem('smart_import_cols', JSON.stringify(columns));
    localStorage.setItem('smart_import_mappings', JSON.stringify(mappings));
    localStorage.setItem('smart_import_custom_route', customRoute);
    localStorage.setItem('smart_import_custom_fields', JSON.stringify(customFields));
  }, [step, importType, fileData, columns, mappings, customRoute, customFields]);

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await DevicePermissionsService.requestOnDemand('files');
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    const onComplete = (data: any[], cols: string[]) => {
      setFileData(data);
      setColumns(cols);
      autoMapColumns(cols, data); // Pass data for smarter guessing
      setStep(2);
    };

    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          onComplete(results.data, results.meta.fields || []);
        }
      });
    } else if (['xlsx', 'xls'].includes(extension || '')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        if (data.length > 0) {
          const cols = Object.keys(data[0] as object);
          onComplete(data, cols);
        }
      };
      reader.readAsBinaryString(file);
    } else if (['pdf', 'docx', 'doc'].includes(extension || '')) {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', file);
      if (importType) {
        formData.append('importType', importType);
      }

      fetch(getApiUrl('/api/import-wizard/upload-legacy-file'), {
        method: 'POST',
        body: formData
      })
      .then(async res => {
        try {
          const cloned = res.clone();
          const text = await cloned.text();
          if (text.trim().startsWith('<') || text.trim().toLowerCase().startsWith('<!doctype')) {
            throw new Error('تلقينا استجابة غير صالحة من خادم التحليل السحابي (تنسيق HTML بدلاً من JSON). قد تكون الخدمة غير متوفرة حالياً.');
          }
          return res.json();
        } catch (parseError: any) {
          throw new Error('فشل معالجة استجابة الخادم الذكي: ' + parseError.message);
        }
      })
      .then(result => {
        if (result.success && result.data && result.data.length > 0) {
          const cols = Object.keys(result.data[0] as object);
          onComplete(result.data, cols);
        } else {
          alert(result.error || result.message || 'فشلت معالجة وقراءة ملف المستورد، يرجى التأكد من احتواء الملف على جداول واضحة.');
        }
      })
      .catch(async (err) => {
        console.warn('Legacy cloud ingestion unreachable, switching to local client parser:', err);
        
        try {
          const reader = new FileReader();
          reader.onload = (e) => {
            const fileContent = (e.target?.result as string) || '';
            const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
            
            if (lines.length > 0) {
              const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(',') ? ',' : ';';
              const rawHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
              const headers = rawHeaders.length > 0 ? rawHeaders : ['الاسم', 'السعر', 'الكمية', 'التكلفة'];
              
              const rows = lines.slice(1).map((line, idx) => {
                const parts = line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
                const rowObj: any = { id: `local_imp_${idx}_${Date.now()}` };
                headers.forEach((h, hIdx) => {
                  rowObj[h || `عمود_${hIdx + 1}`] = parts[hIdx] || '';
                });
                return rowObj;
              }).filter(r => Object.values(r).some(v => String(v).trim().length > 0));

              if (rows.length > 0) {
                alert('تم فك وتفكيك مستند البيانات محلياً بنجاح (وضع الأوفلاين السريع).');
                onComplete(rows, headers);
                return;
              }
            }
            alert('تعذر استخراج جدول منظم تلقائياً من المستند محلياً. يرجى اختيار ملف CSV أو Excel محدد الحقول.');
          };
          reader.readAsText(file);
        } catch (localErr: any) {
          alert('تعذر معالجة الملف: ' + localErr.message);
        }
      })
      .finally(() => {
        setIsProcessing(false);
      });
    }
  };

  const [isMappingLoading, setIsMappingLoading] = useState(false);
  const [valReport, setValReport] = useState<any>(null);

  // Smart Auto-Mapping Improvement using backend API
  const autoMapColumns = useCallback(async (fileCols: string[], dataSlice: any[]) => {
    if (fileCols.length === 0) return;
    setIsMappingLoading(true);
    try {
      const resp = await fetch(getApiUrl('/api/import-barcode/suggest-columns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: fileCols, importType })
      });
      
      let data;
      try {
        const cloned = resp.clone();
        const text = await cloned.text();
        if (text.trim().startsWith('<') || text.trim().toLowerCase().startsWith('<!doctype')) {
          console.warn('HTML received instead of JSON for columns mapping suggestions');
          data = { success: false, suggestions: {} };
        } else {
          data = await resp.json();
        }
      } catch (parseErr) {
        console.error('Failed parse suggestions:', parseErr);
        data = { success: false, suggestions: {} };
      }

      if (data.success && data.suggestions) {
        const newMappings: ColumnMapping[] = [];
        Object.entries(data.suggestions).forEach(([fileCol, value]: any) => {
          if (value && value.field) {
            newMappings.push({ fileColumn: fileCol, appField: value.field });
          }
        });
        setMappings(newMappings);
      } else {
        fallbackLocalAutoMap(fileCols, dataSlice);
      }
    } catch (e) {
      console.error('Error fetching backend smart suggestions:', e);
      fallbackLocalAutoMap(fileCols, dataSlice);
    } finally {
      setIsMappingLoading(false);
    }
  }, [importType]);

  const normalizeText = (str: string): string => {
    if (!str) return '';
    return str
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F]/g, '') // strip diacritics
      .replace(/[\s_\-\/\(\)\[\]\{\}\.:,]/g, ''); // strip spacing, separators, punctuation
  };

  const sDiceCoefficient = (s1: string, s2: string): number => {
    const c1 = normalizeText(s1);
    const c2 = normalizeText(s2);
    if (c1 === c2) return 1.0;
    if (c1.length < 2 || c2.length < 2) return 0.0;
    const getBigrams = (str: string) => {
      const bigrams = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
      }
      return bigrams;
    };
    const b1 = getBigrams(c1);
    const b2 = getBigrams(c2);
    let intersection = 0;
    b1.forEach(gram => {
      if (b2.has(gram)) intersection++;
    });
    return (2.0 * intersection) / (b1.size + b2.size);
  };

  const fallbackLocalAutoMap = (fileCols: string[], dataSlice: any[]) => {
    const newMappings: ColumnMapping[] = [];
    (appFields || []).forEach(field => {
      let bestCol: string | null = null;
      let bestScore = 0.0;

      (fileCols || []).forEach(col => {
        const cleanCol = normalizeText(col);
        (field.hints || []).forEach(hint => {
          const cleanHint = normalizeText(hint);

          // 1. Exact match post-normalization
          if (cleanCol === cleanHint) {
            bestScore = 2.0;
            bestCol = col;
          }
          // 2. Substring matching post-normalization
          else if (cleanCol.includes(cleanHint) || cleanHint.includes(cleanCol)) {
            if (bestScore < 1.0) {
              bestScore = 1.0;
              bestCol = col;
            }
          }
          // 3. Sorensen-Dice Coefficient
          else {
            const similarity = sDiceCoefficient(col, hint);
            if (similarity > bestScore && similarity >= 0.7) {
              bestScore = similarity;
              bestCol = col;
            }
          }
        });
      });

      // Phone heuristic check
      if (!bestCol && field.key === 'phone') {
        const foundPhoneCol = (fileCols || []).find(col => {
          const val = String(dataSlice?.[0]?.[col] || '');
          return val.match(/^[0-9+]{7,15}$/);
        });
        if (foundPhoneCol) bestCol = foundPhoneCol;
      }

      if (bestCol) {
        newMappings.push({ fileColumn: bestCol, appField: field.key });
      }
    });
    setMappings(newMappings);
  };

  const addCustomFieldRow = () => {
    const newId = `custom_field_${Date.now()}`;
    const newField = { systemKey: newId, fileColumn: '' };
    setCustomFields(prev => [...prev, newField]);
  };

  const updateCustomFieldSystemKey = (index: number, newKey: string) => {
    const rawKey = newKey.trim().replace(/\s+/g, '_');
    setCustomFields(prev => {
      const copy = [...prev];
      const oldKey = copy[index].systemKey;
      copy[index] = { ...copy[index], systemKey: rawKey };
      
      // Also update mappings array
      setMappings(prevM => {
        const filtered = prevM.filter(m => m.appField !== oldKey && m.appField !== rawKey);
        const oldMapping = prevM.find(m => m.appField === oldKey);
        if (oldMapping) {
          return [...filtered, { appField: rawKey, fileColumn: oldMapping.fileColumn }];
        }
        return filtered;
      });

      return copy;
    });
  };

  const updateCustomFieldFileColumn = (index: number, fileCol: string) => {
    setCustomFields(prev => {
      const copy = [...prev];
      const field = copy[index];
      copy[index] = { ...field, fileColumn: fileCol };

      // Update mappings array
      setMappings(prevM => {
        const filtered = prevM.filter(m => m.appField !== field.systemKey);
        if (fileCol) {
          return [...filtered, { appField: field.systemKey, fileColumn: fileCol }];
        }
        return filtered;
      });

      // Also update mappedColumns state configuration
      setMappedColumns(prevMap => {
        const copyMap = { ...prevMap };
        if (fileCol) {
          copyMap[field.systemKey] = fileCol;
        } else {
          delete copyMap[field.systemKey];
        }
        return copyMap;
      });

      return copy;
    });
  };

  const removeCustomFieldRow = (index: number) => {
    setCustomFields(prev => {
      const copy = [...prev];
      const target = copy[index];
      copy.splice(index, 1);

      // Clean from mappings and mappedColumns
      setMappings(prevM => prevM.filter(m => m.appField !== target.systemKey));
      setMappedColumns(prevMap => {
        const copyMap = { ...prevMap };
        delete copyMap[target.systemKey];
        return copyMap;
      });

      return copy;
    });
  };

  const handleCustomColumnOverride = (systemFieldKey: string, userTypedColumnName: string) => {
    if (!userTypedColumnName.trim()) {
      setMappedColumns(prev => {
        const copy = { ...prev };
        delete copy[systemFieldKey];
        return copy;
      });
      setMappings(prev => prev.filter(m => m.appField !== systemFieldKey));
      return;
    }

    // Register custom column name dynamically if it doesn't exist in our file columns
    if (!columns.includes(userTypedColumnName)) {
      setColumns(prev => [...prev, userTypedColumnName]);
    }

    // 1. Update our dropdown mapping state configuration
    setMappedColumns(prev => ({
      ...prev,
      [systemFieldKey]: userTypedColumnName
    }));

    // 2. Also keep mappings array synced
    setMappings(prev => {
      const filtered = prev.filter(m => m.appField !== systemFieldKey);
      return [...filtered, { appField: systemFieldKey, fileColumn: userTypedColumnName }];
    });

    // 3. Dynamically re-index the rows in our editable view buffer using the new target column data
    setEditableRows(prevRows => {
      return prevRows.map((row, idx) => {
        const originalFileRow = fileData[idx] || {};
        const extractedValue = originalFileRow[userTypedColumnName] || '';
        return {
          ...row,
          [systemFieldKey]: extractedValue
        };
      });
    });
  };

  // Sync mappedColumns and editableRows initially
  useEffect(() => {
    const nextMapped: Record<string, string> = {};
    mappings.forEach(m => {
      nextMapped[m.appField] = m.fileColumn;
    });
    setMappedColumns(nextMapped);
  }, [mappings]);

  useEffect(() => {
    if (fileData.length === 0) {
      setEditableRows([]);
      return;
    }
    const nextRows = fileData.map((row) => {
      const entry: Record<string, any> = { ...row };
      appFields.forEach(f => {
        const m = mappings.find(item => item.appField === f.key);
        const colName = m ? m.fileColumn : '';
        let cellValue = colName ? String(row[colName] || '') : '';
        
        // Frontend safety block if fileData has residual un-sanitized symbols
        const isNumeric = /^\d+[\.\,]*\d*$/.test(cellValue.trim());
        if (!isNumeric && (/[^\u0600-\u06FF\x00-\x7F]/.test(cellValue) || cellValue.includes('½') || cellValue.includes('°') || cellValue.includes('†'))) {
          const fallbackNumber = cellValue.match(/\d+/g);
          cellValue = fallbackNumber ? fallbackNumber.join("-") : '';
        }
        entry[f.key] = cellValue;
      });
      // Synchronize dynamic custom fields
      customFields.forEach(cf => {
        const m = mappings.find(item => item.appField === cf.systemKey);
        const colName = m ? m.fileColumn : '';
        let cellValue = colName ? String(row[colName] || '') : '';

        // Frontend safety block if fileData has residual un-sanitized symbols
        const isNumeric = /^\d+[\.\,]*\d*$/.test(cellValue.trim());
        if (!isNumeric && (/[^\u0600-\u06FF\x00-\x7F]/.test(cellValue) || cellValue.includes('½') || cellValue.includes('°') || cellValue.includes('†'))) {
          const fallbackNumber = cellValue.match(/\d+/g);
          cellValue = fallbackNumber ? fallbackNumber.join("-") : '';
        }
        entry[cf.systemKey] = cellValue;
      });
      return entry;
    });
    setEditableRows(nextRows);
  }, [fileData, mappings, appFields, customFields]);

  // Process Import with High-End Pre-Import Validation on Backend
  const startImport = async () => {
    if (!profile?.ownerId || !importType) return;
    setIsProcessing(true);

    try {
      // Convert mappings array [{ appField, fileColumn }] to userMapping object { [appField]: fileColumn }
      const userMappingObj: Record<string, string> = {};
      (mappings || []).forEach(m => {
        userMappingObj[m.appField] = m.fileColumn;
      });

      console.log("🚀 [Universal Ingestion] Submitting to server-side record mapper...");
      const response = await fetch(getApiUrl('/api/import-wizard/process-custom-mapping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawData: fileData,
          userMapping: userMappingObj,
          targetTable: importType,
          ownerId: profile.ownerId,
          customRoute: importType === 'custom' ? customRoute : undefined
        })
      });

      let result;
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        if (text.trim().startsWith('<') || text.trim().toLowerCase().startsWith('<!doctype')) {
          throw new Error('تلقينا استجابة غير صالحة من بوابة التعيين المحوسبة (HTML بدلاً من JSON). قد يكون هذا بسبب خطأ داخلي في الخادم.');
        }
        result = await response.json();
      } catch (parseErr: any) {
        throw new Error('فشل معالجة وقراءة رد خادم الترجمة المحاسبي: ' + parseErr.message);
      }
      if (result.success) {
        const reportSummary = result.reportSummary || {};
        const warnings = result.warnings || [];

        setResults({
          success: reportSummary.successfullyStored || 0,
          failed: reportSummary.rejected || 0,
          errors: warnings
        });

        // Supply details to our adaptive reporting views
        setValReport({
          autoGeneratedBarcodesCount: reportSummary.autoGeneratedBarcodes || 0,
          duplicateBarcodesFixedCount: warnings.filter((w: string) => typeof w === 'string' && (w.includes('مكرر') || w.includes('تعديل'))).length,
          warningCount: warnings.length,
          successCount: reportSummary.successfullyStored || 0,
          logs: warnings
        });

        setStep(4);
      } else {
        throw new Error(result.error || 'فشلت معالجة الاستيراد السحابي على خوادم الثريا ERP');
      }
    } catch (error: any) {
      console.error("Bulk Import Server error:", error);
      alert('فشل الاستيراد السحابي: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    localStorage.removeItem('smart_import_step');
    localStorage.removeItem('smart_import_type');
    localStorage.removeItem('smart_import_data');
    localStorage.removeItem('smart_import_cols');
    localStorage.removeItem('smart_import_mappings');
    setStep(1);
    setImportType(null);
    setFileData([]);
    setColumns([]);
    setMappings([]);
    setResults(null);
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 pb-24 text-navy-900 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 overflow-hidden relative p-8 rounded-[2rem] bg-gray-50 border border-gray-100 shadow-sm">
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-navy-900 flex items-center gap-3">
            <Database className="text-brand-primary" size={32} />
             الاستيراد الذكي للبيانات
          </h1>
          <p className="text-gray-500 mt-2 font-bold">انتقل من أنظمتك القديمة إلى JAM Pro في دقائق</p>
        </div>
        
        {/* Progress Tracker */}
        <div className="hidden md:flex items-center gap-4 relative z-10">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black transition-all duration-500 border-2 ${
                step >= s ? 'bg-brand-primary border-brand-primary text-white scale-110 shadow-lg shadow-brand-primary/20' : 'bg-gray-100 border-gray-200 text-gray-400'
              }`}>
                {step > s ? <Check size={20} /> : s}
              </div>
              {s < 4 && <div className={`w-8 h-1 rounded-full mx-2 ${step > s ? 'bg-brand-primary' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Select Type and Upload */}
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                  { id: 'inventory', label: 'المخزون', icon: ShoppingBasket, color: 'text-brand-primary' },
                  { id: 'customers', label: 'العملاء', icon: UsersIcon, color: 'text-success' },
                  { id: 'employees', label: 'الموظفين', icon: UserPlus, color: 'text-warning' },
                  { id: 'suppliers', label: 'الموردين', icon: UsersIcon, color: 'text-violet-500' },
                  { id: 'sales', label: 'المبيعات', icon: Database, color: 'text-indigo-500' },
                  { id: 'maintenance', label: 'قسم الصيانة', icon: Wrench, color: 'text-rose-500' },
                  { id: 'custom', label: 'القسم الحر', icon: ShieldCheck, color: 'text-amber-500' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setImportType(type.id as ImportType);
                      // Clear stale mappings of different types when changing selection to refresh cleanly
                      setMappings([]);
                    }}
                    className={`p-4 md:p-6 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-3 group ${
                      importType === type.id 
                        ? type.id === 'custom'
                          ? 'bg-amber-50 border-amber-500 border-4 scale-105 shadow-md shadow-amber-500/10'
                          : 'bg-brand-primary/10 border-brand-primary border-4 scale-105' 
                        : 'bg-white border-gray-100 hover:border-brand-primary/30 shadow-sm'
                    }`}
                  >
                    <div className={`p-3 rounded-2xl bg-gray-50 group-hover:scale-110 transition-transform ${
                      importType === type.id && type.id === 'custom' ? 'bg-amber-100' : ''
                    } ${type.color}`}>
                      <type.icon size={28} />
                    </div>
                    <span className={`text-xs md:text-sm font-black whitespace-nowrap ${
                      importType === type.id 
                        ? type.id === 'custom' ? 'text-amber-700' : 'text-brand-primary' 
                        : 'text-gray-600'
                    }`}>{type.label}</span>
                  </button>
                ))}
              </div>

              {importType && (
                <div className="space-y-6">
                  {importType === 'inventory' && (
                    <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200/50 max-w-md mx-auto text-right">
                      <button
                        type="button"
                        onClick={() => setImportMethod('excel')}
                        className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 border-none outline-none cursor-pointer ${
                          importMethod === 'excel' 
                            ? 'bg-white text-brand-primary shadow-sm' 
                            : 'text-gray-500 hover:text-navy-950'
                        }`}
                      >
                        📁 ملف صلب (Excel / CSV)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMethod('ai_scanner')}
                        className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 border-none outline-none cursor-pointer ${
                          importMethod === 'ai_scanner' 
                            ? 'bg-white text-brand-primary shadow-sm' 
                            : 'text-gray-500 hover:text-navy-950'
                        }`}
                      >
                        ⚡ ماسح فاتورة شراء بالذكاء الاصطناعي (Gemini)
                      </button>
                    </div>
                  )}

                  {importType === 'inventory' && importMethod === 'ai_scanner' ? (
                    <div className="p-1 animate-fade-in bg-white border border-gray-100 shadow-xl rounded-[2rem]">
                      <InvoiceScanner profile={profile} />
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white p-12 border-dashed border-4 border-gray-200 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center space-y-6 cursor-pointer hover:border-brand-primary/30 transition-all relative overflow-hidden"
                    >
                      <div className="bg-brand-primary/10 p-6 rounded-full text-brand-primary mb-4">
                        <FileUp size={48} className="animate-bounce" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-navy-900">
                          اختر ملف البيانات لـ {
                            importType === 'inventory' ? 'الأصناف والمخزون' :
                            importType === 'customers' ? 'العملاء والمدينين' :
                            importType === 'employees' ? 'الموظفين وفريق العمل' :
                            importType === 'suppliers' ? 'الموردين والشركات' :
                            importType === 'maintenance' ? 'قسم الصيانة والدعم الفني' :
                            importType === 'custom' ? 'القسم الحر المخصص' :
                            'الفواتير والمبيعات'
                          }
                        </h3>
                        {importType === 'custom' && (
                          <div className="mt-6 max-w-xl mx-auto bg-amber-50/75 p-6 rounded-2xl border border-amber-300 space-y-3 shadow-inner" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 justify-center animate-pulse">
                              <Database className="text-amber-600" size={20} />
                              <h4 className="font-extrabold text-amber-900">مسار الحفظ وقنوات البيانات المخصصة</h4>
                            </div>
                            <p className="text-[11px] text-amber-800 font-medium">قم بتوجيه تدفق البيانات المسحوبة مباشرة إلى مسار الـ API المستهدف:</p>
                            <div className="relative">
                              <input
                                type="text"
                                className="w-full bg-white text-navy-900 px-4 py-3 rounded-xl border border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-300 font-mono text-xs text-left outline-none transition-all duration-300"
                                placeholder="/api/v1/custom-target-route"
                                value={customRoute}
                                onChange={(e) => setCustomRoute(e.target.value)}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-lg pointer-events-none font-sans">ROUTE</span>
                            </div>
                          </div>
                        )}
                        <p className="text-gray-500 mt-2">يدعم جميع أنواع الملفات والملفات المشفرة (Excel, CSV, PDF, Word, TXT, ENCI وغيرها)</p>
                      </div>
                      
                      <div className="flex flex-col items-center gap-4">
                        <button className="btn-primary px-8 py-3 font-black flex items-center gap-2 pointer-events-none">
                          <Search size={18} />
                          استعراض الملفات من جهازك
                        </button>
                        <input 
                          type="file" 
                          accept="*"
                          onChange={handleFileUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>

                      <div className="flex gap-4">
                         <span className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
                            <CheckCircle2 size={14} className="text-success" /> تدقيق تلقائي للحقول
                         </span>
                         <span className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
                            <CheckCircle2 size={14} className="text-success" /> دعم فلاتر يمن سوفت
                         </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border-r-4 border-r-brand-primary shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="text-brand-primary" />
                  <h3 className="font-black text-navy-900">تعليمات ذكية</h3>
                </div>
                <ul className="space-y-3 text-sm text-gray-500">
                  <li className="flex gap-2">
                    <span className="text-brand-primary font-black">•</span>
                    تأكد أن السطر الأول يحتوي على أسماء الأعمدة.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand-primary font-black">•</span>
                    سيقوم النظام بمحاولة التخمين الذكي للحقول (مثلاً: "سعر الشراء" سيقابله "التكلفة").
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand-primary font-black">•</span>
                    يمكنك توليد باركود تلقائي للأصناف التي لا تمتلك واحداً.
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Mapping Configuration */}
        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-black text-navy-900">تخطيط حقول البيانات</h2>
                <p className="text-gray-500">قم بربط أعمدة الملف مع حقول النظام</p>
              </div>
              <button 
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-500 rounded-xl hover:text-navy-900 shadow-sm border border-gray-100"
              >
                <ChevronLeft size={20} /> تراجع
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                {appFields.map((field) => {
                  const currentMapping = mappings.find(m => m.appField === field.key);
                  return (
                    <div key={field.key} className="p-4 bg-white rounded-2xl border border-gray-100 flex items-center justify-between group hover:border-brand-primary/30 transition-all shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-black text-navy-900 flex items-center gap-2">
                          {field.label}
                          {field.required && <span className="text-danger">*</span>}
                        </span>
                        <span className="text-[10px] text-gray-400">حقل النظام</span>
                      </div>
                      
                      <ArrowRight className="text-gray-300 md:rotate-0 rotate-90" />

                      <div className="flex flex-col gap-2 w-full max-w-[240px]">
                        <div className="relative w-full">
                          <select
                            className={`w-full bg-gray-50 text-navy-900 p-2.5 rounded-xl border appearance-none outline-none focus:ring-2 ring-brand-primary/20 text-sm ${
                              currentMapping ? 'border-brand-primary/50 text-brand-primary font-bold' : 'border-gray-200'
                            }`}
                            value={currentMapping?.fileColumn || ''}
                            onChange={(e) => {
                              handleCustomColumnOverride(field.key, e.target.value);
                            }}
                          >
                            <option value="">-- اختر من الملف --</option>
                            {columns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                          <ChevronRight className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" size={16} />
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="أو اكتب اسم العمود يدوياً..."
                            className="w-full bg-white text-xs text-navy-900 px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 text-right"
                            value={mappedColumns[field.key] || ''}
                            onChange={(e) => {
                              handleCustomColumnOverride(field.key, e.target.value);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Infinite Fields Mapping Builder */}
                <div className="mt-8 p-6 bg-gradient-to-br from-amber-50 to-orange-50/30 rounded-3xl border border-amber-200/50 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-black text-amber-900 text-base flex items-center gap-2">
                        <PlusCircle className="text-amber-600" size={18} />
                        الحقول الإضافية والمخصصة (الربط المطور)
                      </h3>
                      <p className="text-[10px] text-amber-700/80 mt-0.5">أضف أي عدد من حقول الربط المخصصة لترحيلها بديناميكية تامة</p>
                    </div>
                    <button
                      type="button"
                      onClick={addCustomFieldRow}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all font-bold text-xs flex items-center gap-1 shrink-0 shadow-md shadow-amber-600/10 active:scale-95"
                    >
                      <Plus size={14} /> إضافة حقل مخصص
                    </button>
                  </div>

                  {customFields.length === 0 ? (
                    <div className="p-6 border border-dashed border-amber-200 rounded-2xl text-center">
                      <p className="text-xs text-amber-700/60 font-medium">لم يتم إضافة أي حقل مخصص بعد. انقر على الزر لإضافة تخطيط مخصص حر.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {customFields.map((cf, idx) => (
                        <div key={idx} className="p-4 bg-white rounded-2xl border border-amber-100 flex flex-col items-stretch gap-3 group hover:border-amber-400 transition-all shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">حقل مخصص #{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeCustomFieldRow(idx)}
                              className="text-danger hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors"
                            >
                              <Trash2 size={14} /> حذف
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] text-navy-900 font-bold">اسم الحقل البرمجي في النظام (English Key)</span>
                              <input
                                type="text"
                                value={cf.systemKey}
                                onChange={(e) => updateCustomFieldSystemKey(idx, e.target.value)}
                                placeholder="مثال: item_discount_rate"
                                className="w-full bg-amber-50/20 text-navy-900 px-3 py-2 rounded-xl border border-amber-100 font-bold outline-none text-right focus:bg-white focus:border-amber-500 text-xs transition-all"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] text-gray-500 font-bold">العمود المربوط من ملف Excel/CSV</span>
                              <div className="relative w-full">
                                <select
                                  className="w-full bg-gray-50 text-navy-900 p-2 rounded-xl border border-gray-200 appearance-none outline-none focus:ring-2 ring-amber-500/10 text-xs font-bold"
                                  value={cf.fileColumn}
                                  onChange={(e) => updateCustomFieldFileColumn(idx, e.target.value)}
                                >
                                  <option value="">-- اختر من الملف --</option>
                                  {columns.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                  ))}
                                </select>
                                <ChevronRight className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" size={14} />
                              </div>
                            </div>
                          </div>

                          <div className="relative">
                            <input
                              type="text"
                              placeholder="أو اكتب اسم عمود الملف يدوياً..."
                              className="w-full bg-white text-[10px] text-navy-900 px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-amber-500 text-right"
                              value={cf.fileColumn}
                              onChange={(e) => updateCustomFieldFileColumn(idx, e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                  <h3 className="font-black text-navy-900 mb-4 flex items-center gap-2">
                    <Table size={20} className="text-brand-primary" /> معاينة سريعة لبيانات الملف
                  </h3>
                  <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-inner">
                    <table className="w-full text-xs text-right table-auto border-collapse">
                      <thead className="bg-gray-50/80 text-gray-700 font-bold border-b border-gray-100">
                        <tr>
                          {columns.map(c => (
                            <th key={c} className="p-3 border-l border-gray-100 min-w-[150px] text-right bg-slate-55/50 font-bold text-navy-950">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fileData.slice(0, 8).map((row, i) => (
                          <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/40 transition-colors">
                             {columns.map(c => (
                               <td key={c} className="p-1 border-l border-gray-100 min-w-[150px]">
                                 <input
                                   type="text"
                                   id={`raw-cell-${i}-${c}`}
                                   value={row[c] !== undefined && row[c] !== null ? String(row[c]) : ''}
                                   onChange={(e) => {
                                     const newVal = e.target.value;
                                     setFileData(prev => {
                                       const copy = [...prev];
                                       copy[i] = {
                                         ...copy[i],
                                         [c]: newVal
                                       };
                                       return copy;
                                     });
                                   }}
                                   className="w-full bg-white hover:bg-gray-50 focus:bg-gray-100 text-xs px-2.5 py-2 rounded-lg border border-transparent focus:border-brand-primary outline-none text-right font-medium text-navy-900 focus:ring-1 focus:ring-brand-primary/20 transition-all"
                                   placeholder="فارغ..."
                                 />
                               </td>
                             ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl text-center">
                    <p className="text-gray-500 text-sm">إجمالي السجلات المكتشفة: <span className="text-brand-primary font-black">{fileData.length}</span></p>
                  </div>
                </div>

                {importType === 'inventory' && (
                  <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="flex gap-4 items-center">
                       <div className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary"><Barcode /></div>
                       <div>
                          <h4 className="font-black text-navy-900">توليد باركود تلقائي</h4>
                          <p className="text-[10px] text-gray-500">للأصناف التي لا تمتلك باركود في الملف</p>
                       </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={generateBarcodes} onChange={(e) => setGenerateBarcodes(e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                    </label>
                  </div>
                )}

                {mappings.filter(m => appFields.find(f => f.key === m.appField)?.required).length < appFields.filter(f => f.required).length && (
                  <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl flex items-center gap-3 text-danger text-xs font-bold animate-pulse">
                    <AlertCircle size={16} />
                    يجب ربط جميع الحقول المطلوبة (*) للمتابعة
                  </div>
                )}

                <button 
                  onClick={() => setStep(3)}
                  disabled={mappings.filter(m => appFields.find(f => f.key === m.appField)?.required).length < appFields.filter(f => f.required).length}
                  className="btn-primary w-full py-5 text-lg font-black group disabled:opacity-50 disabled:grayscale transition-all hover:scale-[1.02] active:scale-95"
                >
                   المراجعة والمعالجة النهائية
                  <ChevronRight className="inline-block mr-2 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Final Data Preview Check */}
        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-black text-navy-900">المراجعة النهائية</h2>
                <p className="text-gray-500">تأكد من صحة البيانات قبل النقل الفعلي</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(2)}
                  className="bg-white border border-gray-200 py-3 px-6 rounded-xl font-bold text-gray-500 hover:text-navy-900 shadow-sm"
                >
                  تعديل التخطيط
                </button>
                <button 
                  onClick={startImport}
                  disabled={isProcessing}
                  className="btn-primary py-3 px-8 flex items-center gap-3 font-black text-lg shadow-xl shadow-brand-primary/20 hover:scale-105"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Database />}
                  ابدأ الاستيراد الآن ({fileData.length} سجل)
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-gray-100">
               <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex gap-8">
                     <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">نوع العملية</span>
                        <span className="text-navy-900 font-black">
                          {importType === 'inventory' ? 'مخزون وأصناف' : 
                           importType === 'customers' ? 'عملاء ومدينين' : 
                           importType === 'employees' ? 'موظفين وفريق عمل' : 
                           importType === 'suppliers' ? 'موردين وشركات' : 
                           importType === 'maintenance' ? 'قسم الصيانة والدعم الفني' :
                           importType === 'custom' ? `القسم الحر المخصص (${customRoute})` :
                           'مبيعات وفواتير'}
                        </span>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">إجمالي السجلات</span>
                        <span className="text-brand-primary font-black">{fileData.length}</span>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">الحقول المربوطة</span>
                        <span className="text-success font-black">{mappings.length} من {appFields.length}</span>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-warning/5 text-warning rounded-xl border border-warning/10 text-xs font-bold">
                    <AlertTriangle size={16} /> لا يمكن التراجع بعد الضغط على "ابدأ الاستيراد"
                  </div>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-right">
                    <thead className="bg-white text-gray-400">
                      <tr>
                        {previewFields.map(f => (
                          <th key={f.key} className="p-4 border-l border-gray-50 min-w-[150px] font-bold">
                            {f.label}
                            <div className="text-[9px] text-brand-primary mt-1">
                               {mappings.find(m => m.appField === f.key)?.fileColumn || 'غير مربوط'}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                       {editableRows.slice(0, 10).map((row, i) => (
                         <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                            {previewFields.map(f => {
                              const value = row[f.key] || '';
                              return (
                                <td key={f.key} className={`p-1 border-l border-gray-50 ${f.required && !value ? 'bg-danger/5 text-danger' : 'text-gray-600'}`}>
                                  <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                      const newVal = e.target.value;
                                      setEditableRows(prev => {
                                        const copy = [...prev];
                                        copy[i] = {
                                          ...copy[i],
                                          [f.key]: newVal
                                        };
                                        return copy;
                                      });
                                      
                                      // Synchronize with fileData as well so the actual rawData sent inside startImport contains this correction!
                                      setFileData(prev => {
                                        const copy = [...prev];
                                        const mapping = mappings.find(m => m.appField === f.key);
                                        if (mapping) {
                                          copy[i] = {
                                            ...copy[i],
                                            [mapping.fileColumn]: newVal
                                          };
                                        }
                                        return copy;
                                      });
                                    }}
                                    className="w-full bg-transparent border-0 hover:bg-gray-50 focus:bg-gray-100 px-2 py-1.5 rounded text-right outline-none font-bold text-navy-900 focus:ring-1 focus:ring-brand-primary/20"
                                  />
                                </td>
                              );
                            })}
                         </tr>
                       ))}
                    </tbody>
                 </table>
               </div>
               {fileData.length > 10 && (
                 <div className="p-4 bg-gray-50 text-center text-xs text-gray-400 italic">
                    يتم عرض أول 10 سجلات فقط للمعاينة... سيتم استيراد كافة السجلات ({fileData.length}) عند البدء.
                 </div>
               )}
            </div>
          </motion.div>
        )}

        {/* Step 4: Results Display */}
        {step === 4 && results && (
          <motion.div 
            key="step4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-12 text-center"
          >
            <div className="w-32 h-32 bg-success/10 text-success rounded-full flex items-center justify-center mb-8 shadow-2xl border-4 border-success/20">
               <CheckCircle2 size={64} />
            </div>
            <h2 className="text-4xl font-black text-navy-900 mb-2">تمت عملية الاستيراد بنجاح!</h2>
            <p className="text-gray-500 text-lg mb-8">لقد قمت بنقل بياناتك إلى JAM Pro بكل سهولة</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mb-12">
               <div className="p-8 bg-white rounded-[2rem] border border-gray-100 shadow-xl">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">سجلات ناجحة</span>
                  <p className="text-5xl font-black text-success">{results.success}</p>
               </div>
               <div className={`p-8 rounded-[2rem] border shadow-xl ${results.failed > 0 ? 'bg-danger/5 border-danger/20' : 'bg-white border-gray-100'}`}>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">سجلات فاشلة</span>
                  <p className={`text-5xl font-black ${results.failed > 0 ? 'text-danger' : 'text-gray-300'}`}>{results.failed}</p>
               </div>
            </div>

            {results.errors.length > 0 && (
              <div className="w-full max-w-2xl bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl mb-8 overflow-hidden">
                 <h4 className="text-danger font-black mb-4 flex items-center justify-center gap-2">
                    <AlertCircle size={20} /> تفاصيل المشاكل (أول 10 فقط)
                 </h4>
                 <div className="text-right space-y-2 text-sm text-gray-500 font-mono">
                    {results.errors.map((err, i) => <p key={i}>• {err}</p>)}
                 </div>
              </div>
            )}

            {valReport && (
              <div className="w-full max-w-2xl bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl mb-8 text-right font-sans">
                 <h4 className="text-brand-primary font-black mb-4 flex items-center justify-center gap-2">
                    <Barcode size={20} /> تقرير معالجة الباركود التكيفي من السيرفر
                 </h4>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center justify-center">
                   <div className="p-3 bg-gray-50 rounded-2xl">
                     <span className="text-[10px] text-gray-400 block mb-1">الباركودات المنشأة</span>
                     <span className="font-extrabold text-navy-900">{valReport.autoGeneratedBarcodesCount}</span>
                   </div>
                   <div className="p-3 bg-gray-50 rounded-2xl">
                     <span className="text-[10px] text-amber-600 block mb-1">التعارضات المحلولة</span>
                     <span className="font-extrabold text-amber-600">{valReport.duplicateBarcodesFixedCount}</span>
                   </div>
                   <div className="p-3 bg-gray-50 rounded-2xl">
                     <span className="text-[10px] text-amber-500 block mb-1">إجمالي التحذيرات</span>
                     <span className="font-extrabold text-amber-500">{valReport.warningCount}</span>
                   </div>
                   <div className="p-3 bg-gray-50 rounded-2xl">
                     <span className="text-[10px] text-success block mb-1">تم التحقق منها</span>
                     <span className="font-extrabold text-success">{valReport.successCount}</span>
                   </div>
                 </div>
                 {valReport.logs.length > 0 && (
                   <div className="p-4 bg-gray-50 rounded-2xl text-xs space-y-1.5 font-mono max-h-40 overflow-y-auto text-gray-500">
                     {valReport.logs.map((log: string, idx: number) => (
                       <p key={idx}>• {log}</p>
                     ))}
                   </div>
                 )}
              </div>
            )}

            <div className="flex gap-4">
               <button onClick={reset} className="btn-secondary px-8 py-4 font-black">
                  استيراد ملف جديد
               </button>
               <button 
                onClick={() => window.location.hash = '/dashboard'}
                className="btn-primary px-12 py-4 font-black"
               >
                  الذهاب للوحة التحكم
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Info */}
      <div className="fixed bottom-6 right-6 md:right-1/2 md:translate-x-1/2 flex gap-4 px-6 py-4 bg-white/90 backdrop-blur-xl rounded-full border border-gray-100 shadow-2xl z-50">
         <div className="flex items-center gap-2 text-[10px] font-black text-navy-900 border-l border-gray-100 pl-4">
            <ShieldCheck className="text-success" size={16} /> عزل تام للبيانات
         </div>
         <div className="flex items-center gap-2 text-[10px] font-black text-navy-900 border-l border-gray-100 pl-4">
            <Database className="text-brand-primary" size={16} /> مزامنة سحابية
         </div>
         <div className="flex items-center gap-2 text-[10px] font-black text-navy-900">
            <Loader2 className="text-brand-primary animate-spin" size={16} /> معالجة ذكية
         </div>
      </div>
    </div>
  );
}
