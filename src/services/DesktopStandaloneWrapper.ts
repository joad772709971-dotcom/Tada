import { DISTRIBUTED_MICRO_APPS, MicroAppConfig } from './DistributedMicroAppsRouter';

export interface DesktopAppManifest {
  appId: string;
  exeName: string;
  productName: string;
  version: string;
  tier: string;
  projectId: string;
  shortcutName: string;
  windowConfig: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    resizable: boolean;
    fullscreenable: boolean;
    autoHideMenuBar: boolean;
  };
  hardwareCapabilities: {
    directThermalPrint: boolean;
    hardwareBarcodeScanner: boolean;
    cashDrawerKick: boolean;
    offlineDbSync: boolean;
  };
}

export const DESKTOP_MERCHANT_MANIFESTS: Record<string, DesktopAppManifest> = {
  // 1. Retail POS Desktop EXE
  retail_pos_exe: {
    appId: DISTRIBUTED_MICRO_APPS.retail_pos.appId,
    exeName: 'JAM-RetailPOS-Setup.exe',
    productName: 'JAM Retail POS - نقطة بيع التجزئة',
    version: '25.1.0',
    tier: 'retailer',
    projectId: DISTRIBUTED_MICRO_APPS.retail_pos.projectId,
    shortcutName: 'JAM - تجزئة',
    windowConfig: {
      width: 1366,
      height: 768,
      minWidth: 1024,
      minHeight: 600,
      resizable: true,
      fullscreenable: true,
      autoHideMenuBar: true
    },
    hardwareCapabilities: {
      directThermalPrint: true,
      hardwareBarcodeScanner: true,
      cashDrawerKick: true,
      offlineDbSync: true
    }
  },

  // 2. Wholesaler POS Desktop EXE
  wholesaler_pos_exe: {
    appId: DISTRIBUTED_MICRO_APPS.wholesaler_app.appId,
    exeName: 'JAM-WholesaleMerchant-Setup.exe',
    productName: 'JAM Wholesale POS - تاجر الجملة',
    version: '25.1.0',
    tier: 'wholesaler',
    projectId: DISTRIBUTED_MICRO_APPS.wholesaler_app.projectId,
    shortcutName: 'JAM - جملة',
    windowConfig: {
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      resizable: true,
      fullscreenable: true,
      autoHideMenuBar: true
    },
    hardwareCapabilities: {
      directThermalPrint: true,
      hardwareBarcodeScanner: true,
      cashDrawerKick: true,
      offlineDbSync: true
    }
  },

  // 3. Master Wholesale Desktop EXE
  master_wholesale_exe: {
    appId: DISTRIBUTED_MICRO_APPS.master_wholesale.appId,
    exeName: 'JAM-MasterWholesale-Setup.exe',
    productName: 'JAM Master Wholesale - جملة الجملة والموزعين',
    version: '25.1.0',
    tier: 'wholesale_master',
    projectId: DISTRIBUTED_MICRO_APPS.master_wholesale.projectId,
    shortcutName: 'JAM - جملة الجملة',
    windowConfig: {
      width: 1600,
      height: 900,
      minWidth: 1280,
      minHeight: 720,
      resizable: true,
      fullscreenable: true,
      autoHideMenuBar: true
    },
    hardwareCapabilities: {
      directThermalPrint: true,
      hardwareBarcodeScanner: true,
      cashDrawerKick: true,
      offlineDbSync: true
    }
  },

  // 4. Importer Agency Desktop EXE
  importer_agency_exe: {
    appId: DISTRIBUTED_MICRO_APPS.importer_agency.appId,
    exeName: 'JAM-ImporterAgency-Setup.exe',
    productName: 'JAM Importer Agency - المستوردين والتوكيلات',
    version: '25.1.0',
    tier: 'importer',
    projectId: DISTRIBUTED_MICRO_APPS.importer_agency.projectId,
    shortcutName: 'JAM - المستوردين',
    windowConfig: {
      width: 1920,
      height: 1080,
      minWidth: 1280,
      minHeight: 720,
      resizable: true,
      fullscreenable: true,
      autoHideMenuBar: true
    },
    hardwareCapabilities: {
      directThermalPrint: true,
      hardwareBarcodeScanner: true,
      cashDrawerKick: true,
      offlineDbSync: true
    }
  }
};

export class DesktopStandaloneWrapperEngine {
  private scannerBuffer: string = '';
  private lastKeyTime: number = 0;
  private scannerCallbacks: Array<(barcode: string) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initHardwareBarcodeScannerListener();
    }
  }

  /**
   * Checks if app is currently executing inside an Electron / Tauri Desktop wrapper
   */
  public isDesktopWrapper(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).electron ||
      (window as any).electronAPI ||
      (window as any).__TAURI__ ||
      navigator.userAgent.toLowerCase().includes('electron') ||
      (window as any).process?.versions?.electron
    );
  }

  /**
   * Sends direct raw thermal print job (80mm/58mm thermal receipt printers)
   */
  public async sendDirectThermalPrintJob(
    printDataHtml: string,
    printerOptions: { paperSize?: '80mm' | '58mm'; autoCut?: boolean; openDrawer?: boolean } = {}
  ): Promise<boolean> {
    if (this.isDesktopWrapper() && (window as any).electronAPI?.printThermal) {
      try {
        return await (window as any).electronAPI.printThermal({
          html: printDataHtml,
          ...printerOptions
        });
      } catch (err) {
        console.warn('⚠️ Direct thermal printer bridge fallback:', err);
      }
    }

    // Standard Web Print fallback
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printDataHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
      return true;
    }
    return false;
  }

  /**
   * Hardware USB/Serial Barcode Scanner Keypress Listener (20ms threshold buffer)
   */
  private initHardwareBarcodeScannerListener(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Avoid capturing input if focused inside active text input elements
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - this.lastKeyTime > 50) {
        this.scannerBuffer = ''; // Reset buffer if typing slow (human keystrokes)
      }

      if (e.key === 'Enter') {
        if (this.scannerBuffer.length >= 3) {
          const code = this.scannerBuffer.trim();
          this.scannerCallbacks.forEach(cb => cb(code));
        }
        this.scannerBuffer = '';
      } else if (e.key.length === 1) {
        this.scannerBuffer += e.key;
      }

      this.lastKeyTime = currentTime;
    });
  }

  /**
   * Registers a hardware barcode scanner callback
   */
  public onBarcodeScanned(callback: (barcode: string) => void): () => void {
    this.scannerCallbacks.push(callback);
    return () => {
      this.scannerCallbacks = this.scannerCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Frameless floating splash login window configuration specs (420px x 780px)
   */
  public readonly framelessLoginWindowConfig = {
    width: 420,
    height: 780,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    backgroundColor: '#00000000'
  };

  /**
   * Broadcasts login success event to Electron / Tauri desktop wrapper shell
   * to dynamically expand window from frameless login card (420x780) to full screen workspace.
   */
  public notifyLoginSuccessAndExpandWindow(): void {
    if (typeof window === 'undefined') return;

    try {
      if ((window as any).electronAPI?.expandWindow) {
        (window as any).electronAPI.expandWindow();
      } else if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.send('login-success-expand-window');
      } else if ((window as any).__TAURI__?.window) {
        (window as any).__TAURI__.window.appWindow.maximize();
        (window as any).__TAURI__.window.appWindow.setResizable(true);
      } else {
        console.log('🖥️ Desktop Standalone Wrapper: Login success expansion signal triggered.');
      }
    } catch (err) {
      console.warn('⚠️ Desktop expansion signal notice:', err);
    }
  }

  public minimizeWindow(): void {
    if (typeof window === 'undefined') return;
    try {
      if ((window as any).electronAPI?.minimize) {
        (window as any).electronAPI.minimize();
      } else if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.send('window-minimize');
      }
    } catch (e) { console.warn('Minimize error', e); }
  }

  public toggleMaximizeWindow(): void {
    if (typeof window === 'undefined') return;
    try {
      if ((window as any).electronAPI?.toggleMaximize) {
        (window as any).electronAPI.toggleMaximize();
      } else if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.send('window-maximize-toggle');
      }
    } catch (e) { console.warn('Maximize error', e); }
  }

  public closeWindow(): void {
    if (typeof window === 'undefined') return;
    try {
      if ((window as any).electronAPI?.close) {
        (window as any).electronAPI.close();
      } else if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.send('window-close');
      }
    } catch (e) { console.warn('Close error', e); }
  }

  /**
   * Returns desktop manifest for active merchant app
   */
  public getManifestForApp(appId: string): DesktopAppManifest {
    const matched = Object.values(DESKTOP_MERCHANT_MANIFESTS).find(m => m.appId === appId);
    return matched || DESKTOP_MERCHANT_MANIFESTS.retail_pos_exe;
  }
}

export const DesktopStandaloneWrapper = new DesktopStandaloneWrapperEngine();
