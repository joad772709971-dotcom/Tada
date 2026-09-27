/**
 * Custom Print Utility for Smart POS & ERP System
 * Allows elegant extraction and layout styling for any system section
 * Generates spacious, professional, and visually uncompressed print layouts
 */

export function handlePrintSection(elementId: string, title?: string, storeCustomName?: string): void {
  const element = document.getElementById(elementId);
  if (!element) {
    alert(`عذراً، لم نتمكن من تحديد العنصر القابل للطباعة: ${elementId}`);
    return;
  }

  let resolvedStoreName = storeCustomName;
  if (!resolvedStoreName && typeof window !== 'undefined') {
    const stored = localStorage.getItem('jam_last_logged_in_shop_name');
    if (stored && stored !== 'Jam system pro' && stored !== 'JAM System Pro') {
      resolvedStoreName = stored;
    }
  }
  if (!resolvedStoreName) {
    resolvedStoreName = 'المحل التجاري';
  }

  const systemDisplayName = `نظام ${resolvedStoreName}`;
  const documentTitle = title || `تقرير من ${systemDisplayName}`;
  const elementHtml = element.innerHTML;

  // CSS Styles for full report with spacious padding and readable hierarchy
  const reportStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
    
    body {
      font-family: 'Tajawal', system-ui, sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      margin: 15px;
      padding: 10px;
      line-height: 1.6;
    }

    /* Standard Tailwind base print classes utility mapped */
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      margin-bottom: 20px;
    }
    
    th, td {
      border: 1px solid #cbd5e1;
      padding: 10px 12px;
      text-align: right;
      line-height: 1.5;
    }
    
    th {
      background-color: #0f172a;
      font-weight: 800;
      color: #ffffff;
      font-size: 12.5px;
    }
    
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-black { font-weight: 900; }
    .text-xs { font-size: 0.75rem; }
    .text-sm { font-size: 0.875rem; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .text-2xl { font-size: 1.5rem; }
    
    /* Interactive buttons / badges */
    .no-print { display: none !important; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: bold;
    }

    header {
      border-bottom: 2px solid #cbd5e1;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-left {
      text-align: left;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }

    footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print { display: none !important; }
    }
  `;

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${documentTitle}</title>
      <style>${reportStyles}</style>
    </head>
    <body>
      <header>
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #b45309;">${systemDisplayName}</h1>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">نظام إدارة المبيعات والمخزون والحسابات وورش الصيانة</p>
        </div>
        <div class="header-left">
          <div>تاريخ الطباعة: <strong>${new Date().toLocaleDateString('ar-YE')}</strong></div>
          <div>الوقت: <strong>${new Date().toLocaleTimeString('ar-YE')}</strong></div>
          <div style="color: #059669; font-weight: bold;">مستند رسمي معتمد 🟢</div>
        </div>
      </header>

      <main>
        <h2 style="text-align: center; margin-bottom: 20px; font-weight: 900; font-size: 16px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px; color: #0f172a;">
          ${documentTitle}
        </h2>
        
        <div>
          ${elementHtml}
        </div>
      </main>

      <footer>
        <p>إشراف المطور م. عبدالغني المحفلي - تليفون: 772315106 | نظام ${resolvedStoreName}</p>
      </footer>
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

  overlay.innerHTML = `
    <div style="background: white; width: 100%; max-width: 900px; height: 90vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #0f172a; color: white;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">🖨️</span>
          <span style="font-weight: bold; font-size: 14px;">معاينة وطباعة التقرير (${documentTitle})</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="jam-print-btn-action" style="background: #eab308; color: #0f172a; border: none; padding: 6px 16px; border-radius: 8px; font-weight: 900; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <span>طباعة المستند 🖨️</span>
          </button>
          <button id="jam-print-close-btn" style="background: rgba(255,255,255,0.1); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; cursor: pointer;">
            ✕ إغلاق
          </button>
        </div>
      </div>
      <iframe id="jam-print-iframe" style="flex: 1; border: none; width: 100%; height: 100%;"></iframe>
    </div>
  `;

  document.body.appendChild(overlay);

  const iframe = document.getElementById('jam-print-iframe') as HTMLIFrameElement;
  if (iframe && iframe.contentWindow) {
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(fullHtml);
    doc.close();

    // Attach button actions
    const printBtn = document.getElementById('jam-print-btn-action');
    if (printBtn) {
      printBtn.onclick = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };
    }

    const closeBtn = document.getElementById('jam-print-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        overlay.remove();
      };
    }
  }
}
