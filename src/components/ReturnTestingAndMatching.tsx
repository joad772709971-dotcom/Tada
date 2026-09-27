import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Search, 
  User, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  ClipboardCheck, 
  ShieldCheck, 
  Truck, 
  FileText, 
  Barcode, 
  Users, 
  Check, 
  Plus, 
  Trash, 
  ArrowRight, 
  History, 
  Wrench,
  ShieldAlert,
  HelpCircle,
  TrendingDown,
  Sparkles
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  onSnapshot,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, InventoryItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';

// Reference date for warranty calculation in 2026-07-12
const SYSTEM_REFERENCE_DATE = "2026-07-12";

interface ReturnTestingAndMatchingProps {
  profile: UserProfile | null;
}

export interface ReturnItemSchema {
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
  price: number;
  purchaseDate: string; // YYYY-MM-DD
  warrantyType: 'none' | 'operational' | 'limited';
  warrantyDuration: number; // in days
  status: 'مخزن بضائع قيد الفحص والمطابقة' | 'جاهز/سليم' | 'تالف' | 'مرفوض ومردود للعميل';
  testNotes?: string;
  isOutOfWarranty?: boolean;
  overrideStatus?: 'none' | 'pending_override' | 'approved' | 'rejected';
}

export interface ReturnInvoiceSchema {
  id?: string;
  ownerId: string;
  customerName: string;
  customerPhone?: string;
  scenario: 'face_to_face' | 'delivery'; // وجه لوجه أو توصيل
  deliveryAgentId?: string;
  deliveryAgentName?: string;
  items: ReturnItemSchema[];
  status: 'مخزن بضائع قيد الفحص والمطابقة' | 'جاهز/سليم بالكامل' | 'تالف بالكامل' | 'مكتمل فحص مختلط' | 'مرفوض ومردود بالكامل' | 'طلب مرتجع مرفوض مع سبب الرفض';
  createdAt: any;
  updatedAt: any;
  createdById: string;
  createdByName: string;
}

export default function ReturnTestingAndMatching({ profile }: ReturnTestingAndMatchingProps) {
  // Navigation internal tabs
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'testing' | 'history'>('testing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [storeInventory, setStoreInventory] = useState<InventoryItem[]>([]);
  const [deliveryAgents, setDeliveryAgents] = useState<any[]>([]);
  const [activeReturns, setActiveReturns] = useState<ReturnInvoiceSchema[]>([]);
  
  // Search state for product lookup
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState<number | null>(null);

  // 1) New Return Invoice Form state
  const [invoiceForm, setInvoiceForm] = useState<{
    customerName: string;
    customerPhone: string;
    scenario: 'face_to_face' | 'delivery';
    deliveryAgentId: string;
    deliveryAgentName: string;
    items: ReturnItemSchema[];
  }>({
    customerName: '',
    customerPhone: '',
    scenario: 'face_to_face',
    deliveryAgentId: '',
    deliveryAgentName: '',
    items: [
      { 
        productId: '', 
        name: '', 
        barcode: '', 
        quantity: 1, 
        price: 0, 
        purchaseDate: SYSTEM_REFERENCE_DATE, 
        warrantyType: 'limited', 
        warrantyDuration: 30, 
        status: 'مخزن بضائع قيد الفحص والمطابقة',
        testNotes: '',
        isOutOfWarranty: false,
        overrideStatus: 'none'
      }
    ]
  });

  // Selected return invoice for detailed testing view
  const [selectedInvoice, setSelectedInvoice] = useState<ReturnInvoiceSchema | null>(null);

  // Multi-tenant simulation and cascading return states
  const [simulatedRole, setSimulatedRole] = useState<'mohamed' | 'ahmed'>('mohamed');
  const [b2bConnections, setB2bConnections] = useState<any[]>([]);
  const [vendorAccount, setVendorAccount] = useState<any>(null);
  const [showCascadeModal, setShowCascadeModal] = useState(false);
  const [cascadeTargetSupplierId, setCascadeTargetSupplierId] = useState('merchant_ahmed_id');
  const [cascadeTargetSupplierName, setCascadeTargetSupplierName] = useState('التاجر أحمد (المورد الرئيسي)');
  const [cascadeSelectedDriverId, setCascadeSelectedDriverId] = useState('delivery_agent_ahmed_id');
  const [cascadeSelectedDriverName, setCascadeSelectedDriverName] = useState('أحمد اللوجستي (سائق عام)');

  // Upstream testing states for Ahmed
  const [upstreamItemDecisions, setUpstreamItemDecisions] = useState<Record<number, { status: 'مقبول' | 'مرفوض', rejectionReason?: string }>>({});
  const [upstreamTestingActive, setUpstreamTestingActive] = useState<string | null>(null); // Return invoice ID active for Ahmed's testing

  // Settlement states
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementInvoice, setSettlementInvoice] = useState<ReturnInvoiceSchema | null>(null);
  const [customBoxes, setCustomBoxes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [replacementNotes, setReplacementNotes] = useState<string>('');
  const [voucherCode, setVoucherCode] = useState<string>('');

  // Rejection settlement pathways states
  const [counterClaimDescription, setCounterClaimDescription] = useState<string>('');
  const [selectedEscalateDriverId, setSelectedEscalateDriverId] = useState<string>('delivery_agent_ahmed_id');
  const [selectedEscalateDriverName, setSelectedEscalateDriverName] = useState<string>('أحمد اللوجستي (سائق عام)');
  const [activePathwayTab, setActivePathwayTab] = useState<'escalate' | 'scrap' | 'customer'>('escalate');

  // Role permissions
  const isAdminOrOwner = 
    profile?.role === 'owner' || 
    profile?.role === 'superadmin' || 
    profile?.role === 'manager' ||
    (profile?.email === 'a777503191@gmail.com');

  // Load store inventory, delivery agents, and returns under inspection
  useEffect(() => {
    if (!profile?.ownerId) return;

    // Load store inventory for lookup
    const qInv = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setStoreInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    });

    // Load delivery agents
    const qAgents = query(collection(db, 'users'), where('role', '==', 'delivery_agent'));
    getDocs(qAgents).then(snap => {
      setDeliveryAgents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }).catch(err => console.error("Error loading delivery agents:", err));

    // Load Returns under Inspection (multi-tenant aware query)
    const targetOwnerId = simulatedRole === 'mohamed' ? profile.ownerId : 'merchant_ahmed_id';
    const qReturns = query(collection(db, 'returns_inspection'), where('ownerId', '==', targetOwnerId));
    const unsubReturns = onSnapshot(qReturns, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReturnInvoiceSchema));
      // Sort: newest first
      list.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setActiveReturns(list);
    });

    // Load customBoxes
    const qBoxes = query(collection(db, 'stores', profile.ownerId, 'customBoxes'));
    const unsubBoxes = onSnapshot(qBoxes, (snapshot) => {
      setCustomBoxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Load customers
    const qCust = query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId));
    const unsubCust = onSnapshot(qCust, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Load B2B Connections where buyer is Mohamed
    const qConn = query(collection(db, 'b2bConnections'), where('buyerId', '==', profile.ownerId));
    const unsubConn = onSnapshot(qConn, (snapshot) => {
      setB2bConnections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Subscribe and Seed live multi-tenant vendor balance account (Requirement 4)
    const accRef = doc(db, 'accounts', 'ACC-B2B-MOHAMED-AHMED');
    const unsubAcc = onSnapshot(accRef, (snap) => {
      if (snap.exists()) {
        setVendorAccount({ id: snap.id, ...snap.data() });
      } else {
        setDoc(accRef, {
          accountNumber: 'ACC-B2B-MOHAMED-AHMED',
          accountName: 'حساب مبيعات آجل: التاجر محمد (مستحقات التاجر أحمد المصدر)',
          balance: 450000, // 450,000 YER outstanding balance Mohamed owes Ahmed
          currency: 'YER',
          status: 'active',
          ownerId: 'merchant_ahmed_id',
          activatedByBuyerId: profile.ownerId,
          activatedByBuyerName: 'التاجر محمد (محل التجزئة)',
          createdAt: serverTimestamp()
        });
      }
    });

    return () => {
      unsubInv();
      unsubReturns();
      unsubBoxes();
      unsubCust();
      unsubConn();
      unsubAcc();
    };
  }, [profile, simulatedRole]);

  // Handle inventory barcode/name lookup
  const handleItemSelect = (index: number, matchedItem: InventoryItem) => {
    const updatedItems = [...invoiceForm.items];
    
    // Calculate if it's already out of warranty
    const isOut = calculateIsOutOfWarranty(
      SYSTEM_REFERENCE_DATE, 
      matchedItem.warrantyType || 'none', 
      matchedItem.warrantyDuration || 0
    );

    updatedItems[index] = {
      ...updatedItems[index],
      productId: matchedItem.id,
      name: matchedItem.name,
      barcode: matchedItem.barcode || '',
      price: matchedItem.price || 0,
      warrantyType: (matchedItem.warrantyType as any) || 'none',
      warrantyDuration: matchedItem.warrantyDuration || 0,
      isOutOfWarranty: isOut,
      overrideStatus: isOut ? 'pending_override' : 'none'
    };

    setInvoiceForm({ ...invoiceForm, items: updatedItems });
    setShowDropdown(null);
  };

  // Warranty Expiry Calculations
  const calculateIsOutOfWarranty = (purchaseDateStr: string, warrantyType: string, durationInDays: number): boolean => {
    if (warrantyType === 'none') return true;
    if (warrantyType === 'operational') return false; // operational warranty does not expire strictly by date
    if (!purchaseDateStr) return true;

    try {
      const pDate = new Date(purchaseDateStr);
      const refDate = new Date(SYSTEM_REFERENCE_DATE);
      const diffTime = refDate.getTime() - pDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > durationInDays;
    } catch (e) {
      return true;
    }
  };

  const getWarrantyInfoText = (item: ReturnItemSchema) => {
    if (item.warrantyType === 'none') {
      return { text: 'بدون ضمان', color: 'text-red-400 bg-red-500/10' };
    }
    if (item.warrantyType === 'operational') {
      return { text: 'ضمان تشغيل', color: 'text-green-400 bg-green-500/10' };
    }
    
    const isOut = calculateIsOutOfWarranty(item.purchaseDate, item.warrantyType, item.warrantyDuration);
    if (isOut) {
      return { text: `انتهى الضمان (${item.warrantyDuration} يوم)`, color: 'text-rose-400 bg-rose-500/10 font-bold' };
    } else {
      return { text: `ضمان ساري (${item.warrantyDuration} يوم)`, color: 'text-emerald-400 bg-emerald-500/10' };
    }
  };

  // Form row manipulation
  const addFormRow = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [
        ...invoiceForm.items,
        {
          productId: '',
          name: '',
          barcode: '',
          quantity: 1,
          price: 0,
          purchaseDate: SYSTEM_REFERENCE_DATE,
          warrantyType: 'limited',
          warrantyDuration: 30,
          status: 'مخزن بضائع قيد الفحص والمطابقة',
          testNotes: '',
          isOutOfWarranty: false,
          overrideStatus: 'none'
        }
      ]
    });
  };

  const removeFormRow = (index: number) => {
    const list = invoiceForm.items.filter((_, i) => i !== index);
    setInvoiceForm({
      ...invoiceForm,
      items: list.length ? list : [
        {
          productId: '',
          name: '',
          barcode: '',
          quantity: 1,
          price: 0,
          purchaseDate: SYSTEM_REFERENCE_DATE,
          warrantyType: 'limited',
          warrantyDuration: 30,
          status: 'مخزن بضائع قيد الفحص والمطابقة',
          testNotes: '',
          isOutOfWarranty: false,
          overrideStatus: 'none'
        }
      ]
    });
  };

  // 1) ISSUE RETURN INVOICE & ROUTE TO TEMP STOCK (No financial ledger touched)
  const handleIssueReturnInvoice = async () => {
    if (!profile?.ownerId) return;

    if (!invoiceForm.customerName.trim()) {
      alert('⚠️ يرجى إدخال اسم العميل أولاً.');
      return;
    }

    const invalidItems = invoiceForm.items.some(it => !it.name || !it.productId || it.quantity < 1);
    if (invalidItems) {
      alert('⚠️ يرجى التأكد من ملء جميع بنود الفاتورة واختيار منتجات صالحة.');
      return;
    }

    setIsProcessing(true);
    try {
      const finalItems = invoiceForm.items.map(it => {
        const isOut = calculateIsOutOfWarranty(it.purchaseDate, it.warrantyType, it.warrantyDuration);
        return {
          ...it,
          isOutOfWarranty: isOut,
          overrideStatus: isOut ? 'pending_override' : 'none',
          status: 'مخزن بضائع قيد الفحص والمطابقة' as const
        };
      });

      const payload: ReturnInvoiceSchema = {
        ownerId: profile.ownerId,
        customerName: invoiceForm.customerName.trim(),
        customerPhone: invoiceForm.customerPhone.trim() || undefined,
        scenario: invoiceForm.scenario,
        deliveryAgentId: invoiceForm.scenario === 'delivery' ? invoiceForm.deliveryAgentId : undefined,
        deliveryAgentName: invoiceForm.scenario === 'delivery' ? invoiceForm.deliveryAgentName : undefined,
        items: finalItems,
        status: 'مخزن بضائع قيد الفحص والمطابقة',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdById: profile.uid,
        createdByName: profile.name || 'موظف الاستلام'
      };

      await addDoc(collection(db, 'returns_inspection'), payload);

      // Audit Log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'RETURN_INVOICE_CREATED',
        userId: profile.uid,
        userName: profile.name || 'موظف',
        details: `إنشاء فاتورة مرتجع للعميل [${payload.customerName}] وتوجيهها لمخزن بضائع قيد الفحص والمطابقة (دون ملامسة الدفاتر المالية)`,
        timestamp: serverTimestamp()
      });

      alert('🎉 تم إصدار فاتورة المرتجع بنجاح! وتم توجيه الأصناف فوراً إلى "مخزن بضائع قيد الفحص والمطابقة" لبدء الفحص والاختبار.');
      
      // Reset Form
      setInvoiceForm({
        customerName: '',
        customerPhone: '',
        scenario: 'face_to_face',
        deliveryAgentId: '',
        deliveryAgentName: '',
        items: [
          {
            productId: '',
            name: '',
            barcode: '',
            quantity: 1,
            price: 0,
            purchaseDate: SYSTEM_REFERENCE_DATE,
            warrantyType: 'limited',
            warrantyDuration: 30,
            status: 'مخزن بضائع قيد الفحص والمطابقة',
            testNotes: '',
            isOutOfWarranty: false,
            overrideStatus: 'none'
          }
        ]
      });
      setActiveSubTab('testing');
    } catch (err) {
      console.error(err);
      alert('❌ حدث خطأ أثناء إنشاء الفاتورة.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2) AGENT TESTING AND STATUS TOGGLE
  const handleToggleItemStatus = async (invoiceId: string, itemIdx: number, newStatus: 'جاهز/سليم' | 'تالف') => {
    if (!profile) return;
    const invoice = activeReturns.find(r => r.id === invoiceId);
    if (!invoice) return;

    const item = invoice.items[itemIdx];
    
    // Check if item is out of warranty and needs override approval first
    if (item.isOutOfWarranty && item.overrideStatus === 'pending_override') {
      alert('⚠️ هذا المنتج خارج الضمان! يجب على مالك/مشرف النظام اعتماد أو رفض المرتجع قبل اختبار وتحديث حالته.');
      return;
    }

    // Check if rejected already
    if (item.status === 'مرفوض ومردود للعميل') {
      alert('⚠️ هذا البند تم رفضه ورده للعميل بالفعل.');
      return;
    }

    setIsProcessing(true);
    try {
      const updatedItems = [...invoice.items];
      updatedItems[itemIdx] = {
        ...updatedItems[itemIdx],
        status: newStatus
      };

      // Determine global status
      let globalStatus: ReturnInvoiceSchema['status'] = 'مخزن بضائع قيد الفحص والمطابقة';
      const statuses = updatedItems.map(it => it.status);
      const allIntact = statuses.every(s => s === 'جاهز/سليم');
      const allDamaged = statuses.every(s => s === 'تالف');
      const allRejected = statuses.every(s => s === 'مرفوض ومردود للعميل');
      
      if (allIntact) {
        globalStatus = 'جاهز/سليم بالكامل';
      } else if (allDamaged) {
        globalStatus = 'تالف بالكامل';
      } else if (allRejected) {
        globalStatus = 'مرفوض ومردود بالكامل';
      } else if (statuses.every(s => s !== 'مخزن بضائع قيد الفحص والمطابقة')) {
        globalStatus = 'مكتمل فحص مختلط';
      }

      await updateDoc(doc(db, 'returns_inspection', invoiceId), {
        items: updatedItems,
        status: globalStatus,
        updatedAt: serverTimestamp()
      });

      // Update local selection for seamless rendering
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice({
          ...selectedInvoice,
          items: updatedItems,
          status: globalStatus
        });
      }

    } catch (err) {
      console.error(err);
      alert('❌ فشل تعديل حالة فحص المنتج.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Update item test notes
  const handleUpdateTestNotes = async (invoiceId: string, itemIdx: number, notes: string) => {
    const invoice = activeReturns.find(r => r.id === invoiceId);
    if (!invoice) return;

    try {
      const updatedItems = [...invoice.items];
      updatedItems[itemIdx] = {
        ...updatedItems[itemIdx],
        testNotes: notes
      };

      await updateDoc(doc(db, 'returns_inspection', invoiceId), {
        items: updatedItems,
        updatedAt: serverTimestamp()
      });

      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice({
          ...selectedInvoice,
          items: updatedItems
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 3) OUT-OF-WARRANTY ADMIN OVERRIDES
  const handleAdminOverride = async (invoiceId: string, itemIdx: number, choice: 'approve' | 'reject') => {
    if (!isAdminOrOwner) {
      alert('🚫 صلاحية مرفوضة! يجب أن تكون المالك أو المشرف للقيام بالتمرير اليدوي الاستثنائي.');
      return;
    }

    const invoice = activeReturns.find(r => r.id === invoiceId);
    if (!invoice) return;

    setIsProcessing(true);
    try {
      const updatedItems = [...invoice.items];
      const targetItem = updatedItems[itemIdx];

      if (choice === 'approve') {
        // Approve override: allows standard testing
        updatedItems[itemIdx] = {
          ...targetItem,
          overrideStatus: 'approved',
          status: 'جاهز/سليم' // set to intact by default, agent can toggle later
        };
      } else {
        // Reject and return to customer
        updatedItems[itemIdx] = {
          ...targetItem,
          overrideStatus: 'rejected',
          status: 'مرفوض ومردود للعميل'
        };
      }

      // Re-evaluate global status
      let globalStatus: ReturnInvoiceSchema['status'] = 'مخزن بضائع قيد الفحص والمطابقة';
      const statuses = updatedItems.map(it => it.status);
      if (statuses.every(s => s === 'جاهز/سليم')) {
        globalStatus = 'جاهز/سليم بالكامل';
      } else if (statuses.every(s => s === 'تالف')) {
        globalStatus = 'تالف بالكامل';
      } else if (statuses.every(s => s === 'مرفوض ومردود للعميل')) {
        globalStatus = 'مرفوض ومردود بالكامل';
      } else if (statuses.every(s => s !== 'مخزن بضائع قيد الفحص والمطابقة')) {
        globalStatus = 'مكتمل فحص مختلط';
      }

      await updateDoc(doc(db, 'returns_inspection', invoiceId), {
        items: updatedItems,
        status: globalStatus,
        updatedAt: serverTimestamp()
      });

      // Audit Log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'WARRANTY_OVERRIDE_DECISION',
        userId: profile?.uid,
        userName: profile?.name || 'المالك',
        details: `قرار الضمان الاستثنائي للبند [${targetItem.name}] في فاتورة العميل [${invoice.customerName}]: ${choice === 'approve' ? 'موافقة وتمرير المرتجع' : 'رفض وإرجاع للعميل'}`,
        timestamp: serverTimestamp()
      });

      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice({
          ...selectedInvoice,
          items: updatedItems,
          status: globalStatus
        });
      }

      alert(choice === 'approve' ? '✅ تم الموافقة الاستثنائية وتمرير المرتجع بنجاح!' : '❌ تم رفض المرتجع وإرجاعه للعميل.');
    } catch (err) {
      console.error(err);
      alert('❌ فشل ترحيل قرار الاستثناء الإداري.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4) COMPLETING THE LIFECYCLE (Optional Routing to actual store / inventory)
  const handleFinalizeAndRoute = (invoiceId: string) => {
    const invoice = activeReturns.find(r => r.id === invoiceId);
    if (!invoice) return;

    const hasPendingTest = invoice.items.some(it => it.status === 'مخزن بضائع قيد الفحص والمطابقة');
    if (hasPendingTest) {
      alert('⚠️ يرجى اختبار وتعيين حالة جميع البنود بالفاتورة قبل الإقفال النهائي.');
      return;
    }

    // Prepare settlement state
    setSettlementInvoice(invoice);
    setSelectedRoute(null);
    setSelectedBoxId('');
    setSelectedCustomerId('');
    setReplacementNotes('');
    setVoucherCode('RET-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    setShowSettlementModal(true);
  };

  const handleExecuteSettlement = async () => {
    if (!settlementInvoice || !profile?.ownerId) return;
    if (!selectedRoute) {
      alert('⚠️ يرجى تحديد مسار تسوية مالية أولاً.');
      return;
    }

    // Transaction Locks verification
    if (selectedRoute === 'A') {
      if (!selectedBoxId) {
        alert('⚠️ قفل الأمان مفعل: يرجى تحديد الصندوق أو الخزنة المصدر لإتمام حركة استرجاع الأموال.');
        return;
      }
    } else if (selectedRoute === 'B') {
      if (!selectedCustomerId) {
        alert('⚠️ قفل الأمان مفعل: يرجى تحديد حساب مديونية العميل لإجراء الخصم المباشر.');
        return;
      }
    } else if (selectedRoute === 'C') {
      if (!replacementNotes) {
        alert('⚠️ قفل الأمان مفعل: يرجى كتابة اسم وتفاصيل الصنف البديل لتوثيق التسوية السلعية.');
        return;
      }
    } else if (selectedRoute === 'D') {
      if (!voucherCode) {
        alert('⚠️ قفل الأمان مفعل: يرجى إدخال أو توليد كود الكوبون الشرائي.');
        return;
      }
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const invoiceId = settlementInvoice.id!;

      // A) Physical inventory routing
      // If "جاهز/سليم" -> increases store inventory `stock`
      // If "تالف" -> written to `damagedItems` collection
      for (const item of settlementInvoice.items) {
        if (item.status === 'جاهز/سليم') {
          const invRef = doc(db, 'inventory', item.productId);
          batch.update(invRef, {
            stock: increment(item.quantity),
            updatedAt: serverTimestamp()
          });
        } else if (item.status === 'تالف') {
          const damagedRef = doc(collection(db, 'damagedItems'));
          batch.set(damagedRef, {
            productId: item.productId,
            name: item.name,
            barcode: item.barcode,
            quantity: item.quantity,
            reportedBy: profile?.name || 'فاحص المستودع',
            remarks: `مرتجع تالف معتمد - فاتورة العميل: ${settlementInvoice.customerName} [سجل التجربة: ${item.testNotes || 'بدون تفاصيل'}]`,
            originReturnId: invoiceId,
            createdAt: serverTimestamp()
          });
        }
      }

      // B) Update returns invoice document status and log route choice
      batch.update(doc(db, 'returns_inspection', invoiceId), {
        status: 'تم التدقيق والتسوية النهائية',
        settlementRoute: selectedRoute,
        settlementDetails: {
          selectedBoxId: selectedRoute === 'A' ? selectedBoxId : null,
          selectedCustomerId: selectedRoute === 'B' ? selectedCustomerId : null,
          replacementNotes: selectedRoute === 'C' ? replacementNotes : null,
          voucherCode: selectedRoute === 'D' ? voucherCode : null,
        },
        updatedAt: serverTimestamp()
      });

      // Calculate total return values
      const intactTotal = settlementInvoice.items.filter(it => it.status === 'جاهز/سليم').reduce((sum, it) => sum + (it.price * it.quantity), 0);
      const damagedTotal = settlementInvoice.items.filter(it => it.status === 'تالف').reduce((sum, it) => sum + (it.price * it.quantity), 0);
      const totalRefund = intactTotal + damagedTotal;

      let transDescription = `توطين مالي وإقفال مرتجع العميل [${settlementInvoice.customerName}] بقيمة إجمالية ${totalRefund} ر.ي. `;

      // C) Process route-specific accounting ledger entries
      if (selectedRoute === 'A') {
        // Route A (Cash Refund): Deduct from Safe/Box
        const boxRef = doc(db, 'stores', profile.ownerId, 'customBoxes', selectedBoxId);
        batch.update(boxRef, {
          balance: increment(-totalRefund),
          updatedAt: serverTimestamp()
        });
        const boxName = customBoxes.find(b => b.id === selectedBoxId)?.name || 'الصندوق المحدد';
        transDescription += `[مسار أ: استرجاع نقدي] خصم من صندوق [${boxName}] وقيدها كحركة منصرف مالي لصالح العميل.`;

      } else if (selectedRoute === 'B') {
        // Route B (Debt Deduction): Credit the customer's account statement directly if debt exists
        const custRef = doc(db, 'customers', selectedCustomerId);
        batch.update(custRef, {
          debt: increment(-totalRefund),
          updatedAt: serverTimestamp()
        });
        const custName = customers.find(c => c.id === selectedCustomerId)?.name || 'العميل المحدد';
        transDescription += `[مسار ب: خصم من حساب الدين] تسوية مديونية العميل [${custName}] بقيمة ${totalRefund} ر.ي.`;

      } else if (selectedRoute === 'C') {
        // Route C (Item Replacement - Same Type): Zero out invoice value, process stock deduction, clear exchange
        for (const item of settlementInvoice.items) {
          if (item.status === 'جاهز/سليم' || item.status === 'تالف') {
            const invRef = doc(db, 'inventory', item.productId);
            // Stock deduction from main warehouse for replacement item to maintain stock symmetry
            batch.update(invRef, {
              stock: increment(-item.quantity),
              updatedAt: serverTimestamp()
            });
          }
        }
        transDescription += `[مسار ج: استبدال فوري بنفس الصنف] صرف كميات بديلة من المخزن وتصفير القيمة النقدية للمعاملة لضمان تماثل الأرصدة. الملاحظات: ${replacementNotes}`;

      } else if (selectedRoute === 'D') {
        // Route D (Open New Invoice Voucher): Issue temporary credit token
        const tokenRef = doc(collection(db, 'credit_tokens'));
        batch.set(tokenRef, {
          ownerId: profile.ownerId,
          code: voucherCode,
          amount: totalRefund,
          customerName: settlementInvoice.customerName,
          customerPhone: settlementInvoice.customerPhone || '',
          status: 'active',
          originReturnId: invoiceId,
          createdAt: serverTimestamp()
        });
        transDescription += `[مسار د: كوبون شراء مبيعات] إصدار قسيمة رصيد مالي مرتجع بالرمز [${voucherCode}] بقيمة ${totalRefund} ر.ي للاستهلاك كخصم مبيعات جديد.`;
      }

      // Write General Double-Entry bookkeeping transaction
      const transRef = doc(collection(db, 'stores', profile.ownerId, 'transactions'));
      batch.set(transRef, {
        ownerId: profile.ownerId,
        amount: totalRefund,
        type: 'expense',
        category: 'مرتجعات وتسويات بضائع',
        description: transDescription,
        settlementRoute: selectedRoute,
        createdAt: serverTimestamp()
      });

      await batch.commit();

      // Audit Log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'RETURNS_FINALIZED_WITH_SETTLEMENT',
        userId: profile?.uid,
        userName: profile?.name || 'المشرف',
        details: `إغلاق دورة المرتجع وتوطين القيد المالي بالمسار (${selectedRoute}) لفاتورة #${invoiceId.substring(0,8)} بقيمة ${totalRefund} ر.ي`,
        timestamp: serverTimestamp()
      });

      alert(`✅ تم إقفال دورة المرتجع بنجاح وتوجيه التسوية بالمسار المختار!`);
      setShowSettlementModal(false);
      setSettlementInvoice(null);
      setSelectedInvoice(null);
    } catch (err: any) {
      console.error(err);
      alert(`❌ فشل تسوية المرتجع: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ==========================================
  // REVERSE LOGISTICS & MULTI-TIER RETURNS (MOHAMED & AHMED)
  // ==========================================

  // Mohamed's function to trigger cascading
  const handleCascadeReturn = async (
    targetSupplierId: string, 
    targetSupplierName: string, 
    selectedDriverId: string, 
    selectedDriverName: string
  ) => {
    if (!selectedInvoice) return;
    setIsProcessing(true);
    try {
      const originId = selectedInvoice.id!;
      
      // Calculate total return sum for tracking
      const totalSum = selectedInvoice.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create cascading return ticket assigned to Merchant Ahmed (the supplier) in returns_inspection
      const cascadedPayload = {
        ownerId: targetSupplierId, // e.g. 'merchant_ahmed_id'
        customerName: profile?.shopName || profile?.name || 'تاجر التجزئة محمد',
        customerPhone: profile?.phone || '777123456',
        scenario: 'delivery',
        deliveryAgentId: selectedDriverId,
        deliveryAgentName: selectedDriverName,
        items: selectedInvoice.items.map(it => ({
          ...it,
          status: 'مخزن بضائع قيد الفحص والمطابقة', // reset for Ahmed's dashboard testing
          testNotes: ''
        })),
        status: 'بضاعة مرتجعة بالطريق', // Crucial: "بضاعة مرتجعة بالطريق" as requested
        isCascaded: true,
        cascadedFromBuyerId: profile?.ownerId,
        cascadedFromBuyerName: profile?.shopName || profile?.name || 'التاجر محمد',
        originReturnId: originId,
        totalReturnSum: totalSum,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdById: profile?.uid || 'system',
        createdByName: profile?.name || 'محمد'
      };

      await addDoc(collection(db, 'returns_inspection'), cascadedPayload);

      // Update local Retailer Mohamed's return status to reflect it was cascaded
      await updateDoc(doc(db, 'returns_inspection', originId), {
        status: 'تم الترحيل للتاجر المصدر',
        cascadedToSupplierId: targetSupplierId,
        cascadedToSupplierName: targetSupplierName,
        cascadedDeliveryAgentId: selectedDriverId,
        cascadedDeliveryAgentName: selectedDriverName,
        updatedAt: serverTimestamp()
      });

      // Audit log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'RETURN_CASCADED_TO_UPSTREAM',
        userId: profile?.uid,
        userName: profile?.name || 'التاجر محمد',
        details: `ترحيل المرتجع #${originId.substring(0,8)} للتاجر المصدر ${targetSupplierName} مع السائق ${selectedDriverName}`,
        timestamp: serverTimestamp()
      });

      alert('🚀 تم ترحيل المرتجع للتاجر المصدر أحمد، وتحديث الحالة إلى [بضاعة مرتجعة بالطريق] وإسناد الشحنة لبوابة عامل التوصيل!');
      setSelectedInvoice(null);
      setShowCascadeModal(false);
    } catch (e: any) {
      console.error(e);
      alert('❌ فشل ترحيل المرتجع للتاجر المصدر: ' + (e.message || e));
    } finally {
      setIsProcessing(false);
    }
  };

  // Upstream decision toggle by Ahmed
  const handleUpstreamItemDecision = (idx: number, decision: 'مقبول' | 'مرفوض', reason: string = '') => {
    setUpstreamItemDecisions(prev => ({
      ...prev,
      [idx]: { status: decision, rejectionReason: reason }
    }));
  };

  // Ahmed's final processing of the cascaded return (Accepts and Syncs, or Rejects and Bounces)
  const handleAhmedProcessCascadedReturn = async (invoiceId: string) => {
    const invoice = activeReturns.find(r => r.id === invoiceId);
    if (!invoice) return;

    // Check that decision is made for all items
    const missingDecision = invoice.items.some((_, idx) => !upstreamItemDecisions[idx]);
    if (missingDecision) {
      alert('⚠️ يرجى اتخاذ قرار القبول أو الرفض لكل بند في المرتجع أولاً.');
      return;
    }

    // Verify all rejections have reasons
    let hasEmptyReason = false;
    invoice.items.forEach((_, idx) => {
      const dec = upstreamItemDecisions[idx];
      if (dec.status === 'مرفوض' && (!dec.rejectionReason || !dec.rejectionReason.trim())) {
        hasEmptyReason = true;
      }
    });

    if (hasEmptyReason) {
      alert("⚠️ قفل الأمان: يجب إدخال 'سبب الرفض' لجميع البنود المرفوضة قبل المتابعة!");
      return;
    }

    setIsProcessing(true);
    try {
      const { runTransaction } = await import('firebase/firestore');
      await runTransaction(db, async (transaction) => {
        const retRef = doc(db, 'returns_inspection', invoiceId);
        const retSnap = await transaction.get(retRef);
        if (!retSnap.exists()) throw new Error('المرتجع غير موجود');
        const invoiceData = retSnap.data();

        // Determine items final status & calculate accepted sum
        const updatedItems = invoiceData.items.map((it: any, idx: number) => {
          const dec = upstreamItemDecisions[idx];
          return {
            ...it,
            status: dec.status === 'مقبول' ? 'جاهز/سليم' : 'مرفوض ومردود للعميل',
            testNotes: `قرار المورد أحمد: ${dec.status}. ` + (dec.rejectionReason ? `[سبب الرفض: ${dec.rejectionReason}]` : ''),
            overrideStatus: dec.status === 'مقبول' ? 'approved' : 'rejected'
          };
        });

        const anyAccepted = Object.values(upstreamItemDecisions).some(d => d.status === 'مقبول');
        const allRejected = Object.values(upstreamItemDecisions).every(d => d.status === 'مرفوض');

        let finalStatus = 'جاهز/سليم بالكامل';
        if (allRejected) {
          finalStatus = 'طلب مرتجع مرفوض مع سبب الرفض';
        } else if (Object.values(upstreamItemDecisions).some(d => d.status === 'مرفوض')) {
          finalStatus = 'مكتمل فحص مختلط';
        }

        // Calculate accepted sum to deduct from Mohamed's credit account
        const acceptedSum = invoiceData.items.reduce((sum: number, item: any, idx: number) => {
          const dec = upstreamItemDecisions[idx];
          return sum + (dec.status === 'مقبول' ? (item.price * item.quantity) : 0);
        }, 0);

        // 1. Update return document status
        transaction.update(retRef, {
          items: updatedItems,
          status: finalStatus,
          upstreamSettled: true,
          upstreamAcceptedSum: acceptedSum,
          rejectionReason: allRejected ? Object.values(upstreamItemDecisions)[0].rejectionReason : '',
          updatedAt: serverTimestamp()
        });

        // 2. Perform atomic rollback for the rejected items/amount to reset credit limits and ledger balance
        const totalSum = Number(invoiceData.totalReturnSum || invoiceData.totalAmount || 0);
        const rejectedSum = totalSum - acceptedSum;

        if (rejectedSum > 0) {
          // If all or some items are rejected, Ahmed is bouncing the return.
          // Rollback: reverse any temporary balance credit, restoring Mohamed's liability.
          const accRef = doc(db, 'accounts', 'ACC-B2B-MOHAMED-AHMED');
          const accSnap = await transaction.get(accRef);
          if (accSnap.exists()) {
            const currentBalance = accSnap.data().balance || 0;
            transaction.update(accRef, {
              balance: currentBalance + rejectedSum,
              updatedAt: serverTimestamp()
            });
          }

          // Reset Mohamed's credit limit and ledger balance on the B2B connection
          const buyerId = invoiceData.cascadedFromBuyerId || 'merchant_mohamed_id';
          const supplierId = invoiceData.ownerId || 'merchant_ahmed_id';
          const connId = `${buyerId}_${supplierId}`;
          const connRef = doc(db, 'b2bConnections', connId);
          const connSnap = await transaction.get(connRef);
          if (connSnap.exists()) {
            const connData = connSnap.data();
            const currentDebt = connData.debt || 0;
            transaction.update(connRef, {
              debt: currentDebt + rejectedSum,
              creditLimit: connData.preReturnCreditLimit !== undefined ? connData.preReturnCreditLimit : (connData.creditLimit || 100000),
              updatedAt: serverTimestamp()
            });
          }
        } else if (acceptedSum > 0) {
          // Standard acceptance path: deduct accepted value from Mohamed's balance
          const accRef = doc(db, 'accounts', 'ACC-B2B-MOHAMED-AHMED');
          const accSnap = await transaction.get(accRef);
          if (accSnap.exists()) {
            const currentBalance = accSnap.data().balance || 0;
            transaction.update(accRef, {
              balance: currentBalance - acceptedSum,
              updatedAt: serverTimestamp()
            });
          }
        }

        // 3. Bounce back the ticket to original return if needed
        if (invoiceData.originReturnId) {
          const originRef = doc(db, 'returns_inspection', invoiceData.originReturnId);
          transaction.update(originRef, {
            status: allRejected ? 'طلب مرتجع مرفوض مع سبب الرفض' : 'تم التدقيق والتسوية النهائية',
            upstreamProcessed: true,
            upstreamFeedback: allRejected ? 'تم رفض المرتجع بالكامل من المورد أحمد' : `تم قبول مرتجع بقيمة ${acceptedSum} ر.ي من المورد أحمد`,
            rejectionReason: allRejected ? Object.values(upstreamItemDecisions)[0].rejectionReason : '',
            updatedAt: serverTimestamp()
          });
        }
      });

      // Audit Log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'UPSTREAM_RETURN_SETLED',
        userId: 'merchant_ahmed_id',
        userName: 'المورد أحمد',
        details: `اعتماد/رفض المرتجع التراكمي #${invoiceId.substring(0,8)}. تم تحديث الحساب الآجل التابع للتاجر محمد بموجب القرار الإداري والمالي الفوري للضمان.`,
        timestamp: serverTimestamp()
      });

      const allRejected = Object.values(upstreamItemDecisions).every(d => d.status === 'مرفوض');
      alert(allRejected 
        ? `❌ تم رفض المرتجع بالكامل وبدء تسلسل المعالجة العكسية للمستحقات وسقف الائتمان للعميل محمد بنجاح.`
        : `✅ تم تدقيق المرتجع وتحديث الحسابات والمطالبات بنجاح.`
      );

      setSelectedInvoice(null);
      setUpstreamTestingActive(null);
      setUpstreamItemDecisions({});
    } catch (e: any) {
      console.error(e);
      alert('❌ فشل معالجة وتسوية المرتجع: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle rejected return pathways (Mohamed)
  const handleSettleRejectedReturn = async (option: 1 | 2 | 3) => {
    if (!selectedInvoice) return;
    setIsProcessing(true);
    const invoiceId = selectedInvoice.id!;
    const totalValue = selectedInvoice.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const rejectionReason = selectedInvoice.rejectionReason || 'تلف خارج بنود الضمان / سوء استخدام';

    try {
      const batch = writeBatch(db);

      if (option === 1) {
        // Option 1 (Re-send/Escalate): Re-route the ticket back to the courier queue with an attached counter-claim description.
        if (!counterClaimDescription.trim()) {
          alert('⚠️ يرجى كتابة مبرر أو وصف للمطالبة العكسية (Counter-Claim) قبل التصعيد.');
          setIsProcessing(false);
          return;
        }

        // We update the status back to courier queue ('بضاعة مرتجعة بالطريق')
        batch.update(doc(db, 'returns_inspection', invoiceId), {
          status: 'بضاعة مرتجعة بالطريق',
          deliveryAgentId: selectedEscalateDriverId,
          deliveryAgentName: selectedEscalateDriverName,
          escalated: true,
          counterClaim: counterClaimDescription.trim(),
          rejectionAction: 'escalate',
          updatedAt: serverTimestamp()
        });

        // Also update original ticket if it was cascaded
        if (selectedInvoice.originReturnId) {
          batch.update(doc(db, 'returns_inspection', selectedInvoice.originReturnId), {
            status: 'بضاعة مرتجعة بالطريق',
            escalated: true,
            counterClaim: counterClaimDescription.trim(),
            rejectionAction: 'escalate',
            updatedAt: serverTimestamp()
          });
        }

        // Audit log
        const auditRef = doc(collection(db, 'auditLogs'));
        batch.set(auditRef, {
          action: 'RETURN_REJECTION_ESCALATED',
          userId: profile?.uid || 'mohamed',
          userName: profile?.name || 'التاجر محمد',
          details: `تصعيد مطالبة مرتجع مرفوض #${invoiceId.substring(0,8)} وإعادة روتته عبر السائق ${selectedEscalateDriverName}. مبرر التصعيد: ${counterClaimDescription.trim()}`,
          timestamp: serverTimestamp()
        });

        await batch.commit();
        alert('🚀 تم تصعيد مطالبة المرتجع المرفوض بنجاح وإعادة تكليف سائق التوصيل لشحنها وفحصها فنيّاً مجدداً!');
        setCounterClaimDescription('');
      } 
      else if (option === 2) {
        // Option 2 (Write-Off to Scraps): Manually move the product record into the isolated "مخزن التالف والمردودات" and record it under the merchant's operational loss ledger.
        
        // 1. Create damaged/scrapped records for all items in the invoice
        for (const item of selectedInvoice.items) {
          const dmgRef = doc(collection(db, 'damaged_items'));
          batch.set(dmgRef, {
            ownerId: profile?.ownerId || 'merchant_mohamed_id',
            operated_by_employee_name: profile?.name || 'التاجر محمد',
            employee_uid: profile?.uid || 'system',
            itemId: item.productId,
            itemName: item.name,
            quantity: item.quantity,
            cost: item.price,
            totalLoss: item.price * item.quantity,
            reason: 'مخزن التالف والمردودات',
            note: `إهلاك وإعدام تشغيلي بسبب رفض المورد أحمد المرتجع. سبب الرفض: ${rejectionReason}`,
            createdAt: serverTimestamp()
          });

          // Deduct from inventory since it's a loss to scraps
          const rootInvRef = doc(db, 'inventory', item.productId);
          batch.update(rootInvRef, {
            stock: increment(-item.quantity),
            updatedAt: serverTimestamp()
          });
        }

        // 2. Record under merchant's operational loss ledger (stores/{ownerId}/transactions)
        const transRef = doc(collection(db, 'stores', profile?.ownerId || 'merchant_mohamed_id', 'transactions'));
        batch.set(transRef, {
          ownerId: profile?.ownerId || 'merchant_mohamed_id',
          amount: totalValue,
          type: 'expense',
          category: 'خسائر وتوالف بضاعة المخازن',
          description: `قيد إهلاك تشغيلي وتصفية للمرفوضات من الموزع أحمد. إجمالي التالف والمردودات: ${totalValue} ر.ي`,
          createdAt: serverTimestamp()
        });

        // 3. Update returns_inspection document status to final
        batch.update(doc(db, 'returns_inspection', invoiceId), {
          status: 'تالف بالكامل',
          rejectionAction: 'scrapped_loss',
          settledAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        if (selectedInvoice.originReturnId) {
          batch.update(doc(db, 'returns_inspection', selectedInvoice.originReturnId), {
            status: 'تالف بالكامل',
            rejectionAction: 'scrapped_loss',
            settledAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        // Audit Log
        const auditRef = doc(collection(db, 'auditLogs'));
        batch.set(auditRef, {
          action: 'RETURN_REJECTION_SCRAPPED_LOSS',
          userId: profile?.uid || 'mohamed',
          userName: profile?.name || 'التاجر محمد',
          details: `إعدام المرتجع المرفوض وتوجيهه لمخزن التالف والمردودات بقيمة إجمالية ${totalValue} ر.ي`,
          timestamp: serverTimestamp()
        });

        await batch.commit();
        alert('📉 تم ترحيل البنود بنجاح لمخزن التالف والمردودات، وقيد خسارة تشغيلية موازية بدفتر الموازنة الخسائر!');
      } 
      else if (option === 3) {
        // Option 3 (Return to Final Customer): Automatically convert the item into a "فاتورة مرتجع مرفوض للعميل", moving the financial liability back to the final citizen consumer.
        
        // 1. Update return document status to "مرفوض ومردود بالكامل" (equivalent to returned rejected invoice)
        batch.update(doc(db, 'returns_inspection', invoiceId), {
          status: 'مرفوض ومردود بالكامل',
          rejectionAction: 'returned_to_final_customer',
          customerLiabilityNotes: `تحويل البند إلى فاتورة مرتجع مرفوض للعميل وتحميل المواطن المسؤولية المالية بسبب رفض الموزع للضمان. سبب الرفض: ${rejectionReason}`,
          updatedAt: serverTimestamp()
        });

        if (selectedInvoice.originReturnId) {
          batch.update(doc(db, 'returns_inspection', selectedInvoice.originReturnId), {
            status: 'مرفوض ومردود بالكامل',
            rejectionAction: 'returned_to_final_customer',
            customerLiabilityNotes: `تحويل البند إلى فاتورة مرتجع مرفوض للعميل وتحميل المواطن المسؤولية المالية. سبب الرفض: ${rejectionReason}`,
            updatedAt: serverTimestamp()
          });
        }

        // 2. Record under merchant's ledger (receivables or liability restoration)
        const transRef = doc(collection(db, 'stores', profile?.ownerId || 'merchant_mohamed_id', 'transactions'));
        batch.set(transRef, {
          ownerId: profile?.ownerId || 'merchant_mohamed_id',
          amount: totalValue,
          type: 'income', // offsetting/cancelling the previous return refund liability
          category: 'مردودات مبيعات مرفوضة للعميل',
          description: `فاتورة مرتجع مرفوض للعميل [${selectedInvoice.customerName}] - إبطال استحقاق الارتجاع المالي ونقل الالتزام للمواطن. القيمة: ${totalValue} ر.ي`,
          createdAt: serverTimestamp()
        });

        // Audit Log
        const auditRef = doc(collection(db, 'auditLogs'));
        batch.set(auditRef, {
          action: 'RETURN_REJECTION_CUSTOMER_LIABILITY',
          userId: profile?.uid || 'mohamed',
          userName: profile?.name || 'التاجر محمد',
          details: `تحويل المرتجع المرفوض لـ "فاتورة مرتجع مرفوض للعميل" [${selectedInvoice.customerName}] بقيمة ${totalValue} ر.ي وتحميله المسؤولية كاملة.`,
          timestamp: serverTimestamp()
        });

        await batch.commit();
        alert('👤 تم تحويل البند بنجاح إلى [فاتورة مرتجع مرفوض للعميل] وإلغاء الاستحقاق المالي للزبون النهائي وتحميله المسئولية كاملة!');
      }

      // Close selection & reset
      setSelectedInvoice(null);
    } catch (e: any) {
      console.error(e);
      alert('❌ فشل تنفيذ تسوية مسار المرتجع المرفوض: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter returns
  const returnsUnderInspection = activeReturns.filter(r => r.status === 'مخزن بضائع قيد الفحص والمطابقة' || r.status === 'بضاعة مرتجعة بالطريق' || r.status === 'بانتظار فحص المورد' || r.status === 'قيد فحص المورد أحمد' || r.status === 'تم الترحيل للتاجر المصدر' || r.status === 'طلب مرتجع مرفوض مع سبب الرفض');
  const finalizedReturns = activeReturns.filter(r => r.status !== 'مخزن بضائع قيد الفحص والمطابقة' && r.status !== 'بضاعة مرتجعة بالطريق' && r.status !== 'بانتظار فحص المورد' && r.status !== 'قيد فحص المورد أحمد' && r.status !== 'تم الترحيل للتاجر المصدر' && r.status !== 'طلب مرتجع مرفوض مع سبب الرفض');

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
      
      {/* 🔮 MODULE SUB-HEADER AND BALANCED NAVIGATION */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-[#0a0f28] to-indigo-950 border border-white/5 rounded-3xl flex flex-col xl:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span className="p-2.5 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-2xl text-slate-950 animate-pulse">
              <RotateCcw size={22} />
            </span>
            نظام المرتجع والتجربة والمطابقة الذكي 🛡️
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 font-bold">
            مصفوفة التدقيق والفرز اللحظي للضمانات والعيوب - عزل الأصول وتأمين النقدية لسيناريوهات البيع اليدوي والتوصيل
          </p>
        </div>

        {/* Dynamic internal tabs */}
        <div className="flex flex-wrap gap-2.5 bg-slate-950/45 p-1 rounded-2xl border border-white/5">
          <button 
            onClick={() => setActiveSubTab('create')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeSubTab === 'create' ? 'bg-[#cf8a3c] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            📥 إصدار فاتورة مرتجع جديدة
          </button>
          <button 
            onClick={() => setActiveSubTab('testing')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${activeSubTab === 'testing' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Wrench size={14} />
            منصة التجربة والفحص الجمركي ({returnsUnderInspection.length})
          </button>
          <button 
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeSubTab === 'history' ? 'bg-[#cf8a3c] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            📜 أرشيف المطابقات المغلقة
          </button>
        </div>
      </div>

      {/* 🔮 MULTI-TENANT SIMULATION & CREDIT BALANCES LEDGER MONITOR */}
      <div className="p-5 bg-[#0a0f25]/80 border border-indigo-500/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-xl">
            🎛️ لوحة محاكاة الأطراف المتعددة
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSimulatedRole('mohamed');
                setSelectedInvoice(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${simulatedRole === 'mohamed' ? 'bg-[#cf8a3c] text-white shadow-lg' : 'bg-slate-900/40 text-gray-400 hover:text-white'}`}
            >
              👤 التاجر محمد (محل التجزئة)
            </button>
            <button
              onClick={() => {
                setSimulatedRole('ahmed');
                setSelectedInvoice(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${simulatedRole === 'ahmed' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/40 text-gray-400 hover:text-white'}`}
            >
              👑 التاجر أحمد (المورد المصدر)
            </button>
          </div>
        </div>

        {/* B2B Live Balances Display (Requirement 4) */}
        <div className="flex items-center gap-3.5 bg-slate-950/40 px-4.5 py-2.5 rounded-2xl border border-white/5">
          <span className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
            <DollarSign size={16} />
          </span>
          <div className="text-right">
            <p className="text-[9px] text-gray-400 font-bold">الحساب الجاري الآجل (التاجر محمد ⇄ المورد أحمد):</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-sm font-black font-mono text-[#cf8a3c]">
                {vendorAccount ? Number(vendorAccount.balance).toLocaleString() : '450,000'}
              </span>
              <span className="text-[10px] text-gray-400">ر.ي</span>
              <span className="text-[9px] text-gray-500 font-bold bg-white/[0.02] px-2 py-0.5 rounded-md border border-white/5">
                ذمم مدينة مستحقة
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== SUB-TAB 1: CREATE RETURN INVOICE ===================== */}
      {activeSubTab === 'create' && (
        <div className="card-glass p-6 text-right rounded-3xl border border-white/5 bg-slate-950/20 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <FileText size={16} className="text-[#cf8a3c]" />
                حاقن بيانات الاسترجاع والمطابقة
              </h3>
              <p className="text-[10px] text-gray-400">إصدار طلب مرتجع وتوجيهه مباشرة لـ "مخزن بضائع قيد الفحص والمطابقة" لضمان عدم حدوث تلاعب مالي</p>
            </div>
            <button 
              onClick={addFormRow}
              className="px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-xl text-xs font-bold"
            >
              + إضافة صنف جديد
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] text-gray-400 font-bold block">اسم العميل (صاحب المرتجع) *</label>
              <div className="relative">
                <User size={14} className="absolute right-3.5 top-3 text-gray-500" />
                <input
                  type="text"
                  placeholder="محمد أحمد اليماني..."
                  value={invoiceForm.customerName}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customerName: e.target.value })}
                  className="w-full bg-slate-900/60 border border-white/5 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-gray-400 font-bold block">رقم الهاتف للعميل</label>
              <input
                type="text"
                placeholder="77XXXXXXX"
                value={invoiceForm.customerPhone}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, customerPhone: e.target.value })}
                className="w-full bg-slate-900/60 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-gray-400 font-bold block">طريقة الاسترجاع (السيناريو)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceForm({ ...invoiceForm, scenario: 'face_to_face' })}
                  className={`py-2.5 px-3 border rounded-xl font-bold text-xs transition-colors cursor-pointer ${invoiceForm.scenario === 'face_to_face' ? 'bg-[#cf8a3c]/15 text-[#cf8a3c] border-[#cf8a3c]/30' : 'bg-slate-900/50 border-white/5 text-gray-400'}`}
                >
                  🤝 استلام فوري (F2F)
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceForm({ ...invoiceForm, scenario: 'delivery' })}
                  className={`py-2.5 px-3 border rounded-xl font-bold text-xs transition-colors cursor-pointer ${invoiceForm.scenario === 'delivery' ? 'bg-[#cf8a3c]/15 text-[#cf8a3c] border-[#cf8a3c]/30 animate-pulse' : 'bg-slate-900/50 border-white/5 text-gray-400'}`}
                >
                  🚚 عبر مندوب التوصيل
                </button>
              </div>
            </div>
          </div>

          {invoiceForm.scenario === 'delivery' && (
            <div className="p-4 bg-[#cf8a3c]/5 border border-[#cf8a3c]/10 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-amber-500 font-bold block">اختر مندوب التوصيل المكلف بالمرتجع</label>
                <select
                  value={invoiceForm.deliveryAgentId}
                  onChange={(e) => {
                    const agent = deliveryAgents.find(u => u.id === e.target.value);
                    setInvoiceForm({
                      ...invoiceForm,
                      deliveryAgentId: e.target.value,
                      deliveryAgentName: agent?.name || 'مندوب عام'
                    });
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">-- اختر المندوب --</option>
                  {deliveryAgents.map(ag => (
                    <option key={ag.id} value={ag.id}>{ag.name} ({ag.phone || 'بدون هاتف'})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center text-[10px] text-amber-300 leading-relaxed font-bold">
                ℹ️ سيتم إسناد الشحنة المرتجعة بعهدة هذا المندوب، ولن يتم قبول دمجها بالمخزن إلا بعد تفريغ وفحص المعتمد عيناً ومطابقة الضمان.
              </div>
            </div>
          )}

          {/* Return items table */}
          <div className="overflow-x-auto border border-white/5 rounded-2xl bg-slate-900/40">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 font-bold bg-slate-950/40">
                  <th className="p-3">ابحث عن منتج بالمخزن</th>
                  <th className="p-3">الباركود</th>
                  <th className="p-3 text-center w-20">الكمية</th>
                  <th className="p-3">تاريخ الشراء الأصلي</th>
                  <th className="p-3">نوع الضمان</th>
                  <th className="p-3">فترة الضمان (يوم)</th>
                  <th className="p-3">حالة الضمان التقديرية</th>
                  <th className="p-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {invoiceForm.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-white/[0.02] last:border-none hover:bg-white/[0.01]">
                    
                    {/* Product Search column */}
                    <td className="p-3 relative w-64">
                      <div className="relative">
                        <Search size={12} className="absolute right-2.5 top-2.5 text-gray-500" />
                        <input
                          type="text"
                          placeholder="ابحث بالاسم أو الباركود..."
                          value={item.name || productSearch}
                          onChange={(e) => {
                            setProductSearch(e.target.value);
                            setShowDropdown(idx);
                            const updated = [...invoiceForm.items];
                            updated[idx].name = e.target.value;
                            setInvoiceForm({ ...invoiceForm, items: updated });
                          }}
                          className="w-full bg-slate-950 border border-white/5 rounded-lg pr-8 pl-2 py-1.5 text-xs text-white"
                        />
                      </div>

                      {showDropdown === idx && (
                        <div className="absolute right-3 left-3 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-white/10 rounded-xl z-50 shadow-2xl p-1">
                          {storeInventory
                            .filter(it => 
                              it.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                              (it.barcode && it.barcode.includes(productSearch))
                            )
                            .slice(0, 5)
                            .map(matchedItem => (
                              <button
                                key={matchedItem.id}
                                type="button"
                                onClick={() => handleItemSelect(idx, matchedItem)}
                                className="w-full text-right px-3 py-2 text-xs hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-gray-300 flex justify-between"
                              >
                                <span>{matchedItem.name}</span>
                                <span className="text-[10px] text-amber-500 font-mono font-bold">{matchedItem.barcode}</span>
                              </button>
                            ))}
                          {storeInventory.filter(it => 
                              it.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                              (it.barcode && it.barcode.includes(productSearch))
                            ).length === 0 && (
                              <p className="text-[10px] text-gray-500 p-2 text-center">لا توجد منتجات مطابقة بالمخزن</p>
                            )}
                        </div>
                      )}
                    </td>

                    {/* Barcode column */}
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.barcode}
                        onChange={(e) => {
                          const updated = [...invoiceForm.items];
                          updated[idx].barcode = e.target.value;
                          setInvoiceForm({ ...invoiceForm, items: updated });
                        }}
                        className="w-32 bg-slate-950 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-mono"
                      />
                    </td>

                    {/* Quantity column */}
                    <td className="p-3">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...invoiceForm.items];
                          updated[idx].quantity = Math.max(1, Number(e.target.value));
                          setInvoiceForm({ ...invoiceForm, items: updated });
                        }}
                        className="w-16 bg-slate-950 border border-white/5 rounded-lg py-1.5 text-xs text-white text-center"
                      />
                    </td>

                    {/* Original Purchase Date column */}
                    <td className="p-3">
                      <input
                        type="date"
                        value={item.purchaseDate}
                        onChange={(e) => {
                          const updated = [...invoiceForm.items];
                          updated[idx].purchaseDate = e.target.value;
                          setInvoiceForm({ ...invoiceForm, items: updated });
                        }}
                        className="bg-slate-950 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </td>

                    {/* Warranty Type column */}
                    <td className="p-3">
                      <select
                        value={item.warrantyType}
                        onChange={(e) => {
                          const updated = [...invoiceForm.items];
                          updated[idx].warrantyType = e.target.value as any;
                          setInvoiceForm({ ...invoiceForm, items: updated });
                        }}
                        className="bg-slate-950 border border-white/5 rounded-lg px-1.5 py-1.5 text-xs text-white"
                      >
                        <option value="none">بدون ضمان</option>
                        <option value="operational">ضمان تشغيل</option>
                        <option value="limited">ضمان محدود</option>
                      </select>
                    </td>

                    {/* Warranty Duration column */}
                    <td className="p-3">
                      <input
                        type="number"
                        min="0"
                        value={item.warrantyDuration}
                        disabled={item.warrantyType !== 'limited'}
                        onChange={(e) => {
                          const updated = [...invoiceForm.items];
                          updated[idx].warrantyDuration = Math.max(0, Number(e.target.value));
                          setInvoiceForm({ ...invoiceForm, items: updated });
                        }}
                        className="w-16 bg-slate-950 border border-white/5 rounded-lg py-1.5 text-xs text-white text-center disabled:opacity-30"
                      />
                    </td>

                    {/* Dynamic Warranty Status calculation column */}
                    <td className="p-3">
                      {(() => {
                        const isOut = calculateIsOutOfWarranty(item.purchaseDate, item.warrantyType, item.warrantyDuration);
                        const info = getWarrantyInfoText(item);
                        return (
                          <span className={`px-2 py-1 rounded-lg text-[10px] ${info.color}`}>
                            {info.text}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Remove Action column */}
                    <td className="p-3 text-center">
                      <button 
                        onClick={() => removeFormRow(idx)}
                        className="p-1.5 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg border-none cursor-pointer"
                      >
                        <Trash size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleIssueReturnInvoice}
              disabled={isProcessing}
              className="py-3 px-8 bg-gradient-to-tr from-[#cf8a3c] to-amber-500 hover:from-[#b0732e] hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 border-none cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <RotateCcw size={14} />
              إصدار الفاتورة المرتجعة وتوجيهها للفحص 🚀
            </button>
          </div>
        </div>
      )}

      {/* ===================== SUB-TAB 2: TESTING PLATFORM ===================== */}
      {activeSubTab === 'testing' && (
        <div className="space-y-6">
          <div className="p-4 bg-[#cf8a3c]/5 border border-[#cf8a3c]/10 rounded-2xl flex items-center gap-3 text-xs leading-relaxed text-amber-300">
            <ShieldCheck size={20} className="text-[#cf8a3c]" />
            <div>
              <p className="font-extrabold text-[#cf8a3c] text-sm">منصة الفحص الجمركي واختبار المرتجعات 🧪</p>
              <p className="mt-1">
                يفحص الفني السلعة المرتجعة، ويسجل عيوب الجودة والتجربة. المنتجات خارج فترة الضمان يتم حظرها تلقائياً وبشكل استثنائي حتى يتخذ مالك النظام قرار التمرير الاستثنائي.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Queue list */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-white pb-2 pr-1 flex items-center gap-1.5 border-b border-white/5">
                <Truck size={16} className="text-[#cf8a3c]" />
                شحنات المرتجعات النشطة بانتظار الفحص ({returnsUnderInspection.length})
              </h3>

              {returnsUnderInspection.length === 0 ? (
                <div className="text-center py-16 text-gray-500 text-xs font-bold bg-white/[0.01] border border-white/5 p-6 rounded-2xl">
                  مستقر! لا توجد شحنات مرتجعات قيد الفحص والمطابقة بالوقت الحالي.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {returnsUnderInspection.map((ret) => (
                    <button
                      key={ret.id}
                      onClick={() => setSelectedInvoice(ret)}
                      className={`w-full text-right p-4 rounded-2xl border transition-all text-xs flex justify-between items-start cursor-pointer ${selectedInvoice?.id === ret.id ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-950/20 border-white/5 hover:border-white/10'}`}
                    >
                      <div className="space-y-1">
                        <p className="font-black text-white">{ret.customerName}</p>
                        <p className="text-[10px] text-gray-400 font-mono">#{ret.id?.substring(0,8)}</p>
                        <p className="text-[10px] text-[#cf8a3c] font-bold">
                          {ret.scenario === 'face_to_face' ? '🤝 وجه لوجه' : `🚚 عبر المندوب: ${ret.deliveryAgentName || '---'}`}
                        </p>
                      </div>
                      <div className="text-left space-y-1.5 flex flex-col items-end">
                        <span className={`px-2 py-0.5 rounded text-[9px] border ${
                          ret.status === 'بضاعة مرتجعة بالطريق' 
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/20 animate-pulse' 
                            : ret.status === 'بانتظار فحص المورد' 
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' 
                            : ret.status === 'تم الترحيل للتاجر المصدر'
                            ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/20'
                        }`}>
                          {ret.status}
                        </span>
                        <p className="text-[10px] text-gray-500 mt-1 font-bold">{ret.items.length} بنود</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Testing and Action Workspace */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-black text-white pb-2 pr-1 flex items-center gap-1.5 border-b border-white/5">
                <Wrench size={16} className="text-[#cf8a3c]" />
                مختبر الفحص ومطابقة الضمان العيني
              </h3>

              {selectedInvoice ? (
                simulatedRole === 'ahmed' ? (
                  /* Upstream Approvals Ledger (Merchant Ahmed) */
                  <div className="p-6 rounded-3xl border border-white/5 bg-slate-950/30 space-y-6">
                    {/* Selected invoice header info */}
                    <div className="flex justify-between items-start bg-[#0f1530] p-4 rounded-2xl border border-white/5">
                      <div className="space-y-1">
                        <p className="text-[10px] text-indigo-400 font-bold">التاجر المسترجع (محل التجزئة):</p>
                        <h4 className="text-sm font-black text-white">{selectedInvoice.customerName}</h4>
                        <p className="text-[10px] text-gray-400 font-mono">السيناريو: ترحيل عكسي (Reverse Logistics Cascaded)</p>
                      </div>
                      <div className="text-left space-y-1.5">
                        <span className="text-[9px] text-[#cf8a3c] font-black uppercase tracking-wider block">
                          السائق المكلف: {selectedInvoice.deliveryAgentName}
                        </span>
                        <p className="text-[9px] text-gray-500">حالة المرتجع الحالية: <span className="text-white font-bold">{selectedInvoice.status}</span></p>
                      </div>
                    </div>

                    {/* Driver transit assist buttons */}
                    {selectedInvoice.status === 'بضاعة مرتجعة بالطريق' && (
                      <div className="p-4 bg-indigo-950/40 border border-indigo-500/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Truck className="text-indigo-400 animate-bounce" size={18} />
                          <span className="text-indigo-200 font-bold">🚚 الشحنة في الطريق مع السائق {selectedInvoice.deliveryAgentName}</span>
                        </div>
                        <button
                          onClick={async () => {
                            await updateDoc(doc(db, 'returns_inspection', selectedInvoice.id!), {
                              status: 'بانتظار فحص المورد',
                              updatedAt: serverTimestamp()
                            });
                            setSelectedInvoice({ ...selectedInvoice, status: 'بانتظار فحص المورد' });
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-[10px] cursor-pointer border-none"
                        >
                          🏁 تأكيد استلام السائق الفعلي ووصول الشحنة لمخازني
                        </button>
                      </div>
                    )}

                    {/* Items list to accept/reject */}
                    <div className="space-y-4">
                      <p className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                        <ShieldCheck size={14} />
                        قرارات الفحص الفني والاعتماد العكسي (Upstream Approval Nodes):
                      </p>

                      {selectedInvoice.items.map((item, idx) => {
                        const decision = upstreamItemDecisions[idx];
                        return (
                          <div key={idx} className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                              <div>
                                <h5 className="font-black text-white text-xs">{item.name}</h5>
                                <p className="text-[10px] text-gray-400 font-mono">الباركود: {item.barcode} | الكمية: {item.quantity} | القيمة: {(item.price * item.quantity).toLocaleString()} ر.ي</p>
                              </div>
                              <span className="text-[10px] text-gray-500 font-bold bg-slate-950 px-2 py-0.5 rounded border border-white/5">
                                سعر الحبة: {item.price.toLocaleString()} ر.ي
                              </span>
                            </div>

                            {/* Action toggles */}
                            <div className="flex flex-wrap gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleUpstreamItemDecision(idx, 'مقبول')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${decision?.status === 'مقبول' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-white/5 text-gray-400'}`}
                              >
                                <Check size={12} />
                                قبول واعتماد البند ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpstreamItemDecision(idx, 'مرفوض', decision?.rejectionReason || '')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${decision?.status === 'مرفوض' ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-slate-950 border-white/5 text-gray-400'}`}
                              >
                                <XCircle size={12} />
                                رفض البند ومطالبة المبرر ❌
                              </button>
                            </div>

                            {/* Strict rejection reason textarea (Requirement 4) */}
                            {decision?.status === 'مرفوض' && (
                              <div className="space-y-1.5 pt-2">
                                <label className="text-[10px] text-rose-400 font-bold block">
                                  سبب الرفض (strict required string) *
                                </label>
                                <input
                                  type="text"
                                  placeholder="اكتب سبب رفض مطابقة البند المصنعي عينائياً بالتفصيل هنا..."
                                  value={decision.rejectionReason || ''}
                                  onChange={(e) => handleUpstreamItemDecision(idx, 'مرفوض', e.target.value)}
                                  className="w-full bg-slate-950 border border-rose-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 placeholder-gray-600 font-bold"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Ahmed's Final Submit Button */}
                    <div className="p-4 bg-indigo-950/20 border border-indigo-500/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h5 className="font-black text-indigo-300 text-xs">تسجيل القيد واعتماد التصفية والخصم المالي 📥</h5>
                        <p className="text-[10px] text-gray-400 mt-1">
                          عند الاعتماد النهائي، سيتم تلقائياً تصفية الحساب الجاري الآجل وتخفيض مديونية التاجر محمد بنسبة تماثل قيمة البنود المقبولة، وإرجاع المرفوضات مع الأسباب.
                        </p>
                      </div>
                      <button
                        onClick={() => handleAhmedProcessCascadedReturn(selectedInvoice.id!)}
                        disabled={isProcessing}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-none"
                      >
                        <ClipboardCheck size={14} />
                        تسجيل القيد المالي العكسي ✍️
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Retailer Mohamed's local inspection and testing workspace */
                  <div className="p-6 rounded-3xl border border-white/5 bg-slate-950/30 space-y-6">
                    {/* Selected invoice header info */}
                    <div className="flex justify-between items-start bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-500 font-bold">العميل المسترجع:</p>
                        <h4 className="text-sm font-black text-white">{selectedInvoice.customerName}</h4>
                        {selectedInvoice.customerPhone && (
                          <p className="text-[10px] text-gray-400 font-mono">{selectedInvoice.customerPhone}</p>
                        )}
                      </div>
                      <div className="text-left space-y-1.5">
                        <span className="text-[9px] text-[#cf8a3c] font-black uppercase tracking-wider block">
                          سيناريو المعاملة: {selectedInvoice.scenario === 'face_to_face' ? 'وجه لوجه F2F' : `توصيل (${selectedInvoice.deliveryAgentName})`}
                        </span>
                        <p className="text-[9px] text-gray-500">تم الاستلام في: {selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt.seconds * 1000).toLocaleString('ar-YE') : 'الآن'}</p>
                      </div>
                    </div>

                    {selectedInvoice.status === 'طلب مرتجع مرفوض مع سبب الرفض' && (
                      <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl space-y-5 text-right">
                        <div className="flex items-center gap-3">
                          <span className="p-2.5 bg-red-500/20 rounded-2xl text-red-400">
                            <XCircle size={24} />
                          </span>
                          <div>
                            <h4 className="text-base font-black text-white">لوحة تسوية المرفوضات من المورد أحمد 🛡️</h4>
                            <p className="text-xs text-rose-400 mt-1">سبب الرفض: <span className="font-mono text-white bg-red-500/20 px-2 py-0.5 rounded text-[11px] font-bold">{selectedInvoice.rejectionReason || 'تلف خارج بنود الضمان / سوء استخدام'}</span></p>
                          </div>
                        </div>
                        
                        <p className="text-xs text-gray-300 leading-relaxed font-bold">
                          بصفتك التاجر محمد، يرجى اختيار أحد المسارات الـ 3 المعتمدة لتسوية هذا البند المرفوض وتصفيته ماليّاً وفنيّاً:
                        </p>

                        {/* Pathway Switcher Tabs */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-1 rounded-2xl border border-white/5">
                          <button
                            type="button"
                            onClick={() => setActivePathwayTab('escalate')}
                            className={`py-2.5 rounded-xl font-black text-[11px] transition-all cursor-pointer ${activePathwayTab === 'escalate' ? 'bg-[#cf8a3c] text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                          >
                            🔄 المسار 1: تصعيد ومطالبة
                          </button>
                          <button
                            type="button"
                            onClick={() => setActivePathwayTab('scrap')}
                            className={`py-2.5 rounded-xl font-black text-[11px] transition-all cursor-pointer ${activePathwayTab === 'scrap' ? 'bg-[#cf8a3c] text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                          >
                            📉 المسار 2: الترحيل للتوالف
                          </button>
                          <button
                            type="button"
                            onClick={() => setActivePathwayTab('customer')}
                            className={`py-2.5 rounded-xl font-black text-[11px] transition-all cursor-pointer ${activePathwayTab === 'customer' ? 'bg-[#cf8a3c] text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                          >
                            👤 المسار 3: إرجاع للعميل ماليّاً
                          </button>
                        </div>

                        {/* TAB 1 CONTENT: ESCALATE */}
                        {activePathwayTab === 'escalate' && (
                          <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 space-y-4">
                            <div className="space-y-1">
                              <h5 className="text-xs font-black text-amber-300">🔄 خيار إعادة الشحن والتصعيد للموزع:</h5>
                              <p className="text-[10.5px] text-gray-400 leading-relaxed">
                                سيتم إسناد الشحنة مجدداً لسائق توصيل مختار وإعادتها لقسم الفحص للموزع أحمد مع إرفاق المبرر الفني والاعتراض العكسي (Counter-Claim) لإعادة التفاوض.
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                              <div className="space-y-1.5">
                                <label className="text-[10px] text-gray-400 font-bold block">تعيين السائق المكلف بالشحن العكسي:</label>
                                <select
                                  value={selectedEscalateDriverId}
                                  onChange={(e) => {
                                    const selectedAgent = deliveryAgents.find(da => da.id === e.target.value);
                                    if (selectedAgent) {
                                      setSelectedEscalateDriverId(selectedAgent.id);
                                      setSelectedEscalateDriverName(selectedAgent.name || 'سائق توصيل');
                                    } else if (e.target.value === 'delivery_agent_ahmed_id') {
                                      setSelectedEscalateDriverId('delivery_agent_ahmed_id');
                                      setSelectedEscalateDriverName('أحمد اللوجستي (سائق عام)');
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                >
                                  <option value="delivery_agent_ahmed_id">أحمد اللوجستي (سائق عام)</option>
                                  {deliveryAgents.map(da => (
                                    <option key={da.id} value={da.id}>{da.name || 'سائق بدون اسم'}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] text-gray-400 font-bold block">مبرر الاعتراض العكسي (Counter-Claim) *</label>
                                <input
                                  type="text"
                                  placeholder="اكتب المبرر الفني للاعتراض وتصعيد الفحص هنا..."
                                  value={counterClaimDescription}
                                  onChange={(e) => setCounterClaimDescription(e.target.value)}
                                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#cf8a3c] placeholder-gray-600 font-bold"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSettleRejectedReturn(1)}
                              disabled={isProcessing}
                              className="w-full py-2.5 bg-gradient-to-tr from-[#cf8a3c] to-amber-500 hover:from-[#b0732e] hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 border-none cursor-pointer"
                            >
                              🚀 إرسال وتصعيد للموزع أحمد عبر السائق
                            </button>
                          </div>
                        )}

                        {/* TAB 2 CONTENT: SCRAP LOSS */}
                        {activePathwayTab === 'scrap' && (
                          <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 space-y-4">
                            <div className="space-y-1">
                              <h5 className="text-xs font-black text-rose-300">📉 خيار الترحيل والإهلاك للتوالف والمردودات:</h5>
                              <p className="text-[10.5px] text-gray-400 leading-relaxed">
                                سيتم إرسال المنتجات فوراً للمستودع المعزول "مخزن التوالف والمردودات" كخردة/تالف، مع تسجيل القيمة الإجمالية للمرتجع (<span className="text-[#cf8a3c] font-black font-mono">{selectedInvoice.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()} ر.ي</span>) كخسارة تشغيلية في موازنة المحل.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSettleRejectedReturn(2)}
                              disabled={isProcessing}
                              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 border-none cursor-pointer"
                            >
                              🗑️ ترحيل وإعدام تشغيلي في مخزن التالف والمردودات
                            </button>
                          </div>
                        )}

                        {/* TAB 3 CONTENT: RETURN TO CLIENT */}
                        {activePathwayTab === 'customer' && (
                          <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 space-y-4">
                            <div className="space-y-1">
                              <h5 className="text-xs font-black text-emerald-300">👤 خيار تحويل المسؤولية والالتزام للزبون النهائي:</h5>
                              <p className="text-[10.5px] text-gray-400 leading-relaxed">
                                سيتم إلغاء استحقاق الإرجاع المالي للزبون النهائي بالكامل وتحويل السلعة آلياً إلى "فاتورة مرتجع مرفوض للعميل". ينتقل الالتزام المالي والعبء على المستهلك وتتحرر ميزانية المحل.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSettleRejectedReturn(3)}
                              disabled={isProcessing}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 border-none cursor-pointer"
                            >
                              👤 إصدار فاتورة مرتجع مرفوض وتحميل العميل المسؤولية
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* List of return products for testing */}
                    <div className="space-y-4">
                      <p className="text-[11px] text-[#cf8a3c] font-black">📋 البنود المستلمة للفحص والاختبار التجريبي:</p>
                      
                      {selectedInvoice.items.map((item, idx) => {
                        const isExpired = calculateIsOutOfWarranty(item.purchaseDate, item.warrantyType, item.warrantyDuration);
                        const warrantyInfo = getWarrantyInfoText(item);
                        
                        return (
                          <div key={idx} className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-4">
                            
                            {/* Item meta info */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/5 pb-3">
                              <div>
                                <p className="font-black text-white text-xs">{item.name}</p>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">باركود: {item.barcode} | كمية: {item.quantity}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${warrantyInfo.color}`}>
                                  {warrantyInfo.text}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-400 font-mono">
                                  تاريخ الشراء: {item.purchaseDate}
                                </span>
                              </div>
                            </div>

                            {/* ⚠️ CRITICAL OUT OF WARRANTY OVERRIDE BOX */}
                            {isExpired && (
                              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl space-y-3">
                                <div className="flex items-center gap-2">
                                  <ShieldAlert size={16} className="text-rose-500 animate-pulse" />
                                  <span className="text-xs font-black text-rose-400">انتهت فترة الضمان لهذا المنتج!</span>
                                </div>
                                <p className="text-[10px] text-gray-400 leading-relaxed font-bold">
                                  هذا البند خارج نطاق التغطية والضمان المسموح به. يجب على المالك/المشرف تمريره استثنائياً ليتمكن الفني من الفحص والتحديث.
                                </p>

                                {/* Action buttons strictly for Owner/Admin */}
                                {isAdminOrOwner ? (
                                  <div className="flex items-center gap-2.5 pt-1.5">
                                    <button
                                      onClick={() => handleAdminOverride(selectedInvoice.id!, idx, 'approve')}
                                      disabled={isProcessing}
                                      className="px-3.5 py-1.5 bg-green-500 text-slate-950 font-black rounded-lg text-[10px] hover:bg-green-600 transition-colors border-none cursor-pointer"
                                    >
                                      [موافقة وتمرير المرتجع] ✓
                                    </button>
                                    <button
                                      onClick={() => handleAdminOverride(selectedInvoice.id!, idx, 'reject')}
                                      disabled={isProcessing}
                                      className="px-3.5 py-1.5 bg-red-500/20 text-red-400 font-black rounded-lg text-[10px] hover:bg-red-500/30 transition-colors border-none cursor-pointer"
                                    >
                                      [رفض وإرجاع للعميل] ❌
                                    </button>
                                  </div>
                                ) : (
                                  <div className="p-2 bg-slate-950/50 rounded-lg text-[10px] text-amber-500 text-center font-bold">
                                    🔒 بانتظار موافقة أو رفض المسؤول/المالك لتمرير هذا البند الاستثنائي.
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Defect Notes and testing log */}
                            <div className="space-y-2">
                              <label className="text-[10px] text-gray-400 font-bold block">ملاحظات الفحص العيني والتجربة (Defect Log) *</label>
                              <input
                                type="text"
                                placeholder="سجل خلل الشاشة، حالة البطارية، كسر خارجي..."
                                value={item.testNotes || ''}
                                onChange={(e) => handleUpdateTestNotes(selectedInvoice.id!, idx, e.target.value)}
                                className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            {/* Manual toggles for agent testing */}
                            <div className="flex items-center justify-between pt-2">
                              <span className="text-[10px] text-gray-500">حالة البند الحالية:</span>
                              
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleToggleItemStatus(selectedInvoice.id!, idx, 'جاهز/سليم')}
                                  disabled={item.status === 'مرفوض ومردود للعميل' || (isExpired && item.overrideStatus === 'pending_override')}
                                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer ${item.status === 'جاهز/سليم' ? 'bg-green-500 text-slate-950 shadow-md' : 'bg-slate-950 text-gray-400 hover:text-white'}`}
                                >
                                  <CheckCircle2 size={13} />
                                  جاهز/سليم ✓
                                </button>
                                <button
                                  onClick={() => handleToggleItemStatus(selectedInvoice.id!, idx, 'تالف')}
                                  disabled={item.status === 'مرفوض ومردود للعميل' || (isExpired && item.overrideStatus === 'pending_override')}
                                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer ${item.status === 'تالف' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-950 text-gray-400 hover:text-white'}`}
                                >
                                  <XCircle size={13} />
                                  تالف ❌
                                </button>
                                {item.status === 'مرفوض ومردود للعميل' && (
                                  <span className="px-3 py-2 bg-red-500/10 text-red-500 rounded-xl text-xs font-bold">
                                    مرفوض ومردود للعميل ❌
                                  </span>
                                )}
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>

                    {/* Submit Final Settlement */}
                    <div className="p-4 bg-indigo-950/20 border border-indigo-500/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h5 className="font-black text-white text-xs">إقفال وحقن تصفية المرتجع</h5>
                        <p className="text-[10px] text-gray-400 mt-1">عند الإقفال النهائي، سيتم تحديث المخزون الحقيقي للقطع السليمة، وعزل التوالف بقسم المعمل، وتسوية الحركات المالية بدقة بالغة.</p>
                      </div>
                      <button
                        onClick={() => handleFinalizeAndRoute(selectedInvoice.id!)}
                        disabled={isProcessing || selectedInvoice.items.some(it => it.status === 'مخزن بضائع قيد الفحص والمطابقة')}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-none"
                      >
                        <ClipboardCheck size={14} />
                        توطين وإغلاق دورة المرتجع 📥
                      </button>
                    </div>

                    {/* Cascading Return Option (Requirement 1) */}
                    {selectedInvoice.status !== 'تم الترحيل للتاجر المصدر' && (
                      <div className="p-4 bg-amber-950/20 border border-amber-500/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4">
                        <div>
                          <h5 className="font-black text-white text-xs">ترحيل المرتجع للتاجر المصدر 🔗</h5>
                          <p className="text-[10px] text-gray-400 mt-1">إذا لم تكن قادراً على حل هذا المرتجع محلياً (مثلاً عيب مصنعي يتطلب إعادته للموزع الرئيسي)، قم بترحيل الشحنة للتاجر أحمد.</p>
                        </div>
                        <button
                          onClick={() => {
                            setCascadeTargetSupplierId('merchant_ahmed_id');
                            setCascadeTargetSupplierName('التاجر أحمد (المورد الرئيسي)');
                            setCascadeSelectedDriverId(deliveryAgents[0]?.id || 'delivery_agent_ahmed_id');
                            setCascadeSelectedDriverName(deliveryAgents[0]?.name || 'أحمد اللوجستي (سائق عام)');
                            setShowCascadeModal(true);
                          }}
                          disabled={isProcessing}
                          className="px-6 py-3 bg-[#cf8a3c] hover:bg-[#b5762d] text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border-none"
                        >
                          <Truck size={14} />
                          ترحيل المرتجع للتاجر المصدر 🚚
                        </button>
                      </div>
                    )}

                    {selectedInvoice.status === 'تم الترحيل للتاجر المصدر' && (
                      <div className="p-4 bg-emerald-950/20 border border-emerald-500/10 rounded-2xl space-y-2 mt-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                          <h5 className="font-black text-emerald-300 text-xs">تم ترحيل هذا المرتجع بنجاح للمورد أحمد</h5>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          الشحنة حالياً في عهدة السائق <span className="text-white font-bold">{selectedInvoice.cascadedDeliveryAgentName}</span>. بانتظار الفحص الفني للتاجر أحمد لإجراء الاستقطاع المالي التلقائي من كشف الحساب المشترك.
                        </p>
                      </div>
                    )}

                  </div>
                )
              ) : (
                <div className="text-center py-24 text-gray-500 text-xs font-bold bg-white/[0.01] border border-white/5 p-6 rounded-2xl">
                  👈 يرجى تحديد فاتورة مرتجع من القائمة الجانبية لبدء فحص تجربة وتوطين البنود.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ===================== SUB-TAB 3: COMPLETED HISTORY ===================== */}
      {activeSubTab === 'history' && (
        <div className="card-glass p-6 text-right rounded-3xl border border-white/5 bg-slate-950/20 space-y-4">
          <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2">
            <History size={16} className="text-[#cf8a3c]" />
            سجل العمليات المكتملة والموطنة بنجاح بالدفاتر
          </h3>

          {finalizedReturns.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-xs font-bold">
              لا توجد مطابقات أو فواتير مرتجعة مقفلة سابقاً في الأرشيف.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 font-bold">
                    <th className="pb-3 pl-2">معرف الفاتورة</th>
                    <th className="pb-3 pl-2">العميل المسترجع</th>
                    <th className="pb-3 pl-2">السيناريو المعاملاتي</th>
                    <th className="pb-3 pl-2 text-center">عدد البنود</th>
                    <th className="pb-3 pl-2 text-left">التاريخ المغلق</th>
                    <th className="pb-3 text-left">الحالة النهائية للتسوية</th>
                  </tr>
                </thead>
                <tbody>
                  {finalizedReturns.map(r => (
                    <tr key={r.id} className="border-b border-white/[0.02]">
                      <td className="py-3 font-mono text-[10px] text-gray-400">#{r.id?.substring(0,8)}</td>
                      <td className="py-3 font-bold text-white">{r.customerName}</td>
                      <td className="py-3 font-bold text-amber-500">
                        {r.scenario === 'face_to_face' ? '🤝 وجه لوجه' : `🚚 توصيل (${r.deliveryAgentName})`}
                      </td>
                      <td className="py-3 text-center text-slate-300">{r.items.length} بنود</td>
                      <td className="py-3 text-left text-gray-500">
                        {r.updatedAt ? new Date(r.updatedAt.seconds * 1000).toLocaleDateString('ar-YE') : '---'}
                      </td>
                      <td className="py-3 text-left">
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-green-500/10 text-green-400">
                          تم التدقيق والتسوية النهائية ✓
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 🚚 REVERSE LOGISTICS CASCADING CONFIGURATION MODAL */}
      <AnimatePresence>
        {showCascadeModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-right" dir="rtl">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <button 
                  onClick={() => setShowCascadeModal(false)}
                  className="text-gray-500 hover:text-white font-bold bg-transparent border-none cursor-pointer text-lg"
                >
                  ✕
                </button>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Truck size={18} className="text-[#cf8a3c]" />
                  نافذة ترحيل المرتجع اللوجستي العكسي 🚚
                </h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-[11px] text-amber-300 leading-relaxed">
                  ⚠️ سيتم تعبئة تفاصيل المرتجع وإسناده فوراً لـ <strong>"بوابة عامل التوصيل والسائق"</strong>. ستتغير حالة المرتجع إلى <strong>"بضاعة مرتجعة بالطريق"</strong> وتُحجز في عهدة السائق حتى يؤكد وصولها للمورد.
                </div>

                {/* 1. Wholesaler selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-gray-400 font-bold block">التاجر المصدر / المورد المستلم *</label>
                  <select
                    value={cascadeTargetSupplierId}
                    onChange={(e) => {
                      setCascadeTargetSupplierId(e.target.value);
                      if (e.target.value === 'merchant_ahmed_id') {
                        setCascadeTargetSupplierName('التاجر أحمد (المورد الرئيسي)');
                      } else {
                        const conn = b2bConnections.find(c => c.id === e.target.value);
                        setCascadeTargetSupplierName(conn?.supplierName || 'المورد الشريك');
                      }
                    }}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="merchant_ahmed_id">التاجر أحمد (المورد والموزع الرئيسي الافتراضي)</option>
                    {b2bConnections.map(conn => (
                      <option key={conn.id} value={conn.id}>{conn.supplierName || 'مورد شريك'}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Driver selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-gray-400 font-bold block">تحديد عامل التوصيل والسائق *</label>
                  <select
                    value={cascadeSelectedDriverId}
                    onChange={(e) => {
                      setCascadeSelectedDriverId(e.target.value);
                      const agent = deliveryAgents.find(a => a.id === e.target.value);
                      setCascadeSelectedDriverName(agent?.name || 'أحمد اللوجستي (سائق عام)');
                    }}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="delivery_agent_ahmed_id">أحمد اللوجستي (سائق عام - افتراضي)</option>
                    {deliveryAgents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name} (سائق توصيل معتمد)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCascadeModal(false)}
                  className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-gray-400 hover:text-white rounded-xl text-xs font-bold border-none cursor-pointer"
                >
                  إلغاء الترحيل
                </button>
                <button
                  type="button"
                  onClick={() => handleCascadeReturn(cascadeTargetSupplierId, cascadeTargetSupplierName, cascadeSelectedDriverId, cascadeSelectedDriverName)}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black border-none cursor-pointer shadow-lg shadow-indigo-600/10 flex items-center gap-1.5"
                >
                  {isProcessing ? 'جاري ترحيل الشحنة...' : 'تأكيد الترحيل وإرسال المرتجع 🚀'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== FINANCIAL SETTLEMENT MODAL (4 ROUTES) ===================== */}
      <AnimatePresence>
        {showSettlementModal && settlementInvoice && (() => {
          const intactTotal = settlementInvoice.items.filter(it => it.status === 'جاهز/سليم').reduce((sum, it) => sum + (it.price * it.quantity), 0);
          const damagedTotal = settlementInvoice.items.filter(it => it.status === 'تالف').reduce((sum, it) => sum + (it.price * it.quantity), 0);
          const totalRefund = intactTotal + damagedTotal;

          // Check transaction lock (is the confirm button locked?)
          let isLocked = true;
          if (selectedRoute === 'A') {
            isLocked = !selectedBoxId;
          } else if (selectedRoute === 'B') {
            isLocked = !selectedCustomerId;
          } else if (selectedRoute === 'C') {
            isLocked = !replacementNotes.trim();
          } else if (selectedRoute === 'D') {
            isLocked = !voucherCode.trim();
          }

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-right"
              >
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-white/5 flex items-center justify-between">
                  <button 
                    onClick={() => setShowSettlementModal(false)}
                    className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
                  >
                    <XCircle size={20} />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">بوابة تسوية المرتجعات المالية والمطابقة</h3>
                      <p className="text-[10px] text-indigo-300 font-bold mt-0.5">JAM System Pro — Return Ledger Router v3</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  {/* Summary row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 flex flex-col justify-between">
                      <span className="text-[10px] text-gray-400 font-bold">العميل وصاحب الفاتورة</span>
                      <span className="text-xs text-white font-black mt-2">{settlementInvoice.customerName}</span>
                      <span className="text-[9px] text-gray-500 font-mono mt-1">{settlementInvoice.customerPhone || 'بدون رقم هاتف'}</span>
                    </div>
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 flex flex-col justify-between">
                      <span className="text-[10px] text-gray-400 font-bold">ملخص البنود المسترجعة</span>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-black text-green-400">{settlementInvoice.items.filter(it => it.status === 'جاهز/سليم').length} سليمة</span>
                        <span className="text-xs font-black text-red-400">{settlementInvoice.items.filter(it => it.status === 'تالف').length} تالفة</span>
                        <span className="text-xs font-black text-rose-500">{settlementInvoice.items.filter(it => it.status === 'مرفوض ومردود للعميل').length} مرفوضة</span>
                      </div>
                    </div>
                    <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 flex flex-col justify-between">
                      <span className="text-[10px] text-indigo-300 font-bold">القيمة المالية المستحقة للتوطين</span>
                      <span className="text-lg text-emerald-400 font-black mt-1">
                        {totalRefund.toLocaleString()} <span className="text-[10px] font-normal">ر.ي</span>
                      </span>
                    </div>
                  </div>

                  {/* The 4 Pathways Selector */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-300 block">حدد أحد مسارات التسوية المحاسبية الأربعة (4 Pathways) *</label>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      
                      {/* Route A: Cash Refund */}
                      <button
                        type="button"
                        onClick={() => setSelectedRoute('A')}
                        className={`p-4 rounded-2xl text-right border transition-all cursor-pointer flex flex-col justify-between ${
                          selectedRoute === 'A' 
                            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                            : 'bg-slate-950/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`p-2 rounded-xl ${selectedRoute === 'A' ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-gray-400'}`}>
                            <DollarSign size={15} />
                          </div>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">مسار (أ)</span>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-xs font-black text-white">استرجاع نقدي</h4>
                          <p className="text-[9px] text-gray-400 mt-1">خصم وصرف فوري للمبلغ من رصيد الصندوق أو الخزنة للمحل.</p>
                        </div>
                      </button>

                      {/* Route B: Debt Deduction */}
                      <button
                        type="button"
                        onClick={() => setSelectedRoute('B')}
                        className={`p-4 rounded-2xl text-right border transition-all cursor-pointer flex flex-col justify-between ${
                          selectedRoute === 'B' 
                            ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                            : 'bg-slate-950/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`p-2 rounded-xl ${selectedRoute === 'B' ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400'}`}>
                            <Users size={15} />
                          </div>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">مسار (ب)</span>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-xs font-black text-white">خصم من الدين</h4>
                          <p className="text-[9px] text-gray-400 mt-1">تنزيل قيمة المرتجع من حساب مديونية العميل النشطة بالدفاتر.</p>
                        </div>
                      </button>

                      {/* Route C: Item Replacement */}
                      <button
                        type="button"
                        onClick={() => setSelectedRoute('C')}
                        className={`p-4 rounded-2xl text-right border transition-all cursor-pointer flex flex-col justify-between ${
                          selectedRoute === 'C' 
                            ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                            : 'bg-slate-950/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`p-2 rounded-xl ${selectedRoute === 'C' ? 'bg-amber-500 text-slate-950' : 'bg-white/5 text-gray-400'}`}>
                            <RotateCcw size={15} />
                          </div>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">مسار (ج)</span>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-xs font-black text-white">استبدال سلعي</h4>
                          <p className="text-[9px] text-gray-400 mt-1">صرف قطعة بديلة مماثلة من المستودع وتصفير التدفق المالي.</p>
                        </div>
                      </button>

                      {/* Route D: Open New Invoice Voucher */}
                      <button
                        type="button"
                        onClick={() => setSelectedRoute('D')}
                        className={`p-4 rounded-2xl text-right border transition-all cursor-pointer flex flex-col justify-between ${
                          selectedRoute === 'D' 
                            ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
                            : 'bg-slate-950/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`p-2 rounded-xl ${selectedRoute === 'D' ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-400'}`}>
                            <Sparkles size={15} />
                          </div>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">مسار (د)</span>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-xs font-black text-white">قسيمة مبيعات</h4>
                          <p className="text-[9px] text-gray-400 mt-1">توليد كوبون رصيد معلق يستعمل كخصم لاحقاً في شاشة الكاشير.</p>
                        </div>
                      </button>

                    </div>
                  </div>

                  {/* Dynamic Parameter inputs with active lockouts */}
                  <div className="p-5 bg-slate-950/60 rounded-2xl border border-white/5 space-y-4">
                    <h5 className="text-xs font-black text-white border-b border-white/5 pb-2">تفاصيل وبيانات الحركة المالية المكملة</h5>
                    
                    {!selectedRoute ? (
                      <div className="text-center py-6 text-gray-500 text-xs font-bold">
                        👈 يرجى النقر على أحد مسارات التسوية الأربعة بالأعلى لعرض خيارات التوطين المطلوبة.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        
                        {/* Route A Configuration */}
                        {selectedRoute === 'A' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-rose-500 font-bold">حقل مطلوب بقفل محاسبي *</span>
                              <label className="text-xs text-gray-300 font-bold">تحديد الصندوق أو الخزنة لمبلغ الارتجاع</label>
                            </div>
                            <select
                              value={selectedBoxId}
                              onChange={(e) => setSelectedBoxId(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            >
                              <option value="">-- اختر الصندوق المالي لخصم القيد منه --</option>
                              {customBoxes.map(box => (
                                <option key={box.id} value={box.id}>
                                  {box.name} (الرصيد الحالي: {Number(box.balance || 0).toLocaleString()} ر.ي)
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                              ⚠️ سيتم ترحيل قيد مزدوج مدين لحساب المرتجعات، ودائن لحساب صندوق [ {customBoxes.find(b => b.id === selectedBoxId)?.name || '...'} ].
                            </p>
                          </div>
                        )}

                        {/* Route B Configuration */}
                        {selectedRoute === 'B' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-rose-500 font-bold">حقل مطلوب بقفل محاسبي *</span>
                              <label className="text-xs text-gray-300 font-bold">تحديد حساب العميل المدين في النظام لتخفيض مديونيته</label>
                            </div>
                            <select
                              value={selectedCustomerId}
                              onChange={(e) => setSelectedCustomerId(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                            >
                              <option value="">-- اختر حساب مديونية العميل من كشوفات المحل --</option>
                              {customers.map(cust => (
                                <option key={cust.id} value={cust.id}>
                                  {cust.name} (المديونية الحالية: {Number(cust.debt || 0).toLocaleString()} ر.ي) - {cust.phone || 'بدون رقم'}
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                              ⚠️ سيقوم النظام بإجراء قيد تسوية دائن لحساب العميل [ {customers.find(c => c.id === selectedCustomerId)?.name || '...'} ] بقيمة {totalRefund.toLocaleString()} ر.ي مما يقلص ذمته المدينة.
                            </p>
                          </div>
                        )}

                        {/* Route C Configuration */}
                        {selectedRoute === 'C' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-rose-500 font-bold">حقل مطلوب بقفل محاسبي *</span>
                              <label className="text-xs text-gray-300 font-bold">بيان وتفاصيل الصنف البديل المسلّم للعميل</label>
                            </div>
                            <textarea
                              rows={2}
                              value={replacementNotes}
                              onChange={(e) => setReplacementNotes(e.target.value)}
                              placeholder="اكتب اسم الصنف والمواصفات والرقم التسلسلي للقطعة البديلة المسلمة للعميل فوراً..."
                              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 placeholder:text-gray-500"
                            />
                            <p className="text-[10px] text-gray-400 leading-relaxed">
                              ⚠️ يضمن هذا الخيار سحب القطعة الجديدة من الرفوف وتصفير الحركة النقدية لحماية الحسابات من الفروقات السلعية والمالية.
                            </p>
                          </div>
                        )}

                        {/* Route D Configuration */}
                        {selectedRoute === 'D' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-rose-500 font-bold">حقل مطلوب بقفل محاسبي *</span>
                              <label className="text-xs text-gray-300 font-bold">رمز كوبون الخصم الشرائي المرتجع</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setVoucherCode('RET-' + Math.random().toString(36).substring(2, 8).toUpperCase())}
                                className="px-4 py-2 bg-purple-600 text-white text-xs font-black rounded-xl hover:bg-purple-700 transition-colors border-none cursor-pointer"
                              >
                                توليد كود جديد
                              </button>
                              <input
                                type="text"
                                value={voucherCode}
                                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                                className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold text-left focus:outline-none focus:border-purple-500"
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">
                              ⚠️ سيقوم النظام بتسجيل قسيمة خصم رصيد بقيمة {totalRefund.toLocaleString()} ر.ي صالحة للاستهلاك الفوري في أي فاتورة مبيعات جديدة للعميل.
                            </p>
                          </div>
                        )}

                      </div>
                    )}
                  </div>

                  {/* Transaction Safety Lock Indicator */}
                  <div className={`p-4 rounded-2xl flex items-center gap-3 transition-colors ${
                    isLocked ? 'bg-red-500/5 border border-red-500/10' : 'bg-emerald-500/5 border border-emerald-500/10'
                  }`}>
                    <div className={`p-2 rounded-xl ${isLocked ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      <AlertTriangle size={16} />
                    </div>
                    <div className="flex-1">
                      <h6 className={`text-[11px] font-black ${isLocked ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isLocked ? 'قفل الأمان المحاسبي مفعل (Transaction Lock)' : 'جاهز للتوطين — قفل الأمان مفكوك'}
                      </h6>
                      <p className="text-[9px] text-gray-400 mt-0.5">
                        {isLocked 
                          ? 'يمنع النظام ترحيل أي حركات مالية قبل تحديد الوجهة الدقيقة للحركة المالية لضمان سلامة ميزان المراجعة المزدوج.' 
                          : 'تم استيفاء كافة متطلبات السلامة المالية المحاسبية. يمكنك المضي في ترحيل القيد وإقفال الدورة بنجاح.'}
                      </p>
                    </div>
                  </div>

                </div>

                {/* Footer buttons */}
                <div className="p-6 bg-slate-950/40 border-t border-white/5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowSettlementModal(false)}
                    className="px-5 py-2.5 bg-white/5 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
                  >
                    إلغاء التوطين والتراجع
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSettlement}
                    disabled={isProcessing || isLocked}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-none"
                  >
                    <ClipboardCheck size={14} />
                    ترحيل القيد وإغلاق دورة المرتجع 📥
                  </button>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
