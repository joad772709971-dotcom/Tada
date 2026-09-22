import { DecimalPrecisionService } from '../services/decimalPrecisionService';

export type CurrencyCode = 'YER' | 'SAR' | 'USD';

export class FinancialMath {
    private static readonly SCALE = 10000; // تثبيت 4 خانات عشرية داخلياً للمطابقة المطلقة

    private static getSafeNum(val: any): number {
        if (val === null || val === undefined || val === '') return 0;
        const parsed = typeof val === 'number' ? val : parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    }

    // جمع آمن بدون فواصل عائمة
    public static add(amount1: number, amount2: number): number {
        return DecimalPrecisionService.add(this.getSafeNum(amount1), this.getSafeNum(amount2), 4);
    }

    // طرح آمن
    public static subtract(amount1: number, amount2: number): number {
        return DecimalPrecisionService.subtract(this.getSafeNum(amount1), this.getSafeNum(amount2), 4);
    }

    // ضرب مأمن (مثال: حساب الأرباح بناءً على نسبة المهندس اليومية أو ضرب الكميات في الأسعار)
    public static multiply(amount: number, factor: number): number {
        return DecimalPrecisionService.multiply(this.getSafeNum(amount), this.getSafeNum(factor), 4);
    }

    // قسمة عكسية دقيقة جداً لمعالج الاستيراد (Import Wizard) لحساب سعر الوحدة من الإجمالي
    public static divide(total: number, divisor: number): number {
        const d = this.getSafeNum(divisor);
        if (d === 0) throw new Error("Financial Division by zero is strictly prohibited.");
        return DecimalPrecisionService.divide(this.getSafeNum(total), d, 4);
    }

    // تحويل العملة مع الاحتفاظ بالفواضل العكسية
    public static convertCurrency(amount: number, rate: number): number {
        return this.multiply(amount, rate);
    }

    /**
     * Safe financial value conversion utility
     */
    public static toFloat(val: any): number {
        return this.getSafeNum(val);
    }

    /**
     * Multi-Currency journal balancing validation check
     */
    public static verifyDoubleEntryLedger(
        journalLines: { accountId: string; debit: number | string; credit: number | string; currency: string }[]
    ): { 
        balanced: boolean; 
        errors: string[]; 
        balances: Record<string, { totalDebits: string; totalCredits: string; variance: string }> 
    } {
        const balances: Record<string, { totalDebits: number; totalCredits: number }> = {};

        journalLines.forEach((line) => {
            const cur = (line.currency || 'YER').toUpperCase();
            if (!balances[cur]) {
                balances[cur] = { totalDebits: 0, totalCredits: 0 };
            }
            balances[cur].totalDebits = this.add(balances[cur].totalDebits, this.getSafeNum(line.debit));
            balances[cur].totalCredits = this.add(balances[cur].totalCredits, this.getSafeNum(line.credit));
        });

        const resultBalances: Record<string, { totalDebits: string; totalCredits: string; variance: string }> = {};
        const errors: string[] = [];
        let balanced = true;

        for (const [currency, data] of Object.entries(balances)) {
            const diff = this.subtract(data.totalDebits, data.totalCredits);
            resultBalances[currency] = {
                totalDebits: data.totalDebits.toString(),
                totalCredits: data.totalCredits.toString(),
                variance: diff.toString()
            };

            // We allow standard variance threshold of zero for absolute ledger matching
            if (diff !== 0) {
                balanced = false;
                errors.push(
                    `القيد المالي المزدوج للعملة (${currency}) غير متوازن في كشوفات الحسابات! إجمالي المدين: ${data.totalDebits.toString()}، إجمالي الدائن: ${data.totalCredits.toString()}، الفارق: ${diff.toString()}`
                );
            }
        }

        return { balanced, errors, balances: resultBalances };
    }

    /**
     * The Automated Transactions Auditor
     */
    public static reconcileLedgerWithRounding(
        items: { quantity: number | string; price: number | string; discount?: number | string; total?: number | string }[],
        footerTotal: number | string,
        currency: string
    ): {
        reconciledItems: any[];
        roundingDifference: string;
        isPerfectMatch: boolean;
    } {
        let calculatedSum = 0;

        const reconciledItems = items.map((item) => {
            try {
                const q = this.getSafeNum(item.quantity);
                const p = this.getSafeNum(item.price);
                const d = this.getSafeNum(item.discount);
                
                // calculated row = (quantity * price) - discount
                const rowTotal = this.subtract(this.multiply(q, p), d);
                calculatedSum = this.add(calculatedSum, rowTotal);

                return {
                    ...item,
                    total: rowTotal,
                    calculatedTotal: rowTotal.toString()
                };
            } catch (err) {
                const fallbackTotal = this.getSafeNum(item.total);
                return {
                    ...item,
                    total: fallbackTotal,
                    calculatedTotal: fallbackTotal.toString()
                };
            }
        });

        const expectedTotal = this.getSafeNum(footerTotal);
        const roundingDiff = this.subtract(expectedTotal, calculatedSum);

        return {
            reconciledItems,
            roundingDifference: roundingDiff.toString(),
            isPerfectMatch: roundingDiff === 0
        };
    }
}
