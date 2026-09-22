import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Coins, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Printer, 
  Sparkles, 
  Award, 
  DollarSign,
  Heart,
  Briefcase,
  FileText,
  Calendar,
  Clock,
  CalendarOff,
  Sun
} from 'lucide-react';
import { AutomatedJournalEngine } from '../services/AutomatedJournalEngine';
import { postPettyCashOrSalaryToLedger } from '../services/MaintenanceFinancialService';
import { StrictPrecisionEngine } from '../services/StrictPrecisionEngine';

interface Employee {
  id: string;
  name: string;
  role: string;
  basicSalaryYER: number;
  annualLeaveEntitlement?: number; // entitlement days e.g. 21 days
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  basicSalaryYER: number;
  bonusAmountYER: number;
  bonusReason: string;
  deductionAmountYER: number;
  deductionReason: string;
  advanceAmountYER: number;
  netSalaryYER: number;
  status: 'paid' | 'pending';
  payoutDate?: string;
  unpaidLeaveDays?: number;
}

interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'paid_holiday' | 'paid_vacation' | 'unpaid_leave' | 'sick_leave';
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  dailySalaryYER: number;
  totalDeductionYER: number;
  isPaid: boolean;
  recordedAt: string;
}

export function PayrollDashboard() {
  // Beep generator for audio feedback
  const playBeep = (freq = 820, duration = 0.1) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Audio disabled until user gesture');
    }
  };

  // Static list of employees
  const [employees, setEmployees] = useState<Employee[]>([
    { id: 'EMP-01', name: 'طه الهندي', role: 'فني الصيانة والمعدات', basicSalaryYER: 180000 },
    { id: 'EMP-02', name: 'م. عبدالله الريمي', role: 'مشرف قسم الجودة', basicSalaryYER: 250000 },
    { id: 'EMP-03', name: 'سالم المطري', role: 'مسؤول خط الفرز والتعبئة', basicSalaryYER: 160000 },
    { id: 'EMP-04', name: 'سلطان ردمان', role: 'مسؤول خدمات المخازن والنقل', basicSalaryYER: 130000 },
    { id: 'EMP-05', name: 'جميل حمران', role: 'فني تشغيل وصيانة', basicSalaryYER: 145000 },
  ]);

  // Payroll slips State
  const [payrollList, setPayrollList] = useState<PayrollRecord[]>(() => {
    const saved = localStorage.getItem('erp_payroll_list_v2');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'PAY-101',
        employeeId: 'EMP-04',
        employeeName: 'سلطان ردمان',
        role: 'مسؤول خدمات المخازن والنقل',
        basicSalaryYER: 130000,
        bonusAmountYER: 15000,
        bonusReason: 'إنتاجية استثنائية وانضباط في المواعيد',
        deductionAmountYER: 0,
        deductionReason: '',
        advanceAmountYER: 20000, // Advance YER
        netSalaryYER: 125000, // 130K + 15K - 20K
        status: 'paid',
        payoutDate: '2026-05-25'
      },
      {
        id: 'PAY-102',
        employeeId: 'EMP-02',
        employeeName: 'م. عبدالله الريمي',
        role: 'مشرف قطاع أمهات وبياض',
        basicSalaryYER: 250000,
        bonusAmountYER: 25000,
        bonusReason: 'كفاءة عزل الفرازات والبيض والالتزام بالإنتاج المخطط له',
        deductionAmountYER: 10000,
        deductionReason: 'تأخر عن الوردية الصباحية بدون عذر كافي',
        advanceAmountYER: 0,
        netSalaryYER: 265000, // 250K + 25K - 10K
        status: 'pending'
      }
    ];
  });

  // Active sub-view tab
  const [activeTab, setActiveTab] = useState<'paysheet' | 'rewards_calc' | 'advances_deductions' | 'holidays_leaves'>('paysheet');
  const [feedback, setFeedback] = useState('');

  // Form states: Leave and Official Holidays Engine
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>(() => {
    const saved = localStorage.getItem('erp_leave_records_v1');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'LV-101',
        employeeId: 'EMP-01',
        employeeName: 'طه الهندي',
        leaveType: 'paid_holiday',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        daysCount: 3,
        reason: 'إجازة عيد العمال الرسمية (مدفوعة الأجر)',
        dailySalaryYER: 6000,
        totalDeductionYER: 0,
        isPaid: true,
        recordedAt: '2026-05-01'
      },
      {
        id: 'LV-102',
        employeeId: 'EMP-03',
        employeeName: 'سالم المطري',
        leaveType: 'unpaid_leave',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        daysCount: 2,
        reason: 'إجازة اضطرارية بدون أجر (ظروف شخصية)',
        dailySalaryYER: 5333,
        totalDeductionYER: 10666,
        isPaid: false,
        recordedAt: '2026-05-10'
      }
    ];
  });

  const [leaveEmpId, setLeaveEmpId] = useState('EMP-01');
  const [leaveType, setLeaveType] = useState<'paid_holiday' | 'paid_vacation' | 'unpaid_leave' | 'sick_leave'>('paid_holiday');
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveDays, setLeaveDays] = useState<number>(1);
  const [leaveReason, setLeaveReason] = useState('إجازة رسمية اعتادية');

  useEffect(() => {
    localStorage.setItem('erp_leave_records_v1', JSON.stringify(leaveRecords));
  }, [leaveRecords]);

  const handleAddLeaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === leaveEmpId);
    if (!emp) return;

    const days = Math.max(1, Number(leaveDays) || 1);
    const dailyRate = Math.round(emp.basicSalaryYER / 30);
    const isPaid = leaveType === 'paid_holiday' || leaveType === 'paid_vacation';
    const totalDeduction = isPaid ? 0 : Math.round(dailyRate * days);

    const newRecord: LeaveRecord = {
      id: `LV-${Date.now().toString().slice(-4)}`,
      employeeId: emp.id,
      employeeName: emp.name,
      leaveType,
      startDate: leaveStartDate,
      endDate: leaveStartDate, // single day or span
      daysCount: days,
      reason: leaveReason.trim() || 'إجازة رسمية/عطلة معتمدة',
      dailySalaryYER: dailyRate,
      totalDeductionYER: totalDeduction,
      isPaid,
      recordedAt: new Date().toISOString().split('T')[0]
    };

    setLeaveRecords(prev => [newRecord, ...prev]);

    // Automatically update payroll record for unpaid leave deduction!
    if (!isPaid && totalDeduction > 0) {
      const existingIndex = payrollList.findIndex(p => p.employeeId === emp.id && p.status === 'pending');
      const deductionNote = `خصم إجازة بدون أجر (${days} أيام)`;

      if (existingIndex > -1) {
        setPayrollList(prev => prev.map((p, idx) => {
          if (idx === existingIndex) {
            const newDed = p.deductionAmountYER + totalDeduction;
            const newNet = p.basicSalaryYER + p.bonusAmountYER - newDed - p.advanceAmountYER;
            return {
              ...p,
              deductionAmountYER: newDed,
              deductionReason: p.deductionReason ? `${p.deductionReason} | ${deductionNote}` : deductionNote,
              netSalaryYER: newNet,
              unpaidLeaveDays: (p.unpaidLeaveDays || 0) + days
            };
          }
          return p;
        }));
      } else {
        const net = emp.basicSalaryYER - totalDeduction;
        const newPayroll: PayrollRecord = {
          id: 'PAY-' + Math.floor(100 + Math.random() * 900),
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.role,
          basicSalaryYER: emp.basicSalaryYER,
          bonusAmountYER: 0,
          bonusReason: '',
          deductionAmountYER: totalDeduction,
          deductionReason: deductionNote,
          advanceAmountYER: 0,
          netSalaryYER: net,
          status: 'pending',
          unpaidLeaveDays: days
        };
        setPayrollList(prev => [newPayroll, ...prev]);
      }
    }

    playBeep(1050, 0.2);
    setFeedback(`🏖️ تم تسجيل الإجازة للموظف [${emp.name}] ${!isPaid ? `وخصم ${totalDeduction.toLocaleString()} ر.ي من كشف الراتب تلقائياً.` : 'وهي إجازة مدفوعة الأجر بالكامل.'}`);
    setTimeout(() => setFeedback(''), 5000);
  };

  // Form states: Rewards System Calculator
  const [selectedEmpId, setSelectedEmpId] = useState('EMP-04');
  const [mortalityRate, setMortalityRate] = useState<string>('0.5'); // Flock mortality rate (automatic reward calculation)
  const [eggProductivity, setEggProductivity] = useState<string>('98'); // in %
  const [calculatedBonus, setCalculatedBonus] = useState<number>(15000);
  const [calcReasonOutput, setCalcReasonOutput] = useState<string>('');

  // Form states: Advances and Deductions Log
  const [advEmpId, setAdvEmpId] = useState('EMP-01');
  const [advAmount, setAdvAmount] = useState('20000');
  const [dedAmount, setDedAmount] = useState('0');
  const [dedReason, setDedReason] = useState('تأخير أو غياب غير معذور');

  // Form states: Absolute Minutes Lateness Calculator (الدقائق المطلقة بدقة 100%)
  const [latEmpId, setLatEmpId] = useState('EMP-01');
  const [latMinutes, setLatMinutes] = useState('15');
  const [latWorkHours, setLatWorkHours] = useState('8');

  const selectedLatEmp = employees.find(e => e.id === latEmpId);
  const latMinRate = selectedLatEmp 
    ? StrictPrecisionEngine.calculateMinuteRate(selectedLatEmp.basicSalaryYER, Number(latWorkHours) || 8) 
    : 0;
  const latExactDeduction = selectedLatEmp 
    ? StrictPrecisionEngine.calculateLatenessDeduction(selectedLatEmp.basicSalaryYER, Number(latMinutes) || 0, Number(latWorkHours) || 8) 
    : 0;

  const handleApplyMinuteDeductionToForm = () => {
    setAdvEmpId(latEmpId);
    setDedAmount(latExactDeduction.toString());
    setDedReason(`تأخير دوام بالدقيقة المطلقة (${latMinutes} دقيقة) - استقطاع معتمد دقيق`);
    playBeep(990, 0.15);
    setFeedback(`✓ تم ضبط مبلغ الاستقطاع الدقيق: ${latExactDeduction.toLocaleString()} ر.ي (${latMinutes} دقيقة)`);
    setTimeout(() => setFeedback(''), 4000);
  };

  // Trigger auto rewards estimation
  useEffect(() => {
    const mort = parseFloat(mortalityRate) || 0;
    const prod = parseFloat(eggProductivity) || 0;
    let computedBonus = 0;
    let reason = '';

    if (mort < 1.0 && mort > 0) {
      computedBonus += 15050;
      reason += 'مكافأة ممتازة لانخفاض نسبة نفوق القطيع عن 1% ';
    } else if (mort < 2.0 && mort > 0) {
      computedBonus += 7500;
      reason += 'مكافأة تشجيعية لنفوق مقبول تحت 2% ';
    }

    if (prod >= 95) {
      computedBonus += 15000;
      reason += ' + حافز كفاءة إنتاج البيض المفرز (أعلى من 95%)';
    } else if (prod >= 90) {
      computedBonus += 8000;
      reason += ' + حافز إنتاج بيض بياض جيد (90-95%)';
    }

    if (computedBonus === 0) {
      reason = 'المعايير طبيعية أو اعتيادية (لا توجد إضافة مكافأة كفاءة إستثنائية تلقائية)';
    }

    setCalculatedBonus(computedBonus);
    setCalcReasonOutput(reason);
  }, [mortalityRate, eggProductivity]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('erp_payroll_list_v2', JSON.stringify(payrollList));
  }, [payrollList]);

  // Push Rewards to Slip
  const handleApplyCalculatedReward = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return;

    // Check if employee already has a pending or paid record for this month
    const existingIndex = payrollList.findIndex(p => p.employeeId === emp.id && p.status === 'pending');

    if (existingIndex > -1) {
      // Update existing record
      setPayrollList(prev => prev.map((p, idx) => {
        if (idx === existingIndex) {
          const newBonus = p.bonusAmountYER + calculatedBonus;
          const newNet = p.basicSalaryYER + newBonus - p.deductionAmountYER - p.advanceAmountYER;
          return {
            ...p,
            bonusAmountYER: newBonus,
            bonusReason: p.bonusReason ? `${p.bonusReason} | ${calcReasonOutput}` : calcReasonOutput,
            netSalaryYER: newNet
          };
        }
        return p;
      }));
    } else {
      // Create new record
      const net = emp.basicSalaryYER + calculatedBonus;
      const newRecord: PayrollRecord = {
        id: 'PAY-' + Math.floor(100 + Math.random() * 900),
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        basicSalaryYER: emp.basicSalaryYER,
        bonusAmountYER: calculatedBonus,
        bonusReason: calcReasonOutput,
        deductionAmountYER: 0,
        deductionReason: '',
        advanceAmountYER: 0,
        netSalaryYER: net,
        status: 'pending'
      };
      setPayrollList(prev => [newRecord, ...prev]);
    }

    playBeep(1100, 0.25);
    setFeedback(`🌟 تم منح العمال الحافز التلقائي بقيمة ${calculatedBonus.toLocaleString()} ر.ي ليكون مضافاً في مسير الرواتب.`);
    setActiveTab('paysheet');

    setTimeout(() => setFeedback(''), 5000);
  };

  // Log Advances & Deductions directly
  const handleApplyAdvancesDeductions = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === advEmpId);
    if (!emp) return;

    const adv = parseInt(advAmount, 10) || 0;
    const ded = parseInt(dedAmount, 10) || 0;

    const existingIndex = payrollList.findIndex(p => p.employeeId === emp.id && p.status === 'pending');

    if (existingIndex > -1) {
      setPayrollList(prev => prev.map((p, idx) => {
        if (idx === existingIndex) {
          const newAdv = p.advanceAmountYER + adv;
          const newDed = p.deductionAmountYER + ded;
          const newNet = p.basicSalaryYER + p.bonusAmountYER - newDed - newAdv;
          return {
            ...p,
            advanceAmountYER: newAdv,
            deductionAmountYER: newDed,
            deductionReason: ded > 0 ? (p.deductionReason ? `${p.deductionReason} | ${dedReason}` : dedReason) : p.deductionReason,
            netSalaryYER: newNet
          };
        }
        return p;
      }));
    } else {
      const net = emp.basicSalaryYER - ded - adv;
      const newRecord: PayrollRecord = {
        id: 'PAY-' + Math.floor(100 + Math.random() * 900),
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        basicSalaryYER: emp.basicSalaryYER,
        bonusAmountYER: 0,
        bonusReason: '',
        deductionAmountYER: ded,
        deductionReason: ded > 0 ? dedReason : '',
        advanceAmountYER: adv,
        netSalaryYER: net,
        status: 'pending'
      };
      setPayrollList(prev => [newRecord, ...prev]);
    }

    // Trigger automated journal voucher for deduction/error if ded > 0
    if (ded > 0) {
      const ownerId = localStorage.getItem('jam_admin_owner_id') || 'main_owner';
      AutomatedJournalEngine.postEmployeeLossOrErrorVoucher({
        ownerId,
        type: dedReason.includes('صيانة') || dedReason.includes('مهندس') ? 'engineer_repair_error' : 'employee_error',
        totalCost: ded,
        responsibilityTarget: 'single_employee',
        employeeIds: [emp.id],
        employeeNames: [emp.name],
        deductFrom: 'salary_payroll',
        itemName: dedReason || 'استقطاع أخطاء عمالة ومهندسين',
        quantity: 1,
        notes: `استقطاع راتب شهري لـ ${emp.name}: ${dedReason}`
      }).catch(err => console.warn("AutomatedJournalEngine deduction error:", err));
    }

    playBeep(920, 0.2);
    setFeedback(`💰 تم تعميد وتقييد الاستقطاعات لـ [${emp.name}]، وتوليد قيد التسوية المحاسبي بنجاح.`);
    setActiveTab('paysheet');

    setTimeout(() => setFeedback(''), 5000);
  };

  const handleDeletePayrollRecord = (id: string) => {
    playBeep(320, 0.1);
    setPayrollList(prev => prev.filter(r => r.id !== id));
  };

  const togglePayoutStatus = async (id: string) => {
    playBeep(1200, 0.15);
    const targetRecord = payrollList.find(p => p.id === id);
    if (targetRecord && targetRecord.status !== 'paid') {
      const ownerId = localStorage.getItem('jam_admin_owner_id') || 'main_owner';
      try {
        await postPettyCashOrSalaryToLedger({
          ownerId,
          amount: targetRecord.netSalaryYER,
          type: 'salary',
          description: `صرف كشف راتب شهر لـ ${targetRecord.employeeName}`,
          recipientName: targetRecord.employeeName,
          voucherNumber: targetRecord.id
        });
      } catch (err) {
        console.warn("Error posting salary to ledger:", err);
      }
    }

    setPayrollList(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status: p.status === 'paid' ? 'pending' : 'paid',
          payoutDate: p.status === 'paid' ? undefined : new Date().toISOString().substring(0, 10)
        };
      }
      return p;
    }));
  };

  // Math totals
  const totalPayrollYER = payrollList.reduce((sum, item) => sum + item.netSalaryYER, 0);
  const totalAdvancesYER = payrollList.reduce((sum, item) => sum + item.advanceAmountYER, 0);
  const totalDeductionsYER = payrollList.reduce((sum, item) => sum + item.deductionAmountYER, 0);
  const totalBonusesYER = payrollList.reduce((sum, item) => sum + item.bonusAmountYER, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col gap-6 text-right animate-fade-in" id="payroll_management_system" dir="rtl">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950 px-4 py-4 rounded-2xl border border-slate-800/85">
        <div className="flex items-center gap-3 w-full sm:w-auto text-right">
          <div className="w-12 h-12 rounded-xl bg-teal-950/60 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Users className="w-6 h-6 animate-pulse text-teal-400" />
          </div>
          <div>
            <h3 className="text-white text-base font-black flex items-center gap-1.5">
              <span>مسير الرواتب الذكي وحوافز الموظفين والعمال</span>
              <Sparkles className="w-4 h-4 text-teal-400" />
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">حساب المكافآت للإنجاز الميداني، تقييد غياب وسلفيات العمال لخصمها من صافي الاستحقاق.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-slate-900 border border-slate-800 text-teal-400 font-bold rounded-xl px-2.5 py-1">
            موارد المزرعة البشرية - الربع الثاني
          </span>
        </div>
      </div>

      {feedback && (
        <div className="bg-teal-950/60 border border-teal-500 text-teal-300 p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0 animate-bounce" />
          <span>{feedback}</span>
        </div>
      )}

      {/* THREE BENTO METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Metric 1: Total Payroll Payables */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl mt-[-20px] mr-[-20px] pointer-events-none" />
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400 text-xs font-black flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-teal-400" />
              صافي استحقاق رواتب الموظفين مسير (YER)
            </span>
            <span className="text-[10px] text-teal-400 font-mono">الخزينة المزرعية</span>
          </div>
          <div className="my-3 flex flex-col text-center justify-center">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {totalPayrollYER.toLocaleString()} ر.ي
            </span>
            <span className="text-xs text-slate-400 mt-1">
              إجمالي {payrollList.length} كشف معمد بالصندوق
            </span>
          </div>
          <div className="text-[10px] text-slate-500 bg-slate-900 p-1.5 rounded-xl text-center border border-slate-850">
            صافي المفرود من الرواتب المرفقة مع حسم السلفيات والخصومات دفترياً
          </div>
        </div>

        {/* Metric 2: Production Bonuses Given */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl mt-[-20px] ml-[-20px] pointer-events-none" />
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400 text-xs font-black flex items-center gap-1.5 text-amber-400">
              <Award className="w-4 h-4" />
              حوافز ومكافآت الإنتاج المترتبة
            </span>
            <span className="text-[10px] bg-amber-950 text-amber-400 px-1.5 rounded">كفاءة</span>
          </div>
          <div className="my-3 flex flex-col text-center justify-center">
            <span className="text-2xl font-black font-mono text-amber-400">
              +{totalBonusesYER.toLocaleString()} ر.ي
            </span>
            <span className="text-xs text-slate-400 mt-1">
              تم صرفها تلقائياً لدعم الحافز الإنتاجي والعمل الميداني
            </span>
          </div>
          <p className="text-[9.5px] text-slate-500 block text-center">
            تمنح المكافأة للعمال أصحاب المبادرة للتميز في الأداء الميداني
          </p>
        </div>

        {/* Metric 3: Active Advances Deductions */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400 text-xs font-black flex items-center gap-1.5 text-rose-400">
              <TrendingDown className="w-4 h-4" />
              مجموع السلفيات المحتسبة والخصميات
            </span>
            <span className="text-[10px] bg-rose-950 text-rose-400 px-1.5 rounded">مستقطعات</span>
          </div>
          <div className="my-2.5 text-center flex flex-col gap-1 items-center justify-center">
            <div className="text-2xl font-black font-mono text-red-400">
              -{(totalAdvancesYER + totalDeductionsYER).toLocaleString()} ر.ي
            </div>
            <p className="text-[10px] text-slate-400 font-bold">خصومات إهمال وسلف مستقطعة</p>
          </div>
          <div className="bg-slate-900 p-1.5 rounded-lg text-[9.5px] border border-slate-800 text-center text-slate-500">
            سلفيات: {totalAdvancesYER.toLocaleString()} ر.ي | خصميات غياب: {totalDeductionsYER.toLocaleString()} ر.ي
          </div>
        </div>

      </div>

      {/* MODULE SHIELD TABS REGION */}
      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => { playBeep(850, 0.1); setActiveTab('paysheet'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'paysheet' 
              ? 'bg-teal-650 bg-teal-650/90 bg-teal-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>مسير الرواتب وعرض السجل العام</span>
        </button>
        <button
          onClick={() => { playBeep(860, 0.1); setActiveTab('rewards_calc'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'rewards_calc' 
              ? 'bg-amber-600 text-slate-950 font-black shadow-md' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>مكافآت كفاءة الإنتاج (حساب أوتوماتيكي)</span>
        </button>
        <button
          onClick={() => { playBeep(870, 0.1); setActiveTab('advances_deductions'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'advances_deductions' 
              ? 'bg-rose-600 text-white shadow-md font-black' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>تسجيل سلفية عمال / خصومات جزائية</span>
        </button>
        <button
          onClick={() => { playBeep(880, 0.1); setActiveTab('holidays_leaves'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'holidays_leaves' 
              ? 'bg-cyan-600 text-white shadow-md font-black' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>سجل الإجازات الرسمية والعطلات والرصيد</span>
        </button>
      </div>

      {/* DETAILS STAGE VIEWPORTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* TAB 1: ALL PAYOUTS SLIPS & EXPORT / PRINT */}
        {activeTab === 'paysheet' && (
          <div className="lg:col-span-12 flex flex-col gap-4" id="section_payroll_slips_general">
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-white text-xs font-bold block">كشوفات استحقاق العاملين لشهر مايو 2026</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">التسويات البنكية ومطابقة الحوالات مع بنك الكريمي للخدمات المحاسبية</span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  playBeep(1200, 0.3);
                  window.print();
                }}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-teal-400" />
                <span>طباعة الكشوفات المعمدة 🖨️</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {payrollList.map(record => (
                <div key={record.id} className="bg-slate-950 p-4.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
                  
                  {/* Row Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-900 pb-2">
                    <div>
                      <span className="text-white text-xs font-black block">{record.employeeName}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{record.role} (الرقم الوظيفي: {record.id})</span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                        record.status === 'paid' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/35' : 'bg-amber-955 bg-amber-950 text-amber-400 border border-amber-900/35 animate-pulse'
                      }`} onClick={() => togglePayoutStatus(record.id)}>
                        {record.status === 'paid' ? `تم التسليم ✓ (${record.payoutDate})` : 'قيد الصرف والمطابقة'}
                      </span>

                      <button 
                        onClick={() => handleDeletePayrollRecord(record.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Salary details calculation metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-right text-slate-300">
                    <div className="bg-slate-900 p-2 rounded">
                      <span className="text-[9px] text-slate-400 block">الراتب الأساسي:</span>
                      <span className="font-mono">{record.basicSalaryYER.toLocaleString()} ر.ي</span>
                    </div>

                    <div className="bg-slate-900 p-2 rounded border border-emerald-950">
                      <span className="text-[9px] text-emerald-400 block">+ حوافز كفاءة الإنتاج:</span>
                      <span className="font-mono text-emerald-400">+{record.bonusAmountYER.toLocaleString()} ر.ي</span>
                    </div>

                    <div className="bg-slate-900 p-2 rounded text-rose-300">
                      <span className="text-[9px] text-slate-400 block">- غياب وخصومات جزائية:</span>
                      <span className="font-mono">-{record.deductionAmountYER.toLocaleString()} ر.ي</span>
                    </div>

                    <div className="bg-slate-900 p-2 rounded text-red-300">
                      <span className="text-[9px] text-slate-400 block">- سلف مستقطعة مسبقاً:</span>
                      <span className="font-mono">-{record.advanceAmountYER.toLocaleString()} ر.ي</span>
                    </div>

                    <div className="bg-slate-900 p-2.5 rounded border border-emerald-500/25 col-span-2 sm:col-span-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 block">صافي الاستحقاق المستحق:</span>
                        <span className="font-mono text-white text-sm font-black">{(record.netSalaryYER).toLocaleString()} ر.ي</span>
                      </div>
                      <span className="text-[8.5px] text-emerald-400 font-bold mt-1 inline-flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                        <span>متطابق محاسبياً بنسبة 100%</span>
                      </span>
                    </div>
                  </div>

                  {/* Rewards / Deductions justifications explanation text */}
                  {record.bonusReason && (
                    <div className="text-[10px] text-amber-400 bg-slate-900/60 p-2 rounded border border-amber-950 text-right leading-relaxed">
                      🌟 <strong>مسوغات المكافأة:</strong> {record.bonusReason}
                    </div>
                  )}

                  {record.deductionReason && (
                    <div className="text-[10px] text-red-400 bg-slate-900/60 p-2 rounded border border-red-950 text-right leading-relaxed">
                      ⚠️ <strong>سبب الاستقطاع الجزائي:</strong> {record.deductionReason}
                    </div>
                  )}

                </div>
              ))}
            </div>

          </div>
        )}

        {/* TAB 2: INCENTIVES OR BENCHMARK REWARDS CALCULATOR */}
        {activeTab === 'rewards_calc' && (
          <div className="lg:col-span-12">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 max-w-2xl mx-auto flex flex-col gap-4 text-right">
              
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Award className="w-5 h-5 text-amber-400 animate-bounce" />
                <h4 className="text-white text-sm font-black">حاسبة حوافز ومكافآت الموظفين والعمال المتميزين</h4>
              </div>

              <p className="text-slate-400 text-xs leading-relaxed">
                يقوم النظام باحتساب علاوة تشجيعية مجزية للمشرف أو الموظف إذا استطاع الحفاظ على كفاءة تشغيلية وحقق **أعلى إنتاجية أو مبيعات** هذا الشهر:
              </p>

              <form onSubmit={handleApplyCalculatedReward} className="flex flex-col gap-4">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-300 font-bold">المشرف أو العامل المستحق الحافز الفني:</label>
                  <select 
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 h-11"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">نسبة النفوق المسجلة بالقطيع (%):</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={mortalityRate}
                      onChange={(e) => setMortalityRate(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 p-2.5 rounded-lg text-xs font-mono font-bold text-white text-center focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[9.5px] text-slate-500">مستوى الأمان للأمهات: أقل من 1.2%</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">معدل كفاءة وتصفية إنتاج البيض المفرز (%):</label>
                    <input 
                      type="number"
                      value={eggProductivity}
                      onChange={(e) => setEggProductivity(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 p-2.5 rounded-lg text-xs font-mono font-bold text-white text-center focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[9.5px] text-slate-500">الإنتاجية الممتازة: أعلى من 95% طبق سليم</span>
                  </div>

                </div>

                <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-amber-400 font-black">حسبة مكافأة الكفاءة والتميز (تلقائية بنسبة النفوق):</span>
                    <span className="text-[9.5px] text-slate-500">قابلة للترحيل دفترياً</span>
                  </div>

                  <div className="font-mono text-xl font-black text-amber-400">
                    +{calculatedBonus.toLocaleString()} ر.ي
                  </div>

                  <div className="text-[10px] text-slate-300 leading-relaxed font-sans mt-1">
                    🎯 <span>سبب المكافأة:</span> {calcReasonOutput || 'المعدل منخفض جداً ولا يستحق مكافأة إضافية'}
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs py-3.5 rounded-xl cursor-pointer shadow-md transition-all active:scale-95 text-center mt-3 h-11"
                >
                  حفظ وتمليك الحافز للعامل في كشف مسير الرواتب
                </button>

              </form>

            </div>
          </div>
        )}

        {/* TAB 3: ADVANCES AND DEDUCTIONS LOGGING FORM */}
        {activeTab === 'advances_deductions' && (
          <div className="lg:col-span-12">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 max-w-2xl mx-auto flex flex-col gap-4 text-right">
              
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <TrendingDown className="w-5 h-5 text-rose-450 text-rose-400" />
                <h4 className="text-white text-sm font-black">سجل السلفيات المستقطعة والخصومات الإدارية والملاحظات</h4>
              </div>

              {/* Strict Minute Lateness Precision Engine Widget */}
              <div className="bg-slate-900/80 border border-teal-500/30 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-teal-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-teal-400" />
                    حاسبة خصم دقائق التأخير الدقيقة (Strict Time Precision Engine)
                  </span>
                  <span className="text-[10px] bg-teal-950 text-teal-300 px-2 py-0.5 rounded-full font-mono border border-teal-800/40">
                    دقة 100% بالدقيقة المطلقة
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-bold">الموظف المتأخر:</label>
                    <select
                      value={latEmpId}
                      onChange={(e) => setLatEmpId(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-bold">دقائق التأخير المطلقة:</label>
                    <input
                      type="number"
                      min="1"
                      value={latMinutes}
                      onChange={(e) => setLatMinutes(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white text-center font-mono font-bold"
                      placeholder="مثال: 15 دقيقة"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-bold">ساعات الدوام اليومية:</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={latWorkHours}
                      onChange={(e) => setLatWorkHours(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white text-center font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 gap-2">
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="text-slate-400">
                      أجر الدقيقة: <strong className="font-mono text-white">{latMinRate.toFixed(2)}</strong> ر.ي/د
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">
                      المعادلة: <span className="font-mono text-slate-300">(الراتب ÷ 30 ÷ {latWorkHours}س ÷ 60) × {latMinutes}د</span>
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-rose-450 text-rose-400 font-black">
                      الخصم الدقيق: <strong className="font-mono text-sm">{latExactDeduction.toLocaleString()} ر.ي</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyMinuteDeductionToForm}
                    className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 text-white text-xs font-black px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>ترحيل للنموذج ✓</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleApplyAdvancesDeductions} className="flex flex-col gap-3.5">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-300 font-bold">الموظف المعني بالاستقطاع المالي:</label>
                  <select 
                    value={advEmpId}
                    onChange={(e) => setAdvEmpId(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 h-11"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">مبلغ السلفية المستقطعة مسبقاً (ر.ي):</label>
                    <input 
                      type="number" 
                      value={advAmount}
                      onChange={(e) => setAdvAmount(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 p-2.5 rounded-lg text-xs font-mono font-bold text-white text-center focus:outline-none h-11"
                    />
                    <span className="text-[9.5px] text-slate-500">حسم من صافي راتب الموظف المأمون</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">مبلغ الخصم الجزائي للغياب أو الإهمال (ر.ي):</label>
                    <input 
                      type="number"
                      value={dedAmount}
                      onChange={(e) => setDedAmount(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 p-2.5 rounded-lg text-xs font-mono font-bold text-white text-center focus:outline-none h-11"
                    />
                    <span className="text-[9.5px] text-slate-500">تنزيل الرصيد بقيمة الأضرار المكتشفة</span>
                  </div>

                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-300 font-bold">سبب الاستقطاع والخصم المكتوب بالتفصيل:</label>
                  <input 
                    type="text" 
                    value={dedReason}
                    onChange={(e) => setDedReason(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-850 rounded-xl p-3 text-xs text-white focus:outline-none h-11"
                    placeholder="مثال: غياب يومين غير معلنين وصعوبة مخرجات الفرز."
                  />
                </div>

                <div className="bg-red-950/20 border border-red-500/25 p-3 rounded-xl text-[10px] text-red-300 leading-relaxed">
                  ⚠️ تنبيه: يتم مراجعة الخصومات من الموارد البشرية والطلب مع الإدارة لضمان سلامة التعامل وبما يتوافق مع لائحة العمل والعمال المعترف بها في اليمن.
                </div>

                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs py-3.5 rounded-xl cursor-pointer shadow-md transition-all active:scale-95 text-center mt-3 h-11"
                >
                  تسجيل وترحيل المستقطعات والصكوك المالية
                </button>

              </form>

            </div>
          </div>
        )}

        {/* TAB 4: OFFICIAL HOLIDAYS, LEAVE BALANCES & PAYROLL DEDUCTIONS */}
        {activeTab === 'holidays_leaves' && (
          <div className="lg:col-span-12 flex flex-col gap-6">
            
            {/* Top Cards: Leave Balances Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-400 text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                    <Sun className="w-4 h-4" />
                    الإجازات والعطلات الرسمية المعتمدة
                  </span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded-full font-mono">مدفوعة</span>
                </div>
                <div className="my-3 text-center">
                  <span className="text-2xl font-black font-mono text-cyan-400">
                    {leaveRecords.filter(r => r.isPaid).length} إجازة
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">أعياد ومناسبات رسمية ورصيد سنوي مدفوع الأجر</p>
                </div>
                <div className="bg-slate-900 p-2 rounded-xl text-[10px] text-slate-400 text-center border border-slate-800">
                  لا يتأثر صافي راتب الموظف في الإجازات الرسمية
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-400 text-xs font-bold flex items-center gap-1.5 text-amber-400">
                    <CalendarOff className="w-4 h-4" />
                    إجمالي الأيام والغياب غير المدفوع
                  </span>
                  <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded-full font-mono">خصم راتب</span>
                </div>
                <div className="my-3 text-center">
                  <span className="text-2xl font-black font-mono text-amber-400">
                    {leaveRecords.filter(r => !r.isPaid).reduce((s, r) => s + r.daysCount, 0)} يوم
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">خصم تلقائي معادلة اليوم = (الأساسي / 30)</p>
                </div>
                <div className="bg-slate-900 p-2 rounded-xl text-[10px] text-amber-300 text-center border border-slate-800">
                  خصم تلقائي: {leaveRecords.filter(r => !r.isPaid).reduce((s, r) => s + r.totalDeductionYER, 0).toLocaleString()} ر.ي
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-400 text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                    <Users className="w-4 h-4" />
                    مجموع الكادر السنوي والرصيد
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full font-mono">21 يوم/سنة</span>
                </div>
                <div className="my-3 text-center">
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {employees.length} موظف
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">رصيد الإجازات السنوية المستحقة قانوناً</p>
                </div>
                <div className="bg-slate-900 p-2 rounded-xl text-[10px] text-slate-400 text-center border border-slate-800">
                  يتم التجديد والتأمين مع كل دورة سنوية
                </div>
              </div>
            </div>

            {/* Main Form & Table Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Form: Register New Leave / Holiday */}
              <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 text-right">
                <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <h4 className="text-white text-sm font-black">تسجيل إجازة رسمية أو عطلة معتمدة</h4>
                </div>

                <form onSubmit={handleAddLeaveRecord} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">الموظف المعني بالطلب:</label>
                    <select
                      value={leaveEmpId}
                      onChange={(e) => setLeaveEmpId(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 h-11"
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} - ({emp.role})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-300 font-bold">نوع الإجازة / العطلة:</label>
                      <select
                        value={leaveType}
                        onChange={(e: any) => setLeaveType(e.target.value)}
                        className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 h-11"
                      >
                        <option value="paid_holiday">🎉 إجازة رسمية (مدفوعة الأجر)</option>
                        <option value="paid_vacation">🏖️ إجازة سنوية (مدفوعة الأجر)</option>
                        <option value="unpaid_leave">🔻 إجازة بدون أجر (تخصم من الراتب)</option>
                        <option value="sick_leave">🩺 إجازة مرضية (مدفوعة/حسب اللائحة)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-slate-300 font-bold">عدد الأيام المطلوبة:</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={leaveDays}
                        onChange={(e) => setLeaveDays(parseInt(e.target.value, 10) || 1)}
                        className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white text-center font-mono font-bold focus:outline-none focus:border-cyan-500 h-11"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">تاريخ بدء الإجازة:</label>
                    <input
                      type="date"
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white text-center focus:outline-none focus:border-cyan-500 h-11"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">السبب والبيان التوضيحي:</label>
                    <input
                      type="text"
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 h-11"
                      placeholder="مثال: إجازة عيد الفطر المبارك أو إجازة سنوية معتمدة"
                    />
                  </div>

                  {leaveType === 'unpaid_leave' && (
                    <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300 leading-relaxed">
                      💡 <strong>الحساب التلقائي للخصم:</strong> سيتم خصم{' '}
                      <span className="font-mono font-bold">
                        {Math.round(((employees.find(e => e.id === leaveEmpId)?.basicSalaryYER || 0) / 30) * leaveDays).toLocaleString()} ر.ي
                      </span>{' '}
                      مباشرة من كشف مسير راتب هذا الشهر.
                    </div>
                  )}

                  <button
                    type="submit"
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs py-3.5 rounded-xl cursor-pointer shadow-md transition-all active:scale-95 text-center mt-2 h-11"
                  >
                    اعتماد الإجازة وتحديث كشف الراتب تلقائياً
                  </button>
                </form>
              </div>

              {/* Table: Leave Records Log & Employee Balances */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                
                {/* Employee Balances Cards */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <h5 className="text-white text-xs font-bold mb-3 flex items-center justify-between">
                    <span>رصيد الإجازات المتبقي لكادر الموظفين</span>
                    <span className="text-[10px] text-slate-500">الرصيد الأساسي 21 يوم</span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {employees.map(emp => {
                      const empLeaves = leaveRecords.filter(r => r.employeeId === emp.id);
                      const usedPaidDays = empLeaves.filter(r => r.isPaid).reduce((s, r) => s + r.daysCount, 0);
                      const usedUnpaidDays = empLeaves.filter(r => !r.isPaid).reduce((s, r) => s + r.daysCount, 0);
                      const remainingPaidDays = Math.max(0, 21 - usedPaidDays);

                      return (
                        <div key={emp.id} className="bg-slate-900 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{emp.name}</span>
                            <span className="text-[10px] text-teal-400 bg-teal-950 px-1.5 py-0.5 rounded font-mono">{emp.role}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-[10px]">
                            <span className="text-slate-400">رصيد متبقي: <strong className="text-emerald-400 font-mono">{remainingPaidDays} يوم</strong></span>
                            <span className="text-slate-400">بدون أجر: <strong className="text-amber-400 font-mono">{usedUnpaidDays} يوم</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Table of Recorded Leaves */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
                  <h5 className="text-white text-xs font-bold mb-3">سجل طلبات والإجازات المقيدة</h5>
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                        <th className="pb-2">الموظف</th>
                        <th className="pb-2">نوع الإجازة</th>
                        <th className="pb-2 text-center">الأيام</th>
                        <th className="pb-2 text-center">التاريخ</th>
                        <th className="pb-2 text-center">أثر الخصم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {leaveRecords.map(rec => (
                        <tr key={rec.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-2.5 font-bold text-slate-200">{rec.employeeName}</td>
                          <td className="py-2.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              rec.isPaid ? 'bg-teal-950 text-teal-300 border border-teal-500/30' : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                            }`}>
                              {rec.isPaid ? 'مدفوعة الأجر' : 'غير مدفوعة (خصم)'}
                            </span>
                          </td>
                          <td className="py-2.5 text-center font-mono font-bold text-white">{rec.daysCount} يوم</td>
                          <td className="py-2.5 text-center font-mono text-[10.5px] text-slate-400">{rec.startDate}</td>
                          <td className="py-2.5 text-center font-mono text-xs font-bold">
                            {rec.isPaid ? (
                              <span className="text-emerald-400">0 ر.ي (مدفوع)</span>
                            ) : (
                              <span className="text-rose-400">-{rec.totalDeductionYER.toLocaleString()} ر.ي</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
