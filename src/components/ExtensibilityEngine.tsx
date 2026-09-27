import React, { useState } from "react";
import { useAdaptiveTheme } from "./ThemeEngine";
import { 
  Layers, 
  Boxes, 
  Coins, 
  Truck, 
  Plus, 
  Trash2, 
  FolderPlus,
  Play, 
  CheckCircle, 
  XCircle,
  TrendingDown, 
  KeyRound, 
  AlertCircle,
  Search,
  Settings2,
  GitCompare,
  Gauge,
  UserCheck,
  Building2,
  Shield,
  FileCheck2,
  RefreshCw
} from "lucide-react";

// Types matching current schema patterns
interface NestedCategory {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  metadata: Record<string, any>;
}

interface PackagingUnit {
  id: string;
  name: string;
  conversionFactor: number; // 1 Carton = 24 Pieces
  pricePerUnitMicro: bigint;  // BigInt
}

interface CustomSpawnedEntity {
  id: string;
  clazz: "POULTRY_BARN" | "POULTRY_SLAUGHTER" | "POULTRY_DISTRIB" | "POULTRY_STAFF" | "APPAREL_CRITERIA" | "APPAREL_STAFF";
  name: string;
  attributes: Record<string, any>;
}

interface Currency {
  code: string;
  name: string;
  rateToYER: number; // e.g., USD = 1500 YER, SAR = 400 YER
  isBase: boolean;
}

interface FixedAsset {
  id: string;
  name: string;
  clazz: "REAL_ESTATE" | "FLEET" | "MACHINERY" | "ELECTRONICS";
  costMicro: bigint;
  salvageMicro: bigint;
  usefulLifeMonths: number;
  currentDepreciationMicro: bigint;
  monthsActive: number;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
  active: boolean;
}

interface WarehouseTransfer {
  id: string;
  sourceId: string;
  destId: string;
  itemName: string;
  qty: number;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
}

interface AuditItem {
  id: string;
  name: string;
  systemQty: number;
  physicalQty: number;
  pricePerPieceMicro: bigint;
}

export default function ExtensibilityEngine() {
  const { tokens } = useAdaptiveTheme();
  const [activeSubTab, setActiveSubTab] = useState<"nested" | "eav" | "finance" | "warehouse">("nested");

  // ==========================================
  // STATE 1: NESTED CATEGORIES & PACKAGING UNITS
  // ==========================================
  const [categories, setCategories] = useState<NestedCategory[]>([
    { id: "cat-1", name: "Grocery Direct (جملة أغذية)", parentId: null, level: 0, metadata: { department: "Food", requiresCooling: "false" } },
    { id: "cat-2", name: "Juices & Drinks (عصائر ومشروبات)", parentId: "cat-1", level: 1, metadata: { shelfLifeDays: "90" } },
    { id: "cat-3", name: "Natural Apple Juice (عصير تفاح طبيعي)", parentId: "cat-2", level: 2, metadata: { brixLevel: "11.2", brand: "Saba" } },
    { id: "cat-4", name: "Poultry Operations (شعبة مداجن سبأ)", parentId: null, level: 0, metadata: { isolationProtocol: "Diamond-A" } },
    { id: "cat-5", name: "Egg Logistics (لوجستيات البيض)", parentId: "cat-4", level: 1, metadata: { coolingTargetCelsius: "18" } },
  ]);

  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState<string>("");
  const [newCatMetaKey, setNewCatMetaKey] = useState("");
  const [newCatMetaValue, setNewCatMetaValue] = useState("");

  const [packagingUnits, setPackagingUnits] = useState<PackagingUnit[]>([
    { id: "p-1", name: "Carton (كرتونة)", conversionFactor: 24, pricePerUnitMicro: 48000000n }, // 48,000 YER
    { id: "p-2", name: "Box (علبة علوية)", conversionFactor: 12, pricePerUnitMicro: 24000000n },   // 24,000 YER
    { id: "p-3", name: "Pack (كيس طرد)", conversionFactor: 6, pricePerUnitMicro: 12500000n },     // 12,500 YER
    { id: "p-4", name: "Piece (حبة فردية)", conversionFactor: 1, pricePerUnitMicro: 2100000n },    // 2,100 YER
  ]);

  // Conversions calculator state
  const [calcBaseUnit, setCalcBaseUnit] = useState<string>("p-1");
  const [calcQuantity, setCalcQuantity] = useState<number>(5);

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const parent = categories.find(c => c.id === newCatParent);
    const newLvl = parent ? parent.level + 1 : 0;
    
    const extraMeta: Record<string, any> = {};
    if (newCatMetaKey.trim() && newCatMetaValue.trim()) {
      extraMeta[newCatMetaKey.trim()] = newCatMetaValue.trim();
    }

    const item: NestedCategory = {
      id: `cat-${Date.now()}`,
      name: newCatName,
      parentId: newCatParent || null,
      level: newLvl,
      metadata: { ...extraMeta, createdAt: "2026-05-30" }
    };

    setCategories([...categories, item]);
    setNewCatName("");
    setNewCatParent("");
    setNewCatMetaKey("");
    setNewCatMetaValue("");
  };

  const handleDeleteCategory = (id: string) => {
    setCategories(categories.filter(c => c.id !== id && c.parentId !== id));
  };

  // Convert packaging units back to base pieces and compute precise BigInt micro monetary values
  const getCalculationSummary = () => {
    const selectedUnit = packagingUnits.find(u => u.id === calcBaseUnit);
    if (!selectedUnit) return { pieces: 0, totalMicro: 0n, formattedYER: "0" };

    const totalPieces = selectedUnit.conversionFactor * calcQuantity;
    const totalMicro = selectedUnit.pricePerUnitMicro * BigInt(calcQuantity);
    const formattedYER = (Number(totalMicro) / 1000).toLocaleString("en-US", { minimumFractionDigits: 2 });

    return {
      pieces: totalPieces,
      totalMicro,
      formattedYER
    };
  };

  // ==========================================
  // STATE 2: DYNAMIC EAV SPAWNER (Poultry & Apparel Configs)
  // ==========================================
  const [spawnedEntities, setSpawnedEntities] = useState<CustomSpawnedEntity[]>([
    {
      id: "e-1",
      clazz: "POULTRY_BARN",
      name: "Barn No. 4 (عنبر الدجاج رقم ٤)",
      attributes: {
        capacity: 15000,
        automatedFeeders: true,
        ventilationRating: "A++",
        supervisor: "م. محمد الصنعاني"
      }
    },
    {
      id: "e-2",
      clazz: "POULTRY_SLAUGHTER",
      name: "Saba Al-Yemen Slaughterhouse (مسلخ سبأ المركزي)",
      attributes: {
        dailyThroughput: 8000,
        halalCertified: true,
        coolingCapacityTons: 25,
        locationSector: "تعز - جبل حبشي"
      }
    },
    {
      id: "e-3",
      clazz: "APPAREL_CRITERIA",
      name: "Summer Linen Fabrics (خامة الكتان الصيفي المعتمد)",
      attributes: {
        sizesAvailable: ["M", "L", "XL", "XXL"],
        colorsArray: ["أبيض نقر", "أزرق كحلي", "رمادي داكن"],
        weavingStandard: "Premium ISO-Cotton",
        supplierCode: "YEM-TEXTILE-99"
      }
    }
  ]);

  // Spawner form state
  const [spawnClass, setSpawnClass] = useState<CustomSpawnedEntity["clazz"]>("POULTRY_BARN");
  const [spawnName, setSpawnName] = useState("");
  const [spawnKey1, setSpawnKey1] = useState("");
  const [spawnVal1, setSpawnVal1] = useState("");
  const [spawnKey2, setSpawnKey2] = useState("");
  const [spawnVal2, setSpawnVal2] = useState("");

  const handleSpawnEntity = () => {
    if (!spawnName.trim()) return;

    const attributes: Record<string, any> = {};
    if (spawnKey1.trim() && spawnVal1.trim()) {
      attributes[spawnKey1.trim()] = spawnVal1.trim();
    }
    if (spawnKey2.trim() && spawnVal2.trim()) {
      attributes[spawnKey2.trim()] = spawnVal2.trim();
    }

    const newSpawn: CustomSpawnedEntity = {
      id: `spawn-${Date.now()}`,
      clazz: spawnClass,
      name: spawnName,
      attributes: {
        ...attributes,
        spawnedAt: "2026-05-30T00:43Z"
      }
    };

    setSpawnedEntities([...spawnedEntities, newSpawn]);
    setSpawnName("");
    setSpawnKey1("");
    setSpawnVal1("");
    setSpawnKey2("");
    setSpawnVal2("");
  };

  const handleDeleteSpawned = (id: string) => {
    setSpawnedEntities(spawnedEntities.filter(s => s.id !== id));
  };


  // ==========================================
  // STATE 3: MULTI-CURRENCY & ASSETS (Depreciation Ledger)
  // ==========================================
  const [currencies, setCurrencies] = useState<Currency[]>([
    { code: "YER", name: "Yemeni Rial (ريال يمني)", rateToYER: 1.0, isBase: true },
    { code: "USD", name: "US Dollar (دولار أمريكي)", rateToYER: 1500.0, isBase: false },
    { code: "SAR", name: "Saudi Riyal (ريال سعودي)", rateToYER: 400.0, isBase: false },
  ]);

  const [assets, setAssets] = useState<FixedAsset[]>([
    {
      id: "a-1",
      name: "Thermo-King Int'l Freezer Truck (شاحنة تبريد وتوزيع)",
      clazz: "FLEET",
      costMicro: 45000000000n, // 45,000,000 YER
      salvageMicro: 5000000000n, // 5,000,000 YER
      usefulLifeMonths: 60,       // 5 years
      currentDepreciationMicro: 13333333333n, // Accum
      monthsActive: 20
    },
    {
      id: "a-2",
      name: "Automatic Packaging & Sorting Line (خط التعبئة والفرز الآلي)",
      clazz: "MACHINERY",
      costMicro: 120000000000n, // 120,000,000 YER
      salvageMicro: 15000000000n, // 15,000,000 YER
      usefulLifeMonths: 120,      // 10 years
      currentDepreciationMicro: 8750000000n,
      monthsActive: 10
    }
  ]);

  // Asset Form State
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetClass, setNewAssetClass] = useState<FixedAsset["clazz"]>("MACHINERY");
  const [newAssetCost, setNewAssetCost] = useState<number>(0);
  const [newAssetSalvage, setNewAssetSalvage] = useState<number>(0);
  const [newAssetLife, setNewAssetLife] = useState<number>(60);

  // Multi-currency temporary converter state
  const [convAmount, setConvAmount] = useState<number>(100);
  const [convFrom, setConvFrom] = useState("USD");
  const [convTo, setConvTo] = useState("YER");

  const handleAddAsset = () => {
    if (!newAssetName.trim() || newAssetCost <= 0) return;

    const newAsset: FixedAsset = {
      id: `asset-${Date.now()}`,
      name: newAssetName,
      clazz: newAssetClass,
      costMicro: BigInt(Math.round(newAssetCost * 1000)),
      salvageMicro: BigInt(Math.round(newAssetSalvage * 1000)),
      usefulLifeMonths: newAssetLife,
      currentDepreciationMicro: 0n,
      monthsActive: 0
    };

    setAssets([...assets, newAsset]);
    setNewAssetName("");
    setNewAssetCost(0);
    setNewAssetSalvage(0);
  };

  const handleSimulateDepreciationStep = () => {
    setAssets(assets.map(asset => {
      // Straight line depreciation formula: (Cost - Salvage) / UsefulLife
      const depreciableAmount = asset.costMicro - asset.salvageMicro;
      if (depreciableAmount <= 0n) return asset;

      // Safe BigInt precision matching casting to bypass division rules
      const monthlyDeprec = BigInt(Math.round(Number(depreciableAmount) / asset.usefulLifeMonths));
      const nextDeprecSum = asset.currentDepreciationMicro + monthlyDeprec;
      
      // Prevent depreciating past cost minus salvage
      const finalDeprec = nextDeprecSum > depreciableAmount ? depreciableAmount : nextDeprecSum;

      return {
        ...asset,
        currentDepreciationMicro: finalDeprec,
        monthsActive: asset.monthsActive + 1
      };
    }));
  };

  const getCurrencyConvOutput = () => {
    const fromCur = currencies.find(c => c.code === convFrom);
    const toCur = currencies.find(c => c.code === convTo);
    if (!fromCur || !toCur) return "0";

    // Convert Amount to Base (YER) then to Target
    const amountInBase = convAmount * fromCur.rateToYER;
    const targetAmount = amountInBase / toCur.rateToYER;

    return targetAmount.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  };


  // ==========================================
  // STATE 4: MULTI-WAREHOUSE & INTER-TRANSFER & AUDITS
  // ==========================================
  const [warehouses, setWarehouses] = useState<Warehouse[]>([
    { id: "w-1", name: "Sana'a Sector North (مستودع صنعاء الشمالي)", location: "شارع الستين الشمالي", active: true },
    { id: "w-2", name: "Dhamar Transit Enclave (مخزن ومبرد ذمار المركزي)", location: "مدينة ذمار - جوار المجمع", active: true },
    { id: "w-3", name: "Hodeidah Central Silo (مستودع الصوامع والمخازن بالحديدة)", location: "ميناء الحديدة - رصيف ٥", active: true },
  ]);

  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([
    { id: "tr-1", sourceId: "w-1", destId: "w-2", itemName: "سير تيمين سيارات شاص OEM", qty: 150, status: "PENDING_APPROVAL" },
    { id: "tr-2", sourceId: "w-3", destId: "w-1", itemName: "فوج أعلاف ألمانية مغذية", qty: 80, status: "APPROVED" },
  ]);

  const [auditedItems, setAuditedItems] = useState<AuditItem[]>([
    { id: "ai-1", name: "أطباق بيض مزارع سبأ نخب أول", systemQty: 500, physicalQty: 497, pricePerPieceMicro: 4200000n }, // Variance 3 plate loss
    { id: "ai-2", name: "قطع غيار فلاتر هواء هيلوكس", systemQty: 80, physicalQty: 80, pricePerPieceMicro: 12000000n },   // Variance 0
    { id: "ai-3", name: "علب حليب كانديا ممتاز مجفف", systemQty: 120, physicalQty: 122, pricePerPieceMicro: 1800000n }, // Variance +2 surplus
  ]);

  // Transfer Forms
  const [trSource, setTrSource] = useState("w-1");
  const [trDest, setTrDest] = useState("w-2");
  const [trItem, setTrItem] = useState("");
  const [trQty, setTrQty] = useState(10);

  // New warehouse forms
  const [newWhName, setNewWhName] = useState("");
  const [newWhLoc, setNewWhLoc] = useState("");

  const handleAddWarehouse = () => {
    if (!newWhName.trim()) return;
    const item: Warehouse = {
      id: `w-${Date.now()}`,
      name: newWhName,
      location: newWhLoc,
      active: true
    };
    setWarehouses([...warehouses, item]);
    setNewWhName("");
    setNewWhLoc("");
  };

  const handleInitTransfer = () => {
    if (!trItem.trim() || trQty <= 0) return;
    if (trSource === trDest) return;

    const newTr: WarehouseTransfer = {
      id: `tr-${Date.now()}`,
      sourceId: trSource,
      destId: trDest,
      itemName: trItem,
      qty: trQty,
      status: "PENDING_APPROVAL"
    };

    setTransfers([newTr, ...transfers]);
    setTrItem("");
  };

  const handleResolveTransfer = (id: string, status: "APPROVED" | "REJECTED") => {
    setTransfers(transfers.map(tr => tr.id === id ? { ...tr, status } : tr));
  };

  const handleUpdatePhysicalQty = (id: string, physicalQty: number) => {
    setAuditedItems(auditedItems.map(item => item.id === id ? { ...item, physicalQty } : item));
  };

  // Variance calculator returning precise micro BigInt currency sums
  const getAuditTotals = () => {
    let totalAdjustMicro = 0n;
    let absoluteDiscrepancyMicro = 0n;

    auditedItems.forEach(item => {
      const difference = BigInt(item.physicalQty - item.systemQty);
      const lineVariance = difference * item.pricePerPieceMicro;
      totalAdjustMicro += lineVariance;
      absoluteDiscrepancyMicro += lineVariance < 0n ? -lineVariance : lineVariance;
    });

    return {
      netAdjustmentYER: (Number(totalAdjustMicro) / 1000).toLocaleString("en-US", { minimumFractionDigits: 2 }),
      absoluteDiscrepancyYER: (Number(absoluteDiscrepancyMicro) / 1000).toLocaleString("en-US", { minimumFractionDigits: 2 }),
      isLoss: totalAdjustMicro < 0n
    };
  };

  // Helper mapping category elements recursively for a true nested visualization tree
  const renderCategoryTree = (parentId: string | null, depth: number) => {
    const list = categories.filter(c => c.parentId === parentId);
    if (list.length === 0) return null;

    return (
      <div className="pl-4 border-l border-slate-200 mt-2 space-y-2">
        {list.map(cat => (
          <div key={cat.id} className="p-3 bg-white hover:bg-slate-50 border rounded-xl shadow-xs text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                <span className="text-[10px] text-emerald-600">L{depth}</span>
                {cat.name}
              </span>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                title="حذف التصنيف والفروع"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {/* Attributes JSONB simulated viewer */}
            <div className="flex flex-wrap gap-1 mt-1 text-[9px] font-mono text-slate-500">
              <span className="bg-slate-100 rounded px-1.5 py-0.5">category_id: {cat.id}</span>
              {Object.entries(cat.metadata).map(([k, v]) => (
                <span key={k} className="bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5">
                  {k}: "{v}"
                </span>
              ))}
            </div>

            {/* Render children recursively */}
            {renderCategoryTree(cat.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  const auditSums = getAuditTotals();

  return (
    <div className={`p-6 rounded-2xl border ${tokens.borderClass} ${tokens.bgCard} shadow-md space-y-6 transition-all duration-300`}>
      
      {/* Arabic and English Portal Header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 border-dashed ${tokens.borderClass}`}>
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="w-6 h-6 text-[#4A6741]" />
            <h2 className={`text-xl font-black ${tokens.textPrimary} tracking-tight`}>
              B2B Absolute Extensibility Engine
            </h2>
          </div>
          <p className={`text-xs ${tokens.textSecondary} mt-1`} dir="rtl">
            محرك التمدد الشمولي لمنع تعديلات الجداول - إدارة الفئات المتداخلة، مصفوفة العبوات الرياضية، تفريغ الخصائص (EAV)، وموازين إهلاك الأصول بالمايكرو والمستودعات المفتوحة.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono mt-3 md:mt-0 px-3 py-1 bg-[#E6EEE2] text-[#1B3016] border border-[#A4C639]/30 rounded-full font-bold">
          <Settings2 className="w-3.5 h-3.5 text-[#4A6741]" />
          <span>Extensibility Schema Compliant (YEM-2026)</span>
        </div>
      </div>

      {/* Controller inner tabs navigation */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl max-w-2xl">
        {[
          { id: "nested", label: "Categories & Packages", descAr: "التصنيفات والعبوات", icon: Layers },
          { id: "eav", label: "EAV Profiler Spawner", descAr: "خصائص الكيانات المخصصة", icon: FolderPlus },
          { id: "finance", label: "Currency & Depreciation", descAr: "إهلاك الأصول والعملات", icon: Coins },
          { id: "warehouse", label: "Warehouses & Audits", descAr: "المستودعات والجرد البيني", icon: Truck }
        ].map(tab => {
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex-1 min-w-[140px] px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                active 
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <tab.icon className={`w-4 h-4 ${active ? "text-[#4A6741]" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </div>
              <span className="text-[8px] font-normal opacity-70" dir="rtl">{tab.descAr}</span>
            </button>
          );
        })}
      </div>

      {/* ==========================================
          TAB 1: NESTED CATEGORIES & PACKAGING UNITS
          ========================================== */}
      {activeSubTab === "nested" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Categories Tree Designer */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-4 rounded-xl border bg-slate-50/75 text-xs text-slate-600 space-y-3">
              <h4 className="font-bold text-[#1B3016] text-sm flex items-center gap-1.5 border-b pb-1.5">
                <FolderPlus className="w-4 h-4 text-[#4A6741]" />
                <span>Nested Hierarchical Tree (شجرة التصنيفات المتداخلة لا نهائياً)</span>
              </h4>
              
              <div className="space-y-2">
                <p className="font-medium" dir="rtl">يمكن للبقالة أو المنشآت إنشاء تصنيف مثل "أجود العصائر" متفرع من "المواد الغذائية" لإدارة الجماليات وقنوات الاستيراد الحرة.</p>
                
                {/* Visual Category Tree Canvas */}
                <div className="p-3.5 rounded-lg border bg-white max-h-[290px] overflow-y-auto space-y-2">
                  {renderCategoryTree(null, 0)}
                </div>
              </div>

              {/* Add category entity builder */}
              <div className="bg-white p-3.5 rounded-xl border border-dashed space-y-2.5">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Create Dynamic Sub-Category</span>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="اسم الفئة الجديدة"
                    className="p-2 rounded border bg-white"
                  />
                  <select
                    value={newCatParent}
                    onChange={(e) => setNewCatParent(e.target.value)}
                    className="p-2 rounded border bg-white"
                  >
                    <option value="">-- فئة رئيسية (Root Category) --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Additional dynamic metadata */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={newCatMetaKey}
                    onChange={(e) => setNewCatMetaKey(e.target.value)}
                    placeholder="مفتاح إضافي (e.g. brand)"
                    className="p-2 rounded border bg-slate-50 font-mono text-[10px]"
                  />
                  <input
                    type="text"
                    value={newCatMetaValue}
                    onChange={(e) => setNewCatMetaValue(e.target.value)}
                    placeholder="قيمة المتغير (e.g. Candy)"
                    className="p-2 rounded border bg-slate-50"
                  />
                </div>

                <button
                  onClick={handleAddCategory}
                  className="w-full py-2 bg-[#1B3016] text-[#E6EEE2] hover:bg-[#2F4F24] rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  حفظ وتوليد الفئة في الهوية المتكاملة
                </button>
              </div>
            </div>
          </div>

          {/* Specialized Packaging Unit Calculator */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-4 rounded-xl border bg-slate-50/75 space-y-4">
              <h4 className="font-bold text-[#1B3016] text-sm flex items-center gap-1.5 border-b pb-1.5">
                <Boxes className="w-4 h-4 text-[#4A6741]" />
                <span>Multi-Packaging Conversion Specs (مصفوفة العبوات ومطابقة رصيد الفلس)</span>
              </h4>

              <p className="text-xs text-slate-600 leading-relaxed" dir="rtl">
                إقران العبوات الحجمية الكبرى بالكرتون بالوحدات الفردية الفلت (الحبة) وتحديد الأسعار الدقيقة مع حفظ نسبة التقريب.
              </p>

              {/* Standard Packaging scale definition table */}
              <div className="border rounded-xl bg-white overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-[#F4F7F1] text-slate-700 font-bold border-b text-[10px]">
                    <tr>
                      <th className="p-2 text-center">العبوة المرتفعة (Packaging)</th>
                      <th className="p-2 text-center">الوحدة الصغرى (Ratio to Piece)</th>
                      <th className="p-2 text-center">سعر العبوة (YER)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono font-medium text-slate-700">
                    {packagingUnits.map(unit => (
                      <tr key={unit.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-slate-800 text-center">{unit.name}</td>
                        <td className="p-2.5 text-center text-emerald-700 font-bold">1 {unit.name.split(" ")[0]} = {unit.conversionFactor} Pieces</td>
                        <td className="p-2.5 text-center text-slate-800">{(Number(unit.pricePerUnitMicro) / 1000).toLocaleString()} YER</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Conversion validation calculator */}
              <div className="bg-[#1B3016] text-[#E6EEE2] p-4 rounded-xl border border-[#A4C639]/20 space-y-3.5 shadow-md">
                <span className="text-[10px] font-bold text-[#A4C639] uppercase tracking-wider block">
                  On-the-fly Multi-Unit Pricing Calculator (مستخرج موازين تسعير العبوات)
                </span>

                <div className="grid grid-cols-2 gap-3 text-slate-800 text-xs text-right" dir="rtl">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-300 block mb-1">العبوة المراد شراؤها</label>
                    <select
                      value={calcBaseUnit}
                      onChange={(e) => setCalcBaseUnit(e.target.value)}
                      className="w-full p-2 rounded bg-white font-bold"
                    >
                      {packagingUnits.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-300 block mb-1">الكمية الإجمالية للمستند</label>
                    <input
                      type="number"
                      value={calcQuantity}
                      onChange={(e) => setCalcQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2 rounded bg-white text-left font-mono"
                    />
                  </div>
                </div>

                {/* Arithmetic conversion output mathematically checked with BigInt parameters */}
                <div className="border-t border-[#A4C639]/20 pt-3 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-[#A4C639] block uppercase">Converted Base Pieces</span>
                    <strong className="text-sm font-mono tracking-wide">{getCalculationSummary().pieces} Units / حبة فردية</strong>
                  </div>
                  <div className="text-right space-y-0.5" dir="rtl">
                    <span className="text-[10px] text-[#A4C639] block uppercase text-left">Calculated Financial micro-YER</span>
                    <strong className="text-md font-mono text-emerald-400 font-black">{getCalculationSummary().formattedYER} YER</strong>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}


      {/* ==========================================
          TAB 2: CUSTOM EAV SPAWNER
          ========================================== */}
      {activeSubTab === "eav" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 rounded-xl border bg-slate-50/75 text-xs text-slate-600 space-y-3">
            <h4 className="font-bold text-[#1B3016] text-sm flex items-center gap-1.5 border-b pb-1.5">
              <Settings2 className="w-4 h-4 text-[#4A6741]" />
              <span>Custom Enterprise Poly-Extension Spawner (كيانات تخصيص المنتجات والمستودعات)</span>
            </h4>
            <p className="leading-relaxed" dir="rtl">
              يتيح محرك B2B للشركات توليد خصائص ديناميكية على الطاير (مثل الأقسام المخصصة، مستويات الضمان، ومصفوفات المواصفات) لتخزينها في عمود JSONB لتبادل البيانات دون تعديل البنية الأساسية.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              
              {/* Spawner Input Form Dashboard */}
              <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-dashed space-y-3">
                <span className="text-[10px] font-bold text-[#1B3016] uppercase tracking-wider block border-b pb-1">
                  Spawn Extensible Properties Controller
                </span>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 block uppercase font-bold">Industry Target Entity</label>
                    <select
                      value={spawnClass}
                      onChange={(e) => setSpawnClass(e.target.value as any)}
                      className="w-full p-2.5 rounded border bg-white font-bold"
                    >
                      <option value="POULTRY_BARN">📦 Custom Warehouse Section / قسم مستودع مخصص</option>
                      <option value="POULTRY_SLAUGHTER">⚙️ Assembly & Processing / خط معالجة وتغليف</option>
                      <option value="POULTRY_DISTRIB">🚚 Distribution Line / خط توزيع وإمداد</option>
                      <option value="POULTRY_STAFF">👤 Field Staff / كادر تشغيلي ميداني</option>
                      <option value="APPAREL_CRITERIA">📏 Product Spec Criteria / مصفوفة مواصفات المنتجات</option>
                      <option value="APPAREL_STAFF">👤 Specialist Staff / طاقم متخصص</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 block uppercase font-bold">Custom Entity Named Description</label>
                    <input
                      type="text"
                      value={spawnName}
                      onChange={(e) => setSpawnName(e.target.value)}
                      placeholder="e.g. قسم التخزين رقم ١"
                      className="w-full p-2 border rounded font-semibold text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500">مفتاح خاص 1 (Key)</label>
                      <input
                        type="text"
                        value={spawnKey1}
                        onChange={(e) => setSpawnKey1(e.target.value)}
                        placeholder="capacity, color_tag"
                        className="w-full p-1.5 border rounded font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500">قيمة المتغير 1 (Value)</label>
                      <input
                        type="text"
                        value={spawnVal1}
                        onChange={(e) => setSpawnVal1(e.target.value)}
                        placeholder="22000, أسود كلاسيكي"
                        className="w-full p-1.5 border rounded"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500">مفتاح خاص 2 (Key)</label>
                      <input
                        type="text"
                        value={spawnKey2}
                        onChange={(e) => setSpawnKey2(e.target.value)}
                        placeholder="temp_target, shift"
                        className="w-full p-1.5 border rounded font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500">قيمة المتغير 2 (Value)</label>
                      <input
                        type="text"
                        value={spawnVal2}
                        onChange={(e) => setSpawnVal2(e.target.value)}
                        placeholder="24.2, الوردية الليلية"
                        className="w-full p-1.5 border rounded"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSpawnEntity}
                  className="w-full py-2.5 bg-[#4A6741] text-white hover:bg-[#3E5637] rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  ضخ وتوليد الكيان التخصصي في المستودع
                </button>
              </div>

              {/* Render Spawned JSONB List */}
              <div className="lg:col-span-7 space-y-3 max-h-[380px] overflow-y-auto pr-1 text-right" dir="rtl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-left" dir="ltr">
                  Live JSONB Attributes Registry (معرض الكيانات المخصصة)
                </span>

                {spawnedEntities.map(ent => (
                  <div key={ent.id} className="p-3.5 rounded-xl border bg-white space-y-2 text-right hover:border-emerald-300 transition-all shadow-xs">
                    <div className="flex justify-between items-center flex-row-reverse">
                      <span className="text-[10px] font-mono tracking-wider font-bold uppercase bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">
                        {ent.clazz}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-xs">{ent.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">({ent.id})</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-900 text-[#E6EEE2] p-3 font-mono text-[10px] text-left overflow-x-auto" dir="ltr">
                      <pre className="whitespace-pre">{JSON.stringify(ent.attributes, null, 2)}</pre>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <button
                        onClick={() => handleDeleteSpawned(ent.id)}
                        className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3" />
                        <span>حذف الكيان المستودع</span>
                      </button>
                      <span>تاريخ الإنشاء التلقائي: 2026-05-30</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}


      {/* ==========================================
          TAB 3: MULTI-CURRENCY & ASSETS
          ========================================== */}
      {activeSubTab === "finance" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Multi exchange Currency block */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 rounded-xl border bg-slate-50/75 space-y-3.5">
              <h4 className="font-bold text-[#1B3016] text-sm flex items-center gap-1.5 border-b pb-1.5">
                <GitCompare className="w-4 h-4 text-[#4A6741]" />
                <span>Arbitrage Exchange (سجل العملات المتعددة ومقايصات الصرف)</span>
              </h4>

              <div className="space-y-2">
                {currencies.map(cur => (
                  <div key={cur.code} className="p-2.5 rounded-lg border bg-white flex justify-between items-center text-xs">
                    <strong className="font-mono text-slate-800">{cur.code}</strong>
                    <span className="text-slate-500">{cur.name}</span>
                    <span className="font-mono font-bold bg-[#E6EEE2] text-[#1B3016] px-1.5 py-0.5 rounded text-[10px]">
                      {cur.rateToYER.toLocaleString()} YER
                    </span>
                  </div>
                ))}
              </div>

              {/* Currency swap simulation */}
              <div className="p-3.5 rounded-xl border bg-white space-y-2.5 text-xs shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Cross-Currency Calculator</span>
                
                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    type="number"
                    value={convAmount}
                    onChange={(e) => setConvAmount(Number(e.target.value))}
                    className="p-1.5 rounded border text-center font-mono"
                  />
                  <select
                    value={convFrom}
                    onChange={(e) => setConvFrom(e.target.value)}
                    className="p-1 rounded border font-bold"
                  >
                    {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                  <select
                    value={convTo}
                    onChange={(e) => setConvTo(e.target.value)}
                    className="p-1 rounded border font-bold"
                  >
                    {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>

                <div className="text-center bg-[#F4F7F1] p-2 rounded-lg border border-dashed text-[#1B3016] text-xs font-black font-mono">
                  {convAmount} {convFrom} = {getCurrencyConvOutput()} {convTo}
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Assets straight line depreciation ledger */}
          <div className="lg:col-span-8 space-y-4">
            <div className="p-4 rounded-xl border bg-slate-50/75 space-y-4">
              <div className="flex justify-between items-center border-b pb-1.5">
                <h4 className="font-bold text-[#1B3016] text-sm flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#4A6741]" />
                  <span>Fixed Assets & Straight-Line Depreciation Ledger (الأصول المرقمنة المتوازنة)</span>
                </h4>
                <button
                  onClick={handleSimulateDepreciationStep}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Depreciate 1 Month / ترحيل استهلاك شهر</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed" dir="rtl">
                يتبع النظام مبدأ الـ Micro-units المتقدمة لتجنيب إهلاك الأصول الثابتة (سيارات شحن، مصانع بياض، إنفرتيرات طاقة شمسية) أية فجوات تقريب. القيمة المحاسبية الصافية = تكلفة الأصل - الإهلاك المتراكم.
              </p>

              {/* Render Current Fixed Assets Table */}
              <div className="border rounded-xl bg-white overflow-hidden text-xs">
                <table className="w-full text-left font-sans">
                  <thead className="bg-[#F4F7F1] text-slate-700 font-bold border-b text-[10px]">
                    <tr>
                      <th className="p-2">اسم الأصل الثابت (Asset Description)</th>
                      <th className="p-2 text-center">تكلفة الشراء (Cost)</th>
                      <th className="p-2 text-center">الإهلاك المتراكم (Depreciation)</th>
                      <th className="p-2 text-center">المدة النشطة (Months)</th>
                      <th className="p-2 text-right">صافي القيمة الدفترية (Book Value)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono font-medium text-slate-700 text-[11px]">
                    {assets.map(asset => {
                      const bookValueMicro = asset.costMicro - asset.currentDepreciationMicro;
                      const cost = (Number(asset.costMicro) / 1000).toLocaleString();
                      const deprec = (Number(asset.currentDepreciationMicro) / 1000).toLocaleString();
                      const bookVal = (Number(bookValueMicro) / 1000).toLocaleString();
                      return (
                        <tr key={asset.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-sans font-bold text-slate-800 text-left">{asset.name}</td>
                          <td className="p-2.5 text-center">{cost} YER</td>
                          <td className="p-2.5 text-center text-red-600">+{deprec} YER</td>
                          <td className="p-2.5 text-center text-slate-600">
                             <span className="bg-slate-100 border px-1.5 py-0.5 rounded text-[10px] font-bold">{asset.monthsActive} / {asset.usefulLifeMonths}M</span>
                          </td>
                          <td className="p-2.5 text-right text-emerald-600 font-bold">{bookVal} YER</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add New Fixed Asset builder Form */}
              <div className="bg-white p-4 rounded-xl border border-dashed space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase block border-b pb-1">أضف أصل ثابت دفترياً (Acquire Fixed Asset)</span>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                  <div className="space-y-1 col-span-1 md:col-span-2">
                    <label className="font-bold text-slate-500 block">اسم الأصل ووصفه الفني</label>
                    <input
                      type="text"
                      value={newAssetName}
                      onChange={(e) => setNewAssetName(e.target.value)}
                      placeholder="e.g. خط إنضاج وتفريد مجمدات"
                      className="w-full p-2 border rounded font-semibold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">تصنيف الأصل</label>
                    <select
                      value={newAssetClass}
                      onChange={(e) => setNewAssetClass(e.target.value as any)}
                      className="w-full p-2 border rounded font-bold"
                    >
                      <option value="REAL_ESTATE">🏢 Real Estate / عقارات ومزارع</option>
                      <option value="FLEET">🚚 Fleet / شاحنات ومعدات لوجستية</option>
                      <option value="MACHINERY">⚙️ Machinery / آلات ومكائن فرز</option>
                      <option value="ELECTRONICS">⚡ Electronics / حواسيب وبطاريات</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">قيمة الشراء (YER)</label>
                    <input
                      type="number"
                      value={newAssetCost}
                      onChange={(e) => setNewAssetCost(Math.max(0, Number(e.target.value)))}
                      placeholder="YER Cost"
                      className="w-full p-2 border rounded font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">العمر بالأشهر (Useful Life)</label>
                    <input
                      type="number"
                      value={newAssetLife}
                      onChange={(e) => setNewAssetLife(Math.max(1, Number(e.target.value)))}
                      placeholder="Useful months"
                      className="w-full p-2 border rounded font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleAddAsset}
                    className="px-6 py-2 bg-[#1B3016] text-[#E6EEE2] hover:bg-[#2F4F24] rounded-lg text-xs font-bold shadow transition-all cursor-pointer"
                  >
                    اعتماد وتسجيل الأصل بالأستاذ العام
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}


      {/* ==========================================
          TAB 4: MULTI-WAREHOUSE & TRANSFERS & AUDITS
          ========================================== */}
      {activeSubTab === "warehouse" && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Multi-warehouse list constructor */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-4 rounded-xl border bg-slate-50/75 space-y-3.5">
                <h4 className="font-bold text-[#1B3016] text-sm flex items-center gap-1.5 border-b pb-1.5">
                  <Building2 className="w-4 h-4 text-[#4A6741]" />
                  <span>Logical Warehouse Grid (شبكة فروع ومستودع المستأجر المالي)</span>
                </h4>

                <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                  {warehouses.map(wh => (
                    <div key={wh.id} className="p-2.5 rounded-lg border bg-white text-xs text-right space-y-1" dir="rtl">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">{wh.name}</span>
                        <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">ACTIVE</span>
                      </div>
                      <p className="text-[10px] text-slate-400">العنوان: {wh.location || "غير مسجل"}</p>
                    </div>
                  ))}
                </div>

                {/* Add dynamic new warehouse */}
                <div className="bg-white p-3 rounded-lg border border-dashed space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Spawn New Warehouse Vault</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      value={newWhName}
                      onChange={(e) => setNewWhName(e.target.value)}
                      placeholder="اسم المستودع"
                      className="p-1.5 border rounded"
                    />
                    <input
                      type="text"
                      value={newWhLoc}
                      onChange={(e) => setNewWhLoc(e.target.value)}
                      placeholder="موقع الفرع"
                      className="p-1.5 border rounded"
                    />
                  </div>
                  <button
                    onClick={handleAddWarehouse}
                    className="w-full py-1.5 bg-[#1B3016] text-[#E6EEE2] text-xs font-bold rounded-lg hover:bg-[#2F4F24] transition-all cursor-pointer"
                  >
                    حفظ وإشهار المستودع المقفل
                  </button>
                </div>
              </div>
            </div>

            {/* Warehouse Inter-Transfers Approval Module */}
            <div className="lg:col-span-8 space-y-4">
              <div className="p-4 rounded-xl border bg-slate-50/75 space-y-4">
                <h4 className="font-bold text-[#1B3016] text-sm flex items-center gap-1.5 border-b pb-1.5">
                  <Truck className="w-4 h-4 text-[#4A6741]" />
                  <span>Inter-Warehouse Transfers & Approval Flow (المناقلات البينية وموافقة المشرفين)</span>
                </h4>

                <div className="space-y-2">
                  {transfers.map(tr => {
                    const srcWh = warehouses.find(w => w.id === tr.sourceId)?.name.split(" ")[0] || "مستودع صنعاء";
                    const destWh = warehouses.find(w => w.id === tr.destId)?.name.split(" ")[0] || "مستودع ذمار";

                    return (
                      <div key={tr.id} className="p-3 bg-white border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-slate-800 text-[13px]">{tr.itemName}</strong>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold border border-amber-200">الكمية: {tr.qty}</span>
                          </div>
                          
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                            <span className="text-[#4A6741] font-sans font-bold">{srcWh}</span>
                            <span>➔</span>
                            <span className="text-slate-600 font-sans font-bold">{destWh}</span>
                          </div>
                        </div>

                        {/* Staged Approvals simulation button controls */}
                        <div className="flex items-center gap-1.5">
                          {tr.status === "PENDING_APPROVAL" ? (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleResolveTransfer(tr.id, "APPROVED")}
                                className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold shadow hover:bg-emerald-500 cursor-pointer"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>اعتماد والنقل المالي</span>
                              </button>
                              <button
                                onClick={() => handleResolveTransfer(tr.id, "REJECTED")}
                                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-[11px] font-bold shadow hover:bg-red-500 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>رفض وإرجاع الموازنة</span>
                              </button>
                            </div>
                          ) : (
                            <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                              tr.status === "APPROVED" 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : "bg-red-50 text-red-700 border-red-300"
                            }`}>
                              {tr.status}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Initiate conversion transfer builder */}
                <div className="bg-white p-4 rounded-xl border border-dashed space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Initiate Inter-Warehouse Material Transfer</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-1">المستودع المصدر</label>
                      <select
                        value={trSource}
                        onChange={(e) => setTrSource(e.target.value)}
                        className="w-full p-2 border rounded bg-white"
                      >
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-1">المستودع الهدف</label>
                      <select
                        value={trDest}
                        onChange={(e) => setTrDest(e.target.value)}
                        className="w-full p-2 border rounded bg-white"
                      >
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-1">اسم الصنف المراد نقله</label>
                      <input
                        type="text"
                        value={trItem}
                        onChange={(e) => setTrItem(e.target.value)}
                        placeholder="e.g. كرتون مستلزمات وقطع غيار"
                        className="w-full p-2 border rounded font-semibold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-1">الكمية المشحونة</label>
                      <input
                        type="number"
                        value={trQty}
                        onChange={(e) => setTrQty(Math.max(1, Number(e.target.value)))}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleInitTransfer}
                      disabled={!trItem.trim()}
                      className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        trItem.trim()
                          ? "bg-[#1B3016] text-[#E6EEE2] hover:bg-[#2F4F24] cursor-pointer"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      طلب الإذن ونقل الحمولة برقم 2FA
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Physical Inventory auditing panel with Micro-units adjustment calculator */}
          <div className="p-5 rounded-2xl border bg-slate-50 border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <span className="text-[9px] uppercase font-bold text-[#4A6741]">Security Audit Compliance Zone</span>
                <h4 className="font-bold text-[#1B3016] text-sm flex items-center gap-1.5">
                  <Shield className="w-4.5 h-4.5 text-[#4A6741]" />
                  <span>Physical Inventory Auditing & Reconciliation (الجرد الفعلي للتأمين والمطابقة الحسابية)</span>
                </h4>
              </div>
              <div className="flex gap-1">
                <span className="bg-[#E6EEE2] px-2.5 py-1 rounded text-[10px] font-bold text-[#1B3016]">
                  Verified joad772709971@gmail.com
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed" dir="rtl">
              تضمن هذه المنصة مطابقة كميات المواد المخزونة بالفرع بالنظام مقارنة بالجرد الواقعي للتحقق من عدم وجود تلاعب أو تلف، واحتساب الفروق المالية فوراً بقيمة حسابية دقيقة بالمايكرو (ضرب القيمة بالفلس لتجاوز خسائر التقريب اللغوي).
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              
              {/* Interactive Audit Matching Sheets */}
              <div className="lg:col-span-8 border rounded-xl bg-white overflow-hidden text-xs">
                <table className="w-full text-right font-sans" dir="rtl">
                  <thead className="bg-[#F4F7F1] text-slate-700 font-bold border-b text-[10px] text-center">
                    <tr>
                      <th className="p-2.5 text-right">اسم الصنف في المستودع (Inventory Stock item)</th>
                      <th className="p-2.5 text-center">الكمية دفترياً (System Qty)</th>
                      <th className="p-2.5 text-center">الجرد الحقيقي (Physical Qty)</th>
                      <th className="p-2.5 text-center">سعر الوحدة بالريال</th>
                      <th className="p-2.5 text-left">فرق العجز/الوفر الدفتري (Variance)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono font-medium text-slate-700">
                    {auditedItems.map(item => {
                      const diff = item.physicalQty - item.systemQty;
                      const lineCostYER = (Number(item.pricePerPieceMicro) / 1000);
                      const diffFinancial = diff * lineCostYER;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 text-right font-sans font-bold text-slate-800">{item.name}</td>
                          <td className="p-2.5 text-center font-bold text-slate-600">{item.systemQty} حبة</td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              value={item.physicalQty}
                              onChange={(e) => handleUpdatePhysicalQty(item.id, Number(e.target.value))}
                              className="w-16 p-1 rounded border text-center font-bold font-mono bg-slate-50 text-slate-800"
                            />
                          </td>
                          <td className="p-2.5 text-center">{lineCostYER.toLocaleString()} YER</td>
                          <td className={`p-2.5 text-left font-black ${
                            diff === 0 
                              ? "text-slate-500"
                              : diff > 0 
                                ? "text-emerald-600"
                                : "text-red-600"
                          }`}>
                            {diff === 0 
                              ? "متطابق (0)"
                              : `${diff > 0 ? "+" : ""}${diff} (${diffFinancial.toLocaleString()} YER)`
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Precise Financial Variance Summary */}
              <div className="lg:col-span-4 bg-[#1B3016] text-[#E6EEE2] p-4.5 rounded-xl flex flex-col justify-between shadow-md text-right" dir="rtl">
                <div className="space-y-3.5">
                  <div className="flex items-center gap-1.5 border-b border-[#A4C639]/30 pb-2">
                    <FileCheck2 className="w-5 h-5 text-[#A4C639]" />
                    <span className="text-[12px] font-black uppercase text-[#E6EEE2]">ملخص الفروق والموازنة التسوية</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">طريقة الحساب الرياضي:</span>
                      <span className="font-mono text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded text-yellow-400">BIGINT MICRO-FILS</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">التسوية الصافية (Net Adjust):</span>
                      <span className={`font-mono font-black ${auditSums.isLoss ? "text-red-400" : "text-emerald-400"}`}>
                        {auditSums.netAdjustmentYER} YER
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">التباين المطلق (Absolute Var):</span>
                      <strong className="font-mono text-white text-sm">{auditSums.absoluteDiscrepancyYER} YER</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-[#A4C639]/20 text-[10px] text-[#A4C639] text-center font-bold">
                  🔐 تم إخضاع التقرير لـ RLS للتأمين في قاعدة البيانات.
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
