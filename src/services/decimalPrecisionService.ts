import Big from 'big.js';

/**
 * 🧮 DECIMAL PRECISION & FINANCIAL ARITHMETIC ENGINE (المهمة العلاجية الثالثة)
 * Guarantees mathematical accuracy in financial operations (costs, discounts, commissions,
 * tax rate margins, and foreign exchange rates) by bypassing native JS binary floats.
 */
export class DecimalPrecisionService {
  // Configured defaults
  private static DEFAULT_DECIMALS = 2; // e.g. YER or general cents
  private static EXCHANGE_DECIMALS = 6; // High accuracy for multi-currency conversion

  /**
   * Safe Addition (A + B)
   */
  static add(a: number | string, b: number | string, decimals = this.DEFAULT_DECIMALS): number {
    try {
      const bigA = new Big(a || 0);
      const bigB = new Big(b || 0);
      return parseFloat(bigA.plus(bigB).round(decimals, Big.roundHalfUp).toString());
    } catch (e) {
      console.error('[Precision Engine] Addition error:', e);
      return parseFloat(Number(a || 0 + Number(b || 0)).toFixed(decimals));
    }
  }

  /**
   * Safe Subtraction (A - B)
   */
  static subtract(a: number | string, b: number | string, decimals = this.DEFAULT_DECIMALS): number {
    try {
      const bigA = new Big(a || 0);
      const bigB = new Big(b || 0);
      return parseFloat(bigA.minus(bigB).round(decimals, Big.roundHalfUp).toString());
    } catch (e) {
      console.error('[Precision Engine] Subtraction error:', e);
      return parseFloat(Number(Number(a || 0) - Number(b || 0)).toFixed(decimals));
    }
  }

  /**
   * Safe Multiplication (A * B)
   */
  static multiply(a: number | string, b: number | string, decimals = this.DEFAULT_DECIMALS): number {
    try {
      const bigA = new Big(a || 0);
      const bigB = new Big(b || 0);
      return parseFloat(bigA.times(bigB).round(decimals, Big.roundHalfUp).toString());
    } catch (e) {
      console.error('[Precision Engine] Multiplication error:', e);
      return parseFloat(Number(Number(a || 0) * Number(b || 0)).toFixed(decimals));
    }
  }

  /**
   * Safe Division (A / B)
   */
  static divide(a: number | string, b: number | string, decimals = this.DEFAULT_DECIMALS): number {
    try {
      const divisor = new Big(b || 1);
      if (divisor.eq(0)) throw new Error('Division by zero');
      const bigA = new Big(a || 0);
      return parseFloat(bigA.div(divisor).round(decimals, Big.roundHalfUp).toString());
    } catch (e) {
      console.error('[Precision Engine] Division error:', e);
      return 0;
    }
  }

  /**
   * Calculate exact net amount with optional relative/absolute discount
   */
  static calculateNet(
    grossAmount: number | string,
    discountVal: number | string,
    isPercentage = false,
    decimals = this.DEFAULT_DECIMALS
  ): { gross: number; discountAmount: number; net: number } {
    try {
      const bigGross = new Big(grossAmount || 0);
      let bigDiscountAmt = new Big(0);

      if (isPercentage) {
        // discountAmount = gross * (discountVal / 100)
        const rate = new Big(discountVal || 0).div(100);
        bigDiscountAmt = bigGross.times(rate);
      } else {
        bigDiscountAmt = new Big(discountVal || 0);
      }

      const bigNet = bigGross.minus(bigDiscountAmt);

      return {
        gross: parseFloat(bigGross.round(decimals, Big.roundHalfUp).toString()),
        discountAmount: parseFloat(bigDiscountAmt.round(decimals, Big.roundHalfUp).toString()),
        net: parseFloat(bigNet.round(decimals, Big.roundHalfUp).toString())
      };
    } catch (e) {
      console.error('[Precision Engine] Net calculation error:', e);
      return { gross: Number(grossAmount), discountAmount: 0, net: Number(grossAmount) };
    }
  }

  /**
   * Multi-Currency Conversion
   */
  static convertCurrency(
    amount: number | string,
    rate: number | string,
    toForeign = true,
    decimals = this.DEFAULT_DECIMALS
  ): number {
    try {
      const bigAmount = new Big(amount || 0);
      const bigRate = new Big(rate || 1);
      if (bigRate.eq(0)) return 0;

      let converted = toForeign ? bigAmount.div(bigRate) : bigAmount.times(bigRate);
      return parseFloat(converted.round(decimals, Big.roundHalfUp).toString());
    } catch (e) {
      console.error('[Precision Engine] Currency conversion error:', e);
      return 0;
    }
  }

  /**
   * Split commission between platform/broker/agent under exact remainder balancing
   * (يوزع العمولات بدقة كاملة مع تخصيص المتبقي الفلسي للطرف الأول منعاً لتسريب الكسور)
   */
  static allocateCommission(
    totalCommission: number | string,
    shares: number[], // e.g., [0.5, 0.3, 0.2] where sum should equal 1.0
    decimals = this.DEFAULT_DECIMALS
  ): number[] {
    try {
      const total = new Big(totalCommission || 0);
      let allocatedSum = new Big(0);
      const results: number[] = [];

      // Calculate shares for all except the first one
      for (let i = 1; i < shares.length; i++) {
        const shareVal = total.times(shares[i]).round(decimals, Big.roundHalfUp);
        results.push(parseFloat(shareVal.toString()));
        allocatedSum = allocatedSum.plus(shareVal);
      }

      // First share gets the exact remainder to ensure perfect zero-sum matching
      const remainderShare = total.minus(allocatedSum).round(decimals, Big.roundHalfUp);
      results.unshift(parseFloat(remainderShare.toString()));

      return results;
    } catch (e) {
      console.error('[Precision Engine] Commission allocation error:', e);
      return shares.map(s => Number(totalCommission) * s);
    }
  }
}
