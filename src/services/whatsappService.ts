
import { Sale, ShopSettings } from '../types';

/**
 * WhatsApp Integration Service
 * Formats invoice data and opens WhatsApp API link
 */

export function shareInvoiceViaWhatsApp(sale: Sale, settings: ShopSettings) {
  const phone = sale.customerPhone || settings.shopPhone;
  const shopName = settings.shopName || 'Jam system pro';
  
  let text = `*${shopName}*\n`;
  text += `*فاتورة مبيعات رقم:* #${sale.id.slice(-6)}\n`;
  text += `*التاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n`;
  text += `--------------------------\n`;
  
  sale.items.forEach(item => {
    text += `• ${item.name} x${item.quantity} = ${item.price.toLocaleString()} ر.ي\n`;
  });
  
  text += `--------------------------\n`;
  text += `*الإجمالي:* ${sale.total.toLocaleString()} ر.ي\n`;
  
  if (sale.paymentMethod === 'debt') {
    text += `*طريقة الدفع:* آجل (دين)\n`;
  }
  
  text += `\nشكراً لتعاملكم معنا!\n`;
  text += `للتواصل: ${settings.shopPhone}`;

  const encodedText = encodeURIComponent(text);
  const url = `https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, '')}&text=${encodedText}`;
  
  window.open(url, '_blank');
}

/**
 * Sends B2B Order Status Notification via WhatsApp
 */
export function sendB2BOrderStatusWhatsAppNotification(order: {
  id: string;
  status: string;
  wholesalerName?: string;
  retailerName?: string;
  total?: number;
  customerPhone?: string;
  supplierPhone?: string;
  items?: Array<{ name: string; quantity: number }>;
}, recipientRole: 'buyer' | 'supplier' = 'buyer') {
  const targetPhone = recipientRole === 'buyer' 
    ? (order.customerPhone || '') 
    : (order.supplierPhone || '');
  
  const formattedPhone = targetPhone.replace(/\D/g, '');
  
  const statusMap: Record<string, string> = {
    accepted: '✅ تم إعتماد الطلبية وتأكيد حجز الكميات',
    shipped: '🚚 تم شحن الطلبية وهي في الطريق إليك',
    delivered: '📦 تم استلام الطلبية ومزامنة المخزون تلقائياً',
    cancelled: '❌ تم إلغاء / رفض الطلبية',
    pending: '⏳ الطلبية قيد الانتظار والمعالجة'
  };

  const statusTitle = statusMap[order.status] || `تحديث حالة الطلب: ${order.status}`;
  
  let text = `*نظام جام PRO - إشعار طلبية B2B*\n`;
  text += `--------------------------------\n`;
  text += `*رقم الطلب:* #${(order.id || '').slice(-6)}\n`;
  text += `*الحالة الجديدة:* ${statusTitle}\n`;
  if (order.wholesalerName) text += `*المورد:* ${order.wholesalerName}\n`;
  if (order.retailerName) text += `*المشتري:* ${order.retailerName}\n`;
  if (order.total) text += `*الإجمالي:* ${Number(order.total).toLocaleString()} ر.ي\n`;
  
  if (order.items && order.items.length > 0) {
    text += `\n*الأصناف والمخزون المربوط:*\n`;
    order.items.slice(0, 5).forEach(i => {
      text += `• ${i.name} (الكمية: ${i.quantity})\n`;
    });
    if (order.items.length > 5) text += `...وغيرها من الأصناف\n`;
  }

  text += `--------------------------------\n`;
  text += `⚡ تم تحديث المخزون ومزامنة البيانات لحظياً عبر منصة JAM PRO.`;

  const encodedText = encodeURIComponent(text);
  const url = formattedPhone 
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  window.open(url, '_blank');
}

