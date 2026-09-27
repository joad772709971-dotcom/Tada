import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  Unsubscribe 
} from 'firebase/firestore';
import { FirebaseProjectRouter, ProjectTier } from './FirebaseProjectRouter';

export type NotificationType = 
  | 'b2b_order' 
  | 'b2c_order' 
  | 'low_stock' 
  | 'debt_alert' 
  | 'system_announcement' 
  | 'security_event';

export interface GlobalNotificationItem {
  id?: string;
  recipientUid: string;
  recipientTier: ProjectTier;
  title: string;
  body: string;
  type: NotificationType;
  relatedEntityId?: string;
  isRead: boolean;
  priority?: 'normal' | 'high' | 'urgent';
  createdAt?: any;
}

export class CrossProjectNotificationHubEngine {
  /**
   * Broadcasts a notification into a target project tier for a recipient or role group
   */
  public async dispatchNotification(
    notification: Omit<GlobalNotificationItem, 'id' | 'isRead' | 'createdAt'>
  ): Promise<string> {
    try {
      const targetDb = FirebaseProjectRouter.getFirestoreForTier(notification.recipientTier);
      const colRef = collection(targetDb, 'notifications');

      const payload = {
        ...notification,
        isRead: false,
        priority: notification.priority || 'normal',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(colRef, payload);
      return docRef.id;
    } catch (err) {
      console.error(`[NotificationHub] Failed to dispatch notification to tier ${notification.recipientTier}:`, err);
      throw err;
    }
  }

  /**
   * Broadcasts a system-wide announcement to all 6 project tiers simultaneously
   */
  public async broadcastSystemAnnouncement(
    title: string,
    body: string,
    senderUid: string = 'SUPER_ADMIN'
  ): Promise<void> {
    const tiers = FirebaseProjectRouter.getAllTiers();

    const promises = tiers.map(async (tier) => {
      try {
        const db = FirebaseProjectRouter.getFirestoreForTier(tier);
        await addDoc(collection(db, 'system_announcements'), {
          title,
          body,
          senderUid,
          broadcastTier: tier,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.warn(`[NotificationHub] Announcement broadcast failed on tier ${tier}:`, err);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Listens in real-time to active notifications for a logged-in user in their tier project
   */
  public subscribeToUserNotifications(
    userProfile: { uid: string; role?: string },
    onNotificationsReceived: (notifications: GlobalNotificationItem[]) => void
  ): Unsubscribe {
    const userTier = FirebaseProjectRouter.resolveTier(userProfile.role, userProfile);
    const db = FirebaseProjectRouter.getFirestoreForTier(userTier);

    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userProfile.uid)
    );

    return onSnapshot(
      q,
      (snap) => {
        const list: GlobalNotificationItem[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as GlobalNotificationItem);
        });
        // Sort in memory by createdAt descending
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        onNotificationsReceived(list);
      },
      (err) => {
        console.error(`[NotificationHub] Notification subscription error on tier ${userTier}:`, err);
        onNotificationsReceived([]);
      }
    );
  }

  /**
   * Marks a notification as read in its target project tier
   */
  public async markNotificationAsRead(
    tier: ProjectTier,
    notificationId: string
  ): Promise<void> {
    const db = FirebaseProjectRouter.getFirestoreForTier(tier);
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      readAt: serverTimestamp()
    });
  }
}

export const CrossProjectNotificationHub = new CrossProjectNotificationHubEngine();
