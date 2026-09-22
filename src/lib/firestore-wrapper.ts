import * as originalFirestore from '@firebase/firestore';

// Export everything from the original module
export * from '@firebase/firestore';

const APP_MODE = (typeof process !== 'undefined' && process.env?.VITE_APP_MODE) || 'STORE';
console.log(`🛡️ [Firestore Wrapper] Active interceptor mode for partitioning: ${APP_MODE}`);

export function mapFirestorePath(path: string): string {
  if (!path) return path;
  if (path.startsWith('stores_ecosystem') || path.startsWith('clients_ecosystem')) {
    return path;
  }
  
  if (APP_MODE === 'CLIENT') {
    return `clients_ecosystem/data/${path}`;
  } else {
    return `stores_ecosystem/data/${path}`;
  }
}

function isDbInstance(arg: any): boolean {
  if (!arg) return false;
  // Firestore Database Instance detection (does not have path/id/type properties and is an object, or matched by class name)
  return typeof arg === 'object' && 
         !('path' in arg) && 
         !('id' in arg) && 
         (('app' in arg) || (arg.type === 'firestore') || (arg.constructor?.name === 'Firestore' || arg.constructor?.name === 'FirestoreImpl'));
}

export function collection(parent: any, path: string, ...pathSegments: string[]): any {
  if (isDbInstance(parent)) {
    const mappedPath = mapFirestorePath(path);
    // console.log(`[Firestore collection Rewrite] ${path} -> ${mappedPath}`);
    return originalFirestore.collection(parent, mappedPath, ...pathSegments);
  }
  return originalFirestore.collection(parent, path, ...pathSegments);
}

export function doc(parent: any, path?: string, ...pathSegments: string[]): any {
  if (isDbInstance(parent) && path) {
    const mappedPath = mapFirestorePath(path);
    // console.log(`[Firestore doc Rewrite] ${path} -> ${mappedPath}`);
    return originalFirestore.doc(parent, mappedPath, ...pathSegments);
  }
  if (path) {
    return originalFirestore.doc(parent, path, ...pathSegments);
  }
  return originalFirestore.doc(parent);
}
