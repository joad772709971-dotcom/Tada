import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Users, 
  Wifi, 
  Check, 
  CheckCheck, 
  Clock, 
  MapPin, 
  ChevronLeft, 
  ChevronRight,
  User,
  Activity,
  Soup,
  Truck,
  Wrench,
  Lock,
  Search,
  Bot,
  Sparkles,
  RefreshCw,
  BellRing
} from 'lucide-react';
import { SystemUser } from '../types';

interface ChatMessage {
  id: string;
  sender: string; // username
  senderName: string;
  senderRole: string;
  senderBranch: string;
  receiver: string; // username
  content: string;
  timestamp: string;
  read: boolean;
  isAutoReply?: boolean;
}

interface ChatUser {
  username: string;
  fullName: string;
  role: string;
  governorate: string;
  departmentLabel: string;
  initialTab: string;
  online: boolean;
}

// Default fallback list of users if farmsync_dynamic_employees is empty
const DEFAULT_FALLBACK_USERS: ChatUser[] = [
  {
    username: 'super_admin',
    fullName: 'المدير العام للنظام',
    role: 'GeneralManager',
    governorate: 'الكل',
    departmentLabel: 'الإدارة العليا والملاك',
    initialTab: 'treasury',
    online: true
  },
  {
    username: 'sanaa_acc',
    fullName: 'أ. نجيب المريسي',
    role: 'FieldAccountant',
    governorate: 'صنعاء',
    departmentLabel: 'المالية ومعارض الحسابات',
    initialTab: 'treasury',
    online: true
  },
  {
    username: 'sanaa_truck',
    fullName: 'ماهر الريمي',
    role: 'Distributor',
    governorate: 'صنعاء',
    departmentLabel: 'مبيعات وتوريد الموزعين',
    initialTab: 'pos_settlement',
    online: true
  },
  {
    username: 'sanaa_vet',
    fullName: 'د. عاصم ياسين',
    role: 'Veterinarian',
    governorate: 'صنعاء',
    departmentLabel: 'الطب البيطري والتحصينات',
    initialTab: 'veterinary',
    online: true
  },
  {
    username: 'sanaa_worker',
    fullName: 'عمار العنسي',
    role: 'Worker',
    governorate: 'صنعاء',
    departmentLabel: 'إنتاج العنابر والبيض النافق',
    initialTab: 'production',
    online: false
  },
  {
    username: 'sanaa_cook',
    fullName: 'الشيف عبده زبيدي',
    role: 'Cook',
    governorate: 'صنعاء',
    departmentLabel: 'المطبخ المركزي للعمال',
    initialTab: 'kitchen',
    online: true
  },
  {
    username: 'dhamar_acc',
    fullName: 'أ. محمد ذيبان',
    role: 'FieldAccountant',
    governorate: 'ذمار',
    departmentLabel: 'المالية وتصفية المعارض',
    initialTab: 'treasury',
    online: true
  },
  {
    username: 'dhamar_truck',
    fullName: 'عبدالكريم الحاشدي',
    role: 'Distributor',
    governorate: 'ذمار',
    departmentLabel: 'توزيع خطوط الإنتاج والمسالخ',
    initialTab: 'pos_settlement',
    online: true
  },
  {
    username: 'dhamar_vet',
    fullName: 'د. سليم غيلان',
    role: 'Veterinarian',
    governorate: 'ذمار',
    departmentLabel: 'الطب البيطري واللقاحات',
    initialTab: 'veterinary',
    online: true
  },
  {
    username: 'dhamar_worker',
    fullName: 'سالم الكبسي',
    role: 'Worker',
    governorate: 'ذمار',
    departmentLabel: 'جرف فضلات العنابر وعلف السايلو',
    initialTab: 'production',
    online: false
  },
  {
    username: 'dhamar_cook',
    fullName: 'الشف مبروك الشرعبي',
    role: 'Cook',
    governorate: 'ذمار',
    departmentLabel: 'المطبخ المركزي للعمال',
    initialTab: 'kitchen',
    online: true
  },
  {
    username: 'aden_acc',
    fullName: 'أ. سالم اليافعي',
    role: 'FieldAccountant',
    governorate: 'عدن',
    departmentLabel: 'مالية التصدير وفواتير السفن',
    initialTab: 'treasury',
    online: true
  },
  {
    username: 'aden_truck',
    fullName: 'أيمن الشميري',
    role: 'Distributor',
    governorate: 'عدن',
    departmentLabel: 'مبيعات نقاط وكاشيرات البيع',
    initialTab: 'pos_settlement',
    online: true
  },
  {
    username: 'aden_vet',
    fullName: 'د. فضل العولقي',
    role: 'Veterinarian',
    governorate: 'عدن',
    departmentLabel: 'صحة القطيع واللقاحات الساحلية',
    initialTab: 'veterinary',
    online: true
  },
  {
    username: 'aden_worker',
    fullName: 'ماهر اليماني',
    role: 'Worker',
    governorate: 'عدن',
    departmentLabel: 'جمع أطباق البيض بالمرق',
    initialTab: 'production',
    online: false
  },
  {
    username: 'aden_cook',
    fullName: 'الشف أمين الدبعي',
    role: 'Cook',
    governorate: 'عدن',
    departmentLabel: 'إسكان وإعاشة عمال الموانئ',
    initialTab: 'kitchen',
    online: true
  }
];

export function CrossBranchChatDashboard() {
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [employees, setEmployees] = useState<ChatUser[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedEmp, setSelectedEmp] = useState<ChatUser | null>(null);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  
  // Message Thread & Form state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Mobile navigation helper
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);

  // Sound generator
  const triggerBeep = (freq = 820, duration = 0.08) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  // Load active logged-in employee & system-wide dynamic employees
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('farmsync_remembered_user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }

      const storedEmployees = localStorage.getItem('farmsync_dynamic_employees');
      if (storedEmployees) {
        const parsed: ChatUser[] = JSON.parse(storedEmployees).map((emp: any) => ({
          username: emp.username,
          fullName: emp.fullName,
          role: emp.role,
          governorate: emp.governorate,
          departmentLabel: emp.departmentLabel,
          initialTab: emp.initialTab,
          // Randomize or assign default online state safely
          online: emp.username === 'super_zelai' ? true : Math.random() > 0.3
        }));
        setEmployees(parsed);
      } else {
        localStorage.setItem('farmsync_dynamic_employees', JSON.stringify(DEFAULT_FALLBACK_USERS));
        setEmployees(DEFAULT_FALLBACK_USERS);
      }

      // Load messages
      const storedMsgs = localStorage.getItem('farmsync_chat_messages');
      if (storedMsgs) {
        setMessages(JSON.parse(storedMsgs));
      } else {
        // Seed initial friendly cross-branch message
        const seedMsgs: ChatMessage[] = [
          {
            id: 'seed-1',
            sender: 'sanaa_vet',
            senderName: 'د. عاصم ياسين',
            senderRole: 'Veterinarian',
            senderBranch: 'صنعاء',
            receiver: 'super_zelai',
            content: 'طاب يومكم يا أستاذ عبدالغني، تم تحصين القطعة السادسة من دجاج اللحم بنجاح في مزارع صنعاء، والأوضاع مستقرة بالكامل ولله الحمد.',
            timestamp: '09:12 ص',
            read: true
          },
          {
            id: 'seed-2',
            sender: 'dhamar_truck',
            senderName: 'عبدالكريم الحاشدي',
            senderRole: 'Distributor',
            senderBranch: 'ذمار',
            receiver: 'super_zelai',
            content: 'السيد المدير العام، علف السايلو القادم من المصنع ممتاز جداً، وتم تفريغ المركبة وتوزيع حمولة كرتونات البيض إلى كبائن معارض ذمار.',
            timestamp: '10:05 ص',
            read: true
          }
        ];
        localStorage.setItem('farmsync_chat_messages', JSON.stringify(seedMsgs));
        setMessages(seedMsgs);
      }

    } catch (e) {
      setEmployees(DEFAULT_FALLBACK_USERS);
    }
  }, []);

  // Listen for storage events to synchronize chats across tabs dynamically
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'farmsync_chat_messages') {
        try {
          if (e.newValue) {
            setMessages(JSON.parse(e.newValue));
            triggerBeep(1050, 0.12); // notification ping
          }
        } catch {}
      }
      if (e.key === 'farmsync_dynamic_employees') {
        try {
          if (e.newValue) {
            setEmployees(JSON.parse(e.newValue));
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Scroll to bottom on updates
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedEmp]);

  // Handle clicking on an employee to chat
  const handleSelectEmp = (emp: ChatUser) => {
    triggerBeep(890, 0.05);
    setSelectedEmp(emp);
    setShowMobileSidebar(false);

    // Mark messages from this sender to current user as read
    if (currentUser) {
      const updatedMsgs = messages.map(msg => {
        if (msg.sender === emp.username && msg.receiver === currentUser.username) {
          return { ...msg, read: true };
        }
        return msg;
      });
      setMessages(updatedMsgs);
      localStorage.setItem('farmsync_chat_messages', JSON.stringify(updatedMsgs));
    }
  };

  // Safe message sending
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !currentUser || !selectedEmp) return;

    triggerBeep(1200, 0.08);

    const now = new Date();
    const formattedTime = now.toLocaleTimeString('ar-YE', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const newMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: currentUser.username,
      senderName: currentUser.fullName,
      senderRole: currentUser.role,
      senderBranch: currentUser.governorate,
      receiver: selectedEmp.username,
      content: newMessageText.trim(),
      timestamp: formattedTime,
      read: false
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    localStorage.setItem('farmsync_chat_messages', JSON.stringify(updated));
    setNewMessageText('');

    // Generate responsive smart reply based on peer's department/role
    generateAutomatedReply(selectedEmp, newMessageText.trim(), updated);
  };

  // Generate responsive smart reply
  const generateAutomatedReply = (peer: ChatUser, query: string, curMessages: ChatMessage[]) => {
    // Delay the reaction to simulate a real human responder typing
    setTimeout(() => {
      const answers: Record<string, string[]> = {
        'Veterinarian': [
          `أهلاً بك. تم استلام رسالتك بخصوص العنابر. قمنا اليوم بجدولة جرعة لقاح نيوكاسل والبرونشيت، وننصح بتهوية جيدة في العنابر لخفض الرطوبة إلى ما دون 60%.`,
          `وعليكم السلام ورحمة الله. تم فحص معدل النفوق في عنابر الفروع وحالياً هي مستقرة (0.2%). يرجى الاستمرار بخلط مضادات السموم مع العلف الموزع.`,
          `مرحباً. شحنة المستلزمات في طريقها إليكم من المخزن المركزي. تأكدوا من استلامها وتدقيق الكميات.`,
        ],
        'Distributor': [
          `أهلاً يا زميل. الشاحنة محملة بالبضائع وجاري تسوية الكشوف مع الكاشيرات. سأقوم بتوريد الكاش عما قريب للفرع.`,
          `تصل شحنة التوريد الميداني خلال ساعة إن شاء الله. جرى مسح خط الموزعين والمناطق مستقرة.`,
          `مفهوم. تم قيد مستند العجز الدفتري وجارِ الاتفاق مع العميل لتصحيح الكميات.`,
        ],
        'Cook': [
          `حياك الله أخي الغالي. تم تجهيز الوجبات وهي جاهزة فوراً.`,
          `أهلاً بك. المخزون آمن، وقمنا بطلب دفعة جديدة وحساباتنا مطابقة.`,
          `طاب يومك. وجبة العشاء للعمال سيتم تسليمها عند الساعة السابعة مساءً بإذن الله.`,
        ],
        'Worker': [
          `مفهوم يا فندم. جاري العمل وتنفيذ التعليمات.`,
          `تم رصد الإنتاج اليومي وتوثيقه في النظام المحلي بالفرع.`,
          `نحن بالفرع الآن والأمور تحت السيطرة.`,
        ],
        'GeneralManager': [
          `مرحباً يا بطل. مجهودكم الميداني مشكور جداً. يرجى التأكد من تزامن كافة الفواتير والسندات للنظام.`,
          `وعليكم السلام. اطلعت على كشوف المعرض وهامش الربحية اليومي للفروع مشجع. واصلوا جهودكم وحافظوا على تدوير المخزون بدقة.`,
          `تم استلام رسالتكم. تم تأكيد ورفع عهدتكم وتدويرها في الخزينة المركزية.`,
        ]
      };

      const defaultAnswers = [
        `أهلاً بك. رسالتك قيد النظر والمراجعة الدفترية فوراً. بارك الله في جهودكم.`,
        `تم الاستلام بنجاح وجاري فحص السجلات والعهد المالية للتكامل السحابي.`
      ];

      const key = peer.role;
      const responsePool = answers[key] || defaultAnswers;
      const selectResponse = responsePool[Math.floor(Math.random() * responsePool.length)];

      const formattedTime = new Date().toLocaleTimeString('ar-YE', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

      const autoMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: peer.username,
        senderName: peer.fullName,
        senderRole: peer.role,
        senderBranch: peer.governorate,
        receiver: currentUser?.username || 'super_zelai',
        content: selectResponse,
        timestamp: formattedTime,
        read: false,
        isAutoReply: true
      };

      const finalMessages = [...curMessages, autoMsg];
      setMessages(finalMessages);
      localStorage.setItem('farmsync_chat_messages', JSON.stringify(finalMessages));
      triggerBeep(1450, 0.15); // play tone for received message

    }, 2200);
  };

  // Filter employees for sidebar select
  const filteredSidebarEmps = employees.filter(emp => {
    // Cannot chat with myself
    if (currentUser && emp.username === currentUser.username) return false;

    const matchSearch = emp.fullName.toLowerCase().includes(searchEmployeeQuery.toLowerCase()) ||
                        emp.username.toLowerCase().includes(searchEmployeeQuery.toLowerCase()) ||
                        emp.departmentLabel.toLowerCase().includes(searchEmployeeQuery.toLowerCase());
    
    const matchBranch = selectedBranch === 'all' || emp.governorate === selectedBranch;

    return matchSearch && matchBranch;
  });

  // Get current active chat conversation
  const chatConversation = messages.filter(msg => {
    if (!currentUser || !selectedEmp) return false;
    return (msg.sender === currentUser.username && msg.receiver === selectedEmp.username) ||
           (msg.sender === selectedEmp.username && msg.receiver === currentUser.username);
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl" id="cross-branch-messaging-app">
      
      {/* Top Component Info Ribbon */}
      <div className="bg-slate-950 px-5 py-4 border-b border-slate-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-right">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-2.5 rounded-full bg-indigo-950 border border-indigo-505/30 text-[10px] text-indigo-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              قنوات التزامن المباشرة نشطة
            </span>
            <MessageSquare className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-base font-bold text-slate-100">دردشة وفروع النظام العابرة للمحافظات</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">تواصل آمن وفوري بين الإدارة العامة، والفروع الميدانية، والمندوبين.</p>
        </div>

        {currentUser && (
          <div className="bg-slate-900 border border-slate-800 p-2 px-3 rounded-xl flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block leading-tight">هويتك النشطة حالياً:</span>
              <span className="text-xs text-white font-black">{currentUser.fullName}</span>
              <span className="text-[9px] text-emerald-400 font-bold block">فرع {currentUser.governorate}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold font-mono text-sm uppercase">
              {currentUser.username.substring(0, 2)}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-12 h-[580px] text-right font-sans">
        
        {/* RIGHT PANEL: BRANCHES & EMPLOYEES SIDEBAR (RTL sidebar takes 4/12 columns) */}
        <div className={`md:col-span-4 bg-slate-950 md:flex flex-col border-l border-slate-850 ${
          showMobileSidebar ? 'flex' : 'hidden'
        } h-full`}>
          
          {/* Branch Filter Tabs strip */}
          <div className="p-3 border-b border-slate-850">
            <span className="text-[10.5px] text-slate-400 font-extrabold block mb-2">تصفية حسب المواقع والفروع:</span>
            <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl">
              {[
                { key: 'all', label: 'الكل' },
                { key: 'صنعاء', label: 'صنعاء' },
                { key: 'ذمار', label: 'ذمار' },
                { key: 'عدن', label: 'عدن' },
                { key: 'الحديدة', label: 'الحديدة' },
                { key: 'تعز', label: 'تعز' }
              ].map(b => (
                <button
                  key={b.key}
                  onClick={() => { triggerBeep(850, 0.05); setSelectedBranch(b.key); }}
                  className={`text-[10px] py-1.5 rounded-lg transition-colors font-bold cursor-pointer ${
                    selectedBranch === b.key ? 'bg-indigo-600 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Employee inside sidebar */}
          <div className="p-3 border-b border-slate-850 relative">
            <input 
              type="text"
              value={searchEmployeeQuery}
              onChange={(e) => setSearchEmployeeQuery(e.target.value)}
              placeholder="ابحث عن موظف أو المسمى..."
              className="w-full bg-slate-900 border border-slate-800 p-2 pr-8 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-right font-sans"
            />
            <Search className="w-4 h-4 text-slate-600 absolute right-6 top-5.5" />
          </div>

          {/* Scrollable employee list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {filteredSidebarEmps.length > 0 ? (
              filteredSidebarEmps.map(emp => {
                const isSelected = selectedEmp?.username === emp.username;
                const userUnreadCount = messages.filter(msg => msg.sender === emp.username && msg.receiver === currentUser?.username && !msg.read).length;

                return (
                  <button
                    key={emp.username}
                    onClick={() => handleSelectEmp(emp)}
                    className={`w-full p-2.5 rounded-2xl text-right transition-all flex items-center justify-between border cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md' 
                        : 'bg-slate-900/60 border-slate-850 hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-indigo-600 text-slate-950' : 'bg-slate-800 text-slate-200'
                        }`}>
                          {emp.initialTab === 'veterinary' && <Activity className="w-4 h-4" />}
                          {emp.initialTab === 'kitchen' && <Soup className="w-4 h-4" />}
                          {emp.initialTab === 'pos_settlement' && <Truck className="w-4 h-4" />}
                          {emp.initialTab === 'production' && <Wrench className="w-4 h-4" />}
                          {emp.initialTab === 'treasury' && <Lock className="w-3.5 h-3.5" />}
                        </div>
                        {/* Instant Online dot */}
                        <div className={`absolute -bottom-1 -left-1 w-3 h-3 rounded-full border-2 border-slate-950 ${
                          emp.online ? 'bg-emerald-500' : 'bg-slate-600'
                        }`} />
                      </div>

                      <div>
                        <div className="font-extrabold text-xs flex items-center gap-1.5">
                          <span>{emp.fullName}</span>
                          {emp.online && (
                            <span className="text-[8.5px] bg-emerald-950 text-emerald-400 font-bold px-1 rounded">متصل</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {emp.departmentLabel} | <span className="text-white">{emp.governorate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {userUnreadCount > 0 && (
                        <span className="w-4.5 h-4.5 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center animate-bounce">
                          {userUnreadCount}
                        </span>
                      )}
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-650 text-xs">
                لم يتم العثور على شركاء متاحين للتواصل.
              </div>
            )}
          </div>

          {/* Quick guide inside sidebar */}
          <div className="p-3 bg-slate-900/40 border-t border-slate-850 text-[9.5px] text-slate-400 leading-normal flex items-start gap-1.5">
            <Bot className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <span>نظام الدردشة محاكي بالكامل للأدوار. عند مراسلة الزملاء سيقومون بالرد الفوري استجابة للاحتياجات الميدانية.</span>
          </div>

        </div>

        {/* LEFT PANEL: ACTIVE CONVERSATION BOX (Takes 8/12 columns on desktop) */}
        <div className={`md:col-span-8 flex flex-col justify-between bg-slate-900 h-full ${
          !showMobileSidebar ? 'flex' : 'hidden md:flex'
        }`}>
          {selectedEmp ? (
            <>
              {/* Chat room active employee header */}
              <div className="p-3.5 border-b border-slate-850 bg-slate-950 flex items-center justify-between text-right">
                
                {/* Back to list button for small devices */}
                <button
                  onClick={() => { triggerBeep(700, 0.05); setShowMobileSidebar(true); }}
                  className="flex items-center gap-1 text-slate-400 hover:text-white md:hidden text-xs bg-slate-900 p-1 px-2.5 rounded-lg border border-slate-800 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>الرجوع للموظفين</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                      {selectedEmp.initialTab === 'veterinary' ? <Activity className="w-4 h-4" /> :
                       selectedEmp.initialTab === 'kitchen' ? <Soup className="w-4 h-4" /> :
                       selectedEmp.initialTab === 'pos_settlement' ? <Truck className="w-4 h-4" /> :
                       selectedEmp.initialTab === 'production' ? <Wrench className="w-4 h-4" /> :
                       <Lock className="w-4 h-4" />}
                    </div>
                    <div className={`absolute -bottom-1 -left-1 w-3 h-3 rounded-full border-2 border-slate-950 ${
                      selectedEmp.online ? 'bg-emerald-500' : 'bg-slate-600'
                    }`} />
                  </div>

                  <div>
                    <h3 className="text-xs font-black text-white">{selectedEmp.fullName}</h3>
                    <div className="text-[10px] text-slate-450 text-slate-400 leading-tight">
                      المكتب: {selectedEmp.branchLabel} | قسم: <span className="text-indigo-400 font-bold">{selectedEmp.role}</span>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 bg-slate-900 p-1.5 px-3 rounded-xl border border-slate-850 text-[10px] text-slate-400">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تشفير دفتري مغلق بالفرع</span>
                </div>

              </div>

              {/* Chat messages body container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-slate-900 [background-image:radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                
                {/* Information Header card */}
                <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-2xl text-center max-w-md mx-auto relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-1 pr-2 text-indigo-505/20 font-black text-3xl select-none leading-none">2026</div>
                  <SecurityCertificateBadge />
                  <p className="text-[10px] text-slate-300 mt-1">
                    جاري التواصل مع <span className="text-amber-400 font-bold">{selectedEmp.fullName}</span> تتبع فرع <span className="text-white font-bold">{selectedEmp.governorate}</span>.
                    كود محاكاة البصمة متاح تلقائياً للعمال والمشرفين.
                  </p>
                </div>

                {chatConversation.map((msg, idx) => {
                  const isIncoming = msg.sender === selectedEmp.username;
                  return (
                    <div 
                      key={msg.id || idx} 
                      className={`flex flex-col max-w-[85%] ${
                        isIncoming ? 'mr-auto items-start' : 'ml-auto items-end'
                      }`}
                    >
                      {/* Bubble style wrapper */}
                      <div className={`p-3.5 rounded-2xl relative shadow-md ${
                        isIncoming 
                          ? 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tr-none' 
                          : 'bg-indigo-600 text-slate-950 font-medium rounded-tl-none animate-slide-up'
                      }`}>
                        
                        {/* Auto-reply label indicator */}
                        {msg.isAutoReply && (
                          <div className="flex items-center gap-1 mb-1 text-[8.5px] text-amber-400 font-bold">
                            <Bot className="w-3 h-3" />
                            <span>استجابة بيطرية مبرمجة</span>
                          </div>
                        )}

                        <p className="text-xs leading-relaxed break-words whitespace-pre-line text-right" dir="rtl">
                          {msg.content}
                        </p>

                        {/* Extra info indicators bottom */}
                        <div className="flex items-center justify-end gap-1.5 mt-2 text-[8px]">
                          <span className={`${isIncoming ? 'text-slate-500' : 'text-indigo-950'} font-sans`}>
                            {msg.timestamp}
                          </span>
                          {!isIncoming && (
                            msg.read ? (
                              <CheckCheck className="w-3.5 h-3.5 text-indigo-950 font-bold" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-indigo-900" />
                            )
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>

              {/* Chat action message composer bottom input form */}
              <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-850 flex items-center gap-2">
                <input 
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="اكتب رسالتك لزميل الفرع هنا..."
                  className="flex-1 bg-slate-900 border border-slate-800 p-3 px-4 rounded-xl text-xs text-white placeholder-slate-550 text-right focus:outline-none focus:border-indigo-500 font-sans"
                />
                
                <button
                  type="submit"
                  disabled={!newMessageText.trim()}
                  className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                    newMessageText.trim()
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-slate-950'
                      : 'bg-slate-850 text-slate-500 cursor-not-allowed'
                  }`}
                  title="إرسال عبر القنوات"
                >
                  <Send className="w-4 h-4 transform rotate-180" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-slate-900">
              <div className="w-16 h-16 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-slate-300">لم تقم باختيار محادثة بدفتر العثور</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1.5 leading-relaxed">
                الرجاء اختيار أحد الموظفين المعينين من القائمة المجاورة لبدء جلسة اتصال آمنة وتدقيق حالة عسرة القطيع والعهد الميدانية.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

// Subordinate cosmetic security badge
function SecurityCertificateBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 text-[9px] bg-indigo-950/80 border border-indigo-550/30 text-indigo-400 font-bold py-0.5 px-2 rounded-lg mb-1.5">
      <Sparkles className="w-3 h-3" />
      <span>شهادة التشفير الموحدة للشبكة منشطة دفترياً</span>
    </div>
  );
}
