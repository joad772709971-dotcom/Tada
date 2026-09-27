import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Landmark } from 'lucide-react';

interface AccountSelectorProps {
  currentStoreId: string;
  selectedAccountId: string;
  onChange: (value: string) => void;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  currentStoreId,
  selectedAccountId,
  onChange,
}) => {
  const [localAccounts, setLocalAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentStoreId) return;

    const fetchAccounts = async () => {
      setLoading(true);
      try {
        // Enforce store-level scoping strictly
        const q = query(
          collection(db, 'accounts'),
          where('store_id', '==', currentStoreId)
        );
        const snap = await getDocs(q);
        const mapped = snap.docs.map(doc => {
          const d = doc.data();
          
          // 2. DYNAMIC NAME MAPPING (Stop Generic Naming)
          // Read specific database fields for bank name: account.bank_name or account.custom_label
          const dbBankName = d.bank_name || d.custom_label || d.bankName;
          const displayBankName = dbBankName 
            ? dbBankName 
            : `بنك الكريمي - ${d.accountNumber ? d.accountNumber.slice(-4) : '1234'}`;

          const name = d.accountName || d.name || 'حساب المصرفي';
          
          return {
            id: doc.id,
            ...d,
            bankName: displayBankName,
            name: name
          };
        });
        setLocalAccounts(mapped);
      } catch (err) {
        console.error("Error loading accounts in AccountSelector:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [currentStoreId]);

  return (
    <div className="space-y-1.5" id="account-selector-wrapper">
      <div className="flex items-center gap-1">
        <Landmark size={14} className="text-gray-400" />
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">
          حساب الدفع / التحويل البنكي للمتجر
        </label>
      </div>
      <div className="relative">
        <select
          id="account-selector-select"
          className="w-full p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700/80 rounded-xl text-sm outline-none font-bold text-gray-800 dark:text-white focus:border-brand-primary"
          value={selectedAccountId}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
        >
          <option value="">{loading ? 'جاري تحميل الحسابات...' : '-- اختر الحساب البنكي --'}</option>
          {localAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.bankName})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
