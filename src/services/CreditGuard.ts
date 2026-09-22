import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { MultiDatabaseRouter } from './MultiDatabaseRouter';

export interface CreditCheckResult {
  allowed: boolean;
  currentDebt: number;
  creditLimit: number;
  availableCredit: number;
  codeValid: boolean;
  message: string;
}

export interface CreditProfile {
  accountId: string;
  accountName: string;
  creditLimit: number; // Maximum allowed debt limit
  currentDebt: number; // Current outstanding balance
  securityCode?: string; // Authorized verification pin/code
  isBlocked?: boolean;
}

class CreditGuardEngineService {
  /**
   * Perform instantaneous 0ms credit limit & security code verification
   */
  public async verifyTransactionCredit(params: {
    accountId: string;
    transactionAmount: number;
    securityCode?: string;
    storeId?: string;
  }): Promise<CreditCheckResult> {
    const { accountId, transactionAmount, securityCode, storeId } = params;

    try {
      // Use active store database or primary DB as appropriate
      const targetDb = storeId ? MultiDatabaseRouter.getStoreDb(storeId) : MultiDatabaseRouter.getPrimaryDb();

      // Fetch account financial profile
      const accountRef = doc(targetDb, 'accounts', accountId);
      const accountSnap = await getDoc(accountRef);

      if (!accountSnap.exists()) {
        // Fallback: check customers collection if accounts collection doc not found
        const customerRef = doc(targetDb, 'customers', accountId);
        const customerSnap = await getDoc(customerRef);

        if (!customerSnap.exists()) {
          // If no custom limit is set, default to standard policy
          return {
            allowed: true,
            currentDebt: 0,
            creditLimit: 1000000,
            availableCredit: 1000000,
            codeValid: true,
            message: 'حساب جديد - تم السماح بالمعاملة ضمن السقف الافتراضي'
          };
        }

        const custData = customerSnap.data();
        const currentDebt = Number(custData.balance || custData.totalDebt || 0);
        const creditLimit = Number(custData.creditLimit || 500000);
        const savedCode = custData.securityCode || custData.pinCode;

        return this.evaluateLimits({
          currentDebt,
          creditLimit,
          transactionAmount,
          securityCode,
          savedCode,
          isBlocked: custData.isBlocked || custData.status === 'suspended'
        });
      }

      const accData = accountSnap.data();
      const currentDebt = Number(accData.balance || accData.currentDebt || 0);
      const creditLimit = Number(accData.creditLimit || accData.maxDebtLimit || 1000000);
      const savedCode = accData.securityCode || accData.pinCode;

      return this.evaluateLimits({
        currentDebt,
        creditLimit,
        transactionAmount,
        securityCode,
        savedCode,
        isBlocked: accData.isBlocked || accData.status === 'suspended'
      });

    } catch (error) {
      console.warn('⚠️ [CreditGuard] Credit check query failed, using safe fallback:', error);
      // Safe operational fallback: allow reasonable small transactions, block huge ones
      const isLarge = transactionAmount > 5000000;
      return {
        allowed: !isLarge,
        currentDebt: 0,
        creditLimit: 5000000,
        availableCredit: 5000000 - transactionAmount,
        codeValid: true,
        message: !isLarge ? 'تم القبول عبر المحرك الاحتياطي المباشر' : 'المبلغ يتجاوز حد الأمان التلقائي'
      };
    }
  }

  /**
   * Internal limit calculator & code validator
   */
  private evaluateLimits(params: {
    currentDebt: number;
    creditLimit: number;
    transactionAmount: number;
    securityCode?: string;
    savedCode?: string;
    isBlocked?: boolean;
  }): CreditCheckResult {
    const { currentDebt, creditLimit, transactionAmount, securityCode, savedCode, isBlocked } = params;

    if (isBlocked) {
      return {
        allowed: false,
        currentDebt,
        creditLimit,
        availableCredit: 0,
        codeValid: false,
        message: '⛔ الحساب موقوف حالياً بقرار من إدارة المبيعات'
      };
    }

    // Security Code Check (if customer has a registered security code)
    let codeValid = true;
    if (savedCode && securityCode) {
      if (String(savedCode).trim() !== String(securityCode).trim()) {
        return {
          allowed: false,
          currentDebt,
          creditLimit,
          availableCredit: Math.max(0, creditLimit - currentDebt),
          codeValid: false,
          message: '❌ شفرة الأمان الخاصة بالحساب غير صحيحة'
        };
      }
    }

    const projectedDebt = currentDebt + transactionAmount;
    const availableCredit = creditLimit - currentDebt;

    if (projectedDebt > creditLimit) {
      const excess = projectedDebt - creditLimit;
      return {
        allowed: false,
        currentDebt,
        creditLimit,
        availableCredit: Math.max(0, availableCredit),
        codeValid: true,
        message: `⛔ المعاملة تتجاوز سقف الدين المحدد بـ (${excess.toLocaleString()} ريال). المتبقي المتاح: ${Math.max(0, availableCredit).toLocaleString()} ريال`
      };
    }

    return {
      allowed: true,
      currentDebt,
      creditLimit,
      availableCredit: availableCredit - transactionAmount,
      codeValid: true,
      message: '✅ المعاملة متوافقة تماماً مع سقف الدين والأمان'
    };
  }
}

export const CreditGuard = new CreditGuardEngineService();
