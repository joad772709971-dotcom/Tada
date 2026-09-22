import { doc, getDocFromServer, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { environmentService } from './environmentService';

export interface VersionCheckResult {
  isSupported: boolean;
  requiresUpdate: boolean;
  isForceUpdate: boolean;
  latestVersion: string;
  minSupportedVersion: string;
  releaseNotes: string;
  updateUrlApk?: string;
  updateUrlExe?: string;
  updateUrlWeb?: string;
  updatedAt?: string;
}

export interface VersionConfigInput {
  latestVersion: string;
  minSupportedVersion: string;
  releaseNotes: string;
  updateUrlApk?: string;
  updateUrlExe?: string;
  updateUrlWeb?: string;
}

/**
 * 🚀 VERSION CONTROL & BACKWARD COMPATIBILITY GUARD (المرحلة الثالثة)
 * Controls client version compatibility for APK / EXE distributions.
 * Prevents old APK/EXE clients from executing incompatible write operations or corrupting accounting structures.
 */
export class VersionControlService {
  /**
   * Compare two semantic version strings (e.g., "2.4.0" vs "2.0.0")
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  public static compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = v2.split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < len; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  /**
   * Check app version against backend minimum supported version requirement
   */
  public static async checkAppVersion(): Promise<VersionCheckResult> {
    const localInfo = environmentService.getVersionInfo();
    const currentVersion = localInfo.version;

    try {
      const systemDocRef = doc(db, 'system', 'app_version_config');
      let systemSnap;
      try {
        systemSnap = await getDocFromServer(systemDocRef);
      } catch (err) {
        systemSnap = await getDoc(systemDocRef);
      }

      if (systemSnap.exists()) {
        const data = systemSnap.data();
        const latestVersion = data.latestVersion || currentVersion;
        const minSupported = data.minSupportedVersion || localInfo.minSupported;
        const releaseNotes = data.releaseNotes || 'تحديثات وتحسينات على استقرار النظام والأمان الحسابي والعزل.';
        const updateUrlApk = data.updateUrlApk || data.updateUrl || '';
        const updateUrlExe = data.updateUrlExe || '';
        const updateUrlWeb = data.updateUrlWeb || '';

        const isBelowMin = this.compareVersions(currentVersion, minSupported) < 0;
        const hasNewer = this.compareVersions(currentVersion, latestVersion) < 0;

        return {
          isSupported: !isBelowMin,
          requiresUpdate: hasNewer,
          isForceUpdate: isBelowMin,
          latestVersion,
          minSupportedVersion: minSupported,
          releaseNotes,
          updateUrlApk,
          updateUrlExe,
          updateUrlWeb,
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn("⚠️ [Version Check] Could not verify version from server, operating in offline fallback mode:", e);
    }

    // Default fallback when server config is unreachable
    return {
      isSupported: true,
      requiresUpdate: false,
      isForceUpdate: false,
      latestVersion: currentVersion,
      minSupportedVersion: localInfo.minSupported,
      releaseNotes: 'نظام تشغيل التوافق المحلي محمي ومعزول بنجاح.',
    };
  }

  /**
   * Update system version config on server (SuperAdmin)
   */
  public static async updateServerVersionConfig(input: VersionConfigInput): Promise<boolean> {
    try {
      const systemDocRef = doc(db, 'system', 'app_version_config');
      await setDoc(systemDocRef, {
        ...input,
        updatedAt: new Date().toISOString(),
        updatedBy: 'super_admin',
      }, { merge: true });
      console.log('✅ [Version Control] Updated server version configuration successfully');
      return true;
    } catch (e) {
      console.error('❌ [Version Control] Failed to update version config:', e);
      return false;
    }
  }
}
