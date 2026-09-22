import axios from 'axios';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const sendSMS = async (phone: string, message: string, overrides?: { apiKey?: string, mobileIp?: string }) => {
  try {
    const cleanPhone = phone.replace(/[^\d\+]/g, '');
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? ';' : '?';
    const smsUrl = `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
    
    try {
      const link = document.createElement('a');
      link.href = smsUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.location.href = smsUrl;
    }
    
    return { success: true, native: true, message: 'SMS popped open in native app' };
  } catch (error: any) {
    console.error('Error launching native SMS:', error);
    throw new Error(error.message || 'فشل فتح تطبيق الرسائل الرسمي للهاتف');
  }
};

export const sendSystemSMS = async (phone: string, code: string, customerName: string) => {
  const welcomeMsg = `👑 مرحباً بك يا ${customerName} في VIP النخبة! كود التفعيل الملكي الخاص بك هو: 【 ${code} 】. يرجى استخدامه لتفعيل حسابك فوراً 🌟`;
  return sendSMS(phone, welcomeMsg);
};

export const pingSMS = async (apiKey: string) => {
  try {
    const response = await axios.get('/api/ping-sms', {
      params: { apiKey }
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.details || error.message);
  }
};

export const sendWhatsApp = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

export const parseTemplate = (template: string, data: Record<string, any>, settings?: any) => {
  let parsed = template;
  
  // Replace placeholders
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    parsed = parsed.replace(regex, String(value || ''));
  });

  if (settings) {
    const shopName = settings.shopName || 'Jam system pro';
    const supervisor = settings.supervisorName || 'عبدالغني المحفلي';
    
    const header = `نحن في ${shopName} لخدمات الجوال والكمبيوتر نرحب بكم 🌟\n--------------------\n`;
    const footer = `\n--------------------\nولكم جزيل الشكر .. تتم صيانه وبرمجه الاجهزه تحت اشراف م/${supervisor}`;
    
    // If it's a template that doesn't already have the header/footer structure
    if (!parsed.includes('نرحب بكم')) {
      parsed = header + parsed + footer;
    }
  }

  return parsed;
};

export const templates = {
  newDebt: (customer: string, amount: number, service: string, date: string) => 
    `عزيزي العميل ${customer}، تم تقييد مبلغ (${amount}) كدين مقابل ${service} بتاريخ ${date}. نرجو السداد قريباً.`,
  
  debtRepayment: (amountReceived: number, remaining: number) => 
    `تم استلام (${amountReceived}). الرصيد المتبقي عليكم حالياً هو (${remaining}). شكراً لكم.`,
  
  deviceReady: (type: string, amount: number, customer: string, date: string) => 
    `✅ إشعار جاهزية\nمرحبًا ${customer},\nنود إبلاغك أن جهازك (${type}) جاهز للاستلام بتاريخ: ${date}.\nالتكلفة المتبقية: ${amount} ر.ي.\nشكراً لثقتك بنا 🌷`,
  
  deviceDelivered: (customer: string, device: string, date: string) =>
    `✅ إشعار تسليم\nمرحبًا ${customer},\nنود إبلاغك أن جهازك (${device}) تم تسليمه لك بنجاح بتاريخ: ${date}.\nشكراً لثقتك بنا 🌷`,

  orderDetails: (data: {
    name: string;
    phone: string;
    issue: string;
    device: string;
    contents: string;
    date: string;
    total: number;
    paid: number;
    remaining: number;
    status: string;
  }) => 
    ` الاسم: ${data.name}
 الهاتف: ${data.phone}
 المشكلة: ${data.issue}
 نوع الجهاز: ${data.device}
 المحتويات: ${data.contents}
 تاريخ التسليم: ${data.date}
 التكلفة الكاملة: ${data.total}
 الواصل: ${data.paid}
 المتبقي: ${data.remaining}
📌 الحالة: ${data.status}`,

  repairFailed: (type: string, customer: string) => 
    `نعتذر عزيزي ${customer}، تعذر إصلاح ${type} لعدم توفر قطع الغيار. يرجى الاستلام خلال أسبوع لتجنب فقدان الجهاز.`,
  
  inspectionResult: (type: string, issue: string, amount: number, customer: string) => 
    `عزيزي ${customer}، فحص ${type} أظهر خلل (${issue}) وتكلفة الإصلاح (${amount}). يرجى إفادتنا بالموافقة أو الاستلام خلال 48 ساعة.`,

  trackingLink: (shopName: string, phone: string) => {
    let origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return `\nللمتابعة عبر البوابة الذكية:\n${origin}/portal?shop=${shopName}&phone=${phone}&tab=maintenance`;
  }
};
