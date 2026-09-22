import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  getDocs,
  query,
  where 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { networkGuardService } from './networkGuardService';

/**
 * فئات التجار الخمسة المعتمدة في النظام
 */
export type MerchantTier = 
  | 'importer'           // مستورد
  | 'wholesaler_master'  // جملة الجملة
  | 'wholesaler'         // جملة
  | 'retail'             // تجزئة
  | 'citizen';           // مواطنين

export const MERCHANT_TIER_LABELS: Record<MerchantTier, string> = {
  importer: 'مستورد',
  wholesaler_master: 'جملة الجملة',
  wholesaler: 'تاجر جملة',
  retail: 'تاجر تجزئة',
  citizen: 'مواطن / مستهلك'
};

export interface ShopRegistrationData {
  shopId?: string;
  name: string;
  tier: MerchantTier;
  phone?: string;
  city?: string;
  address?: string;
  businessType?: string;
  ownerUid?: string;
  ownerName?: string;
  ownerEmail?: string;
  subscriptionStatus?: 'active' | 'trial' | 'expired' | 'suspended';
  subscriptionPlan?: string;
  currency?: string;
}

export interface UserIndexRecord {
  uid: string;
  shopId: string;
  role: 'admin' | 'accountant' | 'cashier' | 'sales' | 'staff';
  tier: MerchantTier;
  email?: string;
  name?: string;
  updatedAt?: any;
}

/**
 * خدمة تسجيل وإنشاء وإدارة المحلات وفئات التجار الخمسة مع الربط التلقائي في user_index
 */
export class ShopRegistrationService {
  /**
   * إنشاء وتسجيل محل جديد مع ربط المالك في الفهرس السريع user_index
   */
  static async registerShop(data: ShopRegistrationData): Promise<{ shopId: string; success: boolean }> {
    // 🛡️ اشتراط الاتصال بالإنترنت عند إنشاء محل جديد
    networkGuardService.assertOnline('create_shop');

    try {
      const currentUser = auth.currentUser;
      const ownerUid = data.ownerUid || currentUser?.uid || `owner_${Date.now()}`;
      const shopId = data.shopId || `shop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      // 1. إنشاء وثيقة المحل الرئيسية shops/{shopId}
      const shopRef = doc(db, 'shops', shopId);
      const shopPayload = {
        id: shopId,
        name: data.name,
        tier: data.tier,
        ownerUid,
        ownerName: data.ownerName || currentUser?.displayName || 'المالك',
        ownerEmail: data.ownerEmail || currentUser?.email || '',
        phone: data.phone || '',
        city: data.city || 'صنعاء',
        address: data.address || '',
        businessType: data.businessType || 'general',
        subscriptionStatus: data.subscriptionStatus || 'trial',
        subscriptionPlan: data.subscriptionPlan || 'enterprise',
        currency: data.currency || 'YER',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isoCreatedAt: now
      };
      await setDoc(shopRef, shopPayload, { merge: true });

      // 2. إنشاء وثيقة المستخدم كمدير للمحل داخل shops/{shopId}/users/{ownerUid}
      const shopUserRef = doc(db, 'shops', shopId, 'users', ownerUid);
      const userPayload = {
        uid: ownerUid,
        shopId,
        role: 'admin',
        tier: data.tier,
        name: data.ownerName || currentUser?.displayName || 'المالك',
        email: data.ownerEmail || currentUser?.email || '',
        phone: data.phone || '',
        permissions: ['all', 'manage_users', 'manage_transactions', 'view_reports', 'settings'],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(shopUserRef, userPayload, { merge: true });

      // 3. تسجيل/تحديث الفهرس السريع user_index/{ownerUid} للربط الفوري وتأكيد العزل
      const userIndexRef = doc(db, 'user_index', ownerUid);
      const indexPayload: UserIndexRecord = {
        uid: ownerUid,
        shopId,
        role: 'admin',
        tier: data.tier,
        email: data.ownerEmail || currentUser?.email || '',
        name: data.ownerName || currentUser?.displayName || 'المالك',
        updatedAt: serverTimestamp()
      };
      await setDoc(userIndexRef, indexPayload, { merge: true });

      console.log(`✅ [ShopRegistrationService] تم تسجيل المحل بنجاح (${shopId}) للفئة: ${MERCHANT_TIER_LABELS[data.tier]}`);
      return { shopId, success: true };
    } catch (error) {
      console.error('❌ [ShopRegistrationService] خطأ أثناء تسجيل المحل:', error);
      throw error;
    }
  }

  /**
   * إضافة موظف أو محاسب إلى المحل وتوثيقه في user_index
   */
  static async addUserToShop(
    shopId: string, 
    userData: {
      uid: string;
      email: string;
      name: string;
      role: 'admin' | 'accountant' | 'cashier' | 'sales' | 'staff';
      permissions?: string[];
      phone?: string;
    }
  ): Promise<boolean> {
    // 🛡️ اشتراط الاتصال بالإنترنت عند تسجيل موظف جديد
    networkGuardService.assertOnline('create_user');

    try {
      // جلب بيانات المحل لمعرفة فئة التاجر (tier)
      const shopDoc = await getDoc(doc(db, 'shops', shopId));
      const shopData = shopDoc.data();
      const tier: MerchantTier = shopData?.tier || 'retail';

      // 1. إضافة الموظف لمجموعة المحل
      const userRef = doc(db, 'shops', shopId, 'users', userData.uid);
      await setDoc(userRef, {
        uid: userData.uid,
        shopId,
        role: userData.role,
        tier,
        email: userData.email,
        name: userData.name,
        phone: userData.phone || '',
        permissions: userData.permissions || ['create_vouchers', 'view_reports'],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. تحديث الفهرس السريع user_index
      const userIndexRef = doc(db, 'user_index', userData.uid);
      await setDoc(userIndexRef, {
        uid: userData.uid,
        shopId,
        role: userData.role,
        tier,
        email: userData.email,
        name: userData.name,
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log(`✅ [ShopRegistrationService] تم ربط الموظف ${userData.name} بالمحل ${shopId}`);
      return true;
    } catch (error) {
      console.error('❌ [ShopRegistrationService] فشل إضافة الموظف للمحل:', error);
      throw error;
    }
  }

  /**
   * استرجاع بيانات المحل للمستخدم عبر الفهرس السريع user_index/{userUid}
   */
  static async getUserShopInfo(userUid: string): Promise<{
    hasShop: boolean;
    shopId?: string;
    role?: string;
    tier?: MerchantTier;
    shopData?: any;
  }> {
    try {
      const indexDoc = await getDoc(doc(db, 'user_index', userUid));
      if (!indexDoc.exists()) {
        return { hasShop: false };
      }

      const indexData = indexDoc.data() as UserIndexRecord;
      const shopDoc = await getDoc(doc(db, 'shops', indexData.shopId));

      return {
        hasShop: true,
        shopId: indexData.shopId,
        role: indexData.role,
        tier: indexData.tier,
        shopData: shopDoc.exists() ? shopDoc.data() : null
      };
    } catch (error) {
      console.error('❌ [ShopRegistrationService] خطأ في جلب بيانات المحل للمستخدم:', error);
      return { hasShop: false };
    }
  }

  /**
   * تحديث حالة اشتراك المحل
   */
  static async updateShopSubscription(
    shopId: string, 
    status: 'active' | 'trial' | 'expired' | 'suspended'
  ): Promise<boolean> {
    try {
      const shopRef = doc(db, 'shops', shopId);
      await updateDoc(shopRef, {
        subscriptionStatus: status,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('❌ [ShopRegistrationService] فشل تحديث اشتراك المحل:', error);
      throw error;
    }
  }
}

/**
 * دالة مساعدة فورية لإنشاء وتسجيل محل جديد
 */
export const registerNewShop = async (data: ShopRegistrationData) => {
  return ShopRegistrationService.registerShop(data);
};
