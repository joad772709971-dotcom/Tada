import { Customer, UserProfile } from '../types';
import { sendSMS, sendWhatsApp } from './smsService';

export interface B2BInviteOptions {
  portalUrl?: string;
  supportPhone?: string;
  customNote?: string;
}

export const b2bOnboardingService = {
  /**
   * الفحص الذكي لأهلية إرسال دعوة الانضمام التجاري (B2B):
   * - متاح لتجار الجملة والمستوردين عند التعامل مع العملاء التجاريين (تجزئة، جملة، مستورد، محلات).
   * - يتم إيقاف وتجاوز الدعوات التلقائية لزبائن التجزئة الأفراد والمواطنين لمنع الإزعاج.
   */
  isEligibleForB2BInvite: (
    merchantProfile: UserProfile | null, 
    customer: Partial<Customer> | null
  ): { isEligible: boolean; reason: string; isIndividual: boolean } => {
    if (!customer) {
      return { isEligible: false, reason: 'لم يتم تحديد عميل', isIndividual: false };
    }

    const tier = customer.businessTier || (customer.tier as any);
    const isIndividual = tier === 'individual' || tier === 'زبون عادي 👤' || (!customer.shopName && tier === undefined && !customer.isB2BClient);

    // إذا كان العميل مواطناً / زبون أفراد صريحاً في كاشير التجزئة
    if (isIndividual) {
      return {
        isEligible: false,
        reason: 'تم إيقاف الدعوة الذكية تلقائياً: العميل زبون تجزئة/أفراد لعدم إزعاجه.',
        isIndividual: true
      };
    }

    // إذا كان التاجر تاجر جملة أو مستورد أو كان العميل مسجلاً كنشاط تجاري
    const merchantIsWholesale = 
      merchantProfile?.role === 'wholesaler' || 
      merchantProfile?.role === 'master_wholesale' ||
      merchantProfile?.role === 'importer' || 
      merchantProfile?.role === 'mega_wholesale' ||
      merchantProfile?.businessType === 'wholesale' ||
      merchantProfile?.businessType === 'master_wholesale' ||
      merchantProfile?.networkRole === 'wholesaler' ||
      merchantProfile?.networkRole === 'master_wholesale';

    const customerIsB2B = 
      customer.isB2BClient === true ||
      !!customer.shopName ||
      tier === 'retail' ||
      tier === 'wholesale' ||
      tier === 'mega_wholesale' ||
      tier === 'importer' ||
      (typeof customer.tier === 'string' && customer.tier.includes('مستورد'));

    if (merchantIsWholesale || customerIsB2B) {
      return {
        isEligible: true,
        reason: 'العميل مؤهل لاستلام دعوة الشراكة التجارية والربط عبر منظومة JAM Pro B2B.',
        isIndividual: false
      };
    }

    return {
      isEligible: false,
      reason: 'العميل غير مصنف كنشاط تجاري B2B.',
      isIndividual: false
    };
  },

  /**
   * صياغة نص رسالة الدعوة الاحترافية لربط العميل بمنظومة B2B
   */
  generateInvitationText: (
    merchantProfile: UserProfile | null,
    customer: Partial<Customer>,
    options?: B2BInviteOptions
  ): string => {
    const shopName = merchantProfile?.shopName || 'مؤسسة التوريد المعتمدة';
    const clientName = customer.name || 'عزيزنا الشريك التجاري';
    const shopClientTitle = customer.shopName ? ` (${customer.shopName})` : '';
    const customerCode = customer.code || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
    const supportPhone = options?.supportPhone || merchantProfile?.phone || merchantProfile?.shopPhone || '777503191';
    
    // رابط البوابة المباشرة
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://jam-pro.web.app';
    const merchantId = merchantProfile?.ownerId || merchantProfile?.uid || '';
    const portalUrl = options?.portalUrl || `${origin}/#/portal?shop=${encodeURIComponent(merchantId)}&code=${encodeURIComponent(customerCode)}`;

    const tierLabels: Record<string, string> = {
      retail: 'تاجر تجزئة معتمد 🏪',
      wholesale: 'شريك جملة 📦',
      mega_wholesale: 'جملة الجملة 🏛️',
      importer: 'وكيل / مستورد 🚢',
      individual: 'عميل أفراد 👤'
    };

    const tierName = customer.businessTier ? (tierLabels[customer.businessTier] || customer.businessTier) : 'شريك تجاري معتمد';

    let msg = `✨ *دعوة انضمام وشراكة تجارية ذكية* ✨\n`;
    msg += `مرحباً بك الأخ/ *${clientName}*${shopClientTitle}،\n`;
    msg += `يسرنا في *${shopName}* دعوتكم للربط المباشر معنا عبر منصة التوريد الذكية *JAM Pro B2B*.\n\n`;
    
    msg += `🏷️ *بيانات حسابكم التجاري:*\n`;
    msg += `▫️ كود الشريك: *${customerCode}*\n`;
    msg += `▫️ رتبة الاعتماد: ${tierName}\n`;
    if (customer.allowCredit && customer.creditLimit) {
      msg += `▫️ سقف التسهيلات الائتمانية: ${customer.creditLimit.toLocaleString()} ر.ي\n`;
    }
    msg += `\n🚀 *مميزات حسابكم التجاري المباشر:*\n`;
    msg += `1️⃣ استعراض الكتالوج والأسعار الخاصة بكم والمخزون الحي لحظة بلحظة.\n`;
    msg += `2️⃣ إرسال طلبات الشراء وحجز البضائع فوراً دون الحاجة للاتصال.\n`;
    msg += `3️⃣ متابعة كشوفات الحساب والفواتير والمديونية بدقة وموثوقية.\n`;
    msg += `4️⃣ تطبيق جوال ونسخة كمبيوتر سريعة وسهلة الاستخدام.\n\n`;

    msg += `🌐 *رابط الدخول واستعراض الكتالوج المباشر:*\n${portalUrl}\n\n`;
    msg += `📞 *الدعم الفني وخدمة العملاء:*\nهاتف/واتساب: ${supportPhone}\n\n`;
    msg += `نتطلع لشراكة تجارية مثمرة ومستدامة معكم 🤝`;

    return msg;
  },

  /**
   * إرسال الدعوة عبر واتساب
   */
  sendWhatsAppInvite: (phone: string, message: string) => {
    sendWhatsApp(phone, message);
  },

  /**
   * إرسال الدعوة عبر SMS
   */
  sendSMSInvite: async (phone: string, message: string) => {
    return sendSMS(phone, message);
  }
};
