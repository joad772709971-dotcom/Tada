import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HelpCircle, BookOpen, MessageSquare, History, PhoneCall, 
  ChevronRight, Store, Package, ShoppingCart, ShieldCheck, 
  User, Send, Image as ImageIcon, CheckCircle2, AlertCircle,
  Smartphone, Monitor, Cpu, Plus, FileText, Wrench,
  Scale, Receipt, Wallet, CreditCard, ArrowRightLeft, Percent, Coins, Landmark
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';

interface HelpCenterProps {
  profile: UserProfile | null;
}

export default function HelpCenter({ profile }: HelpCenterProps) {
  const [activeSegment, setActiveSegment] = useState<'docs' | 'feedback' | 'changelog'>('docs');
  const [selectedDoc, setSelectedDoc] = useState('overview');
  const [openAccordion, setOpenAccordion] = useState<string | null>('pos');
  
  // Feedback Form State
  const [feedback, setFeedback] = useState({
    type: 'suggestion',
    subject: '',
    content: '',
    image: null as string | null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const docs = [
    { id: 'overview', title: 'نظرة عامة والواجهة', icon: <Store size={18} /> },
    { id: 'shortcuts', title: 'لوحة الاختصارات السريعة (Hotkeys)', icon: <Cpu size={18} /> },
    { id: 'accordion_guide', title: 'الدليل التعريفي لأقسام النظام', icon: <BookOpen size={18} /> },
    { id: 'sales', title: 'إدارة المبيعات ونقاط البيع', icon: <ShoppingCart size={18} /> },
    { id: 'accounts', title: 'الحسابات والمالية والجرد الشامل', icon: <Scale size={18} /> },
    { id: 'inventory', title: 'إدارة المخازن والكتالوج', icon: <Package size={18} /> },
    { id: 'network', title: 'الترابط الشبكي وسلسلة التوريد', icon: <ShieldCheck size={18} /> },
    { id: 'maintenance', title: 'صيانة الأجهزة والضمانات', icon: <Wrench size={18} /> },
    { id: 'portal', title: 'بوابة الزبائن وتتبع الفواتير', icon: <User size={18} /> },
  ];

  const changelog = [
    { date: '2026-04-26', version: 'V2.5.0', changes: ['إطلاق نظام الترابط الشبكي الجديد', 'إضافة ميزة البحث برقم الهاتف للموردين', 'إدخال مركز الدردشة المباشرة', 'تحديث واجهة التسجيل وتصنيف العملاء'] }
  ];

  // Helper function to render detailed documentation section
  const renderDocContent = (id: string) => {
    switch(id) {
      case 'overview':
        return (
          <div className="space-y-6 text-right">
            <div className="p-6 bg-gradient-to-r from-zinc-900 to-zinc-950 rounded-[2rem] border-0 shadow-lg">
              <h3 className="text-xl font-black text-amber-400 mb-2 font-sans">مرحباً بك في JAM System Pro 🚀</h3>
              <p className="text-sm text-zinc-300 leading-relaxed font-bold">
                هو الحل السحابي المتكامل الأسرع والأكثر أماناً لإدارة مبيعات التجزئة والجملة، صيانة الأجهزة والضمانات، إدارة مخازن الفروع، والربط الحصري مع الموردين. تم تصميم النظام ليقدم استقراراً تشغيلياً تاماً وأدوات متطورة للمطابقة بين الأرصدة الدفترية والفعلية.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-zinc-900/80 w-full border-0 rounded-2xl space-y-2">
                <span className="text-lg">📱</span>
                <h4 className="font-black text-zinc-100 text-sm">سرعة تشغيلية فائقة في البيع</h4>
                <p className="text-xs text-zinc-400 font-bold leading-relaxed">لوحات بيع متطابقة وسريعة الاستجابة، باركود ذكي للقطع والمبيعات، وتفويض آمن للفواتير موازية مع المعايير الأمنية.</p>
              </div>
              <div className="p-5 bg-zinc-900/80 w-full border-0 rounded-2xl space-y-2">
                <span className="text-lg">🔒</span>
                <h4 className="font-black text-zinc-100 text-sm">أمان مالي ورقابي غير مسبوق</h4>
                <p className="text-xs text-zinc-400 font-bold leading-relaxed">تسجيل وتوثيق فوري مع حركات الدفاتر التشغيلية، ومراكز تدقيق وجرد بلمسة واحدة من هاتفك المحمول.</p>
              </div>
            </div>

            <div className="p-6 bg-amber-500/10 rounded-2xl border-0 flex gap-4 items-center">
              <div className="text-2xl">💡</div>
              <div className="text-right">
                <h5 className="font-black text-amber-400 text-xs">واجهة المستخدم والملاحة السلسة</h5>
                <p className="text-xs text-zinc-300 mt-1 font-bold leading-relaxed">باستخدام القوائم الجانبية السلسة والترويسة الموحدة للربط، يمكنك نقر الأيقونات المعنية للانتقال الفوري دون تشتيت أو تحميل زائد لصفحات المتصفح.</p>
              </div>
            </div>
          </div>
        );
      case 'shortcuts':
        return (
          <div className="space-y-6 text-right">
            <div className="p-6 bg-amber-500/10 rounded-2xl border-0 text-right">
              <h3 className="text-lg font-black text-amber-400 mb-2 font-sans flex items-center gap-2">
                <span>⌨️ لوحة اختصارات النظام السريعة (Hotkeys)</span>
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-bold">
                سهّل على موظفيك وفنيي الصيانة تشغيل واجهات JAM System Pro والتحقق من المبيعات بالسرعة القصوى عبر لوحة المفاتيح والتحكم المباشر.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border-0 bg-zinc-900/60 max-w-full">
              <table className="w-full text-right border-collapse text-xs text-zinc-300">
                <thead>
                  <tr className="bg-zinc-900 text-amber-400 border-none font-black">
                    <th className="p-4 rounded-rt-xl">الاختصار / الزر</th>
                    <th className="p-4">اسم الإجراء والعملية</th>
                    <th className="p-4 rounded-lt-xl">الوصف الفني للمهندس</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-805/40">
                  <tr className="hover:bg-zinc-800/20 transition-all border-none">
                    <td className="p-4 font-mono font-black text-amber-500">F2</td>
                    <td className="p-4 font-bold">الانتقال للوحة التحكم</td>
                    <td className="p-4 text-zinc-400">تحميل شاشة القياس والمبيعات الموحدة لأرصدة الخزنة في 0ms.</td>
                  </tr>
                  <tr className="hover:bg-zinc-800/20 transition-all border-none">
                    <td className="p-4 font-mono font-black text-amber-500">Ctrl + P</td>
                    <td className="p-4 font-bold">طباعة الفاتورة النشطة</td>
                    <td className="p-4 text-zinc-400">إرسال الفاتورة أو محضر الجرد تلقائياً للطابعة الحرارية أو الورق المسجل.</td>
                  </tr>
                  <tr className="hover:bg-zinc-800/20 transition-all border-none">
                    <td className="p-4 font-mono font-black text-amber-500">Ctrl + Shift + Z</td>
                    <td className="p-4 font-bold">تنشيط الطوارئ الأمنية (Lockdown)</td>
                    <td className="p-4 text-zinc-400">تمويه شاشات الصيانة والأرصدة بخلفيات عشوائية لحفظ الخصوصية فوراً من المقتحمين.</td>
                  </tr>
                  <tr className="hover:bg-zinc-800/20 transition-all border-none">
                    <td className="p-4 font-mono font-black text-amber-500">Enter بعد الباركود</td>
                    <td className="p-4 font-bold">تأكيد مسح الماسح الليزري</td>
                    <td className="p-4 text-zinc-400">إضافة المنتج كبند تلقائي في الفاتورة أو السلة المعتمدة بالمستند دون ماوس.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-zinc-900/40 text-[11px] text-zinc-400 rounded-xl space-y-1">
              <span className="font-bold text-amber-500">💡 معلومة احترافية:</span>
              <p className="leading-relaxed">يقوم قارئ الباركود الليزري بمحاكاة نقرات الكيبورد بسرعة متتالية وإنهاء المسح بزر Enter الافتراضي، ولهذا يقوم نظام JAM System Pro بترجمة هذه الإشارات فوراً لإتمام التجهيز بكفاءة فائقة.</p>
            </div>
          </div>
        );
      case 'accordion_guide':
        return (
          <div className="space-y-6 text-right">
            <div className="p-6 bg-zinc-900/60 rounded-2xl text-right">
              <h3 className="text-lg font-black text-amber-400 mb-2 font-sans">📖 الدليل التعريفي الشامل لواجهات JAM System Pro</h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-bold">
                دليل تعريفي تفاعلي يشرح كل شباك ونافذة ولوحة تشغيلية في نظامك لتسريع وتيرة تمكين الموظفين الجدد بالورشة.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: 'pos',
                  title: '✨ لوحة نقاط البيع المباشرة (POS)',
                  desc: 'الواجهة الأسرع لتسجيل مبيعات التجزئة للمشتركين والزبائن العابرين. تتميز بمرونة البيع عبر قارئ الباركود، دعم متعدد للعملات مع طباعة حرارية 80mm فائقة السرعة، وطرق دفع نقدية أو رقمية.'
                },
                {
                  id: 'wholesale',
                  title: '💼 كاونتر مبيعات الجملة والتوريد البيني',
                  desc: 'واجهة متخصصة لإدارة العمليات التجارية الذكية بأسعار الكلفة المخصصة. تدعم الجدولة الائتمانية والربط التلقائي على حسابات الموزعين وتصدير كشوف تسوية الدفاتر بـ PDF.'
                },
                {
                  id: 'finance',
                  title: '🪙 الصناديق المتعددة والترحيل المحاسبي',
                  desc: 'صندوق لكل موظف أو صالة لمنع العشوائية. تتيح تتبع الأرصدة النقدية لحظة بلحظة، إرسال ترحيل مالي آمن من صندوق لفرع آخر، وتسوية عجز وفوائض الخزنة المركزية.'
                },
                {
                  id: 'm_cards',
                  title: '🔧 كروت صيانة الأجهزة والضمان المرمّز',
                  desc: 'استقبال أجهزة الهواتف واللوحيات من الزبائن، كتابة العطل، تحديد المهندس المسؤول، وتقدير تكاليف الصيانة مبكرا. تمنح الزبون باركود تتبع فريد لمعرفة التقدم آلياً.'
                },
                {
                  id: 'inventory_ctrl',
                  title: '📦 مستودعات الكتالوج والجرد اليومي الأوتوماتيكي',
                  desc: 'لوحة التحكم بمدخرات الفروع لتثبيت البضاعة وحمايتها من الضياع. تصدر تقارير بالمواد الهالكة، تنبيهات بصرية بقرابة نفاد الكميات، ومناقلة البضائع بين المخازن بأمان رقابي.'
                },
                {
                  id: 'customer_portal',
                  title: '🌐 بوابة الزبائن وتتبع الفواتير والمديونية',
                  desc: 'بوابة خدمة ذاتية للزبائن VIP لمتابعة الرصيد المالي المترتب عليهم، تنزيل كشوف الحسابات المصدقة باللغتين العربية والانجليزية، ومسح رمز التحقق للتاريخ الضماني للقطع.'
                },
                {
                  id: 'agent_network',
                  title: '🤝 شبكة التوريد والترابط السحابي بين الفروع',
                  desc: 'نظام ربط حصري وسريع كفاءته 100% لإبرام شراكات استيراد رقمية مع الفروع والموردين، وتحديث الكتالوجات البينية والأسعار التنافسية أوتوماتيكياً دون معاملات ورقية.'
                }
              ].map(item => {
                const isOpen = openAccordion === item.id;
                return (
                  <div 
                    key={item.id} 
                    className="overflow-hidden rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 transition-all duration-300 border-0"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenAccordion(isOpen ? null : item.id)}
                      className="w-full p-5 text-right font-black text-sm text-zinc-100 hover:text-amber-400 transition-all flex items-center justify-between"
                    >
                      <span>{item.title}</span>
                      <ChevronRight 
                        size={18} 
                        className={`text-amber-500 transform transition-transform duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`} 
                      />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <div className="p-5 pt-0 text-xs text-zinc-400 font-bold leading-relaxed border-t border-zinc-800/40 mt-1">
                            {item.desc}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'sales':
        return (
          <div className="space-y-6 text-right">
            <div className="flex gap-3 items-center border-0 pb-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <ShoppingCart size={20} />
              </div>
              <h3 className="text-lg font-black text-zinc-100">تفاصيل قسم المبيعات ونقاط البيع (POS)</h3>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed font-bold">
              يوفر جزء المبيعات نظاماً ذكياً لإتمام الصفقات وتسجيل الفواتير المطبوعة بسرعة مثالية وقابل للتشغيل من مختلف الهواتف والشاشات اللوحية.
            </p>

            <div className="space-y-4">
              <h4 className="font-black text-sm text-amber-400">🔹 خطوات وطريقة إنهاء عملية البيع للزبائن:</h4>
              <div className="relative border-r-2 border-zinc-700/60 pr-5 space-y-4">
                <div className="relative">
                  <div className="absolute top-1 -right-[27px] w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[10px] text-zinc-950 font-black">1</div>
                  <h5 className="font-black text-xs text-zinc-100">1. اختيار وتحديد الأصناف من المعرض</h5>
                  <p className="text-xs text-zinc-400 font-bold mt-1">قراءة الباركود عبر الماسح السريع أو تحديد اسم المنتج والكمية المطلوبة وإضافتها إلى سلة المشتريات.</p>
                </div>
                <div className="relative">
                  <div className="absolute top-1 -right-[27px] w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[10px] text-zinc-950 font-black">2</div>
                  <h5 className="font-black text-xs text-zinc-100">2. تطبيق سياسة الأسعار والخصم</h5>
                  <p className="text-xs text-zinc-400 font-bold mt-1">يمكنك تعديل كمية كل منتج أو تطبيق الخصم بالكامل (سواء كنسبة مئوية أو مبلغ ثابت YER) من المجموع الكلي مع توليد ضريبة المبيعات المقررة تلقائياً.</p>
                </div>
                <div className="relative">
                  <div className="absolute top-1 -right-[27px] w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[10px] text-zinc-950 font-black">3</div>
                  <h5 className="font-black text-xs text-zinc-100">3. اختيار الصندوق وطريقة الدفع لترحيل الكاش</h5>
                  <p className="text-xs text-zinc-400 font-bold mt-1">دعم الدفع الكاش، الحوالات (مثل الكريمي أو غيره), الشبكات، أو التقييد في حساب العميل المعتمد كدين مستحق في ذمته المالية.</p>
                </div>
                <div className="relative">
                  <div className="absolute top-1 -right-[27px] w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[10px] text-zinc-950 font-black">4</div>
                  <h5 className="font-black text-xs text-zinc-100">4. الطباعة والمزامنة الفورية</h5>
                  <p className="text-xs text-zinc-400 font-bold mt-1">بمجرد نقر "حفظ وطباعة الفاتورة"، يتم ترحيل الفاتورة وتناقص بضاعة الموديل آلياً من المخزن وتوليد قيد إيرادات بالصندوق المالي للوردية.</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 rounded-2xl border-0 text-xs text-amber-400 font-bold space-y-1">
              <p className="font-black">📈 ميزة تصفية الكاشير ومبيعات الجملة:</p>
              <p className="text-[11px] leading-relaxed text-zinc-300 font-semibold">يتيح النظام للصالات واجهة حصرية مخصصة للبيع بالجملة تدعم توزيع كميات ضخمة بأسعار كلفة مخفضة مع الربط بحساب الموزعين والتحصيلات.</p>
            </div>
          </div>
        );
      case 'accounts':
        return (
          <div className="space-y-6 text-right">
            <div className="flex gap-3 items-center border-0 pb-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <Scale size={20} />
              </div>
              <h3 className="text-lg font-black text-zinc-100 font-sans">الدليل المحاسبي الشامل: الصناديق، التسويات، الأصول وجرد الرقابة 🪙</h3>
            </div>

            <p className="text-sm text-zinc-350 leading-relaxed font-bold border-r-4 border-amber-500 pr-3">
              يوفر نظام JAM System Pro محركاً مالياً قوياً مصمماً لمنع العشوائية والأخطاء المحاسبية في حركة الأموال اليومية. من خلال صفحة الحسابات والمالية، يتم السيطرة على الفجوات الرقابية وإدارتها بأعلى درجات الكفاءة.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-zinc-900/60 rounded-2xl border-0 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-black">
                  <Wallet size={16} />
                  <span className="text-xs">إدارة الصناديق والخزائن</span>
                </div>
                <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                  يمكنك إنشاء صناديق مخصصة وتسميتها (مثال: صندوق أحمد للصيانة، صندوق مبيعات الصالة الأولى، بنك الكريمي). يتم توثيق الرصيد الفعلي لكل صندوق وحساب تراكم الأموال تزامناً مع الفواتير وسندات القبض.
                </p>
              </div>

              <div className="p-5 bg-zinc-900/60 rounded-2xl border-0 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-black">
                  <ArrowRightLeft size={16} />
                  <span className="text-xs">ترحيل ومناقلة الكاش والعهد</span>
                </div>
                <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                  يمكنك إجراء مناقلة مالية آمنة (ترحيل مالي) من صندوق فرعي إلى صندوق آخر أو إلى الخزنة المركزية HQ. يمنع هذا التلاعب، حيث يتطلب الترحيل تحديد الصندوقين والمبلغ وبيان النقل وتدرج آلياً في شريط كشفي متدرج.
                </p>
              </div>

              <div className="p-5 bg-zinc-900/60 rounded-2xl border-0 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-black">
                  <Receipt size={16} />
                  <span className="text-xs">تسويات وفوارق الرصيد الدفتري</span>
                </div>
                <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                  عند نهاية الوردية اليومية، يمكن إدخل تسويات لعلاج الفوارق المالية. إذا وجد عجز بالصندوق النقدي، يتم إصدار "سند تسوية عجز رصيد"، ليقوم النظام بإنقاص العهدة دفترياً وتقييد العجز في حساب تسويات العجز بشكل متناسق مع النظم المحلية.
                </p>
              </div>

              <div className="p-5 bg-zinc-900/60 rounded-2xl border-0 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-black">
                  <Landmark size={16} />
                  <span className="text-xs">الأصول الثابتة والعهد التشغيلية</span>
                </div>
                <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                  تسمح الواجهة بحصر الأصول المادية للمحل (مثل: طابعات، مكيفات، سيارات الشحن، أجهزة صيانة). يمكنك إضافة قيمة الأصل كجزء من الميزانية العمومية ورأس المال وتحديد معامل الإهلاك السنوي لتقييم الأراضي والديكورات بدقة.
                </p>
              </div>
            </div>

            <div className="border-0 rounded-3xl p-6 bg-zinc-900/40 space-y-4">
              <h4 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                <span>🔎 مركز الجرد والرقابة اليومية المتقدم (الرقابة الدقيقة لتسع واجهات):</span>
              </h4>
              <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                يتميز النظام بمركز جرد وتحكم تزامني يومي مجزأ إلى تسعة (9) اقسام وإصدار محاضر مطابقة:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-950 p-3 rounded-xl border-0 font-bold">
                  <span className="text-amber-400 text-xs font-black block">📋 1. جرد اللوق والحركات:</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">متابعة كافة تفاصيل سندات التحصيل والصرف وإيرادات الدفاتر.</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border-0 font-bold">
                  <span className="text-amber-400 text-xs font-black block">👥 2. جرد أرصدة العملاء:</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">رصد مديونيات الزبائن والموزعين وتصفية الديون الخارجية.</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border-0 font-bold">
                  <span className="text-amber-400 text-xs font-black block">🪙 3. جرد نقدية الصناديق:</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">مطابقة الصناديق يدوياً عبر الكاشير وحفظ الفوارق الفورية.</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border-0 font-bold">
                  <span className="text-amber-400 text-xs font-black block">📦 4. جرد وعجز الأصناف:</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">رصد بضائع وموديلات المتجر ومعرفة حجمها بسعر الكلفة والبيع.</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border-0 font-bold">
                  <span className="text-amber-400 text-xs font-black block">🏭 5. جرد مستودعات الفروع:</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">الاطلاع على القيمة الرأسمالية المخزنة في كل مستودع منفصل.</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border-0 font-bold">
                  <span className="text-amber-400 text-xs font-black block">🏦 6. جرد البنوك والشبكات:</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">سجلات البنكي ومحفظات شركات الصرافة والكريمي.</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border-0 font-bold">
                  <span className="text-amber-400 text-xs font-black block">📈 7. جرد المقبوضات والدخل:</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">إجمالي المقبوضات المتولدة كاش أو بنك ومقارنتها بدفتر الصالات.</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border-0 font-bold">
                  <span className="text-amber-400 text-xs font-black block">📉 8. جرد المصاريف والخرج:</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">كشف بكافة المبالغ التشغيلية التي صرفت كخرج لمنع الضرر.</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border-0 font-bold">
                  <span className="text-amber-400 text-xs font-black block">💎 9. جرد أرباح اليوم:</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">توليد أرباح التجزئة وهوامش الموديلات مع التصفير التلقائي.</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 rounded-2xl border-0 text-xs text-amber-400 font-bold">
              ⚠️ ميزة الطباعة والمصادقة الأمنية المباشرة:
              <p className="text-[11px] leading-relaxed font-normal mt-1 text-zinc-350">
                يمكن جمع كافة الإحصاءات والأرصدة من أي قسم جرد، والضغط على زر "طباعة تقرير ومحضر جرد رسمي يدوياً وسحابياً" لتوليد ملف للطباعة وتسليمه للشركاء أو الإدارة لتوثيق فترات التسوية وحفظ الهدوء الرقابي التام.
              </p>
            </div>
          </div>
        );
      case 'inventory':
        return (
          <div className="space-y-6 text-right">
            <div className="flex gap-3 items-center border-0 pb-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <Package size={20} />
              </div>
              <h3 className="text-lg font-black text-zinc-100">إدارة المخازن والأصناف والكتالوج العام 📦</h3>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed font-bold">
              تضمن هذه اللوحة الموثوقية التامة لكميات وموديلات السلع والتحقق من قيمتها في مختلف الفروع.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-900/60 rounded-xl border-0 space-y-2">
                <span className="text-lg">🏷️</span>
                <h4 className="font-black text-zinc-150 text-xs">تخصيص الكتالوج والباركود</h4>
                <p className="text-[11px] text-zinc-400 font-semibold leading-relaxed">منظومة ذكية لتوليد باركود فرعي وشريط تسلسلي للأصناف، وتسهيل الجرد بالماسحات الضوئية.</p>
              </div>
              <div className="p-4 bg-zinc-900/60 rounded-xl border-0 space-y-2">
                <span className="text-lg">📉</span>
                <h4 className="font-black text-zinc-150 text-xs">تنبيهات انخفاض الموديل</h4>
                <p className="text-[11px] text-zinc-400 font-semibold leading-relaxed">يقوم النظام بإرسال إشارات وتنبيهات بصرية عندما تقترب كمية صنف معين من حد السلامة.</p>
              </div>
              <div className="p-4 bg-zinc-900/60 rounded-xl border-0 space-y-2">
                <span className="text-lg">🔄</span>
                <h4 className="font-black text-zinc-150 text-xs">التحويل البيني والتحميل</h4>
                <p className="text-[11px] text-zinc-400 font-semibold leading-relaxed">دعم إرسال طلبات تحويل بضائع بشكل رسمي من مستودع لآخر مع توثيق اسم محرك التحويل والمستلم.</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-900/40 rounded-2xl border-0">
              <h4 className="font-black text-xs text-amber-500">💡 كيف يمكنك تسجيل صنف جديد بنجاح:</h4>
              <p className="text-xs text-zinc-300 mt-2 leading-relaxed font-bold">
                اذهب إلى صفحة المخزن ← اضغط على "إضافة صنف جديد" ← حدد اسم الموديل والباركود والتصنيف وقم بتحديد (سعر التكلفة وسعر البيع للجمهور وسعر البيع للجملة) بالإضافة إلى وحدات القياس.
              </p>
            </div>
          </div>
        );
      case "network":
        return (
          <div className="space-y-6 text-right">
            <div className="flex gap-3 items-center border-0 pb-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-lg font-black text-zinc-100">الترابط الشبكي وسلسلة التوريد 🌐</h3>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed font-bold">
              ربط مباشر بين الفروع والموردين لمشاركة الكتالوجات والطلبيات والتحويلات المخزنية بأمان وتشفير كامل.
            </p>
          </div>
        );
      case "maintenance":
        return (
          <div className="space-y-6 text-right">
            <div className="flex gap-3 items-center border-0 pb-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <Wrench size={20} />
              </div>
              <h3 className="text-lg font-black text-zinc-100">صيانة الأجهزة والضمانات 🛠️</h3>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed font-bold">
              متابعة استلام أجهزة الصيانة والتأكد من الضمان وتتبع حالة الإصلاح خطوة بخطوة وإشعار العملاء.
            </p>
          </div>
        );
      case "portal":
        return (
          <div className="space-y-6 text-right">
            <div className="flex gap-3 items-center border-0 pb-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <User size={20} />
              </div>
              <h3 className="text-lg font-black text-zinc-100">بوابة الزبائن وتتبع الفواتير 📱</h3>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed font-bold">
              تتيح للعملاء الاستعلام عن كشوف الحساب وحالة أجهزة الصيانة والضمان المباشر عبر البوابة الإلكترونية.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen lg:h-screen bg-gray-50/50 overflow-y-auto lg:overflow-hidden">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 lg:p-8 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-7xl mx-auto w-full gap-4">
           <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-600 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 shrink-0">
                 <HelpCircle size={28} className="sm:w-8 sm:h-8" />
              </div>
              <div>
                 <h1 className="text-xl sm:text-2xl font-black text-gray-900">مركز المساعدة والدعم</h1>
                 <p className="text-gray-500 text-xs sm:text-sm font-bold">كل ما تحتاجه لفهم وإدارة JAM System Pro</p>
              </div>
           </div>
           
           <div className="flex gap-4 w-full sm:w-auto">
              <a 
                href="https://wa.me/967772315106" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-green-500 text-white rounded-2xl font-black text-xs sm:text-sm hover:scale-105 transition-all shadow-lg shadow-green-100 w-full sm:w-auto"
              >
                 <PhoneCall size={18} />
                 دعم فني مباشر
              </a>
           </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-6 lg:gap-8">
        
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-80 shrink-0 space-y-2">
           <button 
             onClick={() => setActiveSegment('docs')}
             className={`w-full p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex items-center gap-3 sm:gap-4 transition-all ${activeSegment === 'docs' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
           >
              <BookOpen size={20} />
              <span className="font-black text-sm sm:text-base">دليل الاستخدام</span>
           </button>
           <button 
             onClick={() => setActiveSegment('feedback')}
             className={`w-full p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex items-center gap-3 sm:gap-4 transition-all ${activeSegment === 'feedback' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
           >
              <MessageSquare size={20} />
              <span className="font-black text-sm sm:text-base">الشكاوى والمقترحات</span>
           </button>
           <button 
             onClick={() => setActiveSegment('changelog')}
             className={`w-full p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex items-center gap-3 sm:gap-4 transition-all ${activeSegment === 'changelog' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
           >
              <History size={20} />
              <span className="font-black text-sm sm:text-base">تتبع التحديثات</span>
           </button>

           <div className="mt-4 sm:mt-8 p-5 sm:p-6 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl sm:rounded-[2.5rem] text-white space-y-3 sm:space-y-4">
              <h4 className="font-black text-sm">تحتاج مساعدة فورية؟</h4>
              <p className="text-[11px] text-indigo-100 leading-relaxed">فريق التقني متاح 24/7 لمساعدتك في حل أي مشكلة تقنية تواجهك.</p>
              <div className="pt-2">
                <p className="text-[10px] text-indigo-200 mb-1">الرقم الموحد:</p>
                <p className="font-black text-base sm:text-lg">+967 772 315 106</p>
              </div>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col overflow-hidden">
           <AnimatePresence mode="wait">
              {activeSegment === 'docs' && (
                <motion.div 
                  key="docs"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col lg:flex-row h-full min-h-0 w-full"
                >
                   <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-l border-gray-100 p-4 lg:p-6 space-y-1 bg-gray-50/30 shrink-0 overflow-x-auto lg:overflow-y-auto flex lg:flex-col gap-2 lg:gap-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 lg:mb-4 pr-2 hidden lg:block">أقسام الشرح</p>
                      {docs.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => setSelectedDoc(doc.id)}
                          className={`p-3 lg:p-4 rounded-xl lg:rounded-2xl flex items-center gap-2 lg:gap-3 transition-all text-right shrink-0 ${selectedDoc === doc.id ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5 font-black' : 'text-gray-500 hover:text-gray-700 font-bold'}`}
                        >
                           {doc.icon}
                           <span className="text-xs sm:text-sm whitespace-nowrap">{doc.title}</span>
                        </button>
                      ))}
                   </div>
                   <div className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
                      {docs.find(d => d.id === selectedDoc) && (
                        <div className="space-y-6">
                           <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 border-b-4 border-indigo-600 pb-3 sm:pb-4 inline-block">
                              {docs.find(d => d.id === selectedDoc)?.title}
                           </h2>
                           <div className="max-w-none">
                              <div className="text-sm sm:text-base text-gray-750">
                                 {renderDocContent(selectedDoc)}
                              </div>
                           </div>
                           
                           {/* Static visuals for docs */}
                           <div className="mt-8 sm:mt-12 p-5 sm:p-8 bg-indigo-50/50 rounded-2xl sm:rounded-3xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
                              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                                 <Plus size={28} className="sm:w-8 sm:h-8" />
                              </div>
                              <div>
                                 <h4 className="font-black text-indigo-900 text-sm sm:text-base">نصيحة سريعة</h4>
                                 <p className="text-xs sm:text-sm text-indigo-600 mt-1">يمكنك دائماً الرجوع إلى هذه الصفحة من أي مكان في النظام بالضغط على أيقونة المساعدة.</p>
                              </div>
                           </div>
                        </div>
                      )}
                   </div>
                </motion.div>
              )}

              {activeSegment === 'feedback' && (
                <motion.div 
                  key="feedback"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto w-full overflow-y-auto"
                >
                   <div className="text-center space-y-3 sm:space-y-4 mb-6 sm:mb-10">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto">
                         <MessageSquare size={32} className="sm:w-9 sm:h-9" />
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-gray-900">أسمعنا صوتك</h2>
                      <p className="text-gray-500 font-bold text-xs sm:text-sm">رأيك يساعدنا في تحسين البرنامج ليلائم احتياجاتك بشكل أفضل.</p>
                   </div>

                   {showSuccess ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-50 p-6 sm:p-8 rounded-3xl sm:rounded-[2rem] border border-green-200 text-center space-y-3 sm:space-y-4"
                      >
                         <CheckCircle2 size={40} className="text-green-600 mx-auto sm:w-12 sm:h-12" />
                         <h3 className="text-lg sm:text-xl font-black text-green-900">تم إرسال رسالتك بنجاح!</h3>
                         <p className="text-green-700 font-bold text-xs sm:text-sm">شكراً لك على مساهمتك. سيقوم الفريق الفني بمراجعة طلبك والرد عليك إذا لزم الأمر.</p>
                      </motion.div>
                   ) : (
                      <form onSubmit={submitFeedback} className="space-y-4 sm:space-y-6">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-2">
                               <label className="text-xs font-black text-gray-500 uppercase tracking-widest pr-2">نوع الرسالة</label>
                               <div className="flex gap-2">
                                  {['suggestion', 'complaint', 'bug'].map(type => (
                                    <button
                                      key={type}
                                      type="button"
                                      onClick={() => setFeedback({...feedback, type})}
                                      className={`flex-1 py-3 px-2 rounded-xl text-xs font-black transition-all ${feedback.type === type ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                    >
                                       {type === 'suggestion' ? 'اقتراح' : type === 'complaint' ? 'شكوى' : 'تبليغ خطأ'}
                                    </button>
                                  ))}
                               </div>
                            </div>
                            <div className="space-y-2">
                               <label className="text-xs font-black text-gray-500 uppercase tracking-widest pr-2">الموضوع</label>
                               <input 
                                 required
                                 type="text" 
                                 className="input-field py-3.5 px-4 sm:py-4 sm:px-6 font-bold text-xs sm:text-sm"
                                 placeholder="مثال: مشكلة في طباعة الفواتير"
                                 value={feedback.subject}
                                 onChange={e => setFeedback({...feedback, subject: e.target.value})}
                               />
                            </div>
                         </div>

                         <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest pr-2">نص الرسالة</label>
                            <textarea 
                              required
                              rows={4}
                              className="input-field py-3.5 px-4 sm:py-4 sm:px-6 font-bold text-xs sm:text-sm resize-none"
                              placeholder="اشرح لنا بالتفصيل لكي نتمكن من مساعدتك..."
                              value={feedback.content}
                              onChange={e => setFeedback({...feedback, content: e.target.value})}
                            ></textarea>
                         </div>

                         <div className="space-y-3 sm:space-y-4">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest pr-2 flex items-center gap-2">
                                إرفاق صورة شاشة (Screenshot)
                                <ImageIcon size={14} />
                            </label>
                            <div className="relative">
                               <input 
                                 type="file" 
                                 accept="image/*"
                                 onChange={handleImageUpload}
                                 className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                               />
                               <div className="border-2 border-dashed border-gray-200 rounded-2xl sm:rounded-[2rem] p-6 sm:p-8 text-center bg-gray-50 hover:bg-gray-100 transition-all">
                                  {feedback.image ? (
                                    <div className="relative inline-block">
                                       <img src={feedback.image} alt="Selected" className="max-h-28 sm:max-h-32 rounded-xl mx-auto" />
                                       <button 
                                         onClick={() => setFeedback({...feedback, image: null})}
                                         className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                       >
                                          <Plus size={14} className="rotate-45" />
                                       </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                       <Plus className="mx-auto text-gray-400" size={28} />
                                       <p className="text-xs text-gray-500 font-bold">اضغط أو اسحب الصورة هنا (اختياري)</p>
                                    </div>
                                  )}
                               </div>
                            </div>
                         </div>

                         <button 
                           disabled={isSubmitting}
                           className="w-full py-4 sm:py-5 bg-indigo-600 text-white rounded-2xl sm:rounded-[2rem] font-black text-base sm:text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] disabled:opacity-50"
                         >
                            {isSubmitting ? (
                              <Cpu className="animate-spin" size={20} />
                            ) : (
                              <Send size={20} />
                            )}
                            إرسال الرسالة للإدارة
                         </button>
                      </form>
                   )}
                </motion.div>
              )}

              {activeSegment === 'changelog' && (
                <motion.div 
                  key="changelog"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-4 sm:p-6 lg:p-10 overflow-y-auto"
                >
                   <div className="space-y-8 sm:space-y-12">
                      <div className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-10">
                         <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-50 rounded-2xl sm:rounded-3xl flex items-center justify-center text-blue-600 shrink-0">
                            <History size={28} className="sm:w-8 sm:h-8" />
                         </div>
                         <div>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-900">سجل التحديثات</h2>
                            <p className="text-gray-500 font-bold text-xs sm:text-sm">رحلة تطوير JAM System Pro المستمرة</p>
                         </div>
                      </div>

                      <div className="relative border-r-4 border-indigo-100 pr-6 sm:pr-10 space-y-8 sm:space-y-12">
                         {changelog.map((entry, idx) => (
                           <div key={idx} className="relative">
                              <div className="absolute top-2 -right-[31px] sm:-right-[47px] w-6 h-6 sm:w-8 sm:h-8 bg-white border-4 border-indigo-600 rounded-full"></div>
                              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                                 <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] sm:text-xs font-black">{entry.version}</span>
                                 <span className="text-gray-400 text-xs sm:text-sm font-bold">{entry.date}</span>
                              </div>
                              <div className="bg-gray-50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-gray-100 space-y-3 sm:space-y-4 shadow-sm">
                                 {entry.changes.map((change, cIdx) => (
                                   <div key={cIdx} className="flex items-start gap-2.5 sm:gap-3">
                                      <div className="mt-1.5 w-1.5 h-1.5 bg-indigo-600 rounded-full shrink-0"></div>
                                      <p className="text-gray-700 font-bold text-xs sm:text-sm leading-relaxed">{change}</p>
                                   </div>
                                 ))}
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="p-4 sm:p-6 text-center text-gray-400 text-[10px] font-bold">
         JAM System Pro © 2026 - جميع الحقوق محفوظة لشركة JAM التقنية
      </div>
    </div>
  );
}
