import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { FirebaseProjectRouter, ProjectTier } from './FirebaseProjectRouter';

export interface CrossProjectSettlementEntry {
  id?: string;
  settlementNumber: string;
  debtorUid: string;
  debtorName: string;
  debtorTier: ProjectTier;
  creditorUid: string;
  creditorName: string;
  creditorTier: ProjectTier;
  amount: number;
  currency: string;
  status: 'pending' | 'verified' | 'reconciled' | 'rejected';
  referenceOrderId?: string;
  notes?: string;
  createdAt?: any;
}

export class CrossProjectLedgerEngine {
  /**
   * Records a cross-project financial settlement transaction (e.g. B2B order payment or debt repayment)
   */
  public async recordFinancialSettlement(
    entry: Omit<CrossProjectSettlementEntry, 'id' | 'settlementNumber' | 'status' | 'createdAt'>
  ): Promise<string> {
    const settlementNumber = `SET-${Date.now().toString().slice(-6)}`;
    const payload = {
      ...entry,
      settlementNumber,
      status: 'pending' as const,
      createdAt: serverTimestamp()
    };

    // 1. Save entry in Creditor's Firebase Project
    const creditorDb = FirebaseProjectRouter.getFirestoreForTier(entry.creditorTier);
    const creditorDocRef = await addDoc(collection(creditorDb, 'financial_settlements'), payload);

    // 2. Save mirror entry in Debtor's Firebase Project
    const debtorDb = FirebaseProjectRouter.getFirestoreForTier(entry.debtorTier);
    await addDoc(collection(debtorDb, 'financial_settlements'), {
      ...payload,
      creditorRefId: creditorDocRef.id
    });

    return creditorDocRef.id;
  }

  /**
   * Fetches account ledger balance statement between a debtor and creditor across project tiers
   */
  public async fetchInterProjectLedgerStatement(
    partyAUid: string,
    partyBTier: ProjectTier
  ): Promise<{ totalBalanceYer: number; totalTransactionsCount: number }> {
    try {
      const db = FirebaseProjectRouter.getFirestoreForTier(partyBTier);
      const q = query(
        collection(db, 'financial_settlements'),
        where('debtorUid', '==', partyAUid)
      );

      const snap = await getDocs(q);
      let totalYer = 0;
      snap.forEach(d => {
        const data = d.data();
        totalYer += Number(data.amount || 0);
      });

      return {
        totalBalanceYer: totalYer,
        totalTransactionsCount: snap.size
      };
    } catch (err) {
      console.error('[CrossProjectLedgerEngine] Statement fetch error:', err);
      return { totalBalanceYer: 0, totalTransactionsCount: 0 };
    }
  }
}

export const CrossProjectLedgerService = new CrossProjectLedgerEngine();
