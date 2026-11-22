/**
 * Plays a clear, pleasant notification bell chime using Web Audio API
 * when a new incoming customer visit arrives in the Shop Owner PRO panel.
 */
export function playVisitNotificationSound(): void {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const playTone = (
      freq: number,
      startOffset: number,
      duration: number,
      peakGain = 0.16
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + startOffset);

      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + startOffset + duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.03);
    };

    // Crisp 3-note chime (C5 -> E5 -> G5 -> C6)
    playTone(523.25, 0, 0.16, 0.15);
    playTone(659.25, 0.12, 0.18, 0.16);
    playTone(783.99, 0.24, 0.2, 0.17);
    playTone(1046.5, 0.36, 0.36, 0.18);

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1100);
  } catch {
    // Ignore audio context autoplay restrictions safely
  }
}

/**
 * Displays a real OS/browser push notification at the top of the screen
 * via ServiceWorkerRegistration.showNotification (Android Chrome compatible)
 * with fallback to `new Notification(...)` on desktop browsers.
 */
export async function showSystemPushNotification(
  title: string,
  body: string,
  tag = 'min-fateh-visit'
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag,
          dir: 'rtl',
          lang: 'ar',
        });
        return true;
      }
    }

    const notification = new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
      dir: 'rtl',
      lang: 'ar',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch (err) {
    console.warn('Browser notification warning:', err);
    return false;
  }
}
