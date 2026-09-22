import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Calendar, Clock, DollarSign, Award, CheckCircle, AlertCircle, FileSpreadsheet, Plus, Trash2, User, ChevronDown } from 'lucide-react';

interface EmployeeShiftHistoryTableProps {
  employees: UserProfile[];
  onUpdateEmployee: (updatedEmployee: UserProfile) => void;
}

export default function EmployeeShiftHistoryTable({
  employees,
  onUpdateEmployee
}: EmployeeShiftHistoryTableProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.uid || '');
  const [activeTab, setActiveTab] = useState<'details' | 'holidays' | 'shifts'>('details');

  // New official holiday form state
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', notes: '' });

  const selectedEmployee = employees.find(e => e.uid === selectedEmployeeId) || employees[0];

  if (!selectedEmployee) {
    return (
      <div className="p-8 text-center bg-zinc-950 rounded-2xl border border-zinc-900 text-zinc-500 text-xs">
        لا يوجد موظفين مسجلين حالياً للعرض التفصيلي.
      </div>
    );
  }

  const holidays = selectedEmployee.officialHolidays || [];

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliday.name || !newHoliday.date) return;

    const updatedHolidays = [
      ...holidays,
      {
        id: `hol-${Date.now()}`,
        name: newHoliday.name.trim(),
        date: newHoliday.date,
        notes: newHoliday.notes.trim()
      }
    ];

    const updatedEmp = {
      ...selectedEmployee,
      officialHolidays: updatedHolidays
    };

    onUpdateEmployee(updatedEmp);
    setNewHoliday({ name: '', date: '', notes: '' });
  };

  const handleDeleteHoliday = (holidayId: string) => {
    const updatedHolidays = holidays.filter(h => h.id !== holidayId);
    const updatedEmp = {
      ...selectedEmployee,
      officialHolidays: updatedHolidays
    };
    onUpdateEmployee(updatedEmp);
  };

  return (
    <div className="bg-[#080808] border border-zinc-900 rounded-3xl p-6 text-right space-y-6" dir="rtl">
      {/* Top Header & Selection */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-900">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-amber-500" />
            📊 الجدول التفصيلي والإجازات الرسمية وساعات العمل للموظفين
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            عرض بيانات الموظف المختار، فترات الدوام، ساعات العمل، الإجازات الرسمية والسجلات التفصيلية.
          </p>
        </div>

        {/* Employee Selector Dropdown */}
        <div className="relative min-w-[220px]">
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {employees.map(emp => (
              <option key={emp.uid} value={emp.uid}>
                👤 {emp.name} ({emp.role === 'engineer' ? 'مهندس' : emp.role === 'sales' ? 'كاشير' : 'إدارة'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-900 pb-2">
        {[
          { id: 'details', label: '📋 البيانات والنظام', icon: User },
          { id: 'holidays', label: '🏖️ الإجازات الرسمية', icon: Calendar },
          { id: 'shifts', label: '⏰ الورديات وساعات العمل', icon: Clock },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Detailed Overview */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl space-y-1">
              <span className="text-zinc-500 text-[10px] block">نوع وصول المستخدم للنظام</span>
              <span className="font-bold text-xs block text-white">
                {selectedEmployee.isSystemUser !== false ? '🔐 مستخدم نظامي (ببيانات دخول)' : '👤 موظف عادي (بدون حساب دخول)'}
              </span>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl space-y-1">
              <span className="text-zinc-500 text-[10px] block">نظام العمل والدوام</span>
              <span className="font-bold text-xs block text-amber-400">
                {selectedEmployee.workSystem === 'shifts' ? '🔄 نظام الورديات (فترات)' : '📅 نظام راتب شهري ثابت'}
              </span>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl space-y-1">
              <span className="text-zinc-500 text-[10px] block">ساعات العمل اليومية</span>
              <span className="font-bold text-xs block text-emerald-400 font-mono">
                {selectedEmployee.dailyWorkHours || 8} ساعات / اليوم
              </span>
            </div>
          </div>

          {/* Full Table Breakdown */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
            <table className="w-full text-xs text-right">
              <thead className="bg-zinc-900/60 text-zinc-400 font-bold border-b border-zinc-900">
                <tr>
                  <th className="p-3">خاصية البيان</th>
                  <th className="p-3">القيمة والالتزام</th>
                  <th className="p-3">ملاحظات والتفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300">
                <tr>
                  <td className="p-3 font-bold text-white">الاسم الكامل</td>
                  <td className="p-3 font-mono">{selectedEmployee.name}</td>
                  <td className="p-3 text-zinc-500">مسجل بالهوية الرسمية</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">البريد الإلكتروني / اسم الدخول</td>
                  <td className="p-3 font-mono dir-ltr text-right">{selectedEmployee.email}</td>
                  <td className="p-3 text-zinc-500">{selectedEmployee.isSystemUser !== false ? 'حساب فعال للدخول' : 'حساب عادي'}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">رقم التليفون / الواتساب</td>
                  <td className="p-3 font-mono">{selectedEmployee.phone || 'غير مسجل'}</td>
                  <td className="p-3 text-zinc-500">للتواصل والإشعارات</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">العهدة المالية الحالية</td>
                  <td className="p-3 font-mono text-amber-400 font-bold">{(selectedEmployee.custodyBalance || 0).toLocaleString()} YER</td>
                  <td className="p-3 text-zinc-500">عهدة الصندوق والقطع للموظف</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">إجمالي الإجازات الرسمية</td>
                  <td className="p-3 font-mono text-blue-400 font-bold">{holidays.length} إجازات مسجلة</td>
                  <td className="p-3 text-zinc-500">محسوبة بجدول الإجازات الرسمية</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Official Holidays */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <form onSubmit={handleAddHoliday} className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-amber-400">➕ إضافة إجازة رسمية جديدة للموظف</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">اسم الإجازة / المناسبة</label>
                <input
                  type="text"
                  required
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  placeholder="مثال: عيد الفطر المبارك"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">تاريخ الإجازة</label>
                <input
                  type="date"
                  required
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">ملاحظات / مدفوعة الأجر؟</label>
                <input
                  type="text"
                  value={newHoliday.notes}
                  onChange={(e) => setNewHoliday({ ...newHoliday, notes: e.target.value })}
                  placeholder="إجازة مدفوعة بالكامل"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} />
              حفظ الإجازة الرسمية
            </button>
          </form>

          {/* Holidays List */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
            {holidays.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs">
                لا توجد إجازات رسمية مسجلة لهذا الموظف حتى الآن.
              </div>
            ) : (
              <table className="w-full text-xs text-right">
                <thead className="bg-zinc-900/60 text-zinc-400 font-bold border-b border-zinc-900">
                  <tr>
                    <th className="p-3">اسم المناسبة / الإجازة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">الملاحظات</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {holidays.map(h => (
                    <tr key={h.id} className="hover:bg-zinc-900/30">
                      <td className="p-3 font-bold text-white">{h.name}</td>
                      <td className="p-3 font-mono text-amber-400">{h.date}</td>
                      <td className="p-3 text-zinc-400">{h.notes || 'إجازة رسمية'}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Shifts & Hours */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-amber-400">⏰ الفترات المخصصة للوردية</h4>
            <div className="flex flex-wrap gap-2">
              {(selectedEmployee.shiftPeriods || ['صباحية', 'مسائية']).map((p, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-white">
                  🔄 الفترة: {p}
                </span>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-900 text-xs text-zinc-400 flex justify-between items-center">
              <span>إجمالي ساعات التكليف اليومي:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {selectedEmployee.dailyWorkHours || 8} ساعات
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
