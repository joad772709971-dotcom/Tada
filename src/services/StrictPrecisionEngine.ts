/**
 * 🏛️ Strict Financial & Inventory Precision Engine (محرك الدقة المحاسبية والمخزونية الصارمة)
 * 
 * يفرض معايير الدقة الرياضية الصارمة ويمنع أخطاء الفاصلة العائمة (Floating Point Glitches):
 * 1. Financial Precision: تقريب محاسبي معتمد (Epsilon-based) واحتفاظ بالقيمة الخام أثناء العمليات الوسيطة.
 * 2. Inventory & Composite Units: تسجيل حركة المخزون بالوحدة الصغرى (Base Unit - الحبة) ودعم الكسور (أرباع، أثلاث، 1.25) والمتوسط المرجح (WAC) بدقة 4 خانات.
 * 3. Time Precision: تحويل الدوام والتأخيرات إلى "الدقائق المطلقة" (Absolute Minutes) واحتساب خصم التأخير بدقة ثابتة.
 * 4. Balance & Reconciliation: فحص توازن الفواتير وكشوف الحسابات (Total == Sum of Items).
 */

export type SupportedCurrency = 'YER' | 'SAR' | 'USD' | 'OMR' | string;

export class StrictPrecisionEngine {
  // ==========================================
  // 1. FINANCIAL PRECISION & SAFE ARITHMETIC
  // ==========================================

  /**
   * التقريب المالي المحاسبي المعتمد مع منع تشوهات IEEE-754 الفاصلة العائمة
   * Math.round((value + Number.EPSILON) * 10^decimals) / 10^decimals
   */
  public static financialRound(val: number | string | null | undefined, decimals: number = 2): number {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'number' ? val : Number(val);
    if (isNaN(num)) return 0;
    
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
  }

  /**
   * تحويل وحماية المبالغ بحسب معيار العملة
   * - للريال اليمني/السعودي/الدولار للفواتير: 2 خانات عشرية
   * - لأسعار التكلفة وسعر الصرف والمتوسط المرجح: 4 خانات عشرية
   */
  public static toSafeCurrency(
    val: number | string | null | undefined, 
    currencyOrType: SupportedCurrency | 'WAC' | 'COST' | 'EXCHANGE' = 'YER'
  ): number {
    const isHighPrecision = ['WAC', 'COST', 'EXCHANGE', 'RATE'].includes(currencyOrType.toUpperCase());
    const decimals = isHighPrecision ? 4 : 2;
    return this.financialRound(val, decimals);
  }

  /**
   * جمع مالي آمن
   */
  public static safeAdd(a: number | string, b: number | string, decimals: number = 4): number {
    const nA = Number(a) || 0;
    const nB = Number(b) || 0;
    return this.financialRound(nA + nB, decimals);
  }

  /**
   * طرح مالي آمن
   */
  public static safeSub(a: number | string, b: number | string, decimals: number = 4): number {
    const nA = Number(a) || 0;
    const nB = Number(b) || 0;
    return this.financialRound(nA - nB, decimals);
  }

  /**
   * ضرب مالي آمن
   */
  public static safeMul(a: number | string, b: number | string, decimals: number = 4): number {
    const nA = Number(a) || 0;
    const nB = Number(b) || 0;
    return this.financialRound(nA * nB, decimals);
  }

  /**
   * قسمة مالية آمنة مع حماية من القسمة على صفر
   */
  public static safeDiv(numerator: number | string, denominator: number | string, decimals: number = 4): number {
    const nNum = Number(numerator) || 0;
    const nDen = Number(denominator) || 0;
    if (nDen === 0) return 0;
    return this.financialRound(nNum / nDen, decimals);
  }

  /**
   * جمع قائمة مبالغ بدقة كاملة
   */
  public static safeSum(numbers: (number | string | null | undefined)[], decimals: number = 2): number {
    const total = numbers.reduce<number>((acc, curr) => {
      const val = Number(curr) || 0;
      return acc + val;
    }, 0);
    return this.financialRound(total, decimals);
  }

  // ==========================================
  // 2. COMPOSITE UNITS & FRACTIONAL INVENTORY
  // ==========================================

  /**
   * تحليل الكسور والمدخلات المركبة (1.25، 1/4، 1/3، ربع، ثلث، نصف، كرتون وربع)
   */
  public static parseFractionOrDecimal(input: string | number | null | undefined): number {
    if (input === null || input === undefined || input === '') return 0;
    if (typeof input === 'number') return isNaN(input) ? 0 : input;

    const trimmed = input.toString().trim();
    
    // Check Arabic textual fractions
    if (trimmed === 'ربع' || trimmed === '1/4') return 0.25;
    if (trimmed === 'نصف' || trimmed === '1/2') return 0.5;
    if (trimmed === 'ثلاثة أرباع' || trimmed === '3/4') return 0.75;
    if (trimmed === 'ثلث' || trimmed === '1/3') return 0.3333333333;
    if (trimmed === 'ثلثين' || trimmed === '2/3') return 0.6666666667;

    // Mixed fraction like "1 1/4" or "2 1/2"
    if (trimmed.includes(' ') && trimmed.includes('/')) {
      const parts = trimmed.split(' ');
      const whole = parseFloat(parts[0]) || 0;
      const fracParts = parts[1].split('/');
      if (fracParts.length === 2) {
        const num = parseFloat(fracParts[0]) || 0;
        const den = parseFloat(fracParts[1]) || 1;
        return whole + (den !== 0 ? num / den : 0);
      }
    }

    // Single fraction like "5/2"
    if (trimmed.includes('/')) {
      const fracParts = trimmed.split('/');
      if (fracParts.length === 2) {
        const num = parseFloat(fracParts[0]) || 0;
        const den = parseFloat(fracParts[1]) || 1;
        return den !== 0 ? num / den : 0;
      }
    }

    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * تحويل كمية الوحدة الكبرى (كرتون، باكت، درزن) إلى الوحدة الصغرى الأساسية (حبة)
   * مثال: 1.25 كرتون (الكرتون = 24 حبة) -> 1.25 × 24 = 30 حبة بالضبط
   */
  public static convertMajorToBaseUnit(
    majorQuantity: number | string, 
    conversionFactor: number
  ): number {
    const qty = this.parseFractionOrDecimal(majorQuantity);
    const factor = Math.max(1, conversionFactor || 1);
    const baseQty = qty * factor;
    // التقريب لـ 4 خانات لضمان عدم ضياع الكسور الدقيقة
    return this.financialRound(baseQty, 4);
  }

  /**
   * تحويل كمية الوحدات الصغرى (حبة) إلى قراءة كبرى مركبة (كرتون + حبات متبقية)
   * مثال: 30 حبة (معامل 24) -> 1 كرتون و 6 حبات (1.25 كرتون)
   */
  public static convertBaseToMajorUnit(
    baseQuantity: number, 
    conversionFactor: number,
    majorUnitName: string = 'كرتون',
    baseUnitName: string = 'حبة'
  ): {
    decimalMajor: number;
    wholeMajor: number;
    remainingBase: number;
    formattedText: string;
  } {
    const factor = Math.max(1, conversionFactor || 1);
    const safeBase = Math.max(0, baseQuantity || 0);
    const decimalMajor = this.financialRound(safeBase / factor, 4);
    const wholeMajor = Math.floor(safeBase / factor);
    const remainingBase = this.financialRound(safeBase % factor, 2);

    let formattedText = '';
    if (wholeMajor > 0 && remainingBase > 0) {
      formattedText = `${wholeMajor} ${majorUnitName} و ${remainingBase} ${baseUnitName}`;
    } else if (wholeMajor > 0) {
      formattedText = `${wholeMajor} ${majorUnitName}`;
    } else {
      formattedText = `${remainingBase} ${baseUnitName}`;
    }

    return {
      decimalMajor,
      wholeMajor,
      remainingBase,
      formattedText
    };
  }

  /**
   * احتساب المتوسط المرجح للتكلفة (Weighted Average Cost - WAC)
   * يحافظ على دقة تكلفة الحبة الواحدة حتى 4 خانات عشرية (مثل 600.1 أو 33.3333) لمنع تآكل التكلفة
   * 
   * المعادلة: ((الرصيد_السابق × التكلفة_السابقة) + (الكمية_المشتراة × سعر_الشراء_الجديد)) ÷ إجمالي_الرصيد_الجديد
   */
  public static calculateWeightedAverageCost(
    currentStock: number,
    currentCost: number,
    incomingStock: number,
    incomingCost: number
  ): number {
    const stockPrev = Math.max(0, currentStock || 0);
    const costPrev = Math.max(0, currentCost || 0);
    const stockNew = Math.max(0, incomingStock || 0);
    const costNew = Math.max(0, incomingCost || 0);

    const totalStock = stockPrev + stockNew;
    if (totalStock <= 0) {
      return this.financialRound(costNew, 4);
    }

    // إجمالي قيمة المخزون الدقيقة
    const totalValue = (stockPrev * costPrev) + (stockNew * costNew);
    const rawWac = totalValue / totalStock;

    // حفظ التكلفة المرجحة بدقة 4 خانات عشرية
    return this.financialRound(rawWac, 4);
  }

  // ==========================================
  // 3. TIME & ATTENDANCE PRECISION (الدقائق المطلقة)
  // ==========================================

  /**
   * استخراج وقت اليوم بالدقائق المطلقة من منتصف الليل (00:00 = 0 دقيقة، 08:30 = 510 دقيقة)
   */
  public static toAbsoluteMinutesOfDay(timeOrDate: Date | number | string | any): number {
    let d: Date;
    if (timeOrDate && typeof timeOrDate.toDate === 'function') {
      d = timeOrDate.toDate();
    } else if (timeOrDate instanceof Date) {
      d = timeOrDate;
    } else if (typeof timeOrDate === 'number') {
      d = new Date(timeOrDate);
    } else if (typeof timeOrDate === 'string') {
      if (timeOrDate.includes(':') && !timeOrDate.includes('T')) {
        // Simple "HH:mm"
        const [hours, minutes] = timeOrDate.split(':').map(Number);
        return ((hours || 0) * 60) + (minutes || 0);
      }
      d = new Date(timeOrDate);
    } else {
      d = new Date();
    }

    return (d.getHours() * 60) + d.getMinutes();
  }

  /**
   * حساب دقائق التأخير المطلقة بدقة 100%
   * مثال: وقت الحضور المتوقع 08:30 (510 دقيقة)، الحضور الفعلي 08:42 (522 دقيقة) -> التأخير = 12 دقيقة بالضبط
   */
  public static calculateLatenessMinutes(
    actualCheckIn: any,
    expectedStartTime: string = '08:30'
  ): number {
    const actualMinutes = this.toAbsoluteMinutesOfDay(actualCheckIn);
    const expectedMinutes = this.toAbsoluteMinutesOfDay(expectedStartTime);

    if (actualMinutes > expectedMinutes) {
      return actualMinutes - expectedMinutes;
    }
    return 0;
  }

  /**
   * حساب معدل أجر الدقيقة الواحدة للموظف بدقة متناهية
   * المعادلة: (الراتب الشهري ÷ أيام الشهر [30]) ÷ (ساعات الدوام اليومية × 60 دقيقة)
   */
  public static calculateMinuteRate(
    monthlySalary: number,
    workingHoursPerDay: number = 8,
    workingDaysPerMonth: number = 30
  ): number {
    const salary = Math.max(0, monthlySalary || 0);
    const days = Math.max(1, workingDaysPerMonth || 30);
    const hours = Math.max(1, workingHoursPerDay || 8);

    const dailyRate = salary / days;
    const totalWorkingMinutesPerDay = hours * 60;
    const minuteRate = dailyRate / totalWorkingMinutesPerDay;

    // دقة خام مقربة لـ 4 خانات لحماية الفلس
    return this.financialRound(minuteRate, 4);
  }

  /**
   * حساب خصم التأخير بالدقيقة بدقة 100%
   * المعادلة: (الراتب اليومي ÷ ساعات الدوام ÷ 60) × دقائق التأخير
   */
  public static calculateLatenessDeduction(
    monthlySalary: number,
    latenessMinutes: number,
    workingHoursPerDay: number = 8,
    workingDaysPerMonth: number = 30
  ): number {
    const safeMinutes = Math.max(0, latenessMinutes || 0);
    if (safeMinutes === 0) return 0;

    const minuteRate = this.calculateMinuteRate(monthlySalary, workingHoursPerDay, workingDaysPerMonth);
    const deduction = minuteRate * safeMinutes;

    return this.financialRound(deduction, 2);
  }

  /**
   * حساب أجر العمل الإضافي بالدقيقة
   */
  public static calculateOvertimePay(
    monthlySalary: number,
    overtimeMinutes: number,
    overtimeMultiplier: number = 1.5,
    workingHoursPerDay: number = 8
  ): number {
    const safeMinutes = Math.max(0, overtimeMinutes || 0);
    if (safeMinutes === 0) return 0;

    const minuteRate = this.calculateMinuteRate(monthlySalary, workingHoursPerDay);
    const pay = minuteRate * safeMinutes * overtimeMultiplier;

    return this.financialRound(pay, 2);
  }

  /**
   * تحويل الدقائق إلى صيغة نصية مقروءة وواضحة (مثال: 75 دقيقة -> ساعة واحدة و 15 دقيقة)
   */
  public static formatMinutesToReadableDuration(totalMinutes: number): string {
    const mins = Math.max(0, Math.round(totalMinutes || 0));
    const hours = Math.floor(mins / 60);
    const remMinutes = mins % 60;

    if (hours === 0) {
      return `${remMinutes} دقيقة`;
    }
    if (remMinutes === 0) {
      return `${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : 'ساعات'}`;
    }
    return `${hours} ${hours === 1 ? 'ساعة' : 'ساعات'} و ${remMinutes} دقيقة`;
  }

  // ==========================================
  // 4. BALANCE AUDITING & RECONCILIATION
  // ==========================================

  /**
   * فحص تطابق الفاتورة (Invoice Balance Check)
   * يتأكد من أن: إجمالي الفاتورة == مجموع البنود بعد الخصومات والضرائب بدقة الفلس
   */
  public static verifyInvoiceBalance(
    items: Array<{ quantity: number | string; price: number | string; discount?: number | string; total?: number | string }>,
    invoiceDiscount: number = 0,
    invoiceTax: number = 0,
    declaredTotal: number
  ): {
    isBalanced: boolean;
    calculatedTotal: number;
    itemsSum: number;
    difference: number;
    message: string;
  } {
    let itemsSum = 0;

    items.forEach((item) => {
      const q = this.parseFractionOrDecimal(item.quantity);
      const p = Number(item.price) || 0;
      const d = Number(item.discount) || 0;
      const lineTotal = this.financialRound((q * p) - d, 2);
      itemsSum = this.safeAdd(itemsSum, lineTotal, 2);
    });

    const netAfterDiscount = this.safeSub(itemsSum, invoiceDiscount, 2);
    const calculatedTotal = this.safeAdd(netAfterDiscount, invoiceTax, 2);
    const diff = this.financialRound(Math.abs(calculatedTotal - (declaredTotal || 0)), 2);

    const isBalanced = diff <= 0.01; // التسامح الفلسي المالي الدولي

    return {
      isBalanced,
      calculatedTotal,
      itemsSum,
      difference: diff,
      message: isBalanced 
        ? '✓ الفاتورة متطابقة ومتوازنة محاسبياً بنسبة 100%' 
        : `⚠️ فارق عدم توازن في الفاتورة بمقدار ${diff} ر.ي (الإجمالي المحسوب: ${calculatedTotal}، الإجمالي المعلن: ${declaredTotal})`
    };
  }

  /**
   * تدقيق احتساب صافي الراتب وكشف المرتبات (Payroll Reconciliation)
   */
  public static verifyPayrollBalance(payroll: {
    baseSalary: number;
    bonuses?: number;
    advances?: number;
    deductions?: number;
    latenessMinutes?: number;
    absenceDays?: number;
    damagedCargo?: number;
    declaredNet: number;
    workingHoursPerDay?: number;
  }): {
    isBalanced: boolean;
    expectedNet: number;
    latenessDeduction: number;
    absenceDeduction: number;
    difference: number;
    message: string;
  } {
    const base = Number(payroll.baseSalary) || 0;
    const bonuses = Number(payroll.bonuses) || 0;
    const advances = Number(payroll.advances) || 0;
    const deductions = Number(payroll.deductions) || 0;
    const damaged = Number(payroll.damagedCargo) || 0;

    // Lateness deduction by minutes
    const latenessDed = this.calculateLatenessDeduction(
      base, 
      payroll.latenessMinutes || 0, 
      payroll.workingHoursPerDay || 8
    );

    // Absence deduction (base / 30 * absenceDays)
    const absenceDays = Number(payroll.absenceDays) || 0;
    const absenceDed = this.financialRound((base / 30) * absenceDays, 2);

    const totalEarnings = this.safeAdd(base, bonuses, 2);
    const totalDeductions = this.safeSum([advances, deductions, latenessDed, absenceDed, damaged], 2);
    const expectedNet = this.safeSub(totalEarnings, totalDeductions, 2);

    const diff = this.financialRound(Math.abs(expectedNet - (payroll.declaredNet || 0)), 2);
    const isBalanced = diff <= 0.01;

    return {
      isBalanced,
      expectedNet,
      latenessDeduction: latenessDed,
      absenceDeduction: absenceDed,
      difference: diff,
      message: isBalanced
        ? '✓ مسير الرواتب متطابق رياضياً'
        : `⚠️ فارق في مسير الراتب بمقدار ${diff} (المتوقع: ${expectedNet}، المسجل: ${payroll.declaredNet})`
    };
  }
}
