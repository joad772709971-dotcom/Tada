import { collection, query, where, orderBy, getDocs, limit, doc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface Ad {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  active: boolean;
  segments: string[];
  trigger: 'first_entry' | 'logout' | 'scheduled';
  order: number;
  duration: number;
  stats: {
    views: number;
    clicks: number;
  };
}

class AdService {
  private seenAds: Set<string> = new Set(JSON.parse(localStorage.getItem('jam_seen_ads') || '[]'));

  async getRelevantAds(segment: string, trigger: string): Promise<Ad[]> {
    try {
      const adsRef = collection(db, 'ads');
      const q = query(
        adsRef,
        where('active', '==', true),
        where('trigger', '==', trigger),
        orderBy('order', 'asc')
      );
      
      const snap = await getDocs(q);
      const ads = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad));
      
      // Filter by segment client-side if needed (Firestore IN queries are limited)
      return ads.filter(ad => ad.segments.includes(segment));
    } catch (error) {
      console.error('Error fetching ads:', error);
      return [];
    }
  }

  async trackView(adId: string) {
    try {
      await updateDoc(doc(db, 'ads', adId), {
        'stats.views': increment(1)
      });
      this.seenAds.add(adId);
      localStorage.setItem('jam_seen_ads', JSON.stringify(Array.from(this.seenAds)));
    } catch (error) {
      console.error('Error tracking ad view:', error);
    }
  }

  async trackClick(adId: string) {
    try {
      await updateDoc(doc(db, 'ads', adId), {
        'stats.clicks': increment(1)
      });
    } catch (error) {
      console.error('Error tracking ad click:', error);
    }
  }

  hasSeen(adId: string): boolean {
    return this.seenAds.has(adId);
  }
}

export const adService = new AdService();
