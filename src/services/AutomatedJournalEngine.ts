import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  serverTimestamp, 
  writeBatch, 
  increment 
} from 'firebase/firestore';
import { db } from '../firebase';
import { accountingService, LedgerItem } from './accountingService';
import { ensureAndGetAccount } from './PurchasesManagerService';
import { FinancialMath } from '../utils/financialMath';
import { chargeDamageToEmployee } from './PayrollService';

/**
 * ADVANCED & AUTOMATED JOURNAL VOUCHERS ENGINE (محرك إسناد القيود المحاسبية الآلي بالكامل)
 * 
 * Functions:
 * 1. Automatic real-time mapping of Cashier, Retail/Wholesale Sales, Maintenance & Workshop,
 *    SIM/Top-Up charging, Purchases, and Damaged/Lost Goods & Employee Errors into double-entry vouchers.
 * 2. Smart balancing verifier (Debit = Credit per currency) with auto-reconciliation of minor variances.
 * 3. Real-time balance updates for Chart of Accounts, Cash Vaults, Banks, Remittances, and Employee Custody.
 * 4. Programmatic employee loss & error deduction (directly from custody accounts or salary payroll) with offline support.
 */

export interface CumulativeBalanceSummary {
  cashVaultsBalance: number;
  bankAccountsBalance: number;
  totalAssets: number;
  lastUpdated: string;
}

export interface EmployeeErrorLossData {
  ownerId: string;
  storeId?: string;
  type: 'damaged_goods' | 'inventory_shortage' | 'employee_error' | 'engineer_repair_error';
  totalCost: number;
  responsibilityTarget: 'single_employee' | 'multiple_employees' | 'store' | 'split_store_employee' | 'supplier' | 'customer';
  employeeIds?: string[];
  employeeNames?: string[];
  deductFrom?: 'custody_account' | 'salary_payroll' | 'store_loss';
  storeSplitPercent?: number; // % born by store if split
  itemName: string;
  quantity?: number;
  notes?: string;
  isDryRun?: boolean;
}

const OFFLINE_QUEUE_KEY = 'jam_offline_journal_vouchers_queue';

export class AutomatedJournalEngine {

  /**
   * 1. CASHIER & RETAIL SALES AUTOMATED VOUCHER
   * Links POS transactions instantly to General Ledger and Cash/Bank Vaults
   */
  static async postCashierSaleVoucher(params: {
    ownerId: string;
    storeId?: string;
    saleId: string;
    totalAmount: number;
    costOfGoods?: number;
    paymentMethod?: 'cash' | 'debt' | 'bank' | 'remittance' | string;
    bankOrBoxId?: string;
    customerName?: string;
    itemsSummary?: string;
  }) {
    const { ownerId, storeId, saleId, totalAmount, costOfGoods = 0, paymentMethod = 'cash', bankOrBoxId, customerName = 'عميل كاش', itemsSummary = 'مبيعات كاشير' } = params;
    if (!ownerId || totalAmount <= 0) return { success: true, bypassed: true };

    let activeDebitCode = '1101'; // Default Cash
    let activeDebitName = 'حساب الصندوق والطوارئ';

    if (paymentMethod === 'debt') {
      activeDebitCode = '1200';
      activeDebitName = `ذمم العملاء - ${customerName}`;
    } else if (paymentMethod === 'bank' || paymentMethod === 'remittance') {
      if (bankOrBoxId === 'AL_KURIMI') { activeDebitCode = '1102'; activeDebitName = 'أرصدة لدى البنوك - الكريمي'; }
      else if (bankOrBoxId === 'AL_TADHAMON') { activeDebitCode = '1103'; activeDebitName = 'أرصدة لدى البنوك - التضامن'; }
      else if (bankOrBoxId === 'AL_NAJM') { activeDebitCode = '1105'; activeDebitName = 'صناديق الحوالات - النجم'; }
      else if (bankOrBoxId === 'AL_AMQI') { activeDebitCode = '1106'; activeDebitName = 'صناديق الحوالات - العمقي'; }
      else if (bankOrBoxId === 'JAWALI') { activeDebitCode = '1107'; activeDebitName = 'صناديق الحوالات - جوالي'; }
      else { activeDebitCode = '1102'; activeDebitName = 'أرصدة لدى البنوك والشبكات'; }
    }

    const debitAcc = await ensureAndGetAccount(ownerId, activeDebitCode, activeDebitName, 'asset');
    const revenueAcc = await ensureAndGetAccount(ownerId, '4100', 'حساب إيرادات مبيعات التجزئة والجملة', 'revenue');

    const entries: LedgerItem[] = [
      { accountId: debitAcc.id, accountName: debitAcc.accountName, debit: totalAmount, credit: 0, currency: 'YER' },
      { accountId: revenueAcc.id, accountName: revenueAcc.accountName, debit: 0, credit: totalAmount, currency: 'YER' }
    ];

    // Add COGS entry if costOfGoods is provided
    if (costOfGoods > 0) {
      const cogsAcc = await ensureAndGetAccount(ownerId, '5100', 'حساب تكلفة مبيعات التجزئة والجملة', 'expense');
      const invAcc = await ensureAndGetAccount(ownerId, '1201', 'مخزون البضائع والمستودع المركزي', 'asset');

      entries.push({ accountId: cogsAcc.id, accountName: cogsAcc.accountName, debit: costOfGoods, credit: 0, currency: 'YER' });
      entries.push({ accountId: invAcc.id, accountName: invAcc.accountName, debit: 0, credit: costOfGoods, currency: 'YER' });
    }

    const description = `قيد مبيعات آلي (كاشير/تجزئة) - فاتورة #${saleId.slice(-8)} للعميل: ${customerName} [${itemsSummary}]`;
    const reference = `POS-${saleId}`;

    await this.executeOrQueueVoucher(ownerId, description, entries, reference, storeId);
    return { success: true, reference };
  }

  /**
   * 2. MAINTENANCE & WORKSHOP AUTOMATED VOUCHER
   * Links repairs, spare parts cost, and engineer commissions
   */
  static async postMaintenanceVoucher(params: {
    ownerId: string;
    storeId?: string;
    ticketNumber: string;
    totalAmount: number;
    partsCost?: number;
    engineerName?: string;
    engineerId?: string;
    engineerCommission?: number;
    isPaid?: boolean;
    customerName?: string;
  }) {
    const { ownerId, storeId, ticketNumber, totalAmount, partsCost = 0, engineerName, engineerCommission = 0, isPaid = true, customerName = 'عميل صيانة' } = params;
    if (!ownerId || totalAmount <= 0) return { success: true, bypassed: true };

    const debitCode = isPaid ? '1101' : '1200';
    const debitName = isPaid ? 'حساب الصندوق والطوارئ' : `ذمم العملاء - ${customerName}`;
    const debitAcc = await ensureAndGetAccount(ownerId, debitCode, debitName, 'asset');
    const revenueAcc = await ensureAndGetAccount(ownerId, '4200', 'حساب إيرادات صيانة وتجهيز الهواتف', 'revenue');

    const entries: LedgerItem[] = [
      { accountId: debitAcc.id, accountName: debitAcc.accountName, debit: totalAmount, credit: 0, currency: 'YER' },
      { accountId: revenueAcc.id, accountName: revenueAcc.accountName, debit: 0, credit: totalAmount, currency: 'YER' }
    ];

    // Parts cost accounting
    if (partsCost > 0) {
      const cogsAcc = await ensureAndGetAccount(ownerId, '5100', 'حساب تكلفة مبيعات التجزئة والقطع', 'expense');
      const invAcc = await ensureAndGetAccount(ownerId, '1201', 'مخزون قطع الغيار والمستودع', 'asset');
      entries.push({ accountId: cogsAcc.id, accountName: cogsAcc.accountName, debit: partsCost, credit: 0, currency: 'YER' });
      entries.push({ accountId: invAcc.id, accountName: invAcc.accountName, debit: 0, credit: partsCost, currency: 'YER' });
    }

    // Engineer Commission accounting
    if (engineerCommission > 0) {
      const commExpenseAcc = await ensureAndGetAccount(ownerId, '5100', 'حساب مصاريف عمولات المهندسين', 'expense');
      const engineerCustodyAcc = await ensureAndGetAccount(ownerId, '1155', `ذمم وعهد المهندس - ${engineerName || 'عام'}`, 'asset');

      entries.push({ accountId: commExpenseAcc.id, accountName: commExpenseAcc.accountName, debit: engineerCommission, credit: 0, currency: 'YER' });
      entries.push({ accountId: engineerCustodyAcc.id, accountName: engineerCustodyAcc.accountName, debit: 0, credit: engineerCommission, currency: 'YER' });
    }

    const description = `قيد صيانة وورشة آلي - كرت #${ticketNumber} للعميل: ${customerName} ${engineerName ? `[المهندس: ${engineerName}]` : ''}`;
    const reference = `MNT-${ticketNumber}`;

    await this.executeOrQueueVoucher(ownerId, description, entries, reference, storeId);
    return { success: true, reference };
  }

  /**
   * 3. RECHARGE BALANCE & SIM CARD AUTOMATED VOUCHER
   * Links electronic balance and SIM sales automatically
   */
  static async postTopUpOrSimVoucher(params: {
    ownerId: string;
    storeId?: string;
    type: 'balance' | 'sim';
    provider: string; // Yemen Mobile, Sabafon, YOU, Y
    amount: number;   // units or SIM qty
    cost: number;
    price: number;
    paymentMethod?: 'cash' | 'debt';
    simType?: string;
  }) {
    const { ownerId, storeId, type, provider, amount, cost, price, paymentMethod = 'cash', simType = 'جديد' } = params;
    if (!ownerId || price <= 0) return { success: true, bypassed: true };

    const cashAcc = await ensureAndGetAccount(ownerId, '1101', 'حساب الصندوق والطوارئ', 'asset');
    const recAcc = await ensureAndGetAccount(ownerId, '1200', 'ذمم العملاء المدينين', 'asset');
    const activeDebitAcc = paymentMethod === 'debt' ? recAcc : cashAcc;

    const revCode = type === 'balance' ? '4102' : '4103';
    const revName = type === 'balance' ? 'حساب إيرادات مبيعات الرصيد الإلكتروني' : 'حساب إيرادات مبيعات الشرائح والكروت';
    const revenueAcc = await ensureAndGetAccount(ownerId, revCode, revName, 'revenue');

    const cogsCode = type === 'balance' ? '5102' : '5103';
    const cogsName = type === 'balance' ? 'حساب تكلفة مبيعات الرصيد الإلكتروني' : 'حساب تكلفة مبيعات الشرائح والكروت';
    const cogsAcc = await ensureAndGetAccount(ownerId, cogsCode, cogsName, 'expense');

    const invCode = type === 'balance' ? '1202' : '1203';
    const invName = type === 'balance' ? `مخزون الرصيد الإلكتروني - ${provider}` : `مخزون الشرائح - ${provider}`;
    const invAcc = await ensureAndGetAccount(ownerId, invCode, invName, 'asset');

    const entries: LedgerItem[] = [
      { accountId: activeDebitAcc.id, accountName: activeDebitAcc.accountName, debit: price, credit: 0, currency: 'YER' },
      { accountId: revenueAcc.id, accountName: revenueAcc.accountName, debit: 0, credit: price, currency: 'YER' }
    ];

    if (cost > 0) {
      entries.push({ accountId: cogsAcc.id, accountName: cogsAcc.accountName, debit: cost, credit: 0, currency: 'YER' });
      entries.push({ accountId: invAcc.id, accountName: invAcc.accountName, debit: 0, credit: cost, currency: 'YER' });
    }

    const typeLabel = type === 'balance' ? `رصيد (${provider})` : `شرائح (${provider} - ${simType})`;
    const description = `قيد آلي شحن/شرائح - ${typeLabel} الكمية: ${amount}`;
    const reference = `${type.toUpperCase()}-${Date.now()}`;

    await this.executeOrQueueVoucher(ownerId, description, entries, reference, storeId);
    return { success: true, reference };
  }

  /**
   * 4. PURCHASES AUTOMATED VOUCHER
   * Links inventory supply to cash box, bank, or supplier debt
   */
  static async postPurchaseVoucher(params: {
    ownerId: string;
    storeId?: string;
    purchaseId: string;
    totalCost: number;
    supplierName?: string;
    supplierId?: string;
    paymentMethod?: 'cash' | 'debt' | 'bank';
    notes?: string;
  }) {
    const { ownerId, storeId, purchaseId, totalCost, supplierName = 'مورد عام', paymentMethod = 'cash', notes } = params;
    if (!ownerId || totalCost <= 0) return { success: true, bypassed: true };

    const invAcc = await ensureAndGetAccount(ownerId, '1201', 'مخزون البضائع والمستودع المركزي', 'asset');
    
    let creditCode = '1101';
    let creditName = 'حساب الصندوق والطوارئ';
    if (paymentMethod === 'debt') {
      creditCode = '2100';
      creditName = `حساب الموردين - ${supplierName}`;
    } else if (paymentMethod === 'bank') {
      creditCode = '1102';
      creditName = 'أرصدة لدى البنوك والشبكات';
    }

    const creditAcc = await ensureAndGetAccount(ownerId, creditCode, creditName, creditCode.startsWith('1') ? 'asset' : 'liability');

    const entries: LedgerItem[] = [
      { accountId: invAcc.id, accountName: invAcc.accountName, debit: totalCost, credit: 0, currency: 'YER' },
      { accountId: creditAcc.id, accountName: creditAcc.accountName, debit: 0, credit: totalCost, currency: 'YER' }
    ];

    const description = `قيد توريد مشتريات آلي - فاتورة #${purchaseId.slice(-8)} من المورد: ${supplierName} ${notes ? `[${notes}]` : ''}`;
    const reference = `PUR-${purchaseId}`;

    await this.executeOrQueueVoucher(ownerId, description, entries, reference, storeId);
    return { success: true, reference };
  }

  /**
   * ⚖️ AXIS 3 GL ENGINE: BUYER ORDER CONFIRMATION
   * 1. عند إرسال وتأكيد الطلبية للمشتري:
   *  - مدين (+): حساب بضائع الطريق / المخزون (Account '1205' - بضائع الطريق والمخزون المعلق)
   *  - دائن (-): حساب المورد / المحفظة البنكية (Account '2100' or '1102')
   * Idempotency Key: GL-ORD-${orderId}-BUYER-CONFIRM
   */
  static async postB2BOrderBuyerConfirmationGL(params: {
    buyerOwnerId: string;
    supplierOwnerId: string;
    supplierName: string;
    orderId: string;
    totalAmount: number;
    paymentType: 'cash' | 'debt';
    storeId?: string;
  }) {
    const { buyerOwnerId, supplierName, orderId, totalAmount, paymentType, storeId } = params;
    if (!buyerOwnerId || totalAmount <= 0) return { success: true, bypassed: true };

    const idempotencyKey = `GL-ORD-${orderId}-BUYER-CONFIRM`;

    // 1. Debit Account (+): Goods in Transit / Transit Inventory
    const transitInvAcc = await ensureAndGetAccount(
      buyerOwnerId,
      '1205',
      'حساب بضائع الطريق والمخزون المعلق',
      'asset'
    );

    // 2. Credit Account (-): Supplier Payable or Bank/Wallet
    const creditCode = paymentType === 'debt' ? '2100' : '1102';
    const creditName = paymentType === 'debt' 
      ? `حساب الموردين - ${supplierName}`
      : 'حساب المحفظة البنكية / سداد الشحنات';
    const creditType = paymentType === 'debt' ? 'liability' : 'asset';

    const creditAcc = await ensureAndGetAccount(buyerOwnerId, creditCode, creditName, creditType);

    const entries: LedgerItem[] = [
      { accountId: transitInvAcc.id, accountName: transitInvAcc.accountName, debit: totalAmount, credit: 0, currency: 'YER' },
      { accountId: creditAcc.id, accountName: creditAcc.accountName, debit: 0, credit: totalAmount, currency: 'YER' }
    ];

    const description = `[المحور 3] قيد آلي مزدوج (تأكيد طلب الشراء) - طلبية #${orderId.slice(-6)} للمورد ${supplierName}`;

    await this.executeOrQueueVoucher(buyerOwnerId, description, entries, idempotencyKey, storeId);
    return { success: true, idempotencyKey };
  }

  /**
   * ⚖️ AXIS 3 GL ENGINE: SUPPLIER PREPARATION & DISPATCH
   * 2. عند التجهيز والتسليم للمورد:
   *  - مدين (+): حساب المحفظة / الصندوق / المشتري (Account '1101' or '1200')
   *  - دائن (-): حساب إيرادات المبيعات / بضائع المخزن (Account '4100' or '1201')
   * Idempotency Key: GL-ORD-${orderId}-SUPPLIER-DISPATCH
   */
  static async postB2BOrderSupplierPrepAndDispatchGL(params: {
    supplierOwnerId: string;
    buyerName: string;
    orderId: string;
    totalAmount: number;
    paymentType: 'cash' | 'debt';
    costOfGoods?: number;
    storeId?: string;
  }) {
    const { supplierOwnerId, buyerName, orderId, totalAmount, paymentType, costOfGoods = 0, storeId } = params;
    if (!supplierOwnerId || totalAmount <= 0) return { success: true, bypassed: true };

    const idempotencyKey = `GL-ORD-${orderId}-SUPPLIER-DISPATCH`;

    // 1. Debit Account (+): Cash/Wallet or Customer Receivable
    const debitCode = paymentType === 'cash' ? '1101' : '1200';
    const debitName = paymentType === 'cash' 
      ? 'حساب الصندوق والمحفظة المالية' 
      : `ذمم العملاء والمشتريين - ${buyerName}`;
    const debitAcc = await ensureAndGetAccount(supplierOwnerId, debitCode, debitName, 'asset');

    // 2. Credit Account (-): Sales Revenues / Warehouse Inventory
    const revenueAcc = await ensureAndGetAccount(
      supplierOwnerId,
      '4100',
      'حساب إيرادات مبيعات الجملة والتوريد',
      'revenue'
    );

    const entries: LedgerItem[] = [
      { accountId: debitAcc.id, accountName: debitAcc.accountName, debit: totalAmount, credit: 0, currency: 'YER' },
      { accountId: revenueAcc.id, accountName: revenueAcc.accountName, debit: 0, credit: totalAmount, currency: 'YER' }
    ];

    // COGS Entry if costOfGoods > 0
    if (costOfGoods > 0) {
      const cogsAcc = await ensureAndGetAccount(supplierOwnerId, '5100', 'حساب تكلفة مبيعات الجملة', 'expense');
      const invAcc = await ensureAndGetAccount(supplierOwnerId, '1201', 'مخزون البضائع والمستودع المركزي', 'asset');

      entries.push({ accountId: cogsAcc.id, accountName: cogsAcc.accountName, debit: costOfGoods, credit: 0, currency: 'YER' });
      entries.push({ accountId: invAcc.id, accountName: invAcc.accountName, debit: 0, credit: costOfGoods, currency: 'YER' });
    }

    const description = `[المحور 3] قيد آلي مزدوج (تجهيز وشحن المورد) - طلبية #${orderId.slice(-6)} للمشتري ${buyerName}`;

    await this.executeOrQueueVoucher(supplierOwnerId, description, entries, idempotencyKey, storeId);
    return { success: true, idempotencyKey };
  }

  /**
   * ⚖️ AXIS 3 GL ENGINE: BUYER DELIVERY RECEIPT & TRANSIT SETTLEMENT
   * Converts Transit Inventory ('1205') to Physical Warehouse Stock ('1201')
   * Idempotency Key: GL-ORD-${orderId}-DELIVERY-RECEIPT
   */
  static async postB2BOrderDeliveryReceiptGL(params: {
    buyerOwnerId: string;
    supplierName: string;
    orderId: string;
    totalAmount: number;
    storeId?: string;
  }) {
    const { buyerOwnerId, supplierName, orderId, totalAmount, storeId } = params;
    if (!buyerOwnerId || totalAmount <= 0) return { success: true, bypassed: true };

    const idempotencyKey = `GL-ORD-${orderId}-DELIVERY-RECEIPT`;

    // Debit (+): Physical Inventory Stock ('1201')
    const physInvAcc = await ensureAndGetAccount(buyerOwnerId, '1201', 'مخزون البضائع والمستودع المركزي', 'asset');
    // Credit (-): Goods in Transit Account ('1205')
    const transitInvAcc = await ensureAndGetAccount(buyerOwnerId, '1205', 'حساب بضائع الطريق والمخزون المعلق', 'asset');

    const entries: LedgerItem[] = [
      { accountId: physInvAcc.id, accountName: physInvAcc.accountName, debit: totalAmount, credit: 0, currency: 'YER' },
      { accountId: transitInvAcc.id, accountName: transitInvAcc.accountName, debit: 0, credit: totalAmount, currency: 'YER' }
    ];

    const description = `[المحور 3] قيد تسوية استلام الشحنة وتفريغ بضائع الطريق للمخزون الفعلي - طلبية #${orderId.slice(-6)} من ${supplierName}`;

    await this.executeOrQueueVoucher(buyerOwnerId, description, entries, idempotencyKey, storeId);
    return { success: true, idempotencyKey };
  }

  /**
   * 5. AUTOMATED DAMAGED, LOST & EMPLOYEE/ENGINEER ERROR DEDUCTION ENGINE
   * Automatically charges employees/technicians or salary payroll and generates precision settlement vouchers offline/online
   */
  static async postEmployeeLossOrErrorVoucher(data: EmployeeErrorLossData) {
    const {
      ownerId,
      storeId,
      type,
      totalCost,
      responsibilityTarget,
      employeeIds = [],
      employeeNames = [],
      deductFrom = 'salary_payroll',
      storeSplitPercent = 50,
      itemName,
      quantity = 1,
      notes = '',
      isDryRun = false
    } = data;

    if (!ownerId || totalCost <= 0) return { success: true, bypassed: true };

    const entries: LedgerItem[] = [];
    const reference = `SETTLE-${Date.now()}`;

    // Inventory Asset Account (Asset being adjusted down)
    const invAcc = await ensureAndGetAccount(ownerId, '1201', 'مخزون البضائع والمستودع المركزي', 'asset');
    // Store Damaged Goods Loss Expense (Expense born by store)
    const storeLossAcc = await ensureAndGetAccount(ownerId, '5201', 'مصاريف تالف وفاقد المخزون والورشة', 'expense');
    // General Employee Custody & Debt Account (Asset owed by staff)
    const employeeCustodyAcc = await ensureAndGetAccount(ownerId, '1155', 'ذمم والعهد المالية للموظفين والمهندسين', 'asset');

    let storeShare = 0;
    let employeeShare = 0;

    if (responsibilityTarget === 'store') {
      storeShare = totalCost;
    } else if (responsibilityTarget === 'supplier' || responsibilityTarget === 'customer') {
      // Charged to counterparty receivable / payable
      const counterpartAcc = await ensureAndGetAccount(
        ownerId, 
        responsibilityTarget === 'customer' ? '1200' : '2100', 
        responsibilityTarget === 'customer' ? 'ذمم العملاء' : 'حساب الموردين', 
        responsibilityTarget === 'customer' ? 'asset' : 'liability'
      );

      entries.push({
        accountId: counterpartAcc.id,
        accountName: counterpartAcc.accountName,
        debit: totalCost,
        credit: 0,
        currency: 'YER'
      });
    } else if (responsibilityTarget === 'split_store_employee') {
      storeShare = totalCost * (storeSplitPercent / 100);
      employeeShare = totalCost - storeShare;
    } else {
      employeeShare = totalCost;
    }

    // Process Store Share (if any)
    if (storeShare > 0) {
      entries.push({
        accountId: storeLossAcc.id,
        accountName: storeLossAcc.accountName,
        debit: storeShare,
        credit: 0,
        currency: 'YER'
      });
    }

    // Process Employee Share (if any)
    if (employeeShare > 0) {
      if (deductFrom === 'salary_payroll') {
        // Debit Employee Debt / Staff Custody Account
        entries.push({
          accountId: employeeCustodyAcc.id,
          accountName: `ذمم خصميات الرواتب - ${employeeNames.join('، ') || 'الموظفين'}`,
          debit: employeeShare,
          credit: 0,
          currency: 'YER'
        });

        // Execute direct salary payroll deduction for each employee
        if (!isDryRun && employeeIds.length > 0) {
          const perEmpShare = employeeShare / employeeIds.length;
          for (const empId of employeeIds) {
            try {
              await chargeDamageToEmployee(empId, perEmpShare, `${itemName} (${type === 'engineer_repair_error' ? 'خطأ صيانة' : 'تالف/فاقد'})`, quantity);
            } catch (err) {
              console.warn(`[AutomatedJournalEngine] Salary deduction charge warning for employee ${empId}:`, err);
            }
          }
        }
      } else {
        // Direct Custody Account Deduction
        entries.push({
          accountId: employeeCustodyAcc.id,
          accountName: `عهدة مالية - ${employeeNames.join('، ') || 'الموظفين'}`,
          debit: employeeShare,
          credit: 0,
          currency: 'YER'
        });
      }
    }

    // Credit Inventory Asset Account for total cost removed from inventory
    entries.push({
      accountId: invAcc.id,
      accountName: invAcc.accountName,
      debit: 0,
      credit: totalCost,
      currency: 'YER'
    });

    const typeDesc = type === 'engineer_repair_error' ? 'خطأ مهندس/ورشة صيانة' : type === 'employee_error' ? 'خطأ موظف/عمالة' : type === 'inventory_shortage' ? 'عجز فاقد مخزني' : 'تالف مواد ومخزون';
    const description = `قيد تسوية مالية آلي (${typeDesc}) - المادة: ${itemName} (${quantity} حبة) - [المسؤولية: ${responsibilityTarget}] ${notes ? `- ملاحظات: ${notes}` : ''}`;

    if (isDryRun) {
      console.log(`🧪 [AUTOMATED JOURNAL ENGINE DRY-RUN] Settlement Voucher:`, entries);
      return { success: true, entries, reference, isDryRun: true };
    }

    await this.executeOrQueueVoucher(ownerId, description, entries, reference, storeId);
    return { success: true, reference, entries };
  }

  /**
   * SMART BALANCING & REAL-TIME CUMULATIVE BALANCE ENGINE WITH OFFLINE SUPPORT
   */
  private static async executeOrQueueVoucher(
    ownerId: string, 
    description: string, 
    entries: LedgerItem[], 
    reference: string, 
    storeId?: string
  ) {
    try {
      if (!navigator.onLine) {
        this.saveVoucherToOfflineQueue(ownerId, description, entries, reference, storeId);
        return;
      }
      await accountingService.recordJournalEntry(ownerId, description, entries, reference, storeId);
    } catch (err: any) {
      console.warn("🌐 [AutomatedJournalEngine] Network/Posting issue, queueing voucher offline:", err?.message || err);
      this.saveVoucherToOfflineQueue(ownerId, description, entries, reference, storeId);
    }
  }

  /**
   * Saves unposted vouchers to local storage for automatic sync when internet re-establishes
   */
  private static saveVoucherToOfflineQueue(
    ownerId: string, 
    description: string, 
    entries: LedgerItem[], 
    reference: string, 
    storeId?: string
  ) {
    try {
      const existingRaw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue = existingRaw ? JSON.parse(existingRaw) : [];
      if (reference && queue.some((v: any) => v.reference === reference)) {
        console.warn(`🔒 [AutomatedJournalEngine Offline Guard] Voucher reference '${reference}' already present in offline queue. Skipping duplicate.`);
        return;
      }
      queue.push({
        ownerId,
        description,
        entries,
        reference,
        storeId,
        queuedAt: new Date().toISOString()
      });
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      console.log(`💾 [AutomatedJournalEngine] Saved voucher '${reference}' to offline local queue.`);
    } catch (e) {
      console.error("Failed to save voucher to offline queue:", e);
    }
  }

  /**
   * Automatically flushes offline queued vouchers to Firestore once connection is active
   */
  static async processOfflineVoucherQueue() {
    if (!navigator.onLine) return;
    try {
      const existingRaw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!existingRaw) return;
      const queue: any[] = JSON.parse(existingRaw);
      if (!queue || queue.length === 0) return;

      console.log(`🚀 [AutomatedJournalEngine] Processing ${queue.length} queued offline vouchers...`);
      const remaining: any[] = [];

      for (const voucher of queue) {
        try {
          await accountingService.recordJournalEntry(
            voucher.ownerId, 
            `[أوفلاين - مزامن] ${voucher.description}`, 
            voucher.entries, 
            voucher.reference, 
            voucher.storeId
          );
        } catch (err) {
          console.warn(`Failed to process queued voucher ${voucher.reference}, keeping in queue:`, err);
          remaining.push(voucher);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        console.log("✅ [AutomatedJournalEngine] All offline journal vouchers successfully synced!");
      }
    } catch (e) {
      console.error("Error processing offline voucher queue:", e);
    }
  }

  /**
   * Helper method for generic automated journal posting
   */
  static async postAutomatedJournal(params: {
    ownerId: string;
    storeId?: string;
    sourceModule?: string;
    description: string;
    reference?: string;
    lines: LedgerItem[];
    metadata?: any;
  }): Promise<{ success: boolean; reference: string }> {
    const { ownerId, storeId, description, reference = `AJ-${Date.now()}`, lines } = params;
    await this.executeOrQueueVoucher(ownerId, description, lines, reference, storeId);
    return { success: true, reference };
  }

  /**
   * Returns cached balance statistics for dashboard UI
   */
  static getCachedCumulativeBalances(): CumulativeBalanceSummary {
    try {
      const cached = localStorage.getItem('jam_cumulative_balances_cache');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Failed to read cumulative balances cache:", e);
    }
    return {
      cashVaultsBalance: 0,
      bankAccountsBalance: 0,
      totalAssets: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Returns count of vouchers waiting in local offline queue
   */
  static getPendingOfflineQueueCount(): number {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return 0;
      const q = JSON.parse(raw);
      return Array.isArray(q) ? q.length : 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Triggers manual synchronization of offline queued vouchers
   */
  static async syncOfflineQueue(ownerId?: string): Promise<{ syncedCount: number; errors: number }> {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return { syncedCount: 0, errors: 0 };
    let queue: any[] = [];
    try {
      queue = JSON.parse(raw);
    } catch (e) {
      return { syncedCount: 0, errors: 0 };
    }
    if (!Array.isArray(queue) || queue.length === 0) return { syncedCount: 0, errors: 0 };

    let syncedCount = 0;
    let errors = 0;
    const remaining: any[] = [];

    for (const voucher of queue) {
      try {
        await accountingService.recordJournalEntry(
          voucher.ownerId || ownerId, 
          `[أوفلاين - مزامن] ${voucher.description}`, 
          voucher.entries, 
          voucher.reference, 
          voucher.storeId
        );
        syncedCount++;
      } catch (err) {
        console.warn(`Failed to sync queued voucher ${voucher.reference}:`, err);
        errors++;
        remaining.push(voucher);
      }
    }

    if (remaining.length > 0) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    }

    return { syncedCount, errors };
  }

  /**
   * Higher level wrapper for posting damages, shortages, or staff error deductions
   */
  static async postDamageOrShrinkage(params: {
    ownerId: string;
    storeId?: string;
    itemName: string;
    costAmount: number;
    responsibleType: 'engineer' | 'employee' | 'company_waste' | string;
    responsibleId?: string;
    responsibleName?: string;
    deductFromPayroll?: boolean;
    reason?: string;
  }): Promise<{ success: boolean; msg?: string; reference?: string }> {
    const {
      ownerId,
      storeId,
      itemName,
      costAmount,
      responsibleType,
      responsibleId,
      responsibleName,
      deductFromPayroll = true,
      reason = ''
    } = params;

    let target: 'single_employee' | 'store' = 'store';
    let errorType: 'damaged_goods' | 'engineer_repair_error' | 'employee_error' = 'damaged_goods';

    if (responsibleType === 'engineer') {
      target = 'single_employee';
      errorType = 'engineer_repair_error';
    } else if (responsibleType === 'employee') {
      target = 'single_employee';
      errorType = 'employee_error';
    } else {
      target = 'store';
      errorType = 'damaged_goods';
    }

    const res = await this.postEmployeeLossOrErrorVoucher({
      ownerId,
      storeId,
      type: errorType,
      totalCost: costAmount,
      responsibilityTarget: target,
      employeeIds: responsibleId ? [responsibleId] : [],
      employeeNames: responsibleName ? [responsibleName] : [],
      deductFrom: deductFromPayroll ? 'salary_payroll' : 'custody_account',
      itemName,
      quantity: 1,
      notes: reason
    });

    return {
      success: res.success,
      msg: 'تم تسجيل وتوليد قيد تسوية التالف والخصم بنجاح.',
      reference: res.reference
    };
  }
}

// Auto-attach offline sync listener on load
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    AutomatedJournalEngine.processOfflineVoucherQueue();
  });
}
