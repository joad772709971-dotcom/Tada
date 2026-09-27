import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Wifi, 
  Bluetooth, 
  Usb, 
  Monitor, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  Settings, 
  Sliders, 
  Eye, 
  Zap, 
  Info, 
  AlertTriangle, 
  X,
  Play
} from 'lucide-react';
import { 
  universalPrinterEngine, 
  DiscoveredPrinter, 
  PrintConnectionType, 
  PaperType, 
  PrinterBrand,
  PrintJobPayload 
} from '../services/printingService';

interface PrinterHardwareManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrinterHardwareManagerModal: React.FC<PrinterHardwareManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  const [printers, setPrinters] = useState<DiscoveredPrinter[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeConnType, setActiveConnType] = useState<PrintConnectionType>('bluetooth');
  const [activePaperType, setActivePaperType] = useState<PaperType>('thermal_80mm');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'devices' | 'designs' | 'permissions'>('devices');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isTestPrinting, setIsTestPrinting] = useState<boolean>(false);
  const [simulatedDevice, setSimulatedDevice] = useState<'mobile_android' | 'desktop_windows' | 'sunmi_pos'>('mobile_android');

  // Sample Invoice Payload for Live Preview & Testing
  const samplePayload: PrintJobPayload = {
    receiptId: 'INV-2026-9042',
    dateStr: new Date().toLocaleString('ar-YE'),
    merchantName: 'متجر JAM SYSTEM PRO التكافلي',
    merchantPhone: '+967 777 503 191',
    taxNumber: '1004859201',
    customerName: 'شركة البقعة للاستيراد والتصدير',
    customerPhone: '+967 771 234 567',
    items: [
      { name: 'شاشة سامسونج Smart 55-Inch 4K', qty: 2, unitPrice: 245000, totalPrice: 490000 },
      { name: 'كابل ألياف ضوئية عالي السرعة 10M', qty: 5, unitPrice: 8500, totalPrice: 42500 },
      { name: 'طابعة فواتير حرارية Xprinter 80mm', qty: 1, unitPrice: 65000, totalPrice: 65000 }
    ],
    subtotal: 597500,
    discount: 7500,
    taxAmount: 0,
    finalTotal: 590000,
    currency: 'ر.ي',
    notes: 'بضاعة مباعة لا ترد ولا تستبدل بعد 3 أيام من الاستلام'
  };

  useEffect(() => {
    if (isOpen) {
      setActiveConnType(universalPrinterEngine.getActiveConnectionType());
      setActivePaperType(universalPrinterEngine.getSelectedPaperType());
      handleScanPrinters();
    }
  }, [isOpen]);

  const handleScanPrinters = async () => {
    setIsSearching(true);
    setStatusMessage('جاري الفحص السريع والبحث عن الطابعات المتصلة (Bluetooth / Wi-Fi / USB / Spooler)...');
    try {
      const found = await universalPrinterEngine.discoverConnectedPrinters();
      setPrinters(found);
      if (found.length > 0 && !selectedPrinterId) {
        setSelectedPrinterId(found[0].id);
      }
      setStatusMessage(`✓ تم العثور على ${found.length} طابعة متاحة ومقترنة بنجاح.`);
    } catch (e: any) {
      setStatusMessage(`خطأ أثناء البحث عن الطابعات: ${e.message || e}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectConnType = (type: PrintConnectionType) => {
    setActiveConnType(type);
    universalPrinterEngine.setConnectionType(type);
    setStatusMessage(`تم اختيار نوع الاتصال: [${type.toUpperCase()}]`);
  };

  const handleSelectPaperType = (paper: PaperType) => {
    setActivePaperType(paper);
    universalPrinterEngine.setSelectedPaperType(paper);
    setStatusMessage(`تم اختيار قياس الورق: [${paper}]`);
  };

  const handleRunTestPrint = async () => {
    setIsTestPrinting(true);
    setStatusMessage('جاري إرسال أوامر الطباعة الاختبارية إلى الطابعة المحددة...');
    try {
      const ok = await universalPrinterEngine.printPayload(samplePayload);
      if (ok) {
        setStatusMessage('✓ تمت الطباعة الاختبارية بنجاح! تم فتح درج النقدية وقص الورقة تلقائياً.');
      } else {
        setStatusMessage('لم يتم إكمال العملية أو أُغلقت نافذة الطباعة.');
      }
    } catch (e: any) {
      setStatusMessage(`فشلت الطباعة: ${e.message || e}`);
    } finally {
      setIsTestPrinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 text-right" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-sky-400">
                <Printer className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                إدارة الطابعات والأجهزة والمستندات (القسم 1)
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono">
                  Hardware Engine v3.0
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                ربط واكتشاف طابعات الفواتير (Bluetooth / Wi-Fi LAN / USB / Spooler) والأوراق الحرارية وA4
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-2 pt-3">
          <button
            onClick={() => setActiveTab('devices')}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'devices'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Printer className="w-4 h-4" />
            الطابعات والربط المباشر
          </button>

          <button
            onClick={() => setActiveTab('designs')}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'designs'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            معاينة تصاميم الفواتير والورق
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'permissions'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="w-4 h-4" />
            قواعد الإعدادات والأذونات
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {statusMessage && (
            <div className="bg-slate-950/80 border border-slate-800 text-xs text-sky-300 p-3.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Real-time Spooler Driver</span>
            </div>
          )}

          {/* TAB 1: DEVICE DISCOVERY & CONNECTION SETTINGS */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              
              {/* Connection Types Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">اختر وسيلة الاتصال المباشرة بالطابعة:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    onClick={() => handleSelectConnType('bluetooth')}
                    className={`p-3.5 rounded-2xl border text-right transition flex flex-col justify-between space-y-2 ${
                      activeConnType === 'bluetooth'
                        ? 'bg-sky-950/60 border-sky-500 text-sky-200 shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Bluetooth className="w-5 h-5 text-sky-400" />
                      {activeConnType === 'bluetooth' && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">بلوتوث (Bluetooth SPP)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">طابعات المحمول والجوالات</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectConnType('wifi_lan')}
                    className={`p-3.5 rounded-2xl border text-right transition flex flex-col justify-between space-y-2 ${
                      activeConnType === 'wifi_lan'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Wifi className="w-5 h-5 text-emerald-400" />
                      {activeConnType === 'wifi_lan' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">الشبكة والوايفاي (Port 9100)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Epson & IP Printers</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectConnType('usb_direct')}
                    className={`p-3.5 rounded-2xl border text-right transition flex flex-col justify-between space-y-2 ${
                      activeConnType === 'usb_direct'
                        ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Usb className="w-5 h-5 text-purple-400" />
                      {activeConnType === 'usb_direct' && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">سلك USB مباشر (WebUSB)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">طابعات الكاشير المباشرة</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectConnType('system_spooler')}
                    className={`p-3.5 rounded-2xl border text-right transition flex flex-col justify-between space-y-2 ${
                      activeConnType === 'system_spooler'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Monitor className="w-5 h-5 text-amber-400" />
                      {activeConnType === 'system_spooler' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">طابعة الويندوز (Spooler)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">طابعات المكتب A4/A5</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Paper Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">حدد حجم ونوع ورق الطباعة المعتمد:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'thermal_80mm', title: 'ورق حراري 80mm', sub: 'Standard Thermal POS' },
                    { id: 'thermal_58mm', title: 'ورق حراري 58mm', sub: 'Mobile Portable POS' },
                    { id: 'standard_a4', title: 'ورق مكاتب A4', sub: 'Standard Full Sheet' },
                    { id: 'standard_a5', title: 'ورق مكاتب A5', sub: 'Half Sheet Document' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPaperType(p.id as PaperType)}
                      className={`p-3 rounded-xl border text-xs font-semibold text-right transition ${
                        activePaperType === p.id
                          ? 'bg-sky-600/20 border-sky-500 text-sky-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-white font-bold">{p.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Discovered Printers List Header */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-4.5 h-4.5 text-sky-400" />
                  <span className="text-xs font-bold text-white">قائمة الطابعات المقترنة والمكتشفة بالنظام:</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleScanPrinters}
                    disabled={isSearching}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isSearching ? 'جاري البحث والتحسس...' : 'إعادة البحث والحس'}</span>
                  </button>

                  <button
                    onClick={handleRunTestPrint}
                    disabled={isTestPrinting}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg transition disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isTestPrinting ? 'جاري إرسال أمر الطباعة...' : 'طباعة تجريبية الآن'}</span>
                  </button>
                </div>
              </div>

              {/* Devices Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {printers.map((pr) => (
                  <div
                    key={pr.id}
                    onClick={() => setSelectedPrinterId(pr.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition space-y-2.5 ${
                      selectedPrinterId === pr.id
                        ? 'bg-slate-950 border-sky-500/80 shadow-md ring-1 ring-sky-500/50'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {pr.connectionType === 'bluetooth' && <Bluetooth className="w-4 h-4 text-sky-400" />}
                        {pr.connectionType === 'wifi_lan' && <Wifi className="w-4 h-4 text-emerald-400" />}
                        {pr.connectionType === 'usb_direct' && <Usb className="w-4 h-4 text-purple-400" />}
                        {pr.connectionType === 'system_spooler' && <Monitor className="w-4 h-4 text-amber-400" />}
                        <h5 className="text-xs font-bold text-white">{pr.name}</h5>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        متاحة
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-850">
                      <span>العنوان/المعرف: <strong className="font-mono text-slate-200">{pr.address || 'System Default'}</strong></span>
                      <span className="uppercase text-[10px] font-mono text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded">
                        {pr.brand}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* TAB 2: LIVE RECEIPT & INVOICE LAYOUT PREVIEW */}
          {activeTab === 'designs' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    معاينة الشكل النهائي للفاتورة حسب حجم الورق ({activePaperType})
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    طريقة تنسيق المحاذاة، الجداول، المجموع، واللوجو وفق المعايير التجارية
                  </p>
                </div>
                <button
                  onClick={handleRunTestPrint}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة هذا التصميم
                </button>
              </div>

              {/* Receipt Preview Paper Box */}
              <div className="flex justify-center bg-slate-950/90 p-6 rounded-2xl border border-slate-800">
                <div 
                  className={`bg-white text-slate-950 p-6 shadow-2xl rounded-sm font-sans text-right transition-all duration-300 ${
                    activePaperType === 'thermal_58mm' ? 'w-[280px] text-xs' :
                    activePaperType === 'thermal_80mm' ? 'w-[360px] text-xs' :
                    activePaperType === 'standard_a5' ? 'w-[480px] text-sm' :
                    'w-[600px] text-sm'
                  }`}
                >
                  {/* Header */}
                  <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3">
                    <div className="font-extrabold text-base text-black">{samplePayload.merchantName}</div>
                    <div className="text-xs text-slate-700">هاتف: {samplePayload.merchantPhone}</div>
                    <div className="text-xs text-slate-700">الرقم الضريبي: {samplePayload.taxNumber}</div>
                    <div className="mt-2 pt-2 border-t border-slate-300 font-bold">
                      فاتورة مبيعات #: {samplePayload.receiptId}
                    </div>
                    <div className="text-[11px] text-slate-600">التاريخ: {samplePayload.dateStr}</div>
                  </div>

                  {/* Customer Info */}
                  <div className="text-xs mb-3 space-y-0.5 border-b border-slate-200 pb-2">
                    <div><strong>العميل:</strong> {samplePayload.customerName}</div>
                    <div><strong>رقم الجوال:</strong> {samplePayload.customerPhone}</div>
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-xs text-right mb-3">
                    <thead>
                      <tr className="border-b border-black">
                        <th className="py-1">الصنف</th>
                        <th className="py-1 text-center">الكمية</th>
                        <th className="py-1 text-left">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {samplePayload.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 font-medium">{it.name}</td>
                          <td className="py-1.5 text-center font-mono">{it.qty}</td>
                          <td className="py-1.5 text-left font-mono">{it.totalPrice.toLocaleString()} {samplePayload.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="border-t-2 border-black pt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>المجموع الفرعي:</span>
                      <span className="font-mono">{samplePayload.subtotal.toLocaleString()} {samplePayload.currency}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>الخصم:</span>
                      <span className="font-mono">-{samplePayload.discount.toLocaleString()} {samplePayload.currency}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-sm bg-slate-100 p-2 rounded mt-1 border border-slate-300">
                      <span>الإجمالي النهائي:</span>
                      <span className="font-mono text-black">{samplePayload.finalTotal.toLocaleString()} {samplePayload.currency}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="text-center text-[10px] text-slate-500 mt-4 border-t border-dashed border-slate-300 pt-2">
                    شكراً لزيارتكم! البضاعة مباعة وفق الشروط المعلنة.<br />
                    JAM SYSTEM PRO - POS & Hardware Engine
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PERMISSIONS & MANIFEST LAWS (Android / Windows) */}
          {activeTab === 'permissions' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  شروط وقوانين صلاحيات الأجهزة وطابعات البلوتوث والوايفاي (Android & Desktop Rules)
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  لكي يتم اكتشاف وعرض كافة الطابعات المقترنة بشكل حقيقي عبر أجهزة الكمبيوتر وأجهزة الأندرويد، يجب مراعاة القوانين والإعدادات الرسمية التالية:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                
                {/* Android Native Manifest Rules */}
                <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                    <Bluetooth className="w-4 h-4" />
                    1. إعدادات وصلاحيات الأندرويد (Android Manifest & Location)
                  </div>
                  <ul className="space-y-2 text-slate-300 text-[11px] leading-relaxed list-disc pr-4">
                    <li>تطلب نظام Android 12+ تفعيل صلاحيات <code className="text-amber-300 font-mono">BLUETOOTH_SCAN</code> و <code className="text-amber-300 font-mono">BLUETOOTH_CONNECT</code>.</li>
                    <li>ضرورة منح صلاحية الموقع الجغرافي الدقيق <code className="text-amber-300 font-mono">ACCESS_FINE_LOCATION</code> لاكتشاف أجهزة البلوتوث المحيطة.</li>
                    <li>يجب اقتران الطابعة أولاً من إعدادات البلوتوث الرئيسية بالجهاز حتى تظهر في قائمة SPP المتاحة.</li>
                  </ul>
                </div>

                {/* Windows Desktop & Spooler Drivers */}
                <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <Monitor className="w-4 h-4" />
                    2. إعدادات الكمبيوتر والتعاريف (Windows CUPS & Drivers)
                  </div>
                  <ul className="space-y-2 text-slate-300 text-[11px] leading-relaxed list-disc pr-4">
                    <li>طابعات Epson و HP و Xprinter تتطلب تثبيت برنامج التعريف الأصلي (Driver) الخاص بالمصنع على نظام الويندوز.</li>
                    <li>طابعات الشبكة والوايفاي تعتمد على فتح البورت المباشر <code className="text-emerald-300 font-mono">9100 Raw Socket</code> في جدار الحماية (Firewall).</li>
                    <li>يدعم محرك JAM الطباعة المباشرة وإرسال أمر فتح درج النقدية المربوط بالطابعة تلقائياً عبر نبضة ESC/POS.</li>
                  </ul>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>محرك إدارة الطابعات والطباعة الحرارية جاهز ومفعّل</span>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-xl transition"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
