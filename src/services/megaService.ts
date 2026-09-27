import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Native, dependency-free HTML5 client-side image compression.
 * Scales down high-res images (e.g., 5-12MB phone camera snapshots) to max 1024px
 * width/height and saves them as lightweight JPEGs, dramatically saving bandwidth,
 * database storage, and maximizing UI loading speeds.
 */
async function compressImage(file: File, maxW = 1024, maxH = 1024, quality = 0.75): Promise<Blob | File> {
  // Only compress images
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio compliant dimensions
        if (width > maxW || height > maxH) {
          if (width > height) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // context fallback
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file (or compressed image) directly to Firebase Storage.
 * Restores exactly the same function interface as before to maintain perfect 100%
 * system-wide compatibility with visual pages without breaking compilation.
 */
export async function uploadToMega(file: File | any, ownerId: string, folderName: string): Promise<string> {
  try {
    if (!file) throw new Error("No file selected for upload.");

    // Auto-compress if it's an image
    const processedFile = file.type?.startsWith('image/') 
      ? await compressImage(file) 
      : file;

    const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `${ownerId || 'global'}/${folderName}/${safeFileName}`;
    const fileRef = ref(storage, storagePath);

    // Convert to ArrayBuffer / Blob for upload safety
    let uploadPayload: Blob | Uint8Array;
    if (processedFile instanceof Blob) {
      uploadPayload = processedFile;
    } else {
      const arrayBuffer = await processedFile.arrayBuffer();
      uploadPayload = new Uint8Array(arrayBuffer);
    }

    // Upload with matching content type metadata
    const metadata = {
      contentType: file.type || 'image/jpeg'
    };

    console.log(`Firebase Storage: Compressing & Uploading to path: ${storagePath}`);
    const uploadResult = await uploadBytes(fileRef, uploadPayload, metadata);
    const downloadUrl = await getDownloadURL(uploadResult.ref);

    return downloadUrl;
  } catch (error: any) {
    console.error('Firebase Storage Upload Error:', error);
    throw new Error('فشل رفع الملف إلى السيرفر السحابي: ' + error.message);
  }
}

/**
 * Deletes a file directly from Firebase Storage using its HTTPS download URL.
 */
export async function deleteFromMega(fileLink: string, userEmail: string) {
  // Security boundary check: Only superadmin or authorized manager can delete
  if (userEmail?.toLowerCase() !== 'a777503191@gmail.com') {
    throw new Error('عذراً، لا تملك صلاحية حذف الصور. هذه الصلاحية محصورة بالسوبر أدمن فقط.');
  }

  try {
    if (!fileLink) return;
    const fileRef = ref(storage, fileLink);
    await deleteObject(fileRef);
    console.log(`Firebase Storage: File at ${fileLink} successfully deleted.`);
  } catch (error: any) {
    console.error('Firebase Storage Delete Error:', error);
    throw new Error('فشل حذف الملف السحابي: ' + error.message);
  }
}

/**
 * Recursively purges all storage objects matching the owner's directory key.
 */
export async function purgeOwnerStorage(ownerId: string): Promise<void> {
  if (!ownerId) return;
  try {
    const rootRef = ref(storage, ownerId);
    
    const purgeFolder = async (folderRef: any) => {
      const res = await listAll(folderRef);
      // Delete all files
      for (const item of res.items) {
        await deleteObject(item);
      }
      // Recursively delete all subdirectories
      for (const subFolder of res.prefixes) {
        await purgeFolder(subFolder);
      }
    };

    await purgeFolder(rootRef);
    console.log(`Firebase Storage folder for ownerId ${ownerId} successfully purged.`);
  } catch (error) {
    console.warn(`Firebase Storage folder purge failed or did not exist for ownerId ${ownerId}:`, error);
  }
}

/**
 * Completely purges all files and subdirectories across the entire Firebase Storage bucket.
 */
export async function purgeEntireStorageBucket(): Promise<void> {
  try {
    const rootRef = ref(storage);
    const purgeFolder = async (folderRef: any) => {
      const res = await listAll(folderRef);
      for (const item of res.items) {
        try {
          await deleteObject(item);
          console.log(`Deleted storage item: ${item.fullPath}`);
        } catch (err) {
          console.warn(`Failed to delete storage item ${item.fullPath}:`, err);
        }
      }
      for (const subFolder of res.prefixes) {
        await purgeFolder(subFolder);
      }
    };
    await purgeFolder(rootRef);
    console.log('Firebase Storage bucket completely purged.');
  } catch (error) {
    console.warn('Firebase Storage bucket purge failed:', error);
  }
}

