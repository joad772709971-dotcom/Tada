import { FinancialMath } from './financialMath';

export type CurrencyCode = 'YER' | 'SAR' | 'USD';

export interface LedgerEntry {
    accountId: string;
    currency: CurrencyCode;
    debit: number;   // مدين
    credit: number;  // دائن
}

export interface TransactionPayload {
    transactionId: string;
    timestamp: string;
    entries: LedgerEntry[];
}

export class LedgerEngine {
    public static validateAndCommit(transaction: TransactionPayload): { success: boolean; message: string } {
        const currencyBalances: Record<CurrencyCode, number> = { YER: 0, SAR: 0, USD: 0 };

        // فحص وعزل الحسابات لكل عملة على حدة
        for (const entry of transaction.entries) {
            const amountDiff = FinancialMath.subtract(entry.debit, entry.credit);
            currencyBalances[entry.currency] = FinancialMath.toFloat(
                FinancialMath.add(currencyBalances[entry.currency], amountDiff)
            );
        }

        // التحقق المطلق: يجب أن يكون صافي الفارق لكل عملة يساوي صفر تماماً
        for (const currency in currencyBalances) {
            const balance = currencyBalances[currency as CurrencyCode];
            if (balance !== 0) {
                return {
                    success: false,
                    message: `فشل الحفظ المالي! القيد غير متوازن في عملة (${currency}). الفارق المكتشف: ${balance} وحدة. تم رفض المعاملة فوراً.`
                };
            }
        }

        // إذا نجح الفحص، يتم الترحيل لقاعدة البيانات والسيرفر
        return { success: true, message: "تم التحقق والتوازن بنجاح. جاري الترحيل الآمن للدفاتر والمقاصة." };
    }
}
