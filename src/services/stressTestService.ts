import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  setDoc,
  serverTimestamp,
  query,
  where,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, InventoryItem, Sale, Transaction } from '../types';

const ADMIN_EMAIL = 'a777503191@gmail.com';
const COMMON_PW = '123456';

export const stressTestService = {
  runFullScenario: async (ownerId: string) => {
    console.log('Starting Stress Test...');
    const batch = writeBatch(db);

    // 1. Create Wholesalers (3)
    const wholesalersData = [
      { email: 'wholesaler1@jam.com', name: 'المورد العالمي للاتصالات', address: 'صنعاء - شارع تعز' },
      { email: 'wholesaler2@jam.com', name: 'أفق التكنولوجيا للجملة', address: 'عدن - المنصورة' },
      { email: 'wholesaler3@jam.com', name: 'مركز مأرب التجاري', address: 'مأرب - السوق العام' }
    ];

    const wholesalerIds: string[] = [];
    for (const ws of wholesalersData) {
      const uid = 'ws_' + Math.random().toString(36).substr(2, 9);
      wholesalerIds.push(uid);
      await setDoc(doc(db, 'users', uid), {
        uid, email: ws.email, name: ws.name, role: 'manager', networkRole: 'wholesaler',
        ownerId: uid, visibility: true, status: 'active', currentPassword: COMMON_PW,
        shopAddress: ws.address, createdAt: serverTimestamp()
      });
    }

    // 2. Create Retailers (5)
    const retailerIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const uid = 'ret_' + Math.random().toString(36).substr(2, 9);
      retailerIds.push(uid);
      await setDoc(doc(db, 'users', uid), {
        uid, email: `retailer${i}@jam.com`, name: `محل التجزئة رقم ${i}`, role: 'manager',
        networkRole: 'retailer', ownerId: uid, visibility: true, status: 'active',
        currentPassword: COMMON_PW, createdAt: serverTimestamp()
      });
    }

    // 3. Create Staff (5) - Attaching to current owner (أبو جواد)
    const staffRoles = ['sales', 'engineer', 'prep', 'sales', 'engineer'];
    for (let i = 0; i < 5; i++) {
      const uid = 'staff_' + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'users', uid), {
        uid, email: `staff${i+1}@jam.com`, name: `موظف ${staffRoles[i]} محترف`,
        role: staffRoles[i] === 'engineer' ? 'engineer' : 'employee',
        networkRole: 'retailer', ownerId, status: 'active', currentPassword: COMMON_PW,
        createdAt: serverTimestamp()
      });
    }

    // 4. Generate Inventory for Wholesalers
    const itemTemplates = [
      { name: 'iPhone 15 Pro Max', cost: 1200, price: 1350 },
      { name: 'Samsung S24 Ultra', cost: 1000, price: 1150 },
      { name: 'Redmi Note 13', cost: 200, price: 250 },
      { name: 'شاحن سريع 65W', cost: 15, price: 25 },
      { name: 'برمجة مودم 5G', cost: 5, price: 15 }
    ];

    for (const wsId of wholesalerIds) {
      for (const t of itemTemplates) {
        await addDoc(collection(db, 'inventory'), {
          ownerId: wsId, name: t.name, cost: t.cost, price: t.price, stock: 500,
          category: 'Hardware', createdAt: serverTimestamp()
        });
      }
    }

    // 5. Generate 30 Days of Transactions (The "Meat")
    const now = new Date();
    for (let day = 0; day < 30; day++) {
       const date = new Date(now);
       date.setDate(date.getDate() - day);
       
       // Generate 10 sales per day for the main owner
       for (let s = 0; s < 10; s++) {
          await addDoc(collection(db, 'sales'), {
            ownerId,
            customerName: `عميل يوم ${day}-${s}`,
            total: Math.floor(Math.random() * 500) + 50,
            profit: Math.floor(Math.random() * 100) + 10,
            status: 'completed',
            createdAt: Timestamp.fromDate(date)
          });

          // Random Expense
          if (Math.random() > 0.7) {
            await addDoc(collection(db, 'transactions'), {
              ownerId, type: 'expense', amount: 20, category: 'مصاريف تشغيلية',
              description: 'فاتورة كهرباء / إنترنت', createdAt: Timestamp.fromDate(date)
            });
          }
       }
    }

    console.log('Stress Test Seeding Completed.');
  }
};
