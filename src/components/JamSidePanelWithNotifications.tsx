import React, { useState } from 'react';
import { JamBadge, JamNotification } from './NotificationManager'; // استدعاء المكونات المعتمدة من ملفك

interface JamExtendedSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: JamNotification[];
  counters: { financial: number; logistics: number; network: number; total: number };
  transientToast: { show: boolean; message: string } | null;
  onMarkAsRead: (id: string) => void;
}

// ==========================================
// 1. قاموس الألوان الفاخرة والمطابقة للهوية الملكية حسب نوع المهمة
// ==========================================
const getJamTaskVisuals = (message: string, category: string) => {
  const msg = (message || '').toLowerCase();
  
  // حوالة / مالي
  if (msg.includes('حوالة') || category === 'FINANCIAL') {
    return { color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.08)', border: '#2ecc71', icon: '💰' };
  }
  // طلب / تجهيز طلب
  if (msg.includes('تجهيز طلب') || msg.includes('طلب جديد')) {
    return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)', border: '#38bdf8', icon: '📦' };
  }
  // شحن / توصيل
  if (msg.includes('شحن') || msg.includes('توصيل')) {
    return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', border: '#eab308', icon: '🚚' };
  }
  // صيانة
  if (msg.includes('صيانة')) {
    return { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.08)', border: '#a855f7', icon: '🔧' };
  }
  // نواقص
  if (msg.includes('نواقص') || msg.includes('عجز')) {
    return { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)', border: '#f43f5e', icon: '⚠️' };
  }
  // تسوية كميات / مطابقة
  if (msg.includes('تسوية') || msg.includes('مطابقة')) {
    return { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.08)', border: '#60a5fa', icon: '⚖️' };
  }
  // تراجع عن بيع / حذف
  if (msg.includes('تراجع') || msg.includes('حذف') || msg.includes('إلغاء')) {
    return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', icon: '🚨' };
  }

  // افتراضي في حال عدم وجود تطابق
  return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.05)', border: '#475569', icon: '🔔' };
};

// ==========================================
// 2. UPDATED INLINE RENDER CARD IN SIDE PANEL (كارت الإشعار الملون عالي الخفة)
// ==========================================
export const JamColorCodedNotificationCard: React.FC<{
  notif: any;
  onCardClick: (notif: any) => void;
}> = ({ notif, onCardClick }) => {
  const visuals = getJamTaskVisuals(notif.message, notif.category);

  return (
    <div 
      onClick={() => onCardClick(notif)}
      style={{
        padding: '10px 14px',
        background: visuals.bg,
        borderRadius: '12px',
        marginBottom: '8px',
        cursor: 'pointer',
        border: `1px solid ${visuals.border}`,
        borderRight: `5px solid ${visuals.color}`, // تمييز جانبي بلون المهمة الصريح
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'all 0.15s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        opacity: notif.isRead ? 0.6 : 1
      }}
      className="group"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', color: visuals.color, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{visuals.icon}</span>
          {notif.title}
        </span>
        <span style={{ color: '#64748b', fontSize: '9px', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
          {notif.isRead ? 'تمت قراءتها' : 'مهمة معلقة'}
        </span>
      </div>
      <p style={{ margin: 0, color: '#e2e8f0', fontSize: '11px', lineHeight: '1.4' }}>
        {notif.message}
      </p>
    </div>
  );
};

export const JamSidePanelWithNotifications: React.FC<JamExtendedSidePanelProps> = ({
  isOpen,
  onClose,
  notifications,
  counters,
  transientToast,
  onMarkAsRead
}) => {
  // إدارة تبويب الإشعارات النشط بداخل قسم الإشعارات لعدم التشتيت
  const [activeNotifTab, setActiveNotifTab] = useState<'ALL' | 'FINANCIAL' | 'LOGISTICS' | 'NETWORK'>('ALL');

  if (!isOpen) return null;

  // تصفية الإشعارات بناءً على القسم المحدد
  const filteredNotifications = activeNotifTab === 'ALL'
    ? notifications
    : notifications.filter(n => n.category === activeNotifTab);

  const handleMarkAllRead = () => {
    notifications.forEach(n => {
      if (!n.isRead) {
        onMarkAsRead(n.id);
      }
    });
  };

  return (
    <>
      {/* 1. الـ Transient Toast: الومضة السريعة المانعة للإزعاج في زاوية الشاشة الفاخرة */}
      {transientToast?.show && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', padding: '12px 20px',
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          borderRight: '4px solid #f5d061', borderRadius: '12px', color: '#fff',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 100001,
          fontSize: '12px', fontWeight: 'bold',
          display: 'flex', alignItems: 'center', gap: '8px'
        }} dir="rtl">
          🔔 إشعار سريع: {transientToast.message}
        </div>
      )}

      {/* 2. اللوحة الجانبية الرئيسية المحدثة بالعدادات الذكية والرقابة الحية الموحدة */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '400px', maxWidth: '90vw', height: '100vh',
        background: '#0f172a', borderRight: '1px solid #1e293b',
        boxShadow: '5px 0 25px rgba(0,0,0,0.6)', zIndex: 99999,
        display: 'flex', flexDirection: 'column'
      }} dir="rtl">
        
        {/* هيدر النافذة الجانبية الموحد */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b' }}>
          <div>
            <h3 style={{ margin: 0, color: '#f5d061', fontSize: '15px', fontWeight: 'bold' }}>
              مركز الحركة والرقابة الذكية والرقابة الحية
            </h3>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>إشعارات النظام والعمليات غير المقروءة ({counters.total})</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        {/* مساحة الرندر والمطابقة المقسمة */}
        <div style={{ padding: '15px', flex: 1, overflowY: 'auto' }}>
          
          {/* ==========================================
              أقسام تبويبات الإشعارات والعدادات الذهبية المدمجة
              ========================================== */}
          <div style={{ marginBottom: '15px', background: '#020617', padding: '8px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingRight: '4px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>تصنيفات الإشعارات وحركات النظام:</span>
              {counters.total > 0 && (
                <button 
                  onClick={handleMarkAllRead}
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer' }}
                >
                  تحديد الكل كـ مقروء
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setActiveNotifTab('ALL')}
                style={{ flex: 1, padding: '6px 4px', background: activeNotifTab === 'ALL' ? '#cf8a3c' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', minWidth: '70px' }}
              >
                🔔 الكل <JamBadge count={counters.total} />
              </button>
              
              <button 
                onClick={() => setActiveNotifTab('FINANCIAL')}
                style={{ flex: 1, padding: '6px 4px', background: activeNotifTab === 'FINANCIAL' ? '#cf8a3c' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', minWidth: '70px' }}
              >
                💰 مالية <JamBadge count={counters.financial} />
              </button>

              <button 
                onClick={() => setActiveNotifTab('LOGISTICS')}
                style={{ flex: 1, padding: '6px 4px', background: activeNotifTab === 'LOGISTICS' ? '#cf8a3c' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', minWidth: '70px' }}
              >
                📦 مخازن <JamBadge count={counters.logistics} />
              </button>

              <button 
                onClick={() => setActiveNotifTab('NETWORK')}
                style={{ flex: 1, padding: '6px 4px', background: activeNotifTab === 'NETWORK' ? '#cf8a3c' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', minWidth: '70px' }}
              >
                🔗 شبكة <JamBadge count={counters.network} />
              </button>

            </div>
          </div>

          {/* قائمة رندر الإشعارات حسب التبويب النشط */}
          <div className="space-y-2">
            {filteredNotifications.map(notif => (
              <JamColorCodedNotificationCard 
                key={notif.id}
                notif={notif}
                onCardClick={() => onMarkAsRead(notif.id)}
              />
            ))}

            {filteredNotifications.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#475569', fontSize: '12px' }}>
                📭 لا توجد حركات معلقة في هذا القسم حالياً.
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
};
