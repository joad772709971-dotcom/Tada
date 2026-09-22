import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp, orderBy, limit, doc, getDocs, writeBatch, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

export interface SystemStats {
  dailySales: number;
  dailyProfit: number;
  cashInHand: number;
  pendingMaintenance: number;
  waitingMaintenance: number;
  lowStockItems: number;
  pendingNetworkOrders: number;
  totalOperationsToday: number;
  salesCount: number;
  balanceCount: number;
}

interface SystemSyncContextType {
  stats: SystemStats;
  loading: boolean;
  clearAndResetTreasury: () => Promise<void>;
}

const SystemSyncContext = createContext<SystemSyncContextType | undefined>(undefined);

export function SystemSyncProvider({ children, profile }: { children: React.ReactNode, profile: UserProfile | null }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats>({
    dailySales: 0,
    dailyProfit: 0,
    cashInHand: 0,
    pendingMaintenance: 0,
    waitingMaintenance: 0,
    lowStockItems: 0,
    pendingNetworkOrders: 0,
    totalOperationsToday: 0,
    salesCount: 0,
    balanceCount: 0
  });

  useEffect(() => {
    if (!profile?.ownerId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    // 1. Sales onSnapshot for today
    const salesQ = query(
      collection(db, 'sales'),
      where('ownerId', '==', profile.ownerId),
      where('createdAt', '>=', todayTimestamp),
      orderBy('createdAt', 'desc')
    );

    // 2. Balance Transactions onSnapshot for today
    const balanceQ = query(
      collection(db, 'balanceTransactions'),
      where('ownerId', '==', profile.ownerId),
      where('createdAt', '>=', todayTimestamp),
      where('type', '==', 'sale')
    );

    // 3. Active / Pending Maintenance Orders
    const maintQ = query(
      collection(db, 'maintenanceOrders'),
      where('ownerId', '==', profile.ownerId)
    );

    // 4. Central Vaults & Drawers Balance
    const vaultsQ = query(
      collection(db, 'vaults'),
      where('ownerId', '==', profile.ownerId)
    );

    // 5. Total transactions today (Operations logger)
    const transQ = query(
      collection(db, 'transactions'),
      where('ownerId', '==', profile.ownerId),
      where('createdAt', '>=', todayTimestamp)
    );

    // 6. Network/Online orders queue
    const netQ = query(
      collection(db, 'networkOrders'),
      where('ownerId', '==', profile.ownerId),
      where('status', '==', 'pending')
    );

    // State placeholders for multi-source combination
    let rawSales: any[] = [];
    let rawBalances: any[] = [];
    let rawMaint: any[] = [];
    let rawVaults: any[] = [];
    let transTodayCount = 0;
    let pendingNetCount = 0;

    const updateAggregates = () => {
      // Calculate daily sales total
      const salesTotal = rawSales.reduce((acc, s) => acc + (s.total || 0), 0);
      const balanceTotal = rawBalances.reduce((acc, b) => acc + (b.amountReceived || b.price || 0), 0);
      const combinedDailySales = salesTotal + balanceTotal;

      // Calculate daily profit total
      const salesProfit = rawSales.reduce((acc, s) => {
        if (s.profit !== undefined) return acc + s.profit;
        const cost = (s.items || []).reduce((sum, item) => sum + ((item.cost || 0) * (item.quantity || 1)), 0);
        return acc + Math.max(0, s.total - cost);
      }, 0);

      const balanceProfit = rawBalances.reduce((acc, b) => acc + (b.profit || 0), 0);

      const maintProfit = rawMaint
        .filter(m => m.status === 'delivered' && m.updatedAt >= todayTimestamp)
        .reduce((acc, order) => {
          const partsCost = (order.sparePartsUsed || []).reduce((sum, p) => sum + (p.cost || 0), 0);
          const partsPrice = (order.sparePartsUsed || []).reduce((sum, p) => sum + (p.price || 0), 0);
          const serviceFee = Math.max(0, (order.cost || 0) - partsPrice);
          const shopPartsProfit = partsPrice - partsCost;
          const percentage = order.engineerPercentage || 50;
          const shopServiceShare = serviceFee * ((100 - percentage) / 100);
          return acc + shopPartsProfit + shopServiceShare;
        }, 0);

      const combinedDailyProfit = salesProfit + balanceProfit + maintProfit;

      // Vault / Cash In Hand - Safe State Initialization
      const combinedCash = rawVaults.reduce((acc, v) => {
        let bal = parseFloat(v.balance as any) || 0;
        // Safe State Initialization: Sanitize invalid/cached starting baseline negative values or default +3000
        if (bal === -3000 || bal === 3000 || bal < 0) {
          bal = 0;
        }
        return acc + bal;
      }, 0);

      // Maintenance workloads
      const activeWorkingMaint = rawMaint.filter(o => o.status === 'working').length;
      const activePendingMaint = rawMaint.filter(o => o.status === 'pending' || o.status === 'received').length;

      setStats({
        dailySales: combinedDailySales,
        dailyProfit: combinedDailyProfit,
        cashInHand: combinedCash,
        pendingMaintenance: activeWorkingMaint,
        waitingMaintenance: activePendingMaint,
        lowStockItems: 0, // Placeholder
        pendingNetworkOrders: pendingNetCount,
        totalOperationsToday: transTodayCount,
        salesCount: rawSales.length,
        balanceCount: rawBalances.length
      });
      setLoading(false);
    };

    // Subscriptions
    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      rawSales = snapshot.docs.map(doc => doc.data());
      updateAggregates();
    }, (err) => console.warn('SystemStats Context error (sales):', err));

    const unsubBalance = onSnapshot(balanceQ, (snapshot) => {
      rawBalances = snapshot.docs.map(doc => doc.data());
      updateAggregates();
    }, (err) => console.warn('SystemStats Context error (balance):', err));

    const unsubMaint = onSnapshot(maintQ, (snapshot) => {
      rawMaint = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          ...d,
          updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt : Timestamp.now()
        };
      });
      updateAggregates();
    }, (err) => console.warn('SystemStats Context error (maint):', err));

    const unsubVaults = onSnapshot(vaultsQ, (snapshot) => {
      rawVaults = snapshot.docs.map(doc => doc.data());
      updateAggregates();
    }, (err) => console.warn('SystemStats Context error (vaults):', err));

    const unsubTrans = onSnapshot(transQ, (snapshot) => {
      transTodayCount = snapshot.size;
      updateAggregates();
    }, (err) => console.warn('SystemStats Context error (transactions):', err));

    const unsubNet = onSnapshot(netQ, (snapshot) => {
      pendingNetCount = snapshot.size;
      updateAggregates();
    }, (err) => console.warn('SystemStats Context error (networks):', err));

    return () => {
      unsubSales();
      unsubBalance();
      unsubMaint();
      unsubVaults();
      unsubTrans();
      unsubNet();
    };
  }, [profile]);

  const clearAndResetTreasury = async () => {
    if (!profile?.ownerId) {
      console.warn('Cannot clear and reset treasury: profile.ownerId is missing.');
      return;
    }
    try {
      const ownerId = profile.ownerId;
      const sId = profile.storeId || ownerId || 'main_store';

      console.log('Starting clear and reset treasury process for ownerId:', ownerId);

      // 1. Erase all cached drawer offsets & EOD markers from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.toLowerCase().includes('offset') || key.toLowerCase().includes('drawer') || key.toLowerCase().includes('eod'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('Erased cached drawer offsets and EOD states from localStorage.');

      // 2. Clear collections 'bank_accounts', 'customBoxes', and 'vaults'
      // - bank_accounts
      const bankAccountsQ = query(collection(db, 'bank_accounts'), where('ownerId', '==', ownerId));
      const bankAccountsSnap = await getDocs(bankAccountsQ);
      if (!bankAccountsSnap.empty) {
        const b = writeBatch(db);
        bankAccountsSnap.docs.forEach(docSnap => b.delete(docSnap.ref));
        await b.commit();
      }

      // - stores/{ownerId}/customBoxes
      const customBoxesRef = collection(db, 'stores', ownerId, 'customBoxes');
      const customBoxesSnap = await getDocs(customBoxesRef);
      if (!customBoxesSnap.empty) {
        const b = writeBatch(db);
        customBoxesSnap.docs.forEach(docSnap => b.delete(docSnap.ref));
        await b.commit();
      }

      // - stores/{ownerId}/vaults
      const storeVaultsRef = collection(db, 'stores', sId, 'vaults');
      const storeVaultsSnap = await getDocs(storeVaultsRef);
      if (!storeVaultsSnap.empty) {
        const b = writeBatch(db);
        storeVaultsSnap.docs.forEach(docSnap => b.delete(docSnap.ref));
        await b.commit();
      }

      // - vaults (root)
      const rootVaultsQ = query(collection(db, 'vaults'), where('ownerId', '==', ownerId));
      const rootVaultsSnap = await getDocs(rootVaultsQ);
      if (!rootVaultsSnap.empty) {
        const b = writeBatch(db);
        rootVaultsSnap.docs.forEach(docSnap => b.delete(docSnap.ref));
        await b.commit();
      }

      // - drawers collection (root/main_drawer)
      try {
        const drawerRef = doc(db, 'drawers', 'main_drawer');
        await setDoc(drawerRef, {
          balances: { YER: 0, USD: 0, SAR: 0 },
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Failed to clear drawers/main_drawer:', e);
      }

      // 3. Set their initial dynamic application balance state to absolute 0 YER.
      // Re-seed the canonical wallets in customBoxes, bank_accounts, and vaults with balance = 0 and empty default account details
      const seededCanonicalWallets = [
        { id: 'CASH_BOX', boxName: 'صندوق النقد الرئيسي (الكاش)', chartOfAccountsCode: '1101', chartOfAccountsName: 'النقدية بالصندوق', type: 'cash', balance: 0, isFixed: true, currency: 'YER', accountNumber: '', accountName: '' },
        { id: 'AL_KURIMI', boxName: 'بنك الكريمي (حاسب / مميز)', bankName: 'بنك الكريمي (حاسب / مميز)', chartOfAccountsCode: '1102', chartOfAccountsName: 'أرصدة لدى البنوك - الكريمي', type: 'bank', balance: 0, isFixed: true, currency: 'YER', provider: 'الكريمي', accountNumber: '', accountName: '' },
        { id: 'JEEB', boxName: 'محفظة جيب الإلكترونية (JEEB)', bankName: 'محفظة جيب الإلكترونية (JEEB)', chartOfAccountsCode: '1103', chartOfAccountsName: 'أرصدة لدى البنوك - جيب', type: 'bank', balance: 0, isFixed: true, currency: 'YER', provider: 'جيب', accountNumber: '', accountName: '' },
        { id: 'ONE_CASH', boxName: 'محفظة ون كاش (OneCash)', bankName: 'محفظة ون كاش (OneCash)', chartOfAccountsCode: '1104', chartOfAccountsName: 'أرصدة لدى البنوك - ون كاش', type: 'bank', balance: 0, isFixed: true, currency: 'YER', provider: 'ون كاش', accountNumber: '', accountName: '' },
        { id: 'JAWALI', boxName: 'محفظة جوالي الإلكترونية', bankName: 'محفظة جوالي الإلكترونية', chartOfAccountsCode: '1105', chartOfAccountsName: 'صناديق الحوالات - جوالي', type: 'bank', balance: 0, isFixed: true, currency: 'YER', provider: 'جوالي', accountNumber: '', accountName: '' },
        { id: 'FLOOSAK', boxName: 'محفظة فلوسك (Floosak)', bankName: 'محفظة فلوسك (Floosak)', chartOfAccountsCode: '1106', chartOfAccountsName: 'صناديق الحوالات - فلوسك', type: 'bank', balance: 0, isFixed: true, currency: 'YER', provider: 'فلوسك', accountNumber: '', accountName: '' },
        { id: 'OWNER_CUSTODY', boxName: 'صندوق المالك للعهود والمسحوبات', bankName: 'صندوق المالك للعهود والمسحوبات', chartOfAccountsCode: '1108', chartOfAccountsName: 'حسابات الشركاء والمسحوبات الشخصية', type: 'owner', balance: 0, isFixed: true, currency: 'YER', accountNumber: '', accountName: '' }
      ];

      const seedBatch = writeBatch(db);
      for (const wallet of seededCanonicalWallets) {
        // customBoxes subcollection
        const customBoxDocRef = doc(db, 'stores', ownerId, 'customBoxes', wallet.id);
        seedBatch.set(customBoxDocRef, {
          ...wallet,
          ownerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // vaults root collection
        const vaultDocRef = doc(db, 'vaults', `${ownerId}-${wallet.id}`);
        seedBatch.set(vaultDocRef, {
          id: wallet.id,
          name: wallet.boxName,
          type: wallet.type,
          balance: 0,
          ownerId,
          storeId: sId,
          updatedAt: serverTimestamp()
        });

        // stores/{sId}/vaults subcollection
        const storeVaultDocRef = doc(db, 'stores', sId, 'vaults', wallet.id);
        seedBatch.set(storeVaultDocRef, {
          id: wallet.id,
          name: wallet.boxName,
          type: wallet.type,
          balance: 0,
          ownerId,
          storeId: sId,
          updatedAt: serverTimestamp()
        });
      }
      await seedBatch.commit();

      console.log('Finished clear and reset treasury process successfully.');
    } catch (err) {
      console.error('Error during clearAndResetTreasury:', err);
      throw err;
    }
  };

  return (
    <SystemSyncContext.Provider value={{ stats, loading, clearAndResetTreasury }}>
      {children}
    </SystemSyncContext.Provider>
  );
}

export function useSystemSync() {
  const context = useContext(SystemSyncContext);
  if (context === undefined) {
    throw new Error('useSystemSync must be used within a SystemSyncProvider');
  }
  return context;
}
