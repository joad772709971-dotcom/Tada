import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { geminiService } from '../services/geminiService';
import { Transaction, Product, MaintenanceJob } from '../types';
import { Sparkles, Send, BrainCircuit, RefreshCw, BarChart2, ShieldAlert } from 'lucide-react';

interface AITabProps {
  transactions: Transaction[];
  products: Product[];
  maintenance: MaintenanceJob[];
}

export default function AITab({ transactions, products, maintenance }: AITabProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string>('');

  const quickPrompts = [
    { title: 'تحليل جودة الحسابات والمطابقة المالية', icon: <BrainCircuit className="w-4 h-4 text-teal-400" /> },
    { title: 'تقييم أداء ورشة الصيانة والمبيعات النشطة', icon: <BarChart2 className="w-4 h-4 text-teal-400" /> },
    { title: 'كشف عجز ومطابقة المخزون النقدية', icon: <ShieldAlert className="w-4 h-4 text-teal-400" /> }
  ];

  const handleFetchAnalysis = async (customQ?: string) => {
    setLoading(true);
    try {
      const q = customQ || question;
      const res = await geminiService.analyzeShopData(transactions, products, maintenance, q);
      setReport(res);
    } catch (err) {
      console.error(err);
      setReport('❌ عذراً، حصلت مشكلة أثناء تشغيل محرك الرقابة والتحليل المبتكر لنظام JAM. يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
      setQuestion('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and overview */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/30 p-6 rounded-3xl border border-slate-850">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
            منصة الاستشارة والذكاء الاصطناعي التوليدي لـ JAM
          </h2>
          <p className="text-xs text-slate-400 mt-1">احصل على استشارات مالية فورية ورصد مؤشرات الأداء الحقيقية لمشروعك</p>
        </div>

        <button 
          onClick={() => handleFetchAnalysis()}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50 hover:bg-teal-400"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          توليد التقرير المالي الشامل
        </button>
      </div>

      {/* Suggestion prompt chips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {quickPrompts.map((p, idx) => (
          <button 
            key={idx}
            onClick={() => handleFetchAnalysis(p.title)}
            disabled={loading}
            className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900/20 border border-slate-850 text-right hover:border-teal-500/20 transition-all text-xs font-semibold text-slate-200 disabled:opacity-50"
          >
            <div className="p-2 rounded-xl bg-slate-950/60">
              {p.icon}
            </div>
            <span>{p.title}</span>
          </button>
        ))}
      </div>

      {/* Direct question form panel */}
      <div className="bg-slate-900/10 border border-slate-850 p-6 rounded-3xl">
        <h3 className="text-xs font-bold text-slate-400 mb-3 block text-right">أو اسأل الخبير التدريبي التوليدي عن أي موضوع مالي محدد:</h3>
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <input 
            type="text" 
            placeholder="مثال: هل رصيد الخزينة متناسب مع مبيعات شاشات الايفون؟ كيف أحسن من هامش ربح الصيانة؟..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={loading}
            className="w-full sm:flex-1 bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-xs text-slate-200 text-right font-sans"
          />
          <button 
            onClick={() => handleFetchAnalysis()}
            disabled={loading || !question.trim()}
            className="px-5 py-3 bg-teal-500 text-slate-950 font-black rounded-xl text-xs whitespace-nowrap flex items-center gap-2 disabled:opacity-50 hover:bg-teal-400"
          >
            <Send className="w-3.5 h-3.5" />
            طرح السؤال
          </button>
        </div>
      </div>

      {/* Renders markdown and report */}
      {(report || loading) && (
        <div className="bg-slate-900/30 border border-teal-500/10 rounded-3xl p-6 md:p-8 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <span className="text-xs text-teal-400 font-bold flex items-center gap-1.5 font-mono">
              <Sparkles className="w-4 h-4 text-teal-400" />
              ANALYSIS_OUTPUT // GEMINI MODEL
            </span>
            <span className="text-[10px] text-slate-500 font-mono">AUTHORIZED SUCCESS</span>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-200">المدقق يحلل السجلات الدفترية ومستودعات قطع الغيار الحالية...</p>
                <p className="text-[10px] text-slate-500 font-mono">PROCESSING LEDGER, SAFE ACCURACY, TICKET LOGS</p>
              </div>
            </div>
          ) : (
            <div className="markdown-body text-slate-200 text-xs md:text-sm leading-relaxed space-y-4">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
