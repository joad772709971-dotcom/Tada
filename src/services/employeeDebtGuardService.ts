import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, updateDoc, getDocs, query, where, addDoc } from 'firebase/firestore';

export interface EmployeeDebtEntry {
  id: string;
  employeeUsername: string;
  employeeName: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  issuedAt: string;
  status: 'active' | 'settled' | 'deducted_from_salary';
  orderId?: string;
  notes?: string;
  settledAt?: string;
  deductedAt?: string;
}

export interface EmployeeDebtConfig {
  username: string;
  fullName: string;
  maxCreditLimit: number;           // سقف المديونية المسموح بها للإدانة على المسؤولية
  currentCreditIssued: number;      // إجمالي الديون القائمة الممنوحة للآخرين
  autoSalaryDeductionOnDefault: boolean; // الخصم التلقائي من الراتب عند التعثر
  allowManagerOverride: boolean;     // السماح بتجاوز المدير عند تعدي السقف
}

export interface SalaryDeductionLog {
  id: string;
  employeeUsername: string;
  employeeName: string;
  amount: number;
  deductedAt: string;
  reason: string;
  debtId: string;
  approvedBy: string;
}

const STORAGE_KEY_CONFIGS = 'jam_employee_debt_configs_v1';
const STORAGE_KEY_ENTRIES = 'jam_employee_debt_entries_v1';
const STORAGE_KEY_DEDUCTIONS = 'jam_employee_salary_deductions_v1';

export const employeeDebtGuardService = {
  /**
   * Fetch debt config for a specific employee
   */
  getEmployeeDebtConfig(username: string): EmployeeDebtConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIGS);
      const configs: Record<string, EmployeeDebtConfig> = stored ? JSON.parse(stored) : {};
      
      if (configs[username]) {
        return configs[username];
      }
    } catch (e) {
      console.error('Error reading employee debt config:', e);
    }

    // Default configuration if not set
    return {
      username,
      fullName: username,
      maxCreditLimit: 50000, // 50,000 YER default ceiling
      currentCreditIssued: 0,
      autoSalaryDeductionOnDefault: true,
      allowManagerOverride: true
    };
  },

  /**
   * Save or update employee debt config (e.g. setting ceiling limit)
   */
  saveEmployeeDebtConfig(config: EmployeeDebtConfig): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIGS);
      const configs: Record<string, EmployeeDebtConfig> = stored ? JSON.parse(stored) : {};
      configs[config.username] = config;
      localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(configs));
    } catch (e) {
      console.error('Error saving employee debt config:', e);
    }
  },

  /**
   * Check if employee can issue credit for a given amount
   */
  canEmployeeIssueCredit(username: string, requestedAmount: number): {
    allowed: boolean;
    currentIssued: number;
    maxLimit: number;
    remainingLimit: number;
    exceededAmount: number;
    reason?: string;
  } {
    const config = this.getEmployeeDebtConfig(username);
    const entries = this.getEmployeeActiveDebts(username);
    const activeTotal = entries.reduce((sum, e) => sum + (e.status === 'active' ? e.amount : 0), 0);

    const remaining = Math.max(0, config.maxCreditLimit - activeTotal);
    const exceeded = Math.max(0, (activeTotal + requestedAmount) - config.maxCreditLimit);

    if (activeTotal + requestedAmount > config.maxCreditLimit) {
      return {
        allowed: false,
        currentIssued: activeTotal,
        maxLimit: config.maxCreditLimit,
        remainingLimit: remaining,
        exceededAmount: exceeded,
        reason: `تجاوز المبلغ المطلوب (${requestedAmount.toLocaleString()} ر.ي) سقف المديونية المسموح للموظف (${config.maxCreditLimit.toLocaleString()} ر.ي). المتبقي المتاح: ${remaining.toLocaleString()} ر.ي.`
      };
    }

    return {
      allowed: true,
      currentIssued: activeTotal,
      maxLimit: config.maxCreditLimit,
      remainingLimit: remaining,
      exceededAmount: 0
    };
  },

  /**
   * Record new credit issued by employee on their personal liability
   */
  recordCreditIssued(params: {
    employeeUsername: string;
    employeeName: string;
    customerName: string;
    customerPhone?: string;
    amount: number;
    orderId?: string;
    notes?: string;
  }): EmployeeDebtEntry {
    const { employeeUsername, employeeName, customerName, customerPhone, amount, orderId, notes } = params;

    const newEntry: EmployeeDebtEntry = {
      id: `EDE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeUsername,
      employeeName,
      customerName,
      customerPhone,
      amount,
      issuedAt: new Date().toISOString(),
      status: 'active',
      orderId,
      notes: notes || 'إدانة آجل على مسؤولية الموظف الشخصية'
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENTRIES);
      const entries: EmployeeDebtEntry[] = stored ? JSON.parse(stored) : [];
      entries.unshift(newEntry);
      localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));

      // Update current credit issued in config
      const config = this.getEmployeeDebtConfig(employeeUsername);
      config.fullName = employeeName;
      config.currentCreditIssued = entries
        .filter(e => e.employeeUsername === employeeUsername && e.status === 'active')
        .reduce((sum, e) => sum + e.amount, 0);
      this.saveEmployeeDebtConfig(config);

    } catch (e) {
      console.error('Error saving credit entry:', e);
    }

    return newEntry;
  },

  /**
   * Get all active debts issued by employee
   */
  getEmployeeActiveDebts(username?: string): EmployeeDebtEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENTRIES);
      const entries: EmployeeDebtEntry[] = stored ? JSON.parse(stored) : [];
      if (username) {
        return entries.filter(e => e.employeeUsername === username);
      }
      return entries;
    } catch (e) {
      return [];
    }
  },

  /**
   * Settle debt (e.g. customer paid back)
   */
  settleDebt(entry: EmployeeDebtEntry, notes?: string): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENTRIES);
      const entries: EmployeeDebtEntry[] = stored ? JSON.parse(stored) : [];
      const index = entries.findIndex(e => e.id === entry.id);
      if (index !== -1) {
        entries[index].status = 'settled';
        entries[index].settledAt = new Date().toISOString();
        if (notes) entries[index].notes += ` | سداد: ${notes}`;
        localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));

        // Recalculate config active total
        const config = this.getEmployeeDebtConfig(entries[index].employeeUsername);
        config.currentCreditIssued = entries
          .filter(e => e.employeeUsername === entries[index].employeeUsername && e.status === 'active')
          .reduce((sum, e) => sum + e.amount, 0);
        this.saveEmployeeDebtConfig(config);
      }
    } catch (e) {
      console.error('Error settling debt:', e);
    }
  },

  /**
   * Settle customer debt paid to any cashier, manager, or other employee
   */
  settleCustomerDebtsByPayment(params: {
    customerName: string;
    customerPhone?: string;
    paidAmount: number;
    receivedByUsername: string;
    receivedByName: string;
    receivedByRole: string;
    receiptVoucherId?: string;
    notes?: string;
  }): {
    settledCount: number;
    totalAmountSettled: number;
    affectedEmployees: string[];
    details: string;
  } {
    const { customerName, customerPhone, paidAmount, receivedByUsername, receivedByName, receivedByRole, receiptVoucherId, notes } = params;

    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENTRIES);
      const entries: EmployeeDebtEntry[] = stored ? JSON.parse(stored) : [];

      const matching = entries.filter(e => 
        e.status === 'active' && 
        (e.customerName.trim().toLowerCase() === customerName.trim().toLowerCase() ||
         (customerPhone && e.customerPhone && e.customerPhone.trim() === customerPhone.trim()))
      );

      if (matching.length === 0) {
        return {
          settledCount: 0,
          totalAmountSettled: 0,
          affectedEmployees: [],
          details: 'لم يتم العثور على ديون قائمة مقترنة بمسؤولية الموظفين لهذا العميل.'
        };
      }

      let remainingPayment = paidAmount;
      let settledCount = 0;
      let totalAmountSettled = 0;
      const affectedEmployeesSet = new Set<string>();

      for (const debt of matching) {
        if (remainingPayment <= 0) break;

        const settleForThisDebt = Math.min(debt.amount, remainingPayment);
        remainingPayment -= settleForThisDebt;
        totalAmountSettled += settleForThisDebt;

        if (settleForThisDebt >= debt.amount) {
          debt.status = 'settled';
          debt.settledAt = new Date().toISOString();
          debt.notes += ` | تم السداد بالكامل (${settleForThisDebt.toLocaleString()} ر.ي) عن طريق المستلم: ${receivedByName} [${receivedByRole}] ${receiptVoucherId ? `- سند #${receiptVoucherId}` : ''}`;
          settledCount++;
        } else {
          debt.amount -= settleForThisDebt;
          debt.notes += ` | تم سداد جزئي (${settleForThisDebt.toLocaleString()} ر.ي) عن طريق المستلم: ${receivedByName} [${receivedByRole}] ${receiptVoucherId ? `- سند #${receiptVoucherId}` : ''}`;
        }

        affectedEmployeesSet.add(debt.employeeUsername);
      }

      localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));

      affectedEmployeesSet.forEach(empUsername => {
        const config = this.getEmployeeDebtConfig(empUsername);
        config.currentCreditIssued = entries
          .filter(e => e.employeeUsername === empUsername && e.status === 'active')
          .reduce((sum, e) => sum + e.amount, 0);
        this.saveEmployeeDebtConfig(config);
      });

      const affectedList = Array.from(affectedEmployeesSet);
      return {
        settledCount,
        totalAmountSettled,
        affectedEmployees: affectedList,
        details: `تم تسوية وتفريغ مديونية بمبلغ ${totalAmountSettled.toLocaleString()} ر.ي واستعادة سقف المديونية تلقائياً للموظفين المعنيين (${affectedList.join(', ')}). المستلم: ${receivedByName} (${receivedByRole}).`
      };

    } catch (e: any) {
      return {
        settledCount: 0,
        totalAmountSettled: 0,
        affectedEmployees: [],
        details: `خطأ أثناء تسوية الدين: ${e.message}`
      };
    }
  },

  /**
   * Convert defaulted debt to Salary Deduction (خصم الدين المباشر من راتب الموظف/العامل)
   */
  convertDebtToSalaryDeduction(params: {
    debtEntryId: string;
    approvedBy: string;
    notes?: string;
  }): { success: boolean; deductionLog?: SalaryDeductionLog; message: string } {
    try {
      const storedEntries = localStorage.getItem(STORAGE_KEY_ENTRIES);
      const entries: EmployeeDebtEntry[] = storedEntries ? JSON.parse(storedEntries) : [];
      const debt = entries.find(e => e.id === params.debtEntryId);

      if (!debt) {
        return { success: false, message: 'لم يتم العثور على سجل المديونية' };
      }

      if (debt.status !== 'active') {
        return { success: false, message: 'هذا الدين ليس في حالة نشطة' };
      }

      // Mark debt as deducted from salary
      debt.status = 'deducted_from_salary';
      debt.deductedAt = new Date().toISOString();
      debt.notes += ` | تم تحويل المديونية إلى خصم مباشر من راتب الموظف بواسطة (${params.approvedBy})`;
      localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));

      // Create salary deduction record
      const deductionLog: SalaryDeductionLog = {
        id: `DED-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        employeeUsername: debt.employeeUsername,
        employeeName: debt.employeeName,
        amount: debt.amount,
        deductedAt: new Date().toISOString(),
        reason: `خصم مديونية متعثرة للعميل (${debt.customerName}) المحررة على مسؤوليته - سند رقم #${debt.orderId || 'بدون'}`,
        debtId: debt.id,
        approvedBy: params.approvedBy
      };

      const storedDeductions = localStorage.getItem(STORAGE_KEY_DEDUCTIONS);
      const deductions: SalaryDeductionLog[] = storedDeductions ? JSON.parse(storedDeductions) : [];
      deductions.unshift(deductionLog);
      localStorage.setItem(STORAGE_KEY_DEDUCTIONS, JSON.stringify(deductions));

      // Update employee active credit total
      const config = this.getEmployeeDebtConfig(debt.employeeUsername);
      config.currentCreditIssued = entries
        .filter(e => e.employeeUsername === debt.employeeUsername && e.status === 'active')
        .reduce((sum, e) => sum + e.amount, 0);
      this.saveEmployeeDebtConfig(config);

      return {
        success: true,
        deductionLog,
        message: `تم قيد خصم مبلغ ${debt.amount.toLocaleString()} ر.ي بنجاح من راتب الموظف (${debt.employeeName}) وتسوية المديونية.`
      };

    } catch (e: any) {
      return { success: false, message: e.message || 'حدث خطأ أثناء إجراء الخصم' };
    }
  },

  /**
   * Get all salary deductions for an employee or all
   */
  getSalaryDeductions(username?: string): SalaryDeductionLog[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DEDUCTIONS);
      const deductions: SalaryDeductionLog[] = stored ? JSON.parse(stored) : [];
      if (username) {
        return deductions.filter(d => d.employeeUsername === username);
      }
      return deductions;
    } catch (e) {
      return [];
    }
  }
};
