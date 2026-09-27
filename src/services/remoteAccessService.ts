import { doc, updateDoc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

export const remoteAccessService = {
  generateRemoteLink: async (userId: string, customBaseUrl?: string): Promise<string> => {
    // Generate a long unique token
    const token = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15) + 
                  Date.now().toString(36);
    
    await updateDoc(doc(db, 'users', userId), {
      remoteAccessToken: token,
      remoteAccessEnabled: true
    });
    
    const baseUrl = customBaseUrl || (import.meta as any).env?.VITE_APP_URL || window.location.origin;
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    return `${cleanBaseUrl}/?remoteToken=${token}#/`;
  },

  revokeAccess: async (userId: string): Promise<void> => {
    await updateDoc(doc(db, 'users', userId), {
      remoteAccessToken: null,
      remoteAccessEnabled: false
    });
  },

  validateToken: async (token: string): Promise<UserProfile | null> => {
    if (!token) return null;
    
    const q = query(
      collection(db, 'users'), 
      where('remoteAccessToken', '==', token),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data() as UserProfile;
      if (userData.remoteAccessEnabled) {
        return userData;
      }
    }
    
    return null;
  },

  sendViaWhatsApp: (link: string, name: string, shopName: string) => {
    const message = `أهلاً بك، هذا هو رابط المتابعة عن بعد لمحل (${shopName}).\nالرابط مخصص للمدير: ${name}\n\nالرابط: ${link}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }
};
