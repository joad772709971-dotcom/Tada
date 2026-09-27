import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  User, 
  UserPlus, 
  Building2, 
  Phone, 
  CreditCard, 
  Sparkles, 
  X, 
  Check, 
  ChevronDown, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Customer, UserProfile } from '../types';
import CustomerQuickAddModal from './CustomerQuickAddModal';
import B2BInvitationModal from './B2BInvitationModal';
import { b2bOnboardingService } from '../services/b2bOnboardingService';
import { unifiedOfflineStoreEngine } from '../services/UnifiedOfflineStoreEngine';

interface CustomerSearchSelectorProps {
  customers: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  profile: UserProfile | null;
  placeholder?: string;
  defaultTier?: 'retail' | 'wholesale' | 'mega_wholesale' | 'importer' | 'individual';
  className?: string;
}

export default function CustomerSearchSelector({
  customers,
  selectedCustomer,
  onSelectCustomer,
  profile,
  placeholder = 'ابحث باسم العميل / رقم الجوال / المحل / الكود...',
  defaultTier = 'retail',
  className = ''
}: CustomerSearchSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [offlineCustomers, setOfflineCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    unifiedOfflineStoreEngine.getAllCustomersLocal(profile?.ownerId || profile?.uid)
      .then(list => {
        if (list && list.length > 0) {
          setOfflineCustomers(list);
        }
      })
      .catch(() => {});
  }, [profile?.ownerId, profile?.uid]);

  // Combine props customers with offline database customers
  const allAvailableCustomers = useMemo(() => {
    const map = new Map<string, Customer>();
    // First add offline customers
    offlineCustomers.forEach(c => {
      if (c.id) map.set(c.id, c);
    });
    // Then override with props customers
    customers.forEach(c => {
      if (c.id) map.set(c.id, c);
    });
    return Array.from(map.values());
  }, [customers, offlineCustomers]);

  // Multi-field search filter (اسم العميل / رقم الجوال / اسم المحل / كود العميل)
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) {
      return allAvailableCustomers.slice(0, 30);
    }
    const q = searchQuery.toLowerCase().trim();
    return allAvailableCustomers.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const shopName = (c.shopName || '').toLowerCase();
      const code = (c.code || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || shopName.includes(q) || code.includes(q);
    });
  }, [allAvailableCustomers, searchQuery]);

  const handleCustomerCreated = (newCustomer: Customer, shouldInvite?: boolean) => {
    onSelectCustomer(newCustomer);
    if (shouldInvite) {
      setTimeout(() => setIsInviteModalOpen(true), 300);
    }
  };

  const getTierBadge = (customer: Customer) => {
    const tier = customer.businessTier || (customer.tier as any);
    if (tier === 'retail' || tier?.includes?.('تجزئة')) {
      return <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full">تجزئة 🏪</span>;
    }
    if (tier === 'wholesale' || tier?.includes?.('جملة')) {
      return <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full">جملة 📦</span>;
    }
    if (tier === 'mega_wholesale' || tier?.includes?.('جملة الجملة')) {
      return <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-black px-2 py-0.5 rounded-full">جملة الجملة 🏛️</span>;
    }
    if (tier === 'importer' || tier?.includes?.('مستورد')) {
      return <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full">مستورد 🚢</span>;
    }
    return <span className="bg-gray-100 dark:bg-navy-800 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full">أفراد 👤</span>;
  };

  const inviteEligibility = b2bOnboardingService.isEligibleForB2BInvite(profile, selectedCustomer);

  return (
    <div className={`relative space-y-2 text-right ${className}`} ref={dropdownRef} dir="rtl">
      {/* Selected Customer View / Search Trigger */}
      {selectedCustomer ? (
        <div className="p-3.5 bg-brand-primary/5 dark:bg-brand-primary/10 rounded-2xl border border-brand-primary/20 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/15 text-brand-primary flex items-center justify-center font-black">
              <User size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-navy-900 dark:text-white">
                  {selectedCustomer.name}
                </span>
                {selectedCustomer.shopName && (
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    ({selectedCustomer.shopName})
                  </span>
                )}
                {getTierBadge(selectedCustomer)}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 font-bold mt-0.5">
                <span className="font-mono text-gray-600 dark:text-gray-300">📞 {selectedCustomer.phone}</span>
                {selectedCustomer.code && (
                  <span className="font-mono text-amber-500">🏷️ {selectedCustomer.code}</span>
                )}
                <span>
                  المديونية الحالية: <strong className="text-rose-500">{(selectedCustomer.debt || 0).toLocaleString()} ر.ي</strong>
                </span>
                {selectedCustomer.creditLimit ? (
                  <span>
                    سقف الائتمان: <strong className="text-emerald-500">{selectedCustomer.creditLimit.toLocaleString()} ر.ي</strong>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* B2B Onboarding Invitation Trigger Button */}
            {inviteEligibility.isEligible && (
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                title="إرسال دعوة الانضمام والكتالوج المباشر عبر واتساب أو SMS"
              >
                <Sparkles size={13} />
                <span>دعوة B2B</span>
              </button>
            )}

            {/* Change Customer Button */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setSearchQuery('');
              }}
              className="px-3 py-1.5 bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:text-brand-primary border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              تغيير
            </button>

            {/* Clear Button */}
            <button
              type="button"
              onClick={() => onSelectCustomer(null)}
              className="p-1.5 text-gray-400 hover:text-danger hover:bg-danger/10 rounded-xl transition-all cursor-pointer"
              title="إلغاء واختيار زبون نقدي عابر"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              className="w-full pr-10 pl-28 py-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-2xl text-xs font-bold outline-none focus:border-brand-primary transition-all shadow-sm"
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-2.5 py-1.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-[11px] font-black transition-all flex items-center gap-1 shadow-sm cursor-pointer border-none"
              >
                <UserPlus size={13} />
                <span>+ عميل جديد</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown Results */}
      {isOpen && !selectedCustomer && (
        <div className="absolute z-50 right-0 left-0 mt-1 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-750 rounded-2xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-navy-800 animate-fadeIn">
          {/* Quick Cash Customer Choice */}
          <div
            onClick={() => {
              onSelectCustomer(null);
              setIsOpen(false);
            }}
            className="p-3 hover:bg-gray-50 dark:hover:bg-navy-800/80 cursor-pointer flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-navy-800 text-gray-500 flex items-center justify-center font-black text-xs">
                💵
              </div>
              <div>
                <span className="text-xs font-black text-navy-900 dark:text-white block">
                  زبون نقدي عابر (بدون حساب)
                </span>
                <span className="text-[10px] text-gray-400 font-bold">تسجيل مبيعات نقدية فورية</span>
              </div>
            </div>
            <span className="text-[11px] text-brand-primary font-bold">اختيار سريع</span>
          </div>

          {/* Quick Add Button in Dropdown */}
          <div
            onClick={() => {
              setIsAddModalOpen(true);
              setIsOpen(false);
            }}
            className="p-3 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary cursor-pointer flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              <UserPlus size={16} />
              <span className="text-xs font-black">إضافة عميل جديد فوري في النظام</span>
            </div>
            <span className="text-[10px] font-mono font-black">+ إضافة</span>
          </div>

          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => {
                  onSelectCustomer(customer);
                  setIsOpen(false);
                }}
                className="p-3 hover:bg-gray-50 dark:hover:bg-navy-800/80 cursor-pointer flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black text-xs group-hover:bg-brand-primary group-hover:text-white transition-colors">
                    <User size={15} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-navy-900 dark:text-white">
                        {customer.name}
                      </span>
                      {customer.shopName && (
                        <span className="text-[11px] font-bold text-gray-400">
                          - {customer.shopName}
                        </span>
                      )}
                      {getTierBadge(customer)}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold mt-0.5">
                      <span className="font-mono">{customer.phone}</span>
                      {customer.code && (
                        <span className="font-mono text-amber-500">[{customer.code}]</span>
                      )}
                      {customer.debt > 0 && (
                        <span className="text-rose-500 font-bold">دين: {customer.debt.toLocaleString()} ر.ي</span>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-[10px] text-gray-400 group-hover:text-brand-primary font-black">
                  تحديد ✓
                </span>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-gray-400 font-bold space-y-2">
              <p>لم يتم العثور على عميل يطابق البحث ({searchQuery})</p>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(true);
                  setIsOpen(false);
                }}
                className="px-3 py-1.5 bg-brand-primary text-white rounded-xl text-xs font-black inline-flex items-center gap-1 cursor-pointer"
              >
                <UserPlus size={13} />
                <span>إضافة "{searchQuery}" كعميل جديد الآن</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Add Modal */}
      <CustomerQuickAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCustomerCreated={handleCustomerCreated}
        profile={profile}
        defaultTier={defaultTier}
      />

      {/* B2B Onboarding Invitation Modal */}
      <B2BInvitationModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        customer={selectedCustomer}
        profile={profile}
      />
    </div>
  );
}
