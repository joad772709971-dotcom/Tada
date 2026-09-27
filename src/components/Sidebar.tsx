import { useState } from 'react';
import { ChevronDown, ChevronUp, LayoutDashboard, Database, Settings } from 'lucide-react';
import { useLoading } from '../context/LoadingContext';

export const Sidebar = () => {
  // State: tracking active open section with fast immediate toggle (no spinner-loading delay)
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div id="sidebar-root" className="w-64 h-full bg-[#0a0f1d] text-white p-4 overflow-y-auto">
      {/* Example for a primary module button containing custom sub-menus */}
      <SidebarItem 
        id="sidebar-inventory-section"
        title="المخزون والمستودع" 
        isOpen={openSection === 'inventory'}
        onClick={() => toggleSection('inventory')}
        icon={<Database size={20}/>}
      >
        <SubMenuItem id="sub-inv-avail" title="المخزون المتوفر" />
        <SubMenuItem id="sub-inv-scanner" title="ماسح الفواتير" />
      </SidebarItem>
      
      {/* Additional navigation sections can be structured in the same manner */}
    </div>
  );
};

// Main Item Component (prevents delay and loading lags)
const SidebarItem = ({ id, title, isOpen, onClick, icon, children }: any) => {
  const { showLegacyUIBorders } = useLoading();
  return (
    <div id={id}>
      <button 
        id={`${id}-btn`}
        onClick={onClick}
        className={`w-full flex items-center justify-between p-3 transition-all duration-150 ${
          showLegacyUIBorders ? 'rounded-lg hover:bg-white/10' : 'rounded-none hover:bg-transparent border-none outline-none hover:text-amber-400'
        }`}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      
      {/* Immediate children display with zero lagging/spinner delays */}
      {isOpen && <div className="mt-1 space-y-1 pr-6">{children}</div>}
    </div>
  );
};

const SubMenuItem = ({ id, title }: { id: string; title: string }) => (
  <button id={id} className="w-full text-right p-2 text-sm text-gray-400 hover:text-amber-400 transition-colors">
    {title}
  </button>
);
