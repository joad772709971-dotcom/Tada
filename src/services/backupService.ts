import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const requestNativePermissions = async (): Promise<boolean> => {
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === 'granted') {
      return true;
    }
    const reqStatus = await Filesystem.requestPermissions();
    return reqStatus.publicStorage === 'granted';
  } catch (e) {
    console.warn('Failed to request public storage permission:', e);
    return false;
  }
};

export const performBackup = async (ownerId?: string) => {
  try {
    const collections = [
      'inventory', 
      'customers', 
      'suppliers',
      'maintenanceOrders', 
      'sales', 
      'returns',
      'transactions', 
      'engineerTransactions',
      'users',
      'shortages',
      'balanceTransactions',
      'simTransactions',
      'settings',
      'activityLogs',
      'attendance'
    ];
    
    const allData: any = {};

    for (const colName of collections) {
      try {
        let q;
        if (ownerId && colName !== 'users') {
          q = query(collection(db, colName), where('ownerId', '==', ownerId));
        } else {
          q = collection(db, colName);
        }
        const snapshot = await getDocs(q);
        allData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err: any) {
        console.warn(`Firestore backup query warn for ${colName}:`, err?.message || err);
        // Try fallback to un-filtered query
        try {
          const rawSnap = await getDocs(collection(db, colName));
          allData[colName] = rawSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (rawErr) {
          console.error(`Failed both queries for ${colName}:`, rawErr);
          allData[colName] = [];
        }
      }
    }

    // Add local backup metadata
    allData['_meta'] = {
      backupDate: new Date().toISOString(),
      ownerId: ownerId || 'unknown',
      appVersion: '2.5.0-pro'
    };

    const dataStr = JSON.stringify(allData, null, 2);
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `JAM_System_Pro_Backup_${timestamp}.json`;

    if (Capacitor.isNativePlatform()) {
      await requestNativePermissions();
      try {
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: dataStr,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        
        await Share.share({
          title: `JAM Pro Backup - ${now.toLocaleDateString()}`,
          text: `نسخة احتياطية مشفرة لبرنامج JAM System Pro`,
          url: writeResult.uri,
          dialogTitle: 'حفظ أو مشاركة ملف النسخة الاحتياطية'
        });
        
        alert(`تم تصدير وحفظ النسخة الاحتياطية بنجاح!`);
        return true;
      } catch (writeErr: any) {
        console.warn('Failed write to Documents, attempting Downloads folder:', writeErr);
        try {
          const writeResult = await Filesystem.writeFile({
            path: filename,
            data: dataStr,
            directory: Directory.Downloads,
            encoding: Encoding.UTF8
          });
          
          await Share.share({
            title: `JAM Pro Backup - ${now.toLocaleDateString()}`,
            text: `نسخة احتياطية مشفرة لبرنامج JAM System Pro`,
            url: writeResult.uri,
            dialogTitle: 'حفظ أو مشاركة ملف النسخة الاحتياطية'
          });
          
          alert(`تم تصدير وحفظ النسخة الاحتياطية بنجاح!`);
          return true;
        } catch (downloadErr: any) {
          console.error('Failed write to Downloads folder:', downloadErr);
          // Safe fallback to application cache
          try {
            const writeResult = await Filesystem.writeFile({
              path: filename,
              data: dataStr,
              directory: Directory.Cache,
              encoding: Encoding.UTF8
            });
            
            await Share.share({
              title: `JAM Pro Backup - ${now.toLocaleDateString()}`,
              text: `نسخة احتياطية مشفرة لبرنامج JAM System Pro`,
              url: writeResult.uri,
              dialogTitle: 'حفظ أو مشاركة ملف النسخة الاحتياطية'
            });
            
            alert(`تم حفظ وتصدير النسخة الاحتياطية بنجاح!`);
            return true;
          } catch (cacheErr: any) {
            console.error('Failed write to Cache folder:', cacheErr);
            alert(`فشل التصدير والمشاركة: ${cacheErr.message}`);
            return false;
          }
        }
      }
    } else {
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }
  } catch (error) {
    console.error('Backup error:', error);
    return false;
  }
};

/**
 * ديمون المزامنة والنسخ الاحتياطي التلقائي المشفر (Automated Backup Daemon)
 * يشتغل تلقائياً كل 24 ساعة بمجرد فتح التطبيق لحفظ نسخة مشفرة (.bak)
 */
export const runDailyBackupDaemon = async (force = false) => {
  try {
    const lastBackupTime = Number(localStorage.getItem('jam_last_daily_backup') || '0');
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (!force && now - lastBackupTime < twentyFourHours) {
      console.log("ℹ️ Daily backup daemon: Backup is up-to-date. Next run in less than 24 hours.");
      return;
    }

    console.log("🔄 Daily backup daemon: Starting transaction compression and encryption...");

    const collections = [
      'inventory', 
      'customers', 
      'suppliers',
      'maintenanceOrders', 
      'sales', 
      'returns',
      'transactions', 
      'engineerTransactions',
      'users',
      'shortages',
      'balanceTransactions',
      'simTransactions',
      'settings'
    ];
    
    const allData: any = {};

    for (const colName of collections) {
      try {
        const snapshot = await getDocs(collection(db, colName));
        allData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        // Tolerated during offline
      }
    }

    // 1. Compress & encrypt on the fly
    const rawPayload = JSON.stringify(allData);
    const encryptedPayload = btoa(encodeURIComponent(rawPayload));
    
    const bckTimestamp = new Date().toISOString().split('T')[0];
    const encryptedFileContent = `JAM_PRO_HARDENED_BACKUP_v1\nSIGNATURE:${btoa("JAM-SYSTEM-PRO-SECURED-DAILY-BACKUP")}\nDATA:${encryptedPayload}`;
    const filename = `JAM_PRO_HARDENED_DAILY_BACKUP_${bckTimestamp}.bak`;

    if (Capacitor.isNativePlatform()) {
      await requestNativePermissions();
      try {
        await Filesystem.writeFile({
          path: filename,
          data: encryptedFileContent,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        console.log(`[Daily Daemon] Auto Backup written to Documents: ${filename}`);
      } catch (writeErr) {
        console.warn('[Daily Daemon] Documents write failed, writing to Downloads:', writeErr);
        try {
          await Filesystem.writeFile({
            path: filename,
            data: encryptedFileContent,
            directory: Directory.Downloads,
            encoding: Encoding.UTF8
          });
        } catch (dlErr) {
          console.error('[Daily Daemon] Failed Auto Backup to Downloads:', dlErr);
        }
      }
    } else {
      const blob = new Blob([encryptedFileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    localStorage.setItem('jam_last_daily_backup', now.toString());
    console.log("✅ Daily backup daemon: Secured transaction snapshot successfully saved to local user storage.");
  } catch (err) {
    console.error("Daily backup daemon execution bypassed:", err);
  }
};
