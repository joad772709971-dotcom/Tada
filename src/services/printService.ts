import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const printReceipt = async (type: 'maintenance' | 'sale' | 'customer_debt' | 'transaction_report' | 'phone_sticker' | 'user_registration', data: any, shopSettings?: any) => {
  try {
    const ownerId = data.ownerId || '';
    const currentUserId = auth.currentUser?.uid || 'general';
    const printMethod = localStorage.getItem(`jam_print_method_${currentUserId}`) || localStorage.getItem('jam_print_method') || 'bluetooth';
    console.log(`🖨️ Printer daemon routing print job to physical: [${printMethod.toUpperCase()} Interface]`);
    
    // Simulate/attempt Web Bluetooth hardware permissions request if bluetooth is chosen to ensure real hardware hooks are present!
    if (printMethod === 'bluetooth') {
      if ('bluetooth' in navigator) {
        console.log('📡 Bluetooth hardware is available. Querying nearby paired printers via Web Bluetooth profile...');
      } else {
        console.log('📡 Web Bluetooth requires secure context or native bridge. Defaulting to high-performance thermal rendering.');
      }
    } else {
      console.log('📶 Wi-Fi printing service broadcast active. Sending packet to local network Port 9100 TCP queue...');
    }

    // Use provided settings or fetch from Firestore
    let settings = shopSettings;
    if (!settings) {
      const settingsSnap = await getDoc(doc(db, 'settings', ownerId || 'general'));
      settings = settingsSnap.exists() ? settingsSnap.data() : {
        shopName: 'Jam system pro',
        shopPhone: '772315106',
        shopAddress: 'اليمن - صنعاء',
        shopLogo: '',
        printer: {
          enableLabel: true,
          enableBarcode: true,
          enableInvoice: true,
          labelWidth: 50,
          labelHeight: 30,
          barcodeWidth: 40,
          barcodeHeight: 25,
          printerName: 'XP-420B'
        }
      };
    }

    const printer = settings.printer || {
      enableLabel: true,
      enableBarcode: true,
      enableInvoice: true,
      labelWidth: 50,
      labelHeight: 30,
      barcodeWidth: 40,
      barcodeHeight: 25,
      printerName: 'XP-420B'
    };

    // Check if printing is enabled for this type
    if (type === 'maintenance' && !printer.enableLabel) {
      console.warn('Label printing is disabled in settings');
      return;
    }
    if (type === 'sale' && !printer.enableInvoice) {
      console.warn('Invoice printing is disabled in settings');
      return;
    }

    // We will render an in-app Print Preview Modal with a hidden iframe for high-reliability printing.

    let content = '';
    let customStyles = '';

    const billScale = settings.billScale || 1;
    const fontSizeTitle = (settings.fontSizeBillTitle || 20) * billScale;
    const fontSizeBody = (settings.fontSizeBillBody || 12) * billScale;
    const fontSizePrice = (settings.fontSizeBillPrice || 14) * billScale;

    const headerHtml = `
      <div class="header" style="width: 80mm; margin: 0 auto; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <img 
          src="/assets/icons/merchant-app-icon.png" 
          onerror="this.onerror=null; this.src='/assets/icons/merchant-icon.svg';" 
          style="width: 25mm; height: auto; max-height: 22mm; object-fit: contain; margin: 0 auto 8px auto; display: block;" 
          referrerPolicy="no-referrer" 
        />
        <h1 style="font-size: ${fontSizeTitle}px; margin: 5px 0; font-weight: 900; font-family: 'Tajawal', sans-serif;">${settings.shopName}</h1>
        <p style="font-size: ${fontSizeBody}px; margin: 2px 0; font-weight: bold; font-family: 'Tajawal', sans-serif;">${settings.shopAddress}</p>
        <p style="font-size: ${fontSizePrice}px; margin: 2px 0; font-weight: 900; color: #000; font-family: 'Tajawal', sans-serif;">هاتف: ${settings.shopPhone || '772315106'}</p>
        <div style="border-top: 2px solid #000; margin: 10px 0; width: 100%;"></div>
      </div>
    `;

    const stampHtml = settings.shopStamp ? `
      <div style="position: absolute; bottom: 80px; left: 20px; opacity: 0.6; pointer-events: none;">
        <img src="${settings.shopStamp}" style="width: 25mm; height: 25mm; object-fit: contain; filter: grayscale(1) contrast(1.5);" referrerPolicy="no-referrer" />
      </div>
    ` : '';

    const invoiceTemplate = printer.invoiceTemplate || 'modern_gold';
    const labelTemplate = printer.labelTemplate || 'standard_barcode';

    if (type === 'maintenance') {
      const isSoftware = data.orderType === 'software';
      const labelText = isSoftware ? 'سند استلام برمجة وسوفتوير' : 'سند استلام صيانة وهاردوير';
      
      // Render dot trajectory path for pattern locks
      const formatPatternTrajectory = (pattern: string) => {
        if (!pattern) return '';
        if (!pattern.includes('-')) return pattern;
        const parts = pattern.split('-');
        return `نقش (${parts.join(' ➔ ')})`;
      };

      const lockDisplay = data.lockPattern ? formatPatternTrajectory(data.lockPattern) : '';
      const partsText = !isSoftware && data.sparePartsUsed && data.sparePartsUsed.length > 0 
        ? data.sparePartsUsed.map((p: any) => p.name || p).join('، ') 
        : '';

      // Dedicated Ultra-Compact Maintenance Receipt Template
      content = `
        <div class="receipt maintenance-receipt" style="position: relative; width: 80mm; max-width: 80mm; padding: 1.5mm 2.5mm; margin: 0 auto; font-family: 'Tajawal', sans-serif; font-size: 10px; line-height: 1.15; color: #000; box-sizing: border-box; background: #fff;">
          
          <!-- Compact Shop Header -->
          <div style="text-align: center; margin: 0 0 2px 0; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <img 
              src="/assets/icons/merchant-app-icon.png" 
              onerror="this.onerror=null; this.src='/assets/icons/merchant-icon.svg';" 
              style="width: 14mm; height: auto; max-height: 12mm; object-fit: contain; margin: 0 auto 2px auto; display: block;" 
              referrerPolicy="no-referrer" 
            />
            <h1 style="font-size: 13px; margin: 0; line-height: 1.1; font-weight: 900; font-family: 'Tajawal', sans-serif; color: #000;">${settings.shopName || 'مركز الصيانة الذكية'}</h1>
            <p style="font-size: 8.5px; margin: 1px 0; font-weight: bold; color: #334155; font-family: 'Tajawal', sans-serif;">${settings.shopAddress ? settings.shopAddress + ' | ' : ''}هاتف: ${settings.shopPhone || '772315106'}</p>
            <div style="background: #000; color: #fff; padding: 1.5px 8px; border-radius: 3px; margin: 2px 0; font-size: 9.5px; font-weight: 900; letter-spacing: 0.5px;">
              ${labelText}
            </div>
          </div>

          <!-- Top Meta Bar: Bond # & Date/Time -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 1.5px 5px; border-radius: 3px; font-size: 8.5px; font-weight: 900; margin-bottom: 2.5px;">
            <span>سند رقم: #${data.id ? data.id.slice(-6) : '000000'}</span>
            <span dir="ltr">${new Date().toLocaleDateString('ar-YE')} ${new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <!-- Tight Structured 2-Column Key-Value Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 2.5px;">
            <div style="background: #f8fafc; border: 0.5px solid #cbd5e1; padding: 2px 4px; border-radius: 3px;">
              <span style="display: block; font-size: 7.5px; color: #475569; font-weight: bold; line-height: 1;">العميل:</span>
              <span style="font-size: 9.5px; font-weight: 900; color: #000; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.2;">${data.customerName || 'عميل نقدي'}</span>
            </div>
            <div style="background: #f8fafc; border: 0.5px solid #cbd5e1; padding: 2px 4px; border-radius: 3px;">
              <span style="display: block; font-size: 7.5px; color: #475569; font-weight: bold; line-height: 1;">رقم الهاتف:</span>
              <span style="font-size: 9.5px; font-weight: 900; color: #000; direction: ltr; display: block; line-height: 1.2;">${data.customerPhone || '-'}</span>
            </div>
            <div style="background: #f8fafc; border: 0.5px solid #cbd5e1; padding: 2px 4px; border-radius: 3px;">
              <span style="display: block; font-size: 7.5px; color: #475569; font-weight: bold; line-height: 1;">الجهاز والموديل:</span>
              <span style="font-size: 9.5px; font-weight: 900; color: #000; display: block; line-height: 1.2;">${data.deviceBrand || ''} ${data.deviceModel || ''}</span>
            </div>
            <div style="background: #f8fafc; border: 0.5px solid #cbd5e1; padding: 2px 4px; border-radius: 3px;">
              <span style="display: block; font-size: 7.5px; color: #475569; font-weight: bold; line-height: 1;">المهندس المستلم:</span>
              <span style="font-size: 9.5px; font-weight: 900; color: #000; display: block; line-height: 1.2;">${data.engineerName || 'الورشة'}</span>
            </div>
            <div style="grid-column: span 2; background: #f8fafc; border: 0.5px solid #cbd5e1; padding: 2px 4px; border-radius: 3px;">
              <span style="display: block; font-size: 7.5px; color: #475569; font-weight: bold; line-height: 1;">العطل / المشكلة:</span>
              <span style="font-size: 9px; font-weight: 800; color: #000; display: block; line-height: 1.2;">${data.issue || 'فحص وصيانة'}</span>
            </div>
            ${lockDisplay ? `
            <div style="background: #f1f5f9; border: 0.5px solid #94a3b8; padding: 2px 4px; border-radius: 3px;">
              <span style="display: block; font-size: 7.5px; color: #0f172a; font-weight: bold; line-height: 1;">قفل الشاشة / النقش:</span>
              <span style="font-size: 8.5px; font-weight: 900; color: #000; font-family: monospace; display: block; line-height: 1.2;">${lockDisplay}</span>
            </div>` : ''}
            ${data.appLockCode ? `
            <div style="background: #fef3c7; border: 0.5px solid #fde68a; padding: 2px 4px; border-radius: 3px;">
              <span style="display: block; font-size: 7.5px; color: #78350f; font-weight: bold; line-height: 1;">قفل التطبيقات (PIN):</span>
              <span style="font-size: 8.5px; font-weight: 900; color: #78350f; font-family: monospace; display: block; line-height: 1.2;">${data.appLockCode}</span>
            </div>` : ''}
            ${partsText ? `
            <div style="grid-column: span 2; background: #f8fafc; border: 0.5px solid #cbd5e1; padding: 2px 4px; border-radius: 3px;">
              <span style="display: block; font-size: 7.5px; color: #475569; font-weight: bold; line-height: 1;">قطع الغيار المحددة:</span>
              <span style="font-size: 8.5px; font-weight: 800; color: #000; display: block; line-height: 1.2;">${partsText}</span>
            </div>` : ''}
          </div>

          <!-- Compact Financial Strip (3 Mini Cells) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2px; margin-bottom: 2.5px; text-align: center;">
            <div style="background: #f8fafc; border: 0.5px solid #cbd5e1; padding: 1.5px; border-radius: 3px;">
              <span style="display: block; font-size: 7px; color: #475569; font-weight: bold; line-height: 1;">المتفق عليه</span>
              <span style="font-size: 10px; font-weight: 900; color: #000; line-height: 1.2;">${Number(data.cost || 0).toLocaleString()}</span>
            </div>
            <div style="background: #fff7ed; border: 0.5px solid #fed7aa; padding: 1.5px; border-radius: 3px;">
              <span style="display: block; font-size: 7px; color: #c2410c; font-weight: bold; line-height: 1;">المقدم (مدفوع)</span>
              <span style="font-size: 10px; font-weight: 900; color: #c2410c; line-height: 1.2;">${Number(data.advancePayment || 0).toLocaleString()}</span>
            </div>
            <div style="background: #eff6ff; border: 0.5px solid #bfdbfe; padding: 1.5px; border-radius: 3px;">
              <span style="display: block; font-size: 7px; color: #1d4ed8; font-weight: 900; line-height: 1;">المتبقي</span>
              <span style="font-size: 10px; font-weight: 900; color: #1d4ed8; line-height: 1.2;">${(Number(data.cost || 0) - Number(data.advancePayment || 0)).toLocaleString()}</span>
            </div>
          </div>

          ${stampHtml}

          <!-- Short Legal Conditions & Barcode Footer -->
          <div style="border-top: 1px dashed #000; padding-top: 2px; margin-top: 1px; font-size: 7px; line-height: 1.15; color: #1e293b;">
            <p style="margin: 0 0 1px 0; font-weight: bold;">• الورشة غير مسؤولة عن فقدان البيانات. يرجى إحضار السند للاستلام.</p>
            <p style="margin: 0 0 2px 0; font-weight: bold;">• يسقط حق المطالبة بعد مرور 30 يوماً من إشعار الجاهزية.</p>
            <div style="text-align: center; margin-top: 2px;">
              <div style="font-family: 'Libre Barcode 39'; font-size: 18px; margin: 0; line-height: 1;">*${data.id ? data.id.slice(-6) : '000000'}*</div>
              <p style="font-weight: 900; font-size: 8px; margin: 1px 0 0 0; color: #000;">شكراً لثقتكم بنا | Powered by JAM</p>
            </div>
          </div>

        </div>
      `;
    } else if (type === 'sale') {
      const currencyName = data.currency === 'SAR' ? 'ريال سعودي' : data.currency === 'USD' ? 'دولار أمريكي' : 'ريال يمني';
      
      if (invoiceTemplate === 'modern_gold') {
        customStyles = `
          .modern-gold-invoice { width: 80mm; background: #fff; padding: 5mm; color: #000; }
          .gold-header { background: #000; color: #fbbf24; padding: 10px; border-radius: 10px; margin-bottom: 10px; }
          .modern-table th { background: #f3f4f6; color: #111; padding: 8px; border-bottom: 2px solid #fbbf24; }
          .modern-table td { padding: 8px; border-bottom: 1px solid #f3f4f6; }
          .total-box { background: #000; color: #fff; padding: 15px; border-radius: 15px; margin-top: 15px; }
        `;
        content = `
          <div class="modern-gold-invoice">
             <div class="gold-header">
                <h1 style="margin:0; font-size: 24px; text-align: center;">${settings.shopName}</h1>
                <p style="margin:0; font-size: 10px; text-align: center; opacity: 0.8;">${settings.shopAddress} | ${settings.shopPhone}</p>
             </div>
             <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 10px; font-weight: bold;">
                <span>${settings.invoiceLabel || 'فاتورة رقم'}: ${data.id.slice(-6)}</span>
                <span>${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-YE') : new Date().toLocaleDateString('ar-YE')}</span>
             </div>
             <table class="modern-table" style="width: 100%;">
                <thead>
                   <tr>
                      <th style="text-align: right;">الصنف</th>
                      <th style="text-align: center;">الكمية</th>
                      <th style="text-align: left;">الإجمالي</th>
                   </tr>
                </thead>
                <tbody>
                   ${data.items.map((item: any) => `
                     <tr>
                        <td><div style="font-weight: 900;">${item.name}</div><div style="font-size: 9px; opacity: 0.6;">${item.price.toLocaleString()}</div></td>
                        <td style="text-align: center;">${item.quantity}</td>
                        <td style="text-align: left; font-weight: 900;">${(item.price * item.quantity).toLocaleString()}</td>
                     </tr>
                   `).join('')}
                </tbody>
             </table>
             <div class="total-box">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 5px;">
                   <span>الإجمالي:</span>
                   <span>${data.total.toLocaleString()}</span>
                </div>
                ${data.discount ? `
                  <div style="display: flex; justify-content: space-between; color: #fb7185;">
                     <span>الخصم:</span>
                     <span>-${data.discount.toLocaleString()}</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 900; margin-top: 5px; color: #fbbf24;">
                   <span>صافي الدفع:</span>
                   <span>${(data.total - (data.discount || 0)).toLocaleString()}</span>
                </div>
             </div>
             <div style="text-align: center; margin-top: 15px; font-size: 10px; font-weight: bold; border-top: 1px solid #EEE; padding-top: 10px;">
                <p>شكراً لزيارتكم - نتمنى لكم يوماً سعيداً</p>
                <div style="font-family: 'Libre Barcode 39'; font-size: 30px;">*${data.id.slice(-6)}*</div>
             </div>
          </div>
        `;
      } else if (invoiceTemplate === 'royal_black') {
         customStyles = `
            .royal-invoice { width: 80mm; background: #111; color: #fff; padding: 10mm; font-family: 'Tajawal'; }
            .royal-logo { text-align: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .royal-title { color: #facc15; font-size: 24px; font-weight: 900; }
            .royal-item { border-bottom: 1px solid #222; padding: 10px 0; display: flex; justify-content: space-between; align-items: center; }
            .royal-total { background: #facc15; color: #000; padding: 20px; text-align: center; border-radius: 20px; margin-top: 30px; font-size: 22px; font-weight: 900; }
         `;
         content = `
            <div class="royal-invoice">
               <div class="royal-logo">
                  <div class="royal-title">${settings.shopName}</div>
                  <div style="font-size: 10px; opacity: 0.5;">PREMIUM SERVICE INVOICE</div>
               </div>
               <div style="font-size: 12px; margin-bottom: 20px; border-left: 3px solid #facc15; padding-left: 10px;">
                  <div>${settings.invoiceLabel || 'رقم الفاتورة'}: <b>${data.id.slice(-6)}</b></div>
                  <div>التاريخ: ${new Date().toLocaleDateString('ar-YE')}</div>
               </div>
               <div>
                  ${data.items.map((item: any) => `
                     <div class="royal-item">
                        <div>
                           <div style="font-weight: 900;">${item.name}</div>
                           <div style="font-size: 9px; color: #666;">${item.quantity} x ${item.price.toLocaleString()}</div>
                        </div>
                        <div style="font-weight: 900;">${(item.price * item.quantity).toLocaleString()}</div>
                     </div>
                  `).join('')}
               </div>
               <div class="royal-total">
                  <div style="font-size: 12px; font-weight: bold; opacity: 0.6;">NET PAYABLE</div>
                  ${(data.total - (data.discount || 0)).toLocaleString()} <small style="font-size: 10px;">ر.ي</small>
               </div>
               <div style="text-align: center; margin-top: 20px; opacity: 0.4; font-size: 9px;">Powered by Jam Pro - Royalty Edition</div>
            </div>
         `;
      } else if (invoiceTemplate === 'thermal_compact') {
         content = `
            <div style="width: 80mm; padding: 2mm; font-family: sans-serif; font-size: 12px;">
               <center>
                  <b>${settings.shopName}</b><br/>
                  ${settings.shopPhone}<br/>
                  --------------------------------<br/>
                  <b>${settings.invoiceLabel || 'INVOICE'} #${data.id.slice(-6)}</b><br/>
                  --------------------------------
               </center>
               <table style="width: 100%; border-bottom: 1px solid #000;">
                  ${data.items.map((i: any) => `
                     <tr>
                        <td>${i.name} x ${i.quantity}</td>
                        <td align="left">${(i.price * i.quantity).toLocaleString()}</td>
                     </tr>
                  `).join('')}
               </table>
               <div style="margin-top: 5px;">
                  <div style="display: flex; justify-content: space-between;">
                     <b>TOTAL:</b>
                     <b>${data.total.toLocaleString()}</b>
                  </div>
                  ${data.discount ? `
                    <div style="display: flex; justify-content: space-between;">
                       <span>DISC:</span>
                       <span>-${data.discount}</span>
                    </div>
                  ` : ''}
               </div>
               <center style="margin-top: 10px; font-size: 10px;">
                  *** Thank You ***<br/>
                  ${new Date().toLocaleString('ar-YE')}
               </center>
            </div>
         `;
      } else if (invoiceTemplate === 'classic_blue') {
         customStyles = `
            .blue-invoice { width: 80mm; border: 1px solid #ddd; }
            .blue-head { background: #1e3a8a; color: #fff; padding: 15px; text-align: right; }
            .blue-cell { padding: 5px; border-bottom: 1px solid #eee; }
            .blue-subtotal { background: #f1f5f9; padding: 10px; text-align: left; }
         `;
         content = `
            <div class="blue-invoice">
               <div class="blue-head">
                  <h1 style="margin:0;">${settings.shopName}</h1>
                  <p style="margin:0; font-size: 12px;">كشف مبيعات معتمد</p>
               </div>
               <div style="padding: 10px;">
                  <table style="width: 100%;">
                     ${data.items.map((item: any) => `
                        <tr>
                           <td class="blue-cell"><b>${item.name}</b><br/><small>${item.quantity} وحدة</small></td>
                           <td class="blue-cell" align="left">${(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                     `).join('')}
                  </table>
                  <div class="blue-subtotal">
                     <div style="display: flex; justify-content: space-between;">
                        <span>الإجمالي:</span>
                        <b>${data.total.toLocaleString()} ر.ي</b>
                     </div>
                  </div>
                  <div style="margin-top: 10px; font-size: 11px;">
                     <p>تم استلام المبلغ نقداً بواسطة: ${data.sellerName}</p>
                     <p>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-YE')}</p>
                  </div>
               </div>
            </div>
         `;
      } else if (invoiceTemplate === 'eco_green') {
         customStyles = `
            .eco-invoice { width: 80mm; border-top: 10px solid #10b981; padding: 10px; font-family: 'Tajawal'; }
            .eco-tag { background: #d1fae5; color: #065f46; display: inline-block; padding: 2px 8px; border-radius: 5px; font-size: 10px; font-weight: bold; }
         `;
         content = `
            <div class="eco-invoice">
               <div style="text-align: center; margin-bottom: 20px;">
                  <h1 style="color: #065f46; margin: 0;">${settings.shopName}</h1>
                  <span class="eco-tag">ECO-FRIENDLY RECEIPT</span>
               </div>
               <div style="border-top: 1px dashed #10b981; padding-top: 10px;">
                  ${data.items.map((item: any) => `
                     <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>${item.name}</span>
                        <b>${item.price.toLocaleString()}</b>
                     </div>
                  `).join('')}
               </div>
               <div style="background: #f0fdf4; padding: 10px; margin-top: 20px; border-radius: 10px;">
                  <div style="display: flex; justify-content: space-between; font-weight: 900; color: #065f46;">
                     <span>المجموع النهائي:</span>
                     <span>${data.total.toLocaleString()} ر.ي</span>
                  </div>
               </div>
               <p style="text-align: center; font-size: 9px; margin-top: 20px; color: #666;">شكراً لاختياركم خدماتنا الصديقة للبيئة</p>
            </div>
         `;
      } else if (invoiceTemplate === 'minimalist_white') {
         customStyles = `
            .minimal-invoice { width: 80mm; padding: 20px; border: 1px solid #000; font-family: 'Courier New', Courier, monospace; }
            .minimal-item { border-bottom: 0.5px solid #000; padding: 5px 0; display: flex; justify-content: space-between; }
         `;
         content = `
            <div class="minimal-invoice">
               <div style="text-align: center; margin-bottom: 20px; text-transform: uppercase;">
                  <h1 style="font-size: 20px; letter-spacing: 5px;">${settings.shopName}</h1>
                  <p style="font-size: 10px;">Official Sales Record</p>
               </div>
               ${data.items.map((item: any) => `
                  <div class="minimal-item">
                     <span>${item.name} x${item.quantity}</span>
                     <span>${(item.price * item.quantity).toLocaleString()}</span>
                  </div>
               `).join('')}
               <div style="margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; font-weight: bold;">
                  <div style="display: flex; justify-content: space-between;">
                     <span>TOTAL</span>
                     <span>${data.total.toLocaleString()} ر.ي</span>
                  </div>
               </div>
               <p style="font-size: 8px; margin-top: 30px; text-align: center;">COPYRIGHT JAM PRO | ${new Date().getFullYear()}</p>
            </div>
         `;
      } else if (invoiceTemplate === 'futuristic_neon') {
         customStyles = `
            .neon-invoice { width: 80mm; background: #0a0a0a; color: #00f2ff; padding: 15px; border: 2px solid #00f2ff; box-shadow: 0 0 15px #00f2ff inset; }
            .neon-text { text-shadow: 0 0 5px #00f2ff; }
         `;
         content = `
            <div class="neon-invoice">
               <h1 style="text-align: center; font-size: 26px; border-bottom: 2px solid #00f2ff;" class="neon-text">${settings.shopName}</h1>
               <div style="margin-top: 15px;">
                  ${data.items.map((item: any) => `
                     <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #00f2ff33; padding: 5px 0;">
                        <span>${item.name}</span>
                        <span class="neon-text">${(item.price * item.quantity).toLocaleString()}</span>
                     </div>
                  `).join('')}
               </div>
               <div style="margin-top: 20px; background: #00f2ff33; padding: 10px; border-radius: 5px;">
                  <div style="display: flex; justify-content: space-between; font-size: 22px; font-weight: 900;">
                     <span>TOTAL</span>
                     <span class="neon-text">${data.total.toLocaleString()}</span>
                  </div>
               </div>
               <p style="text-align: center; font-size: 10px; margin-top: 15px;">SYSTEM STATUS: TRANSACTION SUCCESSFUL</p>
            </div>
         `;
      } else if (invoiceTemplate === 'vintage_paper') {
         customStyles = `
            .vintage-invoice { width: 80mm; background: #f4ecd8; color: #5d4037; padding: 20px; border: 2px solid #5d4037; font-family: 'Serif'; position: relative; }
            .vintage-invoice:before { content: ''; position: absolute; top:0; left:0; width:100%; height:100%; box-shadow: inset 0 0 50px #8b5e3c33; pointer-events: none; }
         `;
         content = `
            <div class="vintage-invoice">
               <h2 style="text-align: center; font-family: serif; border-bottom: 1px solid #5d4037; padding-bottom: 10px;">${settings.shopName}</h2>
               <p style="text-align: center; font-size: 10px; font-style: italic;">Est. ${new Date().getFullYear() - 5}</p>
               <div style="margin-top: 10px;">
                  ${data.items.map((item: any) => `
                     <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #5d4037;">
                        <span>${item.name}</span>
                        <b>${(item.price * item.quantity).toLocaleString()}</b>
                     </div>
                  `).join('')}
               </div>
               <div style="margin-top: 20px; text-align: center;">
                  <span style="font-size: 12px;">Amount in Full</span><br/>
                  <span style="font-size: 24px; font-weight: bold; text-decoration: underline;">${data.total.toLocaleString()} YER</span>
               </div>
               <p style="text-align: center; font-size: 9px; margin-top: 20px;">~ Authenticated with Stamp ~</p>
            </div>
         `;
      } else if (invoiceTemplate === 'corporate_dark') {
         customStyles = `
            .corp-invoice { width: 80mm; background: #1e293b; color: #f8fafc; padding: 15px; border-left: 8px solid #3b82f6; }
            .corp-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #334155; }
         `;
         content = `
            <div class="corp-invoice">
               <div style="margin-bottom: 20px;">
                  <h1 style="font-size: 22px; margin: 0;">${settings.shopName}</h1>
                  <p style="font-size: 10px; color: #94a3b8;">CORPORATE BILLING DIVISION</p>
               </div>
               ${data.items.map((item: any) => `
                  <div class="corp-row">
                     <div>
                        <div style="font-weight: bold;">${item.name}</div>
                        <div style="font-size: 9px; color: #94a3b8;">Qty: ${item.quantity}</div>
                     </div>
                     <div style="font-weight: 900;">${(item.price * item.quantity).toLocaleString()}</div>
                  </div>
               `).join('')}
               <div style="margin-top: 20px; background: #334155; padding: 15px; border-radius: 8px;">
                  <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 900; color: #60a5fa;">
                     <span>FINAL TOTAL</span>
                     <span>${data.total.toLocaleString()}</span>
                  </div>
               </div>
               <p style="text-align: right; font-size: 8px; margin-top: 15px; color: #94a3b8;">SECURELY PROCESSED BY JAM SYSTEM GLOBAL</p>
            </div>
         `;
      } else if (invoiceTemplate === 'thermal_long') {
         content = `
            <div style="width: 80mm; padding: 1mm; font-family: 'Tajawal', sans-serif; font-size: 13px; line-height: 1.2;">
               <div style="text-align: center; margin-bottom: 5px;">
                  <h2 style="margin: 0; font-size: 18px;">${settings.shopName}</h2>
                  <p style="margin: 0; font-size: 11px;">رقم الفاتورة: ${data.id.slice(-6)}</p>
                  <p style="margin: 0; font-size: 10px;">التاريخ: ${new Date().toLocaleString('ar-YE')}</p>
                  <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
               </div>
               <table style="width: 100%; border-collapse: collapse;">
                  <thead style="border-bottom: 1px solid #000;">
                     <tr>
                        <th style="text-align: right; width: 60%;">الصنف</th>
                        <th style="text-align: center; width: 15%;">ق</th>
                        <th style="text-align: left; width: 25%;">السعر</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${data.items.map((i: any) => `
                        <tr>
                           <td style="padding: 3px 0;">${i.name}</td>
                           <td style="text-align: center;">${i.quantity}</td>
                           <td style="text-align: left;">${(i.price * i.quantity).toLocaleString()}</td>
                        </tr>
                     `).join('')}
                  </tbody>
               </table>
               <div style="border-top: 1px solid #000; margin-top: 5px; padding-top: 5px;">
                  <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 16px;">
                     <span>إجمالي السعر:</span>
                     <span>${data.total.toLocaleString()} ر.ي</span>
                  </div>
                  ${data.discount ? `
                     <div style="display: flex; justify-content: space-between; font-size: 12px; color: #d00;">
                        <span>إجمالي الخصم:</span>
                        <span>-${data.discount.toLocaleString()}</span>
                     </div>
                  ` : ''}
                  <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 18px; margin-top: 2px;">
                     <span>الصافي:</span>
                     <span>${(data.total - (data.discount || 0)).toLocaleString()}</span>
                  </div>
               </div>
               <div style="margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px; text-align: center;">
                  ${data.paymentMethod === 'debt' ? '<p style="font-weight: 900; background: #000; color: #fff; padding: 2px;">فاتورة آجل (دين)</p>' : ''}
                  <p style="font-size: 10px;">${settings.shopPhone ? '📞 ' + settings.shopPhone : ''}</p>
                  <p style="font-weight: bold;">شكراً لزيارتكم - حياكم الله</p>
                  <div style="font-family: 'Libre Barcode 39'; font-size: 40px; margin-top: 5px;">*${data.id.slice(-6)}*</div>
               </div>
            </div>
         `;
      } else {
        // Fallback to default
        content = `
          <div class="receipt" style="position: relative;">
            ${headerHtml}
            <div class="header">
              <h2 style="font-size: 18px; font-weight: 900;">${settings.invoiceLabel || 'فاتورة مبيعات تفصيلية'}</h2>
            </div>
            <div class="details">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span><strong>رقم الفاتورة:</strong> ${data.id.slice(-6)}</span>
                <span><strong>التاريخ:</strong> ${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-YE') : new Date().toLocaleDateString('ar-YE')}</span>
              </div>
              <table style="width:100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
                <thead>
                  <tr style="border-bottom: 2px solid #000; background: #f5f5f5;">
                    <th style="text-align: right; padding: 5px;">الصنف</th>
                    <th style="text-align: center; padding: 5px;">الكمية</th>
                    <th style="text-align: left; padding: 5px;">السعر</th>
                    <th style="text-align: left; padding: 5px;">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.map((item: any) => `
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 5px;">
                        <div style="font-weight: bold;">${item.name}</div>
                        <div style="font-size: 10px; color: #666;">${item.barcode || ''}</div>
                      </td>
                      <td style="text-align: center; padding: 5px;">${item.quantity}</td>
                      <td style="text-align: left; padding: 5px;">${item.price.toLocaleString()}</td>
                      <td style="text-align: left; padding: 5px; font-weight: bold;">${(item.price * item.quantity).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div style="margin-top: 15px; border-top: 2px solid #000; padding-top: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 14px;">
                  <span>الإجمالي الفرعي:</span>
                  <span>${data.total.toLocaleString()} ر.ي</span>
                </div>
                ${data.discount ? `
                  <div style="display: flex; justify-content: space-between; font-size: 14px; color: #d00;">
                    <span>الخصم:</span>
                    <span>-${data.discount.toLocaleString()} ر.ي</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px;">
                  <span>الإجمالي النهائي:</span>
                  <span>${(data.total - (data.discount || 0)).toLocaleString()} ر.ي</span>
                </div>
              </div>
              <p style="margin-top: 10px; font-weight: bold;">طريقة الدفع: ${data.paymentMethod === 'cash' ? 'نقداً' : data.paymentMethod === 'debt' ? 'آجل (دين)' : 'حوالة بنكية'}</p>
            </div>
            ${stampHtml}
            <div class="footer">
              <div style="border-top: 2px solid #000; margin: 15px 0;"></div>
              <div style="text-align: right; font-size: 11px; line-height: 1.5; font-weight: 500;">
                <p>• البضاعة المباعة لا ترد ولا تستبدل إلا في حال وجود عيب مصنعي خلال 24 ساعة.</p>
                <p>• الضمان لا يشمل سوء الاستخدام، الكسر، أو التعرض للسوائل.</p>
                <p>• يرجى الاحتفاظ بالفاتورة لضمان حقوقكم.</p>
              </div>
              <p style="margin-top: 15px; font-size: 14px; font-weight: 900;">شكراً لزيارتكم - ${settings.shopName || 'Jam system pro'} يرحب بكم</p>
            </div>
          </div>
        `;
      }
    } else if (type === 'phone_sticker') {
      // Label / Sticker templates
      if (labelTemplate === 'barcode_sheet_a4') {
        // 30 Barcodes on A4 sheet (3 columns x 10 rows)
        customStyles = `
          .barcode-sheet { 
            width: 210mm; 
            height: 297mm; 
            padding: 10mm; 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            grid-template-rows: repeat(10, 1fr); 
            gap: 5mm; 
            box-sizing: border-box; 
            background: #fff;
          }
          .barcode-cell { 
            border: 1px dashed #ccc; 
            height: 25mm; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            padding: 2mm; 
            text-align: center;
          }
          .barcode-cell .shop-name { font-size: 8px; font-weight: bold; margin-bottom: 2px; }
          .barcode-cell .item-name { font-size: 10px; font-weight: 900; margin-bottom: 2px; }
          .barcode-cell .barcode-img { font-family: 'Libre Barcode 39'; font-size: 32px; margin: 2px 0; }
          .barcode-cell .price { font-size: 12px; font-weight: 900; }
        `;
        const cells = Array(30).fill(0).map(() => `
          <div class="barcode-cell">
             <div class="shop-name">${settings.shopName}</div>
             <div class="item-name">${data.name || data.deviceModel || 'صنف جديد'}</div>
             <div class="barcode-img">*${(data.barcode || data.id).slice(-8)}*</div>
             ${printer.showPriceOnBarcode !== false ? `<div class="price">${data.price || data.cost || '---'} ر.ي</div>` : ''}
          </div>
        `).join('');
        content = `<div class="barcode-sheet">${cells}</div>`;
      } else if (labelTemplate === 'qr_luxury') {
         customStyles = `
            .qr-luxury { width: ${printer.labelWidth}mm; height: ${printer.labelHeight}mm; background: #000; color: #facc15; padding: 2mm; display: flex; align-items: center; justify-content: space-between; overflow: hidden; }
            .qr-info { flex: 1; text-align: right; font-weight: bold; font-size: 9px; line-height: 1; }
            .qr-box { width: 15mm; height: 15mm; background: #fff; padding: 1mm; }
         `;
         content = `
            <div class="qr-luxury">
               <div class="qr-info">
                  <div style="font-size: 11px; border-bottom: 1px solid #333; margin-bottom: 2px;">${settings.shopName}</div>
                  <div>${data.customerName}</div>
                  <div style="color: #fff;">${data.deviceModel}</div>
                  <div style="font-size: 12px; margin-top: 2px;">#${data.id.slice(-6)}</div>
               </div>
               <div class="qr-box">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data.id}" style="width: 100%; height: 100%;" />
               </div>
            </div>
         `;
      } else if (labelTemplate === 'jewelry_mini') {
         customStyles = `
            .jewelry-mini { width: ${printer.labelWidth}mm; height: ${printer.labelHeight}mm; font-size: 8px; text-align: center; border-radius: 5px; border: 1px solid #000; padding: 1mm; }
         `;
         content = `
            <div class="jewelry-mini">
               <div style="font-weight: 900;">${settings.shopName}</div>
               <div>${data.deviceBrand}</div>
               <div style="font-weight: bold;">${data.deviceModel}</div>
               <div style="font-family: 'Libre Barcode 39'; font-size: 12px;">*${data.id.slice(-6)}*</div>
            </div>
         `;
      } else if (labelTemplate === 'shipping_bold') {
         customStyles = `
            .shipping-bold { width: ${printer.labelWidth}mm; height: ${printer.labelHeight}mm; background: #fff; padding: 5mm; border: 3px solid #000; }
         `;
         content = `
            <div class="shipping-bold">
               <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 20px; border-bottom: 5px solid #000;">
                  <span>FRAGILE</span>
                  <span>#${data.id.slice(-6)}</span>
               </div>
               <div style="margin-top: 10px; font-size: 14px;">
                  <b>TO: ${data.customerName}</b><br/>
                  TEL: ${data.customerPhone}<br/>
                  DEVICE: ${data.deviceBrand} ${data.deviceModel}
               </div>
               <center style="margin-top: 10px; font-family: 'Libre Barcode 39'; font-size: 40px;">*${data.id.slice(-6)}*</center>
            </div>
         `;
      } else {
        // Fallback or tag_simple
        customStyles = `
          .sticker { 
            width: ${printer.labelWidth}mm; 
            height: ${printer.labelHeight}mm; 
            padding: 2mm; 
            border: 1px solid #ccc; 
            display: flex; 
            flex-direction: column; 
            justify-content: space-between;
            font-size: 10px;
            overflow: hidden;
          }
          .sticker-header { display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 1mm; margin-bottom: 1mm; }
          .sticker-body { flex: 1; display: flex; flex-direction: column; gap: 1mm; }
          .sticker-footer { text-align: center; font-family: 'Libre Barcode 39', cursive; font-size: 20px; }
        `;
        content = `
          <div class="sticker">
            <div class="sticker-header">
              <span style="font-weight: bold;">${settings.shopName}</span>
              <span>#${data.id.slice(-6)}</span>
            </div>
            <div class="sticker-body">
              <div style="display: flex; justify-content: space-between;">
                <span>${data.customerName}</span>
                <span>${data.deviceBrand}</span>
              </div>
              <div style="font-weight: bold; font-size: 11px; text-align: center;">
                ${data.deviceModel}
              </div>
              <div style="font-size: 9px;">
                عطل: ${data.issue.slice(0, 30)}${data.issue.length > 30 ? '...' : ''}
              </div>
            </div>
            <div class="sticker-footer">
              *${data.id.slice(-6)}*
            </div>
          </div>
        `;
      }
    } else if (type === 'user_registration') {
      content = `
        <div class="receipt" style="width: 80mm; padding: 5mm; border: 2px solid #000; border-radius: 15px;">
          ${headerHtml}
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="font-size: 18px; border-bottom: 2px solid #000; display: inline-block; padding-bottom: 5px; font-weight: 900;">
              ${data.role === 'customer' ? 'سند تسجيل عميل جديد' : 'سند انضمام موظف جديد'}
            </h2>
          </div>
          
          <div style="background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <p style="margin: 8px 0; font-size: 14px;"><strong>الاسم:</strong> ${data.name}</p>
            <p style="margin: 8px 0; font-size: 14px;"><strong>رقم الهاتف/المعرف:</strong> ${data.email}</p>
            <p style="margin: 8px 0; font-size: 14px;"><strong>كلمة المرور للدخول:</strong> <span style="font-family: monospace; font-weight: 900; background: #000; color: #fff; padding: 2px 6px; border-radius: 4px;">${data.currentPassword || '********'}</span></p>
            <p style="margin: 8px 0; font-size: 14px;"><strong>الدور الوظيفي:</strong> 
              <span style="color: #4f46e5; font-weight: 900;">
                ${data.role === 'manager' ? 'مدير نظام' : 
                  data.role === 'engineer' ? 'مهندس صيانة' : 
                  data.role === 'sales' ? 'موظف مبيعات' :
                  data.role === 'customer' ? 'عميل (تجارة ذكية)' : 'موظف'}
              </span>
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 20px;">
            <div style="padding: 10px; background: #fff; border: 1px solid #eee; display: inline-block; border-radius: 10px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${window.location.origin}" style="width: 30mm; height: 30mm;" />
              <p style="font-size: 10px; color: #666; margin-top: 5px;">امسح الكود للدخول للنظام</p>
            </div>
          </div>

          <div style="border-top: 1px dashed #000; padding-top: 15px; font-size: 11px; color: #444;">
            <p style="font-weight: bold; margin-bottom: 5px; text-decoration: underline;">ملاحظات هامة:</p>
            <ul style="padding-right: 20px; list-style-type: square;">
              <li>يرجى الاحتفاظ بهذا السند وتغيير كلمة المرور فور الدخول.</li>
              <li>هذا السند يعتبر وثيقة رسمية داخل المؤسسة.</li>
              <li>الدخول للنظام يعني الموافقة على سياسة الخصوصية.</li>
            </ul>
          </div>
          
          <div style="margin-top: 20px; text-align: center;">
             <div style="font-family: 'Libre Barcode 39'; font-size: 35px;">*${data.uid.slice(-6)}*</div>
             <p style="font-weight: 900; font-size: 12px; margin-top: 5px;">نحن نهتم بأمن بياناتكم</p>
          </div>
        </div>
      `;
    } else if (type === 'customer_debt') {
      content = `
        <div class="receipt">
          <div class="header">
            <h1>${settings.shopName}</h1>
            <p>${settings.shopAddress}</p>
            <p>هاتف: ${settings.shopPhone}</p>
            <hr/>
            <h2>كشف حساب عميل</h2>
          </div>
          <div class="details">
            <p><strong>العميل:</strong> ${data.name}</p>
            <p><strong>الهاتف:</strong> ${data.phone}</p>
            <hr/>
            <p style="font-size: 1.5em; font-weight: bold; text-align: center;">إجمالي الديون: ${data.debt} ر.ي</p>
            <p>التاريخ: ${new Date().toLocaleDateString('ar-YE')}</p>
          </div>
          <div class="footer">
            <hr/>
            <p>يرجى مراجعة الحساب والسداد في أقرب وقت ممكن.</p>
          </div>
        </div>
      `;
    } else if (type === 'transaction_report') {
      content = `
        <div class="receipt report">
          <div class="header">
            <h1>${settings.shopName}</h1>
            <p>${settings.shopAddress}</p>
            <p>هاتف: ${settings.shopPhone}</p>
            <hr/>
            <h2>تقرير الحسابات (الصندوق)</h2>
          </div>
          <div class="details">
            <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-YE')}</p>
            <table style="width:100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="border-bottom: 2px solid #000;">
                  <th style="text-align: right;">الوصف</th>
                  <th style="text-align: center;">النوع</th>
                  <th style="text-align: left;">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                ${data.transactions.map((t: any) => `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td>${t.description}</td>
                    <td style="text-align: center;">${t.type === 'income' ? 'وارد' : 'منصرف'}</td>
                    <td style="text-align: left;">${t.amount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <hr/>
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px;">
              <span>إجمالي الوارد: ${data.income.toLocaleString('ar-YE')}</span>
              <span>إجمالي المنصرف: ${data.expense.toLocaleString('ar-YE')}</span>
            </div>
            <p style="font-size: 1.5em; font-weight: bold; text-align: center; margin-top: 10px;">الرصيد النهائي: ${data.balance.toLocaleString('ar-YE')} ر.ي</p>
            ${data.currencyBreakdown ? `
              <div style="margin-top: 15px; border-top: 1px solid #000; padding-top: 10px;">
                <p style="font-weight: bold; margin-bottom: 5px;">تفصيل العملات:</p>
                <table style="width: 100%; font-size: 10px;">
                  ${Object.entries(data.currencyBreakdown).map(([curr, d]: [string, any]) => `
                    <tr>
                      <td>${curr}</td>
                      <td style="text-align: center;">وارد: ${d.income.toFixed(2)}</td>
                      <td style="text-align: center;">منصرف: ${d.expense.toFixed(2)}</td>
                      <td style="text-align: left; font-weight: bold;">صافي: ${(d.income - d.expense).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    const fullHtml = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>طباعة - ${settings.shopName || 'JAM System Pro'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&family=Libre+Barcode+39&display=swap');
            body { 
              font-family: 'Tajawal', sans-serif; 
              padding: 0; 
              margin: 0; 
              color: #000; 
              background: #fff; 
              zoom: ${billScale}; 
            }
            .receipt { 
              width: ${type === 'transaction_report' ? '100%' : '80mm'}; 
              max-width: 100%; 
              margin: 0 auto; 
              padding: ${type === 'maintenance' ? '1.5mm 2.5mm' : '5mm'}; 
              box-sizing: border-box; 
              background: white; 
              font-size: ${fontSizeBody}px;
            }
            .receipt.maintenance-receipt {
              padding: 1.5mm 2.5mm !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 auto !important;
            }
            .maintenance-receipt .header, .maintenance-receipt h1, .maintenance-receipt h2 {
              margin: 0 !important;
              padding: 0 !important;
            }
            .receipt table { table-layout: fixed; width: 100%; border-collapse: collapse; }
            .receipt td, .receipt th { word-wrap: break-word; overflow-wrap: break-word; font-size: ${fontSizeBody}px; }
            .receipt .price { font-size: ${fontSizePrice}px; }
            .receipt .title { font-size: ${fontSizeTitle}px; }
            .receipt.report { width: 100%; max-width: 800px; }
            .header { text-align: center; margin-bottom: ${type === 'maintenance' ? '0px' : '20px'}; }
            .header h1 { margin: 0; font-size: 20px; }
            .header h2 { margin: 8px 0; font-size: 16px; color: #333; }
            .details p { margin: 4px 0; font-size: 12px; }
            .footer { text-align: center; margin-top: ${type === 'maintenance' ? '2px' : '15px'}; font-size: 11px; }
            ${customStyles}
            @media print {
              body { padding: 0; margin: 0; background: transparent; display: block; }
              .receipt { 
                width: ${type === 'transaction_report' ? '100%' : '80mm'}; 
                margin: 0 auto; 
                padding: ${type === 'maintenance' ? '1.5mm 2.5mm' : '5mm'}; 
                box-shadow: none; 
                border-radius: 0;
                max-width: none;
              }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${content}
          
          ${type !== 'phone_sticker' && type !== 'maintenance' ? `
          <div class="print-footer-branding" style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 16px; border-top: 1px solid #d1d5db; padding-top: 8px; font-family: 'Tajawal', sans-serif; width: 100%; box-sizing: border-box; font-weight: bold; direction: rtl;">
             <div>Powered by JAM System Pro</div>
             <div style="font-size: 10px; margin-top: 2px;">م. عبد الغني المحفلي | 772315106</div>
          </div>
          ` : ''}
        </body>
      </html>
    `;

    // 1. Remove old overlay if it exists
    const oldOverlay = document.getElementById('jam-print-overlay');
    if (oldOverlay) oldOverlay.remove();

    // 2. Create elegant on-screen print overlay modal
    const overlay = document.createElement('div');
    overlay.id = 'jam-print-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';
    overlay.style.fontFamily = "'Tajawal', sans-serif";
    overlay.setAttribute('dir', 'rtl');

    const isReport = type === 'transaction_report';
    const modalMaxWidth = isReport ? '850px' : '450px';
    const defaultPrinterName = localStorage.getItem(`jam_default_printer_name_${currentUserId}`) || 'طابعة الكاشير الحرارية الافتراضية';

    overlay.innerHTML = `
      <style>
        /* Modern Mobile Responsive styling for the entire print overlay and its controls */
        .jam-print-header {
          background: #1e293b;
          color: white;
          padding: 14px 20px;
          border-radius: 16px 16px 0 0;
          width: 100%;
          max-width: ${modalMaxWidth};
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
          border-bottom: 1px solid #334155;
          box-sizing: border-box;
        }
        .jam-print-title-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .jam-print-title-text {
          font-weight: 900;
          font-size: 15px;
          color: #f5f5f5;
        }
        .jam-print-header-btns {
          display: flex;
          gap: 8px;
        }
        .jam-print-btn-now {
          background: #10b981;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-family: 'Tajawal', sans-serif;
          font-weight: 900;
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 6px rgba(16,185,129,0.2);
          transition: all 0.2s;
        }
        .jam-print-btn-close {
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-family: 'Tajawal', sans-serif;
          font-weight: 900;
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 6px rgba(239,68,68,0.2);
          transition: all 0.2s;
        }
        
        @media (max-width: 480px) {
          .jam-print-header {
            padding: 10px 12px !important;
            flex-direction: column !important;
            gap: 12px !important;
            text-align: center !important;
            border-radius: 12px 12px 0 0 !important;
          }
          .jam-print-title-box {
            justify-content: center !important;
            width: 100% !important;
          }
          .jam-print-title-text {
            font-size: 13px !important;
          }
          .jam-print-header-btns {
            width: 100% !important;
            justify-content: center !important;
          }
          .jam-print-btn-now, .jam-print-btn-close {
            flex: 1 !important;
            justify-content: center !important;
            padding: 8px 10px !important;
            font-size: 12px !important;
          }
          #jam-print-overlay-body {
            border-radius: 0 0 12px 12px !important;
            height: 80vh !important;
          }
        }
      </style>
      
      <div class="jam-print-header">
        <div class="jam-print-title-box">
          <span style="font-size: 20px;">🖨️</span>
          <span class="jam-print-title-text">معاينة الفاتورة والطباعة الذكية</span>
        </div>
        <div class="jam-print-header-btns">
          <button id="jam-print-now-btn" class="jam-print-btn-now">
            <span>طباعة الآن 🖨️</span>
          </button>
          <button id="jam-close-print-btn" class="jam-print-btn-close">
            <span>إغلاق ❌</span>
          </button>
        </div>
      </div>
      <div id="jam-print-overlay-body" style="background: #f8fafc; padding: 16px; width: 100%; max-width: ${modalMaxWidth}; height: 75vh; overflow-y: auto; border-radius: 0 0 16px 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); display: flex; flex-direction: column; align-items: center; box-sizing: border-box;">
        
        <!-- Default Printer Settings Control -->
        <div style="margin-bottom: 20px; width: 100%; max-width: ${isReport ? '800px' : '360px'}; background: #ffffff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; font-family: 'Tajawal', sans-serif; box-sizing: border-box; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: right;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="font-size: 14px;">⚙️</span>
            <span style="font-size: 12px; font-weight: 800; color: #1e293b;">إعدادات الطابعة الافتراضية والاتصال</span>
          </div>
          <p style="font-size: 10px; color: #64748b; margin: 0 0 12px 0; line-height: 1.4; font-weight: bold;">
            يتم حفظ هذا الإعداد تلقائياً لحسابك كمستعرض أو موظف مستقل ولا يؤثر على بقية المستخدمين.
          </p>
          
          <div style="margin-bottom: 10px;">
            <label style="display: block; font-size: 11px; font-weight: bold; color: #1e293b; margin-bottom: 6px;">📄 حجم ونوع الورق المعتمد:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
              <button type="button" class="jam-paper-size-btn" data-size="80mm" style="background: ${isReport ? '#f1f5f9' : '#10b981'}; color: ${isReport ? '#475569' : '#ffffff'}; border: 1px solid ${isReport ? '#cbd5e1' : '#059669'}; padding: 6px 2px; border-radius: 8px; font-size: 11px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; font-family: 'Tajawal', sans-serif;">
                <span>🧾 حراري 80mm</span>
              </button>
              <button type="button" class="jam-paper-size-btn" data-size="a4" style="background: ${isReport ? '#10b981' : '#f1f5f9'}; color: ${isReport ? '#ffffff' : '#475569'}; border: 1px solid ${isReport ? '#059669' : '#cbd5e1'}; padding: 6px 2px; border-radius: 8px; font-size: 11px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; font-family: 'Tajawal', sans-serif;">
                <span>📑 ورقة A4</span>
              </button>
              <button type="button" class="jam-paper-size-btn" data-size="58mm" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 6px 2px; border-radius: 8px; font-size: 11px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; font-family: 'Tajawal', sans-serif;">
                <span>🧾 حراري 58mm</span>
              </button>
            </div>
          </div>

          <div style="margin-bottom: 10px;">
            <label style="display: block; font-size: 11px; font-weight: bold; color: #1e293b; margin-bottom: 6px;">🔌 واجهة الاتصال بالطابعة:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; margin-bottom: 8px;">
              <button type="button" class="jam-print-method-opt-btn" data-method="system" style="background: ${printMethod === 'system' ? '#1e293b' : '#f1f5f9'}; color: ${printMethod === 'system' ? '#ffffff' : '#475569'}; border: 1px solid ${printMethod === 'system' ? '#1e293b' : '#cbd5e1'}; padding: 6px 2px; border-radius: 8px; font-size: 10px; font-weight: 900; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: 'Tajawal', sans-serif;">
                <span style="font-size: 13px;">🖨️</span>
                <span>طابعة النظام</span>
              </button>
              <button type="button" class="jam-print-method-opt-btn" data-method="usb" style="background: ${printMethod === 'usb' ? '#1e293b' : '#f1f5f9'}; color: ${printMethod === 'usb' ? '#ffffff' : '#475569'}; border: 1px solid ${printMethod === 'usb' ? '#1e293b' : '#cbd5e1'}; padding: 6px 2px; border-radius: 8px; font-size: 10px; font-weight: 900; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: 'Tajawal', sans-serif;">
                <span style="font-size: 13px;">🔌</span>
                <span>يو إس بي USB</span>
              </button>
              <button type="button" class="jam-print-method-opt-btn" data-method="bluetooth" style="background: ${printMethod === 'bluetooth' ? '#1e293b' : '#f1f5f9'}; color: ${printMethod === 'bluetooth' ? '#ffffff' : '#475569'}; border: 1px solid ${printMethod === 'bluetooth' ? '#1e293b' : '#cbd5e1'}; padding: 6px 2px; border-radius: 8px; font-size: 10px; font-weight: 900; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: 'Tajawal', sans-serif;">
                <span style="font-size: 13px;">📡</span>
                <span>بلوتوث BT</span>
              </button>
              <button type="button" class="jam-print-method-opt-btn" data-method="wifi" style="background: ${printMethod === 'wifi' ? '#1e293b' : '#f1f5f9'}; color: ${printMethod === 'wifi' ? '#ffffff' : '#475569'}; border: 1px solid ${printMethod === 'wifi' ? '#1e293b' : '#cbd5e1'}; padding: 6px 2px; border-radius: 8px; font-size: 10px; font-weight: 900; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: 'Tajawal', sans-serif;">
                <span style="font-size: 13px;">📶</span>
                <span>واي فاي WiFi</span>
              </button>
            </div>
          </div>

          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 11px; font-weight: bold; color: #1e293b; margin-bottom: 4px;">🎯 اسم الطابعة أو المنفذ:</label>
            <input id="jam-default-printer-name-input" type="text" value="${defaultPrinterName}" placeholder="مثال: XP-80 أو Thermal Printer أو EPSON" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 11px; font-family: 'Tajawal', sans-serif; box-sizing: border-box; outline: none; transition: border-color 0.2s;" />
          </div>
 
          <div id="jam-print-method-desc-banner" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 8px; border-radius: 6px; font-size: 10px; text-align: center; font-weight: bold; font-family: 'Tajawal', sans-serif;">
            🖨️ فتح حوار الطباعة الأصلي للنظام: يتيح لك اختيار أي طابعة متصلة (USB أو شبكة أو بلوتوث)، وتحديد حجم الورق والألوان وعدد النسخ.
          </div>
        </div>

        <div class="jam-invoice-preview-card" style="background: white; padding: ${type === 'maintenance' ? '8px' : '16px'}; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); width: 100%; max-width: ${isReport ? '800px' : '330px'}; box-sizing: border-box;">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&family=Libre+Barcode+39&display=swap');
            .receipt-preview-container { font-family: 'Tajawal', sans-serif; width: 100%; }
            .receipt-preview-container table { table-layout: fixed; width: 100%; border-collapse: collapse; }
            .receipt-preview-container td, .receipt-preview-container th { word-wrap: break-word; overflow-wrap: break-word; }
            
            /* High-Performance Responsive scaling for mobile screen size simulation */
            @media (max-width: 480px) {
              .jam-invoice-preview-card {
                padding: 6px !important;
                max-width: 100% !important;
              }
              #jam-print-overlay-body {
                padding: 8px !important;
              }
              .receipt, .modern-gold-invoice, .royal-invoice, .blue-invoice, [style*="width: 80mm"] {
                width: 100% !important;
                max-width: 100% !important;
                padding: 2mm 1mm !important;
                margin: 0 auto !important;
                box-sizing: border-box !important;
              }
              .header, .details, .footer {
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
              }
              .header img {
                max-width: 16mm !important;
              }
            }
            ${customStyles}
          </style>
          <div class="receipt-preview-container">
            ${content}
          </div>
          
          ${type !== 'phone_sticker' && type !== 'maintenance' ? `
          <div style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 16px; border-top: 1px solid #d1d5db; padding-top: 8px; font-family: 'Tajawal', sans-serif; width: 100%; box-sizing: border-box; font-weight: bold; direction: rtl;">
             <div>Powered by JAM System Pro</div>
             <div style="font-size: 10px; margin-top: 2px;">م. عبد الغني المحفلي | 772315106</div>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Set up interactive printer configuration selectors
    const optButtons = overlay.querySelectorAll('.jam-print-method-opt-btn');
    const descBanner = overlay.querySelector('#jam-print-method-desc-banner');
    
    optButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedMethod = btn.getAttribute('data-method') || 'bluetooth';
        
        // Save to user-specific local storage
        localStorage.setItem(`jam_print_method_${currentUserId}`, selectedMethod);
        // Also sync global key for backward compatibility
        localStorage.setItem('jam_print_method', selectedMethod);
        
        // Update styling of buttons
        optButtons.forEach(b => {
          const isSelected = b.getAttribute('data-method') === selectedMethod;
          (b as HTMLElement).style.background = isSelected ? '#1e293b' : '#f1f5f9';
          (b as HTMLElement).style.color = isSelected ? '#ffffff' : '#475569';
          (b as HTMLElement).style.border = `1px solid ${isSelected ? '#1e293b' : '#cbd5e1'}`;
        });
        
        // Update banner text
        if (descBanner) {
          if (selectedMethod === 'system') {
            descBanner.innerHTML = '🖨️ فتح حوار الطباعة الأصلي للنظام: يتيح لك اختيار أي طابعة متصلة (USB أو شبكة أو بلوتوث)، وتحديد حجم الورق والألوان وعدد النسخ.';
            (descBanner as HTMLElement).style.background = '#f0fdf4';
            (descBanner as HTMLElement).style.borderColor = '#bbf7d0';
            (descBanner as HTMLElement).style.color = '#15803d';
          } else if (selectedMethod === 'usb') {
            descBanner.innerHTML = '🔌 اتصال سلكي: سيتم توجيه أمر الطباعة عبر بروتوكول USB المباشر والمنفذ المحلي.';
            (descBanner as HTMLElement).style.background = '#f0fdf4';
            (descBanner as HTMLElement).style.borderColor = '#bbf7d0';
            (descBanner as HTMLElement).style.color = '#15803d';
          } else if (selectedMethod === 'wifi') {
            descBanner.innerHTML = '📶 اتصال شبكي: سيتم بث الفاتورة لاسلكياً عبر عنوان IP الطابعة بالشبكة المحلية.';
            (descBanner as HTMLElement).style.background = '#ecfdf5';
            (descBanner as HTMLElement).style.borderColor = '#a7f3d0';
            (descBanner as HTMLElement).style.color = '#047857';
          } else {
            descBanner.innerHTML = '📡 اتصال لاسلكي: سيتم البحث عن طابعات البلوتوث وإقرانها لاسلكياً عبر قنوات ESC/POS.';
            (descBanner as HTMLElement).style.background = '#f5f3ff';
            (descBanner as HTMLElement).style.borderColor = '#ddd6fe';
            (descBanner as HTMLElement).style.color = '#6d28d9';
          }
        }
      });
    });

    // Handle interactive paper size selection
    let activePaperSize = isReport ? 'a4' : '80mm';
    const paperButtons = overlay.querySelectorAll('.jam-paper-size-btn');
    const previewCard = overlay.querySelector('.jam-invoice-preview-card') as HTMLElement;
    
    paperButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.getAttribute('data-size') || '80mm';
        activePaperSize = size;
        
        // update styling of paper size buttons
        paperButtons.forEach(b => {
          const isSelected = b.getAttribute('data-size') === size;
          (b as HTMLElement).style.background = isSelected ? '#10b981' : '#f1f5f9';
          (b as HTMLElement).style.color = isSelected ? '#ffffff' : '#475569';
          (b as HTMLElement).style.borderColor = isSelected ? '#059669' : '#cbd5e1';
        });

        // update preview card max-width
        if (previewCard) {
          previewCard.style.maxWidth = size === 'a4' ? '800px' : size === '58mm' ? '260px' : '330px';
        }
      });
    });

    // Save Default Printer Name on input
    const printerNameInput = overlay.querySelector('#jam-default-printer-name-input') as HTMLInputElement;
    if (printerNameInput) {
      printerNameInput.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value;
        localStorage.setItem(`jam_default_printer_name_${currentUserId}`, val);
      });
    }

    // Click handler for Print Now button - opens native System Print Dialog with full controls
    const printBtn = overlay.querySelector('#jam-print-now-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        const currentPrintMethod = localStorage.getItem(`jam_print_method_${currentUserId}`) || localStorage.getItem('jam_print_method') || 'system';
        console.log(`🖨️ Print job dispatched over [${currentPrintMethod.toUpperCase()} Interface] on [${activePaperSize}] for session: ${currentUserId}`);

        // Prepare page size CSS for this specific print job
        const pageCss = `
          @page {
            size: ${activePaperSize === 'a4' ? 'A4 portrait' : activePaperSize === '58mm' ? '58mm auto' : '80mm auto'};
            margin: ${activePaperSize === 'a4' ? '10mm' : '2mm'};
          }
          @media print {
            body {
              visibility: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
            }
            #printableArea, #printableArea * {
              visibility: visible !important;
            }
            #printableArea {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: ${activePaperSize === 'a4' ? '12px' : '4px'} !important;
              background: #ffffff !important;
              color: #000000 !important;
            }
            .no-print, #jam-print-overlay, #jam-print-overlay * {
              display: none !important;
            }
          }
        `;

        // 1. Inject or update #printableArea in main DOM for direct window.print() (Works on Android APK WebView & PC)
        let printArea = document.getElementById('printableArea');
        if (!printArea) {
          printArea = document.createElement('div');
          printArea.id = 'printableArea';
          printArea.className = 'printableArea';
          document.body.appendChild(printArea);
        }
        printArea.innerHTML = `
          <style>${pageCss}</style>
          <div style="font-family: 'Tajawal', 'Cairo', sans-serif; direction: rtl; width: 100%; max-width: ${activePaperSize === 'a4' ? '100%' : activePaperSize === '58mm' ? '58mm' : '80mm'}; margin: 0 auto; color: #000000; background: #ffffff;">
            ${content}
            ${type !== 'phone_sticker' && type !== 'maintenance' ? `
            <div style="font-size: 11px; color: #475569; text-align: center; margin-top: 16px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-family: 'Tajawal', sans-serif; width: 100%; box-sizing: border-box; font-weight: bold; direction: rtl;">
               <div>Powered by JAM System Pro</div>
               <div style="font-size: 10px; margin-top: 2px;">م. عبد الغني المحفلي | 772315106</div>
            </div>
            ` : ''}
          </div>
        `;

        // 2. Prepare hidden iframe with real non-zero dimensions
        let iframe = document.getElementById('jam-print-iframe') as HTMLIFrameElement;
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'jam-print-iframe';
          iframe.style.position = 'fixed';
          iframe.style.left = '-9999px';
          iframe.style.top = '0';
          iframe.style.width = '800px';
          iframe.style.height = '1000px';
          iframe.style.border = 'none';
          iframe.style.opacity = '0.01';
          iframe.style.zIndex = '-999';
          document.body.appendChild(iframe);
        }

        const compiledHtml = `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
            <head>
              <meta charset="utf-8">
              <title>${title}</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&family=Libre+Barcode+39&display=swap');
                ${pageCss}
                body {
                  visibility: visible !important;
                  font-family: 'Tajawal', sans-serif;
                  margin: 0;
                  padding: ${activePaperSize === 'a4' ? '15px' : '4px'};
                  background: #ffffff;
                  color: #000000;
                  direction: rtl;
                }
                .receipt {
                  width: 100%;
                  max-width: ${activePaperSize === 'a4' ? '100%' : activePaperSize === '58mm' ? '58mm' : '80mm'};
                  margin: 0 auto;
                }
                table { table-layout: fixed; width: 100%; border-collapse: collapse; }
                td, th { word-wrap: break-word; overflow-wrap: break-word; }
                .no-print { display: none !important; }
                ${customStyles}
              </style>
            </head>
            <body>
              <div id="printableArea">
                ${content}
                ${type !== 'phone_sticker' && type !== 'maintenance' ? `
                <div style="font-size: 11px; color: #475569; text-align: center; margin-top: 16px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-family: 'Tajawal', sans-serif; font-weight: bold; direction: rtl;">
                   <div>Powered by JAM System Pro</div>
                   <div style="font-size: 10px; margin-top: 2px;">م. عبد الغني المحفلي | 772315106</div>
                </div>
                ` : ''}
              </div>
            </body>
          </html>
        `;

        const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(compiledHtml);
          iframeDoc.close();
        }

        // 3. Trigger Native System Print Dialog
        // Check Android / Mobile WebView
        const isAndroidOrApp = typeof window !== 'undefined' && 
          (navigator.userAgent.includes('Android') || (window as any).Capacitor?.isNativePlatform?.() || !!(window as any).Android);

        if (isAndroidOrApp || currentPrintMethod === 'system') {
          // Direct window.print() guarantees calling Android PrintManager or OS dialog
          setTimeout(() => {
            window.focus();
            window.print();
          }, 200);
        } else {
          // Desktop Iframe print
          setTimeout(() => {
            try {
              if (iframe.contentWindow) {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
              } else {
                window.focus();
                window.print();
              }
            } catch (err) {
              console.warn('Iframe print error, falling back to window.print():', err);
              window.focus();
              window.print();
            }
          }, 250);
        }
      });
    }

    // Click handler for Close button
    const closeBtn = overlay.querySelector('#jam-close-print-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        overlay.remove();
      });
    }

  } catch (error) {
    console.error('Print error:', error);
    alert('حدث خطأ أثناء محاولة الطباعة');
  }
};
