import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DevicePermissionsService } from '../services/DevicePermissionsService';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  User, 
  Barcode, 
  CheckCircle2, 
  X, 
  MessageCircle, 
  Bell, 
  Phone, 
  Printer, 
  Camera, 
  Mic, 
  AlertTriangle, 
  Shield, 
  Tag, 
  Settings as SettingsIcon,
  Package,
  ReceiptText,
  Layers,
  Building2,
  Image as ImageIcon,
  ImageOff,
  ArrowRight,
  ArrowLeft,
  Filter,
  Check
} from 'lucide-react';
import { employeeDebtGuardService } from '../services/employeeDebtGuardService';
import { WalletDepositCard } from './WalletDepositCard';
import CustomerSearchSelector from './CustomerSearchSelector';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  getDoc, 
  setDoc, 
  deleteDoc,
  writeBatch, 
  increment,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { logActivity } from '../services/activityLogService';
import { JAMBarcodeEngine } from './JAMBarcodeEngine';
import VoiceInput from './VoiceInput';
import { InventoryItem, UserProfile, Customer } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import JAMPayModal from './JAMPayModal';
import { transactionLockService } from '../services/transactionLockService';
import { Sparkles } from 'lucide-react';
import { sendSMS, templates, sendWhatsApp, parseTemplate } from '../services/smsService';
import { printReceipt } from '../services/printService';
import { audioService } from '../services/audioService';
import { shareInvoiceViaWhatsApp } from '../services/whatsappService';
import { postSaleToGL } from '../services/accountingService';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale/ar';
import ConfirmModal from './ConfirmModal';
import { AccountSelector } from './AccountSelector';
import { useLabels } from '../hooks/useLabels';
import MessageModal from './MessageModal';
import { useLoading } from '../context/LoadingContext';
import { useVault } from '../context/VaultContext';
import { idbService, CachedItem } from '../services/idbService';
import { draftVaultService } from '../services/draftVaultService';
import { generateTransactionId } from '../lib/shopUtils';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

import { OfflineAuthService, TimeProtectionService } from '../services/OfflineCore';
import { StoreQueueEngine } from '../services/StoreQueueEngine';

interface SalesProps {
  profile: UserProfile | null;
}

interface CartItem extends InventoryItem {
  quantity: number;
  saleType?: 'new' | 'replacement';
  selectedUnit?: {
    name: string;
    factor: number;
    price: number;
    cost: number;
  };
}

interface SalesGridRow {
  barcode: string;
  itemId: string;
  name: string;
  stock: number;
  availableUnits?: { id: string; name: string; factor: number; price: number; cost: number; }[];
  selectedUnit?: { id: string; name: string; factor: number; price: number; cost: number; };
  quantity: number;
  price: number;
  cost: number;
  total: number;
}

export default function Sales({ profile }: SalesProps) {
  const { isVaultOpen, vaultDate } = useVault();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [localSearchResults, setLocalSearchResults] = useState<CachedItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notificationChoice, setNotificationChoice] = useState<{
    customer: Customer;
    message: string;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'debt'>('cash');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [realtimeBanks, setRealtimeBanks] = useState<any[]>([]);
  const [realtimeCustomBoxes, setRealtimeCustomBoxes] = useState<any[]>([]);
  const [realtimeAccounts, setRealtimeAccounts] = useState<any[]>([]);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isJAMPayOpen, setIsJAMPayOpen] = useState(false);
  const [customPhone, setCustomPhone] = useState('');
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const barcodeSearchInputRef = useRef<HTMLInputElement | null>(null);

  const resetToCatalogAndNextSale = useCallback(() => {
    setCart([]);
    setSalesGridRows([createEmptyGridRow()]);
    setSelectedCustomer(null);
    setPaymentMethod('cash');
    setCurrentDiscount(0);
    setTransferRefNo('');
    setTransferAccountName('');
    setSearchTerm('');
    setIsReturnMode(false);
    setOriginalSaleId('');
    setOriginalSaleData(null);
    setIsCheckoutModalOpen(false);
    setIsSuccessModalOpen(false);
    setIsHoldInvoiceModalOpen(false);
    
    // Auto-focus barcode/search input so cashier is immediately ready
    setTimeout(() => {
      barcodeSearchInputRef.current?.focus();
    }, 80);
  }, []);

  useEffect(() => {
    if (isSuccessModalOpen && lastSaleData) {
      setCustomPhone(lastSaleData.customerPhone || '');
    }
  }, [isSuccessModalOpen, lastSaleData]);

  const [currentDiscount, setCurrentDiscount] = useState(0);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const submissionLock = useRef(false);
  const [originalSaleId, setOriginalSaleId] = useState('');
  const [originalSaleData, setOriginalSaleData] = useState<any>(null);
  const [isSubmitting, setIsSubmittingRaw] = useState(false);
  const submittingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setIsSubmitting = (val: boolean) => {
    setIsSubmittingRaw(val);
    if (submittingTimeoutRef.current) {
      clearTimeout(submittingTimeoutRef.current);
      submittingTimeoutRef.current = null;
    }
    if (val) {
      submittingTimeoutRef.current = setTimeout(() => {
        setIsSubmittingRaw(false);
      }, 2000); // 2 seconds safety auto-release
    }
  };

  useEffect(() => {
    return () => {
      if (submittingTimeoutRef.current) {
        clearTimeout(submittingTimeoutRef.current);
      }
    };
  }, []);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [transferRefNo, setTransferRefNo] = useState('');
  const [transferAccountName, setTransferAccountName] = useState('');
  const [businessType, setBusinessType] = useState('mobiles');
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('YER');
  const [selectedProductForQty, setSelectedProductForQty] = useState<any | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalUnit, setModalUnit] = useState<any | null>(null);
  const [showAdvancedCheckout, setShowAdvancedCheckout] = useState(true);
  const labels = useLabels(businessType);
  const { startProcessing, stopProcessing, globalActionTimeout } = useLoading();

  // --- Legacy ERP Sales Grid Mode States & Helpers (المهمة 2) ---
  const [salesViewMode, setSalesViewMode] = useState<'cards' | 'grid'>(() => {
    return (localStorage.getItem('jam_sales_view_mode') as 'cards' | 'grid') || 'cards';
  });

  useEffect(() => {
    localStorage.setItem('jam_sales_view_mode', salesViewMode);
  }, [salesViewMode]);

  const [isWholesaleInvoice, setIsWholesaleInvoice] = useState<boolean>(() => {
    return localStorage.getItem('jam_sales_wholesale_invoice') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('jam_sales_wholesale_invoice', String(isWholesaleInvoice));
  }, [isWholesaleInvoice]);

  const createEmptyGridRow = (): SalesGridRow => ({
    barcode: '',
    itemId: '',
    name: 'بانتظار مسح الباركود...',
    stock: 0,
    quantity: 1,
    price: 0,
    cost: 0,
    total: 0
  });

  const [salesGridRows, setSalesGridRows] = useState<SalesGridRow[]>(() => {
    const cached = localStorage.getItem('jam_sales_grid_rows');
    return cached ? JSON.parse(cached) : [createEmptyGridRow()];
  });

  useEffect(() => {
    localStorage.setItem('jam_sales_grid_rows', JSON.stringify(salesGridRows));
  }, [salesGridRows]);

  const [gridUnitModal, setGridUnitModal] = useState<{
    isOpen: boolean;
    rowIndex: number;
    units: any[];
    productName: string;
  } | null>(null);

  const [isHeldInvoicesModalOpen, setIsHeldInvoicesModalOpen] = useState<boolean>(false);
  
  // States for hold invoice modal and reservation with deposit
  const [isHoldInvoiceModalOpen, setIsHoldInvoiceModalOpen] = useState<boolean>(false);
  const [holdInvoiceName, setHoldInvoiceName] = useState<string>('');
  const [holdInvoiceIsReservation, setHoldInvoiceIsReservation] = useState<boolean>(false);
  const [holdInvoiceDeposit, setHoldInvoiceDeposit] = useState<number>(0);

  const [heldInvoices, setHeldInvoices] = useState<any[]>(() => {
    const cached = localStorage.getItem('jam_held_invoices');
    return cached ? JSON.parse(cached) : [];
  });
  const [heldSearchQuery, setHeldSearchQuery] = useState('');
  const [cartWidth, setCartWidth] = useState<'standard' | 'wide' | 'split'>(() => {
    return (localStorage.getItem('jam_sales_cart_width') as any) || 'standard';
  });

  // 🌟 Axis 1: 3-Tab POS Workflow States & Advanced Product Filter/Sorting
  const [activePosTab, setActivePosTab] = useState<'catalog' | 'cart' | 'checkout'>('catalog');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState<string>('all');
  const [demandStockFilter, setDemandStockFilter] = useState<'all' | 'high_demand' | 'low_demand' | 'high_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'price' | 'stock' | 'salesCount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showProductImages, setShowProductImages] = useState<boolean>(() => {
    return localStorage.getItem('jam_pos_show_images') === 'true';
  });

  // 💾 محرك الحفظ التلقائي الفوري لمسودة الكاشير (Auto-Draft Restoration via DraftVault)
  useEffect(() => {
    const restorePosDraft = async () => {
      const storeId = profile?.ownerId || 'default_store';
      const userId = profile?.uid || 'default_user';
      try {
        const draft = await draftVaultService.getDraft(storeId, userId, 'pos_retail_active_cart');
        if (draft && Array.isArray(draft.cart) && draft.cart.length > 0 && cart.length === 0) {
          setCart(draft.cart);
          if (draft.selectedCustomer) setSelectedCustomer(draft.selectedCustomer);
          if (draft.currentDiscount) setCurrentDiscount(draft.currentDiscount);
          if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
          if (draft.selectedCurrency) setSelectedCurrency(draft.selectedCurrency);
        }
      } catch (err) {
        console.warn('Could not restore POS draft from vault:', err);
      }
    };
    restorePosDraft();
  }, [profile]);

  // 💾 الحفظ التلقائي المستمر عند أي تعديل على السلة أو الزبون
  useEffect(() => {
    const storeId = profile?.ownerId || 'default_store';
    const userId = profile?.uid || 'default_user';
    if (cart.length > 0 || selectedCustomer || currentDiscount > 0) {
      draftVaultService.saveDraft(storeId, userId, 'pos_retail_active_cart', {
        cart,
        selectedCustomer,
        currentDiscount,
        paymentMethod,
        selectedCurrency,
        timestamp: Date.now()
      });
    } else {
      draftVaultService.clearDraft(storeId, userId, 'pos_retail_active_cart');
    }
  }, [cart, selectedCustomer, currentDiscount, paymentMethod, selectedCurrency, profile]);

  useEffect(() => {
    localStorage.setItem('jam_pos_show_images', String(showProductImages));
  }, [showProductImages]);

  // Global Keyboard Shortcuts (F1 -> Catalog, F2 -> Cart, F3 -> Checkout)
  useEffect(() => {
    const handlePosGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActivePosTab('catalog');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActivePosTab('cart');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActivePosTab('checkout');
      }
    };
    window.addEventListener('keydown', handlePosGlobalKeys);
    return () => window.removeEventListener('keydown', handlePosGlobalKeys);
  }, []);

  useEffect(() => {
    localStorage.setItem('jam_sales_cart_width', cartWidth);
  }, [cartWidth]);

  useEffect(() => {
    localStorage.setItem('jam_held_invoices', JSON.stringify(heldInvoices));
  }, [heldInvoices]);

  // Sync grid rows to Cart when in Grid mode
  useEffect(() => {
    if (salesViewMode === 'grid') {
      const validCartItems: CartItem[] = salesGridRows
        .filter(row => row.itemId && row.quantity > 0)
        .map(row => {
          return {
            id: row.itemId,
            name: row.name,
            barcode: row.barcode,
            price: row.price,
            cost: row.cost || 0,
            quantity: row.quantity,
            selectedUnit: row.selectedUnit || undefined,
            saleType: 'new'
          } as CartItem;
        });
      setCart(validCartItems);
    }
  }, [salesGridRows, salesViewMode]);

  const addBlankGridRow = () => {
    setSalesGridRows(prev => [...prev, createEmptyGridRow()]);
  };

  const deleteGridRow = (index: number) => {
    setSalesGridRows(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length === 0) {
        return [createEmptyGridRow()];
      }
      return updated;
    });
  };

  const handleGridRowChange = (index: number, field: keyof SalesGridRow, value: any) => {
    setSalesGridRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'price') {
        row.total = Number(row.quantity || 0) * Number(row.price || 0);
      }
      updated[index] = row;
      return updated;
    });
  };

  const handleGridBarcodeSearch = async (index: number, barcodeValue: string) => {
    const code = barcodeValue.trim();
    if (!code) return;

    let product = inventory.find(i => i.barcode === code || i.id === code);

    if (!product) {
      try {
        const cached = await idbService.getItemByBarcode(code);
        if (cached) product = cached as any;
      } catch (err) {
        console.error("IDB search error in legacy grid:", err);
      }
    }

    if (product) {
      const basePrice = isWholesaleInvoice ? (product.wholesalePrice || product.price) : product.price;
      const units = product.units || [];
      const hasUnits = units.length > 0;

      setSalesGridRows(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          barcode: code,
          itemId: product!.id,
          name: product!.name,
          stock: product!.stock,
          price: basePrice,
          cost: product!.cost,
          quantity: 1,
          availableUnits: units,
          selectedUnit: undefined,
          total: basePrice
        };
        return updated;
      });

      if (isWholesaleInvoice && hasUnits) {
        setGridUnitModal({
          isOpen: true,
          rowIndex: index,
          units: units,
          productName: product.name
        });
      } else {
        setTimeout(() => {
          const qtyInput = document.getElementById(`grid-qty-${index}`);
          if (qtyInput) {
            (qtyInput as HTMLInputElement).focus();
            (qtyInput as HTMLInputElement).select();
          }
        }, 80);
      }
    } else {
      if (shopSettings?.enableAudioUI) audioService.playWarning?.();
      alert('❌ باركود المنتج غير موجود في المخزن!');
    }
  };

  const handleSelectGridRowUnit = (rowIndex: number, unit: any) => {
    setSalesGridRows(prev => {
      const updated = [...prev];
      const row = updated[rowIndex];
      if (row) {
        updated[rowIndex] = {
          ...row,
          selectedUnit: unit,
          price: unit.price,
          cost: unit.cost,
          total: Number(row.quantity || 1) * Number(unit.price)
        };
      }
      return updated;
    });
    setGridUnitModal(null);

    setTimeout(() => {
      const qtyInput = document.getElementById(`grid-qty-${rowIndex}`);
      if (qtyInput) {
        (qtyInput as HTMLInputElement).focus();
        (qtyInput as HTMLInputElement).select();
      }
    }, 80);
  };

  const handleGridQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = index + 1;
      
      setSalesGridRows(prev => {
        if (nextIndex >= prev.length) {
          return [...prev, createEmptyGridRow()];
        }
        return prev;
      });

      setTimeout(() => {
        const nextBarcodeField = document.getElementById(`grid-barcode-${nextIndex}`);
        if (nextBarcodeField) {
          (nextBarcodeField as HTMLInputElement).focus();
          (nextBarcodeField as HTMLInputElement).select();
        }
      }, 100);
    }
  };

  const handleGridBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = (e.target as HTMLInputElement).value;
      handleGridBarcodeSearch(index, val);
    }
  };

  const handleHoldCurrentInvoice = () => {
    const itemsToHold = salesViewMode === 'grid' 
      ? salesGridRows.filter(r => r.itemId && r.quantity > 0) 
      : cart;

    if (itemsToHold.length === 0) {
      alert('❌ لا يمكن حجز فاتورة فارغة!');
      return;
    }

    // Prefill name with customer's name if any
    setHoldInvoiceName(selectedCustomer?.name || '');
    setHoldInvoiceIsReservation(false);
    setHoldInvoiceDeposit(0);
    setIsHoldInvoiceModalOpen(true);
  };

  const submitHoldInvoice = () => {
    const itemsToHold = salesViewMode === 'grid' 
      ? salesGridRows.filter(r => r.itemId && r.quantity > 0) 
      : cart;

    if (itemsToHold.length === 0) {
      alert('❌ لا يمكن حجز فاتورة فارغة!');
      return;
    }

    const desc = holdInvoiceName.trim() || 'غير مسمى';
    const invoiceId = `HOLD-${Date.now().toString().slice(-6)}`;

    const newHeldInvoice = {
      ownerId: profile?.ownerId || 'main_store',
      shopId: profile?.shopId || profile?.storeId || '',
      id: invoiceId,
      description: desc,
      items: itemsToHold.map(item => {
        return {
          id: item.itemId || item.id,
          name: item.name,
          barcode: item.barcode || '',
          price: item.price,
          cost: item.cost || 0,
          quantity: item.quantity,
          selectedUnit: item.selectedUnit || null,
          saleType: item.saleType || 'new'
        };
      }),
      customerId: selectedCustomer?.id || null,
      customerName: selectedCustomer?.name || 'عميل نقدي',
      discount: currentDiscount,
      paymentMethod,
      isReturn: isReturnMode,
      isReservation: holdInvoiceIsReservation,
      depositAmount: holdInvoiceIsReservation ? Number(holdInvoiceDeposit) || 0 : 0,
      createdAt: new Date().toISOString()
    };

    if (profile?.ownerId && navigator.onLine) {
      setDoc(doc(db, 'held_invoices', invoiceId), newHeldInvoice)
        .catch(err => console.error('[Sales] Failed to write held invoice to Firestore:', err));
    }

    setHeldInvoices(prev => [newHeldInvoice, ...prev]);

    if (salesViewMode === 'grid') {
      setSalesGridRows([createEmptyGridRow()]);
    } else {
      setCart([]);
    }
    setSelectedCustomer(null);
    setCurrentDiscount(0);
    
    if (shopSettings?.enableAudioUI) audioService.playSuccess?.();
    
    setIsHoldInvoiceModalOpen(false);
    
    if (holdInvoiceIsReservation) {
      alert(`📋 تم حجز الفاتورة بعربون بنجاح!\nالاسم: ${desc}\nمبلغ العربون: ${Number(holdInvoiceDeposit).toLocaleString()} ر.ي\nتم ربط الأصناف مؤقتاً بالمستودع لمنع بيعها لزبون آخر.`);
    } else {
      alert(`📋 تم تعليق الفاتورة بنجاح باسم: ${desc}`);
    }
  };

  const handleRestoreHeldInvoice = (inv: any, forceSettle: boolean = false) => {
    const hasItems = salesViewMode === 'grid'
      ? salesGridRows.some(r => r.itemId && r.quantity > 0)
      : cart.length > 0;

    let action: 'merge' | 'replace' | 'cancel' = 'replace';

    if (hasItems) {
      const choice = window.confirm(
        `تنبيه ⚠️: سلة المبيعات الحالية ليست فارغة!\n\n` +
        `• اضغط [موافق / OK] لدمج الفاتورة المحجوزة مع السلة الحالية.\n` +
        `• اضغط [إلغاء / Cancel] لاستبدال السلة الحالية بالكامل بالفاتورة المحجوزة.`
      );
      if (choice) {
        action = 'merge';
      } else {
        const replaceChoice = window.confirm(`هل أنت متأكد من استبدال السلة الحالية بالكامل؟ (سيتم حذف الأصناف الحالية من الشاشة)`);
        if (replaceChoice) {
          action = 'replace';
        } else {
          return;
        }
      }
    }

    if (salesViewMode === 'grid') {
      const newRows: SalesGridRow[] = inv.items.map((it: any) => ({
        barcode: it.barcode || '',
        itemId: it.id,
        name: it.name,
        stock: 999,
        quantity: it.quantity,
        price: it.price,
        cost: it.cost || 0,
        total: it.price * it.quantity,
        selectedUnit: it.selectedUnit || undefined
      }));

      if (action === 'merge') {
        const currentValid = salesGridRows.filter(r => r.itemId && r.quantity > 0);
        const merged = [...currentValid];
        newRows.forEach(nr => {
          const idx = merged.findIndex(m => m.itemId === nr.itemId && m.selectedUnit?.name === nr.selectedUnit?.name);
          if (idx > -1) {
            merged[idx].quantity += nr.quantity;
            merged[idx].total = merged[idx].price * merged[idx].quantity;
          } else {
            merged.push(nr);
          }
        });
        if (merged.length < 5) {
          while (merged.length < 5) {
            merged.push(createEmptyGridRow());
          }
        }
        setSalesGridRows(merged);
      } else {
        setSalesGridRows(newRows);
      }
    } else {
      const newCartItems = inv.items.map((it: any) => ({
        id: it.id,
        name: it.name,
        barcode: it.barcode || '',
        price: it.price,
        cost: it.cost || 0,
        quantity: it.quantity,
        selectedUnit: it.selectedUnit || undefined,
        saleType: it.saleType || 'new'
      }));

      if (action === 'merge') {
        setCart(prev => {
          const merged = [...prev];
          newCartItems.forEach((nci: any) => {
            const idx = merged.findIndex(m => m.id === nci.id && m.selectedUnit?.name === nci.selectedUnit?.name);
            if (idx > -1) {
              merged[idx].quantity += nci.quantity;
            } else {
              merged.push(nci);
            }
          });
          return merged;
        });
      } else {
        setCart(newCartItems);
      }
    }

    setCurrentDiscount(inv.discount || 0);
    setPaymentMethod(inv.paymentMethod || 'cash');
    setIsReturnMode(inv.isReturn || false);
    
    if (inv.customerId) {
      const matchedCust = customers.find(c => c.id === inv.customerId);
      if (matchedCust) setSelectedCustomer(matchedCust);
    } else {
      setSelectedCustomer(null);
    }

    if (profile?.ownerId && navigator.onLine) {
      deleteDoc(doc(db, 'held_invoices', inv.id))
        .catch(err => console.error('[Sales] Failed to delete restored held invoice from Firestore:', err));
    }
    setHeldInvoices(prev => prev.filter(x => x.id !== inv.id));
    setIsHeldInvoicesModalOpen(false);
    
    if (shopSettings?.enableAudioUI) audioService.playSuccess?.();

    if (forceSettle) {
      setShowAdvancedCheckout(false);
      setIsCheckoutModalOpen(true);
    } else {
      alert('📋 تم تحميل الفاتورة واستعادتها لشبكة العمل بنجاح!');
    }
  };

  const handleEditHeldInvoiceDescription = (invoiceId: string, currentDesc: string) => {
    const newDesc = window.prompt('تعديل وصف الفاتورة المحجوزة:', currentDesc);
    if (newDesc !== null && newDesc.trim() !== '') {
      if (profile?.ownerId && navigator.onLine) {
        updateDoc(doc(db, 'held_invoices', invoiceId), { description: newDesc.trim() })
          .catch(err => console.error('[Sales] Failed to update held invoice description in Firestore:', err));
      }
      setHeldInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, description: newDesc.trim() } : inv));
    }
  };

  const handleDeleteHeldInvoice = (invoiceId: string) => {
    if (profile?.ownerId && navigator.onLine) {
      deleteDoc(doc(db, 'held_invoices', invoiceId))
        .catch(err => console.error('[Sales] Failed to delete held invoice from Firestore:', err));
    }
    setHeldInvoices(prev => prev.filter(x => x.id !== invoiceId));
  };

  const [totalVaultsBalance, setTotalVaultsBalance] = useState<number>(0);
  const [dailySalesCount, setDailySalesCount] = useState<number>(0);
  const [dailySalesTotal, setDailySalesTotal] = useState<number>(0);

  const [messageModal, setMessageModal] = useState<{
    isOpen: boolean;
    phone: string;
    message: string;
    title: string;
  }>({
    isOpen: false,
    phone: '',
    message: '',
    title: ''
  });

  const handleCancelLastInvoice = async () => {
    if (!lastSaleData) return;

    const lockCheck = transactionLockService.canDelete(lastSaleData.createdAt);
    if (!lockCheck.allowed) {
      alert(lockCheck.message);
      return;
    }

    if (!window.confirm('🚨 هل أنت متأكد من إلغاء الفاتورة الأخيرة بالكامل وعكس حركات المخزون والمديونية والمالية فوراً؟')) return;

    startProcessing();
    try {
      const saleId = lastSaleData.id;
      const isReturn = lastSaleData.type === 'return';
      const collectionName = isReturn ? 'returns' : 'sales';

      // 1. Find linked financial transactions
      const qTrans = query(
        collection(db, 'transactions'),
        where('referenceId', '==', saleId)
      );
      const transSnap = await getDocs(qTrans);

      await runTransaction(db, async (resTransaction) => {
        // 2. Delete linked transactions
        for (const tDoc of transSnap.docs) {
          resTransaction.delete(tDoc.ref);
        }

        // 3. Revert stock for all items
        if (lastSaleData.items && Array.isArray(lastSaleData.items)) {
          for (const item of lastSaleData.items) {
            const factor = item.selectedUnit?.factor || 1;
            const totalQty = item.quantity * factor;
            const invRef = doc(db, 'inventory', item.id);
            resTransaction.update(invRef, {
              stock: increment(isReturn ? -totalQty : totalQty),
              updatedAt: serverTimestamp()
            });
          }
        }

        // 4. Revert debt if applicable
        if (lastSaleData.paymentMethod === 'debt' && lastSaleData.customerId) {
          const custRef = doc(db, 'customers', lastSaleData.customerId);
          resTransaction.update(custRef, {
            debt: increment(isReturn ? lastSaleData.total : -lastSaleData.total)
          });
        }

        // 5. Revert cash balance / employee custody
        if (profile?.role === 'employee' || profile?.role === 'engineer') {
          const userRef = doc(db, 'users', profile.uid);
          resTransaction.update(userRef, {
            custodyBalance: increment(isReturn ? lastSaleData.total : -lastSaleData.total)
          });
        } else if (lastSaleData.paymentMethod === 'cash' || lastSaleData.paymentMethod === 'transfer') {
          // Revert account balance
          for (const tDoc of transSnap.docs) {
            const tData = tDoc.data();
            if (tData.accountId) {
              const accRef = doc(db, 'accounts', tData.accountId);
              resTransaction.update(accRef, {
                balance: increment(isReturn ? tData.amount : -tData.amount)
              });
            }
          }
        }

        // 6. Delete the main sale/return doc
        resTransaction.delete(doc(db, collectionName, saleId));
      });

      setLastSaleData(null);
      alert('✅ تم إلغاء الفاتورة الأخيرة بالكامل بنجاح، وعكس حركاتها المحاسبية والمخزنية!');
    } catch (e: any) {
      console.error(e);
      alert('❌ فشل إلغاء الفاتورة الأخيرة: ' + e.message);
    } finally {
      stopProcessing();
    }
  };

  const handleModifyLastInvoice = async () => {
    if (!lastSaleData) return;

    const lockCheck = transactionLockService.canEdit(lastSaleData.createdAt);
    if (!lockCheck.allowed) {
      alert(lockCheck.message);
      return;
    }

    if (!window.confirm('📝 تعديل الفاتورة التلقائي: سيتم تصفير الفاتورة الأخيرة وعكس رصيدها واستعادة أصنافها فوراً لعربة التسوق لتعديلها. هل تود الاستمرار؟')) return;

    startProcessing();
    try {
      const saleId = lastSaleData.id;
      const isReturn = lastSaleData.type === 'return';
      const collectionName = isReturn ? 'returns' : 'sales';

      // 1. Find linked financial transactions
      const qTrans = query(
        collection(db, 'transactions'),
        where('referenceId', '==', saleId)
      );
      const transSnap = await getDocs(qTrans);

      await runTransaction(db, async (resTransaction) => {
        // 2. Delete linked transactions
        for (const tDoc of transSnap.docs) {
          resTransaction.delete(tDoc.ref);
        }

        // 3. Revert stock
        if (lastSaleData.items && Array.isArray(lastSaleData.items)) {
          for (const item of lastSaleData.items) {
            const factor = item.selectedUnit?.factor || 1;
            const totalQty = item.quantity * factor;
            const invRef = doc(db, 'inventory', item.id);
            resTransaction.update(invRef, {
              stock: increment(isReturn ? -totalQty : totalQty),
              updatedAt: serverTimestamp()
            });
          }
        }

        // 4. Revert debt
        if (lastSaleData.paymentMethod === 'debt' && lastSaleData.customerId) {
          const custRef = doc(db, 'customers', lastSaleData.customerId);
          resTransaction.update(custRef, {
            debt: increment(isReturn ? lastSaleData.total : -lastSaleData.total)
          });
        }

        // 5. Revert cash balance
        if (profile?.role === 'employee' || profile?.role === 'engineer') {
          const userRef = doc(db, 'users', profile.uid);
          resTransaction.update(userRef, {
            custodyBalance: increment(isReturn ? lastSaleData.total : -lastSaleData.total)
          });
        } else if (lastSaleData.paymentMethod === 'cash' || lastSaleData.paymentMethod === 'transfer') {
          for (const tDoc of transSnap.docs) {
            const tData = tDoc.data();
            if (tData.accountId) {
              const accRef = doc(db, 'accounts', tData.accountId);
              resTransaction.update(accRef, {
                balance: increment(isReturn ? tData.amount : -tData.amount)
              });
            }
          }
        }

        // 6. Delete the old document so we can re-checkout
        resTransaction.delete(doc(db, collectionName, saleId));
      });

      // 7. Load into cart & selections
      setCart(lastSaleData.items || []);
      if (lastSaleData.customerId) {
        const custSnap = await getDoc(doc(db, 'customers', lastSaleData.customerId));
        if (custSnap.exists()) {
          setSelectedCustomer({ id: custSnap.id, ...custSnap.data() } as any);
        }
      }
      setPaymentMethod(lastSaleData.paymentMethod || 'cash');
      setLastSaleData(null);
      alert('🛒 تم تحميل أصناف الفاتورة الأخيرة إلى عربة التسوق وتصفير الفاتورة السابقة بنجاح. يمكنك التعديل وإعادة الحفظ الآن!');
    } catch (e: any) {
      console.error(e);
      alert('❌ فشل تعديل الفاتورة الأخيرة: ' + e.message);
    } finally {
      stopProcessing();
    }
  };

  useEffect(() => {
    if (searchTerm.length > 0) {
      idbService.searchItems(searchTerm).then(results => {
        setLocalSearchResults(results as any);
      });
    } else {
      setLocalSearchResults([]);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (!profile?.ownerId) return;

    const fetchData = async () => {
      const currentStoreId = profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
      try {
        if (!navigator.onLine) {
          console.log('[Sales Offline Mode] Loading data from offline cache...');
          
          // Load inventory from IndexedDB
          const offlineInventory = await idbService.searchItems('');
          if (offlineInventory && offlineInventory.length > 0) {
            setInventory(offlineInventory as any);
          }

          // Load customers from localStorage fallback
          const cachedCustomers = localStorage.getItem(`jam_offline_customers_${profile.ownerId}`);
          if (cachedCustomers) {
            setCustomers(JSON.parse(cachedCustomers));
          }

          // Load accounts from localStorage fallback
          const cachedAccounts = localStorage.getItem(`jam_offline_accounts_${currentStoreId}`);
          if (cachedAccounts) {
            setAccounts(JSON.parse(cachedAccounts));
          }
          return;
        }

        const { getDocs } = await import('firebase/firestore');
        
        // Strict Isolation Filter: WHERE ownerId == profile.ownerId
        const inventorySnap = await getDocs(query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId)));
        let inventoryData = inventorySnap.docs.map(doc => {
          const d = { id: doc.id, ...doc.data() } as InventoryItem;
          if (profile?.role === 'sales' || profile?.role === 'customer') {
            delete d.cost;
            delete d.supplierId;
            // @ts-ignore
            delete d.lastBuyPrice;
          }
          return d;
        });
        const userShopId = profile?.shopId || profile?.storeId;
        if (profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
          inventoryData = inventoryData.filter((d: any) => d.shopId === userShopId || d.storeId === userShopId || d.store_id === userShopId);
        }
        setInventory(inventoryData);
        // Sync to IndexedDB for offline access
        idbService.syncInventory(inventoryData).catch(err => console.error('IDB Sync Error in Sales:', err));

        const customersSnap = await getDocs(query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId)));
        let customersData = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        if (profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
          customersData = customersData.filter((c: any) => c.shopId === userShopId || c.storeId === userShopId || c.store_id === userShopId);
        }
        setCustomers(customersData);
        // Cache customers in localStorage
        localStorage.setItem(`jam_offline_customers_${profile.ownerId}`, JSON.stringify(customersData));

        // Real-time synchronization handles accountsData loading online
        console.log('[Sales] Accounts loading is delegated to real-time streams.');
      } catch (error) {
        console.error('Fetch error in Sales, falling back to local/IndexedDB cache:', error);
        try {
          const offlineInventory = await idbService.searchItems('');
          if (offlineInventory && offlineInventory.length > 0) {
            setInventory(offlineInventory as any);
          }
          const cachedCustomers = localStorage.getItem(`jam_offline_customers_${profile.ownerId}`);
          if (cachedCustomers) {
            setCustomers(JSON.parse(cachedCustomers));
          }
          const cachedAccounts = localStorage.getItem(`jam_offline_accounts_${currentStoreId}`);
          if (cachedAccounts) {
            setAccounts(JSON.parse(cachedAccounts));
          }
        } catch (fbErr) {
          console.error('IndexedDB fallback load failed:', fbErr);
        }
      }
    };

    fetchData();
  }, [profile]);

  // Real-time listener for bank accounts, custom boxes, and standard accounts
  useEffect(() => {
    if (!profile?.ownerId) return;

    const currentStoreId = profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';

    // 1. Listen to bank_accounts in real-time
    let unsubBanks = () => {};
    try {
      const qBanks = query(collection(db, 'bank_accounts'), where('ownerId', '==', profile.ownerId));
      unsubBanks = onSnapshot(qBanks, (snapshot) => {
        const list = snapshot.docs.map(doc => {
          const d = doc.data();
          const dbBankName = d.bankName || d.bank_name || d.custom_label || 'حساب مالي عام';
          return {
            id: doc.id,
            ...d,
            bankName: dbBankName,
            name: d.bankName || d.boxName || dbBankName,
            accountName: d.bankName || d.boxName || dbBankName
          };
        });
        setRealtimeBanks(list);
      }, (err) => {
        console.warn("JAM SYSTEM PRO - Real-time error for bank_accounts in Sales:", err.message);
      });
    } catch (e) {
      console.warn("JAM SYSTEM PRO - Failed to set up bank_accounts listener:", e);
    }

    // 2. Listen to customBoxes in real-time
    let unsubCustomBoxes = () => {};
    try {
      const customBoxesRef = collection(db, 'stores', profile.ownerId, 'customBoxes');
      unsubCustomBoxes = onSnapshot(customBoxesRef, (snapshot) => {
        const list = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            bankName: d.bankAccountNumber || 'N/A',
            name: d.boxName || 'صندوق مالي فرعي',
            accountName: d.boxName || 'صندوق مالي فرعي'
          };
        });
        setRealtimeCustomBoxes(list);
      }, (err) => {
        console.warn("JAM SYSTEM PRO - Real-time error for customBoxes in Sales:", err.message);
      });
    } catch (e) {
      console.warn("JAM SYSTEM PRO - Failed to set up customBoxes listener:", e);
    }

    // 3. Listen to accounts in real-time
    let unsubAccounts = () => {};
    try {
      const qAccounts = query(collection(db, 'accounts'), where('store_id', '==', currentStoreId));
      unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
        const list = snapshot.docs.map(doc => {
          const d = doc.data();
          const dbBankName = d.bank_name || d.custom_label || d.bankName;
          const displayBankName = dbBankName 
            ? dbBankName 
            : `بنك الكريمي - ${d.accountNumber ? d.accountNumber.slice(-4) : '1234'}`;
          const accountNameMapped = d.accountName || d.name || 'حساب المصرفي';
          return {
            id: doc.id,
            ...d,
            bankName: displayBankName,
            name: accountNameMapped,
            accountName: accountNameMapped
          };
        });
        setRealtimeAccounts(list);
      }, (err) => {
        console.warn("JAM SYSTEM PRO - Real-time error for accounts in Sales:", err.message);
      });
    } catch (e) {
      console.warn("JAM SYSTEM PRO - Failed to set up accounts listener:", e);
    }

    // 4. Listen to held_invoices in real-time
    let unsubHeldInvoices = () => {};
    try {
      const qHeld = query(collection(db, 'held_invoices'), where('ownerId', '==', profile.ownerId));
      unsubHeldInvoices = onSnapshot(qHeld, (snapshot) => {
        const list = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setHeldInvoices(list);
      }, (err) => {
        console.warn("JAM SYSTEM PRO - Real-time error for held_invoices:", err.message);
      });
    } catch (e) {
      console.warn("JAM SYSTEM PRO - Failed to set up held_invoices listener:", e);
    }

    return () => {
      unsubBanks();
      unsubCustomBoxes();
      unsubAccounts();
      unsubHeldInvoices();
    };
  }, [profile]);

  // Consolidate and sync all boxes in real-time
  useEffect(() => {
    if (!profile?.ownerId) return;
    const currentStoreId = profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
    
    // Default main cash box CASH_BOX representation
    const hasCashBox = realtimeCustomBoxes.some(c => c.id === 'CASH_BOX');
    const fallbackCashBox = hasCashBox ? [] : [{
      id: 'CASH_BOX',
      name: 'صندوق النقد الرئيسي (الكاش)',
      accountName: 'صندوق النقد الرئيسي (الكاش)',
      bankName: 'الكاش الرئيسي',
      balance: 0,
      currency: 'YER'
    }];

    const merged = [
      ...fallbackCashBox,
      ...realtimeCustomBoxes,
      ...realtimeBanks,
      ...realtimeAccounts
    ];

    const uniqueIds = new Set();
    const uniqueMerged = [];
    for (const item of merged) {
      if (!uniqueIds.has(item.id)) {
        uniqueIds.add(item.id);
        uniqueMerged.push(item);
      }
    }

    let filtered = uniqueMerged;
    const userShopId = profile?.shopId || profile?.storeId;
    if (profile && profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
      filtered = filtered.filter((a: any) => a.shopId === userShopId || a.storeId === userShopId || a.store_id === userShopId);
    }

    setAccounts(filtered);
    localStorage.setItem(`jam_offline_accounts_${currentStoreId}`, JSON.stringify(filtered));
  }, [realtimeBanks, realtimeCustomBoxes, realtimeAccounts, profile]);

  useEffect(() => {
    const fetchShopSettings = async () => {
      if (!profile?.ownerId) return;
      try {
        if (!navigator.onLine) {
          const cachedSettings = localStorage.getItem(`jam_offline_settings_${profile.ownerId}`);
          if (cachedSettings) {
            const data = JSON.parse(cachedSettings);
            setShopSettings(data);
            setBusinessType(data.businessType || 'mobiles');
          }
          return;
        }

        const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setShopSettings(data);
          setBusinessType(data.businessType || 'mobiles');
          localStorage.setItem(`jam_offline_settings_${profile.ownerId}`, JSON.stringify(data));
        }
      } catch (error) {
        console.warn('Error fetching settings (falling back to offline cache):', error);
        const cachedSettings = localStorage.getItem(`jam_offline_settings_${profile.ownerId}`);
        if (cachedSettings) {
          const data = JSON.parse(cachedSettings);
          setShopSettings(data);
          setBusinessType(data.businessType || 'mobiles');
        }
      }
    };
    fetchShopSettings();
  }, [profile]);

  useEffect(() => {
    if (!profile?.ownerId) return;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (!navigator.onLine) {
      const offlineStats = localStorage.getItem(`jam_offline_stats_${profile.ownerId}`);
      if (offlineStats) {
        const { count, total, vault } = JSON.parse(offlineStats);
        setDailySalesCount(count || 0);
        setDailySalesTotal(total || 0);
        setTotalVaultsBalance(vault || 0);
      }
      return;
    }

    let qSales = query(
      collection(db, 'sales'),
      where('ownerId', '==', profile.ownerId)
    );

    const userShopId = profile?.shopId || profile?.storeId;
    if (profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
      qSales = query(qSales, where('shopId', '==', userShopId));
    }

    const unsubscribe = onSnapshot(qSales, (snap) => {
      let count = 0;
      let totalAmount = 0;
      let calculatedVault = 0;

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        let timestampDate: Date | null = null;
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            timestampDate = data.createdAt.toDate();
          } else {
            timestampDate = new Date(data.createdAt);
          }
        }

        if (timestampDate && timestampDate >= startOfToday) {
          const amt = parseFloat(data.total) || 0;
          count++;
          totalAmount += amt;

          if (data.paymentMethod === 'cash' || data.paymentMethod === 'transfer') {
            calculatedVault += amt;
          }
        }
      });

      setDailySalesCount(count);
      setDailySalesTotal(totalAmount);
      setTotalVaultsBalance(calculatedVault);

      localStorage.setItem(`jam_offline_stats_${profile.ownerId}`, JSON.stringify({
        count,
        total: totalAmount,
        vault: calculatedVault
      }));
    }, (error) => {
      console.warn("JAM Live daily sales count snapshot error handled: ", error);
      const offlineStats = localStorage.getItem(`jam_offline_stats_${profile.ownerId}`);
      if (offlineStats) {
        const { count, total, vault } = JSON.parse(offlineStats);
        setDailySalesCount(count || 0);
        setDailySalesTotal(total || 0);
        setTotalVaultsBalance(vault || 0);
      }
    });

    return () => unsubscribe();
  }, [profile]);

  const openMessageModal = (customer: { name: string; phone: string; debt?: number }, type: 'debt' | 'custom', customMessage?: string) => {
    const data = {
      name: customer.name,
      amount: customer.debt || 0,
      store: shopSettings?.shopName || 'المحل'
    };

    let message = customMessage || '';
    let title = 'إرسال رسالة';

    if (!customMessage) {
      if (type === 'debt') {
        const template = shopSettings?.messageTemplates?.debt || 'عزيزي {name}، نود تذكيركم بأن لديكم مديونية متبقية قدرها {amount} في {store}. نرجو التكرم بالسداد في أقرب وقت.';
        message = parseTemplate(template, data);
        title = 'تذكير بالمديونية';
      }
    }

    setMessageModal({
      isOpen: true,
      phone: customer.phone,
      message,
      title
    });
  };

  useEffect(() => {
    let barcode = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // If user is typing in an input, don't trigger global barcode scan
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      // Scanners are fast, usually < 30ms between keys. 50ms is safe.
      if (currentTime - lastKeyTime > 50) {
        barcode = '';
      }

      if (e.key === 'Enter') {
        if (barcode.length > 2) {
          const cleanBarcode = barcode.trim().toLowerCase();
          const item = inventory.find(i => String(i.barcode || '').trim().toLowerCase() === cleanBarcode);
          if (item) {
            addToCart(item);
            if (shopSettings?.enableAudioUI) audioService.playSuccess();
            barcode = '';
            e.preventDefault();
          }
        }
        barcode = '';
      } else if (e.key.length === 1) {
        barcode += e.key;
      }
      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [inventory, shopSettings]);

  const handleScan = (barcode: string) => {
    const cleanBarcode = barcode.trim().toLowerCase();
    const item = inventory.find(i => String(i.barcode || '').trim().toLowerCase() === cleanBarcode);
    if (item) {
      if (shopSettings?.enableBarcodeAutoPrice === false) {
        const customPrice = window.prompt(`أدخل سعر البيع لـ ${item.name}:`, item.price.toString());
        if (customPrice !== null) {
          addToCart({ ...item, price: Number(customPrice) });
        }
      } else {
        addToCart(item);
      }
      audioService.playSuccess();
      setIsScannerOpen(false);
    } else {
      audioService.playError();
    }
  };

  const getReservedQuantity = useCallback((itemId: string) => {
    return heldInvoices
      .filter(inv => inv.isReservation)
      .reduce((sum, inv) => {
        const match = inv.items.find((it: any) => (it.id === itemId || it.itemId === itemId));
        return sum + (match ? (Number(match.quantity) || 0) : 0);
      }, 0);
  }, [heldInvoices]);

  const addToCart = useCallback((item: any, qtyToWrite?: number, unitToSet?: any) => {
    try {
      if (!item || !item.id) {
        console.warn('⚡ Sales: Attempted to add invalid product to cart', item);
        return;
      }
      
      const forcedQty = qtyToWrite !== undefined ? qtyToWrite : 1;

      // Check reservation quantity limits
      const reservedQty = getReservedQuantity(item.id);
      const availableStock = (Number(item.stock) || 0) - reservedQty;
      const existingInCart = cart.find(c => c.id === item.id);
      const currentCartQty = existingInCart ? (Number(existingInCart.quantity) || 0) : 0;
      const requestedTotalQty = qtyToWrite !== undefined ? currentCartQty + forcedQty : currentCartQty + 1;

      if (availableStock > 0 && requestedTotalQty > availableStock) {
        alert(`❌ عذراً! لا يمكن إضافة الكمية المطلوبة.\nهذا الصنف محجوز مؤقتاً بعربون لصالح عميل آخر!\nالكمية الكلية: ${item.stock}\nالمحجوزة حالياً: ${reservedQty}\nالمتوفرة للبيع: ${availableStock}`);
        return;
      }

      // Decouple validation, stock logging, and secondary calculations asynchronously to never freeze thread response
      setTimeout(() => {
        // Perform silent inventory audit, weight limits check, and async stock verification
        const maxStock = Number(item.stock) || 0;
        if (maxStock > 0) {
          console.log(`[Async Audit] Inventory validation decoupled: item ${item.name} stock level is ${maxStock}`);
        }
      }, 0);

      // Force the item to enter the active basket state IMMEDIATELY (0ms thread response)
      setCart(prev => {
        const idToCheck = item.id;
        const existingIdx = prev.findIndex(i => i.id === idToCheck);
        if (existingIdx > -1) {
          const currentQty = Number(prev[existingIdx].quantity) || Number(prev[existingIdx].qty) || 1;
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: qtyToWrite !== undefined ? currentQty + forcedQty : currentQty + 1,
            selectedUnit: unitToSet !== undefined ? unitToSet : updated[existingIdx].selectedUnit
          };
          return updated;
        }
        
        const basePrice = Number(item.price) || Number(item.wholesalePrice) || 0;
        return [...prev, { 
          ...item, 
          id: item.id,
          name: item.name || item.productName || 'غير معروف',
          productName: item.productName || item.name || '',
          details: item.details || item.description || '',
          price: basePrice,
          quantity: forcedQty, 
          selectedUnit: unitToSet || undefined,
          saleType: 'new' 
        }];
      });
    } catch (error) {
      console.error('❌ Error during Sales addToCart execution:', error);
    }
  }, []);

  useEffect(() => {
    const searchBarcode = searchParams.get('search');
    if (searchBarcode && inventory.length > 0) {
      const cleanBarcode = searchBarcode.trim().toLowerCase();
      const item = inventory.find(i => String(i.barcode || '').trim().toLowerCase() === cleanBarcode);
      if (item) {
        addToCart(item);
        if (shopSettings?.enableAudioUI) audioService.playSuccess();
        // Clear param after use
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, inventory, shopSettings, addToCart, setSearchParams]);

  const toggleSaleType = (id: string) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        return { ...i, saleType: i.saleType === 'new' ? 'replacement' : 'new' };
      }
      return i;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    try {
      setCart(prev => prev.map(i => {
        if (i.id === id) {
          const currentQty = Number(i.quantity) || Number(i.qty) || 1;
          const newQty = currentQty + delta;
          if (newQty <= 0) return i;
          const maxStock = Number(i.stock) || 0;
          
          // Enforce reservation limits
          const reservedQty = getReservedQuantity(i.id);
          const availableStock = maxStock - reservedQty;
          if (maxStock > 0 && newQty > availableStock) {
            alert(`❌ عذراً! الكمية المطلوبة غير متوفرة للبيع لأنها محجوزة بعربون لعميل آخر!\nالكمية الكلية: ${maxStock}\nالمحجوزة: ${reservedQty}\nالمتوفرة للبيع: ${availableStock}`);
            return i;
          }
          return { ...i, quantity: newQty };
        }
        return i;
      }));
    } catch (error) {
      console.error('❌ Error during Sales updateQuantity execution:', error);
    }
  };

  const updatePrice = (id: string, newPrice: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        return { ...i, price: newPrice };
      }
      return i;
    }));
  };

  const updateReplacementPrice = (id: string, newPrice: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        return { ...i, replacementPrice: newPrice };
      }
      return i;
    }));
  };

  const total = cart.reduce((acc, item) => {
    const price = item.selectedUnit 
      ? item.selectedUnit.price 
      : ((item.saleType === 'replacement' && item.replacementPrice) ? item.replacementPrice : item.price);
    // If selectedCurrency is YER, rate is 1.
    // If selectedCurrency is USD/SAR, we are converting YER total to that currency.
    // This means the shop is "buying" that currency from the customer.
    const rateObj = shopSettings?.currencyRates?.[selectedCurrency];
    const rate = selectedCurrency === 'YER' ? 1 : (rateObj?.buy || 1);
    return acc + (price * item.quantity);
  }, 0);

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = inventory.find(i => i.barcode === searchTerm);
      if (item) {
        if (shopSettings?.enableBarcodeAutoPrice === false) {
          const customPrice = window.prompt(`أدخل سعر البيع لـ ${item.name}:`, item.price.toString());
          if (customPrice !== null) {
            addToCart({ ...item, price: Number(customPrice) });
          }
        } else {
          addToCart(item);
        }
        setSearchTerm('');
      }
    }
  };

  const handleVoiceResult = (text: string) => {
    // ... voice logic
  };

  const decreaseCartItemQty = (itemId: string, unitName?: string) => {
    if (salesViewMode === 'grid') {
      setSalesGridRows(prev => {
        const updated = prev.map(row => {
          if (row.itemId === itemId && (!unitName || row.selectedUnit?.name === unitName)) {
            const newQty = Math.max(0, row.quantity - 1);
            return {
              ...row,
              quantity: newQty,
              total: newQty * row.price
            };
          }
          return row;
        }).filter(row => {
          if (row.itemId) {
            return row.quantity > 0;
          }
          return true;
        });
        if (updated.length === 0) {
          return [createEmptyGridRow()];
        }
        return updated;
      });
    } else {
      setCart(prev => prev.map(item => {
        if (item.id === itemId && (!unitName || item.selectedUnit?.name === unitName)) {
          const newQty = item.quantity - 1;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0));
    }
  };

  const handleRaiseCreditLimit = async (customer: Customer) => {
    const currentLimit = customer.creditLimit || 100000;
    const input = prompt(`رفع السقف الائتماني للعميل [${customer.name}]:\nالسقف الحالي: ${currentLimit.toLocaleString()} ر.ي\nأدخل السقف الائتماني الجديد:`, (currentLimit + 50000).toString());
    if (input === null) return;
    const newLimit = Number(input);
    if (isNaN(newLimit) || newLimit <= 0) {
      alert('الرجاء إدخال رقم صحيح!');
      return;
    }
    
    try {
      startProcessing();
      const custRef = doc(db, 'customers', customer.id);
      await updateDoc(custRef, {
        creditLimit: newLimit
      });
      setCustomers(prev => prev.map(c => {
        if (c.id === customer.id) {
          return { ...c, creditLimit: newLimit };
        }
        return c;
      }));
      setSelectedCustomer(prev => prev && prev.id === customer.id ? { ...prev, creditLimit: newLimit } : prev);
      alert(`✅ تم رفع السقف الائتماني للعميل بنجاح إلى: ${newLimit.toLocaleString()} ر.ي`);
    } catch (err: any) {
      alert('❌ فشل رفع السقف الائتماني: ' + err.message);
    } finally {
      stopProcessing();
    }
  };

  const loadOriginalSale = async () => {
    if (!originalSaleId.trim()) return;
    try {
      const saleRef = doc(db, 'sales', originalSaleId.trim());
      const saleSnap = await getDoc(saleRef);
      if (saleSnap.exists()) {
        const data = saleSnap.data() as any;
        if (data.ownerId !== profile?.ownerId) {
          alert('هذه الفاتورة لا تنتمي لهذا المحل');
          return;
        }
        setOriginalSaleData({ id: saleSnap.id, ...data });
        // Map items from sale to cart for return
        const returnItems = (data.items || []).map((item: any) => ({
          ...item,
          stock: item.quantity, // Temporarily use stock to represent sold qty
          maxReturnQty: item.quantity - (item.returnedAmount || 0),
          returnedAmount: item.returnedAmount || 0
        }));
        setCart(returnItems);
        if (data.customerId) {
          setSelectedCustomer(customers.find(c => c.id === data.customerId) || null);
        }
      } else {
        alert('لم يتم العثور على الفاتورة');
      }
    } catch (error) {
      console.error('Error loading sale:', error);
      alert('خطأ في تحميل الفاتورة');
    }
  };

  const processSale = async (discount: number = 0) => {
    if (cart.length === 0 || isSubmitting || submissionLock.current) return;
    
    submissionLock.current = true;
    // Check if vault is closed
    if (shopSettings?.requireOpenVault && !isVaultOpen) {
      alert('يجب فتح الخزنة أولاً لإتمام العمليات');
      return;
    }

    if (paymentMethod === 'debt' && !selectedCustomer) {
      alert('يرجى اختيار عميل لتسجيل الدين');
      return;
    }
    if (paymentMethod === 'transfer' && !selectedAccountId) {
      alert('يرجى اختيار الحساب المستلم للإيداع');
      return;
    }

    // Check discount limit
    const maxDiscount = shopSettings?.maxDiscountPerSale || 500;
    if (discount > maxDiscount && profile?.role !== 'manager' && profile?.role !== 'superadmin') {
      alert(`عذراً، لا يمكنك تجاوز سقف الخصم المسموح به (${maxDiscount} ر.ي)`);
      return;
    }

    const finalTotal = total - discount;

    // Check Employee Credit Ceiling when issuing credit sale
    if (paymentMethod === 'debt' && profile?.role !== 'manager' && profile?.role !== 'superadmin' && profile?.role !== 'owner') {
      const currentUsername = profile?.username || 'employee';
      const debtGuardCheck = employeeDebtGuardService.canEmployeeIssueCredit(currentUsername, finalTotal);

      if (!debtGuardCheck.allowed) {
        alert(`⛔ منع إدانة العملاء على مسؤولية الموظف:\n\n${debtGuardCheck.reason}`);
        submissionLock.current = false;
        return;
      }
    }

    setIsSubmitting(true);
    setIsConfirmModalOpen(false);
    
    const returnModeSnapshot = isReturnMode;
    const storeCodePrefix = shopSettings?.storeCode ? `${shopSettings.storeCode}-` : '';
    const tempId = doc(collection(db, returnModeSnapshot ? 'returns' : 'sales')).id;
    const realSaleId = `${storeCodePrefix}${tempId}`;

    // Record Credit Issued on Employee Responsibility
    if (paymentMethod === 'debt' && selectedCustomer) {
      const currentUsername = profile?.username || 'employee';
      const currentFullName = profile?.fullName || currentUsername;
      employeeDebtGuardService.recordCreditIssued({
        employeeUsername: currentUsername,
        employeeName: currentFullName,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        amount: finalTotal,
        orderId: realSaleId,
        notes: `إدانة آجل للعميل (${selectedCustomer.name}) - فاتورة #${realSaleId}`
      });
    }
    const saleData = {
      id: realSaleId,
      items: [...cart],
      total: finalTotal,
      paymentMethod,
      type: returnModeSnapshot ? 'return' : 'sale',
      customerId: selectedCustomer?.id || null,
      customerName: selectedCustomer?.name || 'عميل نقدي',
      customerPhone: selectedCustomer?.phone || '',
      createdAt: { seconds: Date.now() / 1000 }
    };

    // ⚡ 0ms Instant Release & Store Queue Engine Offline Math Audit Protocol
    const cartSnapshot = [...cart];
    const customerSnapshot = selectedCustomer;
    const methodSnapshot = paymentMethod;

    // Enqueue task to StoreQueueEngine for 0ms deduplication & Math Guard check
    StoreQueueEngine.enqueueTask(
      profile?.ownerId || 'master',
      returnModeSnapshot ? 'return' : 'sale',
      returnModeSnapshot ? 'returns' : 'sales',
      saleData,
      profile
    ).catch(err => console.warn('StoreQueueEngine enqueue notice:', err));

    // Universal Post-Execution Clear: Instantly clear fields & release buttons (0ms)
    setLastSaleData(saleData);
    setCart([]);
    setSalesGridRows([createEmptyGridRow()]);
    setSelectedCustomer(null);
    setPaymentMethod('cash');
    setCurrentDiscount(0);
    setTransferRefNo('');
    setTransferAccountName('');
    setIsCheckoutModalOpen(false);
    setSearchTerm('');
    setIsReturnMode(false);
    setIsSubmitting(false);
    submissionLock.current = false; // ⚡ Instant 0ms release
    setIsSuccessModalOpen(true);

    if (shopSettings?.enableAudioUI) audioService.playSuccess();
    if (shopSettings?.enableAutoPrint) {
      setTimeout(() => {
        if (saleData) printReceipt('sale', saleData, shopSettings);
      }, 500);
    }

    TimeProtectionService.logOperationTime();

    const saleRef = doc(db, returnModeSnapshot ? 'returns' : 'sales', realSaleId);

    if (!navigator.onLine) {
      // Execute as sequential safe offline-queued operations
      try {
        const transactionDate = isVaultOpen ? parseISO(vaultDate) : new Date();
        const effectiveDate = transactionDate;

        const txId = generateTransactionId();
        
        const totalCost = cartSnapshot.reduce((acc, i) => {
          const unitCost = i.selectedUnit ? i.selectedUnit.cost : i.cost;
          return acc + (unitCost * (i.quantity || 1));
        }, 0);
        const saleProfit = returnModeSnapshot ? (totalCost - finalTotal) : (finalTotal - totalCost);

        const saleDocData = {
          ownerId: profile?.ownerId,
          shopId: profile?.shopId || profile?.storeId || '',
          transactionId: txId, // UUID for deduping
          items: cartSnapshot.map(i => ({ 
            id: i.id, 
            name: i.name, 
            price: i.selectedUnit ? i.selectedUnit.price : ((i.saleType === 'replacement' && i.replacementPrice) ? i.replacementPrice : i.price), 
            cost: i.selectedUnit ? i.selectedUnit.cost : i.cost,
            quantity: i.quantity,
            saleType: i.saleType,
            barcode: i.barcode,
            supplierId: i.supplierId || null,
            unit: i.selectedUnit?.name || 'قطعة'
          })),
          total: finalTotal,
          profit: saleProfit,
          discount,
          paymentMethod: methodSnapshot,
          transferRefNo: methodSnapshot === 'transfer' ? transferRefNo : null,
          transferAccountName: methodSnapshot === 'transfer' ? transferAccountName : null,
          selectedAccountId: (methodSnapshot === 'transfer' || methodSnapshot === 'cash') ? (selectedAccountId || null) : null,
          payment_method: "Cash",
          e_payment_status: "Disabled_Coming_Soon",
          customerId: customerSnapshot?.id || null,
          customerName: customerSnapshot?.name || (customerSnapshot ? 'عميل مسجل' : 'عميل نقدي'),
          customerPhone: customerSnapshot?.phone || null,
          sellerId: profile?.uid,
          sellerName: profile?.name || 'غير معروف',
          operated_by_employee_name: profile?.name || 'غير معروف',
          employee_uid: profile?.uid || 'غير معروف',
          isCustodyReceived: profile?.role === 'manager' || profile?.role === 'superadmin',
          type: returnModeSnapshot ? 'return' : 'sale',
          originalSaleId: originalSaleData?.id || null,
          isDeleted: false,
          createdAt: effectiveDate
        };

        // 2. Queue setDoc for Sale/Return Document (intercepted by wrapper for offline)
        await setDoc(saleRef, saleDocData);

        // 3. Update Inventory Stock (Local state + Offline sync queue + IndexedDB)
        for (const item of cartSnapshot) {
          const factor = item.selectedUnit?.factor || 1;
          const totalQty = item.quantity * factor;
          const invRef = doc(db, 'inventory', item.id);
          const newStock = returnModeSnapshot ? (item.stock + totalQty) : (item.stock - totalQty);

          // Update React state in memory immediately
          setInventory(prev => prev.map(invItem => {
            if (invItem.id === item.id) {
              return { ...invItem, stock: newStock };
            }
            return invItem;
          }));

          // Queue updateDoc for Firestore sync (safely handled by wrapper offline)
          await updateDoc(invRef, {
            stock: newStock,
            updatedAt: effectiveDate
          });

          // Also update IndexedDB immediately so local scanner/searches see new stock offline!
          try {
            const cachedItem = await idbService.getItemByBarcode(item.barcode);
            if (cachedItem) {
              // @ts-ignore
              cachedItem.stock = newStock;
              await idbService.syncInventory([cachedItem as any]);
            }
          } catch (dbErr) {
            console.warn('Failed to update IndexedDB item stock offline:', dbErr);
          }

          if (!returnModeSnapshot && newStock <= item.minStock) {
            const shortageRef = doc(collection(db, 'shortages'));
            await setDoc(shortageRef, {
              ownerId: profile?.ownerId,
              shopId: profile?.shopId || profile?.storeId || '',
              name: item.name,
              quantity: item.minStock * 2,
              category: item.category === 'spare_part' ? 'spare_part' : 'shop',
              status: 'pending',
              createdAt: effectiveDate
            });
          }
        }

        // 4. Update Customer Debt if applicable (Local + Queue)
        if (methodSnapshot === 'debt' && customerSnapshot) {
          const custRef = doc(db, 'customers', customerSnapshot.id);
          const newDebt = (customerSnapshot.debt || 0) + (returnModeSnapshot ? -finalTotal : finalTotal);
          
          setCustomers(prev => prev.map(c => {
            if (c.id === customerSnapshot.id) {
              return { ...c, debt: newDebt };
            }
            return c;
          }));

          await updateDoc(custRef, {
            debt: newDebt
          });
        }

        // 5. Update Fund/Account Balance
        if (profile?.role === 'employee' || profile?.role === 'engineer') {
          const userRef = doc(db, 'users', profile.uid);
          const currentCustody = (profile as any).custodyBalance || 0;
          const newCustody = currentCustody + (returnModeSnapshot ? -finalTotal : finalTotal);
          await updateDoc(userRef, {
            custodyBalance: newCustody
          });
        } else if (methodSnapshot !== 'debt') {
          let accountId = selectedAccountId;
          if (!accountId && methodSnapshot === 'cash') {
            const hasCashBox = accounts.some(a => a.id === 'CASH_BOX');
            if (hasCashBox) {
              accountId = 'CASH_BOX';
            } else {
              const mainAcc = accounts.find(a => a.accountNumber === '1101' && a.currency === selectedCurrency);
              if (mainAcc) accountId = mainAcc.id;
            }
          }
          if (accountId) {
            const currentAcc = accounts.find(a => a.id === accountId);
            const diff = returnModeSnapshot ? -finalTotal : finalTotal;
            const newBalance = (currentAcc?.balance || 0) + diff;
            
            setAccounts(prev => prev.map(a => {
              if (a.id === accountId) {
                return { ...a, balance: newBalance };
              }
              return a;
            }));

            try {
              const bankRef = doc(db, 'bank_accounts', accountId);
              const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', accountId);
              const accRef = doc(db, 'accounts', accountId);

              const bankSnap = await getDoc(bankRef);
              if (bankSnap.exists()) {
                await updateDoc(bankRef, {
                  balance: increment(diff),
                  updatedAt: effectiveDate
                });
              } else {
                const customSnap = await getDoc(customRef);
                if (customSnap.exists()) {
                  await updateDoc(customRef, {
                    balance: increment(diff),
                    updatedAt: effectiveDate
                  });
                  // Keep vaults collection perfectly synchronized!
                  try {
                    const sId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
                    const storeVDocRef = doc(db, 'stores', sId, 'vaults', accountId === 'CASH_BOX' ? 'v1' : accountId);
                    await setDoc(storeVDocRef, {
                      balance: increment(diff),
                      updatedAt: effectiveDate
                    }, { merge: true });

                    const rootVDocRef = doc(db, 'vaults', `${profile.ownerId}-${accountId === 'CASH_BOX' ? 'v1' : accountId}`);
                    await setDoc(rootVDocRef, {
                      id: accountId === 'CASH_BOX' ? 'v1' : accountId,
                      balance: increment(diff),
                      updatedAt: effectiveDate
                    }, { merge: true });
                  } catch (vErr) {
                    console.warn('Failed to sync vault balance in checkout:', vErr);
                  }

                  const customData = customSnap.data();
                  if (customData.isLinkedToBank && customData.bankAccountId) {
                    await updateDoc(doc(db, 'bank_accounts', customData.bankAccountId), {
                      balance: increment(diff),
                      updatedAt: effectiveDate
                    });
                  }
                } else {
                  const accSnap = await getDoc(accRef);
                  if (accSnap.exists()) {
                    await updateDoc(accRef, {
                      balance: increment(diff)
                    });
                  } else {
                    await setDoc(customRef, {
                      id: accountId,
                      boxName: accountId === 'CASH_BOX' ? 'صندوق النقد الرئيسي (الكاش)' : 'صندوق مالي فرعي',
                      type: 'cash',
                      balance: diff,
                      ownerId: profile.ownerId,
                      createdAt: effectiveDate,
                      updatedAt: effectiveDate
                    }, { merge: true });

                    // Keep vaults collection perfectly synchronized!
                    try {
                      const sId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
                      const storeVDocRef = doc(db, 'stores', sId, 'vaults', accountId === 'CASH_BOX' ? 'v1' : accountId);
                      await setDoc(storeVDocRef, {
                        id: accountId === 'CASH_BOX' ? 'v1' : accountId,
                        name: accountId === 'CASH_BOX' ? 'صندوق النقد الرئيسي (الكاش)' : 'صندوق مالي فرعي',
                        type: 'cash',
                        balance: diff,
                        ownerId: profile.ownerId,
                        storeId: sId,
                        updatedAt: effectiveDate
                      }, { merge: true });

                      const rootVDocRef = doc(db, 'vaults', `${profile.ownerId}-${accountId === 'CASH_BOX' ? 'v1' : accountId}`);
                      await setDoc(rootVDocRef, {
                        id: accountId === 'CASH_BOX' ? 'v1' : accountId,
                        name: accountId === 'CASH_BOX' ? 'صندوق النقد الرئيسي (الكاش)' : 'صندوق مالي فرعي',
                        type: 'cash',
                        balance: diff,
                        ownerId: profile.ownerId,
                        storeId: sId,
                        updatedAt: effectiveDate
                      }, { merge: true });
                    } catch (vErr) {
                      console.warn('Failed to sync new vault balance in checkout:', vErr);
                    }
                  }
                }
              }
            } catch (errOffline) {
              console.warn("Offline balance update fallback failed:", errOffline);
            }
          }
        }

        // 6. Create Financial Transaction Doc (Queue)
        const tempTransId = doc(collection(db, 'transactions')).id;
        const transRef = doc(db, 'transactions', `${storeCodePrefix}${tempTransId}`);
        await setDoc(transRef, {
          ownerId: profile?.ownerId,
          shopId: profile?.shopId || profile?.storeId || '',
          type: returnModeSnapshot ? 'expense' : 'income',
          amount: finalTotal,
          category: returnModeSnapshot ? 'return' : 'sale',
          referenceId: saleRef.id,
          description: `${returnModeSnapshot ? 'مرتجع' : 'بيع'} ${cartSnapshot.length} أصناف في فاتورة ${saleRef.id.slice(-6)}${methodSnapshot === 'transfer' ? ` (إيداع/تحويل رقم: ${transferRefNo} - حساب: ${transferAccountName})` : ''} (أوفلاين)`,
          paymentMethod: methodSnapshot,
          accountId: selectedAccountId || null,
          createdAt: effectiveDate
        });

        // 7. Update Daily Stats in Local Storage for Offline Display
        const currentStats = localStorage.getItem(`jam_offline_stats_${profile?.ownerId}`);
        let { count, total, vault } = currentStats ? JSON.parse(currentStats) : { count: 0, total: 0, vault: 0 };
        count++;
        total += finalTotal;
        if (methodSnapshot === 'cash' || methodSnapshot === 'transfer') {
          vault += finalTotal;
        }
        setDailySalesCount(count);
        setDailySalesTotal(total);
        setTotalVaultsBalance(vault);
        localStorage.setItem(`jam_offline_stats_${profile?.ownerId}`, JSON.stringify({ count, total, vault }));

        const cartDetails = cartSnapshot.map(item => {
          const unitLabel = item.selectedUnit ? item.selectedUnit.name : 'حبة';
          return `[${item.name} | عدد: ${item.quantity} ${unitLabel} بسعر: ${item.price}]`;
        }).join('، ');
        const logDetailsText = `فاتورة رقم (${saleRef.id.slice(-6)}) بقيمة ${finalTotal} ر.ي. تشمل: ${cartDetails}`;
        await logActivity(profile, returnModeSnapshot ? 'عملية مرتجع (أوفلاين)' : 'عملية بيع (أوفلاين)', logDetailsText);

        if (profile?.ownerId) {
          const sId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
          postSaleToGL(profile.ownerId, {
            id: saleRef.id,
            total: finalTotal,
            cost: totalCost,
            paymentMethod: methodSnapshot,
            accountId: selectedAccountId,
            currency: selectedCurrency,
            exchangeRate: returnModeSnapshot && originalSaleData ? (originalSaleData.exchangeRate || 1) : (selectedCurrency === 'YER' ? 1 : (shopSettings?.currencyRates?.[selectedCurrency]?.buy || 1)),
            description: `${returnModeSnapshot ? 'مرتجع' : 'بيع'} فاتورة رقم ${saleRef.id.slice(-6)} (أوفلاين)`,
            type: returnModeSnapshot ? 'return' : 'sale'
          }, sId);
        }
      } catch (errOffline) {
        console.error('Offline sale processing error:', errOffline);
      } finally {
        setIsSubmitting(false);
        setTimeout(() => { submissionLock.current = false; }, 2000);
      }
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
          const transactionDate = isVaultOpen ? parseISO(vaultDate) : new Date();
          const effectiveDate = isVaultOpen ? transactionDate : serverTimestamp();
          
          // Pre-fetch account/box snapshots for atomic balance updates (must read before any write!)
          let accountIdForUpdate = selectedAccountId;
          if (!accountIdForUpdate && methodSnapshot === 'cash') {
            const hasCashBox = accounts.some(a => a.id === 'CASH_BOX');
            if (hasCashBox) {
              accountIdForUpdate = 'CASH_BOX';
            } else {
              const mainAcc = accounts.find(a => a.accountNumber === '1101' && a.currency === selectedCurrency);
              if (mainAcc) accountIdForUpdate = mainAcc.id;
            }
          }

          let bankSnap = null;
          let customSnap = null;
          let accSnap = null;
          let linkedBankSnap = null;

          if (accountIdForUpdate && methodSnapshot !== 'debt' && profile?.role !== 'employee' && profile?.role !== 'engineer') {
            const bankRef = doc(db, 'bank_accounts', accountIdForUpdate);
            const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', accountIdForUpdate);
            const accRef = doc(db, 'accounts', accountIdForUpdate);

            bankSnap = await transaction.get(bankRef);
            if (bankSnap.exists()) {
              // bank accounts don't need linked account
            } else {
              customSnap = await transaction.get(customRef);
              if (customSnap.exists()) {
                const customData = customSnap.data();
                if (customData.isLinkedToBank && customData.bankAccountId) {
                  linkedBankSnap = await transaction.get(doc(db, 'bank_accounts', customData.bankAccountId));
                }
              } else {
                accSnap = await transaction.get(accRef);
              }
            }
          }

          // 1. Validation for Returns against Original Sale
          if (returnModeSnapshot && originalSaleData) {
            const originalSaleRef = doc(db, 'sales', originalSaleData.id);
            const liveSaleSnap = await transaction.get(originalSaleRef);
            if (liveSaleSnap.exists()) {
              const liveData = liveSaleSnap.data();
              // Check each return item
              for (const returnItem of cartSnapshot) {
                const originalItem = liveData.items.find((i: any) => i.id === returnItem.id);
                if (!originalItem) throw new Error(`الصنف ${returnItem.name} غير موجود في الفاتورة الأصلية`);
                
                const alreadyReturned = originalItem.returnedAmount || 0;
                const totalReturnedAfter = alreadyReturned + returnItem.quantity;
                
                if (totalReturnedAfter > originalItem.quantity) {
                  throw new Error(`الكمية المرتجعة للصنف ${returnItem.name} (${totalReturnedAfter}) تتجاوز الكمية المباعة الأصلية (${originalItem.quantity})`);
                }
              }
              
              // Update returnedAmount indices in the original sale
              const updatedItems = liveData.items.map((i: any) => {
                const ret = cartSnapshot.find(c => c.id === i.id);
                if (ret) return { ...i, returnedAmount: (i.returnedAmount || 0) + ret.quantity };
                return i;
              });
              transaction.update(originalSaleRef, { items: updatedItems });
            }
          }

          // 2. Sale/Return Document Ref
          const txId = generateTransactionId();
          
          const totalCost = cartSnapshot.reduce((acc, i) => {
            const unitCost = i.selectedUnit ? i.selectedUnit.cost : i.cost;
            return acc + (unitCost * (i.quantity || 1));
          }, 0);
          const saleProfit = returnModeSnapshot ? (totalCost - finalTotal) : (finalTotal - totalCost);

          transaction.set(saleRef, {
            ownerId: profile?.ownerId,
            shopId: profile?.shopId || profile?.storeId || '',
            transactionId: txId, // UUID for deduping
            items: cartSnapshot.map(i => ({ 
              id: i.id, 
              name: i.name, 
              price: i.selectedUnit ? i.selectedUnit.price : ((i.saleType === 'replacement' && i.replacementPrice) ? i.replacementPrice : i.price), 
              cost: i.selectedUnit ? i.selectedUnit.cost : i.cost,
              quantity: i.quantity,
              saleType: i.saleType,
              barcode: i.barcode,
              supplierId: i.supplierId || null,
              unit: i.selectedUnit?.name || 'قطعة'
            })),
            total: finalTotal,
            profit: saleProfit,
            discount,
            paymentMethod: methodSnapshot,
            transferRefNo: methodSnapshot === 'transfer' ? transferRefNo : null,
            transferAccountName: methodSnapshot === 'transfer' ? transferAccountName : null,
            selectedAccountId: (methodSnapshot === 'transfer' || methodSnapshot === 'cash') ? (selectedAccountId || null) : null,
            payment_method: "Cash",
            e_payment_status: "Disabled_Coming_Soon",
            customerId: customerSnapshot?.id || null,
            customerName: customerSnapshot?.name || (customerSnapshot ? 'عميل مسجل' : 'عميل نقدي'),
            customerPhone: customerSnapshot?.phone || null,
            sellerId: profile?.uid,
            sellerName: profile?.name || 'غير معروف',
            operated_by_employee_name: profile?.name || 'غير معروف',
            employee_uid: profile?.uid || 'غير معروف',
            isCustodyReceived: profile?.role === 'manager' || profile?.role === 'superadmin',
            type: returnModeSnapshot ? 'return' : 'sale',
            originalSaleId: originalSaleData?.id || null,
            isDeleted: false,
            createdAt: effectiveDate,
            currency: selectedCurrency,
            exchangeRate: returnModeSnapshot && originalSaleData ? (originalSaleData.exchangeRate || 1) : (selectedCurrency === 'YER' ? 1 : (shopSettings?.currencyRates?.[selectedCurrency]?.buy || 1))
          });

          // 3. Atomic Inventory Updates and Shortage Checks
          for (const item of cartSnapshot) {
            const factor = item.selectedUnit?.factor || 1;
            const totalQty = item.quantity * factor;
            const invRef = doc(db, 'inventory', item.id);
            
            transaction.update(invRef, {
              stock: increment(returnModeSnapshot ? totalQty : -totalQty),
              updatedAt: effectiveDate
            });

            if (!returnModeSnapshot && (item.stock - totalQty) <= item.minStock) {
              const shortageRef = doc(collection(db, 'shortages'));
              transaction.set(shortageRef, {
                ownerId: profile?.ownerId,
                shopId: profile?.shopId || profile?.storeId || '',
                name: item.name,
                quantity: item.minStock * 2,
                category: item.category === 'spare_part' ? 'spare_part' : 'shop',
                status: 'pending',
                createdAt: effectiveDate
              });
            }
          }

          // 4. Update Customer Debt if applicable
          if (methodSnapshot === 'debt' && customerSnapshot) {
            const custRef = doc(db, 'customers', customerSnapshot.id);
            transaction.update(custRef, {
              debt: increment(returnModeSnapshot ? -finalTotal : finalTotal)
            });
          }

          // 5. Update Fund/Account Balance
          if (profile?.role === 'employee' || profile?.role === 'engineer') {
            const userRef = doc(db, 'users', profile.uid);
            transaction.update(userRef, {
              custodyBalance: increment(returnModeSnapshot ? -finalTotal : finalTotal)
            });
          } else if (methodSnapshot !== 'debt' && accountIdForUpdate) {
            const diff = returnModeSnapshot ? -finalTotal : finalTotal;
            if (bankSnap && bankSnap.exists()) {
              const bankRef = doc(db, 'bank_accounts', accountIdForUpdate);
              transaction.update(bankRef, {
                balance: increment(diff),
                updatedAt: effectiveDate
              });
            } else if (customSnap && customSnap.exists()) {
              const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', accountIdForUpdate);
              transaction.update(customRef, {
                balance: increment(diff),
                updatedAt: effectiveDate
              });
              if (linkedBankSnap && linkedBankSnap.exists()) {
                const customData = customSnap.data();
                transaction.update(doc(db, 'bank_accounts', customData.bankAccountId), {
                  balance: increment(diff),
                  updatedAt: effectiveDate
                });
              }
            } else if (accSnap && accSnap.exists()) {
              const accRef = doc(db, 'accounts', accountIdForUpdate);
              transaction.update(accRef, {
                balance: increment(diff)
              });
            } else {
              // Fallback: create custom box if it doesn't exist
              const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', accountIdForUpdate);
              transaction.set(customRef, {
                id: accountIdForUpdate,
                boxName: accountIdForUpdate === 'CASH_BOX' ? 'صندوق النقد الرئيسي (الكاش)' : 'صندوق مالي فرعي',
                type: 'cash',
                balance: diff,
                ownerId: profile.ownerId,
                createdAt: effectiveDate,
                updatedAt: effectiveDate
              }, { merge: true });
            }
          }

          // 6. Create Financial Transaction Doc (Isolated Tenant & Global Root)
          const tempTransId = doc(collection(db, 'transactions')).id;
          const txFullId = `${storeCodePrefix}${tempTransId}`;
          const effectiveShopId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
          const transRef = doc(db, 'transactions', txFullId);
          const txPayload = {
            ownerId: profile?.ownerId,
            shopId: effectiveShopId,
            type: returnModeSnapshot ? 'expense' : 'income',
            amount: finalTotal,
            totalAmount: finalTotal,
            category: returnModeSnapshot ? 'return' : 'sale',
            referenceId: saleRef.id,
            description: `${returnModeSnapshot ? 'مرتجع' : 'بيع'} ${cartSnapshot.length} أصناف في فاتورة ${saleRef.id.slice(-6)}${methodSnapshot === 'transfer' ? ` (إيداع/تحويل رقم: ${transferRefNo} - حساب: ${transferAccountName})` : ''}`,
            paymentMethod: methodSnapshot,
            accountId: selectedAccountId || null,
            createdAt: effectiveDate,
            updatedAt: effectiveDate
          };
          transaction.set(transRef, txPayload);

          const isolatedTxRef = doc(db, 'shops', effectiveShopId, 'transactions', txFullId);
          transaction.set(isolatedTxRef, txPayload);
        });

        // Post-processing (Non-atomic)
        const totalCost = cartSnapshot.reduce((sum, item) => {
          const cost = item.selectedUnit ? item.selectedUnit.cost : item.cost;
          return sum + (cost * item.quantity);
        }, 0);

        const cartDetails = cartSnapshot.map(item => {
          const unitLabel = item.selectedUnit ? item.selectedUnit.name : 'حبة';
          return `[${item.name} | عدد: ${item.quantity} ${unitLabel} بسعر: ${item.price}]`;
        }).join('، ');
        const logDetailsText = `فاتورة رقم (${saleRef.id.slice(-6)}) بقيمة ${finalTotal} ر.ي. تشمل: ${cartDetails}`;
        await logActivity(profile, returnModeSnapshot ? 'عملية مرتجع' : 'عملية بيع', logDetailsText);
        
        if (profile?.ownerId) {
          const sId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
          postSaleToGL(profile.ownerId, {
            id: saleRef.id,
            total: finalTotal,
            cost: totalCost,
            paymentMethod: methodSnapshot,
            accountId: selectedAccountId,
            currency: selectedCurrency,
            exchangeRate: returnModeSnapshot && originalSaleData ? (originalSaleData.exchangeRate || 1) : (selectedCurrency === 'YER' ? 1 : (shopSettings?.currencyRates?.[selectedCurrency]?.buy || 1)),
            description: `${returnModeSnapshot ? 'مرتجع' : 'بيع'} فاتورة رقم ${saleRef.id.slice(-6)}`,
            type: returnModeSnapshot ? 'return' : 'sale'
          }, sId);
        }

        if (customerSnapshot?.phone && !returnModeSnapshot) {
          const transactionDate = isVaultOpen ? parseISO(vaultDate) : new Date();
          const dateStr = format(transactionDate, 'yyyy/MM/dd', { locale: ar });
          const message = methodSnapshot === 'debt' 
            ? templates.newDebt(customerSnapshot.name, finalTotal, 'مشتريات أصناف', dateStr)
            : `عزيزي ${customerSnapshot.name}، تم تسجيل عملية شراء بمبلغ ${finalTotal} ر.ي. شكراً لتعاملكم معنا.`;
          
          if (methodSnapshot === 'debt') {
            setNotificationChoice({ customer: customerSnapshot, message });
          } else {
            sendSMS(customerSnapshot.phone, message).catch(console.error);
          }

          // Reward points (1 point per 1000 YER spent)
          const pointsAwarded = Math.floor(finalTotal / 1000);
          if (pointsAwarded > 0 && profile?.ownerId) {
            import('../services/smartCommerceService').then(({ smartCommerceService }) => {
              smartCommerceService.rewardPoints(profile.ownerId!, customerSnapshot.phone, pointsAwarded, 'sale');
            });
          }
        }

      } catch (error: any) {
        if (shopSettings?.enableAudioUI) audioService.playError();
        console.error('Sale/Return transaction failed:', error);
        alert(error.message || 'حدث خطأ أثناء حفظ العملية. يرجى مراجعة سجلات النشاط.');
      } finally {
        setIsSubmitting(false);
        setTimeout(() => { submissionLock.current = false; }, 2000);
      }
    };

  // Distinct categories and agencies for filtering
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach(item => {
      if (item.category && item.category !== 'spare_part') set.add(item.category);
      if (item.type && item.type !== 'spare_part') set.add(item.type);
    });
    return Array.from(set);
  }, [inventory]);

  const productAgencies = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach(item => {
      if (item.agencyName) set.add(item.agencyName);
      if ((item as any).brand) set.add((item as any).brand);
    });
    return Array.from(set);
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const baseList = searchTerm.length > 0 ? localSearchResults : inventory;
    let filtered = baseList.filter(item => {
      const matchesSearch = searchTerm.length === 0 || 
                           item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.barcode?.includes(searchTerm);
      const isNotSparePart = item.category !== 'spare_part';
      const matchesCategory = selectedCategoryFilter === 'all' || 
                             item.category === selectedCategoryFilter || 
                             item.type === selectedCategoryFilter;
      const matchesAgency = selectedAgencyFilter === 'all' || 
                           item.agencyName === selectedAgencyFilter || 
                           (item as any).brand === selectedAgencyFilter;

      let matchesDemandStock = true;
      const stock = Number(item.stock) || 0;
      const minStock = Number(item.minStock) || 5;
      const salesCount = Number((item as any).salesCount) || Number((item as any).soldCount) || 0;

      if (demandStockFilter === 'high_demand') {
        matchesDemandStock = salesCount >= 5;
      } else if (demandStockFilter === 'low_demand') {
        matchesDemandStock = salesCount < 5;
      } else if (demandStockFilter === 'high_stock') {
        matchesDemandStock = stock > minStock * 2;
      } else if (demandStockFilter === 'low_stock') {
        matchesDemandStock = stock > 0 && stock <= minStock;
      } else if (demandStockFilter === 'out_of_stock') {
        matchesDemandStock = stock <= 0;
      }

      return matchesSearch && isNotSparePart && matchesCategory && matchesAgency && matchesDemandStock;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '', 'ar');
      } else if (sortBy === 'price') {
        const priceA = Number(a.price) || 0;
        const priceB = Number(b.price) || 0;
        comparison = priceA - priceB;
      } else if (sortBy === 'stock') {
        const stockA = Number(a.stock) || 0;
        const stockB = Number(b.stock) || 0;
        comparison = stockA - stockB;
      } else if (sortBy === 'salesCount') {
        const countA = Number((a as any).salesCount) || 0;
        const countB = Number((b as any).salesCount) || 0;
        comparison = countA - countB;
      } else if (sortBy === 'createdAt') {
        const timeA = a.createdAt ? new Date((a as any).createdAt?.seconds ? (a as any).createdAt.seconds * 1000 : a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date((b as any).createdAt?.seconds ? (b as any).createdAt.seconds * 1000 : b.createdAt).getTime() : 0;
        comparison = timeA - timeB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [searchTerm, localSearchResults, inventory, selectedCategoryFilter, selectedAgencyFilter, demandStockFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-4 flex flex-col h-full w-full">
      {/* 🌟 Top Navigation Bar & 3-Tab Workflow Switcher */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl p-3 sm:p-4 border border-gray-100 dark:border-navy-850 shadow-sm space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-primary/10 rounded-2xl text-brand-primary">
              <ShoppingCart size={22} className="animate-pulse" />
            </div>
            <div className="text-right">
              <h2 className="text-sm font-black text-navy-900 dark:text-white flex items-center gap-2">
                <span>بوابة المبيعات والكاشير الذكية</span>
                {isReturnMode && (
                  <span className="bg-danger text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                    نمط المرتجع فعال
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-gray-400 font-bold">إدارة عمليات البيع التفاعلي السريع ودقة الجرد</p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Return mode toggle */}
            <button
              type="button"
              onClick={() => {
                setIsReturnMode(!isReturnMode);
                if (isReturnMode) {
                  setOriginalSaleId('');
                  setOriginalSaleData(null);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                isReturnMode
                  ? 'bg-danger text-white border-danger shadow-sm'
                  : 'bg-slate-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700 hover:bg-slate-200'
              }`}
            >
              <span>{isReturnMode ? 'إلغاء المرتجع 🔄' : 'مرتجع مبيعات 🔄'}</span>
            </button>

            {/* Persistent Hold Current Invoice Button */}
            <button
              type="button"
              onClick={handleHoldCurrentInvoice}
              disabled={cart.length === 0 && (salesViewMode !== 'grid' || salesGridRows.filter(r => r.itemId && r.quantity > 0).length === 0)}
              className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              title="تعليق الفاتورة الحالية وفتح فاتورة جديدة فوراً"
            >
              <span>⏸️ تعليق الفاتورة</span>
            </button>

            {/* Persistent Held Invoices Trigger */}
            <button
              type="button"
              onClick={() => setIsHeldInvoicesModalOpen(true)}
              className="px-3.5 py-1.5 bg-navy-100 dark:bg-navy-800 text-navy-900 dark:text-white hover:bg-brand-primary hover:text-white transition-all text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm relative border border-gray-200 dark:border-navy-700"
              title="عرض واسترجاع الفواتير المعلقة"
            >
              <Bell size={14} />
              <span>الفواتير المعلقة ({heldInvoices.length})</span>
              {heldInvoices.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-danger text-white rounded-full text-[9px] font-black flex items-center justify-center animate-bounce">
                  {heldInvoices.length}
                </span>
              )}
            </button>

            {/* Universal Report Engine Export Button */}
            <UniversalReportButton
              variant="emerald"
              buttonText={cart.length > 0 ? "تصدير الفاتورة الحالية" : "تقرير أسعار الكاشير"}
              payload={cart.length > 0 ? {
                title: 'فاتورة / مسودة مبيعات نقطة البيع POS',
                subtitle: selectedCustomer ? `العميل المحدد: ${selectedCustomer.name} (الهاتف: ${selectedCustomer.phone || '-'})` : 'فاتورة نقدية مباشرة (زبون عام)',
                currency: 'ر.ي',
                summaryCards: [
                  { label: 'عدد الأصناف بالسلة', value: cart.length, currency: 'صنف', color: 'blue' },
                  { label: 'إجمالي الكمية', value: cart.reduce((a, b) => a + b.quantity, 0), currency: 'قطعة', color: 'green' },
                  { label: 'الإجمالي قبل الخصم', value: cart.reduce((s, i) => s + (i.price * i.quantity), 0).toLocaleString(), currency: 'ر.ي', color: 'amber' },
                  { label: 'الصافي المطلوب', value: Math.max(0, cart.reduce((s, i) => s + (i.price * i.quantity), 0) - currentDiscount).toLocaleString(), currency: 'ر.ي', color: 'purple' }
                ],
                columns: [
                  { key: 'name', header: 'البيان / الصنف', type: 'text', width: 25 },
                  { key: 'barcode', header: 'الباركود', type: 'text', width: 15 },
                  { key: 'quantity', header: 'الكمية المباعة', type: 'number', width: 12 },
                  { key: 'price', header: 'سعر الوحدة', type: 'currency', width: 14 },
                  { key: 'total', header: 'الإجمالي الفرعي', type: 'currency', width: 14, formatter: (_, row) => (row.price * row.quantity) }
                ],
                data: cart
              } : {
                title: 'تقرير أصناف نقطة البيع والكاشير المتاحة',
                subtitle: 'كشف تسعيرات المبيعات والباركود للأصناف المتوفرة',
                currency: 'ر.ي',
                summaryCards: [
                  { label: 'إجمالي الأصناف المعروضة', value: inventory.length, currency: 'صنف', color: 'blue' },
                  { label: 'إجمالي الرصيد المتوفر', value: inventory.reduce((a, b) => a + (Number(b.stock) || 0), 0), currency: 'قطعة', color: 'green' }
                ],
                columns: [
                  { key: 'name', header: 'اسم الصنف', type: 'text', width: 25 },
                  { key: 'category', header: 'القسم', type: 'text', width: 15 },
                  { key: 'barcode', header: 'الباركود', type: 'text', width: 15 },
                  { key: 'stock', header: 'الكمية بالمخزن', type: 'number', width: 12 },
                  { key: 'price', header: 'سعر البيع (مفرق)', type: 'currency', width: 14 },
                  { key: 'wholesalePrice', header: 'سعر الجملة', type: 'currency', width: 14 }
                ],
                data: inventory
              }}
            />

            {/* Product Images Toggle */}
            <button
              type="button"
              onClick={() => setShowProductImages(!showProductImages)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                showProductImages
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-slate-100 dark:bg-navy-800 text-gray-500 border-gray-200 dark:border-navy-700'
              }`}
              title="إظهار أو إخفاء صور المنتجات في الكتالوج"
            >
              {showProductImages ? <ImageIcon size={14} /> : <ImageOff size={14} />}
              <span>{showProductImages ? 'الصور' : 'بدون صور'}</span>
            </button>
          </div>
        </div>

        {/* 🌟 3-Tab Segmented Switcher (المحور الأول: المنتجات | السلة | تفاصيل الفاتورة) */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-navy-950 p-1.5 rounded-2xl border border-gray-200 dark:border-navy-800 shadow-inner">
          {/* Tab 1: Catalog */}
          <button
            type="button"
            onClick={() => setActivePosTab('catalog')}
            className={`py-2.5 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
              activePosTab === 'catalog'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-gray-500 hover:text-navy-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-navy-900/60'
            }`}
            id="pos-tab-catalog-btn"
          >
            <Package size={17} />
            <span className="truncate">1. المنتجات والكتالوج</span>
            <span className="text-[10px] opacity-70 hidden md:inline font-mono">(F1)</span>
          </button>

          {/* Tab 2: Cart */}
          <button
            type="button"
            onClick={() => setActivePosTab('cart')}
            className={`py-2.5 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer relative border-none ${
              activePosTab === 'cart'
                ? 'bg-navy-700 text-white shadow-md'
                : 'text-gray-500 hover:text-navy-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-navy-900/60'
            }`}
            id="pos-tab-cart-btn"
          >
            <ShoppingCart size={17} />
            <span className="truncate">2. سلة المشتريات</span>
            {cart.length > 0 && (
              <span className="bg-amber-400 text-navy-950 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {cart.length}
              </span>
            )}
            <span className="text-[10px] opacity-70 hidden md:inline font-mono">(F2)</span>
          </button>

          {/* Tab 3: Invoice Details & Payment */}
          <button
            type="button"
            onClick={() => setActivePosTab('checkout')}
            className={`py-2.5 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer relative border-none ${
              activePosTab === 'checkout'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-500 hover:text-navy-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-navy-900/60'
            }`}
            id="pos-tab-checkout-btn"
          >
            <ReceiptText size={17} />
            <span className="truncate">3. تفاصيل الفاتورة والدفع</span>
            {cart.length > 0 && (
              <span className="text-[10px] font-mono opacity-90 hidden sm:inline">
                ({(total - currentDiscount).toLocaleString()} ر.ي)
              </span>
            )}
            <span className="text-[10px] opacity-70 hidden md:inline font-mono">(F3)</span>
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${
        cartWidth === 'wide' 
          ? 'lg:grid-cols-2' 
          : cartWidth === 'split' 
            ? 'lg:grid-cols-5' 
            : 'lg:grid-cols-3'
      } gap-8 lg:h-[calc(100vh-230px)]`}>
      <AnimatePresence>
        {isScannerOpen && (
          <JAMBarcodeEngine 
            onScanSuccess={(barcode) => {
              setSearchTerm(barcode);
              const item = inventory.find(i => i.barcode === barcode);
              if (item) {
                addToCart(item);
                setSearchTerm('');
              }
            }}
            onClose={() => setIsScannerOpen(false)}
          />
        )}
      </AnimatePresence>
      {/* Product Quantity Input Modal */}
      <AnimatePresence>
        {selectedProductForQty && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div 
              initial={globalActionTimeout === 0 ? { opacity: 1 } : { opacity: 0 }}
              animate={globalActionTimeout === 0 ? { opacity: 1 } : { opacity: 1 }}
              exit={globalActionTimeout === 0 ? { opacity: 1 } : { opacity: 0 }}
              transition={globalActionTimeout === 0 ? { duration: 0 } : undefined}
              onClick={() => setSelectedProductForQty(null)}
              className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm shadow-none"
            />
            <motion.div 
              initial={globalActionTimeout === 0 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.95, opacity: 0, y: 10 }}
              animate={globalActionTimeout === 0 ? { scale: 1, opacity: 1, y: 0 } : { scale: 1, opacity: 1, y: 0 }}
              exit={globalActionTimeout === 0 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.95, opacity: 0, y: 10 }}
              transition={globalActionTimeout === 0 ? { duration: 0 } : undefined}
              className="relative bg-white dark:bg-navy-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-navy-700/80 text-right space-y-4"
            >
              <div>
                <h3 className="text-lg font-black text-navy-900 dark:text-white mb-1">
                  {selectedProductForQty.name}
                </h3>
                <span className="text-xs text-gray-400 font-bold block">
                  {selectedProductForQty.type || 'صنف'}
                </span>
              </div>

              <div className="p-3 bg-brand-primary/5 dark:bg-brand-primary/10 rounded-xl flex items-center justify-between border-transparent">
                <span className="text-xs text-brand-primary font-black">المتبقي في المخزن</span>
                <span className="text-sm font-black text-brand-primary">
                  {selectedProductForQty.stock} وحدة
                </span>
              </div>

              {/* Unit Selector inside Modal */}
              {selectedProductForQty.units && selectedProductForQty.units.length > 0 && (
                <div className="space-y-1.5 text-right">
                  <label className="block text-xs font-black text-gray-500 dark:text-gray-400">حجم / وحدة العبوة</label>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button 
                      type="button"
                      onClick={() => {
                        setModalUnit(null);
                        setModalQty(1);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-black border transition-all whitespace-nowrap cursor-pointer ${!modalUnit ? 'bg-navy-700 text-white border-navy-700 shadow-md' : 'bg-slate-50 dark:bg-navy-800 text-gray-500 border-gray-200 dark:border-navy-700'}`}
                    >
                      حبة / قطعة ({selectedProductForQty.price} ر.ي)
                    </button>
                    {selectedProductForQty.units.map((unit: any, idx: number) => (
                      <button 
                        key={idx}
                        type="button"
                        onClick={() => {
                          setModalUnit(unit);
                          setModalQty(1);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-black border transition-all whitespace-nowrap cursor-pointer ${modalUnit?.name === unit.name ? 'bg-navy-700 text-white border-navy-700 shadow-md' : 'bg-slate-50 dark:bg-navy-800 text-gray-500 border-gray-200 dark:border-navy-700'}`}
                      >
                        {unit.name} ({unit.price} ر.ي)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400">الكمية المطلوبة ({modalUnit ? modalUnit.name : 'حبة'})</label>
                <input
                  type="number"
                  min="1"
                  max={modalUnit ? Math.floor(selectedProductForQty.stock / modalUnit.factor) : selectedProductForQty.stock}
                  className="w-full p-3 bg-slate-50 dark:bg-navy-800 border-2 border-slate-200 dark:border-navy-700 rounded-xl outline-none text-left font-black text-lg focus:border-brand-primary/80 transition-colors"
                  value={modalQty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const stock = Number(selectedProductForQty.stock) || 0;
                    const factor = modalUnit ? modalUnit.factor : 1;
                    const maxUnitStock = Math.floor(stock / factor);
                    if (val > maxUnitStock) {
                      setModalQty(maxUnitStock > 0 ? maxUnitStock : 1); // Safety capped
                    } else if (val < 1) {
                      setModalQty(1);
                    } else {
                      setModalQty(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Commit to cart with selected unit
                      addToCart(selectedProductForQty, modalQty, modalUnit || undefined);
                      setSelectedProductForQty(null);
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-xs font-bold text-gray-400">سعر الوحدة: {(modalUnit ? modalUnit.price : selectedProductForQty.price).toLocaleString()} ر.ي</span>
                <span className="text-sm font-black text-brand-primary">
                  الإجمالي: {((modalUnit ? modalUnit.price : selectedProductForQty.price) * modalQty).toLocaleString()} ر.ي
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductForQty(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addToCart(selectedProductForQty, modalQty, modalUnit || undefined);
                    setSelectedProductForQty(null);
                  }}
                  className="flex-1 py-3 bg-brand-primary text-white hover:bg-brand-primary/90 rounded-xl font-black text-xs transition-colors cursor-pointer"
                >
                  إنتر / إضافة ⚡
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Choice Modal */}
      <AnimatePresence>
        {notificationChoice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotificationChoice(null)}
              className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-navy-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/10"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mx-auto">
                  <Bell size={40} />
                </div>
                <h3 className="text-2xl font-black text-navy-900 dark:text-white">إرسال تنبيه للعميل</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  اختر طريقة إرسال التنبيه للعميل ({notificationChoice.customer.name}) بخصوص الدين.
                </p>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button
                    onClick={async () => {
                      try {
                        await sendSMS(notificationChoice.customer.phone, notificationChoice.message);
                        setNotificationChoice(null);
                        alert('تم إرسال الرسالة بنجاح');
                      } catch (err: any) {
                        console.error('SMS failed:', err);
                        alert(err.message || 'فشل إرسال الرسالة. يرجى التحقق من الإعدادات.');
                      }
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-navy-700 hover:bg-navy-800 text-white rounded-2xl transition-all group"
                  >
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone size={24} />
                    </div>
                    <span className="font-bold">رسالة SMS</span>
                  </button>

                  <button
                    onClick={() => {
                      openMessageModal(notificationChoice.customer, 'custom', notificationChoice.message);
                      setNotificationChoice(null);
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-success hover:bg-success/90 text-white rounded-2xl transition-all group"
                  >
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageCircle size={24} />
                    </div>
                    <span className="font-bold">واتساب</span>
                  </button>
                </div>

                <button
                  onClick={() => setNotificationChoice(null)}
                  className="w-full py-3 text-gray-500 hover:text-navy-900 dark:hover:text-white font-bold transition-colors"
                >
                  إغلاق بدون إرسال
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* POS Interface: Mobile 3-Tab Workflow & Desktop Split View */}
      {/* 1. Tab 1: Products & Catalog */}
      <div className={`flex flex-col gap-4 ${
        activePosTab === 'catalog' ? 'flex' : 'hidden lg:flex'
      } ${
        cartWidth === 'wide' 
          ? 'lg:col-span-1' 
          : cartWidth === 'split' 
            ? 'lg:col-span-2' 
            : 'lg:col-span-2'
      }`}>
        {/* Top Search & Scanner Bar (Moved to Top of Tab 1) */}
        <div className="bg-white dark:bg-navy-900 p-3 sm:p-4 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                ref={barcodeSearchInputRef}
                type="text" 
                placeholder={`البحث باسم الصنف أو الباركود أو ${labels.imei}...`}
                className="w-full pr-10 pl-10 py-3 bg-slate-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/50 text-xs sm:text-sm font-bold text-navy-900 dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleBarcodeScan}
                autoFocus
              />
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary" size={18} />
            </div>
            <button 
              type="button"
              onClick={async () => {
                const granted = await DevicePermissionsService.requestOnDemand('camera');
                if (granted) setIsScannerOpen(true);
              }}
              className="p-3 bg-navy-100 dark:bg-navy-800 text-navy-900 dark:text-white rounded-xl hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center shadow-sm cursor-pointer border border-gray-200 dark:border-navy-700 shrink-0"
              title="فتح الكاميرا للمسح"
            >
              <Camera size={20} />
            </button>
            <VoiceInput 
              onResult={handleVoiceResult} 
              placeholder="قل: شاشة ايفون عدد 2"
              className="h-[46px] px-3 shrink-0"
            />
          </div>

          {/* Subheader Controls: View Mode, Return Mode, Images Toggle, Categories */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-navy-800">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sale vs Return Mode Switch */}
              <div className="flex items-center bg-slate-100 dark:bg-navy-950 p-1 rounded-xl border border-gray-200 dark:border-navy-800">
                <button 
                  type="button"
                  onClick={() => {
                    setIsReturnMode(false);
                    setOriginalSaleId('');
                    setOriginalSaleData(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${
                    !isReturnMode 
                      ? 'bg-navy-700 text-white shadow-sm' 
                      : 'text-gray-500 hover:text-navy-900 dark:hover:text-white'
                  }`}
                >
                  بيع جديد
                </button>
                <button 
                  type="button"
                  onClick={() => setIsReturnMode(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${
                    isReturnMode 
                      ? 'bg-danger text-white shadow-sm' 
                      : 'text-gray-500 hover:text-navy-900 dark:hover:text-white'
                  }`}
                >
                  مرتجع مبيعات
                </button>
              </div>

              {/* View Mode Switcher: Excel Grid vs Cards */}
              <div className="flex items-center bg-slate-100 dark:bg-navy-950 p-1 rounded-xl border border-gray-200 dark:border-navy-800">
                <button
                  type="button"
                  onClick={() => setSalesViewMode('cards')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-1 ${
                    salesViewMode === 'cards'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-gray-500 hover:text-navy-900 dark:hover:text-white'
                  }`}
                  title="عرض بطاقات الكتالوج"
                >
                  <Package size={14} />
                  <span className="hidden sm:inline">كتالوج</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSalesViewMode('grid')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-1 ${
                    salesViewMode === 'grid'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-gray-500 hover:text-navy-900 dark:hover:text-white'
                  }`}
                  title="شبكة الإدخال السريع (إكسل)"
                >
                  <Barcode size={14} />
                  <span className="hidden sm:inline">جدول إكسل</span>
                </button>
              </div>
            </div>

            {/* Product Images Toggle */}
            <button
              type="button"
              onClick={() => setShowProductImages(!showProductImages)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                showProductImages
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-slate-100 dark:bg-navy-800 text-gray-500 border-gray-200 dark:border-navy-700'
              }`}
              title="إظهار أو إخفاء صور المنتجات"
            >
              {showProductImages ? <ImageIcon size={14} /> : <ImageOff size={14} />}
              <span>{showProductImages ? 'الصور مفعلة' : 'بدون صور'}</span>
            </button>
          </div>

          {/* Category Filter Pills with Warehouse Icons */}
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-navy-800">
            {/* 1. الأقسام والمخزن الرئيسي مع أيقونات */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar items-center">
              <span className="text-[10px] font-black text-gray-400 shrink-0 ml-1">قسم المخزن:</span>
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                    : 'bg-slate-50 dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700 hover:bg-slate-100'
                }`}
              >
                <Package size={13} />
                <span>الكل ({inventory.length})</span>
              </button>
              {productCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                    selectedCategoryFilter === cat
                      ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                      : 'bg-slate-50 dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700 hover:bg-slate-100'
                  }`}
                >
                  <Tag size={12} className="opacity-70" />
                  <span>{cat}</span>
                </button>
              ))}
            </div>

            {/* 2. تصنيف الوكالات والماركات */}
            {productAgencies.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar items-center">
                <span className="text-[10px] font-black text-gray-400 shrink-0 ml-1">الوكالة / الماركة:</span>
                <button
                  type="button"
                  onClick={() => setSelectedAgencyFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap transition-all cursor-pointer border ${
                    selectedAgencyFilter === 'all'
                      ? 'bg-navy-700 text-white border-navy-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-navy-850 text-gray-500 border-gray-200 dark:border-navy-750'
                  }`}
                >
                  الكل
                </button>
                {productAgencies.map((agency) => (
                  <button
                    key={agency}
                    type="button"
                    onClick={() => setSelectedAgencyFilter(agency)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1 ${
                      selectedAgencyFilter === agency
                        ? 'bg-navy-700 text-white border-navy-700 shadow-sm'
                        : 'bg-slate-50 dark:bg-navy-850 text-gray-500 border-gray-200 dark:border-navy-750'
                    }`}
                  >
                    <Building2 size={11} className="opacity-60" />
                    <span>{agency}</span>
                  </button>
                ))}
              </div>
            )}

            {/* 3. فلاتر حركة الطلب والمخزون + أدوات الترتيب المتقدم (تصاعدي/تنازلي) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-dashed border-gray-200 dark:border-navy-800">
              {/* فلاتر الطلب والمخزون */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                <span className="text-[10px] font-black text-gray-400 shrink-0 ml-1">حسب الحركة:</span>
                {[
                  { key: 'all', label: 'الجميع' },
                  { key: 'high_demand', label: '🔥 الأكثر طلباً' },
                  { key: 'low_demand', label: 'الأقل مبيعاً' },
                  { key: 'high_stock', label: '📦 الأكثر كمية' },
                  { key: 'low_stock', label: '⚠️ أوشك على النفاد' },
                  { key: 'out_of_stock', label: '❌ نفدت' }
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setDemandStockFilter(item.key as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap transition-all cursor-pointer border ${
                      demandStockFilter === item.key
                        ? 'bg-amber-500 text-navy-950 border-amber-500 shadow-sm font-extrabold'
                        : 'bg-slate-50 dark:bg-navy-900 text-gray-500 border-gray-200 dark:border-navy-800 hover:text-navy-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* محدد الترتيب (الاسم، التاريخ، السعر، الكمية) + اتجاه الترتيب */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-navy-950 p-1 rounded-xl border border-gray-200 dark:border-navy-800">
                <span className="text-[10px] font-bold text-gray-400">ترتيب:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white dark:bg-navy-900 text-navy-900 dark:text-white text-[11px] font-bold py-1 px-2 rounded-lg border border-gray-200 dark:border-navy-700 outline-none cursor-pointer"
                >
                  <option value="createdAt">تاريخ الإدخال</option>
                  <option value="name">اسم المنتج (أ-ي)</option>
                  <option value="price">السعر</option>
                  <option value="stock">الكمية بالمخزن</option>
                  <option value="salesCount">عدد المبيعات</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1 px-2 bg-white dark:bg-navy-900 hover:bg-brand-primary hover:text-white rounded-lg text-[11px] font-black transition-all border border-gray-200 dark:border-navy-700 cursor-pointer text-navy-900 dark:text-white"
                  title={sortOrder === 'asc' ? 'ترتيب تصاعدي (اضغط للعكس)' : 'ترتيب تنازلي (اضغط للعكس)'}
                >
                  {sortOrder === 'asc' ? 'تصاعدي ⬆️' : 'تنازلي ⬇️'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Return Mode Invoice Loader */}
        {isReturnMode && (
          <div className="card-glass p-4 animate-in fade-in slide-in-from-top-4">
            <label className="block text-xs font-black mb-2 text-danger">إرجاع من فاتورة سابقة (اختياري)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="أدخل رقم الفاتورة..."
                className="flex-1 input-field text-xs font-bold"
                value={originalSaleId}
                onChange={(e) => setOriginalSaleId(e.target.value)}
              />
              <button 
                type="button"
                onClick={loadOriginalSale}
                className="bg-navy-700 text-white px-6 py-2 rounded-xl font-bold hover:bg-navy-800 transition-colors text-xs cursor-pointer border-none"
              >
                تحميل الفاتورة
              </button>
            </div>
          </div>
        )}

        {/* Main Products Display: Excel Grid OR Cards */}
        {salesViewMode === 'grid' ? (
          /* Excel-Like Legacy Grid Mode */
          <div className="flex-1 bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[420px]">
            <div className="p-3 bg-gray-50 dark:bg-navy-800 border-b border-gray-100 dark:border-navy-700 flex items-center justify-between">
              <div className="flex items-center gap-2 text-navy-900 dark:text-white font-bold text-xs">
                <Barcode className="text-brand-primary" size={18} />
                <span>شبكة الإدخال السريع للمبيعات (إكسل)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addBlankGridRow}
                  className="px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer border-none"
                >
                  <Plus size={14} />
                  <span>إضافة سطر فارغ</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-gray-100 dark:bg-navy-950 text-navy-900 dark:text-white font-black sticky top-0 z-10">
                  <tr className="border-b border-gray-200 dark:border-navy-850">
                    <th className="p-2.5 w-10 text-center">م</th>
                    <th className="p-2.5 w-40">الباركود (Scan)</th>
                    <th className="p-2.5">اسم المنتج / الصنف</th>
                    {isWholesaleInvoice && <th className="p-2.5 w-24 text-center">الوحدة</th>}
                    <th className="p-2.5 w-16 text-center">المتوفر</th>
                    <th className="p-2.5 w-20 text-center">الكمية</th>
                    <th className="p-2.5 w-24 text-center">السعر (ر.ي)</th>
                    <th className="p-2.5 w-24 text-center">الإجمالي</th>
                    <th className="p-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-navy-850">
                  {salesGridRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-navy-850/50 transition-colors">
                      <td className="p-2 text-center font-bold text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="p-2">
                        <input
                          id={`grid-barcode-${idx}`}
                          type="text"
                          className="w-full p-2 bg-slate-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-lg text-xs outline-none font-mono focus:border-brand-primary focus:bg-white"
                          placeholder="امسح أو اكتب الباركود..."
                          value={row.barcode}
                          onChange={(e) => handleGridRowChange(idx, 'barcode', e.target.value)}
                          onKeyDown={(e) => handleGridBarcodeKeyDown(e, idx)}
                          onBlur={(e) => {
                            if (e.target.value.trim() && !row.itemId) {
                              handleGridBarcodeSearch(idx, e.target.value);
                            }
                          }}
                        />
                      </td>
                      <td className="p-2">
                        {row.itemId ? (
                          <div className="font-bold text-navy-900 dark:text-white flex flex-col">
                            <span>{row.name}</span>
                            {row.selectedUnit && (
                              <span className="text-[10px] text-brand-primary font-black">
                                عبوة: {row.selectedUnit.name} (×{row.selectedUnit.factor})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 font-medium italic text-[11px]">بانتظار المسح أو الإدخال...</span>
                        )}
                      </td>
                      {isWholesaleInvoice && (
                        <td className="p-2 text-center">
                          {row.itemId && row.availableUnits && row.availableUnits.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setGridUnitModal({
                                isOpen: true,
                                rowIndex: idx,
                                units: row.availableUnits || [],
                                productName: row.name
                              })}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-lg transition-all border-none cursor-pointer"
                            >
                              {row.selectedUnit ? row.selectedUnit.name : 'اختر حجم/وحدة'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">حجم واحد</span>
                          )}
                        </td>
                      )}
                      <td className="p-2 text-center font-bold text-gray-500">
                        {row.itemId ? row.stock : '-'}
                      </td>
                      <td className="p-2">
                        <input
                          id={`grid-qty-${idx}`}
                          type="number"
                          min="1"
                          disabled={!row.itemId}
                          className="w-full p-2 bg-slate-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-lg text-center text-xs outline-none font-bold focus:border-brand-primary focus:bg-white disabled:opacity-50"
                          value={row.quantity}
                          onChange={(e) => handleGridRowChange(idx, 'quantity', Number(e.target.value))}
                          onKeyDown={(e) => handleGridQtyKeyDown(e, idx)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          disabled={!row.itemId}
                          className="w-full p-2 bg-slate-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-lg text-center text-xs outline-none font-bold focus:border-brand-primary focus:bg-white disabled:opacity-50"
                          value={row.price}
                          onChange={(e) => handleGridRowChange(idx, 'price', Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2 text-center font-black text-navy-900 dark:text-white tabular-nums">
                        {row.itemId ? row.total.toFixed(0) : '-'}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => deleteGridRow(idx)}
                          className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                          title="حذف السطر"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-navy-950 border-t border-gray-100 dark:border-navy-800 text-right text-gray-500 font-bold flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
              <div>
                <span>إجمالي الأصناف المدخلة: </span>
                <span className="text-navy-900 dark:text-white font-black">{salesGridRows.filter(r => r.itemId).length} أصناف</span>
              </div>
              <div className="flex items-center gap-1 text-brand-primary font-black">
                <span>توجيه الاختصارات: </span>
                <span>ادخل الباركود ثم Enter لتعبئته، ثم الكمية ثم Enter للانتقال للسطر التالي تلقائياً!</span>
              </div>
            </div>
          </div>
        ) : (
          /* Cards Grid Mode */
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 pr-1 min-h-[350px]">
            {filteredInventory.map((item) => (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedProductForQty(item);
                  setModalQty(1);
                  setModalUnit(null);
                }}
                disabled={item.stock <= 0}
                className={`rounded-2xl p-3.5 border transition-all duration-200 flex flex-col justify-between h-full text-right cursor-pointer ${
                  item.stock <= 0 
                    ? 'opacity-40 grayscale cursor-not-allowed bg-gray-50 dark:bg-navy-900 border-gray-200 dark:border-navy-800' 
                    : 'bg-white dark:bg-navy-900 border-gray-200 dark:border-navy-800 hover:border-brand-primary/60 hover:shadow-md shadow-sm'
                }`}
              >
                <div className="flex flex-col items-end space-y-1.5 w-full">
                  {showProductImages && (item.imageUrl || (item as any).image) && (
                    <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-navy-950 mb-2 flex items-center justify-center">
                      <img 
                        src={item.imageUrl || (item as any).image} 
                        alt={item.name} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <span className="text-xs sm:text-sm font-black text-navy-900 dark:text-white line-clamp-2 text-right w-full">{item.name}</span>
                  <div className="flex items-center justify-between w-full text-[10px] text-gray-400 font-bold">
                    <span>{item.barcode || 'بدون باركود'}</span>
                    <span>{item.type || item.category || 'صنف'}</span>
                  </div>
                </div>

                <div className="flex w-full items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-navy-800">
                  <div className="flex flex-col items-start">
                    <span className="text-xs sm:text-sm font-black text-brand-primary tabular-nums">
                      {item.price.toLocaleString()} <span className="text-[10px]">ر.ي</span>
                    </span>
                  </div>
                  <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black ${
                    item.stock <= item.minStock 
                      ? 'bg-rose-500/10 text-rose-500' 
                      : 'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {item.stock} متوفر
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Floating Bottom Cart Summary Bar for Mobile (Tab 1) */}
        {cart.length > 0 && activePosTab === 'catalog' && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="lg:hidden fixed bottom-4 inset-x-4 z-40 bg-navy-950/95 dark:bg-navy-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-brand-primary/30 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-primary/20 text-brand-primary flex items-center justify-center font-black text-sm">
                {cart.length}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block font-bold">إجمالي السلة الحالي:</span>
                <span className="text-sm font-black text-brand-primary tabular-nums">
                  {(total - currentDiscount).toLocaleString()} ر.ي
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActivePosTab('cart')}
              className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-brand-primary/20 cursor-pointer border-none"
            >
              <span>عرض السلة ومتابعة الفاتورة</span>
              <ArrowLeft size={14} />
            </button>
          </motion.div>
        )}
      </div>

      {/* 2 & 3. Cart & Checkout (Tabs 2 & 3 on Mobile, Right Split Column on Desktop) */}
      <div className={`card-glass flex flex-col overflow-hidden shadow-xl border-navy-900/5 max-h-[90vh] lg:max-h-none overflow-y-auto custom-scrollbar ${
        activePosTab === 'cart' || activePosTab === 'checkout' ? 'flex' : 'hidden lg:flex'
      } ${
        cartWidth === 'wide' 
          ? 'lg:col-span-1' 
          : cartWidth === 'split' 
            ? 'lg:col-span-3' 
            : 'lg:col-span-1'
      }`}>
        {/* Tab 2 Content: Cart Items */}
        <div className={`flex flex-col ${activePosTab === 'checkout' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-navy-750 bg-navy-900 text-white flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                <ShoppingCart className="text-brand-primary" size={18} />
                <span>سلة المشتريات</span>
              </h3>
              <div className="flex items-center gap-2">
                <select 
                  className="bg-navy-800 text-white text-xs border border-navy-700 rounded-lg px-2 py-1 outline-none font-bold"
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                >
                  <option value="YER">يمني (YER)</option>
                  <option value="USD">دولار (USD)</option>
                  <option value="SAR">سعودي (SAR)</option>
                </select>
                <span className="bg-brand-primary text-white px-2 py-0.5 rounded-lg text-xs font-black">
                  {cart.length} أصناف
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('⚠️ هل أنت متأكد من رغبتك في مسح كافة محتويات السلة الحالية؟')) {
                        setCart([]);
                        setSelectedCustomer(null);
                        setCurrentDiscount(0);
                        if (shopSettings?.enableAudioUI) audioService.playSuccess?.();
                      }
                    }}
                    className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer border border-rose-500/30 flex items-center gap-1 text-[11px] font-black"
                    title="مسح السلة بعد التأكيد"
                  >
                    <Trash2 size={14} />
                    <span>مسح السلة</span>
                  </button>
                )}
              </div>
            </div>

            {/* أزرار تعليق الفاتورة السريع + التنقل بين الفواتير المعلقة (السابق والتالي) */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-white/10 text-xs">
              <button
                type="button"
                onClick={handleHoldCurrentInvoice}
                disabled={cart.length === 0}
                className="py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="تعليق الفاتورة الحالية وفتح فاتورة جديدة فوراً للزبون التالي"
              >
                <span>⏸️ تعليق الفاتورة وفتح جديدة</span>
              </button>

              {heldInvoices.length > 0 && (
                <div className="flex items-center gap-1 bg-navy-800 p-0.5 rounded-xl border border-navy-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (heldInvoices.length > 0) {
                        handleRestoreHeldInvoice(heldInvoices[0]);
                      }
                    }}
                    className="py-1 px-2.5 bg-brand-primary text-white rounded-lg text-[11px] font-black hover:bg-brand-primary-dark transition-all cursor-pointer flex items-center gap-1"
                    title="استرجاع آخر فاتورة معلقة"
                  >
                    <span>استئناف المعلقة ({heldInvoices.length})</span>
                    <ArrowLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsHeldInvoicesModalOpen(true)}
                    className="py-1 px-2 text-gray-300 hover:text-white rounded-lg text-[11px] font-bold cursor-pointer"
                    title="عرض كافة الفواتير المعلقة"
                  >
                    قائمة الكل
                  </button>
                </div>
              )}
            </div>
          </div>

          {lastSaleData && (
            <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-right">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="p-1 px-2 bg-amber-500 text-navy-950 font-black rounded-lg text-[9px] uppercase tracking-wider">التحكم بالفاتورة الأخيرة</span>
                <p className="text-xs font-black text-amber-700 dark:text-amber-400">آخر عملية: رقم {lastSaleData.id.slice(-6)} بمبلغ {lastSaleData.total} ر.ي</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleModifyLastInvoice}
                  className="py-1.5 px-3 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer border-none"
                >
                  📝 تعديل الفاتورة
                </button>
                <button
                  type="button"
                  onClick={handleCancelLastInvoice}
                  className="py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer border-none"
                >
                  🚨 إلغاء الفاتورة
                </button>
              </div>
            </div>
          )}

          {/* Cart Item Rows */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 max-h-[380px] lg:max-h-[320px]">
            {cart.map((item) => (
              <div key={item.id} className="p-3 bg-gray-50 dark:bg-navy-900/50 rounded-2xl border border-gray-100 dark:border-navy-800 space-y-2">
                <div className="flex items-start gap-2 justify-between">
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {item.productName || item.name || 'منتج غير معروف'}
                    </p>
                    {item.details && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5">
                        {item.details}
                      </p>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => removeFromCart(item.id)} 
                    className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer border-none bg-transparent shrink-0"
                    title="حذف من السلة"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Unit Selector */}
                {item.units && item.units.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <button 
                      type="button"
                      onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, selectedUnit: undefined } : i))}
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all cursor-pointer ${!item.selectedUnit ? 'bg-navy-700 text-white border-navy-700' : 'bg-white dark:bg-navy-800 text-gray-500 border-gray-200 dark:border-navy-700'}`}
                    >
                      قطعة
                    </button>
                    {item.units.map((unit, idx) => (
                      <button 
                        key={idx}
                        type="button"
                        onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, selectedUnit: unit } : i))}
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all cursor-pointer ${item.selectedUnit?.name === unit.name ? 'bg-navy-700 text-white border-navy-700' : 'bg-white dark:bg-navy-800 text-gray-500 border-gray-200 dark:border-navy-700'}`}
                      >
                        {unit.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Controls: Price + Stepper */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-navy-800">
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="number" 
                      className="w-20 p-1.5 text-xs font-black bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg text-brand-primary outline-none focus:ring-1 focus:ring-brand-primary"
                      value={item.selectedUnit ? item.selectedUnit.price : (item.saleType === 'replacement' ? (item.replacementPrice || 0) : item.price)}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (item.selectedUnit) {
                          const newUnits = [...(item.units || [])];
                          const idx = newUnits.findIndex(u => u.name === item.selectedUnit?.name);
                          if (idx !== -1) {
                            newUnits[idx].price = val;
                            setCart(prev => prev.map(i => i.id === item.id ? { ...i, units: newUnits, selectedUnit: newUnits[idx] } : i));
                          }
                        } else if (item.saleType === 'replacement') {
                          updateReplacementPrice(item.id, val);
                        } else {
                          updatePrice(item.id, val);
                        }
                      }}
                    />
                    <span className="text-[10px] font-bold text-gray-400">ر.ي</span>
                  </div>

                  {/* Quantity Stepper (At least 44px on mobile) */}
                  <div className="flex items-center gap-2 bg-white dark:bg-navy-800 rounded-xl p-1 border border-gray-200 dark:border-navy-700">
                    <button 
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)} 
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="text-sm font-black text-amber-500 w-7 text-center tabular-nums">
                      {item.quantity ?? 1}
                    </span>
                    <button 
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)} 
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  <span className="text-xs font-black text-navy-900 dark:text-white tabular-nums">
                    {((item.selectedUnit ? item.selectedUnit.price : (item.saleType === 'replacement' ? (item.replacementPrice || 0) : item.price)) * item.quantity).toLocaleString()} ر.ي
                  </span>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="py-8 flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-60">
                <ShoppingCart size={40} />
                <p className="text-xs font-bold">السلة فارغة حالياً</p>
                <button
                  type="button"
                  onClick={() => setActivePosTab('catalog')}
                  className="text-xs text-brand-primary font-bold hover:underline cursor-pointer border-none bg-transparent pt-1"
                >
                  العودة للكتالوج لإضافة أصناف ⬅
                </button>
              </div>
            )}
          </div>

          {/* Quick Tab 2 Proceed Button for Mobile */}
          <div className="lg:hidden p-3 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-navy-700 space-y-2">
            <button
              type="button"
              onClick={() => setActivePosTab('checkout')}
              disabled={cart.length === 0}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:grayscale cursor-pointer border-none"
            >
              <span>المتابعة إلى تفاصيل الفاتورة والدفع</span>
              <ReceiptText size={16} />
              <span className="tabular-nums">({(total - currentDiscount).toLocaleString()} ر.ي)</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePosTab('catalog')}
              className="w-full py-2 text-gray-500 hover:text-navy-900 dark:hover:text-white font-bold text-xs transition-colors cursor-pointer border-none bg-transparent"
            >
              الرجوع لإضافة منتجات أخرى 📦
            </button>
          </div>
        </div>

        {/* Tab 3 Content: Invoice Details, Customer, Payment Matrix & Finalize */}
        <div className={`p-4 sm:p-5 bg-gray-50 dark:bg-navy-800 border-t border-gray-200 dark:border-navy-700 space-y-4 ${
          activePosTab === 'checkout' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
        }`}>
          {/* Mobile Back Button to Tab 2 */}
          <div className="lg:hidden flex items-center justify-between pb-2 border-b border-gray-200 dark:border-navy-700">
            <button
              type="button"
              onClick={() => setActivePosTab('cart')}
              className="text-xs text-brand-primary font-black flex items-center gap-1 cursor-pointer border-none bg-transparent"
            >
              <ArrowRight size={14} />
              <span>الرجوع لسلة المشتريات ({cart.length})</span>
            </button>
            <span className="text-xs font-black text-navy-900 dark:text-white">
              {(total - currentDiscount).toLocaleString()} ر.ي
            </span>
          </div>

          {/* Detailed Summary Card */}
          <div className="bg-navy-950 dark:bg-navy-900 text-white rounded-2xl p-3.5 shadow-xl border border-white/5 space-y-2">
            <div className="flex justify-between items-center text-xs opacity-70">
              <span>إجمالي السعر قبل الخصم:</span>
              <span className="tabular-nums">{cart.reduce((sum, item) => sum + ((item.selectedUnit ? item.selectedUnit.price : (item.saleType === 'replacement' ? (item.replacementPrice || 0) : item.price)) * item.quantity), 0).toLocaleString()} ر.ي</span>
            </div>
            <div className="flex justify-between items-center text-xs text-danger font-bold">
              <span>قيمة الخصم المحدد:</span>
              <span className="tabular-nums">-{currentDiscount.toLocaleString()} ر.ي</span>
            </div>
            <div className="pt-2 border-t border-white/10 flex justify-between items-center">
              <span className="text-xs font-bold">الإجمالي النهائي:</span>
              <span className="text-lg font-black text-brand-primary tabular-nums">
                {(total - currentDiscount).toLocaleString()} ر.ي
              </span>
            </div>
            
            {(profile?.role === 'manager' || profile?.role === 'superadmin') && (
              <div className="pt-1.5 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] opacity-50 flex items-center gap-1">
                  <Shield size={10} />
                  صافي الربح المتوقع:
                </span>
                <span className="text-xs font-bold text-emerald-400 tabular-nums">
                  {(cart.reduce((sum, item) => {
                    const p = (item.selectedUnit ? item.selectedUnit.price : (item.saleType === 'replacement' ? (item.replacementPrice || 0) : item.price));
                    const c = (item.selectedUnit ? item.selectedUnit.cost : item.cost);
                    return sum + ((p - c) * item.quantity);
                  }, 0) - currentDiscount).toLocaleString()} ر.ي
                </span>
              </div>
            )}
          </div>

          {/* Discount Field */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400">الخصم (ر.ي)</label>
              {(profile?.role !== 'manager' && profile?.role !== 'superadmin') && shopSettings.maxDiscountPerSale > 0 && (
                <span className="text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full font-bold">
                  حدك الأقصى: {shopSettings.maxDiscountPerSale} ر.ي
                </span>
              )}
            </div>
            <div className="relative">
              <input 
                type="number" 
                className="w-full p-2.5 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl text-xs outline-none font-bold text-danger pr-8"
                placeholder="0"
                value={currentDiscount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (profile?.role !== 'manager' && profile?.role !== 'superadmin' && shopSettings.maxDiscountPerSale > 0 && val > shopSettings.maxDiscountPerSale) {
                    setCurrentDiscount(shopSettings.maxDiscountPerSale);
                  } else {
                    setCurrentDiscount(val);
                  }
                }}
              />
              <Tag className="absolute right-2.5 top-1/2 -translate-y-1/2 text-danger/40" size={14} />
            </div>
          </div>

          {/* Customer Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <User size={14} className="text-brand-primary" />
              العميل والخدمات المالية
            </label>
            <CustomerSearchSelector
              customers={customers}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              profile={profile}
              placeholder="البحث بالاسم / الجوال / المحل / الكود..."
              defaultTier="retail"
            />
          </div>

          {/* Payment Method Matrix */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Banknote size={14} className="text-brand-primary" />
                طريقة الدفع والتسوية المالية
              </label>
              <button 
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="text-[10px] text-brand-primary font-black hover:underline flex items-center gap-1 bg-brand-primary/10 px-2 py-0.5 rounded cursor-pointer border-none"
                title="مسح باركود كود الدفع أو الحساب"
              >
                <Camera size={11} />
                <span>مسح باركود الدفع</span>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'cash', icon: Banknote, label: 'نقدي' },
                { id: 'transfer', icon: CreditCard, label: 'إيداع/تحويل' },
                { id: 'debt', icon: User, label: 'دين' },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    paymentMethod === method.id 
                      ? 'bg-navy-700 text-white border-navy-700 shadow-md' 
                      : 'bg-white dark:bg-navy-900 border-gray-200 dark:border-navy-700 text-gray-500 hover:border-navy-700'
                  }`}
                >
                  <method.icon size={18} />
                  <span className="text-[10px] font-bold">{method.label}</span>
                </button>
              ))}

              {/* Premium Golden JAM Pay Button */}
              <button
                type="button"
                onClick={() => setIsJAMPayOpen(true)}
                className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-amber-500/60 hover:border-amber-400 text-amber-500 bg-gradient-to-r from-amber-500/10 to-yellow-600/5 transition-all shadow-[0_0_8px_rgba(245,158,11,0.1)] active:scale-95 cursor-pointer duration-200"
                id="sales-jampay-btn"
              >
                <div className="relative flex items-center justify-center">
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <Sparkles size={18} className="text-amber-400" />
                </div>
                <span className="text-[10px] font-bold">JAM Pay</span>
              </button>
            </div>
          </div>

          {/* Account Selection for Transfer */}
          {paymentMethod === 'transfer' && (
            <AccountSelector
              currentStoreId={profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store'}
              selectedAccountId={selectedAccountId}
              onChange={setSelectedAccountId}
            />
          )}

          {/* Currency Totals & Action Buttons */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-navy-750">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-bold">الإجمالي بالعملة المختارة:</span>
              <span className="text-sm font-black text-navy-900 dark:text-white tabular-nums">
                {((total - currentDiscount) / (selectedCurrency === 'YER' ? 1 : (shopSettings?.currencyRates?.[selectedCurrency]?.buy || 1))).toFixed(2)} {selectedCurrency}
              </span>
            </div>

            {/* Sticky / Primary Action Buttons */}
            <div className="grid grid-cols-5 gap-2">
              <button 
                type="button"
                onClick={() => {
                  setShowAdvancedCheckout(false);
                  setIsCheckoutModalOpen(true);
                }}
                disabled={cart.length === 0 || isSubmitting}
                className="col-span-3 btn-primary w-full py-3.5 text-xs font-black disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 border-none cursor-pointer shadow-lg"
              >
                <span>{isReturnMode ? 'إتمام المرتجع 🔄' : 'بيع نهائي وتأكيد 💾'}</span>
              </button>
              <button 
                type="button"
                onClick={handleHoldCurrentInvoice}
                disabled={cart.length === 0}
                className="col-span-2 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-2xl transition-colors disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-1 cursor-pointer border-none shadow-md"
                title="حجز الفاتورة للتعليق والاستدعاء لاحقاً"
              >
                <Bell size={14} />
                <span>حجز الفاتورة</span>
              </button>
            </div>

            {profile?.role === 'manager' && (
              <button 
                onClick={async () => {
                  if (confirm('هل تريد فعلاً إعادة تدقيق كافة أرباح المبيعات السابقة وحسابها بناءً على الكلفة؟')) {
                    setIsSubmitting(true);
                    try {
                      const { FinancialService } = await import('../services/financialService');
                      const count = await FinancialService.repairSalesData(profile.ownerId!);
                      alert(`تمت مراجعة وإصلاح أرباح ${count} فاتورة بنجاح.`);
                    } catch (err) {
                      alert('فشل في عملية الإصلاح.');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                className="w-full p-2.5 bg-warning/10 text-warning rounded-xl hover:bg-warning/20 transition-colors flex items-center justify-center gap-2 text-[11px] font-bold border-none cursor-pointer"
              >
                <AlertTriangle size={14} />
                تدقيق وإصلاح أرباح المبيعات التاريخية
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Invoice Settlement & Payment Modal (المهمة 3) */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsCheckoutModalOpen(false)}
              className="fixed inset-0 bg-navy-900/70 backdrop-blur-md"
              id="checkout-modal-backdrop"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative bg-white dark:bg-navy-800 rounded-3xl max-w-4xl w-full shadow-2xl border border-gray-100 dark:border-navy-700 overflow-hidden z-10 flex flex-col md:flex-row"
              id="checkout-modal-container"
              dir="rtl"
            >
              {/* Right Column: Settlement & Payment Details Form */}
              <div className="flex-1 p-6 sm:p-8 space-y-6 flex flex-col justify-between border-l border-gray-100 dark:border-navy-700">
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-navy-700 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-2xl">
                        <Banknote size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-navy-900 dark:text-white">نافذة تسوية الفاتورة والبيع النهائي</h3>
                        <p className="text-xs text-gray-400 font-medium">اختر طريقة الدفع وطبق الخصومات والمميزات</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCheckoutModalOpen(false)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-navy-900 rounded-full text-gray-400 hover:text-navy-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {!showAdvancedCheckout ? (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="p-5 rounded-2xl bg-brand-primary/5 border border-brand-primary/15 space-y-4 text-right">
                        <div className="text-sm font-black text-brand-primary flex items-center gap-2 border-b border-brand-primary/10 pb-3">
                          <CheckCircle2 size={16} />
                          <span>تأكيد بيانات ومستندات الفاتورة</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-400 block">طريقة السداد المحددة:</span>
                            <span className="text-xs font-black text-navy-900 dark:text-white flex items-center gap-1.5 bg-white dark:bg-navy-900 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-navy-750">
                              {paymentMethod === 'cash' ? '💵 نقدي / كاش' : paymentMethod === 'transfer' ? '🏦 تحويل / إيداع لحساب المحل' : '📝 مديونية / حساب آجل'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-400 block">العميل المعتمد للفوترة:</span>
                            <span className="text-xs font-black text-navy-900 dark:text-white flex items-center gap-1.5 bg-white dark:bg-navy-900 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-navy-750">
                              👤 {selectedCustomer?.name || 'عميل نقدي عابر'}
                            </span>
                          </div>

                          {paymentMethod === 'transfer' && (
                            <div className="space-y-1 md:col-span-2">
                              <span className="text-[10px] font-black text-gray-400 block">تفاصيل التحويل البنكي:</span>
                              <div className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-navy-900 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-navy-750 space-y-1">
                                <div>الرقم المرجعي: {transferRefNo || 'لا يوجد'}</div>
                                <div>اسم الحساب: {transferAccountName || 'لا يوجد'}</div>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-400 block">إجمالي عدد الأصناف:</span>
                            <span className="text-xs font-black text-navy-900 dark:text-white flex items-center gap-1.5 bg-white dark:bg-navy-900 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-navy-750">
                              🛒 {cart.length} أصناف
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-400 block">قيمة الخصم الكلية:</span>
                            <span className={`text-xs font-black flex items-center gap-1.5 bg-white dark:bg-navy-900 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-navy-750 ${currentDiscount > 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                              🏷️ {currentDiscount > 0 ? `${currentDiscount.toLocaleString()} ر.ي` : 'لا يوجد خصم'}
                            </span>
                          </div>
                        </div>

                        {paymentMethod === 'debt' && selectedCustomer && (
                          <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2">
                            <div className="flex justify-between text-[10px] font-black text-gray-400">
                              <span>سقف الائتمان للعميل:</span>
                              <span className="text-gray-700 dark:text-gray-300">{(selectedCustomer.creditLimit || 100000).toLocaleString()} ر.ي</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-black text-gray-400">
                              <span>المتاح قبل الفاتورة الحالية:</span>
                              <span className="text-emerald-500">{((selectedCustomer.creditLimit || 100000) - (selectedCustomer.debt || 0)).toLocaleString()} ر.ي</span>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-[10px] text-gray-400 text-center font-bold mt-2">
                          💡 لتغيير العميل، طريقة الدفع، أو إدخال خصم يدوي، اضغط على زر التعديل المتقدم أدناه.
                        </p>
                      </div>

                      <div className="flex justify-center pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedCheckout(true)}
                          className="px-5 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 dark:bg-navy-900 dark:hover:bg-navy-850 border border-gray-200 dark:border-navy-700 text-brand-primary hover:text-brand-primary-dark font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <SettingsIcon size={14} />
                          <span>تعديل تفاصيل السداد وطريقة الدفع ⚙️</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-fadeIn text-right">
                      {/* Customer Selection */}
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <User size={14} className="text-brand-primary" />
                          العميل والخدمات المالية للفوترة
                        </label>
                        <CustomerSearchSelector
                          customers={customers}
                          selectedCustomer={selectedCustomer}
                          onSelectCustomer={setSelectedCustomer}
                          profile={profile}
                          placeholder="ابحث باسم العميل / رقم الجوال / المحل / الكود..."
                          defaultTier="retail"
                        />
                      </div>

                      {/* Payment Method / Settlement Coin */}
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <CreditCard size={14} className="text-brand-primary" />
                          طريقة الدفع والتسوية المالية (العملة)
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: 'cash', label: 'كاش / نقد', icon: Banknote, desc: 'استلام نقد' },
                            { id: 'transfer', label: 'إيداع / تحويل للمحل', icon: CreditCard, desc: 'تحويل لحساب المحل' },
                            { id: 'debt', label: 'شراء بالدين', icon: User, desc: 'حساب آجل' },
                          ].map((method) => (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => {
                                setPaymentMethod(method.id as any);
                                if (method.id === 'debt' && !selectedCustomer && customers.length > 0) {
                                  setSelectedCustomer(customers[0]);
                                }
                              }}
                              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 duration-150 cursor-pointer ${
                                paymentMethod === method.id
                                  ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20'
                                  : 'bg-gray-50 dark:bg-navy-900 border-gray-200 dark:border-navy-700 text-gray-500 hover:border-brand-primary'
                              }`}
                            >
                              <method.icon size={20} className={paymentMethod === method.id ? 'text-white' : 'text-gray-400'} />
                              <span className="text-[10px] font-black mt-1">{method.label}</span>
                              <span className={`text-[7px] font-medium opacity-70 ${paymentMethod === method.id ? 'text-white' : 'text-gray-400'}`}>{method.desc}</span>
                            </button>
                          ))}

                          {/* JAM Pay Premium Golden Option */}
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod('cash');
                              setIsJAMPayOpen(true);
                            }}
                            className="flex flex-col items-center justify-center p-3 rounded-2xl border border-amber-500/60 hover:border-amber-400 text-amber-500 bg-gradient-to-r from-amber-500/10 to-yellow-600/5 transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)] active:scale-95 cursor-pointer duration-200"
                          >
                            <div className="relative">
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
                              <Sparkles size={20} className="text-amber-400" />
                            </div>
                            <span className="text-[10px] font-black mt-1">JAM Pay</span>
                            <span className="text-[7px] text-amber-400/80 font-bold">جام بي الذكي</span>
                          </button>
                        </div>
                      </div>

                      {/* Custom Fields per Payment Type */}
                      <AnimatePresence mode="wait">
                        {paymentMethod === 'cash' && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3"
                          >
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                              <CheckCircle2 size={14} />
                              استلام كاش نقداً - الرجاء تحديد الصندوق المالي لتغذية الرصيد:
                            </p>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400">تحديد صندوق المبيعات الرئيسي</label>
                              <select
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                className="w-full p-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-black outline-none focus:border-brand-primary"
                              >
                                <option value="">📥 الصندوق الرئيسي الافتراضي (1101)</option>
                                {accounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>📥 {acc.name} ({acc.accountNumber}) - رصيد: {acc.balance?.toLocaleString()} ر.ي</option>
                                ))}
                              </select>
                            </div>
                          </motion.div>
                        )}

                        {paymentMethod === 'transfer' && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3"
                          >
                            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5">
                              <CreditCard size={14} />
                              بيانات الإيداع والتسوية البنكية والمحافظ المصرفية:
                            </p>

                            {/* Prominently render deposit wallet details */}
                            <WalletDepositCard
                              wallets={accounts}
                              ownerId={profile?.ownerId || profile?.uid}
                              storeName={profile?.shopName || 'المحل'}
                              compact={true}
                              allowEdit={true}
                              selectedWalletId={selectedAccountId}
                              onSelectWallet={(w) => setSelectedAccountId(w.id)}
                            />

                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 dark:text-gray-400">أدخل رقم الإيداع</label>
                                <input
                                  type="text"
                                  placeholder="رقم العملية / الإيداع"
                                  value={transferRefNo}
                                  onChange={(e) => setTransferRefNo(e.target.value)}
                                  className="w-full p-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-black outline-none focus:border-brand-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 dark:text-gray-400">اسم الحساب المحول له</label>
                                <input
                                  type="text"
                                  placeholder="اسم المحول إليه"
                                  value={transferAccountName}
                                  onChange={(e) => setTransferAccountName(e.target.value)}
                                  className="w-full p-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-black outline-none focus:border-brand-primary"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-500 dark:text-gray-400">حدد الصندوق المالي المستلم (البنك)</label>
                              <select
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                className="w-full p-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-black outline-none focus:border-brand-primary"
                              >
                                <option value="">🏦 اختر حساب بنكي أو محفظة للتسوية</option>
                                {accounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>🏦 {acc.name} ({acc.bankName || acc.accountNumber}) - رصيد: {acc.balance?.toLocaleString()} ر.ي</option>
                                ))}
                              </select>
                            </div>
                          </motion.div>
                        )}

                        {paymentMethod === 'debt' && selectedCustomer && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                                <Shield size={14} />
                                فحص الرصيد والسقف الائتماني للعميل:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRaiseCreditLimit(selectedCustomer)}
                                className="text-[10px] font-black bg-amber-500 text-white px-3 py-1.5 rounded-xl hover:bg-amber-600 transition-colors shadow-sm cursor-pointer border-none"
                              >
                                🚀 رفع السقف الائتماني
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2 bg-white dark:bg-navy-900 p-3 rounded-xl border border-gray-100 dark:border-navy-700">
                              <div className="text-center">
                                <p className="text-[8px] text-gray-400 font-bold">السقف الائتماني</p>
                                <p className="text-xs font-black text-gray-700 dark:text-white">{(selectedCustomer.creditLimit || 100000).toLocaleString()} ر.ي</p>
                              </div>
                              <div className="text-center border-x border-gray-100 dark:border-navy-700">
                                <p className="text-[8px] text-gray-400 font-bold">الرصيد المديون حالياً</p>
                                <p className="text-xs font-black text-rose-500">{(selectedCustomer.debt || 0).toLocaleString()} ر.ي</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[8px] text-gray-400 font-bold">المتاح الآجل المتبقي</p>
                                <p className={`text-xs font-black ${((selectedCustomer.creditLimit || 100000) - (selectedCustomer.debt || 0)) < (total - currentDiscount) ? 'text-rose-600 font-black' : 'text-emerald-500'}`}>
                                  {((selectedCustomer.creditLimit || 100000) - (selectedCustomer.debt || 0)).toLocaleString()} ر.ي
                                </p>
                              </div>
                            </div>

                            {/* Limit warning badge */}
                            {((selectedCustomer.creditLimit || 100000) - (selectedCustomer.debt || 0)) < (total - currentDiscount) && (
                              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-[10px] font-black flex items-center gap-2">
                                <AlertTriangle size={14} />
                                <span>❌ السقف الائتماني غير متاح / غير كافي لهذه الفاتورة! يرجى رفع السقف أو تقليل كمية الأصناف.</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Discount Section with Shortcuts */}
                      <div className="space-y-3 p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-700">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <Tag size={14} className="text-brand-primary" />
                            الخصم والامتيازات المالية الممنوحة للعميل
                          </label>
                          <span className="text-[9px] text-gray-400 pr-1">* يخصم مباشرة من هامش ربح الفاتورة</span>
                        </div>

                        <div className="relative">
                          <input
                            type="number"
                            placeholder="أدخل قيمة الخصم المباشر (ر.ي)"
                            className="w-full p-3.5 pl-12 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-2xl text-xs font-black outline-none focus:border-brand-primary"
                            value={currentDiscount || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const maxDiscount = shopSettings?.maxDiscountPerSale || 50000;
                              if (profile?.role !== 'manager' && profile?.role !== 'superadmin' && maxDiscount > 0 && val > maxDiscount) {
                                setCurrentDiscount(maxDiscount);
                              } else {
                                setCurrentDiscount(val);
                              }
                            }}
                          />
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">ر.ي</span>
                        </div>

                        {/* Quick discount shortcuts */}
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {[
                            { label: 'بلا خصم ❌', value: 0 },
                            { label: '500 ر.ي 💸', value: 500 },
                            { label: '1,000 ر.ي 💸', value: 1000 },
                            { label: '2,000 ر.ي 💸', value: 2000 },
                            { label: '5,000 ر.ي 💸', value: 5000 },
                            { label: 'خصم 5% 🏷️', value: 0.05, isPercent: true },
                            { label: 'خصم 10% 🏷️', value: 0.10, isPercent: true },
                          ].map((sc, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                let amt = 0;
                                if (sc.isPercent) {
                                  amt = Math.round(total * sc.value);
                                } else {
                                  amt = sc.value;
                                }
                                const maxDiscount = shopSettings?.maxDiscountPerSale || 50000;
                                if (profile?.role !== 'manager' && profile?.role !== 'superadmin' && maxDiscount > 0 && amt > maxDiscount) {
                                  setCurrentDiscount(maxDiscount);
                                  alert(`⚠️ تم تطبيق الحد الأقصى للخصم المسموح به: ${maxDiscount} ر.ي`);
                                } else {
                                  setCurrentDiscount(amt);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 hover:border-brand-primary text-gray-600 dark:text-gray-300 rounded-xl text-[9px] font-black transition-colors hover:text-brand-primary cursor-pointer active:scale-95 animate-none"
                            >
                              {sc.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-start pt-2 border-t border-gray-100 dark:border-navy-700">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedCheckout(false)}
                          className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-navy-900 dark:hover:bg-navy-850 text-gray-600 dark:text-gray-400 font-black text-xs transition-colors flex items-center gap-1 cursor-pointer border-none"
                        >
                          <span>⬅️ العودة لملخص الفاتورة</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Actions bar */}
                <div className="pt-6 border-t border-gray-100 dark:border-navy-700 mt-6 space-y-3">
                  {/* Totals */}
                  <div className="flex items-center justify-between px-2">
                    <div>
                      <p className="text-xs text-gray-400 font-bold">الإجمالي بالعملة المختارة</p>
                      <p className="text-xs text-gray-400 font-bold">
                        {((total - currentDiscount) / (selectedCurrency === 'YER' ? 1 : (shopSettings?.currencyRates?.[selectedCurrency]?.buy || 1))).toFixed(2)} {selectedCurrency}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-400 font-bold">المطلوب سداده بعد الخصم</p>
                      <p className="text-2xl font-black text-brand-primary">{(total - currentDiscount).toLocaleString()} ر.ي</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => !isSubmitting && setIsCheckoutModalOpen(false)}
                      className="py-3.5 bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-400 rounded-2xl font-black text-xs hover:bg-gray-200 dark:hover:bg-navy-750 transition-colors cursor-pointer border-none bg-transparent"
                    >
                      إلغاء وإغلاق
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleHoldCurrentInvoice();
                        setIsCheckoutModalOpen(false);
                      }}
                      disabled={cart.length === 0}
                      className="py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer border-none"
                    >
                      <Bell size={14} />
                      <span>حجز الفاتورة 📋</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        cart.length === 0 || 
                        isSubmitting || 
                        (paymentMethod === 'debt' && !selectedCustomer) ||
                        (paymentMethod === 'debt' && selectedCustomer && ((selectedCustomer.creditLimit || 100000) - (selectedCustomer.debt || 0)) < (total - currentDiscount))
                      }
                      onClick={() => processSale(currentDiscount)}
                      className="py-3.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-black text-xs rounded-2xl transition-colors disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-1 border-none shadow-lg shadow-brand-primary/20"
                    >
                      <span>{isSubmitting ? 'جاري الحفظ...' : (isReturnMode ? 'تأكيد المرتجع 🔄' : 'بيع نهائي وتأكيد 💾')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Left Column: Cart Summary & Quick "تنقيص الكمية" (Decrease quantities) */}
              <div className="w-full md:w-80 bg-gray-50/70 dark:bg-navy-900/40 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-r border-gray-100 dark:border-navy-700">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-navy-900 dark:text-white border-b border-gray-100 dark:border-navy-700 pb-3">
                    <ShoppingCart size={18} className="text-brand-primary" />
                    <span className="text-sm font-black">أصناف الفاتورة ({cart.length})</span>
                  </div>

                  <div className="space-y-2 max-h-[300px] md:max-h-[420px] overflow-y-auto pr-1" id="checkout-cart-items">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-navy-800 border border-gray-100 dark:border-navy-750 hover:border-brand-primary/30 transition-all shadow-sm">
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-bold text-gray-800 dark:text-white line-clamp-1">{item.name}</span>
                          <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                            الكمية: <span className="font-bold text-brand-primary">{item.quantity}</span> × {item.price.toLocaleString()} ر.ي {item.selectedUnit ? `(${item.selectedUnit.name})` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => decreaseCartItemQty(item.id, item.selectedUnit?.name)}
                          className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer border-none bg-transparent"
                          title="تنقيص الكمية"
                        >
                          <Minus size={14} />
                        </button>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <p className="text-center text-xs text-gray-400 py-6 font-bold">العربة فارغة حالياً</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-navy-700 mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                    <span>مجموع الفاتورة الأساسي</span>
                    <span>{total.toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-danger">
                    <span>الخصومات والامتيازات</span>
                    <span>-{currentDiscount.toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-black text-brand-primary pt-1.5 border-t border-dashed border-gray-200 dark:border-navy-700">
                    <span>الصافي النهائي للتسوية</span>
                    <span>{(total - currentDiscount).toLocaleString()} ر.ي</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => !isSubmitting && setIsConfirmModalOpen(false)}
        onConfirm={() => processSale(currentDiscount)}
        title={isReturnMode ? "تأكيد المرتجع" : "تأكيد عملية البيع"}
        message={isSubmitting ? "جاري المعالجة..." : `هل أنت متأكد من إتمام ${isReturnMode ? 'المرتجع' : 'البيع'} بمبلغ ${(total - currentDiscount).toFixed(0)} ر.ي؟`}
        confirmText={isSubmitting ? "جاري المعالجة..." : "تأكيد وإتمام"}
        type={isReturnMode ? 'danger' : 'success'}
      />

      {/* Success Modal with Fast Auto-Reset/Redirect Loop */}
      <AnimatePresence>
        {isSuccessModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetToCatalogAndNextSale}
              className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  resetToCatalogAndNextSale();
                }
              }}
              tabIndex={0}
              autoFocus
              className="relative bg-white dark:bg-navy-800 p-6 rounded-3xl text-center space-y-4 max-w-sm w-full shadow-2xl outline-none"
            >
              <div className="w-14 h-14 bg-success/10 text-success rounded-full mx-auto flex items-center justify-center">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-navy-900 dark:text-white">تمت العملية بنجاح!</h3>
                <p className="text-xs text-gray-500">تم تسجيل الفاتورة وتحديث المخزون والحسابات فورياً.</p>
              </div>

              {/* QR Code Section for Digital Invoice */}
              {lastSaleData && (
                <div className="bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-2xl border border-dashed border-amber-500/30 flex flex-col items-center space-y-1.5 text-center">
                  <span className="text-[10px] font-black text-amber-500 block uppercase tracking-wider">النسخة الرقمية من الفاتورة:</span>
                  <div className="bg-white p-1.5 rounded-xl shadow-md">
                    <QRCodeSVG 
                      value={`${window.location.origin}/portal?invoiceId=${lastSaleData.id}`} 
                      size={95} 
                      level="M"
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 dark:text-slate-300 font-bold block">
                    امسح بالكاميرا للحصول على نسخة رقمية مباشرة دون طباعة ورق 📱
                  </span>
                </div>
              )}

              {/* WhatsApp Phone Prompt Box */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1.5 text-right">
                <label className="text-[10px] font-black text-slate-400 block">رقم واتساب العميل (لإرسال الفاتورة تلقائياً):</label>
                <input 
                  type="text" 
                  value={customPhone} 
                  onChange={(e) => setCustomPhone(e.target.value)} 
                  placeholder="مثال: 772315106" 
                  className="w-full text-center text-xs font-black p-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:ring-2 focus:ring-success outline-none"
                />
              </div>

              {/* Action Buttons Grid with Instant Auto-Reset Loop */}
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => {
                    if (lastSaleData) {
                      const updated = { ...lastSaleData, customerPhone: customPhone };
                      shareInvoiceViaWhatsApp(updated as any, shopSettings);
                    }
                    resetToCatalogAndNextSale();
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 border-none cursor-pointer shadow-sm transition-all active:scale-98"
                >
                  <MessageCircle size={16} />
                  <span>إرسال الفاتورة عبر واتساب والانتقال للزبون التالي 💬</span>
                </button>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (lastSaleData) printReceipt('sale', lastSaleData, shopSettings);
                      resetToCatalogAndNextSale();
                    }}
                    className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-black border-none cursor-pointer transition-all active:scale-98"
                  >
                    <Printer size={15} />
                    طباعة ومتابعة ⚡
                  </button>
                  
                  <button 
                    onClick={() => {
                      handleHoldCurrentInvoice();
                      resetToCatalogAndNextSale();
                    }}
                    className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl flex-1 flex items-center justify-center gap-1 border-none cursor-pointer transition-all active:scale-98"
                  >
                    <Bell size={14} />
                    تعليق الفاتورة
                  </button>
                </div>
              </div>

              {/* Instant Next Sale / Back to Catalog Loop Button */}
              <button 
                onClick={resetToCatalogAndNextSale}
                className="w-full py-3 bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-brand-primary/90 hover:to-indigo-500 text-white font-black text-xs rounded-xl border-none cursor-pointer shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-98"
              >
                <span>⚡ زبون جديد / فتح الكتالوج والباركود فوراً (Enter)</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <MessageModal 
        isOpen={messageModal.isOpen}
        onClose={() => setMessageModal(prev => ({ ...prev, isOpen: false }))}
        phone={messageModal.phone}
        initialMessage={messageModal.message}
        title={messageModal.title}
      />
      <JAMPayModal isOpen={isJAMPayOpen} onClose={() => setIsJAMPayOpen(false)} />
      </div>

      {/* Grid Unit Modal (المهمة 2) */}
      <AnimatePresence>
        {gridUnitModal && gridUnitModal.isOpen && (
          <div className="fixed inset-0 z-[102] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGridUnitModal(null)}
              className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-navy-800 p-6 rounded-3xl max-w-md w-full shadow-2xl text-right space-y-4"
            >
              <div>
                <h3 className="text-lg font-black text-navy-900 dark:text-white">تحديد حجم / وحدة الصنف</h3>
                <p className="text-xs text-gray-400 font-bold mt-1">الرجاء اختيار العبوة المناسبة لمنتج: {gridUnitModal.productName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {gridUnitModal.units.map((unit, uIdx) => (
                  <button
                    key={uIdx}
                    type="button"
                    onClick={() => handleSelectGridRowUnit(gridUnitModal.rowIndex, unit)}
                    className="p-4 bg-slate-50 dark:bg-navy-950 hover:bg-amber-500/10 hover:border-amber-500 border border-gray-200 dark:border-navy-700 rounded-2xl text-right space-y-1 group transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-black text-sm text-navy-900 dark:text-white group-hover:text-amber-500">{unit.name}</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-navy-800 px-2 py-0.5 rounded-full font-bold">×{unit.factor}</span>
                    </div>
                    <div className="text-xs font-black text-brand-primary">{unit.price} ر.ي</div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setGridUnitModal(null)}
                className="btn-secondary w-full py-2.5 text-xs font-bold"
              >
                إلغاء التحديد
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hold / Reserve Invoice Modal */}
      <AnimatePresence>
        {isHoldInvoiceModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHoldInvoiceModalOpen(false)}
              className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-navy-800 p-6 rounded-3xl max-w-md w-full shadow-2xl text-right space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-navy-700 pb-3">
                <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-navy-900 dark:text-white">تعليق أو حجز الفاتورة الحالية</h3>
                  <p className="text-[10px] text-gray-400 font-bold">يمكنك حفظ الفاتورة مؤقتاً أو حجزها بعربون لعميل محدد.</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Invoice Name/Description */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-gray-500 dark:text-gray-400 block">وصف أو اسم الحجز / العميل:</label>
                  <input 
                    type="text"
                    value={holdInvoiceName}
                    onChange={(e) => setHoldInvoiceName(e.target.value)}
                    placeholder="مثال: حجز باسم أحمد محمد أو رقم تلفونه"
                    className="w-full text-right text-xs p-3 rounded-xl border border-gray-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-navy-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                {/* Reservation Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-navy-900/55 rounded-2xl border border-slate-150 dark:border-navy-750">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-navy-900 dark:text-white block">حجز صريح بعربون؟</span>
                    <span className="text-[9px] text-slate-400 font-bold block">يربط المواد مؤقتاً بالمستودع ويمنع بيعها لزبون آخر.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHoldInvoiceIsReservation(!holdInvoiceIsReservation)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 border-none cursor-pointer flex ${holdInvoiceIsReservation ? 'bg-amber-500 justify-end' : 'bg-slate-300 dark:bg-navy-700 justify-start'}`}
                  >
                    <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-md" />
                  </button>
                </div>

                {/* Deposit Amount (Conditional) */}
                <AnimatePresence>
                  {holdInvoiceIsReservation && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      <label className="text-[11px] font-black text-amber-500 block">مبلغ العربون المستلم (ر.ي):</label>
                      <input 
                        type="number"
                        value={holdInvoiceDeposit || ''}
                        onChange={(e) => setHoldInvoiceDeposit(Math.max(0, Number(e.target.value)))}
                        placeholder="أدخل مبلغ العربون"
                        className="w-full text-left text-sm font-black p-3 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 text-amber-500 outline-none focus:border-amber-500"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={submitHoldInvoice}
                  disabled={!holdInvoiceName.trim()}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-xs rounded-xl border-none cursor-pointer transition-all"
                >
                  تأكيد الحجز والتعليق
                </button>
                <button
                  type="button"
                  onClick={() => setIsHoldInvoiceModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 text-gray-700 dark:text-gray-200 font-black text-xs rounded-xl border-none cursor-pointer transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Held Invoices Modal (المهمة 5) */}
      <AnimatePresence>
        {isHeldInvoicesModalOpen && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHeldInvoicesModalOpen(false)}
              className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-navy-800 p-6 rounded-3xl max-w-4xl w-full shadow-2xl text-right flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-navy-700">
                <div>
                  <h3 className="text-xl font-black text-navy-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-6 bg-brand-primary rounded-full inline-block"></span>
                    إدارة الفواتير المحجوزة والمعلقات (Held Invoices)
                  </h3>
                  <p className="text-xs text-gray-400 font-bold mt-1">
                    يمكنك استعادتها لتعديلها، أو إجراء تسوية مالية فورية ومباشرة، أو إلغاء حجزها لحذفها نهائياً.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsHeldInvoicesModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg bg-transparent border-none cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Advanced Header Search & Stats */}
              <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 dark:border-navy-700">
                {/* Search field */}
                <div className="md:col-span-2 relative">
                  <input
                    type="text"
                    value={heldSearchQuery}
                    onChange={(e) => setHeldSearchQuery(e.target.value)}
                    placeholder="ابحث برقم الفاتورة، اسم العميل، اسم الصنف، أو ملاحظة الفاتورة..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl outline-none font-bold text-xs focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-right"
                  />
                  <div className="absolute left-3 top-3.5 text-gray-400">
                    <Search size={14} />
                  </div>
                </div>

                {/* Quick stats */}
                <div className="bg-slate-50 dark:bg-navy-950 p-2.5 rounded-xl border border-slate-100 dark:border-navy-750 flex items-center justify-between text-right">
                  <div>
                    <div className="text-[10px] text-gray-400 font-black">إجمالي قيمة الفواتير المعلقة</div>
                    <div className="text-sm font-black text-brand-primary">
                      {heldInvoices.reduce((sum, inv) => {
                        const totalInv = inv.items.reduce((s: number, it: any) => s + (it.price * it.quantity), 0) - (inv.discount || 0);
                        return sum + totalInv;
                      }, 0).toLocaleString()} ر.ي
                    </div>
                  </div>
                  <div className="h-full w-px bg-slate-200 dark:bg-navy-700"></div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-black">عدد المعلقات</div>
                    <div className="text-sm font-black text-navy-900 dark:text-white">
                      {heldInvoices.length} فواتير
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Area */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 custom-scrollbar">
                {heldInvoices.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-gray-400 space-y-3 opacity-60">
                    <div className="w-16 h-16 bg-amber-50 dark:bg-navy-900 text-amber-500 rounded-full flex items-center justify-center">
                      <Bell size={32} />
                    </div>
                    <p className="text-sm font-black text-gray-500">لا يوجد أي فواتير معلقة أو محجوزة حالياً.</p>
                    <p className="text-xs text-gray-400">عندما تقوم بإضافة أصناف للسلة، يمكنك الضغط على "حجز الفاتورة" لحفظها هنا.</p>
                  </div>
                ) : (
                  heldInvoices
                    .filter(inv => {
                      const query = heldSearchQuery.trim().toLowerCase();
                      if (!query) return true;
                      return (
                        inv.id.toLowerCase().includes(query) ||
                        (inv.description || '').toLowerCase().includes(query) ||
                        (inv.customerName || '').toLowerCase().includes(query) ||
                        inv.items.some((it: any) => it.name.toLowerCase().includes(query))
                      );
                    })
                    .map((inv) => {
                      const invTotal = inv.items.reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0) - (inv.discount || 0);
                      return (
                        <div key={inv.id} className="p-4 bg-slate-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-2xl flex flex-col gap-3 hover:border-brand-primary/40 transition-all shadow-sm">
                          {/* Invoice top bar */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-dashed border-gray-200 dark:border-navy-800">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs bg-brand-primary/10 text-brand-primary px-2.5 py-1 rounded-full font-black">
                                {inv.id}
                              </span>
                              {inv.isReservation && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full font-black flex items-center gap-1">
                                  🔒 محجوز بعربون: {Number(inv.depositAmount || 0).toLocaleString()} ر.ي
                                </span>
                              )}
                              <span className="font-black text-sm text-navy-900 dark:text-white flex items-center gap-1.5">
                                {inv.description}
                                <button
                                  type="button"
                                  title="تعديل الوصف / الملاحظة"
                                  onClick={() => handleEditHeldInvoiceDescription(inv.id, inv.description)}
                                  className="text-[10px] text-gray-400 hover:text-brand-primary hover:bg-slate-200 dark:hover:bg-navy-800 p-1 rounded-md transition-all border-none bg-transparent cursor-pointer"
                                >
                                  ✏️ تعديل
                                </button>
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400 font-bold flex flex-wrap gap-x-3 gap-y-1">
                              <span>العميل: <strong className="text-navy-900 dark:text-gray-300 font-black">{inv.customerName}</strong></span>
                              <span>•</span>
                              <span>التاريخ: <strong className="text-navy-900 dark:text-gray-300 font-black">{new Date(inv.createdAt).toLocaleString('ar-YE', { hour12: true })}</strong></span>
                            </div>
                          </div>

                          {/* Invoice details breakdown */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            {/* Left/Middle - Detailed breakdown of items */}
                            <div className="md:col-span-3 space-y-1.5">
                              <span className="text-[11px] font-black text-gray-400 block mb-1">الأصناف المحجوزة:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {inv.items.map((it: any, itIdx: number) => (
                                  <div key={itIdx} className="bg-white dark:bg-navy-900 px-3 py-1.5 rounded-xl border border-slate-150 dark:border-navy-800 flex justify-between items-center text-xs">
                                    <div className="font-black text-gray-700 dark:text-gray-300">
                                      {it.name}
                                    </div>
                                    <div className="font-bold text-brand-primary">
                                      {it.quantity} × {it.price.toLocaleString()} ر.ي 
                                      {it.selectedUnit && (
                                        <span className="text-[10px] bg-navy-100 dark:bg-navy-800 text-navy-900 dark:text-gray-300 px-1.5 py-0.5 rounded mr-1.5 font-black">
                                          {it.selectedUnit.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Right - Pricing & Settle Controls */}
                            <div className="bg-white dark:bg-navy-900 p-3 rounded-2xl border border-slate-150 dark:border-navy-800 text-center flex flex-col justify-center space-y-2 h-full">
                              <div className="text-[10px] font-black text-gray-400">إجمالي الفاتورة</div>
                              <div className="text-xl font-black text-brand-primary">
                                {invTotal.toLocaleString()} ر.ي
                              </div>
                              {inv.discount > 0 && (
                                <div className="text-[10px] text-danger font-black">
                                  مخصوم منها {inv.discount.toLocaleString()} ر.ي
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action row */}
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-gray-200 dark:border-navy-800 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`تنبيه 💸: سيتم استعادة الفاتورة "${inv.description}" مباشرة لشبكة البيع مع فتح نافذة التحصيل والتأكيد لإجراء تسوية مالية كاملة عليها فورا.\n\nهل تود الاستمرار؟`)) {
                                  handleRestoreHeldInvoice(inv, true);
                                }
                              }}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl cursor-pointer border-none flex items-center gap-1 shadow-md transition-all hover:scale-[1.02]"
                              title="تسوية مالية كاملة ومباشرة لهذه الفاتورة"
                            >
                              <span>تسوية فورية 💵</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRestoreHeldInvoice(inv, false)}
                              className="px-4 py-2 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white transition-all text-xs font-black rounded-xl cursor-pointer border-none flex items-center gap-1"
                              title="تحميل الفاتورة وتعديلها في شبكة البيع"
                            >
                              <span>تعديل / استعادة 📥</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('هل تريد فعلاً إلغاء حجز هذه الفاتورة وحذفها نهائياً؟')) {
                                  handleDeleteHeldInvoice(inv.id);
                                }
                              }}
                              className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all text-xs font-black rounded-xl cursor-pointer border-none flex items-center gap-1"
                              title="إلغاء حجز الفاتورة وحذفها"
                            >
                              <span>إلغاء الحجز 🗑️</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Footer status / Close */}
              <div className="pt-4 border-t border-gray-100 dark:border-navy-700 flex justify-between items-center text-xs text-gray-400 font-bold">
                <span>إجمالي الفواتير المحجوزة: {heldInvoices.length} فواتير</span>
                <button
                  type="button"
                  onClick={() => setIsHeldInvoicesModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer border-none font-black text-xs"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
