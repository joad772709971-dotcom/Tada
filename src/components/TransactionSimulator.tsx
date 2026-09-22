import React, { useState, useMemo } from "react";
import { useAdaptiveTheme } from "./ThemeEngine";
import { TransactionPipelineService } from "../pipeline";
import { Tenant, Account, B2BTransaction } from "../types";
import { 
  ShieldCheck, 
  Settings, 
  Workflow, 
  ArrowRight, 
  TrendingDown, 
  Play, 
  RotateCcw, 
  BadgeAlert, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle,
  Coins,
  Truck,
  FileCheck
} from "lucide-react";

// -------------------------------------------------------------
// INITIAL B2B BALANCES & METRICS FOR YEMEN MULTI-TENANT SIMULATOR
// -------------------------------------------------------------
const INITIAL_TENANTS: Tenant[] = [
  {
    id: "T-YEM-SABAFARMS",
    nameAr: "مجموعة سبأ التجارية والتوريدات",
    nameEn: "Saba B2B Supply Industries",
    vertical: "wholesale",
    theme: "eco-poultry-farm",
    accountBalanceYER: 135000000,
    cashAccountId: "acc-saba-cash",
    inventoryAccountId: "acc-saba-inv",
    revenueAccountId: "acc-saba-rev",
    receivablesAccountId: "acc-saba-rec",
    twoFactorEnabled: true,
    status: "active"
  },
  {
    id: "T-YEM-ALMAZ",
    nameAr: "مجموعة الماز التجارية للإمدادات الغذائية",
    nameEn: "Al-Maz B2B Logistics & Supply Group",
    vertical: "wholesale",
    theme: "luxury-gold",
    accountBalanceYER: 94000000,
    cashAccountId: "acc-almaz-cash",
    inventoryAccountId: "acc-almaz-inv",
    revenueAccountId: "acc-almaz-rev",
    receivablesAccountId: "acc-almaz-rec",
    twoFactorEnabled: true,
    status: "active"
  },
  {
    id: "T-YEM-LOWBAL",
    nameAr: "مركز التوزيع السريع للتجزئة",
    nameEn: "Express Retail Distributors",
    vertical: "wholesale",
    theme: "chrome-industrial",
    accountBalanceYER: 420000, // Very low balance to trigger verification decline!
    cashAccountId: "acc-lowbal-cash",
    inventoryAccountId: "acc-lowbal-inv",
    revenueAccountId: "acc-lowbal-rev",
    receivablesAccountId: "acc-lowbal-rec",
    twoFactorEnabled: false,
    status: "active"
  }
];

const INITIAL_ACCOUNTS: Account[] = [
  // Saba Accounts
  { id: "acc-saba-cash", tenantId: "T-YEM-SABAFARMS", account_code: "1010-CASH", nameAr: "النقدية بالريال اليمني", nameEn: "Yemeni Rial Cash Reserve", type: "ASSET", balance: 135000000 },
  { id: "acc-saba-inv", tenantId: "T-YEM-SABAFARMS", account_code: "1200-INVENTORY", nameAr: "مستودعات البضائع المركزية", nameEn: "Central Warehouse Assets", type: "ASSET", balance: 18000000 },
  { id: "acc-saba-rev", tenantId: "T-YEM-SABAFARMS", account_code: "4000-REVENUE", nameAr: "إيرادات المبيعات التجارية", nameEn: "Supplier Sales Revenue", type: "REVENUE", balance: 42000000 },
  
  // Al-Maz Accounts
  { id: "acc-almaz-cash", tenantId: "T-YEM-ALMAZ", account_code: "1010-CASH", nameAr: "حساب الخزينة الرئيسي", nameEn: "Vault Cash Asset", type: "ASSET", balance: 94000000 },
  { id: "acc-almaz-inv", tenantId: "T-YEM-ALMAZ", account_code: "1200-INVENTORY", nameAr: "بضاعة في الطريق", nameEn: "B2B Transit Storage", type: "ASSET", balance: 5000000 },
  { id: "acc-almaz-rev", tenantId: "T-YEM-ALMAZ", account_code: "4000-REVENUE", nameAr: "إيرادات اللوجستيات", nameEn: "General Trade Logistics Revenue", type: "REVENUE", balance: 12000000 },

  // Low Bal Accounts
  { id: "acc-lowbal-cash", tenantId: "T-YEM-LOWBAL", account_code: "1010-CASH", nameAr: "صندوق مبيعات التجزئة البسيط", nameEn: "Retail Petty Cash Desk", type: "ASSET", balance: 420000 },
  { id: "acc-lowbal-inv", tenantId: "T-YEM-LOWBAL", account_code: "1200-INVENTORY", nameAr: "مخزون التجزئة", nameEn: "Retail Stock", type: "ASSET", balance: 150000 },
  { id: "acc-lowbal-rev", tenantId: "T-YEM-LOWBAL", account_code: "4000-REVENUE", nameAr: "نشاط مبيعات التجزئة", nameEn: "Retail Revenue Stream", type: "REVENUE", balance: 50000 }
];

export default function TransactionSimulator() {
  const { tokens } = useAdaptiveTheme();

  // Instantiate standard singleton-like service state
  const [pipelineService, setPipelineService] = useState(() => {
    return new TransactionPipelineService(
      JSON.parse(JSON.stringify(INITIAL_TENANTS)),
      JSON.parse(JSON.stringify(INITIAL_ACCOUNTS))
    );
  });

  // State handles
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState("T-YEM-ALMAZ");
  const [selectedProduct, setSelectedProduct] = useState<string>("بضائع تجارية عامة");
  const [orderQuantity, setOrderQuantity] = useState(120);
  const [unitPriceYER, setUnitPriceYER] = useState(25000); // 25,000 YER per crate base
  const [sensorTemp, setSensorTemp] = useState(19); // safe degrees
  const [carrier, setCarrier] = useState("Bab el-Mandeb Reefer Lines");

  const [lastError, setLastError] = useState<string | null>(null);

  // Computed views synced to the current State Service instance
  const tenants = pipelineService.getTenants();
  const accounts = pipelineService.getAccounts();
  const transactions = pipelineService.getTransactions();
  const journalEntries = pipelineService.getJournalEntries();

  // Find currently active transaction
  const activeTx = useMemo(() => {
    return transactions.find(t => t.id === activeTxId) || null;
  }, [transactions, activeTxId]);

  // Restores standard accounting sandbox values
  const handleReset = () => {
    const newService = new TransactionPipelineService(
      JSON.parse(JSON.stringify(INITIAL_TENANTS)),
      JSON.parse(JSON.stringify(INITIAL_ACCOUNTS))
    );
    setPipelineService(newService);
    setActiveTxId(null);
    setLastError(null);
  };

  // Creates transaction via service
  const handleInitializeTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    setLastError(null);

    // Let saba farms ALWAYS be the supplier in Yemen Agricultural vertical schema
    const newTx = pipelineService.createTransaction({
      tenantId: selectedBuyerId,
      counterpartyTenantId: "T-YEM-SABAFARMS",
      productType: selectedProduct,
      quantity: orderQuantity,
      unitPriceYER: unitPriceYER,
      logisticsTempCelsius: sensorTemp,
      logisticsCarrier: carrier
    });

    setActiveTxId(newTx.id);
  };

  // Steps active transaction through current stage
  const handleStepStage = async () => {
    if (!activeTxId) return;
    setLastError(null);

    try {
      await pipelineService.executePipelineStage(activeTxId);
      // Force trigger state refresh
      setPipelineService(Object.assign(Object.create(Object.getPrototypeOf(pipelineService)), pipelineService));
    } catch (err: any) {
      setLastError(err.message || "Stage execution failed.");
      setPipelineService(Object.assign(Object.create(Object.getPrototypeOf(pipelineService)), pipelineService));
    }
  };

  // Helper colors for steps
  const getStageColor = (stageNum: number) => {
    if (!activeTx) return "bg-white text-slate-300 border-slate-200";
    if (activeTx.stage > stageNum || (activeTx.stage === stageNum && activeTx.status === "completed")) {
      return "bg-[#F0F4ED] text-[#4A6741] border-[#A4C639]";
    }
    if (activeTx.stage === stageNum) {
      if (activeTx.status === "failed") return "bg-rose-50 text-rose-600 border-rose-300";
      return "bg-[#E6EEE2] text-[#1B3016] border-[#A4C639] animate-pulse font-bold";
    }
    return "bg-white text-slate-400 border-slate-200";
  };

  // Custom presets helper to easily demonstrate the failure conditions requested
  const applyPreset = (preset: "success_eggs" | "fail_balance" | "fail_expired" | "fail_temp") => {
    handleReset();
    if (preset === "success_eggs") {
      setSelectedBuyerId("T-YEM-ALMAZ");
      setSelectedProduct("Egg Boxes (Large)");
      setOrderQuantity(100);
      setUnitPriceYER(22000);
      setSensorTemp(18); // cool and safe
    } else if (preset === "fail_balance") {
      setSelectedBuyerId("T-YEM-LOWBAL"); // low state cash
      setSelectedProduct("Egg Boxes (Large)");
      setOrderQuantity(300); // 300 * 25k = 7.5 million, exceeds 420k!
      setUnitPriceYER(25000);
      setSensorTemp(15);
    } else if (preset === "fail_expired") {
      setSelectedBuyerId("T-YEM-ALMAZ");
      setSelectedProduct("Egg Boxes (Small)"); // small logs contain expired dates in default eggs state!
      setOrderQuantity(40);
      setUnitPriceYER(12000);
      setSensorTemp(19);
    } else if (preset === "fail_temp") {
      setSelectedBuyerId("T-YEM-ALMAZ");
      setSelectedProduct("Egg Boxes (Large)");
      setOrderQuantity(150);
      setUnitPriceYER(24000);
      setSensorTemp(29); // Exceeds egg max cooler limit of 24 degrees!
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* LEFT COLUMN: Controls & Presets / Creating Transactions (5 Span) */}
      <div className="xl:col-span-4 space-y-6">
        
        {/* Scenario preset buttons */}
        <div className={`p-5 rounded-2xl border ${tokens.borderClass} ${tokens.bgCard} shadow-md`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-sm font-bold ${tokens.textPrimary} flex items-center gap-1.5`}>
              <Play className="w-4 h-4 text-emerald-500" />
              <span>Sandbox Scenario Quick Starts</span>
            </h3>
            <button 
              onClick={handleReset}
              className="p-1 rounded-lg hover:bg-emerald-500/10 text-emerald-500 border border-transparent hover:border-emerald-500/15 transition-all"
              title="Reset Sandbox"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-2 text-xs">
            <button
              onClick={() => applyPreset("success_eggs")}
              className={`w-full py-2.5 px-3 rounded-xl border ${tokens.borderClass} ${tokens.bgPage} text-left hover:brightness-105 transition-all flex justify-between items-center cursor-pointer`}
            >
              <span className={`font-semibold ${tokens.textPrimary}`}>🟢 Case 1: Ideal Clean Egg Run</span>
              <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded ${tokens.accentBadge}`}>Success</span>
            </button>

            <button
              onClick={() => applyPreset("fail_balance")}
              className={`w-full py-2.5 px-3 rounded-xl border ${tokens.borderClass} ${tokens.bgPage} text-left hover:brightness-105 transition-all flex justify-between items-center cursor-pointer`}
            >
              <span className={`font-semibold ${tokens.textPrimary}`}>🔴 Case 2: Verification Fail</span>
              <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">Balance Short</span>
            </button>

            <button
              onClick={() => applyPreset("fail_expired")}
              className={`w-full py-2.5 px-3 rounded-xl border ${tokens.borderClass} ${tokens.bgPage} text-left hover:brightness-105 transition-all flex justify-between items-center cursor-pointer`}
            >
              <span className={`font-semibold ${tokens.textPrimary}`}>🔴 Case 3: Freshness Audit Fail</span>
              <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">Expired Lot</span>
            </button>

            <button
              onClick={() => applyPreset("fail_temp")}
              className={`w-full py-2.5 px-3 rounded-xl border ${tokens.borderClass} ${tokens.bgPage} text-left hover:brightness-105 transition-all flex justify-between items-center cursor-pointer`}
            >
              <span className={`font-semibold ${tokens.textPrimary}`}>🔴 Case 4: Cold-Chain Spike</span>
              <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">Temp Spike</span>
            </button>
          </div>
        </div>

        {/* Create manual transaction form */}
        <div className={`p-5 rounded-2xl border ${tokens.borderClass} ${tokens.bgCard} shadow-md`}>
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-emerald-500" />
            <h3 className={`text-sm font-bold ${tokens.textPrimary}`}>Configure Ledger Transaction</h3>
          </div>

          <form onSubmit={handleInitializeTransaction} className="space-y-4 text-xs">
            <div>
              <label className={`block mb-1.5 font-semibold ${tokens.textSecondary}`}>
                B2B Buying Partner (المستورد / المشتري)
              </label>
              <select
                value={selectedBuyerId}
                onChange={(e) => setSelectedBuyerId(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border ${tokens.inputBg}`}
                disabled={activeTx !== null && activeTx.status !== "completed" && activeTx.status !== "failed"}
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nameAr} - Balance: {t.accountBalanceYER.toLocaleString()} YER
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block mb-1.5 font-semibold ${tokens.textSecondary}`}>
                  Supplier Product Category
                </label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value as any)}
                  className={`w-full px-3 py-2 rounded-xl border ${tokens.inputBg}`}
                  disabled={activeTx !== null && activeTx.status !== "completed" && activeTx.status !== "failed"}
                >
                  <option value="بضائع تجارية عامة">بضائع تجارية عامة (Commercial Goods)</option>
                  <option value="شحنة إلكترونيات وقطع غيار">شحنة إلكترونيات وقطع غيار (Electronics & Parts)</option>
                  <option value="مواد استهلاكية ومستلزمات">مواد استهلاكية ومستلزمات (Consumables)</option>
                </select>
              </div>

              <div>
                <label className={`block mb-1.5 font-semibold ${tokens.textSecondary}`}>
                  Volume Quantity / الكمية
                </label>
                <input
                  type="number"
                  min="1"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 0)}
                  className={`w-full px-3 py-2 rounded-xl border ${tokens.inputBg}`}
                  disabled={activeTx !== null && activeTx.status !== "completed" && activeTx.status !== "failed"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block mb-1.5 font-semibold ${tokens.textSecondary}`}>
                  Price YER per item
                </label>
                <input
                  type="number"
                  step="100"
                  value={unitPriceYER}
                  onChange={(e) => setUnitPriceYER(parseInt(e.target.value) || 0)}
                  className={`w-full px-3 py-2 rounded-xl border ${tokens.inputBg}`}
                  disabled={activeTx !== null && activeTx.status !== "completed" && activeTx.status !== "failed"}
                />
              </div>

              <div>
                <label className={`block mb-1.5 font-semibold ${tokens.textSecondary}`}>
                  Chain Temperature (°C)
                </label>
                <input
                  type="number"
                  step="1"
                  value={sensorTemp}
                  onChange={(e) => setSensorTemp(parseInt(e.target.value) || 0)}
                  className={`w-full px-3 py-2 rounded-xl border ${tokens.inputBg}`}
                  disabled={activeTx !== null && activeTx.status !== "completed" && activeTx.status !== "failed"}
                />
              </div>
            </div>

            <div>
              <label className={`block mb-1.5 font-semibold ${tokens.textSecondary}`}>
                Yemeni Logistics Carrier Service
              </label>
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border ${tokens.inputBg}`}
                disabled={activeTx !== null && activeTx.status !== "completed" && activeTx.status !== "failed"}
              />
            </div>

            {/* Calculated cost feedback */}
            <div className={`p-4.5 rounded-xl border space-y-1.5 ${tokens.borderClass} ${tokens.bgPage}`}>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Gross Invoice:</span>
                <span className={`font-semibold font-mono ${tokens.textPrimary}`}>
                  {(orderQuantity * unitPriceYER).toLocaleString()} YER
                </span>
              </div>
              <div className={`flex justify-between text-[11px] border-b pb-1.5 ${tokens.borderClass}`}>
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">B2B Delivery Freight Index (1.5%):</span>
                <span className="text-[#4A6741] font-mono">
                  {Math.round(orderQuantity * unitPriceYER * 0.015).toLocaleString()} YER
                </span>
              </div>
              <div className="flex justify-between font-bold pt-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${tokens.textPrimary}`}>Grand Liquid Settlement:</span>
                <span className="text-amber-600 font-mono font-bold">
                  {(orderQuantity * unitPriceYER + Math.round(orderQuantity * unitPriceYER * 0.015)).toLocaleString()} YER
                </span>
              </div>
            </div>

            <button
              type="submit"
              style={{ backgroundColor: tokens.primaryColor, color: tokens.accentColor }}
              className="w-full py-3 rounded-xl text-xs font-bold hover:brightness-105 active:scale-98 transition-all shadow-sm cursor-pointer text-center"
              disabled={activeTx !== null && activeTx.status !== "completed" && activeTx.status !== "failed"}
            >
              Initialize 5-Stage Transaction Pipeline
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: 5-Step Pipeline Flow State and Ledger (8 Span) */}
      <div className="xl:col-span-8 space-y-6">
        
        {/* State Machine Step Controller */}
        <div className={`p-6 rounded-2xl border ${tokens.borderClass} ${tokens.bgCard} shadow-md`}>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Workflow className="w-5 h-5 text-emerald-500" />
              <h3 className={`text-md font-bold ${tokens.textPrimary}`}>5-Stage Transaction Pipeline Stream</h3>
            </div>

            {activeTx && (
              <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-800 text-yellow-400 border border-slate-700">
                Active ID: {activeTx.id}
              </span>
            )}
          </div>

          {/* Graphical Progress Nodes */}
          <div className="grid grid-cols-5 gap-2 mb-8 relative">
            {[
              { num: 1, labelEn: "Verify", labelAr: "التحقق" },
              { num: 2, labelEn: "Prepare", labelAr: "التخصيص" },
              { num: 3, labelEn: "Match", labelAr: "المطابقة" },
              { num: 4, labelEn: "Settle", labelAr: "التسوية" },
              { num: 5, labelEn: "Deliver", labelAr: "التوصيل" }
            ].map((st) => {
              const ringColor = getStageColor(st.num);
              return (
                <div key={st.num} className="flex flex-col items-center relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${ringColor}`}>
                    {st.num}
                  </div>
                  <span className={`text-[10px] font-bold mt-2 ${tokens.textPrimary}`}>{st.labelEn}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5 font-medium">{st.labelAr}</span>
                </div>
              );
            })}
            
            {/* Visual connector line behind */}
            <div className={`absolute top-5 left-[10%] right-[10%] h-[1px] -z-0 bg-slate-200`}></div>
          </div>

          {/* Active step control controls */}
          {!activeTx ? (
            <div className="text-center py-12 border-2 border-dashed border-emerald-500/10 rounded-2xl space-y-3">
              <FileCheck className="w-12 h-12 text-slate-500 mx-auto opacity-50" />
              <div className="text-sm font-semibold text-slate-400">Pipeline Sandboxed and Awaiting Initialization</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select a scenario quick start or write a custom budget configuration, then execute to inspect financial and sensory checks.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Current stage state report */}
              <div className={`p-4 rounded-xl border flex justify-between items-center ${
                activeTx.status === "completed" 
                  ? "bg-[#F0F4ED] border-[#D1D9CD] text-[#4A6741]" 
                  : activeTx.status === "failed" 
                  ? "bg-rose-50 border-rose-200 text-rose-600" 
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}>
                <div className="text-xs">
                  <div className="font-bold flex items-center gap-1.5 uppercase tracking-wide">
                    {activeTx.status === "completed" && <CheckCircle2 className="w-4.5 h-4.5 text-[#4A6741]" />}
                    {activeTx.status === "failed" && <BadgeAlert className="w-4.5 h-4.5 text-rose-500" />}
                    {activeTx.status === "pending" && <TrendingDown className="w-4.5 h-4.5 text-amber-500 animate-spin" />}
                    <span>Transaction Status: {activeTx.status}</span>
                  </div>
                  <p className="text-[10px] opacity-80 mt-1">
                    {activeTx.status === "completed" 
                      ? "Success: Balanced financial ledger items logged and cold delivery locked in."
                      : activeTx.status === "failed" 
                      ? "Error occurred during execution process. Review logs below for details."
                      : `Awaiting execution of Stage ${activeTx.stage}: ${
                          activeTx.stage === 1 ? "Verification Check" :
                          activeTx.stage === 2 ? "Farming Stock Allocation" :
                          activeTx.stage === 3 ? "Freshness Match Auditing" :
                          activeTx.stage === 4 ? "Double-Entry Bookkeeping Ledger" : "Reefer Delivery Audit"
                        }.`
                     }
                  </p>
                </div>

                {activeTx.status !== "completed" && activeTx.status !== "failed" && (
                  <button
                    onClick={handleStepStage}
                    style={{ backgroundColor: tokens.primaryColor, color: tokens.accentColor }}
                    className="flex items-center gap-1.5 py-2 px-4 rounded-xl font-bold text-xs hover:brightness-105 cursor-pointer shadow-sm"
                  >
                    <span>Run Stage {activeTx.stage}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Console Output Log Terminal */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Atomic Execution Logs (سجلات اليومية للعملية)
                </span>
                <div className="rounded-xl bg-[#1B3016] border border-[#E1E8DC]/20 p-4 font-mono text-[11px] text-[#E6EEE2] h-44 overflow-y-auto space-y-1.5 shadow-inner">
                  {/* Collect all logs */}
                  {activeTx.verificationLogs.map((log, i) => <div key={`v-${i}`} className="opacity-90">{log}</div>)}
                  {activeTx.preparationLogs.map((log, i) => <div key={`p-${i}`} className="text-yellow-200">{log}</div>)}
                  {activeTx.matchingLogs.map((log, i) => <div key={`m-${i}`} className="text-[#A4C639]">{log}</div>)}
                  {activeTx.settlementLogs.map((log, i) => <div key={`s-${i}`} className="text-emerald-200">{log}</div>)}
                  {activeTx.deliveryLogs.map((log, i) => <div key={`d-${i}`} className="text-teal-200">{log}</div>)}
                  
                  {lastError && (
                    <div className="text-red-300 font-bold border-t border-red-400/20 pt-1.5 mt-1.5">
                      🛑 EXCEPTION: {lastError}
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Ledger double-entry viewer */}
              {journalEntries.some(je => je.reference === activeTx.id) ? (
                <div className={`mt-4 p-4 rounded-xl border space-y-3 ${tokens.borderClass} ${tokens.bgPage}`}>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#4A6741]">
                    <FileCheck className="w-4.5 h-4.5 text-[#4A6741]" />
                    <span>Resulting Double-Entry Journal Document (القيد المحاسبي المولد)</span>
                  </div>

                  {journalEntries.filter(je => je.reference === activeTx.id).map((entry) => (
                    <div key={entry.id} className="text-xs font-mono">
                      <div className={`flex justify-between text-slate-500 text-[10px] mb-2 border-b pb-1.5 ${tokens.borderClass}`}>
                        <span>Journal Entry: {entry.id}</span>
                        <span>Reference: {entry.reference}</span>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className={`grid grid-cols-12 gap-1 font-bold text-slate-400 text-[10px] border-b pb-1.5 ${tokens.borderClass}`}>
                          <span className="col-span-6">Chart of Account Header</span>
                          <span className="col-span-3 text-right">Debit (YER)</span>
                          <span className="col-span-3 text-right">Credit (YER)</span>
                        </div>

                        {entry.lines.map((line, idx) => {
                          const acc = accounts.find(a => a.id === line.accountId);
                          return (
                            <div key={idx} className={`grid grid-cols-12 gap-1 text-[11px] py-1 border-b border-dotted ${tokens.borderClass} hover:bg-slate-500/5`}>
                              <span className="col-span-6 text-slate-700 truncate font-semibold">
                                {acc ? `${acc.account_code} - ${acc.nameEn}` : "Unknown Account"}
                              </span>
                              <span className="col-span-3 text-right text-emerald-700 font-bold">
                                {line.debit > 0 ? `${line.debit.toLocaleString()}` : "-"}
                              </span>
                              <span className="col-span-3 text-right text-rose-600 font-bold">
                                {line.credit > 0 ? `${line.credit.toLocaleString()}` : "-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-between mt-3 text-slate-500 text-[10px] pt-2">
                        <span>الوصف العربي: {entry.descriptionAr}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeTx.stage > 3 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold block">Settlement Ledger Queue</span>
                    <p className="text-slate-500 text-[10px] mt-0.5">
                      Advancing to next pipeline step will trigger double entry ledger balance checks across Yemen local currencies with immutable document lockups.
                    </p>
                  </div>
                </div>
              ) : null}

            </div>
          )}

        </div>

        {/* Live Multi-Tenant Balance Monitor */}
        <div className={`p-6 rounded-2xl border ${tokens.borderClass} ${tokens.bgCard} shadow-md`}>
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-5 h-5 text-[#4A6741]" />
            <h3 className={`text-sm font-bold uppercase tracking-wide ${tokens.textPrimary}`}>
              Live Tenant Ledger Vault Tracking (الرقابة المالية الفورية للأطراف)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {tenants.map(t => (
              <div key={t.id} className={`p-4 rounded-xl border space-y-2.5 ${tokens.borderClass} ${tokens.bgPage}`}>
                <div className={`flex justify-between items-center pb-2 border-b ${tokens.borderClass}`}>
                  <span className={`font-bold font-sans truncate ${tokens.textPrimary}`}>{t.nameEn}</span>
                </div>
                
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-medium opacity-70">Vault Balance:</span>
                    <span className="text-[#2D3A26] font-bold font-mono">{t.accountBalanceYER.toLocaleString()} YER</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="font-medium opacity-70">2FA Status:</span>
                    <span className={t.twoFactorEnabled ? "text-[#4A6741] font-bold" : "text-amber-600 font-bold"}>
                      {t.twoFactorEnabled ? "🔐 Required" : "⚠️ Disabled"}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="font-medium opacity-70">Industry Profile:</span>
                    <span className="capitalize font-mono text-[9px]">{t.vertical}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
