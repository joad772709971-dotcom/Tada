import { db } from '../firebase';
import { ensureAndGetAccount } from './PurchasesManagerService';
import { AutomatedJournalEngine } from './AutomatedJournalEngine';

/**
 * MISSION 4 CORE FUNCTION - MAINTENANCE DOUBLE-ENTRY POSTING MODULE
 * DEBIT (مدين): Cash/Vault Account (Code: 1101) or Accounts Receivable (ذمم العملاء - Code: 1200)
 * CREDIT (دائن): Maintenance Revenue Account (إيرادات الصيانة - Code: 4200)
 * DEBIT (مدين): Engineer Commission Expense (مصاريف العمولات - Code: 5100) (if applicable)
 * CREDIT (دائن): Cash/Vault Account (Code: 1101) or Engineer Commission Liability/Accrued (Code: 2101)
 */
export const postMaintenanceToLedger = async (ticketData: any) => {
  const {
    ownerId,
    total,
    isPaid,
    engineerCommission, // amount or percentage
    engineerName,
    ticketNumber,
    customerName
  } = ticketData;

  if (!ownerId) {
    throw new Error("Missing ownerId in maintenance ledger transaction");
  }

  const amt = parseFloat(total) || 0;
  if (amt <= 0) return { success: true, bypassed: true };

  // 1. Resolve Accounts
  const cashAcc = await ensureAndGetAccount(ownerId, '1101', 'حساب الصندوق والطوارئ', 'asset');
  const receivablesAcc = await ensureAndGetAccount(ownerId, '1200', 'ذمم العملاء المدينين', 'asset');
  const revenueAcc = await ensureAndGetAccount(ownerId, '4200', 'حساب إيرادات الصيانة والخدمات', 'revenue');

  const debitAcc = isPaid ? cashAcc : receivablesAcc;

  const entries: any[] = [
    {
      accountId: debitAcc.id,
      accountName: debitAcc.accountName,
      debit: amt,
      credit: 0
    },
    {
      accountId: revenueAcc.id,
      accountName: revenueAcc.accountName,
      debit: 0,
      credit: amt
    }
  ];

  // 2. Post commission if any exists
  const commissionAmt = parseFloat(engineerCommission) || 0;
  if (commissionAmt > 0) {
    const commissionExpenseAcc = await ensureAndGetAccount(
      ownerId, 
      '5100', 
      'حساب مصاريف عمولات المهندسين', 
      'expense'
    );
    entries.push({
      accountId: commissionExpenseAcc.id,
      accountName: commissionExpenseAcc.accountName,
      debit: commissionAmt,
      credit: 0
    });
    entries.push({
      accountId: cashAcc.id,
      accountName: cashAcc.accountName,
      debit: 0,
      credit: commissionAmt
    });
  }

  const description = `صيانة كرت #${ticketNumber || 'NEW'} للعميل: ${customerName || 'عام'} ${engineerName ? `بإشراف المهندس: ${engineerName}` : ''}`;
  const reference = ticketNumber ? `MNT-${ticketNumber}` : `MNT-${Date.now()}`;

  await AutomatedJournalEngine.postAutomatedJournal({
    ownerId,
    sourceModule: 'maintenance',
    description,
    reference,
    lines: entries,
    metadata: { engineerName, customerName }
  });

  return { success: true, reference };
};

/**
 * MISSION 4 CORE FUNCTION - PETTY CASH & ADMINISTRATIVE EXPENSES & SALARIES
 * DEBIT (مدين): Admin, General expenses & salary accounts (Code: 5200)
 * CREDIT (دائن): Cash/Vault Account (Code: 1101)
 */
export const postPettyCashOrSalaryToLedger = async (transactionData: any) => {
  const {
    ownerId,
    amount,
    type, // 'salary' | 'expense' | 'petty-cash'
    description: userMsg,
    recipientName,
    voucherNumber
  } = transactionData;

  if (!ownerId) {
    throw new Error("Missing ownerId in petty cash ledger transaction");
  }

  const amt = parseFloat(amount) || 0;
  if (amt <= 0) return { success: true, bypassed: true };

  const cashAcc = await ensureAndGetAccount(ownerId, '1101', 'حساب الصندوق والطوارئ', 'asset');
  const expenseAcc = await ensureAndGetAccount(
    ownerId, 
    '5200', 
    'حساب المصاريف الإدارية والعمومية والرواتب', 
    'expense'
  );

  const entries = [
    {
      accountId: expenseAcc.id,
      accountName: expenseAcc.accountName,
      debit: amt,
      credit: 0
    },
    {
      accountId: cashAcc.id,
      accountName: cashAcc.accountName,
      debit: 0,
      credit: amt
    }
  ];

  const typeDesc = type === 'salary' ? 'صرف مرتبات وأجور' : 'صروفات نقدية نثريات وإدارية';
  const description = `${typeDesc} ${recipientName ? `ل للمستفيد: ${recipientName}` : ''} - ${userMsg || ''}`;
  const reference = voucherNumber || `EXP-${Date.now()}`;

  await AutomatedJournalEngine.postAutomatedJournal({
    ownerId,
    sourceModule: 'payroll_deduction',
    description,
    reference,
    lines: entries,
    metadata: { employeeName: recipientName }
  });

  return { success: true, reference };
};
