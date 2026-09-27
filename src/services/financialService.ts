import { collection, addDoc, doc, updateDoc, getDoc, increment, runTransaction, serverTimestamp, getDocs, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Financial Service - The Single Source of Truth for JAM Pro
 * Handles all monetary transactions with atomic precision.
 */

export enum TransactionType {
  SALE = 'sale',
  PURCHASE = 'purchase',
  EXPENSE = 'expense',
  RETURN = 'return',
  DEBT_PAYMENT = 'debt_payment',
  MAINTENANCE = 'maintenance'
}

export interface FinancialAction {
  type: TransactionType;
  amount: number; // The sale/purchase total
  cost: number;   // The actual cost to the business
  profit: number; // Calculated profit
  paymentType: 'cash' | 'debt' | 'wallet';
  targetId?: string; // Product ID, Customer ID, etc.
  targetName?: string;
  metadata?: any;
}

// Helper to handle currency with precision (integer cents/paisa logic but simplified for YR)
const toFixed = (val: number) => Math.round(val * 100) / 100;

export const FinancialService = {
  /**
   * Records a sales transaction and updates inventory/debt atomically.
   */
  async recordSale(profile: any, data: FinancialAction) {
    if (!profile?.ownerId) throw new Error('Unauthorized');

    await runTransaction(db, async (transaction) => {
      // 1. Record the Transaction
      const txnRef = doc(collection(db, 'financial_transactions'));
      transaction.set(txnRef, {
        ...data,
        ownerId: profile.ownerId,
        createdBy: profile.uid,
        createdAt: serverTimestamp(),
      });

      // 2. Update Inventory if applicable
      if (data.targetId && data.type === TransactionType.SALE) {
        const itemRef = doc(db, 'inventory', data.targetId);
        transaction.update(itemRef, {
          stock: increment(-(data.metadata?.qty || 1)),
          updatedAt: serverTimestamp()
        });
      }

      // 3. Update Customer Debt if payment is 'debt'
      if (data.paymentType === 'debt' && data.metadata?.customerId) {
        const customerRef = doc(db, 'customers', data.metadata.customerId);
        transaction.update(customerRef, {
          debt: increment(data.amount),
          updatedAt: serverTimestamp()
        });
      }

      // 4. Log Activity
      const logRef = doc(collection(db, 'activity_logs'));
      transaction.set(logRef, {
        userId: profile.uid,
        userName: profile.name,
        action: 'financial_transaction',
        details: `عملية ${data.type}: ${data.amount} ر.ي`,
        type: 'finance',
        createdAt: serverTimestamp()
      });
    });
  },

  /**
   * Specifically for Maintenance with 50/50 split logic
   */
  async recordMaintenance(profile: any, maintenanceData: {
    customerId: string;
    customerName: string;
    serviceFee: number;
    partsCost: number;
    engineerId: string;
    engineerName: string;
    deviceInfo: string;
  }) {
    const totalReceived = maintenanceData.serviceFee + maintenanceData.partsCost;
    const profitFromService = maintenanceData.serviceFee; // Only service fee is profit for splitting
    const engineerShare = toFixed(profitFromService * 0.5);
    const shopShare = toFixed(profitFromService * 0.5);

    await runTransaction(db, async (transaction) => {
      const txnRef = doc(collection(db, 'maintenance_records'));
      transaction.set(txnRef, {
        ...maintenanceData,
        engineerShare,
        shopShare,
        totalProfit: profitFromService,
        ownerId: profile.ownerId,
        createdAt: serverTimestamp(),
        status: 'completed'
      });

      // Update Engineer Balance (as debt/credit)
      const engRef = doc(db, 'employees', maintenanceData.engineerId);
      transaction.update(engRef, {
        balance: increment(engineerShare), // Engineer gets 50%
        updatedAt: serverTimestamp()
      });
    });
  },

  /**
   * Helper to execute updates in safe batches of 450
   */
  async executeInBatches(docs: any[], updateFn: (doc: any) => any) {
    let fixedCount = 0;
    const CHUNK_SIZE = 450;
    
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      let batchHasUpdates = false;

      for (const d of chunk) {
        const update = updateFn(d);
        if (update) {
          batch.update(d.ref, update);
          fixedCount++;
          batchHasUpdates = true;
        }
      }
      
      if (batchHasUpdates) {
        await batch.commit();
      }
    }
    return fixedCount;
  },

  /**
   * Utility to fix historical data
   * Recalculates all maintenance profits based on the 50/50 rule (or custom percentage)
   */
  async repairHistoricalData(ownerId: string) {
    if (!ownerId) throw new Error('Owner ID is required');
    
    const ordersSnap = await getDocs(query(
      collection(db, 'maintenanceOrders'), 
      where('ownerId', '==', ownerId)
    ));

    return this.executeInBatches(ordersSnap.docs, (orderDoc) => {
      const order = orderDoc.data();
      const partsPrice = (order.sparePartsUsed || []).reduce((acc: number, p: any) => acc + (p.price || 0), 0);
      const partsCost = (order.sparePartsUsed || []).reduce((acc: number, p: any) => acc + (p.cost || 0), 0);
      const serviceFee = Math.max(0, order.cost - partsPrice);
      
      const percentage = (order as any).engineerPercentage || 50;
      const engineerShare = toFixed(serviceFee * (percentage / 100));
      const shopShare = toFixed((partsPrice - partsCost) + (serviceFee * ((100 - percentage) / 100)));
      
      return {
        calculatedEngineerShare: engineerShare,
        calculatedShopShare: shopShare,
        engineerPercentage: percentage,
        repairStatus: 'recalculated_v3'
      };
    });
  },

  /**
   * Specifically for Mobile Balance profit correction
   */
  async repairBalanceHistoricalData(ownerId: string) {
    if (!ownerId) throw new Error('Owner ID is required');
    
    const snap = await getDocs(query(
      collection(db, 'balanceTransactions'), 
      where('ownerId', '==', ownerId)
    ));

    const providerPurchases: { [key: string]: any[] } = {};
    const allTxns = snap.docs.map(d => ({ ref: d.ref, ...d.data() } as any));
    allTxns.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

    const docsToUpdate: { ref: any, data: any }[] = [];

    for (const txn of allTxns) {
      if (txn.type === 'purchase') {
        if (!providerPurchases[txn.provider]) providerPurchases[txn.provider] = [];
        providerPurchases[txn.provider].push(txn);
      } else if (txn.type === 'sale') {
        const history = providerPurchases[txn.provider] || [];
        const lastPurchase = [...history].reverse().find(p => (p.createdAt?.seconds || 0) <= (txn.createdAt?.seconds || 0));
        
        const unitCost = (lastPurchase && lastPurchase.amount > 0) 
          ? (Number(lastPurchase.cost) / Number(lastPurchase.amount)) 
          : (txn.provider === 'yemen_mobile' ? 0.9 : 0.85);
        
        const deducted = Number(txn.deductedFromProgram || txn.amount || 0);
        const received = Number(txn.amountReceived || txn.price || 0);
        const correctProfit = toFixed(received - (deducted * unitCost));

        if (Math.abs(txn.profit - correctProfit) > 0.1) {
          docsToUpdate.push({ ref: txn.ref, data: { profit: correctProfit, repairNote: 'fixed_v3' } });
        }
      }
    }

    return this.executeInBatches(docsToUpdate, (item) => item.data);
  },

  /**
   * Recalculates profit for all historical sales and returns
   */
  async repairSalesData(ownerId: string) {
    if (!ownerId) throw new Error('Owner ID is required');
    
    let totalFixed = 0;
    const collections = ['sales', 'returns'];
    
    for (const col of collections) {
      const snap = await getDocs(query(collection(db, col), where('ownerId', '==', ownerId)));
      totalFixed += await this.executeInBatches(snap.docs, (d) => {
        const data = d.data();
        const totalCost = (data.items || []).reduce((acc: number, i: any) => acc + ((i.cost || 0) * (i.quantity || 1)), 0);
        const calcProfit = data.type === 'return' ? (totalCost - (data.total || 0)) : ((data.total || 0) - totalCost);
        
        if (data.profit === undefined || Math.abs(data.profit - calcProfit) > 0.1) {
          return { profit: calcProfit, repairNote: 'profit_audit_v3' };
        }
        return null;
      });
    }
    return totalFixed;
  },

  /**
   * Repairs inventory discrepancies (zero prices, etc.)
   */
  async repairInventoryData(ownerId: string, margin: number = 20) {
    if (!ownerId) throw new Error('Owner ID is required');
    
    const snap = await getDocs(query(collection(db, 'inventory'), where('ownerId', '==', ownerId)));
    return this.executeInBatches(snap.docs, (d) => {
      const item = d.data();
      let update: any = {};
      const price = Number(item.price) || 0;
      const cost = Number(item.cost) || 0;

      if (cost > 0 && price <= cost) {
        update.price = Math.round(cost * (1 + margin / 100));
        update.auditNote = `auto_price_v3_${margin}%`;
      } else if (price > 0 && cost <= 0) {
        update.cost = Math.round(price / (1 + margin / 100));
        update.auditNote = `auto_cost_v3_${margin}%`;
      }

      return Object.keys(update).length > 0 ? { ...update, updatedAt: serverTimestamp() } : null;
    });
  },

  /**
   * Emergency wipe for a specific shop's financial data
   */
  async wipeAllData(ownerId: string) {
    if (!ownerId) return;
    const batch = writeBatch(db);
    const collectionsToWipe = ['financial_transactions', 'transactions', 'sales', 'maintenanceOrders', 'engineerTransactions', 'balanceTransactions'];
    
    for (const col of collectionsToWipe) {
      const snap = await getDocs(query(collection(db, col), where('ownerId', '==', ownerId)));
      snap.docs.forEach(d => batch.delete(d.ref));
    }
    
    await batch.commit();
  }
};

export const financialService = FinancialService;
