import * as XLSX from 'xlsx';
import { handlePrintSection } from '../utils/print';

export interface ReportColumn {
  key: string;
  header: string;
  type?: 'text' | 'number' | 'currency' | 'date' | 'badge';
  width?: number;
  formatter?: (value: any, row: any) => string | number;
}

export interface ReportSummaryCard {
  label: string;
  value: string | number;
  currency?: string;
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'gray';
}

export interface UniversalReportPayload {
  title: string;
  subtitle?: string;
  storeName?: string;
  currentUser?: string;
  userPhone?: string;
  currency?: string;
  columns: ReportColumn[];
  data: any[];
  summaryCards?: ReportSummaryCard[];
  metadata?: Record<string, any>;
  notes?: string;
}

/**
 * Universal Cross-Platform Report & Export Service
 * Works seamlessly on Web, Android APK (Capacitor), and Windows Desktop (Electron).
 * Guarantees zero-failure exports even with 0 or empty records.
 * Optimized with generous padding, readable fonts, clean spacing, and custom shop header.
 */
export class UniversalReportService {

  /**
   * Safe number format helper
   */
  public static formatNumber(val: any, decimals: number = 2): string {
    if (val === null || val === undefined || isNaN(Number(val))) return '0.00';
    return Number(val).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Safe value extraction for a cell
   */
  public static getCellValue(row: any, col: ReportColumn): string | number {
    if (!row) return '-';
    let val = row[col.key];

    if (col.formatter) {
      try {
        return col.formatter(val, row);
      } catch {
        return '-';
      }
    }

    if (val === null || val === undefined) {
      return col.type === 'number' || col.type === 'currency' ? 0 : '-';
    }

    if (col.type === 'currency' || col.type === 'number') {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    }

    if (col.type === 'date') {
      try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('ar-YE');
      } catch {
        return String(val);
      }
    }

    return String(val);
  }

  /**
   * Resolve dynamic system and store name
   */
  private static getResolvedStoreName(customName?: string): string {
    if (customName && customName !== 'منظومة JAM الاحترافية الموحدة') {
      return customName;
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('jam_last_logged_in_shop_name');
      if (stored && stored !== 'Jam system pro' && stored !== 'JAM System Pro') {
        return stored;
      }
    }
    return customName || 'المحل التجاري';
  }

  /**
   * Export to Microsoft Excel (.xlsx) with comfortable column spacing and shop metadata
   */
  public static async exportToExcel(payload: UniversalReportPayload, customFilename?: string): Promise<boolean> {
    try {
      const rawStoreName = payload.storeName;
      const storeName = this.getResolvedStoreName(rawStoreName);
      const title = payload.title || `تقرير نظام ${storeName}`;
      const systemName = `نظام ${storeName}`;
      const currency = payload.currency || 'ر.ي';
      const currentUser = payload.currentUser || (typeof window !== 'undefined' ? localStorage.getItem('jam_current_user_name') : '') || 'المشرف';
      const userPhone = payload.userPhone || (typeof window !== 'undefined' ? localStorage.getItem('jam_current_user_phone') : '') || '';
      const timestamp = new Date().toLocaleString('ar-YE');
      const filename = (customFilename || `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`) + '.xlsx';

      // 1. Prepare Header rows
      const sheetData: any[][] = [];

      // Store Title Banner with spacious layout
      sheetData.push([`🏢 ${systemName} (${storeName})`]);
      sheetData.push([`📊 ${title}`]);
      sheetData.push([
        `👤 المستخدم / المستخرج: ${currentUser} ${userPhone ? `(${userPhone})` : ''}`, 
        '', 
        `🕒 تاريخ الاستخراج: ${timestamp}`, 
        '', 
        `العملة المعتمدة: ${currency}`
      ]);
      
      if (payload.subtitle) {
        sheetData.push([`ℹ️ ${payload.subtitle}`]);
      }

      // Summary metrics if provided
      if (payload.summaryCards && payload.summaryCards.length > 0) {
        sheetData.push([]);
        sheetData.push(['--- ملخص المؤشرات والأرقام المالية ---']);
        const summaryLabels = payload.summaryCards.map(c => c.label);
        const summaryValues = payload.summaryCards.map(c => `${c.value} ${c.currency || currency}`);
        sheetData.push(summaryLabels);
        sheetData.push(summaryValues);
      }

      sheetData.push([]); // Empty row separator for visual breathing room

      // Table Column Headers
      const headers = payload.columns.map(c => c.header);
      sheetData.push(headers);

      // Table Data Rows
      if (!payload.data || payload.data.length === 0) {
        const emptyRow = payload.columns.map((_, idx) => idx === 0 ? 'لا توجد بيانات مسجلة حالياً (الرصيد: 0.00)' : '-');
        sheetData.push(emptyRow);
      } else {
        payload.data.forEach(row => {
          const rowData = payload.columns.map(col => {
            const val = this.getCellValue(row, col);
            return val;
          });
          sheetData.push(rowData);
        });

        // Totals Row for Numerical Columns
        const totalsRow: any[] = [];
        let hasNumericTotal = false;

        payload.columns.forEach((col, idx) => {
          if (idx === 0) {
            totalsRow.push('المجموع الإجمالي:');
          } else if (col.type === 'number' || col.type === 'currency') {
            const sum = payload.data.reduce((acc, r) => {
              const v = Number(r[col.key]);
              return acc + (isNaN(v) ? 0 : v);
            }, 0);
            totalsRow.push(sum);
            hasNumericTotal = true;
          } else {
            totalsRow.push('');
          }
        });

        if (hasNumericTotal) {
          sheetData.push([]);
          sheetData.push(totalsRow);
        }
      }

      // Footer notes
      sheetData.push([]);
      sheetData.push([payload.notes || `تم استخراج هذا التقرير آلياً عبر نظام ${storeName} المعتمد - هاتف الإشراف: 772315106`]);

      // 2. Build Worksheet
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Set spacious column widths (extra padding to prevent compressed text)
      ws['!cols'] = payload.columns.map(col => ({
        wch: Math.max(col.width || (col.header.length * 2.5), 18)
      }));

      // Enable RTL on sheet
      if (!ws['!views']) ws['!views'] = [];
      ws['!views'].push({ RTL: true });

      // 3. Build Workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'التقرير الرسمي');

      // 4. Save across platforms (Capacitor / Electron / Browser)
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await this.saveAndDeliverFile(wbout, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      return true;
    } catch (err: any) {
      console.error('UniversalReportService Excel export error:', err);
      alert('تنبيه: حدث خطأ أثناء تصدير ملف الإكسل: ' + (err?.message || err));
      return false;
    }
  }

  /**
   * Export to UTF-8 CSV (.csv)
   */
  public static async exportToCSV(payload: UniversalReportPayload, customFilename?: string): Promise<boolean> {
    try {
      const storeName = this.getResolvedStoreName(payload.storeName);
      const title = payload.title || `تقرير ${storeName}`;
      const filename = (customFilename || `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`) + '.csv';

      let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Arabic compatibility

      // Title & Date
      csvContent += `"${payload.title}"\n`;
      csvContent += `"نظام ${storeName}","تاريخ التصدير:","${new Date().toLocaleString('ar-YE')}"\n\n`;

      // Headers
      csvContent += payload.columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',') + '\n';

      // Rows
      if (!payload.data || payload.data.length === 0) {
        csvContent += '"لا توجد بيانات مسجلة حالياً","0.00"\n';
      } else {
        payload.data.forEach(row => {
          const line = payload.columns.map(col => {
            const val = this.getCellValue(row, col);
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(',');
          csvContent += line + '\n';
        });
      }

      const encoder = new TextEncoder();
      const csvArray = encoder.encode(csvContent);
      await this.saveAndDeliverFile(csvArray, filename, 'text/csv;charset=utf-8;');
      return true;
    } catch (err: any) {
      console.error('UniversalReportService CSV export error:', err);
      alert('حدث خطأ أثناء تصدير ملف CSV: ' + (err?.message || err));
      return false;
    }
  }

  /**
   * Render and open universal printable PDF/Report view with generous line heights, spacious padding, and store header
   */
  public static printReport(payload: UniversalReportPayload): void {
    const containerId = 'jam-universal-report-temp-container';
    let tempContainer = document.getElementById(containerId);
    if (tempContainer) tempContainer.remove();

    tempContainer = document.createElement('div');
    tempContainer.id = containerId;
    tempContainer.style.display = 'none';

    const storeName = this.getResolvedStoreName(payload.storeName);
    const systemTitle = `نظام ${storeName}`;
    const currency = payload.currency || 'ر.ي';
    const currentUser = payload.currentUser || (typeof window !== 'undefined' ? localStorage.getItem('jam_current_user_name') : '') || 'المسؤول';
    const userPhone = payload.userPhone || (typeof window !== 'undefined' ? localStorage.getItem('jam_current_user_phone') : '') || '';

    // Summary cards HTML
    let summaryHtml = '';
    if (payload.summaryCards && payload.summaryCards.length > 0) {
      summaryHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 22px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 18px;">
          ${payload.summaryCards.map(c => `
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 6px;">${c.label}</div>
              <div style="font-size: 18px; font-weight: 900; color: #0f172a; line-height: 1.2;">
                ${c.value} <span style="font-size: 11px; color: #64748b; font-weight: 700;">${c.currency || currency}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Rows HTML with spacious padding
    let rowsHtml = '';
    if (!payload.data || payload.data.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="${payload.columns.length}" style="text-align: center; padding: 32px 16px; color: #64748b; font-size: 14px; background: #f8fafc;">
            ℹ️ لا توجد بيانات أو حركات مسجلة في هذا القسم حالياً (الرصيد / الإجمالي: 0.00 ${currency})
          </td>
        </tr>
      `;
    } else {
      rowsHtml = payload.data.map((row, rIdx) => `
        <tr style="background-color: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'}; transition: background 0.2s;">
          ${payload.columns.map(col => {
            const val = this.getCellValue(row, col);
            const isNum = col.type === 'number' || col.type === 'currency';
            return `
              <td style="padding: 12px 14px; border: 1px solid #cbd5e1; text-align: ${isNum ? 'left' : 'right'}; font-size: 12.5px; font-weight: ${isNum ? '800' : '500'}; line-height: 1.6; vertical-align: middle;">
                ${val} ${col.type === 'currency' ? `<span style="font-size: 10px; color: #64748b; font-weight: 700; margin-right: 2px;">${currency}</span>` : ''}
              </td>
            `;
          }).join('')}
        </tr>
      `).join('');

      // Add Totals row if numerical
      const totalsRow = payload.columns.map((col, idx) => {
        if (idx === 0) return `<td style="padding: 14px 14px; border: 1.5px solid #94a3b8; font-weight: 900; background: #e2e8f0; font-size: 13px;">المجموع الإجمالي:</td>`;
        if (col.type === 'number' || col.type === 'currency') {
          const sum = payload.data.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
          return `<td style="padding: 14px 14px; border: 1.5px solid #94a3b8; font-weight: 900; background: #e2e8f0; text-align: left; font-size: 13.5px;">${sum.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}</td>`;
        }
        return `<td style="border: 1.5px solid #94a3b8; background: #e2e8f0;"></td>`;
      }).join('');

      rowsHtml += `<tr>${totalsRow}</tr>`;
    }

    tempContainer.innerHTML = `
      <div style="font-family: 'Tajawal', system-ui, sans-serif; direction: rtl; color: #1e293b; padding: 4px;">
        
        <!-- Header Info Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a;">${systemTitle}</h2>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600;">
              المحل: <span style="color: #0f172a; font-weight: 800;">${storeName}</span>
              ${currentUser ? ` | المستخرج: <span style="color: #0f172a; font-weight: 800;">${currentUser}</span>` : ''}
              ${userPhone ? ` | هاتف: <span style="font-family: monospace; font-weight: 800;">${userPhone}</span>` : ''}
            </div>
          </div>
          <div style="text-align: left; font-size: 11px; color: #64748b;">
            <div>تاريخ الاستخراج: <strong>${new Date().toLocaleDateString('ar-YE')}</strong></div>
            <div>الوقت: <strong>${new Date().toLocaleTimeString('ar-YE')}</strong></div>
            <div style="color: #059669; font-weight: bold; margin-top: 2px;">مستند رسمي معتمد 🟢</div>
          </div>
        </div>

        ${summaryHtml}
        
        <!-- Spacious Table -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff;">
              ${payload.columns.map(col => `
                <th style="padding: 12px 14px; border: 1px solid #1e293b; text-align: ${col.type === 'number' || col.type === 'currency' ? 'left' : 'right'}; font-size: 13px; font-weight: 800; letter-spacing: 0.2px;">
                  ${col.header}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        ${payload.notes ? `
          <div style="margin-top: 20px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #475569; line-height: 1.6;">
            📌 <strong>ملاحظات التقرير:</strong> ${payload.notes}
          </div>
        ` : ''}

        <div style="margin-top: 30px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #64748b;">
          تم استخراج وطباعة هذا التقرير آلياً عبر نظام ${storeName} الذكي | إشراف المطور م. عبدالغني المحفلي: 772315106
        </div>
      </div>
    `;

    document.body.appendChild(tempContainer);

    handlePrintSection(containerId, payload.title || `تقرير ${systemTitle}`);
  }

  /**
   * Cross-platform file delivery (Web Blob, Electron, Capacitor Native Filesystem)
   */
  public static async saveAndDeliverFile(data: ArrayBuffer | Uint8Array, filename: string, mimeType: string): Promise<void> {
    // 1. Check Capacitor Native Environment
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        // Convert Uint8Array to base64
        let binary = '';
        const bytes = new Uint8Array(data);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = window.btoa(binary);

        const result = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });

        if (result?.uri) {
          await Share.share({
            title: `تقرير ${filename}`,
            text: `تم تصدير ملف التقرير بنجاح عبر النظام`,
            url: result.uri,
            dialogTitle: 'فتح أو مشاركة التقرير'
          });
          return;
        }
      } catch (nativeErr) {
        console.warn('Native Capacitor share failed, fallback to web download:', nativeErr);
      }
    }

    // 2. Standard Web & Desktop Blob Anchor Download
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jam:export_completed', {
        detail: {
          filename,
          mimeType,
          size: data.byteLength,
          timestamp: Date.now()
        }
      }));
    }
  }
}
