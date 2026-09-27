import React from 'react';
import { Users, User, Shield, Check, Filter } from 'lucide-react';
import { UserProfile } from '../types';

interface EmployeeFilterSelectorProps {
  profile: UserProfile | null;
  employees: any[];
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
  isOwnerOrManager: boolean;
}

export const EmployeeFilterSelector: React.FC<EmployeeFilterSelectorProps> = ({
  profile,
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  isOwnerOrManager,
}) => {
  if (!isOwnerOrManager) {
    // Normal employee/cashier isolated view indicator
    return (
      <div 
        id="employee-isolated-banner"
        className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-bold shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
        <User size={14} className="text-indigo-600 dark:text-indigo-400" />
        <span>
          لوحة العمل الخاصة بالموظف: <span className="font-black text-indigo-700 dark:text-white">{profile?.name || 'المستخدم الحالي'}</span> (مساحة معزولة ومحمية)
        </span>
      </div>
    );
  }

  // Store Owner view with full staff switching capability
  return (
    <div 
      id="owner-employee-filter-container"
      className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-1.5 shadow-sm"
    >
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-black shrink-0">
        <Filter size={14} className="text-amber-500" />
        <span className="hidden sm:inline">تصفية النشاط:</span>
      </div>

      <select
        id="owner-employee-select-dropdown"
        value={selectedEmployeeId}
        onChange={(e) => onSelectEmployee(e.target.value)}
        className="bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-black rounded-xl px-2.5 py-1 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer hover:border-amber-500 transition-colors"
      >
        <option value="ALL">🏢 كامل المحل (كافة الموظفين)</option>
        {employees.map(emp => (
          <option key={emp.id || emp.uid} value={emp.id || emp.uid}>
            👤 {emp.name || emp.displayName || emp.phone || 'موظف'} ({emp.role === 'engineer' ? 'فني صيانة' : emp.role === 'cashier' ? 'كاشير' : 'موظف'})
          </option>
        ))}
      </select>

      {selectedEmployeeId !== 'ALL' && (
        <button
          onClick={() => onSelectEmployee('ALL')}
          className="text-[10px] font-black text-amber-600 dark:text-amber-400 hover:underline px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40"
          title="إلغاء التصفية والعودة لكامل المحل"
        >
          عرض الكل ✕
        </button>
      )}
    </div>
  );
};
