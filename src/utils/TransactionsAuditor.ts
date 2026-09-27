import { FinancialMath } from './financialMath';
import { CurrencyCode, LedgerEntry } from './LedgerValidation';

export class TransactionsAuditor {
    private static readonly ROUNDING_ACCOUNT_ID = "ACC-EXCHANGE-ROUNDING-001";

    public static reconcileRowItems(
        calculatedTotalFromRows: number, 
        footerDeclaredTotal: number, 
        targetCurrency: CurrencyCode,
        entries: LedgerEntry[]
    ): LedgerEntry[] {
        
        // حساب الفارق الفعلي بين مجموع السطور والإجمالي الظاهر أسفل الشاشة
        const discrepancy = FinancialMath.subtract(footerDeclaredTotal, calculatedTotalFromRows);

        if (discrepancy === 0) {
            return entries; // الحسابات مطابقة تماماً، لا حاجة للتدخل
        }

        // إذا وجد فارق (حتى لو كان 1 ريال يمني أو كسر بسيط)، يتم معالجته آلياً وضخه في حساب فوارق التقريب
        const adjustmentEntry: LedgerEntry = {
            accountId: this.ROUNDING_ACCOUNT_ID,
            currency: targetCurrency,
            debit: discrepancy > 0 ? discrepancy : 0,
            credit: discrepancy < 0 ? Math.abs(discrepancy) : 0
        };

        console.warn(`[تنبيه التدقيق] تم رصد فارق تقريب بقيمة ${discrepancy} ${targetCurrency}. تم إنتاج قيد تسوية تلقائي لضمان التوازن.`);
        return [...entries, adjustmentEntry];
    }
}
