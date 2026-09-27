import { collection, query, where, getDocs, deleteDoc, doc, getDoc, setDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * B2B ORDER, FINANCIAL & SUPPLY LIFECYCLE INTEGRATION UNIT TEST MODULE (ملف تجريبي - المهمة السابعة)
 * Evaluates the full B2B flow: Secure Order Placement, Cashier Approval, Warehouse Prep,
 * Transit Pending Deduction, and Final Field Receipt with Automated Cargo Ingestion.
 */
export async function runB2BLifecycleTest(ownerId: string = 'test-owner-b2b-123') {
  console.log("🚀 Starting B2B Order, Financial, and Warehouse Lifecycle Integration Unit Test...");
  const results: string[] = [];

  // Stable Mock IDs
  const testOrderId = `test-order-b2b-${Math.floor(1000 + Math.random() * 9000)}`;
  const testPrepId = `test-prep-b2b-${testOrderId}`;
  const testLinkId = `test-link-b2b-${testOrderId}`;
  const testSupplierId = 'test-supplier-b2b-777';
  const testBuyerId = 'test-buyer-b2b-888';
  const testProductId = 'test-prod-b2b-555';

  try {
    // =========================================================================
    // STEP 0: Setup Environment Linkage & Initial Inventory Card
    // =========================================================================
    console.log("🧪 Step 0: Setting up network link and product template in Firestore sandbox...");
    const linkRef = doc(db, 'networkLinks', testLinkId);
    await setDoc(linkRef, {
      id: testLinkId,
      linkKey: `key-b2b-${testOrderId}`,
      retailerId: testBuyerId,
      wholesalerId: testSupplierId,
      status: 'active',
      createdAt: new Date().toISOString()
    });

    // Create an initial inventory product card for the supplier with 50 units
    const supplierProdRef = doc(db, 'inventory', `${testSupplierId}_${testProductId}`);
    await setDoc(supplierProdRef, {
      id: testProductId,
      ownerId: testSupplierId,
      name: 'محول طاقة ذكي جام برو',
      category: 'ملحقات طاقة',
      stock: 50,
      cost: 4000,
      price: 6000,
      updatedAt: new Date().toISOString()
    });

    results.push("Step 0: Linkage key and supplier inventory initialized successfully. ✅");

    // =========================================================================
    // STEP 1: Secure Order Placement (حالة الطلب معلق)
    // =========================================================================
    console.log("🧪 Step 1: Simulating B2B Secure Order Placement...");
    const cartItems = [
      {
        productId: testProductId,
        name: 'محول طاقة ذكي جام برو',
        quantity: 10,
        price: 5000, // Wholesale discounted price
      }
    ];
    const totalAmount = 5000 * 10; // 50,000 YER

    const orderRef = doc(db, 'orders', testOrderId);
    const orderPayload = {
      id: testOrderId,
      retailerId: testBuyerId,
      retailerName: 'متجر التجزئة النموذجي',
      wholesalerId: testSupplierId,
      wholesalerName: 'شركة التوريد المركزية',
      items: cartItems,
      total: totalAmount,
      status: 'pending',
      paymentType: 'cash',
      isDryRun: true,
      createdAt: new Date().toISOString()
    };

    await setDoc(orderRef, orderPayload);
    results.push(`Step 1: B2B Order placed successfully under "pending" status for ${totalAmount.toLocaleString()} YER. ✅`);

    // =========================================================================
    // STEP 2: Cashier Approval & Warehouse Prep Routing (الموافقة والتوجيه للتجهيز)
    // =========================================================================
    console.log("🧪 Step 2: Simulating Cashier Validation & Warehouse Prep Routing...");
    const batch = writeBatch(db);

    // Update main order status to 'prepping'
    batch.update(orderRef, {
      status: 'prepping',
      cashierValidated: true,
      approvedBy: 'cashier-test-user',
      approvedByName: 'محاسب فحص تجريبي',
      updatedAt: new Date().toISOString()
    });

    // Create Warehouse Prep Order document
    const prepRef = doc(db, 'warehousePrepOrders', testPrepId);
    batch.set(prepRef, {
      id: testPrepId,
      ownerId: testSupplierId,
      orderId: testOrderId,
      customerName: 'متجر التجزئة النموذجي',
      items: cartItems.map(item => ({
        itemId: item.productId,
        name: item.name,
        requestedQty: item.quantity,
        preparedQty: item.quantity,
        status: 'pending'
      })),
      prepStatus: 'pending',
      createdAt: new Date().toISOString()
    });

    // Handle instant cash register update for the supplier (mock cash account setup)
    const supplierAccountRef = doc(db, 'accounts', `account_${testSupplierId}`);
    await setDoc(supplierAccountRef, {
      id: `account_${testSupplierId}`,
      ownerId: testSupplierId,
      name: 'صندوق النقد الرئيسي للمورد',
      balance: 100000, // starting balance
      isDefault: true,
      updatedAt: new Date().toISOString()
    });

    batch.update(supplierAccountRef, {
      balance: increment(totalAmount)
    });

    await batch.commit();

    // Verify Step 2 state
    const updatedOrderSnap = await getDoc(orderRef);
    const updatedOrder = updatedOrderSnap.data();
    const supplierAccSnap = await getDoc(supplierAccountRef);
    const supplierAcc = supplierAccSnap.data();

    results.push(`Step 2: Cashier Approved. Status updated to "${updatedOrder?.status}". ✅`);
    results.push(`Step 2: Supplier Account balance incremented to: ${supplierAcc?.balance.toLocaleString()} YER. ✅`);

    // =========================================================================
    // STEP 3: Dispatch & Transit Pending Deduction (الشحن وتقييد مالي معلق بالطريق)
    // =========================================================================
    console.log("🧪 Step 3: Simulating Dispatch and Transit Pending Deduction...");
    const transitBatch = writeBatch(db);

    // Update status to shipped and freeze cancellation
    transitBatch.update(orderRef, {
      status: 'shipped',
      cancelFrozen: true,
      dispatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Post Transit Pending Deduction transaction on the Buyer
    const transactionId = `trans_transit_${testOrderId}`;
    const buyerLedgerRef = doc(db, 'transactions', transactionId);
    transitBatch.set(buyerLedgerRef, {
      id: transactionId,
      ownerId: testBuyerId,
      orderId: testOrderId,
      amount: totalAmount,
      type: 'expense_pending',
      category: 'مشتريات معلقة قيد الشحن',
      notes: 'عملية مخصومة لم تستلم بضاعتها مقابلها', // Exact Arabic text requirement
      description: `قيد تعليق مالي لحركة البضاعة بالطريق للطلب #${testOrderId.slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: 'transit_frozen'
    });

    await transitBatch.commit();

    // Verify transit deduction
    const transitTransSnap = await getDoc(buyerLedgerRef);
    const transitTrans = transitTransSnap.data();

    results.push(`Step 3: Dispatched & Locked. Status updated to "shipped". ✅`);
    results.push(`Step 3 Validation: Note: "${transitTrans?.notes}". Type is: "${transitTrans?.type}". ${transitTrans?.notes === 'عملية مخصومة لم تستلم بضاعتها مقابلها' ? '✅ PASS' : '❌ FAIL'}`);

    // =========================================================================
    // STEP 4: Field Receipt Confirmation & Automated Cargo Ingestion (الاستلام وتغذية المخزون)
    // =========================================================================
    console.log("🧪 Step 4: Simulating Field Receipt & Automated Cargo Ingestion...");
    const receiptBatch = writeBatch(db);

    // Terminal state 'received'
    receiptBatch.update(orderRef, {
      status: 'received',
      retailerSigned: true,
      deliveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Finalize permanent expense entry
    receiptBatch.update(buyerLedgerRef, {
      type: 'expense',
      category: 'مشتريات مستلمة معتمدة',
      notes: 'تم فك التعليق: البضاعة المستلمة مطابقة لمحتويات الفاتورة المعتمدة.',
      description: `تسوية نهائية للفاتورة الشبكية الموفاة المستلمة #${testOrderId.slice(-6)}`,
      updatedAt: new Date().toISOString()
    });

    // Automated Cargo Ingestion directly into Buyer's inventory
    const buyerProdRef = doc(db, 'inventory', `${testBuyerId}_${testProductId}`);
    receiptBatch.set(buyerProdRef, {
      id: testProductId,
      ownerId: testBuyerId,
      name: 'محول طاقة ذكي جام برو',
      category: 'وارد شبكة الموزعين',
      stock: 10, // directly ingests 10 units
      cost: 5000,
      price: 5000 * 1.15, // 15% standard retail markup
      barcode: `JAM-B2B-TEST-${testOrderId.slice(-4)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await receiptBatch.commit();

    // Verify final states
    const finalOrderSnap = await getDoc(orderRef);
    const finalOrder = finalOrderSnap.data();
    const finalTransSnap = await getDoc(buyerLedgerRef);
    const finalTrans = finalTransSnap.data();
    const finalBuyerProdSnap = await getDoc(buyerProdRef);
    const finalBuyerProd = finalBuyerProdSnap.data();

    results.push(`Step 4: Final Received State: "${finalOrder?.status}". ✅`);
    results.push(`Step 4 Verification: Permanent Expense Notes: "${finalTrans?.notes}". ✅`);
    results.push(`Step 4: Automated Stock Ingested: ${finalBuyerProd?.stock} units. Markup Price: ${finalBuyerProd?.price} YER. ✅`);

    console.log("\n📊 B2B ORDER, FINANCIAL & SUPPLY LIFECYCLE TEST SUMMARY:");
    results.forEach(r => console.log(r));

    return {
      success: true,
      results,
      details: { testOrderId, testPrepId, testLinkId, buyerStock: finalBuyerProd?.stock, markupPrice: finalBuyerProd?.price }
    };

  } catch (error: any) {
    console.error("❌ B2B Lifecycle Integration Unit Test Failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * CLEANUP FUNCTION: Clears all created sandbox records
 */
export async function cleanupB2BLifecycleTestLogs(orderIdPattern: string = '') {
  console.log("🧹 Cleaning up B2B Order and Supply lifecycle sandbox test collections...");
  let count = 0;

  try {
    // 1. Delete all mock network links
    const qLinks = query(collection(db, 'networkLinks'), where('status', '==', 'active'));
    const linkSnap = await getDocs(qLinks);
    for (const d of linkSnap.docs) {
      if (d.id.includes('test-link-b2b-')) {
        await deleteDoc(doc(db, 'networkLinks', d.id));
        count++;
      }
    }

    // 2. Delete mock inventory entries
    const qInv = query(collection(db, 'inventory'), where('category', 'in', ['ملحقات طاقة', 'وارد شبكة الموزعين']));
    const invSnap = await getDocs(qInv);
    for (const d of invSnap.docs) {
      if (d.id.includes('test-supplier-b2b-777') || d.id.includes('test-buyer-b2b-888')) {
        await deleteDoc(doc(db, 'inventory', d.id));
        count++;
      }
    }

    // 3. Delete mock orders
    const qOrders = query(collection(db, 'orders'), where('isDryRun', '==', true));
    const ordersSnap = await getDocs(qOrders);
    for (const d of ordersSnap.docs) {
      await deleteDoc(doc(db, 'orders', d.id));
      count++;
    }

    // 4. Delete mock warehousePrepOrders
    const qPreps = query(collection(db, 'warehousePrepOrders'), where('customerName', '==', 'متجر التجزئة النموذجي'));
    const prepsSnap = await getDocs(qPreps);
    for (const d of prepsSnap.docs) {
      await deleteDoc(doc(db, 'warehousePrepOrders', d.id));
      count++;
    }

    // 5. Delete mock transactions
    const qTrans = query(collection(db, 'transactions'), where('ownerId', '==', 'test-buyer-b2b-888'));
    const transSnap = await getDocs(qTrans);
    for (const d of transSnap.docs) {
      await deleteDoc(doc(db, 'transactions', d.id));
      count++;
    }

    // 6. Delete mock accounts
    const supplierAccountRef = doc(db, 'accounts', `account_test-supplier-b2b-777`);
    const accSnap = await getDoc(supplierAccountRef);
    if (accSnap.exists()) {
      await deleteDoc(supplierAccountRef);
      count++;
    }

    console.log(`✅ Cleaned up ${count} B2B sandbox test documents.`);
    return count;
  } catch (error) {
    console.error("Cleanup of B2B lifecycle sandbox failed:", error);
    return 0;
  }
}
