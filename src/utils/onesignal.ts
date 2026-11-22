export const ONESIGNAL_APP_ID = 'a12fd9b6-a72f-4f28-b704-2b7a31e26f84';

interface OneSignalV16 {
  init: (options: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  Notifications: {
    permission: boolean;
    requestPermission: () => Promise<void>;
  };
  User: {
    addTag: (key: string, value: string) => void | Promise<void>;
    PushSubscription?: {
      optedIn?: boolean;
    };
  };
}

type OneSignalDeferredCallback = (OneSignal: OneSignalV16) => void | Promise<void>;

declare global {
  interface Window {
    OneSignalDeferred?: OneSignalDeferredCallback[];
    OneSignal?: OneSignalV16;
  }
}

let initPromise: Promise<void> | null = null;
let initFailed = false;

export function initOneSignal(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise<void>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    const timer = window.setTimeout(() => {
      initFailed = true;
      resolve();
    }, 5500);

    window.OneSignalDeferred.push(async (OneSignal: OneSignalV16) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: '/push/onesignal/' },
          serviceWorkerPath: '/OneSignalSDKWorker.js',
        });
      } catch (err) {
        console.warn('OneSignal init warning:', err);
        initFailed = true;
      } finally {
        window.clearTimeout(timer);
        resolve();
      }
    });
  });

  return initPromise;
}

async function runWithOneSignal<T>(
  task: (OneSignal: OneSignalV16) => Promise<T>,
  timeoutMs = 6000
): Promise<{ ok: true; value: T } | { ok: false }> {
  if (typeof window === 'undefined') {
    return { ok: false };
  }

  await initOneSignal();
  if (initFailed) {
    return { ok: false };
  }

  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    const timer = window.setTimeout(() => {
      resolve({ ok: false });
    }, timeoutMs);

    window.OneSignalDeferred.push(async (OneSignal: OneSignalV16) => {
      try {
        const value = await task(OneSignal);
        window.clearTimeout(timer);
        resolve({ ok: true, value });
      } catch (err) {
        console.warn('OneSignal action warning:', err);
        window.clearTimeout(timer);
        resolve({ ok: false });
      }
    });
  });
}

function getBrowserPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function enableOneSignalForProOwner(shopId: string): Promise<{
  granted: boolean;
  permission: NotificationPermission | 'unsupported';
  oneSignalLinked: boolean;
}> {
  const sdkResult = await runWithOneSignal(async (OneSignal) => {
    await OneSignal.Notifications.requestPermission();
    await OneSignal.login(shopId);
    await Promise.resolve(OneSignal.User.addTag('shop_id', shopId));

    const browserPerm = getBrowserPermission();
    const granted =
      Boolean(OneSignal.Notifications?.permission) ||
      browserPerm === 'granted';
    return { granted, permission: browserPerm };
  });

  if (sdkResult.ok) {
    return {
      granted: sdkResult.value.granted,
      permission: sdkResult.value.permission,
      oneSignalLinked: true,
    };
  }

  // Fallback to native browser Notification permission if OneSignal CDN is blocked/offline
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const perm = await Notification.requestPermission();
      return {
        granted: perm === 'granted',
        permission: perm,
        oneSignalLinked: false,
      };
    } catch {
      return {
        granted: false,
        permission: getBrowserPermission(),
        oneSignalLinked: false,
      };
    }
  }

  return {
    granted: false,
    permission: 'unsupported',
    oneSignalLinked: false,
  };
}

export async function enableOneSignalForAdmin(): Promise<{
  granted: boolean;
  permission: NotificationPermission | 'unsupported';
  oneSignalLinked: boolean;
}> {
  const sdkResult = await runWithOneSignal(async (OneSignal) => {
    await OneSignal.Notifications.requestPermission();
    await Promise.resolve(OneSignal.User.addTag('role', 'admin'));

    const browserPerm = getBrowserPermission();
    const granted =
      Boolean(OneSignal.Notifications?.permission) ||
      browserPerm === 'granted';
    return { granted, permission: browserPerm };
  });

  if (sdkResult.ok) {
    return {
      granted: sdkResult.value.granted,
      permission: sdkResult.value.permission,
      oneSignalLinked: true,
    };
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const perm = await Notification.requestPermission();
      return {
        granted: perm === 'granted',
        permission: perm,
        oneSignalLinked: false,
      };
    } catch {
      return {
        granted: false,
        permission: getBrowserPermission(),
        oneSignalLinked: false,
      };
    }
  }

  return {
    granted: false,
    permission: 'unsupported',
    oneSignalLinked: false,
  };
}

export async function syncOneSignalProOwnerIdentity(
  shopId: string
): Promise<void> {
  if (getBrowserPermission() !== 'granted' || !shopId) return;
  await runWithOneSignal(async (OneSignal) => {
    await OneSignal.login(shopId);
    await Promise.resolve(OneSignal.User.addTag('shop_id', shopId));
  });
}

export async function syncOneSignalAdminIdentity(): Promise<void> {
  if (getBrowserPermission() !== 'granted') return;
  await runWithOneSignal(async (OneSignal) => {
    await Promise.resolve(OneSignal.User.addTag('role', 'admin'));
  });
}
