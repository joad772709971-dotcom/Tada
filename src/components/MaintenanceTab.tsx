import { useState } from 'react';
import { MaintenanceJob, MaintenanceStatus, Transaction, TransactionType, PaymentMethod } from '../types';
import { Search, Plus, Trash2, CheckSquare, Wrench, Settings, DollarSign, UserCheck, ShieldCheck, Printer } from 'lucide-react';

interface MaintenanceTabProps {
  jobs: MaintenanceJob[];
  onAddJob: (job: MaintenanceJob) => void;
  onDeleteJob: (id: string) => void;
  onUpdateJobStatus: (id: string, status: MaintenanceStatus) => void;
  onIssueInvoice: (jobId: string, amount: number) => void; // Link to finance
}

export default function MaintenanceTab({ jobs, onAddJob, onDeleteJob, onUpdateJobStatus, onIssueInvoice }: MaintenanceTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MaintenanceStatus>('all');

  // Ading State
  const [isAdding, setIsAdding] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [cost, setCost] = useState('');
  const [costOfParts, setCostOfParts] = useState('');
  const [technicianName, setTechnicianName] = useState('ياسر العراقي');
  const [notes, setNotes] = useState('');

  const technicians = ['ياسر العراقي', 'مرتضى صلاح', 'علي الهادي'];

  const filtered = jobs.filter(j => {
    const matchesSearch = j.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          j.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          j.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          j.customerPhone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !deviceModel || !problemDescription) return;

    const newJob: MaintenanceJob = {
      id: 'm_' + Date.now(),
      customerName,
      customerPhone,
      deviceModel,
      problemDescription,
      status: MaintenanceStatus.RECEIVED,
      cost: Number(cost) || 0,
      costOfParts: Number(costOfParts) || 0,
      technicianName,
      notes,
      createdAt: new Date().toISOString(),
      invoiceIssued: false
    };

    onAddJob(newJob);

    // Resetting
    setCustomerName('');
    setCustomerPhone('');
    setDeviceModel('');
    setProblemDescription('');
    setCost('');
    setCostOfParts('');
    setNotes('');
    setIsAdding(false);
  };

  const handleStatusChange = (jobId: string, newStatus: MaintenanceStatus) => {
    onUpdateJobStatus(jobId, newStatus);
  };

  // Issuing bill to cashier safe & finance ledger
  const handleIssueInvoice = (job: MaintenanceJob) => {
    if (job.invoiceIssued) return;
    const totalRevenue = job.cost + job.costOfParts;
    onIssueInvoice(job.id, totalRevenue);
  };

  const getStatusColor = (status: MaintenanceStatus) => {
    switch (status) {
      case MaintenanceStatus.RECEIVED:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case MaintenanceStatus.IN_PROGRESS:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case MaintenanceStatus.READY:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse';
      case MaintenanceStatus.DELIVERED:
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case MaintenanceStatus.CANCELLED:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getStatusLabel = (status: MaintenanceStatus) => {
    switch (status) {
      case MaintenanceStatus.RECEIVED: return 'تم الاستلام (بانتظار الفحص)';
      case MaintenanceStatus.IN_PROGRESS: return 'قيد العمل الفني واللحام';
      case MaintenanceStatus.READY: return 'جاهز للتسليم والقبض';
      case MaintenanceStatus.DELIVERED: return 'تم التسليم للزبون مغلق';
      case MaintenanceStatus.CANCELLED: return 'ملغي ومسترجع';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/30 p-6 rounded-3xl border border-slate-850">
        <div>
          <h2 className="text-xl font-black text-white">ورشة وقسم صيانة الهواتف</h2>
          <p className="text-xs text-slate-400 mt-1">بطاقات صيانة العملاء وتتبع المجهود المهني وإصدار الفواتير الفورية</p>
        </div>

        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-teal-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          فتح تذكرة صيانة للعميل
        </button>
      </div>

      {/* Adding Form Block */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-3xl border border-teal-500/20 shadow-xl space-y-4 animate-fadeIn">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-teal-400 animate-spin-slow" />
            فتح تذكرة وضبط هاتف مستلم للصيانة
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer name */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">اسم الزبون الثلاثي</label>
              <input 
                type="text" 
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="أحمد جاسم الخفاجي..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right"
                required
              />
            </div>

            {/* Customer phone */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">رقم هاتف الزبون للتواصل</label>
              <input 
                type="text" 
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="077XXXXXXXX..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right font-mono"
                required
              />
            </div>

            {/* Device Model */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">موديل الجهاز المعني</label>
              <input 
                type="text" 
                value={deviceModel}
                onChange={e => setDeviceModel(e.target.value)}
                placeholder="مثال: iPhone 13 Pro Max..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Troubles description */}
            <div className="space-y-1.5 text-right md:col-span-2">
              <label className="text-xs text-slate-400 font-bold block">وصف المشكلة والأعطال الظاهرة</label>
              <input 
                type="text" 
                value={problemDescription}
                onChange={e => setProblemDescription(e.target.value)}
                placeholder="شاشة مهشمة، عطل شحن، بصمة متوقفة..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right"
                required
              />
            </div>

            {/* Wages labor */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">أجور الصيانة للعمل (د.ع)</label>
              <input 
                type="number" 
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="25000"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right font-mono"
              />
            </div>

            {/* Cost of parts */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">تكلفة قط الغيار التقديرية (د.ع)</label>
              <input 
                type="number" 
                value={costOfParts}
                onChange={e => setCostOfParts(e.target.value)}
                placeholder="120000"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Technician */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">الفني المتابع والمصلح</label>
              <select 
                value={technicianName}
                onChange={e => setTechnicianName(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2.5 text-xs text-white text-right"
              >
                {technicians.map(tech => (
                  <option key={tech} value={tech}>{tech}</option>
                ))}
              </select>
            </div>

            {/* Maintenance Notes */}
            <div className="space-y-1.5 text-right md:col-span-2">
              <label className="text-xs text-slate-400 font-bold block">ملاحظات تسلم إضافية (الضمان، عيوب خارجية وهيكل..)</label>
              <input 
                type="text" 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="مثال: يوجد خدوش خفيفة في الظهر الزجاجي..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={() => setIsAdding(false)} 
              className="px-4 py-2 rounded-xl text-xs text-slate-400 font-bold hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 rounded-xl text-xs bg-teal-500 text-slate-950 font-bold hover:bg-teal-400"
            >
              توثيق وطباعة كارت الاستلام
            </button>
          </div>
        </form>
      )}

      {/* Database Filter toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/30 p-4 rounded-2xl border border-slate-900">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
          <input 
            type="text"
            placeholder="ابحث برقم التذكرة، اسم الزبون، هاتف الزبون أو موديل الهاتف..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 focus:border-teal-500 rounded-xl pr-10 pl-4 py-3 text-xs text-slate-200 text-right font-sans"
          />
        </div>

        {/* State filters dropdown */}
        <select 
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="bg-slate-900/50 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-xs text-slate-300 font-medium w-full md:w-auto text-right"
        >
          <option value="all">كل الحالات والورش</option>
          <option value={MaintenanceStatus.RECEIVED}>تم الاستلام فقط</option>
          <option value={MaintenanceStatus.IN_PROGRESS}>قيد العمل الفني</option>
          <option value={MaintenanceStatus.READY}>جاهز للتسليم</option>
          <option value={MaintenanceStatus.DELIVERED}>سلم للزبون</option>
          <option value={MaintenanceStatus.CANCELLED}>حالة ملغاة</option>
        </select>
      </div>

      {/* Repair Tickets Grid List */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-slate-900/20 border border-slate-850 p-12 text-center text-slate-500 font-semibold rounded-3xl">
            لم نجد أي بطاقات صيانة مسجلة تطابق المراجعة والفلترة الحالية.
          </div>
        ) : (
          filtered.map(j => (
            <div key={j.id} className="bg-slate-900/20 border border-slate-850/80 p-6 rounded-3xl flex flex-col justify-between gap-4 relative overflow-hidden group hover:border-teal-500/10 transition-all">
              
              {/* Header inside ticket card */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">#TKT-{j.id.slice(-5)}</span>
                    <span className="text-[10px] font-mono text-slate-400">{new Date(j.createdAt).toLocaleDateString('ar-IQ')}</span>
                  </div>
                  <h4 className="text-base font-black text-white mt-1">{j.deviceModel}</h4>
                  <p className="text-xs text-slate-400 mt-1">العميل: <span className="font-semibold text-white">{j.customerName}</span> | {j.customerPhone}</p>
                </div>

                <span className={`inline-flex px-3 py-1 text-[10px] rounded-full font-bold border ${getStatusColor(j.status)}`}>
                  {getStatusLabel(j.status)}
                </span>
              </div>

              {/* Troubleshooting logs info */}
              <div className="space-y-2 py-3 border-y border-slate-850/60 my-2 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">العطل والخلل الملاحظ:</span>
                  <p className="text-slate-200 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850/40">{j.problemDescription}</p>
                </div>

                {j.notes && (
                  <div>
                    <span className="text-slate-500 font-bold block mb-0.5">ملاحظات الورشة والطرفيات:</span>
                    <p className="text-slate-400 italic text-[11px]">" {j.notes} "</p>
                  </div>
                )}
              </div>

              {/* Financial calculation within job ticket */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/20 p-4 rounded-2xl border border-slate-850/60">
                <div className="flex gap-4">
                  <div>
                    <span className="text-slate-500 font-bold block text-[10px]">أجور اليد</span>
                    <span className="font-mono text-slate-300 font-bold">{j.cost.toLocaleString()} د.ع</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block text-[10px]">قطع الغيار</span>
                    <span className="font-mono text-slate-300 font-bold">{j.costOfParts.toLocaleString()} د.ع</span>
                  </div>
                  <div className="border-r border-slate-800 pr-3">
                    <span className="text-slate-500 font-bold block text-[10px]">إجمالي الفاتورة مالي</span>
                    <span className="font-mono text-teal-400 font-black">{(j.cost + j.costOfParts).toLocaleString()} د.ع</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-bold block text-[10px]">الفني المسؤول</span>
                  <span className="text-slate-300 inline-flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-teal-400" /> {j.technicianName}
                  </span>
                </div>
              </div>

              {/* Action buttons inside Ticket card */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                
                {/* Status modifier dropdown selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400">تعديل الحالة:</span>
                  <select 
                    value={j.status}
                    onChange={e => handleStatusChange(j.id, e.target.value as MaintenanceStatus)}
                    className="bg-slate-850/80 border border-slate-800 text-slate-300 text-[10px] font-bold py-1.5 px-2.5 rounded-xl focus:border-teal-500 text-right"
                  >
                    <option value={MaintenanceStatus.RECEIVED}>استلام</option>
                    <option value={MaintenanceStatus.IN_PROGRESS}>بدء صيانة</option>
                    <option value={MaintenanceStatus.READY}>جاهز</option>
                    <option value={MaintenanceStatus.DELIVERED}>تفريغ وتسليم</option>
                    <option value={MaintenanceStatus.CANCELLED}>إلغاء واسترجاع</option>
                  </select>
                </div>

                {/* Bill invoicing logic */}
                <div className="flex items-center gap-2">
                  {!j.invoiceIssued && (j.status === MaintenanceStatus.READY || j.status === MaintenanceStatus.DELIVERED) ? (
                    <button 
                      onClick={() => handleIssueInvoice(j)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-md shadow-emerald-500/10"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      إصدار الفاتورة وتوريد للحسابة
                    </button>
                  ) : j.invoiceIssued ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-1.5 rounded-lg flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> فاتورة معتمدة وموردة
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">الفاتورة تصدر بعد الصيانة</span>
                  )}

                  <button 
                    onClick={() => onDeleteJob(j.id)}
                    className="p-1.5 bg-slate-850 hover:bg-red-500/15 text-slate-400 hover:text-red-400 rounded-lg"
                    title="حذف التذكرة بشكل كامل"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}
