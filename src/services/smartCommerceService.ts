import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  increment, 
  updateDoc, 
  Timestamp,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Auction, Bid, Complaint, Referral, InventoryItem, UserProfile, Lead, Quiz, QuizAttempt, PromoOffer, Booking } from '../types';

const assertValidMetadata = (ownerId?: string, phone?: string) => {
  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '' || ownerId === 'undefined' || ownerId === 'null') {
    throw new Error('فشل التحقق الأمني: معرف المتجر غير صالح أو غير معتمد.');
  }
  if (phone !== undefined) {
    const clean = phone.replace(/[\s\-\(\)]/g, '').trim();
    if (clean.length < 4 || !/^[0-9]+$/.test(clean)) {
      throw new Error('فشل التحقق الأمني: وثيقة برقم غير صالح أو غير حقيقي.');
    }
  }
};

const simpleHash = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return '0';
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(16);
};

export const smartCommerceService = {
  // 1. Lead Management
  getOrCreateLead: async (phone: string, ownerId: string, arg3?: string | null, arg4?: string, arg5?: string): Promise<Lead> => {
    if (!phone || !ownerId) throw new Error('Phone and OwnerId are strictly required');
    
    // Parse arguments: we support:
    // 1. (phone, ownerId, name, customPassword) -> arg3 = name, arg4 = customPassword
    // 2. (phone, ownerId, uid, name, customPassword) -> arg3 = uid, arg4 = name, arg5 = customPassword
    let uid: string | null = null;
    let name: string | undefined = undefined;
    let customPassword: string | undefined = undefined;

    if (arg3 !== undefined && arg3 !== null) {
      const isLikelyUid = /^[a-zA-Z0-9_-]{15,40}$/.test(arg3) && !arg3.includes(' ');
      if (isLikelyUid) {
        uid = arg3;
        name = arg4;
        customPassword = arg5;
      } else {
        name = arg3;
        customPassword = arg4;
      }
    }

    // 1. تشفير وتخليق المعرف الفريد والتحقق من وجود الحساب مسبقاً
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
    
    // التحقق المباشر من وجود حساب الزبون بالرقم في مجموعة الهويات الموحدة users
    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);

    let finalName = name || 'عميل VIP';
    let pass = customPassword || '123456';

    if (userSnap.exists()) {
      // الزبون لديه حساب مسبق في النظام
      const existingUserData = userSnap.data();
      const existingStores: string[] = Array.isArray(existingUserData.associatedStores) 
        ? [...existingUserData.associatedStores] 
        : (Array.isArray(existingUserData.linkedStores) ? [...existingUserData.linkedStores] : (existingUserData.ownerId ? [existingUserData.ownerId] : []));
      
      if (!existingStores.includes(ownerId)) {
        existingStores.push(ownerId);
      }

      pass = existingUserData.password || customPassword || '123456';
      finalName = name || existingUserData.name || 'عميل VIP';

      // تحديث مصفوفة associatedStores في حساب الزبون الموحد
      await setDoc(userRef, {
        associatedStores: existingStores,
        linkedStores: existingStores,
        name: finalName,
        role: existingUserData.role || 'CUSTOMER',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      // زبون جديد تماماً في النظام -> إنشاء الحساب الموحد
      const generatedPassword = customPassword || Math.floor(100000 + Math.random() * 900000).toString();
      pass = generatedPassword;
      finalName = name || 'عميل جديد VIP';
      const customerEmail = `${cleanPhone}@jam-pro.net`;

      // إنشاء حساب المستخدم الأساسي في مجموعة users فقط (الهوية الموحدة)
      await setDoc(userRef, {
        userId: cleanPhone,
        uid: cleanPhone,
        ownerId: ownerId,
        name: finalName,
        phone: cleanPhone,
        email: customerEmail,
        role: 'CUSTOMER',
        isProgramUser: false,
        status: 'ACTIVE',
        isActivated: true,
        associatedStores: [ownerId],
        linkedStores: [ownerId],
        primaryStoreId: ownerId,
        password: generatedPassword,
        passwordHash: simpleHash(generatedPassword),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // حفظ بيانات العميل المعزولة داخل المتجر الخاص به فقط: stores/{ownerId}/customers
    const targetCustId = `cust_${ownerId}_${cleanPhone}`;
    const storeCustRef = doc(db, 'stores', ownerId, 'customers', targetCustId);
    await setDoc(storeCustRef, {
      id: targetCustId,
      ownerId: ownerId,
      storeId: ownerId,
      name: finalName,
      phone: cleanPhone,
      status: 'active',
      password: pass,
      lastVisitAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { 
      id: targetCustId, 
      ownerId, 
      phone: cleanPhone, 
      name: finalName, 
      password: pass, 
      points: 0, 
      debt: 0 
    } as unknown as Lead;
  },

  /**
   * دالة التحقق المباشر عند تسجيل دخول الزبون للبوابة عبر الهويات الموحدة
   */
  verifyAndGetLead: async (phone: string, password: string, ownerId: string): Promise<Lead | null> => {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
    
    // 1. فحص الهوية الموحدة في users
    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const uData = userSnap.data();
      const associated = Array.isArray(uData.associatedStores) 
        ? uData.associatedStores 
        : (Array.isArray(uData.linkedStores) ? uData.linkedStores : []);
      
      const passMatch = uData.password === password.trim() || uData.currentPassword === password.trim();
      if (passMatch) {
        // تأكيد ارتباط الزبون بالمتجر
        if (!associated.includes(ownerId)) {
          associated.push(ownerId);
          await setDoc(userRef, { 
            associatedStores: associated, 
            linkedStores: associated,
            updatedAt: serverTimestamp() 
          }, { merge: true });
        }
        return {
          id: `cust_${ownerId}_${cleanPhone}`,
          ownerId,
          phone: cleanPhone,
          name: uData.name || 'عميل معتمد',
          password: password.trim(),
          points: uData.points || 0,
          debt: uData.debt || 0
        } as unknown as Lead;
      }
    }

    // 2. فحص سجل المتجر المعزول: stores/{ownerId}/customers
    const storeCustRef = doc(db, 'stores', ownerId, 'customers', `cust_${ownerId}_${cleanPhone}`);
    const storeCustSnap = await getDoc(storeCustRef);
    if (storeCustSnap.exists()) {
      const scData = storeCustSnap.data();
      if (scData.password === password.trim()) {
        return {
          id: storeCustSnap.id,
          ownerId,
          phone: cleanPhone,
          name: scData.name || 'عميل معتمد',
          password: password.trim(),
          points: scData.points || 0,
          debt: scData.debt || 0
        } as unknown as Lead;
      }
    }

    return null;
  },

  // 2. Quiz Logic
  submitQuiz: async (leadId: string, quizId: string, selectedIndex: number): Promise<{ success: boolean; points: number }> => {
    const [ownerId, phone] = leadId.split('_');
    assertValidMetadata(ownerId, phone);
    const attemptId = `${leadId}_${quizId}`;
    const attemptRef = doc(db, 'customer_quiz_attempts', attemptId);
    const attemptSnap = await getDoc(attemptRef);

    if (attemptSnap.exists()) {
      throw new Error('لقد قمت بالمشاركة في هذه المسابقة مسبقاً!');
    }

    const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
    if (!quizSnap.exists()) throw new Error('المسابقة غير موجودة');
    
    const quiz = quizSnap.data() as Quiz;
    const isCorrect = selectedIndex === quiz.correctIndex;
    const pointsEarned = isCorrect ? quiz.points : 0;

    const batch = writeBatch(db);
    batch.set(attemptRef, {
      leadId,
      quizId,
      isCorrect,
      pointsEarned,
      createdAt: serverTimestamp()
    });

    if (isCorrect) {
      batch.update(doc(db, 'leads', leadId), {
        points: increment(pointsEarned)
      });
    }

    await batch.commit();
    return { success: isCorrect, points: pointsEarned };
  },

  // 3. Offer Logic & Auto-revert
  createOffer: async (offer: Partial<PromoOffer>) => {
    const itemRef = doc(db, 'inventory', offer.itemId!);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) throw new Error('الصنف غير موجود في المخزن');
    
    const item = itemSnap.data() as InventoryItem;
    const newOffer = {
      ...offer,
      originalPrice: item.price,
      status: 'active',
      createdAt: serverTimestamp()
    };

    const batch = writeBatch(db);
    const offerRef = doc(collection(db, 'offers'));
    batch.set(offerRef, newOffer);
    
    // Immediate price update in inventory
    batch.update(itemRef, { price: offer.promoPrice });
    
    await batch.commit();
    return offerRef.id;
  },

  checkAndRevertExpiredOffers: async (ownerId: string) => {
    const now = new Date();
    const q = query(
      collection(db, 'offers'),
      where('ownerId', '==', ownerId),
      where('status', '==', 'active'),
      where('endTime', '<', now)
    );
    
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    for (const offerDoc of snap.docs) {
      const offer = offerDoc.data() as PromoOffer;
      // Revert price in inventory
      batch.update(doc(db, 'inventory', offer.itemId), { price: offer.originalPrice });
      // Mark offer as ended
      batch.update(offerDoc.ref, { status: 'ended' });
    }
    await batch.commit();
  },

  // 4. Booking Logic
  createBooking: async (booking: Partial<Booking>) => {
    assertValidMetadata(booking.ownerId, booking.customerPhone);
    const bookingRef = collection(db, 'bookings');
    const newBooking = {
      ...booking,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(bookingRef, newBooking);
    
    // Notification for manager
    await addDoc(collection(db, 'notifications'), {
      ownerId: booking.ownerId,
      title: 'طلب حجز جديد',
      message: `طلب العميل حجز صنف ${booking.itemName}. يرجى مراجعة الدفع.`,
      type: 'booking',
      read: false,
      createdAt: serverTimestamp()
    });

    return docRef.id;
  },

  approveBooking: async (bookingId: string) => {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) return;
    
    const booking = bookingSnap.data() as Booking;
    const batch = writeBatch(db);
    
    batch.update(bookingRef, { status: 'approved', updatedAt: serverTimestamp() });
    batch.update(doc(db, 'inventory', booking.itemId), {
      stock: increment(-1)
    });
    
    batch.set(doc(collection(db, 'activityLogs')), {
      ownerId: booking.ownerId,
      action: 'حجز صنف',
      description: `تمت الموافقة على حجز ${booking.itemName} من قبل عميل`,
      type: 'security',
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return true;
  },

  // 6. Auctions 2.0
  createAuction: async (auction: Partial<Auction>) => {
    const docRef = await addDoc(collection(db, 'auctions'), {
      ...auction,
      currentPrice: auction.startPrice,
      status: 'active',
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  placeBid: async (bid: Partial<Bid>) => {
    assertValidMetadata(bid.ownerId, bid.bidderPhone);
    const auctionRef = doc(db, 'auctions', bid.auctionId!);
    const auctionSnap = await getDoc(auctionRef);
    if (!auctionSnap.exists()) throw new Error('المزاد غير موجود');
    
    const auction = auctionSnap.data() as Auction;
    if (auction.status !== 'active') throw new Error('المزاد منتهي');
    if (bid.amount! < (auction.currentPrice + auction.minStep)) {
      throw new Error(`أقل مزايدة مقبولة هي ${auction.currentPrice + auction.minStep}`);
    }

    const batch = writeBatch(db);
    // 1. Add Bid record
    const bidRef = doc(collection(db, 'bids'));
    batch.set(bidRef, {
      ...bid,
      createdAt: serverTimestamp()
    });

    // 2. Update Auction current state
    batch.update(auctionRef, {
      currentPrice: bid.amount,
      highestBidderName: bid.bidderName,
      highestBidderPhone: bid.bidderPhone
    });

    await batch.commit();
    return true;
  },

  // 7. Complaints & Feedback
  submitComplaint: async (complaint: Partial<Complaint>) => {
    assertValidMetadata(complaint.ownerId, complaint.userPhone);
    await addDoc(collection(db, 'complaints'), {
      ...complaint,
      leadUid: auth.currentUser?.uid || null,
      status: 'new',
      createdAt: serverTimestamp()
    });
  },

  // 8. Referral Logic
  generateReferral: async (ownerId: string, phone: string): Promise<string> => {
    assertValidMetadata(ownerId, phone);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await addDoc(collection(db, 'referrals'), {
      ownerId,
      referrerPhone: phone,
      code,
      discountAmount: 500, // Fixed referral bonus
      status: 'active',
      createdAt: serverTimestamp()
    });
    return code;
  },

  redeemReferral: async (ownerId: string, phone: string, code: string) => {
    assertValidMetadata(ownerId, phone);
    const q = query(
      collection(db, 'referrals'),
      where('ownerId', '==', ownerId),
      where('code', '==', code.toUpperCase()),
      where('status', '==', 'active')
    );
    
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('كود الخصم غير صحيح أو منتهي الصلاحية');
    
    const referral = snap.docs[0].data();
    if (referral.referrerPhone === phone) throw new Error('لا يمكنك استخدام كود الخصم الخاص بك!');

    const batch = writeBatch(db);
    
    // 1. Reward the referrer
    const referrerId = `${ownerId}_${referral.referrerPhone}`;
    batch.update(doc(db, 'leads', referrerId), {
      points: increment(1000) // Reward for successful referral
    });

    // 2. Mark referral as used (or keep active depending on logic; usually 1-time per usage)
    // For simplicity, let's say it's valid for multiple people but reward happens
    batch.update(snap.docs[0].ref, {
      usageCount: increment(1)
    });

    await batch.commit();
    return referral.discountAmount;
  },

  // 9. Universal Sharer Enhancement
  generateShareData: (type: 'quiz' | 'offer' | 'auction' | 'referral', data: any, baseUrl: string) => {
    const title = type === 'quiz' ? 'مسابقة ذكية' : type === 'auction' ? 'مزاد حي ناري!' : `عرض خاص: ${data.itemName}`;
    let text = '';
    const encodedShop = encodeURIComponent(data.shopSlug || '');
    let url = `${baseUrl}/#/cp?shop=${encodedShop}&type=${type}&id=${data.id || data.code}`;

    if (type === 'quiz') {
      text = `شارك معنا في مسابقة ${data.shopName} واكسب نقاط وخصومات!\n${data.question}`;
    } else if (type === 'offer') {
      text = `لحق العروض! ${data.occasion}\n${data.itemName} الآن بسعر ${data.promoPrice} بدلاً من ${data.originalPrice}`;
    } else if (type === 'auction') {
      text = `🔥 السعر الحالي ${data.currentPrice} ريال للمزايدة على ${data.title}\nسارع قبل انتهاء الوقت!`;
    } else if (type === 'referral') {
      text = `استخدم كودي ${data.code} واحصل على خصم فوري في ${data.shopName}!`;
    }
    
    return { title, text, url };
  },

  rewardPoints: async (ownerId: string, phone: string, points: number, type: 'sale' | 'repair' | 'referral') => {
    assertValidMetadata(ownerId, phone);
    const leadId = `${ownerId}_${phone}`;
    const leadRef = doc(db, 'leads', leadId);
    try {
      const leadSnap = await getDoc(leadRef);
      if (leadSnap.exists()) {
        await updateDoc(leadRef, {
          points: increment(points),
          [`${type}Count`]: increment(1)
        });
      } else {
        // Create lead if not exists but with ownerId context
        await setDoc(leadRef, {
          ownerId,
          phone,
          points,
          [`${type}Count`]: 1,
          name: 'عميل مسجل',
          createdAt: serverTimestamp(),
          lastVisitAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('Error rewarding points:', err);
    }
  },

  share: async (shareData: { title: string; text: string; url: string }) => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Sharing failed', err);
        } else {
          return; // User canceled
        }
      }
    }
    
    // Fallback: Copy to clipboard and open WhatsApp
    try {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      alert('تم نسخ الرابط! يمكنك الآن لصقه ومشاركته.');
    } catch (err) {
      console.warn('Clipboard fallback failed:', err);
    }

    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text + '\n' + shareData.url)}`;
    window.open(waUrl, '_blank');
  }
};
