import { collection, doc, writeBatch, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export const simulationService = {
  async setupTestAccount(email: string, ownerId: string) {
    // Check if inventory already exists to avoid duplication
    const invSnap = await getDocs(query(collection(db, 'inventory'), where('ownerId', '==', ownerId)));
    if (invSnap.size > 5) return 0;

    const batch = writeBatch(db);

    // 1. Add Inventory Items
    const items = [
      { name: 'iPhone 13 Pro Max - 256GB', price: 850000, cost: 780000, category: 'mobiles', stock: 5, minStock: 2, type: 'new' },
      { name: 'Samsung S22 Ultra', price: 720000, cost: 650000, category: 'mobiles', stock: 3, minStock: 1, type: 'new' },
      { name: 'شاشة آيفون 11 أصلية', price: 45000, cost: 32000, category: 'spare_part', stock: 10, minStock: 3, type: 'new' },
      { name: 'شاحن سريع 20 وات - أبل', price: 12000, cost: 6500, category: 'accessories', stock: 25, minStock: 5, type: 'new' },
      { name: 'سماعة بلوتوث P9', price: 8500, cost: 4200, category: 'accessories', stock: 15, minStock: 5, type: 'new' },
    ];

    items.forEach(item => {
      const ref = doc(collection(db, 'inventory'));
      batch.set(ref, {
        ...item,
        ownerId,
        barcode: Math.floor(Math.random() * 1000000000).toString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    // 2. Add Customers
    const customers = [
      { name: 'محمد علي الحبيشي', phone: '777000111', debt: 15000 },
      { name: 'أحمد صالح اليافعي', phone: '733000222', debt: 0 },
      { name: 'سارة خالد', phone: '711000333', debt: 5000 }
    ];

    customers.forEach(c => {
      const ref = doc(collection(db, 'customers'));
      batch.set(ref, {
        ...c,
        ownerId,
        createdAt: serverTimestamp()
      });
    });

    // 3. Add Initial Account
    const accountRef = doc(collection(db, 'accounts'));
    batch.set(accountRef, {
      ownerId,
      name: 'الصندوق الرئيسي',
      accountNumber: '1101',
      balance: 1000000,
      currency: 'YER',
      isDefault: true,
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return items.length;
  },

  async runWholesaleSimulation(fromEmail: string, toEmail: string) {
    const batch = writeBatch(db);
    // This is a placeholder for a complex cross-account simulation
    // For now, it just adds data to the 'toEmail' owner context
    // In a real scenario, it would create an order in one and inventory in another
    const wholesalers = [
      { name: `مورد تجريبي (${fromEmail})`, phone: '771111222', type: 'wholesaler' }
    ];
    wholesalers.forEach(w => {
      const ref = doc(collection(db, 'suppliers'));
      batch.set(ref, { ...w, ownerId: toEmail, createdAt: serverTimestamp() });
    });
    await batch.commit();
  }
};
