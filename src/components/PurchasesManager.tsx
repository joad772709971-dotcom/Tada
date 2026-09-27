import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Trash2, 
  Save, 
  FileText, 
  User, 
  Coins, 
  Check, 
  X, 
  AlertCircle,
  Truck,
  PlusCircle,
  ShoppingBag,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem, PurchaseInvoice, AccountNode, UserProfile, PurchaseItem } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { draftVaultService } from '../services/draftVaultService';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';

interface PurchasesManagerProps {
  inventory: InventoryItem[];
  purchases: PurchaseInvoice[];
  accounts: AccountNode[];
  currentUser: UserProfile;
  onAddPurchase: (invoice: PurchaseInvoice) => void;
  onUpdateInventoryStock: (id: string, newStock: number) => void;
  onAddTransaction: (tx: any) => void;
  onAdjustAccountBalance: (id: string, amount: number) => void;
  onClose?: () => void;
  onAddInventoryItem?: (item: InventoryItem) => void;
}

export default function PurchasesManager({
  inventory,
  purchases,
  accounts,
  currentUser,
  onAddPurchase,
  onUpdateInventoryStock,
  onAddTransaction,
  onAdjustAccountBalance,
  onClose,
  onAddInventoryItem
}: PurchasesManagerProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [searchTerm, setSearchTerm] = useState('');

  // Cart helper state
  const [cart, setCart] = useState<{
    item: InventoryItem;
    quantity: number;
    buyPrice: number;
    unitType: 'piece' | 'dozen' | 'carton';
  }[]>([]);

  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || 'acc_cash_box');

  // 💾 محرك استرجاع مسودة المشتريات المفتوحة مسبقاً (DraftVault)
  useEffect(() => {
    const restorePurchasesDraft = async () => {
      const storeId = currentUser.ownerId || currentUser.uid || 'default_store';
      const userId = currentUser.uid || 'default_user';
      try {
        const draft = await draftVaultService.getDraft(storeId, userId, 'purchases_manager_active_draft');
        if (draft) {
          if (Array.isArray(draft.cart) && draft.cart.length > 0 && cart.length === 0) {
            setCart(draft.cart);
          }
          if (draft.selectedSupplierName && !selectedSupplierName) {
            setSelectedSupplierName(draft.selectedSupplierName);
          }
          if (draft.paymentMethod) {
            setPaymentMethod(draft.paymentMethod);
          }
          if (draft.selectedAccountId) {
            setSelectedAccountId(draft.selectedAccountId);
          }
        }
      } catch (err) {
        console.warn('Could not restore purchases draft:', err);
      }
    };
    restorePurchasesDraft();
  }, [currentUser]);

  // 💾 الحفظ التلقائي الفوري لمسودة المشتريات عند إضافة أي صنف أو اسم مورد
  useEffect(() => {
    const storeId = currentUser.ownerId || currentUser.uid || 'default_store';
    const userId = currentUser.uid || 'default_user';
    if (cart.length > 0 || selectedSupplierName.trim()) {
      draftVaultService.saveDraft(storeId, userId, 'purchases_manager_active_draft', {
        cart,
        selectedSupplierName,
        paymentMethod,
        selectedAccountId,
        updatedAt: Date.now()
      });
    } else {
      draftVaultService.clearDraft(storeId, userId, 'purchases_manager_active_draft');
    }
  }, [cart, selectedSupplierName, paymentMethod, selectedAccountId, currentUser]);

  // Input states for quick item addition to cart
  const [selectedItemId, setSelectedItemId] = useState('');
  const [addQty, setAddQty] = useState<number>(1);
  const [addBuyPrice, setAddBuyPrice] = useState<number>(0);

  // Quick Add New Product State
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [categories, setCategories] = useState<string[]>([
    'قطع غيار', 'شواحن وبطاريات', 'إكسسوارات', 'صيانة عامة', 'عام'
  ]);
  const [newItemCategory, setNewItemCategory] = useState('قطع غيار');

  useEffect(() => {
    const ownerId = currentUser.ownerId || currentUser.uid;
    if (!ownerId) return;
    const qCats = query(
      collection(db, 'inventory_categories'),
      where('ownerId', '==', ownerId)
    );
    const unsubscribeCats = onSnapshot(qCats, (snapshot) => {
      if (!snapshot.empty) {
        const catNames = snapshot.docs.map(docSnap => docSnap.data().name as string);
        const uniqueCats = Array.from(new Set([...catNames, 'عام']));
        setCategories(uniqueCats);
        if (uniqueCats.length > 0 && !uniqueCats.includes(newItemCategory)) {
          setNewItemCategory(uniqueCats[0]);
        }
      }
    });
    return () => unsubscribeCats();
  }, [currentUser]);

  const [newItemPrice, setNewItemPrice] = useState<number>(0);
  const [newItemWholesalePrice, setNewItemWholesalePrice] = useState<number>(0);
  const [newItemCost, setNewItemCost] = useState<number>(0);
  const [newItemBarcode, setNewItemBarcode] = useState('');
  const [newItemMinStock, setNewItemMinStock] = useState<number>(5);

  // Initialize cart cleanly
  const currentCart = cart || [];

  // Handle setting active item fields when selected
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const found = inventory.find(i => i.id === itemId);
    if (found) {
      setAddBuyPrice(found.cost || found.lastBuyPrice || 0);
    }
  };

  const handleCreateAndSelectNewProduct = () => {
    if (!newItemName.trim()) {
      alert('الرجاء إدخال اسم الصنف الجديد!');
      return;
    }

    if (newItemCost < 0) {
      alert('الرجاء تحديد سعر تكلفة صحيح للصنف!');
      return;
    }

    const newId = `item_${Date.now()}`;
    const generatedBarcode = newItemBarcode.trim() || `2006${Date.now().toString().slice(-4)}`;

    const newItem: InventoryItem = {
      id: newId,
      ownerId: currentUser.ownerId || currentUser.uid,
      name: newItemName.trim(),
      category: newItemCategory,
      stock: 0, // Starts at 0 stock, the purchase cart invoice will add the purchased stock to it
      minStock: newItemMinStock,
      price: newItemPrice || Math.round(newItemCost * 1.25),
      wholesalePrice: newItemWholesalePrice || Math.round(newItemCost * 1.15),
      cost: newItemCost,
      lastBuyPrice: newItemCost,
      barcode: generatedBarcode
    };

    if (onAddInventoryItem) {
      onAddInventoryItem(newItem);
    }

    // Auto-select this new item in the purchases input
    setSelectedItemId(newId);
    setAddBuyPrice(newItemCost);
    setAddQty(1);

    // Close and reset form
    setIsAddingNewProduct(false);
    setNewItemName('');
    setNewItemCategory('قطع غيار');
    setNewItemPrice(0);
    setNewItemWholesalePrice(0);
    setNewItemCost(0);
    setNewItemBarcode('');
    setNewItemMinStock(5);
  };

  // Add Item to cart
  const handleAddToCart = () => {
    if (!selectedItemId) return;
    const found = inventory.find(i => i.id === selectedItemId);
    if (!found) return;

    if (addQty <= 0) {
      alert('الرجاء إدخال كمية صحيحة للتوريد!');
      return;
    }

    // Check if item already exists in cart, if yes we increase quantity
    const existingIndex = currentCart.findIndex(c => c.item.id === selectedItemId);
    if (existingIndex > -1) {
      const updated = [...currentCart];
      updated[existingIndex].quantity += addQty;
      updated[existingIndex].buyPrice = addBuyPrice; // Update with latest custom cost
      setCart(updated);
    } else {
      setCart([
        ...currentCart,
        {
          item: found,
          quantity: addQty,
          buyPrice: addBuyPrice,
          unitType: 'piece'
        }
      ]);
    }

    // Reset inputs
    setSelectedItemId('');
    setAddQty(1);
    setAddBuyPrice(0);
  };

  // Remove from cart
  const handleRemoveFromCart = (itemId: string) => {
    setCart(currentCart.filter(c => c.item.id !== itemId));
  };

  // Calculate sum totals
  const totalInvoiceAmount = currentCart.reduce((sum, c) => sum + (c.quantity * c.buyPrice), 0);

  // Submit and archive Invoice
  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplierName.trim()) {
      alert('يرجى تحديد أو كتابة اسم المورد للفوترة!');
      return;
    }

    if (currentCart.length === 0) {
      alert('سلتك فارغة! يرجى إضافة قطعة أو مادة واحدة على الأقل لفاتورة الشراء.');
      return;
    }

    if (paymentMethod === 'cash' && !selectedAccountId) {
      alert('يرجى تحديد حساب الصندوق المالي المصدر للدفع النقدي!');
      return;
    }

    const invoiceId = `pur_inv_${Date.now()}`;
    const invoiceItems: PurchaseItem[] = currentCart.map(c => ({
      id: c.item.id,
      name: c.item.name,
      buyPrice: c.buyPrice,
      quantity: c.quantity,
      unitType: c.unitType,
      qtyInPieces: c.quantity // Standard piece volume is matched
    }));

    // Create the full Invoice object
    const purchaseInvoice: PurchaseInvoice = {
      id: invoiceId,
      ownerId: currentUser.ownerId || currentUser.uid,
      buyerId: currentUser.uid,
      buyerName: currentUser.name,
      supplierId: `supp_${Date.now()}`,
      supplierName: selectedSupplierName.trim(),
      items: invoiceItems,
      total: totalInvoiceAmount,
      paymentMethod,
      createdAt: new Date().toISOString()
    };

    // Save invoice
    onAddPurchase(purchaseInvoice);

    // Update stocks of all items
    currentCart.forEach(c => {
      onUpdateInventoryStock(c.item.id, (c.item.stock || 0) + c.quantity);
    });

    // Handle financial accounting movements
    if (paymentMethod === 'cash') {
      // 1. Deduct cost from the selected Cashier Box balance
      onAdjustAccountBalance(selectedAccountId, -totalInvoiceAmount);

      // 2. Add an expense financial transaction
      onAddTransaction({
        id: `tx_pur_${Date.now()}`,
        ownerId: currentUser.ownerId || currentUser.uid,
        type: 'expense',
        amount: totalInvoiceAmount,
        category: 'مشتريات وتوريد بضائع',
        description: `شراء وتوريد بضائع من المورد (${selectedSupplierName}) بموجب فاتورة #${invoiceId}`,
        accountId: selectedAccountId,
        createdAt: new Date().toISOString()
      });
    } else {
      // If payment is credit/debt, register ledger of the main liabilities account node
      onAdjustAccountBalance('acc_liabilities_suppliers', totalInvoiceAmount);
      
      onAddTransaction({
        id: `tx_pur_${Date.now()}`,
        ownerId: currentUser.ownerId || currentUser.uid,
        type: 'expense',
        amount: totalInvoiceAmount,
        category: 'مشتريات آجلة للمحل',
        description: `توريد آجِل لمواد ومستلزمات من المورد (${selectedSupplierName}) رصيد ذمم معلقة`,
        accountId: 'acc_liabilities_suppliers',
        createdAt: new Date().toISOString()
      });
    }

    // Free the cart & notify success
    setCart([]);
    setSelectedSupplierName('');
    alert(`🎉 تم بنجاح ترحيل فاتورة الشراء وتوريد الكميات للمخازن وتحديث الصناديق المالية بالنظام بنجاح!`);
    setActiveTab('history');
  };

  // Filter historic invoices
  const filteredPurchases = purchases.filter(p => 
    p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.buyerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header Close Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-4 gap-4">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            📥 إدارة فواتير الشراء والتوريد المخزني
          </h2>
          <p className="text-zinc-500 text-[10px]/relaxed mt-0.5">زيادة مستويات المخزون بتوريد المنتجات من الموردين، وإدخال قيود حسابات الذمم الدائنة والصناديق.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UniversalReportButton
            variant="emerald"
            buttonText="تقرير فواتير المشتريات"
            payload={{
              title: 'تقرير فواتير المشتريات والتوريد المخزني',
              subtitle: 'كشف فواتير الشراء من الموردين والمدفوعات والمستحقات المتبقية',
              currency: 'ر.ي',
              summaryCards: [
                { label: 'عدد فواتير الشراء', value: purchases.length, currency: 'فاتورة', color: 'blue' },
                { label: 'إجمالي المشتريات', value: purchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0).toLocaleString(), currency: 'ر.ي', color: 'purple' },
                { label: 'المسدد نقداً / بنك', value: purchases.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0).toLocaleString(), currency: 'ر.ي', color: 'green' },
                { label: 'المتبقي ذمم دائنة (آجل)', value: purchases.reduce((sum, p) => sum + (Number(p.remainingAmount) || 0), 0).toLocaleString(), currency: 'ر.ي', color: 'amber' }
              ],
              columns: [
                { key: 'id', header: 'رقم الفاتورة', type: 'text', width: 14, formatter: (val) => val ? String(val).slice(-8) : '-' },
                { key: 'supplierName', header: 'اسم المورد', type: 'text', width: 20 },
                { key: 'totalAmount', header: 'إجمالي الفاتورة', type: 'currency', width: 15 },
                { key: 'paidAmount', header: 'المبلغ المدفوع', type: 'currency', width: 14 },
                { key: 'remainingAmount', header: 'المتبقي (آجل)', type: 'currency', width: 14 },
                { key: 'paymentType', header: 'طريقة الدفع', type: 'text', width: 12, formatter: (val) => val === 'cash' ? 'نقداً' : val === 'credit' ? 'آجل' : 'تحويل' },
                { key: 'createdAt', header: 'التاريخ والوقت', type: 'date', width: 18 }
              ],
              data: filteredPurchases.length > 0 ? filteredPurchases : purchases
            }}
          />

          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-900/50 text-rose-300 font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer"
            >
              ✕ إغلاق النافذة
            </button>
          )}

          <div className="bg-[#080808] p-1 rounded-xl border border-zinc-900 flex">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-amber-600 text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              تسجيل فاتورة جديدة
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-amber-600 text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              سجل المشتريات 📂
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'create' ? (
          <motion.div 
            key="create-pur"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            
            {/* Cart & Selector Item Scope */}
            <div className="lg:col-span-2 space-y-5">
              
              {/* Quick Add Item Section */}
              <div className="p-5 bg-gradient-to-br from-[#0c0c0c] to-[#040404] border border-zinc-900 rounded-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                  <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                    <Package size={14} />
                    اختر الصنف المراد شراؤه وتوريده لزيادة رصيده
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewProduct(!isAddingNewProduct);
                      // Clear selection if they switch to new product definition
                      setSelectedItemId('');
                      setAddBuyPrice(0);
                    }}
                    className="px-3 py-1.5 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 text-amber-400 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer self-end sm:self-auto"
                  >
                    {isAddingNewProduct ? '✕ إلغاء تعريف صنف' : '➕ تعريف صنف جديد وإدخاله للسلة'}
                  </button>
                </div>

                {isAddingNewProduct ? (
                  <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-900 text-xs space-y-4 mb-2">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                      <span className="font-black text-zinc-300 text-[11px] flex items-center gap-1">
                        ➕ تعريف صنف جديد كلياً في النظام
                      </span>
                      <span className="text-[10px] text-zinc-500">سيتم حفظ البيانات الأساسية للصنف كمنتج جديد</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-zinc-500 mb-1 font-bold">اسم المنتج الجديد *</label>
                        <input
                          type="text"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          placeholder="مثال: شاشة آيفون 13 برو، بطارية ريلمي"
                          className="w-full p-2.5 bg-[#080808] border border-zinc-900 rounded-lg text-white focus:outline-none focus:border-amber-600"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-500 mb-1 font-bold">القسم / فئة الصنف</label>
                        <select
                          value={newItemCategory}
                          onChange={(e) => setNewItemCategory(e.target.value)}
                          className="w-full p-2.5 bg-[#080808] border border-zinc-900 rounded-lg text-white focus:outline-none focus:border-amber-600 font-bold"
                        >
                          {categories.map((cat, idx) => (
                            <option key={idx} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-zinc-500 mb-1 font-bold">سعر التكلفة والشراء بالعملة المحلية (ر.ي) *</label>
                        <input
                          type="number"
                          value={newItemCost || ''}
                          onChange={(e) => setNewItemCost(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="سعر شراء القطعة من المستورد"
                          className="w-full p-2.5 bg-[#080808] border border-zinc-900 rounded-lg text-white font-mono focus:outline-none focus:border-amber-600"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-500 mb-1 font-bold">سعر البيع النهائي للمستهلك (ر.ي)</label>
                        <input
                          type="number"
                          value={newItemPrice || ''}
                          onChange={(e) => setNewItemPrice(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="سعر بيع التجزئة للزبون"
                          className="w-full p-2.5 bg-[#080808] border border-zinc-900 rounded-lg text-white font-mono focus:outline-none focus:border-amber-600"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-500 mb-1 font-bold">سعر البيع لقطاع الجملة إن وجد (ر.ي)</label>
                        <input
                          type="number"
                          value={newItemWholesalePrice || ''}
                          onChange={(e) => setNewItemWholesalePrice(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="اختياري - سعر بيع التجار والمحلات"
                          className="w-full p-2.5 bg-[#080808] border border-zinc-900 rounded-lg text-white font-mono focus:outline-none focus:border-amber-600"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-500 mb-1 font-bold">الباركود أو رقم الصنف المرجعي (Barcode)</label>
                        <input
                          type="text"
                          value={newItemBarcode}
                          onChange={(e) => setNewItemBarcode(e.target.value)}
                          placeholder="اختياري - اتركه فارغاً لتوليد كود تلقائي"
                          className="w-full p-2.5 bg-[#080808] border border-zinc-900 rounded-lg text-white font-mono focus:outline-none focus:border-amber-600"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2.5 border-t border-zinc-900">
                      <button
                        type="button"
                        onClick={() => setIsAddingNewProduct(false)}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-bold rounded-xl transition cursor-pointer text-xs"
                      >
                        إلغاء التراجع
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateAndSelectNewProduct}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer text-xs"
                      >
                        <Check size={14} />
                        حفظ الصنف وتحديده تلقائياً للتوريد
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                      <div className="md:col-span-2">
                        <label className="block text-zinc-555 mb-1 font-bold text-zinc-400">البحث عن الصنف بالاسم أو الباركود</label>
                        <select
                          value={selectedItemId}
                          onChange={(e) => handleItemSelect(e.target.value)}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-white focus:outline-none focus:border-amber-600 font-bold"
                        >
                          <option value="">-- اختر الصنف من المخزن --</option>
                          {inventory.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} (المتوفر حالياً: {item.stock || 0} حبة)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-zinc-555 mb-1 font-bold text-zinc-400">الكمية المستوردة</label>
                        <input
                          type="number"
                          value={addQty}
                          onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 0))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-white text-center font-mono focus:outline-none font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-555 mb-1 font-bold text-zinc-400">سعر التكلفة للواحدة (ر.ي)</label>
                        <input
                          type="number"
                          value={addBuyPrice}
                          onChange={(e) => setAddBuyPrice(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-white text-center font-mono focus:outline-none font-bold"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!selectedItemId}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-50 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle size={14} className="text-amber-500" />
                        إدراج لسلة التوريد المعلقة
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Cart Items List */}
              <div className="bg-gradient-to-br from-[#0c0c0c] to-[#040404] border border-zinc-900 rounded-2xl p-5">
                <span className="text-xs font-black text-white block mb-4">🛒 تفاصيل الأصناف المورّدة بسحر الفاتورة</span>
                
                <div className="overflow-x-auto text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 font-bold">
                        <th className="py-2.5 text-right font-bold text-xs">اسم الصنف</th>
                        <th className="py-2.5 text-center font-bold text-xs">سعر الشراء الواحد</th>
                        <th className="py-2.5 text-center font-bold text-xs font-mono">الكمية</th>
                        <th className="py-2.5 text-left font-bold text-xs">الإجمالي المالي</th>
                        <th className="py-2.5 text-center font-bold text-xs">خيارات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-950">
                      {currentCart.map(c => (
                        <tr key={c.item.id} className="text-zinc-300 hover:bg-zinc-950/40">
                          <td className="py-3 font-bold">{c.item.name}</td>
                          <td className="py-3 text-center font-mono font-medium">{c.buyPrice.toLocaleString()} ر.ي</td>
                          <td className="py-3 text-center font-mono font-bold text-white bg-zinc-950/40 rounded-lg">{c.quantity} حبة</td>
                          <td className="py-3 text-left font-mono font-black text-emerald-400">{(c.quantity * c.buyPrice).toLocaleString()} ر.ي</td>
                          <td className="py-3 text-center">
                            <button
                              onClick={() => handleRemoveFromCart(c.item.id)}
                              className="p-1.5 text-rose-400 hover:bg-rose-950/30 rounded-lg cursor-pointer transition"
                              title="حذف من السلة"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {currentCart.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-zinc-650 text-[11px]">
                            سلة المشتريات فارغة. اختر أصنافاً وقم بإدراجها بالأعلى لإكمال عملية التوريد.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Financial and Supplier Settings */}
            <form onSubmit={handleSaveInvoice} className="space-y-4 bg-gradient-to-br from-[#090909] to-[#030303] border border-zinc-900 rounded-2xl p-5 text-xs">
              <span className="text-xs font-black text-[#f1c40f] block pb-2 border-b border-zinc-950 flex items-center gap-1.5">
                <Truck size={14} />
                بيانات الدفع والمورد للفاتورة الأصيلة
              </span>

              <div>
                <label className="block text-zinc-400 mb-1.5 font-bold">اسم المورد / شركة الاستيراد</label>
                <input
                  type="text"
                  required
                  value={selectedSupplierName}
                  onChange={(e) => setSelectedSupplierName(e.target.value)}
                  className="w-full p-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  placeholder="مثال: شركة المحفلي لقطع الدراجات"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5 font-bold">أسلوب ونوع سداد البضاعة</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-lg font-black transition cursor-pointer text-center ${
                      paymentMethod === 'cash'
                        ? 'bg-amber-600/20 text-amber-500 border border-amber-600/40'
                        : 'bg-zinc-950 text-zinc-500 border border-zinc-900 hover:text-zinc-350'
                    }`}
                  >
                    نقداً من الصندوق
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={`py-2 px-3 rounded-lg font-black transition cursor-pointer text-center ${
                      paymentMethod === 'credit'
                        ? 'bg-amber-600/20 text-amber-500 border border-amber-600/40'
                        : 'bg-zinc-950 text-zinc-500 border border-zinc-900 hover:text-zinc-350'
                    }`}
                  >
                    شراء بالآجل (ذمم دائنة)
                  </button>
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-bold">الصندوق أو البنك الدائن (الدفع منه)</label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-white focus:outline-none focus:border-amber-600"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (الرصيد: {acc.balance.toLocaleString()} ر.ي)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Total Summary Block */}
              <div className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-900 space-y-1 mt-4">
                <span className="text-zinc-500 text-[10px] block">المطالبة المالية الإجمالية لفاتورة المشتريات:</span>
                <span className="text-lg font-black text-emerald-400 font-mono block">
                  {totalInvoiceAmount.toLocaleString()} ر.ي
                </span>
                <span className="text-[9px] text-zinc-600 mt-1 block leading-relaxed">
                  * سيتم تلقائياً ترحيل الكميات وإضافتها لحظياً إلى رصيد الجرد ومخزن الورشة فور الحفظ والترحيل المعتمد.
                </span>
              </div>

              <button
                type="submit"
                disabled={currentCart.length === 0}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black font-black rounded-xl transition text-center shadow-lg cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 mt-2"
              >
                <Save size={15} />
                حفظ وترحيل فاتورة التوريد
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="history-pur"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Search Header */}
            <div className="relative">
              <span className="absolute inset-y-0 right-3 flex items-center text-zinc-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="ابحث بـ اسم المورد أو الرقم المرجعي لفواتير الشراء التاريخية..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-[#080808] border border-zinc-900 rounded-xl text-xs text-white placeholder-zinc-650"
              />
            </div>

            {/* List of historic purchases */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPurchases.map(inv => (
                <div key={inv.id} className="p-5 rounded-2xl bg-gradient-to-br from-[#0c0c0c] to-[#040404] border border-zinc-900 space-y-3">
                  <div className="flex justify-between items-start border-b border-zinc-950 pb-2">
                    <div>
                      <h4 className="text-xs font-black text-white">{inv.supplierName}</h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">سند شراء #{inv.id}</p>
                    </div>

                    <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-bold rounded">
                      {inv.paymentMethod === 'cash' ? '💵 نقدي' : '⏳ آجل على الحساب'}
                    </span>
                  </div>

                  {/* Purchased items list */}
                  <div className="space-y-1.5 text-[11px] text-zinc-450 leading-relaxed max-h-24 overflow-y-auto">
                    {inv.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>• {i.name} (عدد {i.quantity} قطعة)</span>
                        <span className="font-mono">{i.buyPrice.toLocaleString()} ر.ي</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-950 flex justify-between items-center">
                    <span className="text-emerald-400 font-black font-mono text-xs">
                      إجمالي الفاتورة: {inv.total.toLocaleString()} ر.ي
                    </span>

                    <span className="text-[9px] text-zinc-650 flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(inv.createdAt).toLocaleString('ar-YE')}
                    </span>
                  </div>
                </div>
              ))}

              {filteredPurchases.length === 0 && (
                <div className="col-span-full py-16 text-center text-zinc-600 text-xs">
                  لا توجد فواتير توريد أو شراء مدخلة بالنظام حالياً.
                </div>
              )}
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
