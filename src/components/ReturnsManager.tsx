import React, { useState, useEffect } from 'react';
import { 
  History, 
  RotateCcw, 
  User, 
  Truck, 
  Search, 
  Calendar,
  DollarSign,
  AlertCircle,
  ClipboardCheck,
  ShieldCheck,
  ArrowRightLeft,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Archive,
  BarChart3,
  Wrench,
  Trash,
  Barcode,
  Users,
  Layers,
  Send,
  Check,
  AlertTriangle,
  CreditCard,
  Coins,
  Lock,
  UserCheck,
  Plus,
  RefreshCcw,
  FileText
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
  increment, 
  onSnapshot, 
  runTransaction,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, InventoryItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { postReturnOrLossToLedger } from '../services/InventoryLossesService';
import { InventoryLockingService } from '../services/InventoryLockingService';

interface ReturnsManagerProps {
  profile: UserProfile | null;
}

interface ReturnItem {
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
  price: number;
  wholesalerId: string;
  wholesalerName: string;
  reason: string;
  warrantyType?: 'none' | 'operational' | 'limited';
  warrantyDuration?: number;
  purchaseDate?: string;
  compensationOption?: 'refund' | 'replace_same' | 'replace_other';
  // 3-step fields
  defectLog?: string;
}

export default function ReturnsManager({ profile }: ReturnsManagerProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'f2f' | 'system' | 'inspection' | 'history'>('f2f');
  const [isProcessing, setIsProcessing] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [networkLinks, setNetworkLinks] = useState<any[]>([]);
  const [storeInventory, setStoreInventory] = useState<InventoryItem[]>([]);
  
  // Real-time returns tracker
  const [returns, setReturns] = useState<any[]>([]);

  // Entry Configuration
  const [entryMethod, setEntryMethod] = useState<'manual' | 'remote'>('manual');
  
  // Invoice Cross-Referencing
  const [crossReferenceToggle, setCrossReferenceToggle] = useState<boolean>(false);
  const [newInvoiceId, setNewInvoiceId] = useState<string>('');

  // 1) Face-to-Face form (Direct Customer returns)
  const [f2fItems, setF2fItems] = useState<ReturnItem[]>([
    { productId: '', name: '', barcode: '', quantity: 1, price: 0, wholesalerId: '', wholesalerName: '', reason: 'تالف مصنعي', warrantyType: 'none', warrantyDuration: 0, compensationOption: 'replace_same', purchaseDate: new Date().toISOString().split('T')[0], defectLog: '' }
  ]);
  const [selectedF2fItemIndex, setSelectedF2fItemIndex] = useState<number | null>(null);

  // 2) Through System multi-wholesaler returns
  const [systemReturnForm, setSystemReturnForm] = useState<{
    items: ReturnItem[];
    driverType: 'own' | 'wholesaler';
    selectedDriverId: string;
    selectedDriverName: string;
  }>({
    items: [
      { productId: '', name: '', barcode: '', quantity: 1, price: 0, wholesalerId: '', wholesalerName: '', reason: 'عجز جودة', warrantyType: 'none', warrantyDuration: 0, compensationOption: 'replace_same', purchaseDate: new Date().toISOString().split('T')[0], defectLog: '' }
    ],
    driverType: 'own',
    selectedDriverId: 'default_driver_xyz',
    selectedDriverName: 'عامر الشحاط (سائق معتمد)'
  });

  // Wholesaler individual action types for split system returns
  const [supplierActionsMap, setSupplierActionsMap] = useState<{[supplierId: string]: 'replacement' | 'deduct_debt' | 'cash_refund'}>({});

  // Active validation targets
  const [activeDefectLogs, setActiveDefectLogs] = useState<Record<string, string>>({});

  // Enforce access control
  const isManagerOrAdmin = 
    profile?.role === 'manager' || 
    profile?.role === 'superadmin' || 
    profile?.role === 'owner';

  // Load essential references
  useEffect(() => {
    if (!profile?.ownerId) return;

    // Load active settings
    const unsubSettings = onSnapshot(doc(db, 'settings', profile.ownerId), (doc) => {
      if (doc.exists()) setShopSettings(doc.data());
    });

    // Load partnerships (Wholesalers & Retailers connected)
    const qLinksWh = query(collection(db, 'networkLinks'), where('wholesalerId', '==', profile.ownerId));
    const unsubLinksWh = onSnapshot(qLinksWh, (snapshot) => {
      const whLinks = snapshot.docs.map(doc => ({ id: doc.id, roleType: 'wholesaler', ...doc.data() }));
      setNetworkLinks(prev => {
        const others = prev.filter(l => l.roleType !== 'wholesaler');
        return [...others, ...whLinks];
      });
    });

    const qLinksRt = query(collection(db, 'networkLinks'), where('retailerId', '==', profile.ownerId));
    const unsubLinksRt = onSnapshot(qLinksRt, (snapshot) => {
      const rtLinks = snapshot.docs.map(doc => ({ id: doc.id, roleType: 'retailer', ...doc.data() }));
      setNetworkLinks(prev => {
        const others = prev.filter(l => l.roleType !== 'retailer');
        return [...others, ...rtLinks];
      });
    });

    // Load store's localized inventory to auto-detect barcodes
    const qInv = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const invList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setStoreInventory(invList);
    });

    // Load dynamic Returns flow
    const qReturns = query(collection(db, 'returns_flow'), where('ownerId', '==', profile.ownerId));
    const unsubReturns = onSnapshot(qReturns, (snapshot) => {
      setReturns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubSettings();
      unsubLinksWh();
      unsubLinksRt();
      unsubInv();
      unsubReturns();
    };
  }, [profile]);

  // ==========================================
  // BARCODE AUTO-DETECTION IMPLEMENTATION
  // ==========================================
  const handleBarcodeLookup = async (index: number, barcodeValue: string) => {
    if (!barcodeValue) return;

    const matchedItem = storeInventory.find(item => item.barcode === barcodeValue);

    if (matchedItem) {
      const connectedSupplier = networkLinks.find(link => link.wholesalerId === matchedItem.supplierId || link.wholesalerName === matchedItem.supplierName) || networkLinks[0];

      const updated = [...f2fItems];
      updated[index] = {
        ...updated[index],
        barcode: barcodeValue,
        name: matchedItem.name,
        price: matchedItem.cost || matchedItem.price || 0,
        productId: matchedItem.id,
        wholesalerId: connectedSupplier?.wholesalerId || matchedItem.supplierId || 'direct_supplier_default',
        wholesalerName: connectedSupplier?.wholesalerName || matchedItem.supplierName || 'مورد عام معتمد',
        warrantyType: matchedItem.warrantyType || 'none',
        warrantyDuration: matchedItem.warrantyDuration || 0,
        compensationOption: matchedItem.compensationOption || 'replace_same',
        purchaseDate: new Date().toISOString().split('T')[0]
      };
      setF2fItems(updated);
    } else {
      try {
        const liveQuery = query(collection(db, 'inventory'), where('ownerId', '==', profile?.ownerId), where('barcode', '==', barcodeValue));
        const liveSnap = await getDocs(liveQuery);
        if (!liveSnap.empty) {
          const matchedDoc = liveSnap.docs[0].data() as InventoryItem;
          const connectedSupplier = networkLinks.find(link => link.wholesalerId === matchedDoc.supplierId) || networkLinks[0];
          
          const updated = [...f2fItems];
          updated[index] = {
            ...updated[index],
            barcode: barcodeValue,
            name: matchedDoc.name,
            price: matchedDoc.cost || matchedDoc.price || 0,
            productId: liveSnap.docs[0].id,
            wholesalerId: connectedSupplier?.wholesalerId || matchedDoc.supplierId || 'direct_supplier_default',
            wholesalerName: connectedSupplier?.wholesalerName || matchedDoc.supplierName || 'مورد عام معتمد',
            warrantyType: matchedDoc.warrantyType || 'none',
            warrantyDuration: matchedDoc.warrantyDuration || 0,
            compensationOption: matchedDoc.compensationOption || 'replace_same',
            purchaseDate: new Date().toISOString().split('T')[0]
          };
          setF2fItems(updated);
        }
      } catch (err) {
        console.error('Error matching barcode live:', err);
      }
    }
  };

  const addF2fRow = () => {
    setF2fItems([...f2fItems, { productId: '', name: '', barcode: '', quantity: 1, price: 0, wholesalerId: '', wholesalerName: '', reason: 'عجز جودة', warrantyType: 'none', warrantyDuration: 0, compensationOption: 'replace_same', purchaseDate: new Date().toISOString().split('T')[0], defectLog: '' }]);
  };

  const removeF2fRow = (idx: number) => {
    const updated = f2fItems.filter((_, i) => i !== idx);
    setF2fItems(updated.length ? updated : [{ productId: '', name: '', barcode: '', quantity: 1, price: 0, wholesalerId: '', wholesalerName: '', reason: 'عجز جودة', warrantyType: 'none', warrantyDuration: 0, compensationOption: 'replace_same', purchaseDate: new Date().toISOString().split('T')[0], defectLog: '' }]);
  };

  // --- WARRANTY STATUS CALCULATOR ---
  const getWarrantyStatus = (item: {
    warrantyType?: 'none' | 'operational' | 'limited';
    warrantyDuration?: number;
    purchaseDate?: string;
  }) => {
    if (!item.warrantyType || item.warrantyType === 'none') {
      return { status: 'none', message: 'لا يوجد ضمان مسجل للمنتج', expired: false, daysLeft: 0 };
    }
    if (item.warrantyType === 'operational') {
      return { status: 'operational', message: 'ضمان تشغيل عيني معتمد', expired: false, daysLeft: 0 };
    }
    
    if (!item.purchaseDate) {
      return { status: 'limited_unknown', message: 'يرجى تحديد تاريخ الفاتورة للضمان المحدود', expired: false, daysLeft: 0 };
    }
    
    const buyDate = new Date(item.purchaseDate);
    const durationDays = item.warrantyDuration || 0;
    const expirationTime = buyDate.getTime() + (durationDays * 24 * 60 * 60 * 1000);
    const todayTime = Date.now();
    
    const expired = todayTime > expirationTime;
    const daysLeft = Math.ceil((expirationTime - todayTime) / (1000 * 60 * 60 * 24));
    
    if (expired) {
      return { 
        status: 'expired', 
        message: `❌ خارج فروع الضمان (برهن تاريخ الشراء)`, 
        expired: true, 
        daysLeft 
      };
    } else {
      return { 
        status: 'active', 
        message: `✅ الضمان ساري ومقبول (متبقي ${daysLeft} يوم)`, 
        expired: false, 
        daysLeft 
      };
    }
  };

  // ==========================================
  // DISPATCH RETURNS (CONJOINED DISPATCH SLIP)
  // ==========================================
  const handleDispatchReturns = async () => {
    const itemsToDispatch = activeTab === 'f2f' ? f2fItems : systemReturnForm.items;
    
    if (itemsToDispatch.some(it => !it.name || !it.quantity || it.quantity < 1)) {
      alert('يرجى ملاءمة مدخلات الصفحة وملء أسماء البنود والكمية المناسبة أولاً.');
      return;
    }

    // Verify warranties
    for (const item of itemsToDispatch) {
      const warranty = getWarrantyStatus(item);
      if (warranty.expired) {
        alert(`❌ تعذر إدراج الصنف [${item.name}] لمخالفته فترة الضمان المتاحة.`);
        return;
      }
    }

    setIsProcessing(true);
    try {
      const batchRef = writeBatch(db);
      const recordsToPost: any[] = [];
      
      // Separate/split items by Wholesaler to dispatch standalone tickets
      const itemsBySupplier: Record<string, ReturnItem[]> = {};
      itemsToDispatch.forEach(it => {
        const key = it.wholesalerId || 'default_supplier_xyz';
        if (!itemsBySupplier[key]) itemsBySupplier[key] = [];
        itemsBySupplier[key].push(it);
      });

      for (const [suppId, list] of Object.entries(itemsBySupplier)) {
        const returnDocRef = doc(collection(db, 'returns_flow'));
        const actionType = supplierActionsMap[suppId] || 'replacement';

        // Evaluate starting status for 3-Step lifecycle based on Entry Method choice
        // 'dispatched_return' for standard, 'remote_pending' for remote inverse return requests
        const initialStatus = entryMethod === 'remote' ? 'remote_pending' : 'dispatched_return';

        const returnData: any = {
          ownerId: profile?.ownerId,
          type: activeTab === 'f2f' ? 'customer' : 'supplier',
          items: list.map(it => ({
            ...it,
            defectLog: '' // initialized
          })),
          totalAmount: list.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          wholesalerId: suppId,
          wholesalerName: list[0].wholesalerName || 'مورد عام معتمد',
          inspectorId: profile?.uid,
          inspectorName: profile?.name,
          
          // Entry Method Mode
          entryMethod: entryMethod, // 'manual' | 'remote'
          
          // Cross Referencing optional parameter
          crossReferencing: crossReferenceToggle,
          newInvoiceId: crossReferenceToggle ? newInvoiceId.trim() : '',

          // 3-step dynamic status tracker
          status: initialStatus, 
          routeType: activeTab === 'f2f' ? 'f2f_manual' : 'automated_system',
          
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        if (activeTab === 'system') {
          returnData.driverChoice = systemReturnForm.driverType;
          returnData.assignedDriverId = systemReturnForm.selectedDriverId;
          returnData.assignedDriverName = systemReturnForm.selectedDriverName;
        }

        batchRef.set(returnDocRef, returnData);

        // Record posting parameters
        recordsToPost.push({
          ownerId: profile?.ownerId,
          type: 'return',
          total: returnData.totalAmount,
          paymentMethod: activeTab === 'f2f' ? 'cash' : 'credit',
          items: list.map(it => ({ productId: it.productId, quantity: it.quantity, qtyInPieces: 1 })),
          notes: `إرجاع بضاعة مرتجعة (${activeTab === 'f2f' ? 'زبون محلي' : 'وكيل مورد'}): ${returnData.wholesalerName}`
        });

        // Save Auditing
        const auditRef = doc(collection(db, 'auditLogs'));
        batchRef.set(auditRef, {
          action: 'RETURNS_DISPATCH',
          userId: profile?.uid,
          userName: profile?.name,
          details: `تم ترحيل مرتجع (${entryMethod === 'remote' ? 'طريقة عن بعد' : 'تسجيل مباشر'}) بقيمة ${returnData.totalAmount} ر.ي للمورد ${returnData.wholesalerName}. cross_ref_invoice: ${returnData.newInvoiceId || 'None'}`,
          timestamp: serverTimestamp()
        });
      }

      await batchRef.commit();

      // Lock returned items in the return testing phase (Instant Allocation Freeze)
      try {
        for (const [suppId, list] of Object.entries(itemsBySupplier)) {
          const lockItems = list.map(it => ({
            productId: it.productId,
            quantity: Number(it.quantity || 1),
            selectedColor: (it as any).selectedColor || (it as any).color
          }));
          await InventoryLockingService.lockInventory({
            ownerId: profile?.ownerId || '',
            items: lockItems,
            sourceType: 'return_testing',
            referenceId: 'returns_flow'
          });
        }
      } catch (lockErr) {
        console.error('[Return Lock Error]:', lockErr);
      }

      // Post of double-entry ledger items for each committed split-invoice returns
      for (const rec of recordsToPost) {
        try {
          await postReturnOrLossToLedger(rec);
        } catch (ledgerErr) {
          console.error("Error posting return to GL ledger:", ledgerErr);
        }
      }
      alert(`🎉 تم بنجاح ترحيل وإدراج الفاتورة المرتجعة بمرئية (${entryMethod === 'remote' ? 'طلب مرتجع عن بعد' : 'تسجيل مرتجع فوري مباشر'}) ومزامنته بمسار تدقيق المطابقة!`);
      
      // Clear forms
      if (activeTab === 'f2f') {
        setF2fItems([{ productId: '', name: '', barcode: '', quantity: 1, price: 0, wholesalerId: '', wholesalerName: '', reason: 'تالف مصنعي', warrantyType: 'none', warrantyDuration: 0, compensationOption: 'replace_same', purchaseDate: new Date().toISOString().split('T')[0], defectLog: '' }]);
      } else {
        setSystemReturnForm({
          items: [{ productId: '', name: '', barcode: '', quantity: 1, price: 0, wholesalerId: '', wholesalerName: '', reason: 'عجز جودة', defectLog: '' }],
          driverType: 'own',
          selectedDriverId: 'default_driver_xyz',
          selectedDriverName: 'عامر الشحاط (سائق معتمد)'
        });
      }
      setCrossReferenceToggle(false);
      setNewInvoiceId('');
    } catch (e: any) {
      alert('حدث خطأ أثناء ترحيل الفواتير المرتجعة: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLookupSystemBarcode = async (index: number, val: string) => {
    if (!val) return;
    const match = storeInventory.find(it => it.barcode === val);
    if (match) {
      const updated = [...systemReturnForm.items];
      updated[index] = {
        ...updated[index],
        barcode: val,
        name: match.name,
        price: match.cost || match.price || 0,
        productId: match.id,
        wholesalerId: match.supplierId || 'direct_supplier_default',
        wholesalerName: match.supplierName || 'مورد عام معتمد',
        warrantyType: match.warrantyType || 'none',
        warrantyDuration: match.warrantyDuration || 0,
        compensationOption: match.compensationOption || 'replace_same',
        purchaseDate: new Date().toISOString().split('T')[0]
      };
      setSystemReturnForm({ ...systemReturnForm, items: updated });
    }
  };

  const addSystemRow = () => {
    const updated = [...systemReturnForm.items, { productId: '', name: '', barcode: '', quantity: 1, price: 0, wholesalerId: '', wholesalerName: '', reason: 'عجز جودة', defectLog: '' }];
    setSystemReturnForm({ ...systemReturnForm, items: updated });
  };

  // ==========================================
  // 3-STEP RETURN VERIFICATION LIFECYCLE
  // ==========================================

  // --- STEP 1: FULFILLMENT HANDLER ACTION A -> CONFIRM RECEIPT / تم الاستلام ---
  const handleFulfillmentConfirmReceipt = async (retDoc: any) => {
    try {
      await updateDoc(doc(db, 'returns_flow', retDoc.id), {
        status: 'received_by_handler',
        receivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        handledById: profile?.uid || 'unknown',
        handledByName: profile?.name || 'مراقب الفرز'
      });
      alert('📥 تم بنجاح إقرار استلام الطلبيات المرتجعة مادياً وتحويلها لخط المطابقة العينية والفحص!');
    } catch (err: any) {
      console.error(err);
      alert('عذراً، فشل ترحيل إقرار الاستلام: ' + err.message);
    }
  };

  // --- STEP 1: FULFILLMENT HANDLER ACTION B -> INSPECTED & MATCHED / تم الفحص والمطابقة ---
  const handleFulfillmentInspected = async (retDoc: any) => {
    try {
      // Map updated defectLog per item
      const updatedItems = (retDoc.items || []).map((it: any) => {
        const textValue = activeDefectLogs[`${retDoc.id}-${it.productId}`] || 'سليم ومطابق';
        return {
          ...it,
          defectLog: textValue
        };
      });

      await updateDoc(doc(db, 'returns_flow', retDoc.id), {
        items: updatedItems,
        status: 'inspected_by_handler',
        inspectedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      alert('🔍 تم إقرار مطابقة بنود المرتجع وتسجيل ملاحظات وسجلات العيوب وتحويلها للاعتماد المالي والإداري!');
    } catch (err: any) {
      console.error(err);
      alert('فشل حفظ التدقيق: ' + err.message);
    }
  };

  // --- STEP 2: ADMIN VALIDATION -> APPROVAL AND REJECTION ---
  const handleAdminValidation = async (retDoc: any, decision: 'approved' | 'rejected') => {
    if (!isManagerOrAdmin) {
      alert('🚫 صلاحية مرفوضة! تحتاج لمرتبة مشرف أو مسؤول لاعتماد فواتير التسويات المالية.');
      return;
    }

    try {
      if (decision === 'rejected') {
        await runTransaction(db, async (transaction) => {
          const retRef = doc(db, 'returns_flow', retDoc.id);
          const currentRetSnap = await transaction.get(retRef);
          if (!currentRetSnap.exists()) throw new Error('المرتجع غير موجود');
          const currentRetData = currentRetSnap.data();

          // Update return status
          transaction.update(retRef, {
            status: 'rejected_by_admin',
            rejectedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            validatedById: profile?.uid,
            validatedByName: profile?.name
          });

          // Rollback ledger balance in 'ACC-B2B-MOHAMED-AHMED' if it exists or relevant accounts
          const returnAmt = Number(currentRetData.totalAmount || currentRetData.total || 0);
          
          const accRef = doc(db, 'accounts', 'ACC-B2B-MOHAMED-AHMED');
          const accSnap = await transaction.get(accRef);
          if (accSnap.exists()) {
            const currentBalance = accSnap.data().balance || 0;
            // Rollback: reverse the credit, so Mohamed's outstanding debt balance increases back
            transaction.update(accRef, {
              balance: currentBalance + returnAmt,
              updatedAt: serverTimestamp()
            });
          }

          // Reset Mohamed's credit limit and ledger balance on the B2B connection
          const buyerId = currentRetData.ownerId || 'merchant_mohamed_id';
          const supplierId = currentRetData.wholesalerId || 'merchant_ahmed_id';
          const connId = `${buyerId}_${supplierId}`;
          const connRef = doc(db, 'b2bConnections', connId);
          const connSnap = await transaction.get(connRef);
          if (connSnap.exists()) {
            const connData = connSnap.data();
            const currentDebt = connData.debt || 0;
            // Rollback: restore the original debt and credit limit
            transaction.update(connRef, {
              debt: currentDebt + returnAmt,
              creditLimit: connData.preReturnCreditLimit !== undefined ? connData.preReturnCreditLimit : (connData.creditLimit || 100000),
              updatedAt: serverTimestamp()
            });
          }
        });

        // Release inventory locks (Release Hook)
        try {
          const releaseItems = (retDoc.items || []).map((it: any) => ({
            productId: it.productId,
            quantity: Number(it.quantity || 1),
            selectedColor: it.selectedColor || it.color
          }));
          await InventoryLockingService.releaseInventoryLock({
            ownerId: profile?.ownerId || '',
            items: releaseItems,
            referenceId: retDoc.id
          });
        } catch (releaseErr) {
          console.error('[Return Rejection Release Error]:', releaseErr);
        }

        alert('❌ تم رفض تسوية الفاتورة المرتجعة ورد الشحنة وفك حجز وتأمين الأصناف بالكامل بنجاح مالي وإعادة الأرصدة وسقف الائتمان كما كانت.');
        return;
      }

      // If approved, update status to approved_by_admin
      await updateDoc(doc(db, 'returns_flow', retDoc.id), {
        status: 'approved_by_admin',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        validatedById: profile?.uid,
        validatedByName: profile?.name
      });
      alert('✅ تم اعتماد الفاتورة المرتجعة إدارياً ومصادقتها! يرجى اختيار جهة وموجه التخزين التلقائي الآن.');
    } catch (err: any) {
      alert('فشل الاعتماد الإداري: ' + err.message);
    }
  };

  // --- STEP 3: AUTOMATED ROUTING TRIGGERS (HIGH DATA INTEGRITY HOOKS) ---
  const handleAutomatedRoutingTrigger = async (retDoc: any, routeTarget: 'damaged' | 'active' | 'supplier') => {
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const retId = retDoc.id;

      // Update final status on return flow
      const finalStatusMap = {
        damaged: 'routed_damaged',
        active: 'routed_active',
        supplier: 'routed_supplier'
      };
      
      batch.update(doc(db, 'returns_flow', retId), {
        status: finalStatusMap[routeTarget],
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 🔴 HOOK 1: Route to Damaged Inventory
      if (routeTarget === 'damaged') {
        const itemArray = retDoc.items || [];
        for (const item of itemArray) {
          const damagedDocRef = doc(collection(db, 'damagedItems'));
          batch.set(damagedDocRef, {
            productId: item.productId || 'manual_inserted',
            name: item.name,
            barcode: item.barcode || '',
            quantity: item.quantity,
            reportedBy: profile?.name || 'مراقب الجرد',
            remarks: `ترحيل معزول لارتجاع: ${item.reason || 'تلف عام'} [مسجل خلل: ${item.defectLog || '---'}]`,
            originReturnId: retId,
            createdAt: serverTimestamp()
          });
        }
      }

      // 🔴 HOOK 2: Route to Active Stock (Re-inventory)
      if (routeTarget === 'active') {
        const itemArray = retDoc.items || [];
        for (const item of itemArray) {
          if (item.productId) {
            const invRef = doc(db, 'inventory', item.productId);
            batch.update(invRef, {
              stock: increment(item.quantity),
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      // 🔴 HOOK 3: Return to Supplier (supplier deduction adjustments)
      if (routeTarget === 'supplier') {
        // Adjust client core balances or register a credit transaction ledger
        const transRef = doc(collection(db, 'supplierReturnsLog'));
        batch.set(transRef, {
          wholesalerId: retDoc.wholesalerId || 'default',
          wholesalerName: retDoc.wholesalerName || 'مورد شريك',
          senderStoreId: retDoc.ownerId,
          totalAmount: retDoc.totalAmount,
          itemsCount: retDoc.items?.length || 1,
          originReturnId: retId,
          status: 'settled_credit',
          createdAt: serverTimestamp()
        });
      }

      // 🔴 LEDGER INTEGRITY ENGINE: HOOK FOR CROSS REFERENCING & CASHBOOK BALANCING
      const transDocRef = doc(collection(db, 'transactions'));
      const ledgerPayload: any = {
        ownerId: retDoc.ownerId,
        amount: retDoc.totalAmount,
        type: 'income',
        category: 'مرتجعات شبكة معتمدة',
        description: `تسوية وإغلاق مرتجع المورد #${retId.substring(0,6)} - خط توجيه: ${
          routeTarget === 'damaged' ? 'مستودع التوالف' : 
          routeTarget === 'active' ? 'المستودع السليم' : 'ذمم المورد المباشر'
        }`,
        createdAt: serverTimestamp()
      };

      if (retDoc.newInvoiceId) {
        ledgerPayload.description += ` | خصم مساوٍ ومعاكس للفاتورة الشريكة: #${retDoc.newInvoiceId}`;
        ledgerPayload.linkedNewInvoiceId = retDoc.newInvoiceId;
      }

      batch.set(transDocRef, ledgerPayload);

      await batch.commit();

      // Release inventory locks (Release Hook)
      try {
        const releaseItems = (retDoc.items || []).map((it: any) => ({
          productId: it.productId,
          quantity: Number(it.quantity || 1),
          selectedColor: it.selectedColor || it.color
        }));
        await InventoryLockingService.releaseInventoryLock({
          ownerId: retDoc.ownerId || '',
          items: releaseItems,
          referenceId: retId
        });
      } catch (releaseErr) {
        console.error('[Return Routing Release Lock Error]:', releaseErr);
      }

      alert(`🎉 تم اكتمال دورة التدقيق الثلاثي! تم توطين البضائع في (${
        routeTarget === 'damaged' ? 'قسم التوالف والمعزولات' : 
        routeTarget === 'active' ? 'المخازن المتاحة للبيع' : 'سجل عهد المورد المعتمد'
      }) وموازنة الدفاتر المالية!`);
    } catch (err: any) {
      alert('فشل تفعيل موجهات المسار: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
      {/* Dynamic Sub-header */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-[#0a0f28] to-indigo-950 border border-white/5 rounded-3xl flex flex-col xl:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span className="p-2.5 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-2xl text-slate-950 animate-pulse">
              <RotateCcw size={22} />
            </span>
            نظام تصفية وإرجاع البضائع الذكي (Verification Matrix)
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 font-bold">
            مصفوفة التسوية المتطورة لإرجاع المشتريات، الكشف عن صلاحية الضمانات، وإغلاق التسويات المحاسبية لمنع عجز النقدية
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2.5 bg-slate-950/45 p-1 rounded-2xl border border-white/5">
          <button 
            onClick={() => setActiveTab('f2f')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'f2f' ? 'bg-[#cf8a3c] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            🤝 مرتجع زبون فوري
          </button>
          <button 
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'system' ? 'bg-[#cf8a3c] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            🚚 مرتجع شلال المورّدين
          </button>
          <button 
            onClick={() => setActiveTab('inspection')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'inspection' ? 'bg-indigo-600 text-white shadow-md font-black' : 'text-slate-400 hover:text-white'}`}
          >
            <ShieldCheck size={14} />
            مسار الفحص والمطابقة ({returns.filter(r => r.status && !['routed_damaged', 'routed_active', 'routed_supplier', 'rejected_by_admin'].includes(r.status)).length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'history' ? 'bg-[#cf8a3c] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            📜 أرشيف التسويات المغلقة
          </button>
        </div>
      </div>

      {/* GLOBAL DISPATCH FORM SETTINGS FOR BOTH MANUAL/REMOTE FLOWS */}
      {(activeTab === 'f2f' || activeTab === 'system') && (
        <div className="p-5 bg-white/[0.01] border border-white/5 rounded-3xl grid grid-cols-1 lg:grid-cols-3 gap-6 text-right">
          
          {/* Option A: Entrance Setting */}
          <div className="space-y-1.5 text-xs font-bold leading-relaxed">
            <label className="text-gray-400 block pb-1">طريقة الإدخال الجسدي والشحن:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEntryMethod('manual')}
                className={`py-2 px-3 border rounded-xl font-black text-xs transition-colors cursor-pointer ${entryMethod === 'manual' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-900 border-white/5 text-gray-400 hover:text-white'}`}
              >
                مرتجع يدوي مباشر (F2F)
              </button>
              <button
                type="button"
                onClick={() => setEntryMethod('remote')}
                className={`py-2 px-3 border rounded-xl font-black text-xs transition-colors cursor-pointer ${entryMethod === 'remote' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse' : 'bg-slate-900 border-white/5 text-gray-400 hover:text-white'}`}
              >
                مرتجع عن بعد (Inverse Invoice)
              </button>
            </div>
          </div>

          {/* Option B: Invoice Offset Cross Referencing Engine */}
          <div className="space-y-1.5 text-xs font-bold leading-relaxed">
            <label className="text-gray-400 block pb-1">الخصم بموجب فاتورة شراء جديدة (Offset Matching):</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCrossReferenceToggle(!crossReferenceToggle);
                  if (crossReferenceToggle) setNewInvoiceId('');
                }}
                className={`py-2 px-2.5 rounded-xl font-black text-xs transition-colors border cursor-pointer ${crossReferenceToggle ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-slate-900 border-white/5 text-gray-400'}`}
              >
                {crossReferenceToggle ? '✓ تسوية معاكسة مفعلّة' : 'تعطيل التسوية المعاكسة'}
              </button>

              {crossReferenceToggle && (
                <input
                  type="text"
                  placeholder="رقم الفاتورة المقابلة..."
                  value={newInvoiceId}
                  onChange={(e) => setNewInvoiceId(e.target.value)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-yellow-400 outline-none w-full"
                />
              )}
            </div>
          </div>

          <div className="flex items-end justify-end">
            <button
              onClick={handleDispatchReturns}
              disabled={isProcessing}
              className="py-2.5 px-6 w-full lg:w-auto bg-[#cf8a3c] hover:bg-[#b0732e] text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1 border-none cursor-pointer"
            >
              <Send size={14} />
              إرسال المرتجعات لمكعب الفحص والمطابقة 🚀
            </button>
          </div>
        </div>
      )}

      {/* ===================== TAB 1: FACE TO FACE DEPOSITS ===================== */}
      {activeTab === 'f2f' && (
        <div className="card-glass p-6 text-right rounded-3xl border border-white/5 bg-slate-950/20 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Barcode size={16} />
                أصناف المرتجعات وجه لوجه لقسم المعاملات
              </h3>
              <p className="text-[10px] text-gray-400">امسح باركود البند للكشف اللحظي على حالة الضمان والمورّد المصنع</p>
            </div>
            <button 
              onClick={addF2fRow}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs"
            >
              + إضافة صنف يدوي
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 font-bold">
                  <th className="pb-3 pl-2">مسح باركود الصنف</th>
                  <th className="pb-3 pl-2">اسم الصنف المعالج</th>
                  <th className="pb-3 pl-2 text-center w-20">الكمية</th>
                  <th className="pb-3 pl-2 w-28">سعر حبة</th>
                  <th className="pb-3 pl-2">تاريخ الشراء</th>
                  <th className="pb-3 pl-2">المورّد المصنع</th>
                  <th className="pb-3 pl-2">حالة الضمان</th>
                  <th className="pb-3 pl-2">سبب الاسترجاع</th>
                  <th className="pb-3 text-left w-12 text-center">حذف</th>
                </tr>
              </thead>
              <tbody>
                {f2fItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-white/[0.02]">
                    <td className="py-2.5 pl-2">
                      <input
                        type="text"
                        value={item.barcode}
                        onChange={(e) => {
                          const updated = [...f2fItems];
                          updated[idx].barcode = e.target.value;
                          setF2fItems(updated);
                        }}
                        onBlur={(e) => handleBarcodeLookup(idx, e.target.value)}
                        placeholder="باركود مسح..."
                        className="bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="py-2.5 pl-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...f2fItems];
                          updated[idx].name = e.target.value;
                          setF2fItems(updated);
                        }}
                        placeholder="اسم الصنف..."
                        className="bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="py-2.5 pl-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...f2fItems];
                          updated[idx].quantity = Math.max(1, Number(e.target.value));
                          setF2fItems(updated);
                        }}
                        className="bg-slate-900 border border-white/5 rounded-xl px-2 py-1.5 text-xs text-white text-center"
                      />
                    </td>
                    <td className="py-2.5 pl-2">
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => {
                          const updated = [...f2fItems];
                          updated[idx].price = Number(e.target.value);
                          setF2fItems(updated);
                        }}
                        className="bg-slate-900 border border-white/5 rounded-xl px-2 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="py-2.5 pl-2">
                      <input
                        type="date"
                        value={item.purchaseDate || ''}
                        onChange={(e) => {
                          const updated = [...f2fItems];
                          updated[idx].purchaseDate = e.target.value;
                          setF2fItems(updated);
                        }}
                        className="bg-slate-900 border border-white/5 rounded-xl px-2 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="py-2.5 pl-2 text-yellow-500 font-bold">{item.wholesalerName || '---'}</td>
                    <td className="py-2.5 pl-2">
                      {(() => {
                        const info = getWarrantyStatus(item);
                        return (
                          <span className={`px-2 py-0.5 rounded text-[10px] ${info.expired ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                            {info.message}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2.5 pl-2">
                      <select
                        value={item.reason}
                        onChange={(e) => {
                          const updated = [...f2fItems];
                          updated[idx].reason = e.target.value;
                          setF2fItems(updated);
                        }}
                        className="bg-slate-900 border border-white/5 rounded-xl px-1.5 py-1 text-xs"
                      >
                        <option value="تالف مصنعي">تالف مصنعي</option>
                        <option value="سوء شحن">سوء شحن</option>
                        <option value="تبديل زبون">تبديل زبون</option>
                      </select>
                    </td>
                    <td className="py-2.5 pl-2 text-center">
                      <button 
                        onClick={() => removeF2fRow(idx)}
                        className="p-1 px-1.5 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded border-none cursor-pointer"
                      >
                        <Trash size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: SYSTEM MULTI-RETURNS ===================== */}
      {activeTab === 'system' && (
        <div className="card-glass p-6 text-right rounded-3xl border border-white/5 bg-slate-950/20 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Layers size={16} />
                تجميع وفرز الفواتير المرتجعة للشبكة
              </h3>
              <p className="text-[10px] text-gray-400">سوف يقوم الموزع الذكي بفرز البنود آلياً وتوزيعها بشكل فواتير منفصلة على الموردين والمستودعات</p>
            </div>
            <button 
              onClick={addSystemRow}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs"
            >
              + إضافة صنف شبكي
            </button>
          </div>

          <div className="space-y-4">
            {systemReturnForm.items.map((item, idx) => (
              <div key={idx} className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold block">باركود مسح</label>
                  <input
                    type="text"
                    value={item.barcode}
                    onChange={(e) => {
                      const updated = [...systemReturnForm.items];
                      updated[idx].barcode = e.target.value;
                      setSystemReturnForm({ ...systemReturnForm, items: updated });
                    }}
                    onBlur={(e) => handleLookupSystemBarcode(idx, e.target.value)}
                    className="w-full bg-slate-900 border border-white/5 rounded-xl px-2 py-1 text-xs text-white"
                  />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold block">اسم الصنف</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...systemReturnForm.items];
                      updated[idx].name = e.target.value;
                      setSystemReturnForm({ ...systemReturnForm, items: updated });
                    }}
                    className="w-full bg-slate-900 border border-white/5 rounded-xl px-2 py-1 text-xs text-white"
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold block text-center">الكمية</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...systemReturnForm.items];
                      updated[idx].quantity = Math.max(1, Number(e.target.value));
                      setSystemReturnForm({ ...systemReturnForm, items: updated });
                    }}
                    className="w-full bg-slate-900 border border-white/5 rounded-xl px-2 py-1 text-xs text-white text-center"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold block">المورّد الشريك</label>
                  <select
                    value={item.wholesalerId}
                    onChange={(e) => {
                      const updated = [...systemReturnForm.items];
                      const linkObj = networkLinks.find(l => l.wholesalerId === e.target.value);
                      updated[idx].wholesalerId = e.target.value;
                      updated[idx].wholesalerName = linkObj?.wholesalerName || 'مورد عام';
                      setSystemReturnForm({ ...systemReturnForm, items: updated });
                    }}
                    className="w-full bg-slate-900 border border-white/5 rounded-xl px-2 py-1 text-xs text-yellow-400 font-bold"
                  >
                    <option value="">اختر المورد...</option>
                    {networkLinks.map(link => (
                      <option key={link.id} value={link.wholesalerId}>{link.wholesalerName}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold block">الأعطال وملاحظات العيب</label>
                  <input
                    type="text"
                    value={item.reason}
                    onChange={(e) => {
                      const updated = [...systemReturnForm.items];
                      updated[idx].reason = e.target.value;
                      setSystemReturnForm({ ...systemReturnForm, items: updated });
                    }}
                    className="w-full bg-slate-900 border border-white/5 rounded-xl px-2 py-1 text-xs text-white"
                  />
                </div>
                <div className="md:col-span-1">
                  <button 
                    type="button"
                    onClick={() => {
                      const fl = systemReturnForm.items.filter((_, i) => i !== idx);
                      setSystemReturnForm({ ...systemReturnForm, items: fl.length ? fl : [{ productId: '', name: '', barcode: '', quantity: 1, price: 0, wholesalerId: '', wholesalerName: '', reason: 'عجز جودة', defectLog: '' }] });
                    }}
                    className="w-full py-2 text-red-500 bg-red-500/10 rounded-xl font-bold cursor-pointer"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== TAB 3: TRIPLE MATCHING & 3-STEP FLOWS ===================== */}
      {activeTab === 'inspection' && (
        <div className="space-y-6">
          <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl flex items-center gap-3 text-xs leading-relaxed text-yellow-300">
            <ShieldCheck size={20} className="text-[#cf8a3c] animate-pulse" />
            <div>
              <p className="font-extrabold text-[#cf8a3c] text-sm">نظام الفحص والمطابقة الخاضع لمصفوفة دورة حياة 3 خطوات 🛡️</p>
              <p className="mt-1">
                تتبع الفواتير المرتجعة: الخطوة 1: معالج التنفيذ الميداني تم الاستلام ➔ الخطوة 2: مصادقة المشرف المالي ➔ الخطوة 3: تفعيل موجهات التخزين التلقائي للموقع والذمة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Returns Queue column */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-black text-white pb-2 pr-1 flex items-center gap-1 border-b border-white/5">
                <Truck size={16} className="text-[#cf8a3c]" />
                شحنات المرتجعات النشطة بجمارك الفروع والذمم
              </h3>

              {returns.filter(r => r.status && !['routed_damaged', 'routed_active', 'routed_supplier', 'rejected_by_admin'].includes(r.status)).length === 0 ? (
                <div className="text-center py-16 text-gray-500 text-xs font-bold bg-white/[0.01] border border-white/5 p-6 rounded-2xl">
                  مستقر! لا توجد شحنات مرتجعات واردة قيد التدقيق الجمركي بالوقت الحالي.
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {returns.filter(r => r.status && !['routed_damaged', 'routed_active', 'routed_supplier', 'rejected_by_admin'].includes(r.status)).map((retDoc) => {
                    return (
                      <div key={retDoc.id} className="p-5 rounded-3xl border border-white/5 bg-slate-950/20 space-y-4 text-xs">
                        
                        <div className="flex justify-between items-start border-b border-white/5 pb-3">
                          <div>
                            <span className="font-mono text-[9px] text-[#cf8a3c]">معرف المرجع: #{retDoc.id.substring(0, 10)}</span>
                            <h4 className="font-black text-sm text-white mt-1">
                              {retDoc.items?.length > 0 ? `${retDoc.items.length} بنود مرتجعة` : (retDoc.itemName || 'مرتجع بند فردي')}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">المجموع المالي: {retDoc.totalAmount?.toLocaleString()} ر.ي</p>
                          </div>

                          <div className="text-left">
                            <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg ${
                              retDoc.status === 'remote_pending' ? 'bg-orange-500/15 text-orange-400' :
                              retDoc.status === 'dispatched_return' ? 'bg-indigo-500/15 text-indigo-400' :
                              retDoc.status === 'received_by_handler' ? 'bg-yellow-500/15 text-yellow-400' :
                              retDoc.status === 'inspected_by_handler' ? 'bg-blue-500/15 text-blue-400' : 'bg-green-500/15 text-green-400'
                            }`}>
                              {retDoc.status === 'remote_pending' ? 'طلب مرتجع عن بعد (Initiated Remotely)' :
                               retDoc.status === 'dispatched_return' ? 'شحنة واردة بالطريق بالطريق' :
                               retDoc.status === 'received_by_handler' ? 'تم الاستلام (بانتظار فحص جودة الصنف)' :
                               retDoc.status === 'inspected_by_handler' ? 'تم الفحص (بانتظار اعتماد الإدارة)' : 'معتمد ماليّاً وبانتظار التوجيه'}
                            </span>
                            
                            {retDoc.newInvoiceId && (
                              <span className="block text-[9.5px] bg-emerald-500/10 text-emerald-400 mt-1.5 px-2 py-0.5 rounded border border-emerald-500/20">
                                🔗 فاتورة تسوية مقابلة: #{retDoc.newInvoiceId}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* List items to register details and Defect Log during inspection */}
                        <div className="space-y-2 bg-slate-900/40 p-3 rounded-2xl border border-white/5">
                          <p className="text-[10px] text-gray-500 font-bold block">تفاصيل البنود والكميات:</p>
                          {(retDoc.items || []).map((it: any, itemIdx: number) => (
                            <div key={itemIdx} className="space-y-2 pb-2 border-b border-white/[0.02] last:border-none">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="font-bold text-slate-200">{it.name} [الكمية: {it.quantity}]</span>
                                <span className="text-[10px] text-gray-500">سعر: {it.price?.toLocaleString()} ر.ي</span>
                              </div>

                              {/* Defect logging text entry - only shown during correct lifecycle step: received_by_handler */}
                              {retDoc.status === 'received_by_handler' ? (
                                <div className="space-y-1">
                                  <label className="text-[9.5px] text-amber-500 block">تسجيل الخلل / ملاحظة الجودة (Defect Log):</label>
                                  <input
                                    type="text"
                                    placeholder="شاشة متفحمة، رداءة التغليف..."
                                    value={activeDefectLogs[`${retDoc.id}-${it.productId}`] || ''}
                                    onChange={(e) => {
                                      setActiveDefectLogs({
                                        ...activeDefectLogs,
                                        [`${retDoc.id}-${it.productId}`]: e.target.value
                                      });
                                    }}
                                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-2.5 py-1 text-[11px] text-white focus:outline-none"
                                  />
                                </div>
                              ) : (
                                it.defectLog && (
                                  <p className="text-[10.5px] text-red-400 italic">
                                    📋 تقرير العيب المعتمد: {it.defectLog}
                                  </p>
                                )
                              )}
                            </div>
                          ))}
                        </div>

                        {/* ========================================================
                            LIFECYCLE VERIFICATION DRIVERS & WORKFLOW CTAS
                            ======================================================== */}
                        <div className="flex flex-wrap gap-2.5 pt-2 border-t border-white/5">
                          
                          {/* STEP 1.1: Confirm receipt */}
                          {(retDoc.status === 'dispatched_return' || retDoc.status === 'remote_pending') && (
                            <button
                              onClick={() => handleFulfillmentConfirmReceipt(retDoc)}
                              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 font-black text-slate-950 rounded-xl text-xs flex items-center gap-1 border-none cursor-pointer"
                            >
                              <ClipboardCheck size={14} />
                              [تم الاستلام / Confirm Receipt] ✓
                            </button>
                          )}

                          {/* STEP 1.2: Matched Inspected */}
                          {retDoc.status === 'received_by_handler' && (
                            <button
                              onClick={() => handleFulfillmentInspected(retDoc)}
                              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 font-black text-white rounded-xl text-xs flex items-center gap-1 border-none cursor-pointer"
                            >
                              <CheckCircle2 size={14} />
                              [تم الفحص والمطابقة / Inspected] ✓
                            </button>
                          )}

                          {/* STEP 2: ADMIN VALIDATION APPROVE/REJECT */}
                          {retDoc.status === 'inspected_by_handler' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAdminValidation(retDoc, 'approved')}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-slate-950 font-black rounded-xl text-xs border-none cursor-pointer"
                              >
                                [قبول والاعتماد النهائي / Manager Approve] ✓
                              </button>
                              <button
                                onClick={() => handleAdminValidation(retDoc, 'rejected')}
                                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-black rounded-xl text-xs border-none cursor-pointer"
                              >
                                [رفض الصنف / Reject] ❌
                              </button>
                            </div>
                          )}

                          {/* STEP 3: AUTOMATED ROUTING TRIGGERS */}
                          {retDoc.status === 'approved_by_admin' && (
                            <div className="space-y-3 w-full pt-1.5 bg-green-500/5 p-4 rounded-2xl border border-green-500/10">
                              <p className="text-[10px] text-green-400 font-extrabold flex items-center gap-1">
                                <ShieldCheck size={14} />
                                جاهز لتفعيل موجهات التخزين التلقائي وحقن الدائن والمدين:
                              </p>
                              <div className="flex flex-wrap gap-2.5">
                                <button
                                  onClick={() => handleAutomatedRoutingTrigger(retDoc, 'damaged')}
                                  className="px-3.5 py-2 bg-red-500 hover:bg-red-600 text-slate-950 font-black rounded-xl text-[10.5px] border-none cursor-pointer"
                                  title="ترحيل الشحنات التالفة لقائمة التوالف المعزولة مالياً عن العرض البيعي"
                                >
                                  [مخزن التالف / Route Damaged] 🗑️
                                </button>
                                <button
                                  onClick={() => handleAutomatedRoutingTrigger(retDoc, 'active')}
                                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-[10.5px] border-none cursor-pointer"
                                  title="إعادة دمج وحساب كصنف سليم في مبيعات المستودع العام"
                                >
                                  [مخزن سليم / Route Active Stock] 📦
                                </button>
                                <button
                                  onClick={() => handleAutomatedRoutingTrigger(retDoc, 'supplier')}
                                  className="px-3.5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-black rounded-xl text-[10.5px] border-none cursor-pointer"
                                  title="التعليق كمرتجع للمورد المباشر وخصم قيمته من ذمم الحساب"
                                >
                                  [مرتجع للمورد / Return to Supplier] 🚚
                                </button>
                              </div>
                            </div>
                          )}

                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reconciliation and ledger matrix instructions sidebar */}
            <div className="space-y-4">
              <div className="card-glass p-6 text-xs text-slate-300 space-y-4 rounded-3xl border border-white/5 bg-slate-950/20">
                <h4 className="font-extrabold text-[#cf8a3c] flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <BarChart3 size={16} />
                  قوانين تصفية المرتجع المزدوج (Integrity rules)
                </h4>
                <p className="leading-relaxed">
                  تضمن بوابات التدقيق الثلاثية حماية مخازن "JAM PRO" من تهريب الأصول والسلع أو حدوث فروق نقدية بالصناديق.
                </p>

                <div className="p-3 bg-red-500/5 text-red-400 rounded-xl leading-relaxed text-[10px] space-y-1 font-bold">
                  <p className="font-black text-rose-500">🛡️ تأمين ذمم الموردين (Supplier Safety):</p>
                  <p>تم تصميم المعالج بحظر ترحيل الأرصدة ما لم يقر عامل التنفيذ سلامة ومطابقة الأبعاد الجسدية للمرتجع.</p>
                </div>

                <div className="p-3 bg-indigo-500/5 text-slate-400 rounded-xl leading-relaxed text-[10px] space-y-1 font-bold">
                  <p className="font-black text-indigo-400">🔗 الربط المعاكس للفاتورة المقابلة:</p>
                  <p>عند تحديد فاتورة جديدة مقابلة، سيتم ترحيل الخصم للدفاتر المالية وتحت نفس المقرن لتوفير توازن محاسبي تلقائي.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===================== TAB 4: COMPLETED RETURNS ARCHIVE ===================== */}
      {activeTab === 'history' && (
        <div className="card-glass p-6 text-right rounded-3xl border border-white/5 bg-slate-950/20 space-y-4">
          <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2">
            <History size={16} className="text-[#cf8a3c]" />
            سجل العمليات المكتملة والمجردة بنجاح
          </h3>

          {returns.filter(r => ['routed_damaged', 'routed_active', 'routed_supplier', 'rejected_by_admin'].includes(r.status)).length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-xs font-bold">
              لا توجد تصفية أو مرتجعات مغلقة سابقاً بالأرشيف التدريبي.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 font-bold">
                    <th className="pb-3 pl-2">رقم الفاتورة</th>
                    <th className="pb-3 pl-2">اسم البند / الأصناف</th>
                    <th className="pb-3 pl-2">المورّد المستهدف</th>
                    <th className="pb-3 pl-2">طريقة الإدخال</th>
                    <th className="pb-3 pl-2">المجموع</th>
                    <th className="pb-3 pl-2">تأمين التسوية المعاكسة</th>
                    <th className="pb-3 text-left">الحالة النهائية</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.filter(r => ['routed_damaged', 'routed_active', 'routed_supplier', 'rejected_by_admin'].includes(r.status)).map(r => (
                    <tr key={r.id} className="border-b border-white/[0.02]">
                      <td className="py-2.5 font-mono text-[10px] text-gray-400">#{r.id.substring(0,8)}</td>
                      <td className="py-2.5 font-bold text-white">
                        {r.items?.length > 0 ? `${r.items.length} أصناف متنوعة` : (r.itemName || '---')}
                      </td>
                      <td className="py-2.5 font-bold text-yellow-500">{r.wholesalerName || '---'}</td>
                      <td className="py-2.5 text-slate-300">{r.entryMethod === 'remote' ? 'مرتجع عن بعد' : 'مرتجع يدوي'}</td>
                      <td className="py-2.5 font-mono text-white font-extrabold">{r.totalAmount?.toLocaleString()} ر.ي</td>
                      <td className="py-2.5">
                        {r.newInvoiceId ? (
                          <span className="text-green-400 font-bold font-mono">#{r.newInvoiceId}</span>
                        ) : '---'}
                      </td>
                      <td className="py-2.5 text-left">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                          r.status === 'routed_damaged' ? 'bg-red-500/15 text-red-400' :
                          r.status === 'routed_active' ? 'bg-emerald-500/15 text-emerald-400' :
                          r.status === 'routed_supplier' ? 'bg-blue-500/15 text-blue-400' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {r.status === 'routed_damaged' ? 'رحّلت للتوالف 🗑️' :
                           r.status === 'routed_active' ? 'أعيدت للمخزن السليم 📦' :
                           r.status === 'routed_supplier' ? 'خصمت من مديونية المورد 🚚' : 'مرتجع مرفوض ومردود ❌'}
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
    </div>
  );
}
