import { collection, addDoc, serverTimestamp, writeBatch, doc, getDoc, query, where, getDocs, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { NetworkOrder, UserProfile } from '../types';
import { sendNotification } from './notificationService';

export const executeNetworkOrder = async (order: NetworkOrder, profile: UserProfile) => {
  const batch = writeBatch(db);

  // 1. Create a Sale record for the wholesaler
  // ... (rest of the logic)
  
  // Create sale
  const saleRef = doc(collection(db, 'sales'));
  const saleData = {
    ownerId: profile.ownerId,
    items: order.items.map(i => ({
      id: i.productId,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      cost: 0 
    })),
    total: order.total,
    profit: order.total, 
    paymentMethod: order.paymentType === 'debt' ? 'debt' : 'cash',
    customerId: order.retailerId,
    customerName: order.retailerName,
    sellerId: profile.uid,
    sellerName: profile.name,
    createdAt: serverTimestamp()
  };
  batch.set(saleRef, saleData);

  // 2. Add Transaction for Wholesaler
  const transRef = doc(collection(db, 'transactions'));
  batch.set(transRef, {
    ownerId: profile.ownerId,
    amount: order.total,
    type: 'income',
    category: 'مبيعات شبكية',
    description: `طلب شبكي من ${order.retailerName}`,
    createdAt: serverTimestamp()
  });

  // 3. Update Order Status & Wholesaler Sign
  const orderRef = doc(db, 'networkOrders', order.id);
  batch.update(orderRef, {
    status: 'dispatched',
    wholesalerSigned: true,
    updatedAt: serverTimestamp()
  });

  // 4. Update Wholesaler stock
  order.items.forEach(item => {
    const productRef = doc(db, 'wholesaleProducts', item.productId);
    batch.update(productRef, {
      stock: increment(-item.quantity)
    });
  });

  // 5. AUTOMATION: Create a Purchase record for the Retailer
  const purchaseRef = doc(collection(db, 'purchases'));
  batch.set(purchaseRef, {
    ownerId: order.retailerId,
    items: order.items.map(i => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price
    })),
    total: order.total,
    supplierId: profile.ownerId,
    supplierName: profile.shopName,
    paymentMethod: order.paymentType === 'debt' ? 'debt' : 'cash',
    status: 'received',
    createdAt: serverTimestamp()
  });

  // 6. AUTOMATION: Add items to Retailer Inventory
  order.items.forEach(item => {
    const invRef = doc(collection(db, 'inventory'));
    batch.set(invRef, {
      ownerId: order.retailerId,
      name: item.name,
      category: 'network_import',
      stock: item.quantity,
      cost: item.price,
      price: item.price * 1.2, 
      barcode: `NET-${Date.now()}-${item.productId.slice(0,4)}`,
      createdAt: serverTimestamp()
    });
  });

  await batch.commit();

  // 7. Notifications
  await sendNotification(order.retailerId, 'تم شحن طلبك', `قام المورد ${profile.shopName} بشحن طلبك رقم #${order.id.slice(0,8)}`, 'success');

  return true;
};
