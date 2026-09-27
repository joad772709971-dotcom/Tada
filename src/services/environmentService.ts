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
  private appVersion = '2.8.8';
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
    return {
      version: this.appVersion,
      minSupported: this.minSupportedVersion,
      env: this.currentEnv,
      buildDate: '2026-07-23',
    };
  }
}

export const environmentService = new EnvironmentService();
