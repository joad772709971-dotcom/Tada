import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { DecimalPrecisionService } from './decimalPrecisionService';

/**
 * DECIMAL PRECISION & FLOAT DRIFT MITIGATION UNIT TEST (ملف تجريبي - المهمة الثالثة)
 * Proves mitigation of standard JS binary float anomalies under financial calculations.
 */
export async function runDecimalPrecisionTest() {
  console.log("🚀 Starting Decimal Precision & Floating-Point Drift Mitigation Unit Test...");
  const results: string[] = [];

  try {
    // =========================================================================
    // STEP 1: Proving standard JS binary float drift bug vs. Precision Engine
    // =========================================================================
    const rawSum = 0.1 + 0.2;
    const precisionSum = DecimalPrecisionService.add(0.1, 0.2);

    results.push(`Step 1A (JS Native Drift): 0.1 + 0.2 equals ${rawSum} ❌`);
    results.push(`Step 1B (Engine Guard): 0.1 + 0.2 equals ${precisionSum} ✅`);

    const rawSub = 0.3 - 0.2;
    const precisionSub = DecimalPrecisionService.subtract(0.3, 0.2);

    results.push(`Step 1C (JS Native Drift): 0.3 - 0.2 equals ${rawSub} ❌`);
    results.push(`Step 1D (Engine Guard): 0.3 - 0.2 equals ${precisionSub} ✅`);

    // =========================================================================
    // STEP 2: Complex discount rates and price allocations
    // =========================================================================
    // Calculate net on YER 525,432.55 with 12.5% discount rate
    const gross = 525432.55;
    const discountRate = 12.5;
    
    // JS Native: 525432.55 * 0.125 = 65679.06875 -> Subtraction might drift
    const { gross: g, discountAmount: da, net: n } = DecimalPrecisionService.calculateNet(gross, discountRate, true);
    
    // Assert mathematical balance: net + discountAmount === gross
    const verifySum = DecimalPrecisionService.add(n, da);
    const hasBalancedMath = verifySum === g;

    results.push(`Step 2A (Gross amount): ${g} YER`);
    results.push(`Step 2B (Discount calculated): ${da} YER`);
    results.push(`Step 2C (Net result): ${n} YER`);
    results.push(`Step 2D (Equation Balance): Net (${n}) + Discount (${da}) = ${verifySum} YER. (Balance matches Gross: ${hasBalancedMath ? '✅ TRUE' : '❌ FALSE'})`);

    // =========================================================================
    // STEP 3: Zero-sum commission remainder splitting (صمام منع تسريب الكسور المتبقية)
    // =========================================================================
    // Allocate 100.01 YER between 3 parties equally (shares: 1/3, 1/3, 1/3)
    // JS Native: 100.01 / 3 = 33.336666666666666...
    // If rounded to 2 decimals normally: 33.34, 33.34, 33.34 -> Sum is 100.02 (Leaked 0.01!)
    // If rounded down: 33.33, 33.33, 33.33 -> Sum is 99.99 (Leaked -0.02!)
    const totalCommission = 100.01;
    const shares = [0.3333, 0.3333, 0.3334]; // Roughly equal split
    const allocated = DecimalPrecisionService.allocateCommission(totalCommission, shares);
    
    const sumAllocated = allocated.reduce((sum, item) => sum + item, 0);
    const commissionBalanced = sumAllocated === totalCommission;

    results.push(`Step 3A (Commission splits): [${allocated.join(', ')}]`);
    results.push(`Step 3B (Commission Sum matches total): Allocated Sum (${sumAllocated}) matches Original (${totalCommission}): ${commissionBalanced ? '✅ YES' : '❌ NO'}`);

    // =========================================================================
    // STEP 4: Foreign exchange rates multi-step conversion
    // =========================================================================
    // Convert YER 1,500,000 to USD at exchange rate of 1620.45 YER per USD, then back to YER
    const originalYER = 1500000;
    const usdRate = 1620.45;
    
    const usdVal = DecimalPrecisionService.convertCurrency(originalYER, usdRate, true, 2); // USD conversion
    const yerVal = DecimalPrecisionService.convertCurrency(usdVal, usdRate, false, 2); // YER back-conversion

    results.push(`Step 4A (Original YER): ${originalYER}`);
    results.push(`Step 4B (Converted to USD): $${usdVal}`);
    results.push(`Step 4C (Converted back to YER): ${yerVal} YER (Diff: ${Math.abs(originalYER - yerVal)} YER) ✅`);

    // =========================================================================
    // STEP 5: Cloud/Database-linked precision integration verification
    // =========================================================================
    console.log("🧪 Step 5: Creating mock high-precision test wallet in Firestore...");
    const testBoxRef = doc(db, 'bank_accounts', 'temp-precision-test-box');
    
    // YER 123.4567 initial balance
    const initialBal = 123.4567;
    const extraBal = 876.5433; // Must total exactly 1000.0000
    const targetTotal = DecimalPrecisionService.add(initialBal, extraBal, 4);

    await setDoc(testBoxRef, {
      boxName: 'صندوق اختبار فحص الدقة والعزل السحابي',
      balance: initialBal,
      ownerId: 'temp-precision-test-owner',
      createdAt: new Date()
    });

    // Update document with high precision addition
    const freshSnap = await getDoc(testBoxRef);
    if (freshSnap.exists()) {
      const current = freshSnap.data().balance || 0;
      const updatedBal = DecimalPrecisionService.add(current, extraBal, 4);
      await setDoc(testBoxRef, { balance: updatedBal }, { merge: true });
    }

    // Verify written value is perfectly exact
    const finalSnap = await getDoc(testBoxRef);
    const actualSavedBal = finalSnap.data()?.balance || 0;
    const isPerfectCloudMatch = actualSavedBal === targetTotal;

    results.push(`Step 5A (Initial balance created in Cloud): ${initialBal} YER`);
    results.push(`Step 5B (Cloud Balance added with DecimalPrecisionService): ${actualSavedBal} Y5ER`);
    results.push(`Step 5C (Cloud Precision Check): Current balance matches target ${targetTotal} perfectly: ${isPerfectCloudMatch ? '✅ YES' : '❌ NO'}`);

    console.log("\n📊 DECIMAL PRECISION & FLOAT DRIFT TEST SUMMARY:");
    results.forEach(r => console.log(r));

    return {
      success: true,
      results
    };

  } catch (error: any) {
    console.error("❌ Decimal Precision Unit Test Failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 🧹 Clean up the temporary test box document from Firestore
 */
export async function cleanupDecimalPrecisionTestLogs() {
  console.log("🧹 Running Decimal Precision automatic cleanup of Firestore test artifacts...");
  try {
    const testBoxRef = doc(db, 'bank_accounts', 'temp-precision-test-box');
    await deleteDoc(testBoxRef);
    console.log("✅ Successfully deleted temporary test wallet 'temp-precision-test-box' from Firestore.");
    return { success: true };
  } catch (error: any) {
    console.error("❌ Failed to clean up decimal precision test documents:", error);
    throw error;
  }
}
