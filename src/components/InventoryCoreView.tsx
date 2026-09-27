import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  writeBatch, 
  limit, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  setDoc 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Warehouse, InventoryItem } from '../types';
import { 
  ShieldAlert, 
  Cpu, 
  Layers, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCcw, 
  TrendingUp, 
  Coins, 
  Package, 
  Database,
  Sliders,
  ChevronRight,
  Sparkles
} from 'lucide-react';

const getOwnerId = () => {
  return (InventoryCore as any)?.config?.ownerId || auth.currentUser?.uid || 'system';
};

// ----------------------------------------------------
// Core JavaScript/TypeScript Module Implementation
// ----------------------------------------------------
export const InventoryCore = {
  config: {
    name: "InventoryManager",
    theme: "Royal Gold & Dark",
    multiImagePermission: false,
    ownerId: ""
  },

  // 1. نظام التحويل الذكي
  TransferEngine: async (type: string, data?: any) => {
    console.log(`🚀 [InventoryCore] Transferring: ${type}`, data);
    const ownerId = getOwnerId();
    try {
      if (type === 'LAST_INVOICE') {
        const salesRef = collection(db, 'sales');
        const salesQuery = query(salesRef, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'), limit(1));
        const salesSnap = await getDocs(salesQuery);
        
        if (salesSnap.empty) {
          console.warn("No previous sales found corresponding to ownerId.");
          return { success: false, message: "لا توجد أي فواتير مبيعات سابقة لنقلها حالياً." };
        }
        
        const lastSaleDoc = salesSnap.docs[0];
        const lastSale = lastSaleDoc.data();
        const items = lastSale.items || [];
        const targetWarehouseId = data?.targetWarehouseId || 'wh-default';
        
        const batch = writeBatch(db);
        for (const item of items) {
          const productId = item.id || item.productId;
          if (!productId) continue;
          
          const stockDocId = `${productId}_${targetWarehouseId}`;
          const stockRef = doc(db, 'warehouseStocks', stockDocId);
          const currentQty = Number(item.quantity) || 1;
          
          batch.set(stockRef, {
            productId,
            warehouseId: targetWarehouseId,
            stock: currentQty,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        
        // Log to activityLogs
        const logRef = doc(collection(db, 'activityLogs'));
        batch.set(logRef, {
          action: 'INVENTORY_TRANSFER_LAST_INVOICE',
          details: `نظام التحويل الذكي: تم نقل أصناف الفاتورة الأخيرة (${lastSaleDoc.id.slice(-6)}) بنجاح إلى مستودع ${targetWarehouseId}.`,
          ownerId,
          createdAt: serverTimestamp(),
          severity: 'info'
        });
        
        await batch.commit();
        return { 
          success: true, 
          message: `تم تحويل ${items.length} صنف بنجاح من الفاتورة رقم ${lastSaleDoc.id.slice(-6)} إلى المستودع.`,
          invoiceId: lastSaleDoc.id,
          itemCount: items.length
        };
        
      } else if (type === 'FULL_WAREHOUSE') {
        const sourceWarehouseId = data?.sourceWarehouseId;
        const targetWarehouseId = data?.targetWarehouseId;
        
        if (!sourceWarehouseId || !targetWarehouseId) {
          return { success: false, message: "يرجى اختيار المستودع المصدر والمستودع الهدف." };
        }
        if (sourceWarehouseId === targetWarehouseId) {
          return { success: false, message: "لا يمكن النقل التلقائي إلى نفس المستودع." };
        }
        
        const stockRef = collection(db, 'warehouseStocks');
        const qStock = query(stockRef, where('warehouseId', '==', sourceWarehouseId));
        const stockSnap = await getDocs(qStock);
        
        if (stockSnap.empty) {
          return { success: false, message: "المستودع المصدر فارغ أو لا يحتوي على جرد مسجل." };
        }
        
        const batch = writeBatch(db);
        let itemsCount = 0;
        
        stockSnap.forEach((stockDoc) => {
          const sData = stockDoc.data();
          const productId = sData.productId;
          const currentQty = Number(sData.stock) || 0;
          
          if (productId && currentQty > 0) {
            // Null out source
            batch.update(stockDoc.ref, { stock: 0, updatedAt: serverTimestamp() });
            
            // Add on target
            const targetDocId = `${productId}_${targetWarehouseId}`;
            const targetStockRef = doc(db, 'warehouseStocks', targetDocId);
            batch.set(targetStockRef, {
              productId,
              warehouseId: targetWarehouseId,
              stock: currentQty,
              updatedAt: serverTimestamp()
            }, { merge: true });
            
            itemsCount++;
          }
        });
        
        if (itemsCount > 0) {
          const logRef = doc(collection(db, 'activityLogs'));
          batch.set(logRef, {
            action: 'INVENTORY_TRANSFER_FULL',
            details: `تحويل كامل: تم نقل المخزون بالكامل من المستودع (${sourceWarehouseId}) إلى المستودع الرائد (${targetWarehouseId}) لعدد ${itemsCount} صنف.`,
            ownerId,
            createdAt: serverTimestamp(),
            severity: 'warning'
          });
          
          await batch.commit();
        }
        
        return { success: true, message: `تم دمج ونقل كامل أرصدة المستودع بنجاح (إجمالي الأصناف المنقولة: ${itemsCount}).` };
        
      } else {
        // Custom transfer of custom products
        const items = data?.items || [];
        const sourceWarehouseId = data?.sourceWarehouseId || 'wh-main';
        const targetWarehouseId = data?.targetWarehouseId || 'wh-default';
        
        if (items.length === 0) {
          return { success: false, message: "لا تتوفر أي أصناف محددة للقيام بعملية التحويل المخصص." };
        }
        
        const batch = writeBatch(db);
        for (const item of items) {
          const productId = item.productId || item.id;
          const qty = Number(item.quantity) || 1;
          if (!productId) continue;
          
          const targetDocId = `${productId}_${targetWarehouseId}`;
          const targetRef = doc(db, 'warehouseStocks', targetDocId);
          batch.set(targetRef, {
            productId,
            warehouseId: targetWarehouseId,
            stock: qty,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        
        const logRef = doc(collection(db, 'activityLogs'));
        batch.set(logRef, {
          action: 'INVENTORY_TRANSFER_CUSTOM',
          details: `تحويل مخصص: نقل عينات أصناف منتقاة لعدد ${items.length} صنف إلى المستودع (${targetWarehouseId}).`,
          ownerId,
          createdAt: serverTimestamp(),
          severity: 'info'
        });
        
        await batch.commit();
        return { success: true, message: `تم نقل الأصناف المحددة (${items.length} صنف) بنجاح.` };
      }
    } catch (error: any) {
      console.error("Error in Core TransferEngine:", error);
      return { success: false, message: error.message || "حدث خطأ نظام أثناء ترحيل الجرد." };
    }
  },

  // 2. نظام الباركود المرن
  BarcodeEngine: async (filterType: string, options?: any) => {
    console.log(`🖨️ [InventoryCore] Generating Barcode via filter: ${filterType}`);
    const ownerId = getOwnerId();
    try {
      let itemsToPrint: any[] = [];
      const shopSettingsSnap = await getDoc(doc(db, 'settings', ownerId));
      const shopSettings = shopSettingsSnap.exists() ? shopSettingsSnap.data() : { shopName: 'Jam system pro', currency: 'ر.ي' };
      
      if (filterType === 'LAST_INVOICE') {
        const salesRef = collection(db, 'sales');
        const salesQuery = query(salesRef, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'), limit(1));
        const salesSnap = await getDocs(salesQuery);
        
        if (salesSnap.empty) {
          alert('عذراً، لم يعثر النظام على أي فواتير بيع سابقة لطباعتها في سجلات هذا المستخدم.');
          return { success: false, message: 'No sales found.' };
        }
        
        const lastSale = salesSnap.docs[0].data();
        itemsToPrint = lastSale.items || [];
      } else if (filterType === 'LAST_MONTH') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const salesRef = collection(db, 'sales');
        const salesQuery = query(
          salesRef, 
          where('ownerId', '==', ownerId), 
          where('createdAt', '>=', thirtyDaysAgo),
          orderBy('createdAt', 'desc')
        );
        const salesSnap = await getDocs(salesQuery);
        
        const mergedObj: Record<string, any> = {};
        salesSnap.forEach((saleDoc) => {
          const sale = saleDoc.data();
          const items = sale.items || [];
          items.forEach((item: any) => {
            const key = item.id || item.productId || 'unknown';
            if (mergedObj[key]) {
              mergedObj[key].quantity += (Number(item.quantity) || 1);
            } else {
              mergedObj[key] = { ...item, quantity: Number(item.quantity) || 1 };
            }
          });
        });
        itemsToPrint = Object.values(mergedObj);
      } else if (filterType === 'PRODUCT') {
        const productId = options?.productId;
        if (!productId) {
          alert('يرجى اختيار صنف أو منتج معين للطباعة.');
          return { success: false, message: 'Product ID required.' };
        }
        const itemDoc = await getDoc(doc(db, 'inventory', productId));
        if (!itemDoc.exists()) {
          alert('الصنف المختار غير متوفر في قواعد بيانات المخازن.');
          return { success: false, message: 'Product not found.' };
        }
        itemsToPrint = [{ id: itemDoc.id, ...itemDoc.data(), quantity: options?.count || 1 }];
      } else if (filterType === 'WAREHOUSE') {
        const warehouseId = options?.warehouseId;
        if (!warehouseId) {
          alert('يرجى تحديد المستودع.');
          return { success: false, message: 'Warehouse ID required.' };
        }
        const q = query(collection(db, 'warehouseStocks'), where('warehouseId', '==', warehouseId));
        const stocksSnap = await getDocs(q);
        
        for (const stockDoc of stocksSnap.docs) {
          const sData = stockDoc.data();
          if (sData.stock > 0) {
            const itemDoc = await getDoc(doc(db, 'inventory', sData.productId));
            if (itemDoc.exists()) {
              itemsToPrint.push({ id: itemDoc.id, ...itemDoc.data(), quantity: 1 });
            }
          }
        }
      } else if (filterType === 'SPECIFIC_COUNT') {
        const productId = options?.productId;
        const count = options?.count || 1;
        if (!productId) {
          alert('يرجى اختيار الصنف أولاً.');
          return { success: false, message: 'Product ID required.' };
        }
        const itemDoc = await getDoc(doc(db, 'inventory', productId));
        if (!itemDoc.exists()) {
          alert('عذراً، المنتج المطلوب غير موجود.');
          return { success: false, message: 'Product not found.' };
        }
        itemsToPrint = [{ id: itemDoc.id, ...itemDoc.data(), quantity: count }];
      }
      
      if (itemsToPrint.length === 0) {
        alert('لا توجد أصناف صالحة للطباعة حالياً طبقاً للفلتر المختار.');
        return { success: false, message: 'No items to print.' };
      }
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('حدث خطأ أثناء فتح نافذة المعاينة. يرجى تفعيل السماح بالنوافذ المنبثقة من إعدادات المتصفح.');
        return { success: false, message: 'Pop-up blocked.' };
      }
      
      let htmlContent = `
        <html>
        <head>
          <title>JAM System Pro - Royal Barcode Engine</title>
          <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            body {
              background-color: #060606;
              color: #fbbf24;
              font-family: 'Cairo', sans-serif;
              direction: rtl;
              margin: 20px;
              text-align: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-title {
              font-weight: 900;
              color: #fbbf24;
              border-bottom: 2px dashed #fbbf24;
              padding-bottom: 8px;
              margin-bottom: 25px;
              font-size: 22px;
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(55mm, 1fr));
              gap: 6mm;
            }
            .barcode-badge {
              background: #111111;
              border: 1px solid #fbbf24;
              border-radius: 6px;
              padding: 3mm;
              text-align: center;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
            }
            .shop-name {
              font-size: 10px;
              font-weight: 900;
              color: #fbbf24;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .item-name {
              font-size: 12px;
              font-weight: bold;
              color: #ffffff;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              margin-bottom: 3px;
              max-width: 100%;
            }
            .item-compat {
              font-size: 9px;
              color: #a3a3a3;
              margin-bottom: 4px;
              direction: rtl;
              text-align: center;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .barcode-font {
              font-family: 'Libre Barcode 39', cursive;
              font-size: 42px;
              color: #ffffff;
              margin: 1px 0;
              line-height: 1;
            }
            .barcode-text {
              font-family: monospace;
              font-size: 10px;
              color: #888888;
              margin-top: -2px;
              margin-bottom: 4px;
              letter-spacing: 1px;
            }
            .price-tag {
              font-size: 13px;
              font-weight: 900;
              color: #fbbf24;
              border-top: 1px dashed rgba(251, 191, 36, 0.3);
              padding-top: 3px;
              width: 100%;
            }
            @media print {
              body {
                background: #ffffff !important;
                color: #000000 !important;
              }
              .barcode-badge {
                border: 1px solid #000000 !important;
                background: #ffffff !important;
                box-shadow: none !important;
              }
              .item-name {
                color: #000000 !important;
              }
              .item-compat {
                color: #555555 !important;
              }
              .shop-name, .price-tag, .barcode-font, .barcode-text {
                color: #000000 !important;
              }
              .price-tag {
                border-top: 1px dashed #000000 !important;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="page-title no-print">بوابة طباعة البقالة والباركود الملكية - JAM System Pro</div>
          <div class="no-print" style="margin-bottom: 20px;">
            <button onclick="window.print()" style="padding: 8px 20px; background: #fbbf24; color: #000; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">بدء الطباعة الآن</button>
          </div>
          <div class="grid-container">
      `;
      
      // Hydrate all items with full inventory metadata (e.g. true barcode and compatibilities) if missing
      const fullItemsToPrint: any[] = [];
      for (const item of itemsToPrint) {
        const itemId = item.id || item.productId;
        if (itemId && itemId !== 'manual') {
          try {
            const itemDoc = await getDoc(doc(db, 'inventory', itemId));
            if (itemDoc.exists()) {
              const fullData = itemDoc.data();
              fullItemsToPrint.push({
                ...item,
                id: itemId,
                barcode: fullData.barcode || item.barcode || '',
                compatibilities: fullData.compatibilities || item.compatibilities || '',
                model: fullData.model || item.model || '',
                category: fullData.category || item.category || '',
                price: item.price || fullData.price || 0,
                cost: item.cost || fullData.cost || 0,
                quantity: item.quantity || options?.count || 1
              });
              continue;
            }
          } catch (e) {
            console.error("Error fetching full item details for print:", e);
          }
        }
        fullItemsToPrint.push({
          ...item,
          quantity: item.quantity || options?.count || 1
        });
      }
      itemsToPrint = fullItemsToPrint;

      for (const item of itemsToPrint) {
        const qtyToPrint = Number(item.quantity) || 1;
        const rawCode = (item.barcode || item.id || '9999').toUpperCase();
        const codeClean = rawCode.replace(/[^A-Z0-9]/g, '');
        
        for (let i = 0; i < qtyToPrint; i++) {
          htmlContent += `
            <div class="barcode-badge">
              <div class="shop-name">${shopSettings.shopName || 'Jam system pro'}</div>
              <div class="item-name" title="${item.name || ''}">${item.name || 'صنف عشوائي'}</div>
              ${item.compatibilities ? `<div class="item-compat" title="${item.compatibilities}">التوافق: ${item.compatibilities}</div>` : ''}
              <div class="barcode-font">*${codeClean}*</div>
              <div class="barcode-text">${codeClean}</div>
              <div class="price-tag">${item.price || item.cost || '0'} ${shopSettings.currency || 'ر.ي'}</div>
            </div>
          `;
        }
      }
      
      htmlContent += `
          </div>
        </body>
        </html>
      `;
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      return { success: true, message: `تم ترحيل وبناء ${itemsToPrint.length} رمز باركود لصفحة المعاينة الطباعية.` };
    } catch (e: any) {
      console.error(e);
      return { success: false, message: e.message };
    }
  },

  // 3. بوابة المالك (حماية الصور)
  PermissionGate: {
    toggleMultiImage: async (status: boolean) => {
      InventoryCore.config.multiImagePermission = status;
      console.log(`🔒 [InventoryCore] Image Access: ${status ? "GRANTED" : "RESTRICTED"}`);
      const ownerId = getOwnerId();
      try {
        const settingsRef = doc(db, 'settings', ownerId);
        await setDoc(settingsRef, {
          multiImagePermission: status
        }, { merge: true });
        
        const configRef = doc(db, 'system', 'config');
        await updateDoc(configRef, {
          multiImagePermission: status
        }).catch(() => {});
        
        await addDoc(collection(db, 'activityLogs'), {
          action: 'TOGGLE_MULTI_IMAGE_PERMISSION',
          details: `بوابة المالك: تم تغيير أذونات الصور المتعددة للمستودعات الجارية إلى: ${status ? 'مسموح ومكتمل' : 'مقيّد للمشرفين فقط'}`,
          ownerId,
          createdAt: serverTimestamp(),
          severity: 'info'
        });
        
        return { success: true, status };
      } catch (error: any) {
        console.error("PermissionGate database update failed:", error);
        return { success: false, message: error.message };
      }
    }
  },

  // 4. أدوات الصيانة والجرد الشامل
  Maintenance: {
    fixPricingErrors: async () => {
      const ownerId = getOwnerId();
      try {
        console.log("🛠️ [InventoryCore] Scanning stock items for negative profit or pricing typos...");
        const invRef = collection(db, 'inventory');
        const q = query(invRef, where('ownerId', '==', ownerId));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          return { success: true, fixedCount: 0, message: "لا توجد أي سلع مسجلة تحت ملكية هذا الحساب لتصحيحها." };
        }
        
        const batch = writeBatch(db);
        let fixedCount = 0;
        
        snap.forEach((itemDoc) => {
          const item = itemDoc.data();
          const price = Number(item.price) || 0;
          const cost = Number(item.cost) || 0;
          
          let fixNeeded = false;
          let correctedPrice = price;
          
          // Case 1: Selling price less than or equal to cost
          if (price < cost && cost > 0) {
            correctedPrice = Math.round(cost * 1.15); // Add standard 15% safety profit margin
            fixNeeded = true;
          }
          // Case 2: Price is zero but cost exists
          else if (price === 0 && cost > 0) {
            correctedPrice = Math.round(cost * 1.15);
            fixNeeded = true;
          }
          // Case 3: Both price and cost are zero (system safety fallback default)
          else if (price === 0 && cost === 0) {
            correctedPrice = 250;
            fixNeeded = true;
          }
          // Case 4: Weak profit margin (price is less than cost * 1.05, meaning margin is less than 5%, and cost exists)
          else if (cost > 0 && price < cost * 1.05) {
            correctedPrice = Math.round(cost * 1.15); // Add standard 15% safety profit margin to protect profitability
            fixNeeded = true;
          }
          
          if (fixNeeded) {
            batch.update(itemDoc.ref, {
              price: correctedPrice,
              originalPricingFault: price,
              fixedAt: serverTimestamp()
            });
            fixedCount++;
          }
        });
        
        if (fixedCount > 0) {
          await batch.commit();
          await addDoc(collection(db, 'activityLogs'), {
            action: 'INVENTORY_PRICING_AUTO_FIX',
            details: `صيانة أسعار تلقائية: تم تصحيح ${fixedCount} سلعة كان لديها خلل في التسعير أو هامش ربح ضعيف/سلبي.`,
            ownerId,
            createdAt: serverTimestamp(),
            severity: 'success'
          });
        }
        
        return { 
          success: true, 
          fixedCount, 
          message: `تم فحص جميع الأصناف بنجاح. وجد النظام وصحّح ${fixedCount} حالة تسعير خاطئة وتلفه لضمان الربح.` 
        };
      } catch (error: any) {
        console.error("Pricing correction failed:", error);
        return { success: false, message: error.message };
      }
    },
    
    runFullAudit: async () => {
      const ownerId = getOwnerId();
      try {
        console.log("📊 [InventoryCore] Starting advanced full database audit...");
        const invSnap = await getDocs(query(collection(db, 'inventory'), where('ownerId', '==', ownerId)));
        let totalItemsCount = 0;
        let totalStockQuantity = 0;
        let totalRetailValue = 0;
        let totalCostValue = 0;
        let anomalyCount = 0;
        const anomalies: string[] = [];
        
        invSnap.forEach((itemDoc) => {
          const item = itemDoc.data();
          totalItemsCount++;
          const stock = Number(item.stock) || 0;
          const price = Number(item.price) || 0;
          const cost = Number(item.cost) || 0;
          
          totalStockQuantity += stock;
          totalRetailValue += (stock * price);
          totalCostValue += (stock * cost);
          
          if (stock < 0) {
            anomalyCount++;
            anomalies.push(`الصنف "${item.name}" يمتلك رصيد سالب (${stock})`);
          }
          if (price < cost) {
            anomalyCount++;
            anomalies.push(`أرباح سالبة لـ "${item.name}" (تكلفة: ${cost} / بيع: ${price})`);
          } else if (cost > 0 && price < cost * 1.05) {
            anomalyCount++;
            anomalies.push(`هامش ربح ضعيف جداً لـ "${item.name}" (تكلفة: ${cost} / بيع: ${price})`);
          }
        });
        
        const whSnap = await getDocs(query(collection(db, 'warehouses'), where('ownerId', '==', ownerId)));
        
        const auditResults = {
          totalProducts: totalItemsCount,
          totalAggregateStock: totalStockQuantity,
          inventoryAssetsRetail: totalRetailValue,
          inventoryAssetsCost: totalCostValue,
          projectedNetProfit: totalRetailValue - totalCostValue,
          warehousesCount: whSnap.size,
          anomaliesCount: anomalyCount,
          anomaliesFoundList: anomalies,
          auditedAt: new Date().toISOString()
        };

        const auditReport = {
          totalItemsCount,
          totalStockQuantity,
          totalCostValue,
          totalRetailValue,
          anomalyCount,
          anomalies
        };
        
        // Write standard auditLog
        await addDoc(collection(db, 'auditLogs'), {
          type: 'FULL_STOCK_AUDIT',
          summary: `تدقيق مخزني وجرد شامل للأنظمة والأصول في ${new Date().toLocaleDateString('ar-YE')}`,
          results: auditResults,
          ownerId,
          createdAt: serverTimestamp()
        });
        
        return { success: true, results: auditResults, auditReport };
      } catch (error: any) {
        console.error("Full audit error:", error);
        return { success: false, message: error.message };
      }
    }
  }
};

// Bind to window for direct HTML onclick actions support
if (typeof window !== 'undefined') {
  (window as any).InventoryCore = InventoryCore;
}

// ----------------------------------------------------
// Raw HTML UI Component as requested by the user API
// ----------------------------------------------------
export const InventoryView = () => {
  return `
    <div class="jam-container" style="background: #0d0d0d; color: #fbbf24; padding: 24px; border: 1.5px solid #fbbf24; border-radius: 16px; font-family: 'Cairo', sans-serif; max-width: 900px; margin: 30px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.9);">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px dashed #fbbf24; padding-bottom: 12px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #fbbf24; text-shadow: 0 0 10px rgba(251, 191, 36, 0.3);">JAM SYSTEM PRO - INVENTORY CORE v4-A</h1>
        <span style="font-size: 11px; font-family: monospace; border: 1px solid #fbbf24; padding: 2px 8px; border-radius: 4px; background: rgba(251,191,36,0.1)">ROYAL EDITION</span>
      </div>

      <p style="font-size: 14px; color: #ffffff; opacity: 0.8; line-height: 1.6; margin-bottom: 20px;">
        مرحباً بك في محرك الجرد والتحويل المتكامل لـ JAM System Pro. يجمع هذا النظام قوة الباركود الذكي والتحويل الآمن بين مخازن الأصول، تحت حماية بوابات المالك وتدقيق الصيانة المباشر.
      </p>

      <div class="developer-panel" style="border: 1px solid rgba(251, 191, 36, 0.3); padding: 16px; margin-bottom: 20px; border-radius: 10px; background: #121212;">
        <h3 style="margin-top: 0; margin-bottom: 8px; color: #ffffff; font-size: 16px; font-weight: bold; border-right: 4px solid #fbbf24; padding-right: 8px;">بوابة أمن المالك وتدقيق الصيانة (Owner Security Gate)</h3>
        <p style="font-size: 12px; color: #aaaaaa; margin-bottom: 15px;">التحكم في وصول ومطابقة بيانات الصور والمخزون، وتصحيح التلف الفوري في التسعير وهوامش الأرباح.</p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button style="background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: #000; border: none; padding: 10px 18px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="InventoryCore.PermissionGate.toggleMultiImage(true)">تمكين الصور المتعددة</button>
          <button style="background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid #fbbf24; padding: 10px 18px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="InventoryCore.PermissionGate.toggleMultiImage(false)">تعطيل الصور المتعددة</button>
          <button style="background: #10b981; color: #fff; border: none; padding: 10px 18px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="InventoryCore.Maintenance.fixPricingErrors()">تصحيح فوري لأسعار الخسائر</button>
        </div>
      </div>

      <div class="actions" style="border: 1px solid rgba(251, 191, 36, 0.3); padding: 16px; border-radius: 10px; background: #121212;">
        <h3 style="margin-top: 0; margin-bottom: 8px; color: #ffffff; font-size: 16px; font-weight: bold; border-right: 4px solid #fbbf24; padding-right: 8px;">العمليات الميدانية والتحويل الذكي (Operations)</h3>
        <p style="font-size: 12px; color: #aaaaaa; margin-bottom: 15px;">نقل المخزون المباشر، جرد السلع الكلي، وطباعة الأوتاد وتسميات الباركود لفواتير مبيعاتك.</p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button style="background: #2563eb; color: #fff; border: none; padding: 10px 18px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="InventoryCore.TransferEngine('FULL_WAREHOUSE')">نقل مستودع كامل بالكامل</button>
          <button style="background: #fbbf24; color: #000; border: none; padding: 10px 18px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="InventoryCore.TransferEngine('LAST_INVOICE')">ترحيل سلع الفاتورة الأخيرة</button>
          <button style="background: #8b5cf6; color: #fff; border: none; padding: 10px 18px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="InventoryCore.BarcodeEngine('LAST_INVOICE')">طباعة باركود الفاتورة الأخيرة</button>
          <button style="background: #ec4899; color: #fff; border: none; padding: 10px 18px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="InventoryCore.Maintenance.runFullAudit()">تدقيق وجرد مالي كلي</button>
        </div>
      </div>

      <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #777777;">
        مطور لـ JAM SYSTEM PRO • الإصدار المهيب v4-A
      </div>
    </div>
  `;
};

// ----------------------------------------------------
// Royal Gold & Dark Interactive React Dashboard Component
// ----------------------------------------------------
export default function InventoryCoreView({ profile }: { profile: any }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sourceWh, setSourceWh] = useState('');
  const [targetWh, setTargetWh] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [barcodeCount, setBarcodeCount] = useState(5);
  
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null);
  
  const [auditStats, setAuditStats] = useState<any | null>(null);
  const [multiImageStatus, setMultiImageStatus] = useState(InventoryCore.config.multiImagePermission);

  useEffect(() => {
    const ownerId = getOwnerId();
    
    // Load Warehouses
    const fetchW = async () => {
      try {
        const q = query(collection(db, 'warehouses'), where('ownerId', '==', ownerId));
        const snap = await getDocs(q);
        const wList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
        setWarehouses(wList);
        if (wList.length > 0) {
          setSourceWh(wList[0].id);
          if (wList.length > 1) setTargetWh(wList[1].id);
          else setTargetWh(wList[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };

    // Load Products for selection
    const fetchP = async () => {
      try {
        const q = query(collection(db, 'inventory'), where('ownerId', '==', ownerId), limit(80));
        const snap = await getDocs(q);
        const pList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
        setInventory(pList);
        if (pList.length > 0) {
          setSelectedProduct(pList[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchW();
    fetchP();
  }, []);

  const showAlert = (text: string, type: 'success' | 'danger' | 'info' = 'info') => {
    setAlertInfo({ text, type });
    setTimeout(() => setAlertInfo(null), 5000);
  };

  const handleFullWarehouseTransfer = async () => {
    if (!sourceWh || !targetWh) {
      showAlert("يرجى اختيار مستودعين صالحين.", "danger");
      return;
    }
    setLoading(true);
    const res = await InventoryCore.TransferEngine('FULL_WAREHOUSE', {
      sourceWarehouseId: sourceWh,
      targetWarehouseId: targetWh
    });
    setLoading(false);
    if (res.success) {
      showAlert(res.message || "اكتمل التحويل بنجاح.", "success");
    } else {
      showAlert(res.message || "احفق النقل.", "danger");
    }
  };

  const handleLastInvoiceTransfer = async () => {
    if (!targetWh) {
      showAlert("يرجى اختيار مستودع هدف وتفعيله أولاً.", "danger");
      return;
    }
    setLoading(true);
    const res = await InventoryCore.TransferEngine('LAST_INVOICE', {
      targetWarehouseId: targetWh
    });
    setLoading(false);
    if (res.success) {
      showAlert(res.message || "تم التحويل.", "success");
    } else {
      showAlert(res.message || "تعذر العثور على مبيعات فاتورة سابقة للمجموعة.", "danger");
    }
  };

  const handlePrintProductBarcode = async () => {
    if (!selectedProduct) {
      showAlert("يرجى تحديد سلعة لطباعة ترميزها.", "danger");
      return;
    }
    setLoading(true);
    const res = await InventoryCore.BarcodeEngine('SPECIFIC_COUNT', {
      productId: selectedProduct,
      count: barcodeCount
    });
    setLoading(false);
    if (res.success) {
      showAlert("يرجى فحص علامة تبويب المعاينة الجديدة للطباعة.", "success");
    } else {
      showAlert(res.message || "حدث تداخل أثناء تجهيز الباركود.", "danger");
    }
  };

  const handlePrintLastInvoiceBarcodes = async () => {
    setLoading(true);
    const res = await InventoryCore.BarcodeEngine('LAST_INVOICE');
    setLoading(false);
    if (res.success) {
      showAlert("تم إطلاق مستند طباعة باركود الفاتورة الأخيرة.", "success");
    } else {
      showAlert(res.message || "لا تتوفر فواتير مبيعات سابقة كافية.", "danger");
    }
  };

  const handleToggleMultiImage = async (status: boolean) => {
    setLoading(true);
    const res = await InventoryCore.PermissionGate.toggleMultiImage(status);
    setLoading(false);
    if (res.success) {
      setMultiImageStatus(status);
      showAlert(`تم تحديث أمن المالك وتغيير الحالة الصورية بنجاح إلى: ${status ? 'نشط ومستمر' : 'مقيّد للمالك'}`, "success");
    } else {
      showAlert("فشل إرسال الإشارة الأمنية للمالك.", "danger");
    }
  };

  const handleFixPricingTypo = async () => {
    setLoading(true);
    const res = await InventoryCore.Maintenance.fixPricingErrors();
    setLoading(false);
    if (res.success) {
      showAlert(res.message || "اكتلمت عمليات تسوية الأسعار.", "success");
    } else {
      showAlert("تعذر الوصول لبروتوكول الصيانة التراكمية.", "danger");
    }
  };

  const handleRunSystemAudit = async () => {
    setLoading(true);
    const res = await InventoryCore.Maintenance.runFullAudit();
    setLoading(false);
    if (res.success && res.results) {
      setAuditStats(res.results);
      showAlert("تم جرد المخازن وحفظ التقرير الشامل بنجاح.", "success");
    } else {
      showAlert("أخفق إجراء التدقيق المالي الحصري.", "danger");
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-[#fbbf24] font-sans antialiased p-6 md:p-12 selection:bg-[#fbbf24]/20">
      
      {/* Header Banner - Royal Gold & Midnight */}
      <div className="w-full max-w-[1920px] mx-auto mb-12 relative overflow-hidden bg-gradient-to-l from-[#121212] via-[#0d0d0d] to-[#121212] border border-[#fbbf24]/30 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-[#fbbf24]/5 to-transparent rounded-full pointer-events-none"></div>
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="p-4 bg-gradient-to-tr from-[#fbbf24] to-[#facc15] text-[#000] rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.3)]">
            <Cpu className="w-8 h-8 animate-pulse" />
          </div>
          <div className="text-right md:text-right">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-black px-2 py-0.5 bg-[#fbbf24] rounded-md">CORE 4-A</span>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-none">نظام الجرد المتطور والتحويل الذكي</h1>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 font-medium">JAM SYSTEM PRO • هندسة الجرد والطباعة والتحويل الرائد</p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <div className="text-left">
            <span className="text-[10px] text-gray-500 block uppercase font-mono">STATUS BRIDGE</span>
            <span className="text-xs text-[#10b981] font-bold flex items-center gap-1.5 justify-center md:justify-end">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-ping"></span>
              نظام محمي ومتصل
            </span>
          </div>
        </div>
      </div>

      {/* Main Alert Message */}
      {alertInfo && (
        <div className="w-full max-w-[1920px] mx-auto mb-8 animate-fade-in">
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${
            alertInfo.type === 'success' 
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400' 
              : alertInfo.type === 'danger'
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-400'
                : 'bg-indigo-950/40 border-indigo-500/50 text-indigo-400'
          }`}>
            {alertInfo.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-bold">{alertInfo.text}</span>
          </div>
        </div>
      )}

      {/* Grid Modules */}
      <div className="w-full max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Operations (Transfer & Print) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Module 1: Transfer Engine panel */}
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 relative hover:border-[#fbbf24]/20 transition-all duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <Layers className="w-6 h-6 text-[#fbbf24]" />
                <h2 className="text-lg font-black text-white">محرك التحويل الذكي المستودعي</h2>
              </div>
              <span className="text-[10px] bg-[#fbbf24]/10 text-[#fbbf24] px-2 py-1 rounded-lg border border-[#fbbf24]/20 font-bold">Transfer Engine</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-bold block">المستودع المصدر (Source):</label>
                <select 
                  value={sourceWh} 
                  onChange={(e) => setSourceWh(e.target.value)}
                  className="w-full bg-[#151515] text-[#fbbf24] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#fbbf24] focus:outline-none focus:ring-1 focus:ring-[#fbbf24]"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#111]">{w.name} ({w.code})</option>
                  ))}
                  {warehouses.length === 0 && <option value="">لا توجد مستودعات متاحة</option>}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-bold block">المستودع المستهدف (Target):</label>
                <select 
                  value={targetWh} 
                  onChange={(e) => setTargetWh(e.target.value)}
                  className="w-full bg-[#151515] text-[#fbbf24] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#fbbf24] focus:outline-none focus:ring-1 focus:ring-[#fbbf24]"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#111]">{w.name} ({w.code})</option>
                  ))}
                  {warehouses.length === 0 && <option value="">لا توجد مستودعات متاحة</option>}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/5">
              <button 
                onClick={handleFullWarehouseTransfer}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-blue-900/20 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                دمج ونقل كامل المخزن
              </button>

              <button 
                onClick={handleLastInvoiceTransfer}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-[#fbbf24] to-[#fb923c] hover:from-[#fb923c] hover:to-[#f97316] text-[#000] font-black py-3 px-6 rounded-xl shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                ترحيل سلع آخر فاتورة
              </button>
            </div>
          </div>

          {/* Module 2: Barcode print engine panel */}
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 relative hover:border-[#fbbf24]/20 transition-all duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <Printer className="w-6 h-6 text-[#fbbf24]" />
                <h2 className="text-lg font-black text-white">بوابة طباعة وتوليد الباركود الذرّي</h2>
              </div>
              <span className="text-[10px] bg-[#fbbf24]/10 text-[#fbbf24] px-2 py-1 rounded-lg border border-[#fbbf24]/20 font-bold">Barcode Engine</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-6 space-y-2">
                <label className="text-xs text-gray-400 font-bold block">اختر صنفاً من المخزن:</label>
                <select 
                  value={selectedProduct} 
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-[#151515] text-[#fbbf24] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#fbbf24] focus:outline-none"
                >
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id} className="bg-[#111]">{item.name} ({item.price} - {item.category})</option>
                  ))}
                  {inventory.length === 0 && <option value="">لا توجد سلع مسجلة</option>}
                </select>
              </div>

              <div className="md:col-span-3 space-y-2">
                <label className="text-xs text-gray-400 font-bold block">عدد الملصقات للطباعة:</label>
                <input 
                  type="number" 
                  value={barcodeCount} 
                  onChange={(e) => setBarcodeCount(Math.max(1, Number(e.target.value)))}
                  min="1" 
                  max="100"
                  className="w-full bg-[#151515] text-[#fbbf24] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#fbbf24] focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <button 
                  onClick={handlePrintProductBarcode}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  طباعة الصنف المحدد
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/5">
              <button 
                onClick={handlePrintLastInvoiceBarcodes}
                disabled={loading}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold py-3 px-6 rounded-xl hover:border-[#fbbf24]/50 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Printer className="w-4 h-4 text-[#fbbf24]" />
                طباعة باركود الفاتورة الأخيرة للمحل
              </button>

              <button 
                onClick={() => {
                  setLoading(true);
                  InventoryCore.BarcodeEngine('LAST_MONTH').finally(() => setLoading(false));
                }}
                disabled={loading}
                className="flex-1 bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/30 font-bold py-3 px-6 rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
              >
                توليد باركود سلع الـ 30 يوماً الماضية
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Owner Controls & Audits */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Module 3: Security & Owner Gate */}
          <div className="bg-[#0f0f0f] border border-[#fbbf24]/20 rounded-3xl p-6 space-y-6 relative shadow-lg">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <ShieldAlert className="w-6 h-6 text-[#fbbf24]" />
              <div>
                <h2 className="text-md font-black text-white leading-none">بوابة المالك والامتيازات</h2>
                <span className="text-[10px] text-gray-500 font-mono">OWNER CONTROL SYSTEM</span>
              </div>
            </div>

            {/* Toggle Status */}
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
              <div>
                <span className="text-xs text-white font-bold block">سلامة صور المعروضات المتعددة</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">صلاحية تفعيل الرفع التلقائي متعدد الملفات</span>
              </div>
              <button 
                onClick={() => handleToggleMultiImage(!multiImageStatus)}
                className={`w-12 h-6 rounded-full p-1 transition-all duration-300 focus:outline-none ${multiImageStatus ? 'bg-[#fbbf24]' : 'bg-neutral-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-black transition-all duration-300 ${multiImageStatus ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <button 
              onClick={handleFixPricingTypo}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black font-black py-3 px-4 rounded-xl shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sliders className="w-4 h-4" />
              فحص وتصحيح الأسعار الخاطئة
            </button>
          </div>

          {/* Module 4: Live Inventory Audit Logs */}
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-[#fbbf24]" />
                <h2 className="text-md font-black text-white">إحصائيات التدقيق والجرد</h2>
              </div>
              <button 
                onClick={handleRunSystemAudit}
                disabled={loading}
                className="px-3 py-1.5 bg-[#fbbf24] text-black font-bold rounded-lg text-xs hover:bg-[#fb923c] transition-all flex items-center gap-1.5"
              >
                <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                جرد شامل جديد
              </button>
            </div>

            {auditStats ? (
              <div className="space-y-4 animate-fade-in text-sm">
                <div className="grid grid-cols-2 gap-3 text-right">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-gray-400 block">إجمالي المنتجات</span>
                    <span className="text-md font-extrabold text-white">{auditStats.totalProducts}</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-gray-400 block">إجمالي القطع الكلية</span>
                    <span className="text-md font-extrabold text-[#fbbf24]">{auditStats.totalAggregateStock}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-[#fbbf24]/5 border border-[#fbbf24]/10 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">قيمة الأصول (مبيعات):</span>
                    <span className="font-bold text-white">{auditStats.inventoryAssetsRetail.toLocaleString()} YER</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">تكلفة الأصول الإجمالية:</span>
                    <span className="font-bold text-white">{auditStats.inventoryAssetsCost.toLocaleString()} YER</span>
                  </div>
                  <div className="flex justify-between border-t border-[#fbbf24]/10 pt-1.5 mt-1">
                    <span className="text-[#fbbf24] font-black">صافي الأرباح المتوقعة:</span>
                    <span className="font-extrabold text-[#fbbf24]">{auditStats.projectedNetProfit.toLocaleString()} YER</span>
                  </div>
                </div>

                {auditStats.anomaliesCount > 0 ? (
                  <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl text-xs space-y-1.5 text-rose-400">
                    <div className="flex items-center gap-1 text-xs font-black">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      كشف {auditStats.anomaliesCount} ثغرة/شائبة في التسعير أو الأرصفة:
                    </div>
                    <ul className="list-disc pr-4 space-y-1 text-[11px] opacity-90 text-right">
                      {auditStats.anomaliesFoundList.map((a: string, idx: number) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    خالي من الثغرات الأمنية أو شوائب الرصيد المالي
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-500 text-xs text-right">
                انقر على جرد شامل جديد لتشغيل خوارزميات التدقيق الذكية وعرض إحصاءات الجرد التفصيلية.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
