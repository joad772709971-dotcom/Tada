import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Universal file exporter and downloader
 * Handles:
 * 1. Native Android APK (Capacitor Filesystem + Share)
 * 2. Android WebView & Mobile Browsers (Blob ObjectURL + Anchor Click + Data URI Fallback)
 * 3. Desktop Windows / macOS (Instant Download Anchor)
 */
export async function downloadOrExportFile(
  content: string | Blob | ArrayBuffer,
  filename: string,
  mimeType = 'application/octet-stream'
): Promise<boolean> {
  try {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // In native Android APK, write to cache/documents directory and invoke Share Dialog
      let base64Data = '';
      if (typeof content === 'string') {
        base64Data = btoa(unescape(encodeURIComponent(content)));
      } else if (content instanceof Blob) {
        const buffer = await content.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64Data = btoa(binary);
      } else if (content instanceof ArrayBuffer) {
        const bytes = new Uint8Array(content);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64Data = btoa(binary);
      }

      try {
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: filename,
          text: `تصدير ملف: ${filename}`,
          url: writeResult.uri,
          dialogTitle: `حفظ أو مشاركة ${filename}`
        });

        return true;
      } catch (nativeErr) {
        console.warn('Native filesystem share skipped, falling back to Web Blob:', nativeErr);
      }
    }

    // Web & WebView Download Logic
    const blob = content instanceof Blob 
      ? content 
      : new Blob([content], { type: mimeType });

    // Standard Blob Object URL
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);

    return true;
  } catch (error) {
    console.error('Download or export file error:', error);
    // Ultimate Fallback: Data URI Navigation
    try {
      if (typeof content === 'string') {
        const dataUri = `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
      }
    } catch (e) {
      console.error('Data URI download fallback failed:', e);
    }
    return false;
  }
}
