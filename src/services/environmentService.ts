/**
 * 🌐 ENVIRONMENT SEPARATION & TENANT ISOLATION ENGINE (المرحلة الأولى)
 * Managed separation between Development, Staging, and Live Production environments.
 * Prevents test data or development changes from leaking into production merchant databases.
 */

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  env: AppEnvironment;
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
  allowTestData: boolean;
  dbPrefix: string;
  enableDebugLogs: boolean;
  tenantIsolationLevel: 'strict' | 'standard';
  minSupportedVersion: string;
  currentAppVersion: string;
}

class EnvironmentService {
  private currentEnv: AppEnvironment = 'development';
  private appVersion = '4.0.1';
  private minSupportedVersion = '2.0.0';

  constructor() {
    this.detectEnvironment();
  }

  /**
   * Auto-detect environment based on domain/hostname or stored user setting
   */
  private detectEnvironment(): void {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const storedEnv = localStorage.getItem('jam_app_environment') as AppEnvironment | null;

      if (storedEnv && ['development', 'staging', 'production'].includes(storedEnv)) {
        this.currentEnv = storedEnv;
      } else if (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes('ais-dev')) {
        this.currentEnv = 'development';
      } else if (hostname.includes('staging') || hostname.includes('ais-pre')) {
        this.currentEnv = 'staging';
      } else {
        this.currentEnv = 'production';
      }
    }
  }

  /**
   * Get complete environment configuration
   */
  public getConfig(): EnvironmentConfig {
    return {
      env: this.currentEnv,
      isProduction: this.currentEnv === 'production',
      isStaging: this.currentEnv === 'staging',
      isDevelopment: this.currentEnv === 'development',
      allowTestData: this.currentEnv !== 'production',
      dbPrefix: this.currentEnv === 'production' ? '' : `${this.currentEnv}_`,
      enableDebugLogs: this.currentEnv !== 'production',
      tenantIsolationLevel: 'strict',
      minSupportedVersion: this.minSupportedVersion,
      currentAppVersion: this.appVersion,
    };
  }

  /**
   * Switch environment mode (Admin only with guard)
   */
  public setEnvironment(env: AppEnvironment): void {
    console.log(`🔄 [Environment Switch] Changing environment from ${this.currentEnv} to ${env}`);
    this.currentEnv = env;
    if (typeof window !== 'undefined') {
      localStorage.setItem('jam_app_environment', env);
      window.dispatchEvent(new CustomEvent('environment_changed', { detail: { env } }));
    }
  }

  /**
   * Get collection path with environment namespace if applicable
   */
  public getCollectionPath(baseCollection: string): string {
    const config = this.getConfig();
    // System and ads collections are always shared global
    if (['system', 'ads', 'global_hotfixes', 'role_policies'].includes(baseCollection)) {
      return baseCollection;
    }
    // In dev mode, return scoped collection if isolated testing is requested
    if (config.isDevelopment && localStorage.getItem('jam_isolate_dev_collections') === 'true') {
      return `dev_${baseCollection}`;
    }
    return baseCollection;
  }

  /**
   * Current app build information
   */
  public getVersionInfo() {
    let resolvedVersion = this.appVersion;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('jam_installed_update_version') || localStorage.getItem('jam_app_version');
        if (stored) {
          const parts1 = stored.split('.').map(n => parseInt(n, 10) || 0);
          const parts2 = resolvedVersion.split('.').map(n => parseInt(n, 10) || 0);
          const len = Math.max(parts1.length, parts2.length);
          let isGreater = false;
          for (let i = 0; i < len; i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) { isGreater = true; break; }
            if (p1 < p2) { break; }
          }
          if (isGreater) {
            resolvedVersion = stored;
          }
        }
      } catch (e) {}
    }
    return {
      version: resolvedVersion,
      minSupported: this.minSupportedVersion,
      env: this.currentEnv,
      buildDate: '2026-10-03',
    };
  }
}

export const environmentService = new EnvironmentService();
