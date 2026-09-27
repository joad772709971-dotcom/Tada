import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { LedgerItem } from './accountingService';
import { ensureAndGetAccount } from './PurchasesManagerService';
import { AutomatedJournalEngine } from './AutomatedJournalEngine';

/**
 * INVISIBLE JOURNAL ENGINE - JAM System Pro
 * Task 1: "بناء محرك القيود التلقائية غير المرئي"
 * Automatically maps standard business events into balanced double-entry ledger entries.
 * Supports isolated test runs using the isDryRun (عزل) protocol.
 */
export class InvisibleJournalEngine {
  /**
   * Helper to resolve/create standard accounts dynamically
   */
  static async resolveAccount(ownerId: string, accountNumber: string, defaultName: string, defaultType: string) {
    return await ensureAndGetAccount(ownerId, accountNumber, defaultName, defaultType);
  }

  /**
   * 1. Electronic Balance Transactions (مبيعات ومشتريات الرصيد الإلكتروني)
   * Provider: Yemen Mobile, Sabafon, YOU, Y
   */
  static async postBalanceTransactionToLedger(params: {
    ownerId: string;
    type: 'sale' | 'purchase';
    amount: number; // e.g. 1000 units
    cost: number;   // buying cost (cash paid / payable)
    price: number;  // selling price (cash received / receivable)
    provider: string; // Yemen Mobile, Sabafon, etc.
    paymentMethod?: 'cash' | 'debt';
    storeId?: string;
    isDryRun?: boolean;
  }) {
    const { ownerId, type, amount, cost, price, provider, paymentMethod = 'cash', storeId, isDryRun = false } = params;

    if (!ownerId) throw new Error("Missing ownerId in balance ledger posting");

    const cashAcc = await this.resolveAccount(ownerId, '1101', 'حساب الصندوق والطوارئ', 'asset');
    const receivablesAcc = await this.resolveAccount(ownerId, '1200', 'ذمم العملاء المدينين', 'asset');
    const payablesAcc = await this.resolveAccount(ownerId, '2100', 'حساب الموردين - ذمم دائنة', 'liability');
    const balanceInvAcc = await this.resolveAccount(ownerId, '1202', `مخزون الرصيد الإلكتروني - ${provider}`, 'asset');
    const revenueAcc = await this.resolveAccount(ownerId, '4102', 'حساب إيرادات مبيعات الرصيد الإلكتروني', 'revenue');
    const cogsAcc = await this.resolveAccount(ownerId, '5102', 'حساب تكلفة مبيعات الرصيد الإلكتروني', 'expense');

    const entries: LedgerItem[] = [];
    let description = '';
    let reference = `BAL-${Date.now()}`;

    if (type === 'sale') {
      const activeDebitAcc = paymentMethod === 'debt' ? receivablesAcc : cashAcc;

      entries.push({
        accountId: activeDebitAcc.id,
        accountName: activeDebitAcc.accountName,
        debit: price,
        credit: 0,
        currency: 'YER'
      });
      entries.push({
        accountId: revenueAcc.id,
        accountName: revenueAcc.accountName,
        debit: 0,
        credit: price,
        currency: 'YER'
      });

      if (cost > 0) {
        entries.push({
          accountId: cogsAcc.id,
          accountName: cogsAcc.accountName,
          debit: cost,
          credit: 0,
          currency: 'YER'
        });
        entries.push({
          accountId: balanceInvAcc.id,
          accountName: balanceInvAcc.accountName,
          debit: 0,
          credit: cost,
          currency: 'YER'
        });
      }

      description = `مبيعات رصيد تلقائية لشركة (${provider}) بقيمة ${amount} وحدة للعميل`;
    } else {
      const activeCreditAcc = paymentMethod === 'debt' ? payablesAcc : cashAcc;

      entries.push({
        accountId: balanceInvAcc.id,
        accountName: balanceInvAcc.accountName,
        debit: cost,
        credit: 0,
        currency: 'YER'
      });
      entries.push({
        accountId: activeCreditAcc.id,
        accountName: activeCreditAcc.accountName,
        debit: 0,
        credit: cost,
        currency: 'YER'
      });

      description = `مشتريات توريد رصيد تلقائية لشركة (${provider}) بقيمة ${amount} وحدة`;
    }

    if (isDryRun) {
      console.log(`🧪 [ISOLATION - DRY RUN] Generated entries for balance transaction:`, entries);
      const testRef = doc(collection(db, 'test_journalEntries'));
      await setDoc(testRef, {
        ownerId,
        description: `[TEST] ${description}`,
        reference,
        items: entries,
        isDryRun: true,
        createdAt: serverTimestamp()
      });
      return { success: true, entries, testRefId: testRef.id, isDryRun: true };
    }

    await AutomatedJournalEngine.postAutomatedJournal({
      ownerId,
      storeId,
      sourceModule: 'telecom',
      description,
      reference,
      lines: entries
    });
    return { success: true, entries, reference, isDryRun: false };
  }

  /**
   * 2. SIM Card / Telecom Cards Transactions (مبيعات ومشتريات الشرائح والكروت)
   */
  static async postSIMTransactionToLedger(params: {
    ownerId: string;
    type: 'sale' | 'purchase';
    qty: number;
    serialNumber?: string;
    purchasePrice: number; // cost
    salesPrice: number;    // revenue price
    provider: string;      // Yemen Mobile, Sabafon, YOU, Y
    simType: string;       // NEW, REPLACEMENT
    paymentMethod?: 'cash' | 'debt';
    storeId?: string;
    isDryRun?: boolean;
  }) {
    const { ownerId, type, qty, serialNumber, purchasePrice, salesPrice, provider, simType, paymentMethod = 'cash', storeId, isDryRun = false } = params;

    if (!ownerId) throw new Error("Missing ownerId in SIM ledger posting");

    const cashAcc = await this.resolveAccount(ownerId, '1101', 'حساب الصندوق والطوارئ', 'asset');
    const receivablesAcc = await this.resolveAccount(ownerId, '1200', 'ذمم العملاء المدينين', 'asset');
    const payablesAcc = await this.resolveAccount(ownerId, '2100', 'حساب الموردين - ذمم دائنة', 'liability');
    const simInvAcc = await this.resolveAccount(ownerId, '1203', `مخزون شرائح الاتصال والكروت - ${provider}`, 'asset');
    const revenueAcc = await this.resolveAccount(ownerId, '4103', 'حساب إيرادات مبيعات الشرائح والكروت', 'revenue');
    const cogsAcc = await this.resolveAccount(ownerId, '5103', 'حساب تكلفة مبيعات الشرائح والكروت', 'expense');

    const entries: LedgerItem[] = [];
    let description = '';
    let reference = `SIM-${Date.now()}`;

    const totalCost = purchasePrice * qty;
    const totalRevenue = salesPrice * qty;

    if (type === 'sale') {
      const activeDebitAcc = paymentMethod === 'debt' ? receivablesAcc : cashAcc;

      entries.push({
        accountId: activeDebitAcc.id,
        accountName: activeDebitAcc.accountName,
        debit: totalRevenue,
        credit: 0,
        currency: 'YER'
      });
      entries.push({
        accountId: revenueAcc.id,
        accountName: revenueAcc.accountName,
        debit: 0,
        credit: totalRevenue,
        currency: 'YER'
      });

      if (totalCost > 0) {
        entries.push({
          accountId: cogsAcc.id,
          accountName: cogsAcc.accountName,
          debit: totalCost,
          credit: 0,
          currency: 'YER'
        });
        entries.push({
          accountId: simInvAcc.id,
          accountName: simInvAcc.accountName,
          debit: 0,
          credit: totalCost,
          currency: 'YER'
        });
      }

      description = `مبيعات تلقائية شريحة (${simType}) لشركة (${provider}) السيريال: ${serialNumber || 'تلقائي'}`;
    } else {
      const activeCreditAcc = paymentMethod === 'debt' ? payablesAcc : cashAcc;

      entries.push({
        accountId: simInvAcc.id,
        accountName: simInvAcc.accountName,
        debit: totalCost,
        credit: 0,
        currency: 'YER'
      });
      entries.push({
        accountId: activeCreditAcc.id,
        accountName: activeCreditAcc.accountName,
        debit: 0,
        credit: totalCost,
        currency: 'YER'
      });

      description = `مشتريات توريد دفعة شرائح (${qty} شريحة) لشركة (${provider}) نوع ${simType}`;
    }

    if (isDryRun) {
      console.log(`🧪 [ISOLATION - DRY RUN] Generated entries for SIM transaction:`, entries);
      const testRef = doc(collection(db, 'test_journalEntries'));
      await setDoc(testRef, {
        ownerId,
        description: `[TEST] ${description}`,
        reference,
        items: entries,
        isDryRun: true,
        createdAt: serverTimestamp()
      });
      return { success: true, entries, testRefId: testRef.id, isDryRun: true };
    }

    await AutomatedJournalEngine.postAutomatedJournal({
      ownerId,
      storeId,
      sourceModule: 'telecom',
      description,
      reference,
      lines: entries
    });
    return { success: true, entries, reference, isDryRun: false };
  }
}
