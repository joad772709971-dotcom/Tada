import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Transaction, Product, MaintenanceJob, TransactionType } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Package, Settings, ShieldAlert, CheckCircle, PackageOpen, AlertTriangle } from 'lucide-react';

interface DashboardTabProps {
  transactions: Transaction[];
  products: Product[];
  maintenance: MaintenanceJob[];
  onSwitchTab: (tab: string) => void;
}

export default function DashboardTab({ transactions, products, maintenance, onSwitchTab }: DashboardTabProps) {
  // Aggregate data
  const receipts = transactions.filter(t => t.type === TransactionType.RECEIPT);
  const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);

  const totalReceipts = receipts.reduce((acc, c) => acc + c.amount, 0);
  const totalExpenses = expenses.reduce((acc, c) => acc + c.amount, 0);
  const netProfit = totalReceipts - totalExpenses;

  const lowStock = products.filter(p => p.quantity <= p.lowStockThreshold);
  const pendingMaintenance = maintenance.filter(m => m.status !== 'DELIVERED' && m.status !== 'CANCELLED');

  // Chart data formatting (Daily/Weekly points)
  const chartData = transactions.slice(0, 7).reverse().map(t => ({
    date: new Date(t.date).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' }),
    'إيراد': t.type === TransactionType.RECEIPT ? t.amount : 0,
    'مصروف': t.type === TransactionType.EXPENSE ? t.amount : 0,
    money: t.type === TransactionType.RECEIPT ? t.amount : -t.amount
  }));

  // Bar chart category group data
  const categoryMap: { [key: string]: { name: string, receipts: number, expenses: number } } = {};
  transactions.forEach(t => {
    if (!categoryMap[t.category]) {
      categoryMap[t.category] = { name: t.category, receipts: 0, expenses: 0 };
    }
    if (t.type === TransactionType.RECEIPT) {
      categoryMap[t.category].receipts += t.amount;
    } else {
      categoryMap[t.category].expenses += t.amount;
    }
  });
  const categoryData = Object.values(categoryMap).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Welcome Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/40">
        <div>
          <h2 className="text-2xl font-black text-white">لوحة الإحصائيات المركزية</h2>
          <p className="text-sm text-slate-400 mt-1">المحاسبة الموحدة، التدقيق الحسابي ومؤشرات المخزون المالي لنظام JAM</p>
        </div>
        <div className="font-mono text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-xl">
          آخر تحديث للنظام: {new Date().toLocaleTimeString('ar-IQ')}
        </div>
      </div>

      {/* Primary KPI Widgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenues */}
        <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl relative overflow-hidden group hover:border-teal-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 blur-2xl rounded-full"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400">إجمالي المقبوضات (الإيراد)</p>
              <h3 className="text-xl md:text-2xl font-black text-white mt-2 font-mono">
                {totalReceipts.toLocaleString()} <span className="text-xs font-sans text-teal-400">د.ع</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] text-teal-400 font-mono mt-3 flex items-center gap-1">
            <span>● نشط ومقيد في الخزينة</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl relative overflow-hidden group hover:border-red-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-2xl rounded-full"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400">إجمالي المصاريف والمشتريات</p>
              <h3 className="text-xl md:text-2xl font-black text-white mt-2 font-mono">
                {totalExpenses.toLocaleString()} <span className="text-xs font-sans text-red-400">د.ع</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] text-red-400 font-mono mt-3 flex items-center gap-1">
            <span>● شامل الفواتير وأجور قطع الغيار</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400">صافي الأرباح التشغيلية</p>
              <h3 className={`text-xl md:text-2xl font-black mt-2 font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netProfit.toLocaleString()} <span className="text-xs font-sans">د.ع</span>
              </h3>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${netProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-3">
            هامش ربح إيجابي مستقر
          </div>
        </div>

        {/* Balance Metrics */}
        <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400">السيولة ورأس مال البضاعة</p>
              <h3 className="text-xl md:text-2xl font-black text-white mt-2 font-mono">
                {(products.reduce((acc, p) => acc + (p.purchasePrice * p.quantity), 0)).toLocaleString()} <span className="text-xs font-sans text-blue-400">د.ع</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] text-blue-400 font-mono mt-3">
            قيمة المخزن الإجمالية الفعلية
          </div>
        </div>
      </div>

      {/* Critical System Alerts Bar */}
      {(lowStock.length > 0 || pendingMaintenance.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Low stock notifications */}
          {lowStock.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-400">تنبيه مستويات المخزون (خط الخطر)</h4>
                <p className="text-xs text-slate-400 mt-1">يوجد لدك **{lowStock.length}** بضائع شارف مخزونها على النفاد التام من المتجر</p>
                <button onClick={() => onSwitchTab('inventory')} className="text-xs text-amber-400 font-bold underline mt-3 block hover:text-amber-300">
                  عرض بضائع المخازن وإعادة التعبئة ←
                </button>
              </div>
            </div>
          )}

          {/* Pending Maintenance */}
          {pendingMaintenance.length > 0 && (
            <div className="bg-teal-500/5 border border-teal-500/20 rounded-3xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                <Settings className="w-5 h-5 animate-spin-slow" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-teal-400">ورشة الصيانة والأجهزة المعلقة</h4>
                <p className="text-xs text-slate-400 mt-1">لديك **{pendingMaintenance.length}** أجهزة في الصيانة لم يتم إنجازها أو تسليمها للزبائن حتى الآن</p>
                <button onClick={() => onSwitchTab('maintenance')} className="text-xs text-teal-400 font-bold underline mt-3 block hover:text-teal-300">
                  دخول الورشة ومتابعة الفنيين ←
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recharts Core Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Sales & Cash flow Area Chart */}
        <div className="bg-slate-900/20 border border-slate-850/80 p-6 rounded-3xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-black text-white">تحليل التدفقات النقدية اليومية</h3>
            <span className="text-[10px] text-slate-500 font-mono">آخر 7 حركات مسجلة</span>
          </div>

          <div className="h-64 select-none" dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceipt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="إيراد" stroke="#14b8a6" fillOpacity={1} fill="url(#colorReceipt)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="مصروف" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category breakdown bar chart */}
        <div className="bg-slate-900/20 border border-slate-850/80 p-6 rounded-3xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-black text-white">توزع الحسابات حسب التصنيف</h3>
            <span className="text-[10px] text-slate-500 font-mono">التبويبات الـ 5 الأكبر</span>
          </div>

          <div className="h-64 select-none" dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="receipts" name="إيرادات" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="مصاريف" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transactions List snippet */}
      <div className="bg-slate-900/20 border border-slate-850/80 p-6 rounded-3xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-black text-white">آخر الحركات المالية المقيدة</h3>
          <button onClick={() => onSwitchTab('finance')} className="text-xs text-teal-400 font-bold hover:underline">
            إدارة كافة الحسابات والمبيعات ←
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold">
                <th className="pb-3 pt-2">التاريخ</th>
                <th className="pb-3 pt-2">النوع</th>
                <th className="pb-3 pt-2">التصنيف</th>
                <th className="pb-3 pt-2">القيمة</th>
                <th className="pb-3 pt-2">تفاصيل / ملاجظات</th>
                <th className="pb-3 pt-2">حالة الرقابة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.slice(0, 4).map(t => (
                <tr key={t.id} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                  <td className="py-3 font-mono">{new Date(t.date).toLocaleDateString('ar-IQ')}</td>
                  <td className="py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.type === TransactionType.RECEIPT ? 'bg-teal-500/10 text-teal-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {t.type === TransactionType.RECEIPT ? 'إيراد قبض' : 'مصروف صرف'}
                    </span>
                  </td>
                  <td className="py-3 font-medium">{t.category}</td>
                  <td className="py-3 font-mono font-bold text-white">{t.amount.toLocaleString()} د.ع</td>
                  <td className="py-3 text-slate-400 max-w-xs truncate">{t.notes}</td>
                  <td className="py-3">
                    {t.auditorApproved ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold text-[10px]">
                        <CheckCircle className="w-3.5 h-3.5" /> مدقق معتمد
                      </span>
                    ) : t.auditorFlagged ? (
                      <span className="text-red-400 flex items-center gap-1 font-bold text-[10px]">
                        <ShieldAlert className="w-3.5 h-3.5 animate-pulse" /> إنذار تدقيقي
                      </span>
                    ) : (
                      <span className="text-slate-500 font-bold text-[10px]">بانتظار الإغلاق</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
