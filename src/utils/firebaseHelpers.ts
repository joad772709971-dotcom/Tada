import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { StoreBranding, AuctionItem, RepairPrice, RepairTicket, Giveaway } from '../types';
import { demoStores } from './demoData';

// Helper to check if database has stores and bootstrap if empty
export async function bootstrapStoresIfNeeded(): Promise<boolean> {
  const storesPath = 'stores';
  try {
    // Ensure the testing credentials and codes exist regardless of whether stores are already bootstrapped
    const userDocRef = doc(db, 'users', '777000000');
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      await setDoc(userDocRef, {
        phone: '777000000',
        name: 'جواد عبده الملكي',
        password: '123456',
        isFirstLogin: true,
        points: 1250,
        activated_stores: ['al-fuji']
      });
    }

    // Ensure the 'shammrani' test activation code is present
    const codeDocRef = doc(db, 'stores', 'shammrani', 'activationCodes', '12345678');
    const codeSnap = await getDoc(codeDocRef);
    if (!codeSnap.exists()) {
      await setDoc(codeDocRef, {
        code: '12345678',
        createdAt: new Date().toISOString(),
        customerPhone: '777000000',
        isUsed: false
      });
    }

    const snap = await getDocs(collection(db, storesPath));
    if (!snap.empty) {
      return false; // Already bootstrapped
    }
    
    console.log('Database is empty. Bootstrapping dynamic multi-tenant stores...');
    for (const item of demoStores) {
      const storeId = item.store.id;
      
      // 1. Create store profile with status active
      const storeWithStatus = {
        ...item.store,
        storeStatus: 'active' as const
      };
      await setDoc(doc(db, 'stores', storeId), storeWithStatus);
      
      // 2. Add auctions
      for (const auc of item.auctions) {
        await setDoc(doc(db, 'stores', storeId, 'auctions', auc.id), auc);
      }
      
      // 3. Add repair prices
      for (const rp of item.repairPrices) {
        await setDoc(doc(db, 'stores', storeId, 'repairPrices', rp.id), rp);
      }
      
      // 4. Add repairs
      for (const rep of item.repairs) {
        await setDoc(doc(db, 'stores', storeId, 'repairs', rep.id), rep);
      }
      
      // 5. Add giveaways
      for (const giv of item.giveaways) {
        await setDoc(doc(db, 'stores', storeId, 'giveaways', giv.id), giv);
      }
    }
    console.log('Bootstrapping of all 2 demo stores completed successfully.');
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('offline')) {
      console.warn('Silent bootstrapping delay: Client is offline, will load cached or fallback collections.');
    } else {
      console.warn('Failed to bootstrap stores (normal if server restricted):', err);
    }
    // Silent fail so we can still allow guest or custom inputs
    return false;
  }
}

// Fetch all stores across stores, shops, and b2bStoreProfiles collections for complete multi-app visibility
export async function getStoresList(): Promise<StoreBranding[]> {
  const storeMap = new Map<string, StoreBranding>();

  // 1. Fetch from stores collection
  try {
    const snap = await getDocs(collection(db, 'stores'));
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      storeMap.set(docSnap.id, { id: docSnap.id, ...data } as StoreBranding);
    });
  } catch (error) {
    console.warn('Note reading stores collection:', error);
  }

  // 2. Fetch from shops collection (where programmer dashboard stores shop accounts)
  try {
    const snapShops = await getDocs(collection(db, 'shops'));
    snapShops.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      const ownerId = data.ownerId || id;
      
      const branding: StoreBranding = {
        id: id,
        name: data.shopName || data.name || 'متجر معتمد',
        storeStatus: (data.status === 'suspended' || data.status === 'blocked') ? 'suspended' : 'active',
        phone: data.phone || data.shopPhone || '',
        address: data.address || data.shopAddress || data.location || '',
        ...data
      } as any;

      if (!storeMap.has(id)) {
        storeMap.set(id, branding);
      }
      if (ownerId && !storeMap.has(ownerId)) {
        storeMap.set(ownerId, { ...branding, id: ownerId });
      }
    });
  } catch (error) {
    console.warn('Note reading shops collection:', error);
  }

  // 3. Fetch from b2bStoreProfiles
  try {
    const snapB2b = await getDocs(collection(db, 'b2bStoreProfiles'));
    snapB2b.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      if (!storeMap.has(id)) {
        storeMap.set(id, {
          id: id,
          name: data.storeName || data.shopName || 'متجر جملة',
          storeStatus: 'active',
          phone: data.phone || '',
          ...data
        } as any);
      }
    });
  } catch (error) {
    console.warn('Note reading b2bStoreProfiles collection:', error);
  }

  return Array.from(storeMap.values());
}

// Fetch single store details
export async function getStoreBySlug(storeId: string): Promise<StoreBranding | null> {
  const pathVal = `stores/${storeId}`;
  try {
    const snap = await getDoc(doc(db, 'stores', storeId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as StoreBranding;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pathVal);
  }
}

// Fetch auctions for store
export async function getStoreAuctions(storeId: string): Promise<AuctionItem[]> {
  const pathVal = `stores/${storeId}/auctions`;
  try {
    const snap = await getDocs(collection(db, 'stores', storeId, 'auctions'));
    const list: AuctionItem[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as AuctionItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathVal);
  }
}

// Fetch repair prices catalogue
export async function getStoreRepairPrices(storeId: string): Promise<RepairPrice[]> {
  const pathVal = `stores/${storeId}/repairPrices`;
  try {
    const snap = await getDocs(collection(db, 'stores', storeId, 'repairPrices'));
    const list: RepairPrice[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as RepairPrice);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathVal);
  }
}

// Search check for repair tickets by ticket code
export async function searchRepairTicket(storeId: string, ticketNumber: string): Promise<RepairTicket | null> {
  const pathVal = `stores/${storeId}/repairs`;
  try {
    const q = query(
      collection(db, 'stores', storeId, 'repairs'),
      where('ticketNumber', '==', ticketNumber.trim().toUpperCase())
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const firstDoc = snap.docs[0];
      return { id: firstDoc.id, ...firstDoc.data() } as RepairTicket;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathVal);
  }
}

// Fetch giveaways
export async function getStoreGiveaways(storeId: string): Promise<Giveaway[]> {
  const pathVal = `stores/${storeId}/giveaways`;
  try {
    const snap = await getDocs(collection(db, 'stores', storeId, 'giveaways'));
    const list: Giveaway[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Giveaway);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathVal);
  }
}

// Submit Live Bid
export async function placeBidOnAuction(
  storeId: string,
  auctionId: string,
  amount: number,
  bidderName: string,
  bidderUid: string
): Promise<void> {
  const pathVal = `stores/${storeId}/auctions/${auctionId}`;
  try {
    const docRef = doc(db, 'stores', storeId, 'auctions', auctionId);
    await updateDoc(docRef, {
      currentBid: amount,
      highestBidder: bidderName,
      highestBidderUid: bidderUid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathVal);
  }
}

// Register user for Giveaway
export async function joinStoreGiveaway(
  storeId: string,
  giveawayId: string,
  uid: string,
  displayName: string,
  email: string
): Promise<void> {
  const participantPath = `stores/${storeId}/giveaways/${giveawayId}/participants/${uid}`;
  const giveawayPath = `stores/${storeId}/giveaways/${giveawayId}`;
  try {
    // 1. Write the participant entry (to respect the unique keys and path guidelines)
    const partRef = doc(db, 'stores', storeId, 'giveaways', giveawayId, 'participants', uid);
    await setDoc(partRef, {
      uid,
      displayName,
      email,
      joinedAt: new Date().toISOString()
    });

    // 2. Increment participant count on the giveaway document
    const givRef = doc(db, 'stores', storeId, 'giveaways', giveawayId);
    await updateDoc(givRef, {
      participantsCount: increment(1)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, participantPath);
  }
}

// Custom store creator for demo (lets user create any tenant programmatically in Firestore!)
export async function createDemoCustomTenant(store: StoreBranding): Promise<void> {
  const pathVal = `stores/${store.id}`;
  try {
    await setDoc(doc(db, 'stores', store.id), store);
    
    // Add default mock items to the custom store for an instant nice experience
    const initialPrice: RepairPrice = {
      id: `rp_${store.id}_1`,
      device: 'سلسلة آيفون 15 بروماكس',
      issue: 'تغيير الشاشة الخلفية بالليزر الفوري',
      price: 490,
      timeEstimated: '1 ساعة'
    };
    await setDoc(doc(db, 'stores', store.id, 'repairPrices', initialPrice.id), initialPrice);

    const initialAuction: AuctionItem = {
      id: `auc_${store.id}_1`,
      title: 'هاتف مميز نظيف للتجربة والتقييم',
      description: 'تم تصميمه خصيصاً لاختبار آلية الحراج المباشر والتحديثات الفورية في فايربيس للمتجر الجديد.',
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=300',
      currentBid: 500,
      highestBidder: 'فريق تجربة JAM Pro',
      highestBidderUid: 'demo_developer',
      minIncrement: 20,
      endsAt: new Date(Date.now() + 1000 * 60 * 300).toISOString(),
      status: 'active'
    };
    await setDoc(doc(db, 'stores', store.id, 'auctions', initialAuction.id), initialAuction);

    const initialTicket: RepairTicket = {
      id: `rep_${store.id}_1`,
      customerName: 'مشعل محمد',
      phone: '0502221111',
      device: 'متوفر للاختبار الصيانة',
      issue: 'إصلاح الصوت ومكبر الصوت السفلي للجهاز',
      ticketNumber: 'JAM-9999',
      status: 'ready',
      cost: 150,
      notes: 'تم الإصلاح السريع والتنظيف مجاناً للمهندس.'
    };
    await setDoc(doc(db, 'stores', store.id, 'repairs', initialTicket.id), initialTicket);

    const initialGiveaway: Giveaway = {
      id: `giv_${store.id}_1`,
      title: 'مسابقة التفعيل الجديد للمتجر',
      description: 'مسابقة ترحيبية أوتوماتيكية للزوار ومستخدمي المتجر الجدد.',
      prize: 'شاحن جداري ذكي بقوة 65 واط سريع الشحن',
      endsAt: new Date(Date.now() + 1000 * 60 * 1440 * 5).toISOString(),
      participantsCount: 1,
      status: 'active'
    };
    await setDoc(doc(db, 'stores', store.id, 'giveaways', initialGiveaway.id), initialGiveaway);

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathVal);
  }
}

// Fetch external store list for a given phone using Cross-Project Architecture
export async function fetchExternalStoreData(userPhone: string): Promise<string[]> {
  const cleanPhone = userPhone.trim().replace(/[^0-9]/g, '');
  const configEnv = (import.meta as any).env || {};
  
  // 1. Check if secondary API Gateway route is configured in environment variables
  const crossProjectApi = configEnv.VITE_SECONDARY_ACCOUNTING_API_URL;
  if (crossProjectApi && crossProjectApi.trim().length > 0) {
    try {
      console.log(`Connecting to external accounting system API: ${crossProjectApi}`);
      const res = await fetch(crossProjectApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone })
      });
      if (res.ok) {
        const data = await res.json();
        // Assume API returns a list of matched storeIds e.g. ["al-fuji", "shammari"]
        if (data && Array.isArray(data.storeIds)) {
          return data.storeIds;
        }
      }
    } catch (e) {
      console.warn('Cross-project api error, falling back:', e);
    }
  }

  // 2. Check if secondary Firebase project is configured
  const secApiKey = configEnv.VITE_SECONDARY_FIREBASE_API_KEY;
  const secProjectId = configEnv.VITE_SECONDARY_FIREBASE_PROJECT_ID;
  if (secApiKey && secApiKey.trim().length > 0 && secProjectId && secProjectId.trim().length > 0) {
    try {
      console.log(`Connecting to external Firestore instance in project: ${secProjectId}`);
      // Lazy-import or dynamic initialize secondary Firebase application
      const { initializeApp, getApps } = await import('firebase/app');
      const { getFirestore, collection, getDocs, query, where } = await import('firebase/firestore');
      
      const config = {
        apiKey: secApiKey,
        authDomain: configEnv.VITE_SECONDARY_FIREBASE_AUTH_DOMAIN,
        projectId: secProjectId,
        storageBucket: configEnv.VITE_SECONDARY_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: configEnv.VITE_SECONDARY_FIREBASE_MESSAGING_SENDER_ID,
        appId: configEnv.VITE_SECONDARY_FIREBASE_APP_ID
      };

      const hasApp = getApps().find(app => app.name === 'secondaryProject');
      const secApp = hasApp || initializeApp(config, 'secondaryProject');
      const secDb = getFirestore(secApp);

      // On the secondary project database, scan collection 'repairs' which relates clients to their tickets
      const q = query(collection(secDb, 'repairs'), where('phone', '==', cleanPhone));
      const snap = await getDocs(q);
      const matchedStoreIds: string[] = [];
      snap.forEach((doc) => {
        const rData = doc.data();
        if (rData.storeId && !matchedStoreIds.includes(rData.storeId)) {
          matchedStoreIds.push(rData.storeId);
        }
      });
      
      if (matchedStoreIds.length > 0) {
        return matchedStoreIds;
      }
    } catch (e) {
      console.warn('Cross-project Firebase Firestore connection error, falling back:', e);
    }
  }

  // 3. Resilient Fallback: If no cross-project credentials are in place yet (local testing sandbox),
  // search the local primary Firestore list or demoStores to maintain unbroken VIP interface usability.
  try {
    const all = await getStoresList();
    const matchedStoreIds: string[] = [];
    
    for (const store of all) {
      // Direct query check on primary stores collection
      const q = query(collection(db, 'stores', store.id, 'repairs'), where('phone', '==', cleanPhone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        matchedStoreIds.push(store.id);
      }
    }

    if (matchedStoreIds.length > 0) {
      return matchedStoreIds;
    }
  } catch (err) {
    console.warn('Primary fallback lookup failed:', err);
  }

  // If absolutely nothing is matched, return defaults so user has options to select
  return ['al-fuji', 'shammari'];
}

