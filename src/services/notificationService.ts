import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const sendNotification = async (ownerId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ownerId,
      title,
      message,
      type,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
