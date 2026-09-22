import { 
  UserProfile, 
  InventoryItem, 
  Sale, 
  ReturnFlow, 
  PurchaseInvoice, 
  B2BOrder, 
  MaintenanceJob, 
  FinancialTransaction, 
  AccountNode, 
  ActivityLog 
} from './types';

// Storage Helper functions
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(`jam_v3_${key}`);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error loading ${key} from storage:`, err);
  }
  return defaultValue;
}

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`jam_v3_${key}`, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving ${key} to storage:`, err);
  }
}

// Initial Mock Datasets
export const initialUsers: UserProfile[] = [
  {
    uid: 'user-owner-abujawad',
    name: 'أبو جواد المحفلي',
    email: 'abujawad@jam.com',
    role: 'owner',
    status: 'active',
    ownerId: 'shop-jam-pro',
    phone: '772315106',
    custodyBalance: 0,
    subscriptionType: 'paid',
    isLifetime: true
  }
];

export const initialInventory: InventoryItem[] = [];

export const initialSales: Sale[] = [];

export const initialReturns: ReturnFlow[] = [];

export const initialPurchases: PurchaseInvoice[] = [];

export const initialB2BOrders: B2BOrder[] = [];

export const initialMaintenance: MaintenanceJob[] = [];

export const initialFinancialTransactions: FinancialTransaction[] = [];

export const initialAccounts: AccountNode[] = [];

export const initialLogs: ActivityLog[] = [];
