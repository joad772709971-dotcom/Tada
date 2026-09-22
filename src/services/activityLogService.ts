import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type ActivityType = 
  | 'login' 
  | 'logout' 
  | 'add_item' 
  | 'update_item' 
  | 'delete_item' 
  | 'add_sale' 
  | 'delete_sale' 
  | 'update_price' 
  | 'add_maintenance' 
  | 'update_maintenance'
  | 'delete_maintenance'
  | 'restore_backup';

interface LogData {
  type: ActivityType;
  userId: string;
  userName: string;
  ownerId: string;
  details: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
}

// Compatible wrapper for existing calls
export const logActivity = async (profileOrObject: any, action?: string, details?: string) => {
  // If first parameter is an object with 'action' and ('description' or 'details')
  if (profileOrObject && typeof profileOrObject === 'object' && ('action' in profileOrObject || 'description' in profileOrObject)) {
    const obj = profileOrObject;
    const finalAction = obj.action || 'تحرك مخزني/إداري';
    const finalDetails = obj.description || obj.details || '';
    const ownerId = obj.ownerId || 'system';
    const userName = obj.operatedBy || obj.userName || 'غير معروف';
    const userId = obj.userId || obj.uid || 'system';

    let type: ActivityType = 'add_item';
    if (finalAction.includes('سعر') || finalAction.includes('تسعير')) {
      type = 'update_price';
    } else if (finalAction.includes('بيع') || finalAction.includes('فاتورة') || finalAction.includes('مرتجع')) {
      type = 'add_sale';
    } else if (finalAction.includes('حذف')) {
      type = 'delete_sale';
    } else if (finalAction.includes('صيانة')) {
      type = 'add_maintenance';
    } else if (finalAction.includes('تعديل') || finalAction.includes('تحديث')) {
      type = 'update_item';
    }

    return logActivityDetailed({
      type,
      userId,
      userName,
      ownerId,
      details: finalDetails ? `${finalAction}: ${finalDetails}` : finalAction,
      metadata: {
        actionName: finalAction,
        timestamp: obj.timestamp || new Date().toISOString()
      }
    });
  }

  // Otherwise, handle the standard (profile, action, details)
  if (!profileOrObject?.ownerId) return;
  
  let type: ActivityType = 'add_item';
  const act = action || '';
  if (act.includes('سعر') || act.includes('تسعير')) {
    type = 'update_price';
  } else if (act.includes('بيع') || act.includes('مرتجع') || act.includes('فاتورة')) {
    type = 'add_sale';
  } else if (act.includes('حذف')) {
    type = 'delete_sale';
  } else if (act.includes('صيانة')) {
    type = 'add_maintenance';
  } else if (act.includes('تعديل') || act.includes('تحديث')) {
    type = 'update_item';
  }

  return logActivityDetailed({
    type,
    userId: profileOrObject.uid || profileOrObject.id || 'system',
    userName: profileOrObject.name || 'غير معروف',
    ownerId: profileOrObject.ownerId,
    details: details || ''
  });
};

// Improved logging for financial and operational oversight
export const logActivityDetailed = async (data: LogData) => {
  try {
    // Add additional context if missing
    const enrichedData = {
      ...data,
      metadata: {
        ...data.metadata,
        browser: navigator.userAgent,
        timestamp: Date.now()
      },
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'activityLogs'), enrichedData);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Specifically for state changes (e.g. status updates)
 */
export const logStateChange = async (profile: any, type: ActivityType, details: string, oldValue: any, newValue: any) => {
  return logActivityDetailed({
    type,
    userId: profile.uid,
    userName: profile.name,
    ownerId: profile.ownerId,
    details,
    oldValue,
    newValue
  });
};
