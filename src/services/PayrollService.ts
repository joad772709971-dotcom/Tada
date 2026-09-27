import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, getDocs, query, where, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { StrictPrecisionEngine } from './StrictPrecisionEngine';

export interface EmployeePayroll {
  userId: string;
  userName: string;
  baseSalary: number;
  bonuses: number;
  advances: number;
  drawings: number;
  absenceDays: number;
  damagedCargoCost: number; // قيمة التالف المحمل عليه من المخزن
  latenessMinutes?: number; // دقائق التأخير المطلقة (Absolute Minutes)
  overtimeMinutes?: number; // دقائق الإضافي المطلقة
  workingHoursPerDay?: number; // ساعات الدوام اليومية (الافتراضي 8 ساعات)
}

/**
 * دالة احتساب صافي الراتب النهائي وإقفال الشهر لـ JAM System Pro
 * تطبق معايير الدقة المطلقة (Strict Time & Financial Precision Engine):
 * المعادلة: (الأساسي + المكافآت + الإضافي) - (السُلف + الغياب المحسوب يومياً + خصم دقائق التأخير + السحب + قيمة التالف)
 * خصم التأخير بدقة 100%: (الراتب اليومي ÷ ساعات الدوام ÷ 60) × دقائق التأخير
 */
export function calculateNetSalary(payroll: EmployeePayroll): number {
  const base = Number(payroll.baseSalary) || 0;
  const workHours = Number(payroll.workingHoursPerDay) || 8;

  // 1. حساب خصم أيام الغياب بدقة
  const absenceDeduction = StrictPrecisionEngine.financialRound((base / 30) * (payroll.absenceDays || 0), 2);
  
  // 2. حساب خصم دقائق التأخير المطلقة (Absolute Minutes Precision)
  const latenessDeduction = StrictPrecisionEngine.calculateLatenessDeduction(
    base,
    payroll.latenessMinutes || 0,
    workHours,
    30
  );

  // 3. حساب العمل الإضافي بالدقائق المطلقة
  const overtimePay = StrictPrecisionEngine.calculateOvertimePay(
    base,
    payroll.overtimeMinutes || 0,
    1.5,
    workHours
  );

  // 4. إجمالي المستحقات (مع حماية الفواصل العائمة)
  const totalEarnings = StrictPrecisionEngine.safeAdd(
    StrictPrecisionEngine.safeAdd(base, payroll.bonuses || 0, 2),
    overtimePay,
    2
  );
  
  // 5. إجمالي الاستقطاعات والخصومات والتالف
  const totalDeductions = StrictPrecisionEngine.safeSum([
    payroll.advances || 0,
    payroll.drawings || 0,
    absenceDeduction,
    latenessDeduction,
    payroll.damagedCargoCost || 0
  ], 2);

  // 6. صافي الراتب النهائي المقرب محاسبياً
  const netSalary = StrictPrecisionEngine.safeSub(totalEarnings, totalDeductions, 2);
  
  return netSalary;
}

/**
 * فحص مطابقة وتوازن كشف الراتب
 */
export function verifyPayrollAudit(payroll: EmployeePayroll, declaredNet: number) {
  return StrictPrecisionEngine.verifyPayrollBalance({
    baseSalary: payroll.baseSalary,
    bonuses: payroll.bonuses,
    advances: payroll.advances + payroll.drawings,
    deductions: 0,
    latenessMinutes: payroll.latenessMinutes,
    absenceDays: payroll.absenceDays,
    damagedCargo: payroll.damagedCargoCost,
    declaredNet: declaredNet,
    workingHoursPerDay: payroll.workingHoursPerDay || 8
  });
}

/**
 * تحميل تكلفة المادة التالفة بسعر التكلفة على الموظف المتسبب مباشرة كخصم من الراتب
 */
export async function chargeDamageToEmployee(userId: string, totalCost: number, itemName: string, quantity: number) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error("المستخدم أو الموظف المحدد غير موجود في النظام.");
    }

    // قم بتحديث مبلغ التالف المتراكم المحمل على الموظف في مستند مستخدم Firebase Firestore
    await updateDoc(userRef, {
      damagedCargoCost: increment(totalCost),
      updatedAt: serverTimestamp()
    });

    console.log(`Successfully charged ${totalCost} YER to employee ${userId} for ${quantity}x ${itemName}`);
  } catch (error) {
    console.error('Error in chargeDamageToEmployee:', error);
    throw error;
  }
}
