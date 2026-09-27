import { useEffect, useState } from 'react';

// Get WebSocket URL dynamically
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (!window.location.host || window.location.protocol.startsWith('cap') || window.location.protocol.startsWith('file')) {
    // For native Electron/Capacitor, point to the dev or production cloud host
    return 'wss://ais-dev-cpravmzzzjg3jsiayido7z-320469830981.europe-west1.run.app';
  }
  return `${protocol}//${window.location.host}`;
};

type TelemetryListener = (payload: any) => void;

class TelemetryWebSocketService {
  private ws: WebSocket | null = null;
  private merchantId: string | null = null;
  private listeners: Set<TelemetryListener> = new Set();
  private reconnectTimeout: any = null;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;

  constructor() {
    // Connect automatically if browser environment
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  public registerMerchant(merchantId: string) {
    this.merchantId = merchantId;
    this.sendRegistration();
  }

  private connect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }

    const url = getWebSocketUrl();
    console.log(`[WebSocket] Connecting to ${url}...`);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected successfully.');
        this.reconnectDelay = 2000; // reset delay
        this.sendRegistration();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TELEMETRY_CORRECTION_PLAN') {
            console.log('[WebSocket] Received real-time correction plan:', data);
            // Notify all subscribers
            this.listeners.forEach((listener) => {
              try {
                listener(data);
              } catch (e) {
                console.error('[WebSocket] Error in subscriber listener:', e);
              }
            });
          }
        } catch (err: any) {
          console.warn('[WebSocket] Error parsing socket frame:', err.message);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Connection closed. Retrying...');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Socket error observed:', err);
      };
    } catch (e) {
      console.error('[WebSocket] Initial socket establishment failed:', e);
      this.scheduleReconnect();
    }
  }

  private sendRegistration() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.merchantId) {
      this.ws.send(JSON.stringify({
        type: 'register',
        merchantId: this.merchantId
      }));
      console.log(`[WebSocket] Sent registration packet for: ${this.merchantId}`);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
      // Increase backoff delay
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  public subscribe(listener: TelemetryListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const telemetryWS = new TelemetryWebSocketService();

// Custom hook to subscribe to WebSocket pushes
export function useWebSocketTelemetry(merchantId: string | undefined, onMessageReceived?: (data: any) => void) {
  const [livePushedIssues, setLivePushedIssues] = useState<any[]>([]);

  useEffect(() => {
    if (!merchantId) return;

    // Register active merchant
    telemetryWS.registerMerchant(merchantId);

    // Subscribe to incoming messages
    const unsubscribe = telemetryWS.subscribe((data) => {
      // Create a quarantined item formatted the same way as our Firestore schema
      const amountValue = data.telemetryData?.snapshotData?.amount || 0;
      const proposedItems = data.correctionPlan?.proposedItems || [
        { accountId: '1100', accountName: 'الصندوق / البنك', debit: 0, credit: amountValue },
        { accountId: '1200', accountName: 'المخازن', debit: amountValue, credit: 0 }
      ];

      const newIssue = {
        id: data.errorId || `ERR-${Date.now()}`,
        ownerId: data.merchantId,
        description: data.telemetryData?.errorContext || 'خلل محاسبي في توازن القيد المالي',
        amount: amountValue,
        status: 'quarantined',
        createdAt: data.telemetryData?.timestamp || new Date().toISOString(),
        errorType: 'إخلال بالتوازن المحاسبي (رصد تلقائي للتدقيق)',
        telemetryLog: data.correctionPlan?.suggestedFixDescriptionAr || `تحليل العزل: ${data.telemetryData?.errorContext}`,
        proposedItems: proposedItems,
        aiCorrectionPlan: data.correctionPlan,
        isRealTimePushed: true // flag indicating it was pushed over WS
      };

      // Intercept and inject silently into the local state
      setLivePushedIssues((prev) => {
        // Prevent duplicates
        if (prev.some((item) => item.id === newIssue.id)) return prev;
        return [newIssue, ...prev];
      });

      if (onMessageReceived) {
        onMessageReceived(newIssue);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [merchantId, onMessageReceived]);

  return { livePushedIssues, setLivePushedIssues };
}
