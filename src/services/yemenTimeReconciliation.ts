/**
 * 🇾🇪 JAM SYSTEM PRO - Yemen Time & Midnight Financial Reconciliation Controller
 * 
 * Enforces a strict 2-minute pause every night from 11:59 PM to 12:01 AM (Asia/Aden GMT+3)
 * for clean financial daily reconciliation, closing cash drawers, and quota resets.
 */

export interface YemenTimeStatus {
  isMidnightPauseActive: boolean;
  yemenTimeString: string;
  yemenDateString: string;
  hours: number;
  minutes: number;
  seconds: number;
  remainingSecondsInPause: number;
  formattedCountdown: string;
}

class YemenTimeReconciliationService {
  private listeners: Set<(status: YemenTimeStatus) => void> = new Set();
  private timerId: any = null;

  constructor() {
    this.startClock();
  }

  /**
   * Get current time object explicitly shifted to Yemen Timezone (UTC+3)
   */
  public getYemenDate(): Date {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utcMs + (3 * 3600000));
  }

  public getStatus(): YemenTimeStatus {
    const yemenNow = this.getYemenDate();
    const hours = yemenNow.getHours();
    const minutes = yemenNow.getMinutes();
    const seconds = yemenNow.getSeconds();

    // Pause window: 23:59:00 (11:59 PM) through 00:00:59 (12:00 AM + 59s) -> releases at 12:01:00 AM
    const isMidnightPauseActive = (hours === 23 && minutes === 59) || (hours === 0 && minutes === 0);

    let remainingSecondsInPause = 0;
    if (hours === 23 && minutes === 59) {
      remainingSecondsInPause = (60 - seconds) + 60; // seconds left in 23:59 plus 60s of 00:00
    } else if (hours === 0 && minutes === 0) {
      remainingSecondsInPause = 60 - seconds;
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const minsLeft = Math.floor(remainingSecondsInPause / 60);
    const secsLeft = remainingSecondsInPause % 60;
    const formattedCountdown = `${pad(minsLeft)}:${pad(secsLeft)}`;

    const ampm = hours >= 12 ? 'م' : 'ص';
    const hours12 = hours % 12 || 12;
    const yemenTimeString = `${pad(hours12)}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
    const yemenDateString = yemenNow.toISOString().split('T')[0];

    return {
      isMidnightPauseActive,
      yemenTimeString,
      yemenDateString,
      hours,
      minutes,
      seconds,
      remainingSecondsInPause,
      formattedCountdown
    };
  }

  public subscribe(listener: (status: YemenTimeStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private startClock(): void {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      const status = this.getStatus();
      this.listeners.forEach(fn => {
        try {
          fn(status);
        } catch (e) {
          console.warn('YemenTimeReconciliation listener error:', e);
        }
      });
    }, 1000);
  }
}

export const yemenTimeService = new YemenTimeReconciliationService();
