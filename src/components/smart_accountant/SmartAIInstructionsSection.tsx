import React from 'react';
import { 
  Bot, Mic, PhoneCall, Sparkles, CheckCircle2, ArrowRight, 
  ArrowDownLeft, ArrowUpRight, ShoppingCart, PackageCheck, Wrench, 
  Signal, ArrowLeftRight, UserCheck, FileSpreadsheet, RotateCcw, 
  HelpCircle, Keyboard, ShieldCheck, Zap
} from 'lucide-react';

interface SmartAIInstructionsSectionProps {
  onSelectPrompt: (prompt: string, autoSubmit?: boolean) => void;
  onStartVoiceCall?: () => void;
  onOpenVoice?: () => void;
}

export const SmartAIInstructionsSection: React.FC<SmartAIInstructionsSectionProps> = ({
  onSelectPrompt,
  onStartVoiceCall,
  onOpenVoice
}) => {
  const quickExamples = [
    {
      category: 'سند صرف',
      icon: ArrowDownLeft,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      prompt: 'صرفت 50,000 ريال إيجار المحل نقداً من الصندوق الرئيسي',
      shortDesc: 'مصروفات، إيجار، كهرباء، ونثريات نقداً أو بنك'
    },
    {
      category: 'سند قبض',
      icon: ArrowUpRight,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      prompt: 'استلمت 100 دولار من العميل فهد دفعة لحسابه في الكريمي',
      shortDesc: 'دفعات عملاء، إيرادات، ومقبوضات عامة'
    },
    {
      category: 'مبيعات',
      icon: ShoppingCart,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      prompt: 'سجل مبيعات كاش هواتف وإكسسوارات بقيمة 85,000 ريال في الصندوق الرئيسي',
      shortDesc: 'مبيعات نقدية أو آجلة وتحديث المخزون'
    },
    {
      category: 'مشتريات',
      icon: PackageCheck,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      prompt: 'اشتريت شاشات وقطع غيار بقيمة 300,000 ريال من المورد شركة النجم آجل',
      shortDesc: 'فواتير مشتريات وتحديث حسابات الموردين'
    },
    {
      category: 'صيانة',
      icon: Wrench,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      prompt: 'صيانة شاشة آيفون 13 بقيمة 35,000 ريال (أجور 15 ألف + تكلفة شاشة 20 ألف)',
      shortDesc: 'أجور صيانة مع تكاليف قطع الغيار'
    },
    {
      category: 'شحن رصيد',
      icon: Signal,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      prompt: 'شحن رصيد يمن موبايل وباقة مزايا بقيمة 12,000 ريال نقداً من الصندوق',
      shortDesc: 'شحن رصيد وباقات اتصالات فورية'
    },
    {
      category: 'تحويل بين الخزائن',
      icon: ArrowLeftRight,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      prompt: 'تحويل مبلغ 200,000 ريال من الصندوق الرئيسي إلى حساب بنك التضامن',
      shortDesc: 'مناقلة سيولة بين الصناديق والبنوك'
    },
    {
      category: 'رواتب وسلف',
      icon: UserCheck,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      prompt: 'صرف سلفة على حساب الراتب لمهندس الصيانة 20,000 ريال نقداً',
      shortDesc: 'سلف ورواتب وعهد الموظفين'
    },
    {
      category: 'استعلام مالي',
      icon: FileSpreadsheet,
      color: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
      prompt: 'أعطني تقريراً تفصيلياً عن مبيعات ومصاريف وصافي أرباح اليوم',
      shortDesc: 'استعراض الأرباح والكشوفات والديون'
    }
  ];

  return (
    <div className="space-y-6 text-right select-none" dir="rtl">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <HelpCircle size={22} />
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white">
                دليل وتعليمات استخدام المحاسب الذكي
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              المحاسب الذكي مصمم لتدقيق القيود المحاسبية تلقائياً وفق مبادئ القيد المزدوج، موازنة الصناديق، وتحديث الكشوفات بدقة متناهية بدون أخطاء.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onStartVoiceCall && (
              <button
                type="button"
                onClick={onStartVoiceCall}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all hover:scale-105"
              >
                <PhoneCall size={15} />
                <span>اتصال صوتي 📞</span>
              </button>
            )}
            {onOpenVoice && (
              <button
                type="button"
                onClick={onOpenVoice}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
              >
                <Mic size={15} />
                <span>تحدث صوتياً 🎙️</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3 Steps Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-black text-sm">
            <span className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs">1</span>
            <span>تحدث أو اكتب بطبيعتك</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            اذكر العملية كما تقولها شفهياً، مثل "صرفت 50 ألف إيجار" أو "قبضت 100$ من فهد". المحاسب يفهم اللهجة اليمنية والعربية والأرقام تلقائياً.
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs">2</span>
            <span>تدقيق القيد المزدوج فوراً</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            يقوم النظام بتحديد المدين والدائن والصندوق المعني، ومطابقة شجرة الحسابات والتأكد أن إجمالي المدين = إجمالي الدائن بدقة.
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-black text-sm">
            <span className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center text-xs">3</span>
            <span>اعتماد وترحيل بضغطة زر</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            راجع تفاصيل العملية والأثر على الأرباح والسيولة، ثم اضغط "اعتماد وترحيل" لحفظ القيد سحابياً ومحلياً مع إمكانية التراجع بأي لحظة.
          </p>
        </div>
      </div>

      {/* Interactive Quick Examples */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <Sparkles size={16} className="text-amber-400" />
            <span>أمثلة واقعية سريعة (اضغط للتجربة الفورية):</span>
          </div>
          <span className="text-[11px] text-slate-400">انقر على أي مثال لتطبيقه في نافذة الأوامر</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickExamples.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                className="bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-indigo-500/50 rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${item.color}`}>
                      <Icon size={14} />
                      <span>{item.category}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                  </div>
                  <p className="text-xs text-slate-200 font-bold leading-relaxed line-clamp-2">
                    "{item.prompt}"
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {item.shortDesc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPrompt(item.prompt, item.category === 'استعلام مالي')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 group-hover:border-indigo-500 transition-all"
                >
                  <span>تجربة القيد الآن</span>
                  <ArrowRight size={13} className="rotate-180" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rules & Shortcuts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Accounting Shield Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-black text-amber-400">
            <ShieldCheck size={18} />
            <span>قواعد الأمان المحاسبي المعزول:</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>توازن إلزامي:</strong> لن يتم ترحيل أي قيد إذا كان مجموع المدين لا يساوي الدائن.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>عزل المتاجر:</strong> جميع القيود والحسابات محصورة ضمن معرف متجرك ولا تختلط بغيرها.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>إمكانية التراجع:</strong> يمكنك عكس أي قيد مسجل في الجلسة بنقرة واحدة عبر زر "تراجع".</span>
            </li>
          </ul>
        </div>

        {/* Keyboard & Voice Shortcuts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-black text-cyan-400">
            <Keyboard size={18} />
            <span>اختصارات العمل السريع:</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
            <li className="flex items-center justify-between bg-slate-800/60 p-2 rounded-xl border border-slate-750">
              <span>إرسال وتدقيق القيد</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px] border border-slate-600">Enter</kbd>
            </li>
            <li className="flex items-center justify-between bg-slate-800/60 p-2 rounded-xl border border-slate-750">
              <span>سطر جديد في مربع النص</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 font-mono text-[11px] border border-slate-600">Shift + Enter</kbd>
            </li>
            <li className="flex items-center justify-between bg-slate-800/60 p-2 rounded-xl border border-slate-750">
              <span>اتصال صوتي مستمر بدون نقر</span>
              <span className="text-emerald-400 font-bold">زر "اتصال 📞"</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SmartAIInstructionsSection;
