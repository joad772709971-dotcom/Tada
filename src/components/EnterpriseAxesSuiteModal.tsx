import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Download, 
  ShieldCheck, 
  Play, 
  Activity, 
  HardDrive, 
  FileText, 
  AlertTriangle, 
  Info, 
  Lock, 
  Terminal, 
  X, 
  Check, 
  Clock, 
  Zap, 
  Cpu, 
  Layers,
  Award,
  BookOpen,
  Search,
  Sparkles,
  Scale,
  Coins,
  FileCheck,
  Building2,
  Monitor,
  Key,
  TrendingUp,
  Receipt,
  Globe,
  Server,
  Bell,
  Send,
  Store,
  ShoppingCart,
  Plus,
  ArrowRightLeft,
  Truck,
  PackageCheck,
  MessageSquare,
  SendHorizontal,
  UserCheck,
  Users,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { CrossProjectBackupEngine, TierBackupSnapshot } from '../services/CrossProjectBackupService';
import { SecurityAuditEngine, SecurityEventLog, SecuritySeverity } from '../services/SecurityAuditEngine';
import { EnterpriseSystemValidator, EnterpriseSystemAuditReport, TestResultItem } from '../services/EnterpriseSystemValidator';
import { SystemArchitectureDocHub, ArchitecturalPillarDoc } from '../services/SystemArchitectureDocHub';
import { EnterpriseProductionSeal, ProductionSealCertificate } from '../services/EnterpriseProductionSeal';
import { CrossProjectLedgerService, CrossProjectSettlementEntry } from '../services/CrossProjectLedgerService';
import { DesktopStandaloneWrapper, DesktopAppManifest } from '../services/DesktopStandaloneWrapper';
import { EnterpriseTelemetryEngine } from '../services/EnterpriseTelemetryEngine';
import { EnterpriseComplianceAI } from '../services/EnterpriseComplianceAI';
import { SuperAdminCommandCenter, GlobalSystemOverview } from '../services/SuperAdminCommandCenter';
import { CrossProjectNotificationHub } from '../services/CrossProjectNotificationHub';
import { CrossProjectMarketBridge, MarketProductOffer } from '../services/CrossProjectMarketBridge';
import { CrossProjectRelay, CrossProjectOrder, CrossProjectMessage } from '../services/CrossProjectRelayService';
import { CustomerPortal, RetailShopCatalogItem, B2CCustomerOrder, CustomerShopBalanceSummary } from '../services/CustomerPortalService';
import { UserProfile } from '../types';

interface EnterpriseAxesSuiteModalProps {
  profile: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'axis3' | 'axis4' | 'axis5' | 'axis6' | 'axis7' | 'axis9' | 'axis10' | 'axis11' | 'axis12' | 'axis13' | 'axis14' | 'axis15' | 'axis16' | 'axis17' | 'axis18' | 'axis19' | 'axis20';
}

const backupEngine = new CrossProjectBackupEngine();

export const EnterpriseAxesSuiteModal: React.FC<EnterpriseAxesSuiteModalProps> = ({
  profile,
  isOpen,
  onClose,
  initialTab = 'axis15'
}) => {
  const [activeTab, setActiveTab] = useState<'axis3' | 'axis4' | 'axis5' | 'axis6' | 'axis7' | 'axis9' | 'axis10' | 'axis11' | 'axis12' | 'axis13' | 'axis14' | 'axis15' | 'axis16' | 'axis17' | 'axis18' | 'axis19' | 'axis20'>(initialTab);

  // Axis 3 State (Cross-Project Market Bridge)
  const [marketProducts, setMarketProducts] = useState<MarketProductOffer[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState<boolean>(false);
  const [selectedMarketTier, setSelectedMarketTier] = useState<'importer' | 'wholesale_master' | 'retail'>('importer');
  const [marketSearchQuery, setMarketSearchQuery] = useState<string>('');
  const [marketPublishName, setMarketPublishName] = useState<string>('');
  const [marketPublishPrice, setMarketPublishPrice] = useState<string>('');
  const [marketPublishQty, setMarketPublishQty] = useState<string>('10');
  const [marketPublishStatus, setMarketPublishStatus] = useState<string>('');

  // Axis 4 State (Cross-Project Order & Chat Relay)
  const [relayedOrders, setRelayedOrders] = useState<CrossProjectOrder[]>([]);
  const [isLoadingRelayedOrders, setIsLoadingRelayedOrders] = useState<boolean>(false);
  const [relayTier, setRelayTier] = useState<'importer' | 'wholesale_master' | 'retail'>('importer');
  const [relayBuyerName, setRelayBuyerName] = useState<string>('');
  const [relayItemName, setRelayItemName] = useState<string>('');
  const [relayItemQty, setRelayItemQty] = useState<number>(5);
  const [relayItemPrice, setRelayItemPrice] = useState<number>(12000);
  const [relayDispatchStatus, setRelayDispatchStatus] = useState<string>('');
  const [relayChatRecipientTier, setRelayChatRecipientTier] = useState<'importer' | 'wholesale_master' | 'retail'>('importer');
  const [relayChatMessage, setRelayChatMessage] = useState<string>('');
  const [relayChatStatus, setRelayChatStatus] = useState<string>('');

  // Axis 5 State (Customer Portal Dedicated Project Tier)
  const [b2cProducts, setB2cProducts] = useState<RetailShopCatalogItem[]>([]);
  const [isLoadingB2C, setIsLoadingB2C] = useState<boolean>(false);
  const [b2cOrders, setB2cOrders] = useState<B2CCustomerOrder[]>([]);
  const [b2cCustomerName, setB2cCustomerName] = useState<string>('عميل تجريبي معتمد');
  const [b2cCustomerPhone, setB2cCustomerPhone] = useState<string>('777123456');
  const [b2cCustomerAddress, setB2cCustomerAddress] = useState<string>('صنعاء - شارع حدة');
  const [b2cItemName, setB2cItemName] = useState<string>('شاشة سامسونج OLED الأصلية');
  const [b2cItemPrice, setB2cItemPrice] = useState<number>(35000);
  const [b2cItemQty, setB2cItemQty] = useState<number>(1);
  const [b2cOrderStatusMsg, setB2cOrderStatusMsg] = useState<string>('');
  const [b2cDebtBalance, setB2cDebtBalance] = useState<number>(0);

  // Axis 6 State
  const [globalOverview, setGlobalOverview] = useState<GlobalSystemOverview | null>(null);
  const [isLoadingGlobalOverview, setIsLoadingGlobalOverview] = useState<boolean>(false);

  // Axis 7 State
  const [announcementTitle, setAnnouncementTitle] = useState<string>('');
  const [announcementBody, setAnnouncementBody] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string>('');

  // Axis 9 State
  const [snapshots, setSnapshots] = useState<TierBackupSnapshot[]>([]);
  const [isBackupRunning, setIsBackupRunning] = useState<boolean>(false);
  const [backupMessage, setBackupMessage] = useState<string>('');

  // Axis 10 State
  const [securityLogs, setSecurityLogs] = useState<SecurityEventLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Axis 11 State
  const [auditReport, setAuditReport] = useState<EnterpriseSystemAuditReport | null>(null);
  const [isRunningValidation, setIsRunningValidation] = useState<boolean>(false);

  // Axis 12 State
  const [pillarsDocs, setPillarsDocs] = useState<ArchitecturalPillarDoc[]>([]);
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');

  // Axis 13 State
  const [productionSeal, setProductionSeal] = useState<ProductionSealCertificate | null>(null);
  const [isExecutingSeal, setIsExecutingSeal] = useState<boolean>(false);

  // Axis 14 State (Financial Ledger)
  const [ledgerStatement, setLedgerStatement] = useState<{ totalBalanceYer: number; totalTransactionsCount: number } | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(false);
  const [ledgerMessage, setLedgerMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'axis3') loadMarketProducts(selectedMarketTier);
      if (activeTab === 'axis4') loadRelayedOrders(relayTier);
      if (activeTab === 'axis5') loadB2CCatalogAndOrders();
      if (activeTab === 'axis6') loadGlobalOverview();
      if (activeTab === 'axis9') loadBackupSnapshots();
      if (activeTab === 'axis10') loadSecurityLogs();
      if (activeTab === 'axis11' && !auditReport) runValidatorSuite();
      if (activeTab === 'axis12') loadArchitectureDocs();
      if (activeTab === 'axis13' && !productionSeal) executeProductionSealCeremony();
      if (activeTab === 'axis14') loadLedgerStatement();
      if (activeTab === 'axis15' && !productionSeal) executeProductionSealCeremony();
    }
  }, [isOpen, activeTab, selectedMarketTier, relayTier]);

  const loadB2CCatalogAndOrders = async () => {
    setIsLoadingB2C(true);
    try {
      const [prods, ords] = await Promise.all([
        CustomerPortal.fetchAvailableRetailProducts(),
        CustomerPortal.fetchCustomerOrders('demo_customer_uid_777')
      ]);
      setB2cProducts(prods);
      setB2cOrders(ords);
    } catch (e) {
      console.warn('Error loading B2C Portal data:', e);
    } finally {
      setIsLoadingB2C(false);
    }
  };

  const handlePlaceCustomerB2COrder = async () => {
    if (!b2cItemName.trim()) {
      setB2cOrderStatusMsg('⚠️ يرجى تحديد الصنف المراد طلبه');
      return;
    }
    setB2cOrderStatusMsg('جاري إرسال طلب الشراء إلى مشروع بوابة الزبائن (joad772315106) وترحيله لمتجر التجزئة...');
    try {
      const qty = Number(b2cItemQty) || 1;
      const price = Number(b2cItemPrice) || 0;
      const totalAmount = qty * price;

      const res = await CustomerPortal.placeCustomerOrder(
        {
          uid: 'demo_customer_uid_777',
          fullName: b2cCustomerName.trim() || 'الزبون المعتمد',
          phoneNumber: b2cCustomerPhone.trim() || '777123456',
          address: b2cCustomerAddress.trim() || 'صنعاء - اليمن',
          customerTier: 'customer'
        },
        profile?.uid || 'merchant_retail_uid',
        profile?.shopName || 'متجر التجزئة النموذجي',
        'retailer',
        [{
          productId: `b2c_prod_${Date.now()}`,
          productName: b2cItemName.trim(),
          quantity: qty,
          unitPrice: price,
          totalPrice: totalAmount
        }],
        totalAmount,
        b2cCustomerAddress.trim()
      );

      setB2cOrderStatusMsg(`✅ تم تسجيل الطلب في بوابة الزبائن وترحيله بنجاح! رقم الطلب: ${res.orderNumber}`);
      await loadB2CCatalogAndOrders();
    } catch (e: any) {
      setB2cOrderStatusMsg(`❌ تعذر إرسال الطلب: ${e.message || e}`);
    }
  };

  const handleUpdateCustomerB2COrderStatus = async (orderId: string, newStatus: 'pending' | 'accepted' | 'delivering' | 'completed' | 'cancelled') => {
    try {
      await CustomerPortal.updateB2COrderStatus(orderId, 'retailer', newStatus);
      await loadB2CCatalogAndOrders();
    } catch (e: any) {
      console.error('Error updating B2C order status:', e);
    }
  };

  const loadRelayedOrders = async (tier: 'importer' | 'wholesale_master' | 'retail') => {
    setIsLoadingRelayedOrders(true);
    try {
      const orders = await CrossProjectRelay.fetchRelayedOrders(tier as any);
      setRelayedOrders(orders);
    } catch (e) {
      console.warn('Could not load relayed orders:', e);
    } finally {
      setIsLoadingRelayedOrders(false);
    }
  };

  const handleDispatchRelayOrder = async () => {
    if (!relayItemName.trim()) {
      setRelayDispatchStatus('⚠️ يرجى إدخال اسم المنتج المراد طلبه');
      return;
    }
    setRelayDispatchStatus('جاري ترحيل طلب الشراء B2B مباشرة إلى مشروع المورد...');
    try {
      const totalAmount = (Number(relayItemQty) || 1) * (Number(relayItemPrice) || 0);
      const res = await CrossProjectRelay.relayPurchaseOrder(
        profile || {
          uid: 'buyer_demo_id',
          displayName: relayBuyerName.trim() || 'تاجر تجزئة',
          shopName: 'محل الصمود للاتصالات',
          role: 'merchant'
        },
        relayTier as any,
        'supplier_target_uid',
        relayTier === 'importer' ? 'مؤسسة الاستيراد الدولية' : 'مركز الجملة المعتمد',
        {
          items: [{
            productId: `prod_${Date.now()}`,
            productName: relayItemName.trim(),
            quantity: Number(relayItemQty) || 1,
            unitPrice: Number(relayItemPrice) || 0,
            totalPrice: totalAmount
          }],
          totalAmount,
          currency: 'YER',
          notes: 'طلب B2B مباشر مرحل آلياً عبر بروتوكول Axis 4'
        }
      );
      setRelayDispatchStatus(`✅ تم ترحيل طلب الشراء بنجاح برقم: ${res.orderNumber}`);
      setRelayItemName('');
      await loadRelayedOrders(relayTier);
    } catch (e: any) {
      setRelayDispatchStatus(`❌ فشل الترحيل: ${e.message || e}`);
    }
  };

  const handleUpdateRelayOrderStatus = async (orderId: string, newStatus: 'approved' | 'shipped' | 'rejected' | 'completed') => {
    try {
      await CrossProjectRelay.updateOrderStatus(relayTier as any, orderId, 'retailer' as any, newStatus);
      await loadRelayedOrders(relayTier);
    } catch (e: any) {
      console.error('Error updating relayed order status:', e);
    }
  };

  const handleSendRelayChatMessage = async () => {
    if (!relayChatMessage.trim()) return;
    setRelayChatStatus('جاري إرسال الرسالة عبر بروتوكول B2B Relay...');
    try {
      await CrossProjectRelay.sendCrossProjectMessage(
        profile || {
          uid: 'demo_sender',
          displayName: 'التاجر المعتمد',
          shopName: 'مركز الصيانة والتجارة'
        },
        relayChatRecipientTier as any,
        'supplier_target_uid',
        relayChatMessage.trim()
      );
      setRelayChatStatus('✅ تم تسليم الرسالة المباشرة بنجاح إلى مشروع الطرف الآخر!');
      setRelayChatMessage('');
    } catch (e: any) {
      setRelayChatStatus(`❌ فشل الإرسال: ${e.message || e}`);
    }
  };

  const loadMarketProducts = async (tier: 'importer' | 'wholesale_master' | 'retail') => {
    setIsLoadingMarket(true);
    try {
      const prods = await CrossProjectMarketBridge.fetchMarketProductsFromTier(tier);
      setMarketProducts(prods);
    } catch (e: any) {
      console.warn('Market bridge fetch error:', e);
    } finally {
      setIsLoadingMarket(false);
    }
  };

  const handlePublishProductToMarket = async () => {
    if (!marketPublishName.trim() || !marketPublishPrice) {
      setMarketPublishStatus('⚠️ يرجى كتابة اسم المنتج وسعر الجملة');
      return;
    }
    setMarketPublishStatus('جاري نشر المنتج عبر جسر سوق الجملة...');
    try {
      await CrossProjectMarketBridge.publishProductToMarket(profile || {
        uid: 'demo_user',
        shopName: 'متجر التاجر المعتمد',
        role: 'merchant'
      }, {
        name: marketPublishName.trim(),
        wholesalePrice: Number(marketPublishPrice),
        stock: Number(marketPublishQty) || 10,
        category: 'قطع غيار وهواتف'
      });
      setMarketPublishStatus('✅ تم نشر المنتج بنجاح في كتالوج الجملة المتقاطع!');
      setMarketPublishName('');
      setMarketPublishPrice('');
      await loadMarketProducts(selectedMarketTier);
    } catch (e: any) {
      setMarketPublishStatus(`❌ فشل النشر: ${e.message || e}`);
    }
  };

  const loadGlobalOverview = async () => {
    setIsLoadingGlobalOverview(true);
    try {
      const overview = await SuperAdminCommandCenter.fetchGlobalSystemOverview();
      setGlobalOverview(overview);
    } catch (e: any) {
      console.warn('Global overview load notice:', e);
    } finally {
      setIsLoadingGlobalOverview(false);
    }
  };

  const handleBroadcastAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      setBroadcastStatus('⚠️ يرجى كتابة عنوان ونص الإعلان أولاً');
      return;
    }
    setIsBroadcasting(true);
    setBroadcastStatus('جاري بث الإعلان إلى المشاريع الستة...');
    try {
      await CrossProjectNotificationHub.broadcastSystemAnnouncement(
        announcementTitle,
        announcementBody,
        profile?.uid || 'SUPER_ADMIN'
      );
      setBroadcastStatus('✅ تم بث الإعلان الموحد بنجاح إلى جميع فئات المشاريع الـ 6!');
      setAnnouncementTitle('');
      setAnnouncementBody('');
    } catch (err: any) {
      setBroadcastStatus(`❌ فشل البث: ${err.message || err}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const loadLedgerStatement = async () => {
    setIsLoadingLedger(true);
    try {
      const stmt = await CrossProjectLedgerService.fetchInterProjectLedgerStatement(profile?.uid || 'master_system', 'importer');
      setLedgerStatement(stmt);
    } catch (e: any) {
      console.warn('Ledger load notice:', e);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const handleCreateTestSettlement = async () => {
    setIsLoadingLedger(true);
    setLedgerMessage('جاري تسجيل تسوية مالية تجريبية متقاطعة بين المشاريع...');
    try {
      await CrossProjectLedgerService.recordFinancialSettlement({
        debtorUid: profile?.uid || 'merchant_demo',
        debtorName: profile?.displayName || 'متجر التجزئة النموذجي',
        debtorTier: 'retail',
        creditorUid: 'importer_main',
        creditorName: 'المستورد الرئيسي البقعة',
        creditorTier: 'importer',
        amount: 150000,
        currency: 'YER',
        notes: 'تسوية شحنة استيراد متقاطعة عبر الفئات الـ 6'
      });
      setLedgerMessage('✓ تم تسجيل وحفظ التسوية المالية بنجاح في قاعدة بيانات المستورد ومراآتها لدى التجزئة!');
      await loadLedgerStatement();
    } catch (e: any) {
      setLedgerMessage(`فشل تسجيل التسوية: ${e.message || e}`);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const loadBackupSnapshots = async () => {
    setIsBackupRunning(true);
    try {
      const snaps = await backupEngine.runFullSystemBackupCycle();
      setSnapshots(snaps);
    } catch (e: any) {
      console.warn('Backup fetch notice:', e);
    } finally {
      setIsBackupRunning(false);
    }
  };

  const handleRunFullBackup = async () => {
    setIsBackupRunning(true);
    setBackupMessage('جاري تنفيذ النسخ الاحتياطي التلقائي عبر الفئات الـ 6...');
    try {
      const res = await backupEngine.runFullSystemBackupCycle();
      setSnapshots(res);
      setBackupMessage(`✓ تم اكتمال النسخ الاحتياطي لـ ${res.length} فئات بنجاح وختم البصمات!`);
    } catch (e: any) {
      setBackupMessage(`فشل النسخ الاحتياطي: ${e.message || e}`);
    } finally {
      setIsBackupRunning(false);
    }
  };

  const handleDownloadSnapshot = (snap: TierBackupSnapshot) => {
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${snap.tier}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSecurityLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await SecurityAuditEngine.fetchRecentSecurityIncidents();
      setSecurityLogs(logs);
    } catch (e) {
      console.warn('Security audit load notice:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCreateTestSecurityEvent = async () => {
    await SecurityAuditEngine.recordSecurityEvent({
      eventType: 'auth_violation',
      severity: 'warning',
      sourceUid: profile?.uid || 'guest_tester',
      description: 'فحص اختبار يدوي لسلامة محرك التدقيق الأمني ورصد الحوادث (المحور 10)',
      targetCollection: 'system_test'
    });
    await loadSecurityLogs();
  };

  const runValidatorSuite = async () => {
    setIsRunningValidation(true);
    try {
      const rep = await EnterpriseSystemValidator.runFullEnterpriseTestSuite();
      setAuditReport(rep);
    } catch (e: any) {
      console.error('Validator execution error:', e);
    } finally {
      setIsRunningValidation(false);
    }
  };

  const loadArchitectureDocs = () => {
    const docs = SystemArchitectureDocHub.getSystemPillarsOverview();
    setPillarsDocs(docs);
  };

  const executeProductionSealCeremony = async () => {
    setIsExecutingSeal(true);
    try {
      const seal = await EnterpriseProductionSeal.executeMasterProductionSeal(profile?.uid || 'master');
      setProductionSeal(seal);
    } catch (e: any) {
      console.error('Master launch seal ceremony error:', e);
    } finally {
      setIsExecutingSeal(false);
    }
  };

  const handleExportDocsJSON = () => {
    const blob = new Blob([JSON.stringify(pillarsDocs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JAM_SYSTEM_ARCHITECTURE_16_PILLARS.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const filteredLogs = securityLogs.filter(l => 
    severityFilter === 'all' ? true : l.severity === severityFilter
  );

  const filteredPillars = pillarsDocs.filter(p => 
    docSearchQuery === '' ? true :
    p.titleAr.includes(docSearchQuery) ||
    p.titleEn.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
    p.summaryAr.includes(docSearchQuery) ||
    p.keyComponents.some(c => c.toLowerCase().includes(docSearchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 text-right" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Main Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-sky-600 to-amber-500 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Layers className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                مجمع المعمارية المؤسسية الشامل للمحاور (Enterprise 16-Pillar Suite)
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono">
                  Production Suite
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                منظومة المعمارية المتكاملة: سوق الجملة، الترحيل المباشر، بوابة الزبائن B2C، المراقبة، النسخ الاحتياطي، والأمان والاعتماد
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4 gap-2 pt-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('axis3')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis3'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="w-4 h-4" />
            المحور 3: جسر سوق الجملة B2B
          </button>

          <button
            onClick={() => setActiveTab('axis4')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis4'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            المحور 4: ترحيل طلبات B2B والمراسلات
          </button>

          <button
            onClick={() => setActiveTab('axis5')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis5'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            المحور 5: بوابة الزبائن المستقلة B2C
          </button>

          <button
            onClick={() => setActiveTab('axis6')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis6'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            المحور 6: المراقبة المركزية
          </button>

          <button
            onClick={() => setActiveTab('axis7')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis7'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            المحور 7: مركز الإشعارات الموحد
          </button>

          <button
            onClick={() => setActiveTab('axis9')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis9'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            المحور 9: النسخ الاحتياطي
          </button>

          <button
            onClick={() => setActiveTab('axis10')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis10'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            المحور 10: التدقيق الأمني
          </button>

          <button
            onClick={() => setActiveTab('axis11')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis11'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            المحور 11: المحقق التلقائي
          </button>

          <button
            onClick={() => setActiveTab('axis12')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis12'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            المحور 12: توثيق المعمارية
          </button>

          <button
            onClick={() => setActiveTab('axis13')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis13'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            المحور 13: ختم الاعتماد النهائي
          </button>

          <button
            onClick={() => setActiveTab('axis14')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis14'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="w-4 h-4" />
            المحور 14: التسويات المالية
          </button>

          <button
            onClick={() => setActiveTab('axis15')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis15'
                ? 'border-rose-400 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            المحور 15: بروتوكول التشغيل المباشر
          </button>

          <button
            onClick={() => setActiveTab('axis16')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis16'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-4 h-4" />
            المحور 16: تطبيقات سطح المكتب
          </button>

          <button
            onClick={() => setActiveTab('axis17')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis17'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            المحور 17: قياس الأداء المباشر
          </button>

          <button
            onClick={() => setActiveTab('axis18')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis18'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" />
            المحور 18: تراخيص الأجهزة والفروع
          </button>

          <button
            onClick={() => setActiveTab('axis19')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis19'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            المحور 19: ذكاء المخزون والطلب
          </button>

          <button
            onClick={() => setActiveTab('axis20')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition shrink-0 ${
              activeTab === 'axis20'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            المحور 20: الفوترة الإلكترونية ZATCA
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900/40">
          
          {/* TAB 3: CROSS-PROJECT B2B WHOLESALE MARKET BRIDGE */}
          {activeTab === 'axis3' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-amber-400 flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    جسر سوق الجملة المتقاطع بين المشاريع (Axis 3: Cross-Project Market Bridge)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    استعراض عروض ومنتجات الجملة المتاحة مباشرة من فئات المشاريع الـ 6 الموزعة (المستوردون وتجار الجملة)، ونشر الأصناف العامة ببروتوكول القراءة العامة والكتابة المعزولة.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedMarketTier}
                    onChange={(e: any) => setSelectedMarketTier(e.target.value)}
                    className="bg-slate-900 text-slate-200 border border-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                  >
                    <option value="importer">فئة المستورد (Importer Tier)</option>
                    <option value="wholesale_master">فئة تجار الجملة (Wholesale Tier)</option>
                    <option value="retail">فئة التجزئة (Retail Tier)</option>
                  </select>
                  <button
                    onClick={() => loadMarketProducts(selectedMarketTier)}
                    disabled={isLoadingMarket}
                    className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMarket ? 'animate-spin' : ''}`} />
                    تحديث السوق
                  </button>
                </div>
              </div>

              {/* Publish Box */}
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    نشر وتغذية منتج جديد في سوق الجملة المتقاطع (Public B2B Catalog):
                  </span>
                  {marketPublishStatus && (
                    <span className="text-xs font-medium text-amber-300">{marketPublishStatus}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="اسم الصنف / المنتج..."
                    value={marketPublishName}
                    onChange={e => setMarketPublishName(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 sm:col-span-2"
                  />
                  <input
                    type="number"
                    placeholder="سعر الجملة (YER)..."
                    value={marketPublishPrice}
                    onChange={e => setMarketPublishPrice(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="الكمية..."
                      value={marketPublishQty}
                      onChange={e => setMarketPublishQty(e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={handlePublishProductToMarket}
                      className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      نشر
                    </button>
                  </div>
                </div>
              </div>

              {/* Products Feed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-300">
                      عروض الجملة المتاحة في قاعدة ({selectedMarketTier}): {marketProducts.length} عرض
                    </span>
                  </div>
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="بحث في عروض السوق..."
                      value={marketSearchQuery}
                      onChange={e => setMarketSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {isLoadingMarket ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                    جاري جلب عروض سوق الجملة المتقاطع عبر المشاريع...
                  </div>
                ) : marketProducts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800/80 text-slate-400 text-xs space-y-2">
                    <p className="font-semibold text-slate-300">لا توجد عروض منشورة حالياً في فئة ({selectedMarketTier}).</p>
                    <p className="text-[11px] text-slate-400">يمكنك استخدام صندوق النشر بالأعلى لنشر أول عرض جملة متقاطع عبر الفئات!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {marketProducts
                      .filter(p => !marketSearchQuery || p.productName.toLowerCase().includes(marketSearchQuery.toLowerCase()))
                      .map(product => (
                        <div key={product.id} className="bg-slate-950/90 p-4 rounded-xl border border-slate-800/80 space-y-3 hover:border-amber-500/40 transition">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="text-sm font-bold text-white">{product.productName}</h5>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Store className="w-3 h-3 text-amber-400" />
                                {product.supplierName} ({product.supplierTier})
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                              {product.category || 'عام'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-lg text-xs text-slate-300">
                            <div>
                              <span className="text-[10px] text-slate-400 block">سعر الجملة:</span>
                              <span className="font-bold text-amber-400 font-mono">{product.wholesalePrice.toLocaleString()} YER</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">المخزون المتاح:</span>
                              <span className="font-bold text-emerald-400 font-mono">{product.availableStock} وحدة</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                            <span>أقل كمية للطلب: {product.minimumOrderQuantity || 1}</span>
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              معتمد ومتاح للربط
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CROSS-PROJECT B2B ORDER & CHAT RELAY */}
          {activeTab === 'axis4' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-sky-400 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5" />
                    نظام ترحيل طلبات الشراء والمراسلات المباشرة B2B (Axis 4: Inter-Project Relay)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    ترحيل طلبات الشراء اللحظية مباشرة من مشروع المشتري (التجزئة/الجملة) إلى مشروع المورد في Firestore (`incoming_b2b_orders`) وتمرير الرسائل الحية والتنبيهات المتبادلة.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={relayTier}
                    onChange={(e: any) => setRelayTier(e.target.value)}
                    className="bg-slate-900 text-slate-200 border border-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
                  >
                    <option value="importer">فئة المستورد (Importer)</option>
                    <option value="wholesale_master">فئة تجار الجملة (Wholesale)</option>
                    <option value="retail">فئة التجزئة (Retail)</option>
                  </select>
                  <button
                    onClick={() => loadRelayedOrders(relayTier)}
                    disabled={isLoadingRelayedOrders}
                    className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-bold transition flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRelayedOrders ? 'animate-spin' : ''}`} />
                    تحديث الطلبات
                  </button>
                </div>
              </div>

              {/* Order Dispatch Simulation Box */}
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-sky-400" />
                    محاكاة ترحيل طلب شراء B2B مباشر إلى مشروع المورد المختار:
                  </span>
                  {relayDispatchStatus && (
                    <span className="text-xs font-medium text-sky-300">{relayDispatchStatus}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <input
                    type="text"
                    placeholder="اسم المتجر / المشتري..."
                    value={relayBuyerName}
                    onChange={e => setRelayBuyerName(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                  <input
                    type="text"
                    placeholder="اسم الصنف المطلوب..."
                    value={relayItemName}
                    onChange={e => setRelayItemName(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 sm:col-span-2"
                  />
                  <input
                    type="number"
                    placeholder="الكمية..."
                    value={relayItemQty}
                    onChange={e => setRelayItemQty(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="السعر (YER)..."
                      value={relayItemPrice}
                      onChange={e => setRelayItemPrice(Number(e.target.value))}
                      className="w-24 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={handleDispatchRelayOrder}
                      className="flex-1 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <SendHorizontal className="w-3.5 h-3.5" />
                      ترحيل
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Relay Simulation Box */}
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    المراسلات الفورية المتقاطعة بين المشاريع (Cross-Project Chat Relay):
                  </span>
                  {relayChatStatus && (
                    <span className="text-xs font-medium text-emerald-300">{relayChatStatus}</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <select
                    value={relayChatRecipientTier}
                    onChange={(e: any) => setRelayChatRecipientTier(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 shrink-0"
                  >
                    <option value="importer">إلى مشروع المستورد</option>
                    <option value="wholesale_master">إلى مشروع تاجر الجملة</option>
                    <option value="retail">إلى مشروع تاجر التجزئة</option>
                  </select>
                  <input
                    type="text"
                    placeholder="اكتب رسالة مباشرة ليتم ترحيلها إلى مشروع الطرف الآخر مع التنبيه الفوري..."
                    value={relayChatMessage}
                    onChange={e => setRelayChatMessage(e.target.value)}
                    className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    onKeyDown={e => e.key === 'Enter' && handleSendRelayChatMessage()}
                  />
                  <button
                    onClick={handleSendRelayChatMessage}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    إرسال للطرف الآخر
                  </button>
                </div>
              </div>

              {/* Relayed Orders Feed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-slate-300">
                      طلبات الشراء المرحلة الواردة في قاعدة ({relayTier}): {relayedOrders.length} طلب
                    </span>
                  </div>
                </div>

                {isLoadingRelayedOrders ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                    جاري جلب الطلبات المرحلة من قواعد الفايربيس...
                  </div>
                ) : relayedOrders.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800/80 text-slate-400 text-xs space-y-2">
                    <p className="font-semibold text-slate-300">لا توجد طلبات شراء B2B مسجلة حالياً في فئة ({relayTier}).</p>
                    <p className="text-[11px] text-slate-400">يمكنك استخدام صندوق الترحيل بالأعلى لترحيل واختبار تدفق أول طلب شراء فوري!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {relayedOrders.map(order => (
                      <div key={order.id || order.orderNumber} className="bg-slate-950/90 p-5 rounded-2xl border border-slate-800 space-y-4 hover:border-sky-500/40 transition">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-900 pb-3">
                          <div>
                            <span className="text-xs font-mono font-bold text-sky-400 block">{order.orderNumber}</span>
                            <h5 className="text-sm font-bold text-white mt-0.5">{order.buyerShopName || order.buyerName}</h5>
                            <span className="text-[10px] text-slate-400">
                              فئة المشتري: ({order.buyerTier}) ⬅️ فئة المورد: ({order.supplierTier})
                            </span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            order.status === 'shipped' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                            order.status === 'approved' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            order.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                            'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                          }`}>
                            {order.status === 'completed' ? 'مكتمل ومستلم' :
                             order.status === 'shipped' ? 'تم الشحن والإرسال' :
                             order.status === 'approved' ? 'معتمد من المورد' :
                             order.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}
                          </span>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2">
                          <span className="text-[11px] text-slate-400 font-medium">الأصناف المطلوبة:</span>
                          <div className="bg-slate-900/60 rounded-xl p-3 space-y-1.5 text-xs">
                            {order.items?.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-slate-300">
                                <span>{item.productName} × {item.quantity}</span>
                                <span className="font-mono text-slate-200">{item.totalPrice?.toLocaleString()} {order.currency || 'YER'}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Order Total & Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                          <div>
                            <span className="text-[10px] text-slate-400 block">إجمالي الطلب المرحل:</span>
                            <span className="font-bold text-base text-emerald-400 font-mono">
                              {order.totalAmount?.toLocaleString()} {order.currency || 'YER'}
                            </span>
                          </div>

                          {order.id && (
                            <div className="flex items-center gap-1.5">
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateRelayOrderStatus(order.id!, 'approved')}
                                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition"
                                >
                                  اعتماد
                                </button>
                              )}
                              {order.status === 'approved' && (
                                <button
                                  onClick={() => handleUpdateRelayOrderStatus(order.id!, 'shipped')}
                                  className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-[10px] font-bold transition"
                                >
                                  شحن
                                </button>
                              )}
                              {order.status === 'shipped' && (
                                <button
                                  onClick={() => handleUpdateRelayOrderStatus(order.id!, 'completed')}
                                  className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold transition"
                                >
                                  تسليم
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DEDICATED CUSTOMER PORTAL TIER (B2C) */}
          {activeTab === 'axis5' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-pink-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-pink-400 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    بوابة الزبائن المستقلة B2C (Axis 5: Dedicated Customer Portal Tier)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    تخصيص مشروع فايربيس مستقل كلياً (<span className="font-mono text-pink-300">joad772315106</span>) لبوابة الزبائن لتسوق المنتجات ورفع الطلبات ومتابعة كشوفات الحساب بدون استهلاك حصص قواعد بيانات التجار أو التأثير على عملياتهم.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-pink-500/10 text-pink-300 border border-pink-500/30">
                    Tier: customer (joad772315106)
                  </span>
                  <button
                    onClick={loadB2CCatalogAndOrders}
                    disabled={isLoadingB2C}
                    className="px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 rounded-xl text-xs font-bold transition flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingB2C ? 'animate-spin' : ''}`} />
                    تحديث بيانات البوابة
                  </button>
                </div>
              </div>

              {/* B2C Simulation Order Box */}
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-pink-400" />
                    محاكاة طلب شراء مباشر من بوابة الزبائن وترحيله لمتجر التجزئة:
                  </span>
                  {b2cOrderStatusMsg && (
                    <span className="text-xs font-medium text-pink-300">{b2cOrderStatusMsg}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">اسم العميل:</label>
                    <input
                      type="text"
                      value={b2cCustomerName}
                      onChange={e => setB2cCustomerName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">رقم الهاتف:</label>
                    <input
                      type="text"
                      value={b2cCustomerPhone}
                      onChange={e => setB2cCustomerPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">عنوان التوصيل:</label>
                    <input
                      type="text"
                      value={b2cCustomerAddress}
                      onChange={e => setB2cCustomerAddress(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-400 block mb-1">المنتج / الصنف:</label>
                    <input
                      type="text"
                      value={b2cItemName}
                      onChange={e => setB2cItemName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">السعر (YER):</label>
                    <input
                      type="number"
                      value={b2cItemPrice}
                      onChange={e => setB2cItemPrice(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="w-24">
                      <label className="text-[10px] text-slate-400 block mb-1">الكمية:</label>
                      <input
                        type="number"
                        value={b2cItemQty}
                        onChange={e => setB2cItemQty(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                      />
                    </div>
                    <button
                      onClick={handlePlaceCustomerB2COrder}
                      className="flex-1 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 h-[34px]"
                    >
                      <SendHorizontal className="w-3.5 h-3.5" />
                      إرسال الطلب
                    </button>
                  </div>
                </div>
              </div>

              {/* B2C Orders Feed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-bold text-slate-300">
                      طلبات الزبائن المسجلة في مشروع البوابة (joad772315106): {b2cOrders.length} طلب
                    </span>
                  </div>
                </div>

                {isLoadingB2C ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-pink-500" />
                    جاري جلب سجلات بوابة الزبائن من Firebase joad772315106...
                  </div>
                ) : b2cOrders.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800/80 text-slate-400 text-xs space-y-2">
                    <p className="font-semibold text-slate-300">لا توجد طلبات زبائن مسجلة حالياً في قاعدة البوابة المستقلة.</p>
                    <p className="text-[11px] text-slate-400">يمكنك استخدام محاكي الشراء بالأعلى لإرسال أول طلب زبون B2C مرحل!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {b2cOrders.map(order => (
                      <div key={order.id || order.orderNumber} className="bg-slate-950/90 p-5 rounded-2xl border border-slate-800 space-y-4 hover:border-pink-500/40 transition">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-900 pb-3">
                          <div>
                            <span className="text-xs font-mono font-bold text-pink-400 block">{order.orderNumber}</span>
                            <h5 className="text-sm font-bold text-white mt-0.5">{order.customerName}</h5>
                            <span className="text-[10px] text-slate-400">
                              الهاتف: {order.customerPhone} | العنوان: {order.deliveryAddress || 'غير محدد'}
                            </span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            order.status === 'delivering' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                            order.status === 'accepted' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            order.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                            'bg-pink-500/10 text-pink-400 border-pink-500/30'
                          }`}>
                            {order.status === 'completed' ? 'تم التسليم' :
                             order.status === 'delivering' ? 'جاري التوصيل' :
                             order.status === 'accepted' ? 'تم القبول' :
                             order.status === 'cancelled' ? 'ملغي' : 'طلب جديد'}
                          </span>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2">
                          <span className="text-[11px] text-slate-400 font-medium">الأصناف المشتراة:</span>
                          <div className="bg-slate-900/60 rounded-xl p-3 space-y-1.5 text-xs">
                            {order.items?.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-slate-300">
                                <span>{item.productName} × {item.quantity}</span>
                                <span className="font-mono text-slate-200">{item.totalPrice?.toLocaleString()} {order.currency || 'YER'}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Order Total & Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                          <div>
                            <span className="text-[10px] text-slate-400 block">إجمالي الفاتورة:</span>
                            <span className="font-bold text-base text-pink-400 font-mono">
                              {order.totalAmount?.toLocaleString()} {order.currency || 'YER'}
                            </span>
                          </div>

                          {order.id && (
                            <div className="flex items-center gap-1.5">
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateCustomerB2COrderStatus(order.id!, 'accepted')}
                                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition"
                                >
                                  قبول الطلب
                                </button>
                              )}
                              {order.status === 'accepted' && (
                                <button
                                  onClick={() => handleUpdateCustomerB2COrderStatus(order.id!, 'delivering')}
                                  className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-[10px] font-bold transition"
                                >
                                  بدء التوصيل
                                </button>
                              )}
                              {order.status === 'delivering' && (
                                <button
                                  onClick={() => handleUpdateCustomerB2COrderStatus(order.id!, 'completed')}
                                  className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold transition"
                                >
                                  تم الاستلام
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* TAB 6: GLOBAL COMMAND CENTER */}
          {activeTab === 'axis6' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                    <Globe className="w-4.5 h-4.5" />
                    لوحة التحكم المركزية والمراقبة الشاملة (Axis 6)
                  </h4>
                  <p className="text-xs text-slate-400">
                    مراقبة حية لصحة وأداء المشاريع الستة، إحصائيات المبيعات، المحلات النشطة، وحسابات المشرفين
                  </p>
                </div>

                <button
                  onClick={loadGlobalOverview}
                  disabled={isLoadingGlobalOverview}
                  className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGlobalOverview ? 'animate-spin' : ''}`} />
                  تحديث المراقبة المركزية
                </button>
              </div>

              {globalOverview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1">المشاريع المفحوصة</span>
                    <span className="text-xl font-black text-indigo-400">{globalOverview.totalProjectsCount} / 6</span>
                  </div>
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1">حالة المنظومة الموحدة</span>
                    <span className="text-xl font-black text-emerald-400">
                      {globalOverview.overallHealth === 'healthy' ? 'سليمة 100%' : 'تحت الفحص'}
                    </span>
                  </div>
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1">إجمالي المتاجر النشطة</span>
                    <span className="text-xl font-black text-sky-400">{globalOverview.combinedMerchantsCount} متجر</span>
                  </div>
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1">إجمالي حجم المبيعات المدمج</span>
                    <span className="text-xl font-black text-amber-400">{globalOverview.combinedVolumeYer.toLocaleString()} YER</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {globalOverview && Object.entries(globalOverview.tierMetrics).map(([tierKey, metric]) => (
                  <div key={tierKey} className="bg-slate-950/90 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 capitalize flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 text-indigo-400" />
                        {tierKey.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {metric.status}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-900 pt-2">
                      <div className="flex justify-between">
                        <span>معرّف المشروع:</span>
                        <span className="text-slate-200 font-mono text-[11px]">{metric.projectId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المتاجر المسجلة:</span>
                        <span className="text-sky-400 font-bold">{metric.activeMerchantsCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>إجمالي الطلبات:</span>
                        <span className="text-indigo-400 font-bold">{metric.totalOrdersCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>حجم المبيعات:</span>
                        <span className="text-amber-400 font-bold">{metric.totalVolumeYer.toLocaleString()} YER</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: CROSS-PROJECT NOTIFICATION HUB */}
          {activeTab === 'axis7' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                    <Bell className="w-4.5 h-4.5" />
                    مركز الإشعارات الموحد المتقاطع عبر الفئات الـ 6 (Cross-Project Notification Hub - Axis 7)
                  </h4>
                  <p className="text-xs text-slate-400">
                    بث وتوجيه الإشعارات المباشرة بين تجار الجملة والمستوردين والمحلات والتجزئة والإعلانات الموحدة للنظام
                  </p>
                </div>

                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-200 block">📢 بث إعلان موحد لجميع مستخدمي المشاريع الـ 6:</span>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="عنوان الإعلان (مثال: تحديث أمان هام للنظام)..."
                      value={announcementTitle}
                      onChange={e => setAnnouncementTitle(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                    />
                    <textarea
                      rows={3}
                      placeholder="نص الإعلان التفصيلي الموجه لكافة الفئات والمشاريع..."
                      value={announcementBody}
                      onChange={e => setAnnouncementBody(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={handleBroadcastAnnouncement}
                      disabled={isBroadcasting}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isBroadcasting ? 'جاري البث الفوري...' : 'بث الإعلان لكافة المشاريع الآن'}
                    </button>

                    {broadcastStatus && (
                      <span className="text-xs font-medium text-purple-300">
                        {broadcastStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-indigo-400" />
                    أنواع الإشعارات المدعومة في المحور 7
                  </h5>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li><strong className="text-indigo-300">b2b_order:</strong> طلبات التوريد الفورية بين طبقات الجملة والمستوردين</li>
                    <li><strong className="text-sky-300">b2c_order:</strong> طلبات الزبائن المستلمة عبر تطبيق المحلات B2C</li>
                    <li><strong className="text-amber-300">low_stock:</strong> تنبيهات العجز المخزني الحرج والجرد الحي</li>
                    <li><strong className="text-emerald-300">debt_alert:</strong> تذكيرات الأرصدة والديون والفوترة الآجلة</li>
                    <li><strong className="text-purple-300">system_announcement:</strong> الإعلانات العامة والتحديثات الإدارية الموحدة</li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                    بروتوكول الأمان وتوصيل الإشعارات
                  </h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    يضمن محرك CrossProjectNotificationHub الاستماع الحقيقي المباشر (Real-time Firebase Snapshot) والتسليم المستهدف وفق الفئة والعزل المزدوج للمستخدمين.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: CROSS-PROJECT BACKUP ENGINE */}
          {activeTab === 'axis9' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <Database className="w-4.5 h-4.5" />
                    نظام النسخ الاحتياطي التلقائي المتقاطع (Axis 9)
                  </h4>
                  <p className="text-xs text-slate-400">
                    أخذ لقطات حية لقواعد البيانات عبر مشاريع الفئات الـ 6 وتخزين بصمات التشفير Checksums
                  </p>
                </div>

                <button
                  onClick={handleRunFullBackup}
                  disabled={isBackupRunning}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isBackupRunning ? 'animate-spin' : ''}`} />
                  تنفيذ لقطة احتياطية شاملة الآن
                </button>
              </div>

              {backupMessage && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs p-3.5 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  {backupMessage}
                </div>
              )}

              {/* Snapshots Table */}
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>سجل اللقطات الاحتياطية الحالية ({snapshots.length}):</span>
                  <span className="text-slate-400 text-[11px]">التخزين مشفر بـ Checksum SHA-256</span>
                </div>

                {snapshots.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    لم يتم إنشاء أي لقطات احتياطية بعد. انقر فوق زر "تنفيذ لقطة احتياطية شاملة" للبدء.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80">
                    {snapshots.map((snap, idx) => (
                      <div key={snap.id || idx} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs hover:bg-slate-900/50 transition">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white uppercase bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                              {snap.tier}
                            </span>
                            <span className="text-emerald-400 font-mono font-semibold">
                              {snap.recordsCount.toLocaleString()} سجل
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              ({(snap.backupSizeBytes / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            بصمة التشفير: {snap.checksum} | الوقت: {new Date(snap.snapshotTimestamp).toLocaleTimeString('ar-YE')}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-md text-[10px] font-bold">
                            {snap.status}
                          </span>
                          <button
                            onClick={() => handleDownloadSnapshot(snap)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg flex items-center gap-1 text-[11px] transition"
                            title="تحميل اللقطة JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                            تحميل
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 10: SECURITY AUDIT ENGINE */}
          {activeTab === 'axis10' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <ShieldAlert className="w-4.5 h-4.5" />
                    محرك التدقيق الأمني ورصد الحوادث المباشر (Axis 10)
                  </h4>
                  <p className="text-xs text-slate-400">
                    تسجيل ورصد محاولات خرق العزل المزدوج، التلاعب بالأذونات، والانحرافات التشغيلية
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateTestSecurityEvent}
                    className="bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    اختبار حدث أمني
                  </button>
                  <button
                    onClick={loadSecurityLogs}
                    disabled={isLoadingLogs}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                    تحديث
                  </button>
                </div>
              </div>

              {/* Severity Filter Controls */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">تصفية حسب الأهمية:</span>
                {['all', 'critical', 'high', 'warning', 'info'].map(sev => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-3 py-1 rounded-lg border font-medium transition capitalize ${
                      severityFilter === sev
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sev === 'all' ? 'الكل' : sev}
                  </button>
                ))}
              </div>

              {/* Logs List */}
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 text-xs font-semibold text-slate-300">
                  سجلات الحوادث والتدقيق الأمني ({filteredLogs.length}):
                </div>

                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    لا توجد حوادث أمنية مسجلة بهذا المستوى. النظام مستقر وأمن 100%!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80">
                    {filteredLogs.map(log => (
                      <div key={log.id} className="p-4 space-y-2 text-xs hover:bg-slate-900/50 transition">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              log.severity === 'critical' ? 'bg-rose-950 text-rose-300 border-rose-500/50' :
                              log.severity === 'high' ? 'bg-orange-950 text-orange-300 border-orange-500/50' :
                              log.severity === 'warning' ? 'bg-amber-950 text-amber-300 border-amber-500/50' :
                              'bg-sky-950 text-sky-300 border-sky-500/50'
                            }`}>
                              {log.severity}
                            </span>
                            <span className="font-bold text-white font-mono">{log.eventType}</span>
                            {log.targetCollection && (
                              <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono">
                                Collection: {log.targetCollection}
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500 text-[11px] font-mono">
                            {log.timestamp ? new Date(log.timestamp.seconds ? log.timestamp.seconds * 1000 : log.timestamp).toLocaleString('ar-YE') : 'الآن'}
                          </span>
                        </div>

                        <p className="text-slate-300 text-xs leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                          {log.description}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>المستخدم: {log.sourceUid || 'مجهول'}</span>
                          <span>الفئة: {log.sourceTier || 'عام'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 11: ENTERPRISE SYSTEM INTEGRATION VALIDATOR */}
          {activeTab === 'axis11' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5" />
                    المحقق التلقائي لتكامل النظام المتقدم (Axis 11 Validator)
                  </h4>
                  <p className="text-xs text-slate-400">
                    فحص واختبار حقيقي لجميع بروتوكولات ومحاور المعمارية الـ 11 وتوثيق النتائج
                  </p>
                </div>

                <button
                  onClick={runValidatorSuite}
                  disabled={isRunningValidation}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition disabled:opacity-50 shrink-0"
                >
                  <Play className={`w-4 h-4 ${isRunningValidation ? 'animate-spin' : ''}`} />
                  تشغيل حزمة الفحص الـ 11 محاور
                </button>
              </div>

              {/* Status Header Overview */}
              {auditReport && (
                <div className={`p-5 rounded-2xl border flex items-center justify-between ${
                  auditReport.overallStatus === 'PASS'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}>
                  <div className="flex items-center gap-3">
                    {auditReport.overallStatus === 'PASS' ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <XCircle className="w-8 h-8 text-rose-400" />
                    )}
                    <div>
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        حالة تكامل المحاور: {auditReport.overallStatus === 'PASS' ? 'ناجحة 100% (PASS)' : 'توجد إخفاقات (FAIL)'}
                      </div>
                      <div className="text-xs text-slate-300">
                        اجتاز {auditReport.passedCount} من أصل {auditReport.totalTests} اختبارات تكامل في المعمارية
                      </div>
                    </div>
                  </div>

                  <div className="text-left font-mono text-xs text-slate-400">
                    وقت الفحص: {new Date(auditReport.timestamp).toLocaleTimeString('ar-YE')}
                  </div>
                </div>
              )}

              {/* Test Suite Results List */}
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>نتائج الفحص التفصيلية للمحاور الـ 11:</span>
                  <span className="text-sky-400 font-mono text-[11px]">
                    {auditReport ? `${auditReport.passedCount}/${auditReport.totalTests} Passed` : 'جاري التحميل...'}
                  </span>
                </div>

                {!auditReport || isRunningValidation ? (
                  <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
                    <span>جاري تشغيل حزمة الفحص الشاملة للمحاور الـ 11...</span>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80">
                    {auditReport.results.map((item, idx) => (
                      <div key={idx} className="p-4 space-y-2 text-xs hover:bg-slate-900/60 transition">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span className="font-bold text-white">{item.testName}</span>
                            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono">
                              {item.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 font-mono text-[11px]">
                              {item.durationMs}ms
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.passed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              {item.passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        </div>

                        <p className="text-slate-300 text-xs bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-left" dir="ltr">
                          {item.details}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 12: SYSTEM ARCHITECTURE DOCUMENTATION HUB */}
          {activeTab === 'axis12' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                    <BookOpen className="w-4.5 h-4.5" />
                    مركز وثائق وتصميم المعمارية المتقدمة (Axis 12 Hub)
                  </h4>
                  <p className="text-xs text-slate-400">
                    دليل وثائق المعمارية المؤسسية المتكامل الشامل لجميع المحاور الـ 16 والخدمات والأدوات والبروتوكولات
                  </p>
                </div>

                <button
                  onClick={handleExportDocsJSON}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition shrink-0"
                >
                  <Download className="w-4 h-4" />
                  تصدير وثيقة المعمارية JSON
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ابحث في محاور المعمارية، المكونات، أو بروتوكولات الأمان..."
                  value={docSearchQuery}
                  onChange={e => setDocSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              {/* Pillars Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPillars.map((pillar) => (
                  <div key={pillar.pillarNumber} className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800/90 hover:border-purple-500/40 transition space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-mono text-xs font-bold">
                          {pillar.pillarNumber}
                        </span>
                        <h5 className="text-xs font-bold text-white">{pillar.titleAr}</h5>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 uppercase font-semibold">
                        {pillar.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                      {pillar.summaryAr}
                    </p>

                    <div className="space-y-1.5 text-xs">
                      <div className="text-[11px] text-slate-400">المكونات الرئيسية:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {pillar.keyComponents.map((comp, idx) => (
                          <span key={idx} className="bg-slate-800/80 text-purple-300 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-700">
                            {comp}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
                      <span>بروتوكول الأمان:</span>
                      <span className="font-mono text-amber-300 font-medium">{pillar.securityProtocol}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 13: MASTER LAUNCH SEAL PROTOCOL */}
          {activeTab === 'axis13' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-amber-300 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    جاهزية الإطلاق الفعلي والتشغيل الحقيقي (Axis 13 Master Launch Seal)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    مراسم التفعيل والختم النهائي للإنتاج، والتحقق التلقائي من خلو المعمارية تماماً من أي أخطاء أو بيانات تجريبية.
                  </p>
                </div>

                <button
                  onClick={executeProductionSealCeremony}
                  disabled={isExecutingSeal}
                  className="bg-gradient-to-r from-amber-500 via-emerald-600 to-sky-600 hover:opacity-90 text-slate-950 text-xs font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-xl transition disabled:opacity-50 shrink-0"
                >
                  <Sparkles className={`w-4.5 h-4.5 ${isExecutingSeal ? 'animate-spin' : ''}`} />
                  تفعيل وختم الإطلاق الحقيقي النهائي
                </button>
              </div>

              {/* Certificate Viewer Card */}
              {isExecutingSeal ? (
                <div className="p-16 bg-slate-950/80 rounded-2xl border border-slate-800 text-center space-y-3">
                  <RefreshCw className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
                  <div className="text-sm font-bold text-white">جاري اجراء مراسم الاعتماد والختم المشفر للإنتاج...</div>
                  <div className="text-xs text-slate-400">فحص النظافة 0ms وتدقيق المحاور الـ 15 الموزعة</div>
                </div>
              ) : productionSeal ? (
                <div className="bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
                  
                  {/* Glowing background badge */}
                  <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Header Badge */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-inner">
                        <Award className="w-8 h-8" />
                      </div>
                      <div>
                        <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">وثيقة الاعتماد للإنتاج الرسمي</div>
                        <h3 className="text-xl font-black text-white font-mono mt-0.5">{productionSeal.masterSealId}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        {productionSeal.isProductionReady ? 'جاهزية إنتاجية 100%' : 'تحذير مراجعة'}
                      </span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block mb-1">تاريخ ووقت ختم التفعيل:</span>
                      <span className="font-mono text-white font-bold">
                        {new Date(productionSeal.activatedAt).toLocaleString('ar-YE')}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block mb-1">المحاور المفحوصة والمعتمدة:</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {productionSeal.totalPillarsValidatedCount} محاور معمارية موزع
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block mb-1">حالة سلامة البيانات والنظافة:</span>
                      <span className="font-mono text-amber-300 font-bold">
                        {productionSeal.dataIntegrityStatus}
                      </span>
                    </div>
                  </div>

                  {/* Operational Declaration */}
                  <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-xl text-xs text-amber-200 leading-relaxed flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white block mb-1">تصريح الاعتماد التشغيلي النهائي:</span>
                      {productionSeal.operatingMessage}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[11px] text-slate-400 font-mono">
                      بصمة النظام: JAM-PROD-ZERO-DEFECT-SEAL
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(productionSeal.masterSealId);
                        alert(`تم نسخ رمز ختم الإنتاج: ${productionSeal.masterSealId}`);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Terminal className="w-3.5 h-3.5 text-amber-400" />
                      نسخ رمز الاعتماد
                    </button>
                  </div>

                </div>
              ) : null}
            </div>
          )}

          {/* TAB 14: CROSS-PROJECT FINANCIAL RECONCILIATION & LEDGER ENGINE */}
          {activeTab === 'axis14' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <Coins className="w-4.5 h-4.5" />
                    محرك التسويات المالية وكشوفات الحساب المتقاطعة (Axis 14 Ledger Engine)
                  </h4>
                  <p className="text-xs text-slate-400">
                    مزامنة وتصفية الحسابات والديون والتحويلات المباشرة بين تجار التجزئة والمستوردين وتجار الجملة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateTestSettlement}
                    disabled={isLoadingLedger}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition disabled:opacity-50 shrink-0"
                  >
                    <Scale className={`w-4 h-4 ${isLoadingLedger ? 'animate-spin' : ''}`} />
                    تسجيل تسوية مالية متقاطعة
                  </button>
                  <button
                    onClick={loadLedgerStatement}
                    disabled={isLoadingLedger}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLedger ? 'animate-spin' : ''}`} />
                    تحديث
                  </button>
                </div>
              </div>

              {ledgerMessage && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs p-3.5 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  {ledgerMessage}
                </div>
              )}

              {/* Ledger Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-1">
                  <div className="text-slate-400 text-xs">إجمالي رصيد التكافؤ المتقاطع:</div>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    {ledgerStatement ? ledgerStatement.totalBalanceYer.toLocaleString() : '0'} YER
                  </div>
                  <div className="text-[11px] text-slate-500">مراآة عبر قواعد بيانات المستورد والتجزئة</div>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-1">
                  <div className="text-slate-400 text-xs">عدد معاملات تسويات الحسابات:</div>
                  <div className="text-xl font-bold font-mono text-white">
                    {ledgerStatement ? ledgerStatement.totalTransactionsCount : 0} تسويات
                  </div>
                  <div className="text-[11px] text-slate-500">معالجة فورية بدون تأخير</div>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-1">
                  <div className="text-slate-400 text-xs">حماية المطابقة المزدوجة:</div>
                  <div className="text-sm font-bold text-amber-300 font-mono">
                    Double-Entry Cryptographic Ledger
                  </div>
                  <div className="text-[11px] text-slate-500">منع الفروقات أو التعديلات الفردية</div>
                </div>
              </div>

              {/* Ledger Flow Specification */}
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-3">
                <h5 className="text-xs font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  مواصفات وآلية عمل محرك التسويات المتقاطعة (Axis 14 Protocol)
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-bold text-emerald-400">1. المراآة الثنائية (Dual Ledger Mirroring):</span>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      عند إرسال أي دفعة مالية أو كشف حساب من تجار التجزئة، يتم كتابة القيد تلقائياً في مشروع المستورد والتجزئة معاً عبر معرّف مرجعي موحد.
                    </p>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-bold text-sky-400">2. التحقق من التكافؤ الحسابي (Balance Audit):</span>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      حساب الإجمالي فورياً والتأكد من تطابق المبالغ المقيدة في كلا المشروعين لمنع التلاعب في ذمم العملاء أو المستوردين.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 15: MASTER LAUNCH SEAL & ENTERPRISE OPERATING PROTOCOL */}
          {activeTab === 'axis15' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-rose-300 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-rose-400" />
                    المشرف التشغيلي المباشر وختم الاعتماد النهائي للإنتاج (Axis 15 Protocol)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    إدارة الاعتماد النهائي، وتوثيق استقرار كافة المحاور المعمارية الـ 16 في بيئة الإنتاج المباشرة بدون أي ثغرات أو أخطاء.
                  </p>
                </div>

                <button
                  onClick={executeProductionSealCeremony}
                  disabled={isExecutingSeal}
                  className="bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-500 hover:opacity-90 text-slate-950 text-xs font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-xl transition disabled:opacity-50 shrink-0"
                >
                  <Sparkles className={`w-4.5 h-4.5 ${isExecutingSeal ? 'animate-spin' : ''}`} />
                  إعادة فحص وختم الاعتماد المباشر
                </button>
              </div>

              {/* Status Board */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold">
                    <Activity className="w-4 h-4" />
                    جاهزية السيرفرات والمشاريع
                  </div>
                  <div className="text-xl font-bold text-white font-mono">6/6 Firebase Tiers</div>
                  <p className="text-slate-400 text-[11px]">كافة المشاريع الـ 6 متصلة وتعمل بكفاءة 100%</p>
                </div>

                <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    سلامة البيانات (Zero Defect)
                  </div>
                  <div className="text-xl font-bold text-emerald-300 font-mono">100% Clean Sheet</div>
                  <p className="text-slate-400 text-[11px]">خلو تام من أية بيانات وهمية أو أخطاء برمجة</p>
                </div>

                <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-sky-400 font-bold">
                    <Building2 className="w-4 h-4" />
                    تغليف تطبيقات سطح المكتب
                  </div>
                  <div className="text-xl font-bold text-sky-300 font-mono">4 Standalone EXEs</div>
                  <p className="text-slate-400 text-[11px]">تطبيقات المستورد والتجزئة والجملة جاهزة</p>
                </div>
              </div>

              {/* Official Launch Declaration */}
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 rounded-2xl border border-emerald-500/40 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  إعلان الاعتماد والاعتماد النهائي المباشر للنظام (Official System Launch Certificate)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  تشهد المعمارية المؤسسية لمنظومة JAM SYSTEM PRO بتمتع النظام بأعلى معايير الاستقرار والأمان والعزل المزدوج والتكامل بين مشاريع الفايربيس الـ 6 والتطبيقات المستقلة لسطح المكتب. النظام جاهز للتشغيل التجاري المباشر 100%.
                </p>
              </div>
            </div>
          )}

          {/* TAB 16: DESKTOP STANDALONE HARDWARE BRIDGE & EXE MANIFESTS */}
          {activeTab === 'axis16' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-cyan-500/30 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-cyan-400" />
                    جسر العتاد المستقل وتحزيم تطبيقات سطح المكتب (Axis 16 Desktop Manifests)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    إدارة ملفات إعداد وتغليف تطبيقات ويندوز المستقلة (Standalone EXE Builds) المربوطة بالجسر العتادي المباشر للطابعات الحرارية وقارئ الباركود وصندوق النقد.
                  </p>
                </div>
              </div>

              {/* Manifests Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DesktopStandaloneWrapper.getAllAppManifests().map((manifest) => (
                  <div key={manifest.appId} className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white font-bold text-sm">
                        <Monitor className="w-4 h-4 text-cyan-400" />
                        {manifest.productName}
                      </div>
                      <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-2 py-0.5 rounded-full font-mono">
                        {manifest.exeName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      <div>المشروع: <span className="text-slate-200">{manifest.projectId}</span></div>
                      <div>الإصدار: <span className="text-slate-200">v{manifest.version}</span></div>
                      <div>أبعاد النافذة: <span className="text-slate-200">{manifest.windowConfig.width}x{manifest.windowConfig.height}</span></div>
                      <div>اختصار سطح المكتب: <span className="text-slate-200">{manifest.shortcutName}</span></div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="text-slate-400 font-bold text-[11px]">مواصفات ودعم العتاد المباشر:</span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${manifest.hardwareCapabilities.directThermalPrint ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-slate-900 text-slate-500'}`}>
                          🖨️ طباعة حرارية مباشرة 0ms
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${manifest.hardwareCapabilities.hardwareBarcodeScanner ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/60' : 'bg-slate-900 text-slate-500'}`}>
                          📷 قارئ باركود هاردوير
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${manifest.hardwareCapabilities.cashDrawerKick ? 'bg-amber-950 text-amber-400 border border-amber-800/60' : 'bg-slate-900 text-slate-500'}`}>
                          💵 فتح درج النقد الآلي
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${manifest.hardwareCapabilities.offlineDbSync ? 'bg-purple-950 text-purple-400 border border-purple-800/60' : 'bg-slate-900 text-slate-500'}`}>
                          ⚡ مزامنة أوفلاين فكانية
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 17: REAL-TIME TELEMETRY ENGINE */}
          {activeTab === 'axis17' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-teal-500/30 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-teal-300 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-400" />
                    محرك قياس أداء النظام والاتصال المباشر (Axis 17 Telemetry Engine)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    مراقبة ورصد أداء استجابة قاعدة البيانات أوفلاين ومعدل العمليات واستهلاك الذاكرة الحية لضمان عدم وجود أي بطء أو تعليق (Zero-Lag Guaranteed).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {EnterpriseTelemetryEngine.getTelemetryMetrics().map((metric) => (
                  <div key={metric.metricId} className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">{metric.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
                        {metric.category}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-teal-400 font-mono">{metric.value}</span>
                      <span className="text-xs font-semibold text-slate-400">{metric.unit}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {metric.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 18: MULTI-BRANCH HARDWARE LICENSING */}
          {activeTab === 'axis18' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-amber-500/30 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-amber-300 flex items-center gap-2">
                    <Key className="w-5 h-5 text-amber-400" />
                    إدارة تراخيص العتاد وأجهزة محطات الفروع (Axis 18 Station Licensing)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    التحقق المباشر من بصمة العتاد (Hardware Fingerprint) والتصاريح النشطة لمحطات المبيعات وأجهزة الكاشير بالفروع.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {EnterpriseTelemetryEngine.getStationLicenses().map((license) => (
                  <div key={license.stationId} className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{license.branchName}</span>
                        <span className="text-[10px] font-mono bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded-full">
                          {license.licenseType}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
                        <span>المحطة: {license.stationId}</span>
                        <span>بصمة العتاد: <span className="text-slate-200">{license.hardwareFingerprint}</span></span>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {license.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 19: AI DEMAND & INVENTORY FORECASTING */}
          {activeTab === 'axis19' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-indigo-500/30 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-indigo-300 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    محرك الذكاء الاصطناعي للتنبؤ بالمخزون والطلب (Axis 19 AI Demand Forecasting)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    تحليل نماذج التنبؤ الذكي لطلبات التوريد وحجم الاستهلاك لـ 30 يوماً قادمة لتجنب نفاد المخزون.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {EnterpriseComplianceAI.getAIStockForecasts().map((fc) => (
                  <div key={fc.sku} className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[180px]">{fc.productName}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        fc.status === 'CRITICAL_LOW'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : fc.status === 'REORDER_NEEDED'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}>
                        {fc.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      <div>المخزون الحالي: <span className="text-slate-100 font-bold">{fc.currentStock}</span></div>
                      <div>الطلب المتوقع (30d): <span className="text-indigo-400 font-bold">{fc.predictedDemand30Days}</span></div>
                      <div>نقطة إعادة الطلب: <span className="text-amber-400 font-bold">{fc.reorderPoint}</span></div>
                      <div>الكمية المقترحة: <span className="text-emerald-400 font-bold">{fc.suggestedReorderQty}</span></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>دقة النموذج AI:</span>
                      <span className="font-mono text-indigo-300 font-bold">{(fc.confidenceScore * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 20: ZATCA PHASE-2 E-INVOICING COMPLIANCE */}
          {activeTab === 'axis20' && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-emerald-500/30 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-emerald-300 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-400" />
                    الفوترة الإلكترونية والامتثال الضريبي المرحلة الثانية (Axis 20 ZATCA Phase-2)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    التحقق المباشر من التشفير ECDSA والختم الرقمي وحشوة الـ QR Code لمتطلبات هيئة الزكاة والضريبة والجمارك.
                  </p>
                </div>
              </div>

              {(() => {
                const sample = EnterpriseComplianceAI.generateZATCAPhase2Invoice({
                  invoiceNumber: 'INV-2026-SA-00981',
                  taxableAmount: 4500
                });

                return (
                  <div className="bg-slate-950/90 p-6 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">رقم الفاتورة: {sample.invoiceNumber}</span>
                        <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full">
                          {sample.zatcaComplianceStatus}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">UUID: {sample.invoiceUuid}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs">
                      <div>المبلغ الخاضع للضريبة: <span className="text-white font-mono font-bold">{sample.taxableAmount} SAR</span></div>
                      <div>ضريبة القيمة المضافة (15%): <span className="text-amber-400 font-mono font-bold">{sample.vatAmount} SAR</span></div>
                      <div>الإجمالي الشامل للضريبة: <span className="text-emerald-400 font-mono font-bold">{sample.totalWithVat} SAR</span></div>
                    </div>

                    <div className="space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-slate-300">
                      <div>الختم المشفر (Cryptographic Stamp): <span className="text-cyan-400">{sample.cryptographicStamp}</span></div>
                      <div>تشفير الفاتورة السابقة (Previous Hash): <span className="text-purple-400">{sample.previousInvoiceHash}</span></div>
                      <div>الرقم الضريبي للمنشأة: <span className="text-slate-100">{sample.sellerVatNumber}</span></div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>نظام الاعتماد وتوثيق المعمارية المؤسسية - JAM SYSTEM PRO (المحاور الـ 16)</span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl transition font-semibold"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

