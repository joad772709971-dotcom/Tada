import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  CreditCard, 
  Coins, 
  Settings,
  HelpCircle
} from 'lucide-react';
import MobileBalance from './MobileBalance';
import SIMManagement from './SIMManagement';
import { UserProfile } from '../types';

interface CallCreditAndSimsProps {
  currentUser: UserProfile;
  initialSubTab?: 'credit' | 'sims';
  onAddTransaction?: (tx: any) => void;
  onAddSale?: (sale: any) => void;
}

export default function CallCreditAndSims({
  currentUser,
  initialSubTab = 'credit',
  onAddTransaction,
  onAddSale
}: CallCreditAndSimsProps) {
  // Sub-tabs navigation
  const [activeSubTab, setActiveSubTab] = useState<'credit' | 'sims'>(initialSubTab);

  // Sync state if initialSubTab prop changes dynamically from parent navigation triggers
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  return (
    <div className="space-y-6">
      
      {/* Tab Selector Header */}
      <div className="flex border-b border-zinc-900 pb-0 flex-wrap gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('credit')}
          className={`px-5 py-3 text-xs font-black cursor-pointer transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeSubTab === 'credit'
              ? 'border-[#f1c40f] text-white bg-zinc-900/40'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <Smartphone size={15} />
          شحن الرصيد والتحويلات الفورية 📱
        </button>

        <button
          onClick={() => setActiveSubTab('sims')}
          className={`px-5 py-3 text-xs font-black cursor-pointer transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeSubTab === 'sims'
              ? 'border-[#f1c40f] text-white bg-zinc-900/40'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <CreditCard size={15} />
          إدارة وتفعيل خطوط الشريحة 💳
        </button>
      </div>

      {/* Embedded Component Scope rendering */}
      <div className="space-y-4">
        {activeSubTab === 'credit' ? (
          <MobileBalance profile={currentUser} />
        ) : (
          <SIMManagement profile={currentUser} />
        )}
      </div>

    </div>
  );
}
