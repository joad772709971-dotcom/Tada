import * as admin from 'firebase-admin';
import { auth } from 'firebase-functions/v1';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * 1. مشغل حذف المستخدم (Auth Trigger):
 * يعمل تلقائياً عند مسح أي مستخدم من Firebase Authentication
 * يقوم بحذف وثيقته من الفهرس السريع user_index وبياناته من المحل shops/{shopId}/users/{uid}
 */
export const onUserAuthDeleted = auth.user().onDelete(async (user) => {
  const uid = user.uid;
  console.log(`[AUTH TRIGGER] جاري حذف سجلات المستخدم: ${uid} (البريد: ${user.email})`);

  try {
    // 1. استعلام الفهرس السريع لمعرفة المحل التابع له
    const userIndexRef = db.collection('user_index').doc(uid);
    const userIndexDoc = await userIndexRef.get();

    let shopId: string | null = null;
    if (userIndexDoc.exists) {
      const data = userIndexDoc.data();
      shopId = data?.shopId || null;
    }

    // 2. إذا تم العثور على المحل، نقوم بمسح سجل المستخدم من داخل المحل
    if (shopId) {
      const shopUserRef = db.collection('shops').doc(shopId).collection('users').doc(uid);
      await shopUserRef.delete();
      console.log(`[AUTH TRIGGER] تم مسح المستخدم ${uid} من متجر ${shopId}`);
    } else {
      // محاولة البحث في جميع المحلات إذا لم يكن مسجلاً في الفهرس
      const shopsSnapshot = await db.collection('shops').get();
      const deletePromises: Promise<any>[] = [];
      
      for (const shopDoc of shopsSnapshot.docs) {
        const userInShopRef = shopDoc.ref.collection('users').doc(uid);
        deletePromises.push(
          userInShopRef.get().then((uSnap) => {
            if (uSnap.exists) {
              return uSnap.ref.delete();
            }
            return null;
          })
        );
      }
      await Promise.all(deletePromises);
    }

    // 3. مسح وثيقة الفهرس العام
    if (userIndexDoc.exists) {
      await userIndexRef.delete();
    }

    // 4. مسح وثيقة المستخدم من مجموعة users العامة إذا وجدت
    const publicUserRef = db.collection('users').doc(uid);
    const publicUserSnap = await publicUserRef.get();
    if (publicUserSnap.exists) {
      await publicUserRef.delete();
    }

    console.log(`✅ [AUTH TRIGGER] اكتمل مسح كافة بيانات المستخدم ${uid} بنجاح.`);
  } catch (error) {
    console.error(`❌ [AUTH TRIGGER] فشل تنظيف بيانات المستخدم ${uid}:`, error);
  }
});

/**
 * 2. مشغل الحذف المتسلسل للمحل (Cascade Delete):
 * يعمل تلقائياً عند مسح أي محل من shops/{shopId}
 * يقوم بمسح جميع السجلات التابعة له في المجموعات الفرعية (users, transactions, inventory, accounts)
 */
export const onShopDeleted = onDocumentDeleted('shops/{shopId}', async (event) => {
  const shopId = event.params.shopId;
  console.log(`[CASCADE DELETE] بدء الحذف المتسلسل الشامل لبيانات المحل: ${shopId}`);

  try {
    const shopRef = db.collection('shops').doc(shopId);

    // قائمة المجموعات الفرعية المرتبطة بالمحل
    const subcollections = [
      'users',
      'transactions',
      'inventory',
      'accounts',
      'vaults',
      'orders',
      'drafts',
      'invoices'
    ];

    // حذف جميع المستندات في المجموعات الفرعية
    for (const subName of subcollections) {
      const collRef = shopRef.collection(subName);
      await deleteCollectionRecursively(collRef, 200);
      console.log(`[CASCADE DELETE] تم تنظيف المجموعة الفرعية ${subName} للمحل ${shopId}`);
    }

    // تنظيف الفهرس السريع user_index لجميع المستخدمين الذين كانوا ينتمون لهذا المحل
    const userIndexQuery = db.collection('user_index').where('shopId', '==', shopId);
    const usersSnapshot = await userIndexQuery.get();
    if (!usersSnapshot.empty) {
      const batch = db.batch();
      usersSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`[CASCADE DELETE] تم تنظيف ${usersSnapshot.size} سجل مستخدم من user_index للمحل ${shopId}`);
    }

    console.log(`✅ [CASCADE DELETE] اكتمل الحذف المتسلسل الشامل للمحل ${shopId} بنجاح.`);
  } catch (error) {
    console.error(`❌ [CASCADE DELETE] خطأ أثناء حذف ملحقات المحل ${shopId}:`, error);
  }
});

/**
 * دالة مساعدة لحذف جميع مستندات المجموعة بشكل دفعي (Batch Deletion)
 */
async function deleteCollectionRecursively(
  collectionRef: admin.firestore.CollectionReference,
  batchSize: number = 200
): Promise<void> {
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });

  async function deleteQueryBatch(
    q: admin.firestore.Query,
    res: (value: void | PromiseLike<void>) => void,
    rej: (reason?: any) => void
  ) {
    try {
      const snapshot = await q.get();

      if (snapshot.size === 0) {
        res();
        return;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      // التكرار حتى تفريغ المجموعة بالكامل
      process.nextTick(() => {
        deleteQueryBatch(q, res, rej);
      });
    } catch (err) {
      rej(err);
    }
  }
}
