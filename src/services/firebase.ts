import { IncomingVisit, Shop, ShopCategory, ShopOffer } from '../types';

export const firebaseConfig = {
  apiKey: 'AIzaSyDihRPAzmNzBdtgUoABfOloTRRDrRCgSp0',
  authDomain: 'min-fateh.firebaseapp.com',
  projectId: 'min-fateh',
  storageBucket: 'min-fateh.firebasestorage.app',
  messagingSenderId: '448435844245',
  appId: '1:448435844245:web:7538c149fb6e1a726f579c',
  measurementId: 'G-MTHV0SJ67X',
};

const FIREBASE_CDN_VERSION = '10.14.1';
export const ADMIN_EMAIL = 'abdeltwwepahmed@gmail.com';

export interface FirebaseUserLite {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  reload: () => Promise<void>;
}

export function isAdminUser(user: FirebaseUserLite | null | undefined): boolean {
  return Boolean(user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL);
}

interface FirestoreSnapshotDoc {
  id: string;
  data: () => Record<string, unknown>;
}

interface FirebaseSdkBundle {
  app: unknown;
  db: unknown;
  auth: {
    currentUser: FirebaseUserLite | null;
  };
  authApi: {
    createUserWithEmailAndPassword: (
      auth: unknown,
      email: string,
      password: string
    ) => Promise<{ user: FirebaseUserLite }>;
    signInWithEmailAndPassword: (
      auth: unknown,
      email: string,
      password: string
    ) => Promise<{ user: FirebaseUserLite }>;
    sendEmailVerification: (user: FirebaseUserLite) => Promise<void>;
    signOut: (auth: unknown) => Promise<void>;
    sendPasswordResetEmail: (auth: unknown, email: string) => Promise<void>;
    onAuthStateChanged: (
      auth: unknown,
      cb: (user: FirebaseUserLite | null) => void
    ) => () => void;
  };
  firestoreApi: {
    collection: (...args: unknown[]) => unknown;
    doc: (...args: unknown[]) => unknown;
    query: (...args: unknown[]) => unknown;
    where: (...args: unknown[]) => unknown;
    limit: (...args: unknown[]) => unknown;
    startAfter: (...args: unknown[]) => unknown;
    getDocs: (q: unknown) => Promise<{
      empty: boolean;
      docs: FirestoreSnapshotDoc[];
      metadata?: { fromCache?: boolean };
    }>;
    getDoc: (docRef: unknown) => Promise<{
      exists: () => boolean;
      id: string;
      data: () => Record<string, unknown> | undefined;
    }>;
    onSnapshot: (
      q: unknown,
      onNext: (snapshot: { docs: FirestoreSnapshotDoc[] }) => void,
      onError?: (err: unknown) => void
    ) => () => void;
    addDoc: (colRef: unknown, data: Record<string, unknown>) => Promise<{ id: string }>;
    updateDoc: (docRef: unknown, data: Record<string, unknown>) => Promise<void>;
    deleteDoc: (docRef: unknown) => Promise<void>;
    serverTimestamp: () => unknown;
    runTransaction?: <T>(
      db: unknown,
      updateFunction: (transaction: {
        get: (docRef: unknown) => Promise<{
          exists: () => boolean;
          id: string;
          data: () => Record<string, unknown> | undefined;
        }>;
        update: (docRef: unknown, data: Record<string, unknown>) => void;
      }) => Promise<T>
    ) => Promise<T>;
  };
  persistenceEnabled: boolean;
}

let sdkPromise: Promise<FirebaseSdkBundle> | null = null;

async function initFirebaseViaCdn(): Promise<FirebaseSdkBundle> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = (async () => {
    const appMod = await import(
      /* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-app.js`
    );
    const firestoreMod = await import(
      /* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-firestore.js`
    );
    const authMod = await import(
      /* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-auth.js`
    );

    const app = appMod.initializeApp(firebaseConfig);
    const db = firestoreMod.getFirestore(app);
    const auth = authMod.getAuth(app);

    let persistenceEnabled = false;
    try {
      await firestoreMod.enableIndexedDbPersistence(db);
      persistenceEnabled = true;
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code !== 'failed-precondition' && code !== 'unimplemented') {
        console.warn('IndexedDB persistence warning:', err);
      }
    }

    return {
      app,
      db,
      auth,
      authApi: {
        createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
        signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
        sendEmailVerification: authMod.sendEmailVerification,
        signOut: authMod.signOut,
        sendPasswordResetEmail: authMod.sendPasswordResetEmail,
        onAuthStateChanged: authMod.onAuthStateChanged,
      },
      firestoreApi: {
        collection: firestoreMod.collection,
        doc: firestoreMod.doc,
        query: firestoreMod.query,
        where: firestoreMod.where,
        limit: firestoreMod.limit,
        startAfter: firestoreMod.startAfter,
        getDocs: firestoreMod.getDocs,
        getDoc: firestoreMod.getDoc,
        onSnapshot: firestoreMod.onSnapshot,
        addDoc: firestoreMod.addDoc,
        updateDoc: firestoreMod.updateDoc,
        deleteDoc: firestoreMod.deleteDoc,
        serverTimestamp: firestoreMod.serverTimestamp,
        runTransaction: firestoreMod.runTransaction,
      },
      persistenceEnabled,
    };
  })();

  return sdkPromise;
}

const CATEGORY_LABELS: Record<Exclude<ShopCategory, 'all'>, string> = {
  pharmacy: 'صيدليات',
  clinic: 'عيادات ومراكز طبية',
  labs: 'معامل تحاليل وأشعة',
  restaurant: 'مطاعم ومأكولات',
  cafe: 'كافيهات ومقاهي',
  supermarket: 'سوبر ماركت وبقالة',
  bakery: 'مخبوزات وحلواني',
  butcher: 'جزارة ودواجن وأسماك',
  produce: 'خضار وفاكهة',
  mobile_repair: 'صيانة ومستلزمات موبايل',
  computer_print: 'كمبيوتر وخدمات طباعة',
  auto_parts: 'صيانة سيارات وكاوتش',
  plumbing_electrical: 'سباكة وكهرباء وحدايد',
  appliances_ac: 'صيانة أجهزة وتكييف',
  barber: 'حلاقة رجالي',
  beauty_salon: 'كوافير وتجميل',
  clothing: 'ملابس وأحذية',
  laundry: 'مغاسل ودراي كلين',
  payments_telecom: 'خدمات دفع واتصالات',
  other: 'أخرى',
};

const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABELS));

function normalizeCategory(raw: unknown): Exclude<ShopCategory, 'all'> {
  const val = String(raw ?? '').trim();
  if (VALID_CATEGORIES.has(val)) {
    return val as Exclude<ShopCategory, 'all'>;
  }
  if (val === 'tires_batteries') return 'auto_parts';
  if (val.includes('صيدل')) return 'pharmacy';
  if (val.includes('عياد') || val.includes('طوارئ') || val.includes('طبي')) {
    return 'clinic';
  }
  if (val.includes('تحاليل') || val.includes('معمل') || val.includes('أشعة')) {
    return 'labs';
  }
  if (val.includes('مطعم') || val.includes('مأكولات')) return 'restaurant';
  if (val.includes('كافيه') || val.includes('مقه')) return 'cafe';
  if (val.includes('سوبر') || val.includes('بقال')) return 'supermarket';
  if (val.includes('مخبوز') || val.includes('فرن') || val.includes('حلواني')) {
    return 'bakery';
  }
  if (val.includes('جزار') || val.includes('دواجن') || val.includes('أسماك')) {
    return 'butcher';
  }
  if (val.includes('خضار') || val.includes('فاكه')) return 'produce';
  if (val.includes('موبايل') || val.includes('هاتف')) return 'mobile_repair';
  if (val.includes('كمبيوتر') || val.includes('طباع')) return 'computer_print';
  if (
    val.includes('كاوتش') ||
    val.includes('بطاري') ||
    val.includes('سيارات') ||
    val.includes('ميكانيك') ||
    val.includes('قطع غيار')
  ) {
    return 'auto_parts';
  }
  if (val.includes('سباك') || val.includes('كهرباء') || val.includes('حدايد')) {
    return 'plumbing_electrical';
  }
  if (val.includes('تكييف') || val.includes('أجهز')) return 'appliances_ac';
  if (val.includes('حلاق')) return 'barber';
  if (val.includes('كوافير') || val.includes('تجميل')) return 'beauty_salon';
  if (val.includes('ملابس') || val.includes('أحذية')) return 'clothing';
  if (val.includes('مغسل') || val.includes('دراي كلين')) return 'laundry';
  if (val.includes('دفع') || val.includes('اتصالات') || val.includes('فوري')) {
    return 'payments_telecom';
  }
  if (val.includes('أخر')) return 'other';
  return 'other';
}

function extractTimestampMs(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (raw && typeof raw === 'object') {
    const maybeTs = raw as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
    };
    if (typeof maybeTs.toMillis === 'function') {
      return maybeTs.toMillis();
    }
    if (typeof maybeTs.toDate === 'function') {
      return maybeTs.toDate().getTime();
    }
    if (typeof maybeTs.seconds === 'number') {
      return maybeTs.seconds * 1000;
    }
  }
  return undefined;
}

function formatTimestampField(raw: unknown): string | undefined {
  const ms = extractTimestampMs(raw);
  if (typeof ms === 'number') {
    return new Date(ms).toLocaleString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  }
  return undefined;
}

function mapFirestoreDocToShop(
  id: string,
  data: Record<string, unknown>
): Shop {
  const category = normalizeCategory(data.category ?? data.categoryLabel);
  const categoryLabel =
    typeof data.categoryLabel === 'string' && data.categoryLabel.trim()
      ? data.categoryLabel.trim()
      : CATEGORY_LABELS[category];

  const governorate =
    typeof data.governorate === 'string' && data.governorate.trim()
      ? data.governorate.trim()
      : 'الفيوم';
  const center =
    typeof data.center === 'string' && data.center.trim()
      ? data.center.trim()
      : typeof data.area === 'string' && data.area.trim()
        ? data.area.trim()
        : 'مركز إطسا';
  const village =
    typeof data.village === 'string' && data.village.trim()
      ? data.village.trim()
      : center;

  const phone = String(data.phone ?? '01000000000').trim();
  const cleanDigits = phone.replace(/\D/g, '');
  const fallbackWa = cleanDigits.startsWith('20')
    ? cleanDigits
    : cleanDigits.startsWith('0')
      ? `2${cleanDigits}`
      : `20${cleanDigits}`;

  const rawServices = Array.isArray(data.services)
    ? data.services.map((s) => String(s)).filter(Boolean)
    : [];

  const resolvedImage =
    typeof data.imageBase64 === 'string' && data.imageBase64.trim()
      ? data.imageBase64.trim()
      : typeof data.imageUrl === 'string' && data.imageUrl.trim()
        ? data.imageUrl.trim()
        : typeof data.image === 'string' && data.image.trim()
          ? data.image.trim()
          : undefined;

  const rawOffers = Array.isArray(data.offers) ? data.offers : [];
  const offers: ShopOffer[] = rawOffers
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object')
    )
    .map((item, idx) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `offer-${idx}`,
      title: String(item.title ?? 'عرض خاص').trim(),
      priceBefore:
        typeof item.priceBefore === 'number' && !Number.isNaN(item.priceBefore)
          ? item.priceBefore
          : undefined,
      priceAfter:
        typeof item.priceAfter === 'number' && !Number.isNaN(item.priceAfter)
          ? item.priceAfter
          : Number(item.priceAfter) || 0,
      discountNote:
        typeof item.discountNote === 'string' && item.discountNote.trim()
          ? item.discountNote.trim()
          : undefined,
      imageUrl:
        typeof item.imageUrl === 'string' && item.imageUrl.trim()
          ? item.imageUrl.trim()
          : typeof item.imageBase64 === 'string' && item.imageBase64.trim()
            ? item.imageBase64.trim()
            : undefined,
      createdAt:
        typeof item.createdAt === 'string' ? item.createdAt : undefined,
    }));

  return {
    id,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
    ownerEmail: typeof data.ownerEmail === 'string' ? data.ownerEmail : undefined,
    name: String(data.name ?? 'محل مسجل').trim(),
    category,
    categoryLabel,
    governorate,
    center,
    village,
    area:
      typeof data.area === 'string' && data.area.trim()
        ? data.area.trim()
        : `${village} · ${center}`,
    address: String(data.address ?? `${village}، ${center}`).trim(),
    distanceKm:
      typeof data.distanceKm === 'number' && !Number.isNaN(data.distanceKm)
        ? data.distanceKm
        : 1.0,
    lat:
      typeof data.lat === 'number' && !Number.isNaN(data.lat)
        ? data.lat
        : 29.2369,
    lng:
      typeof data.lng === 'number' && !Number.isNaN(data.lng)
        ? data.lng
        : 30.7885,
    imageUrl: resolvedImage,
    isOpen: Boolean(data.isOpen ?? true),
    hoursNote: String(data.hoursNote ?? 'متاح لخدمتكم').trim(),
    featured: Boolean(data.isFeatured ?? data.featured ?? false),
    isPro: Boolean(data.isPro ?? false),
    offers,
    activeOffer:
      typeof data.activeOffer === 'string' && data.activeOffer.trim()
        ? data.activeOffer.trim()
        : undefined,
    offerText:
      typeof data.offerText === 'string' && data.offerText.trim()
        ? data.offerText.trim()
        : undefined,
    status: typeof data.status === 'string' ? data.status : 'approved',
    suspensionReason:
      typeof data.suspensionReason === 'string'
        ? data.suspensionReason
        : undefined,
    lastUpdated: formatTimestampField(data.lastUpdated),
    createdAtMs: extractTimestampMs(data.createdAt),
    lastUpdatedMs: extractTimestampMs(data.lastUpdated),
    phone,
    whatsapp:
      typeof data.whatsapp === 'string' && data.whatsapp.trim()
        ? data.whatsapp.trim()
        : fallbackWa,
    services: rawServices,
  };
}

export interface FetchShopsResult {
  shops: Shop[];
  lastDoc: unknown | null;
  hasMore: boolean;
  fromCache: boolean;
  isEmpty: boolean;
  persistenceEnabled: boolean;
}

export async function fetchApprovedShopsPage(options?: {
  lastDoc?: unknown | null;
  pageSize?: number;
}): Promise<FetchShopsResult> {
  const pageSize = options?.pageSize ?? 20;
  const sdk = await initFirebaseViaCdn();
  const { collection, query, where, limit, startAfter, getDocs } =
    sdk.firestoreApi;

  const shopsRef = collection(sdk.db, 'shops');
  const constraints: unknown[] = [where('status', 'in', ['approved', 'prayer'])];

  if (options?.lastDoc) {
    constraints.push(startAfter(options.lastDoc));
  }
  constraints.push(limit(pageSize));

  const q = query(shopsRef, ...constraints);
  const snapshot = await getDocs(q);

  const mapped = snapshot.docs.map((docSnap) =>
    mapFirestoreDocToShop(docSnap.id, docSnap.data())
  );

  const nextLastDoc =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return {
    shops: mapped,
    lastDoc: nextLastDoc,
    hasMore: snapshot.docs.length === pageSize,
    fromCache: Boolean(snapshot.metadata?.fromCache),
    isEmpty: snapshot.empty,
    persistenceEnabled: sdk.persistenceEnabled,
  };
}

export async function fetchShopByIdFromFirestore(
  shopId: string
): Promise<Shop | null> {
  if (!shopId.trim()) return null;
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId.trim());
  const snap = await sdk.firestoreApi.getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!data) return null;
  const mapped = mapFirestoreDocToShop(snap.id, data);
  const mappedStatus = mapped.status ?? 'approved';
  if (mappedStatus !== 'approved' && mappedStatus !== 'prayer') return null;
  return mapped;
}

export function mapFirebaseAuthErrorToArabic(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجل بالفعل. يمكنك تسجيل الدخول من التبويب الأول.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة، يجب أن تتكون من 6 أحرف أو أرقام على الأقل.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/too-many-requests':
      return 'تم إجراء محاولات كثيرة متتالية. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالإنترنت. يرجى التحقق من الشبكة والمحاولة مجدداً.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'حدث خطأ غير متوقع أثناء المصادقة. يرجى المحاولة مرة أخرى.';
  }
}

export async function subscribeOwnerAuthState(
  callback: (user: FirebaseUserLite | null) => void
): Promise<() => void> {
  const sdk = await initFirebaseViaCdn();
  return sdk.authApi.onAuthStateChanged(sdk.auth, callback);
}

export async function registerOwnerAndSendVerification(
  email: string,
  password: string
): Promise<FirebaseUserLite> {
  const sdk = await initFirebaseViaCdn();
  const credential = await sdk.authApi.createUserWithEmailAndPassword(
    sdk.auth,
    email.trim(),
    password
  );
  await sdk.authApi.sendEmailVerification(credential.user);
  return credential.user;
}

export async function loginOwnerWithEmail(
  email: string,
  password: string
): Promise<FirebaseUserLite> {
  const sdk = await initFirebaseViaCdn();
  const credential = await sdk.authApi.signInWithEmailAndPassword(
    sdk.auth,
    email.trim(),
    password
  );
  return credential.user;
}

export async function resendOwnerVerificationEmail(): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const current = sdk.auth.currentUser;
  if (!current) {
    throw new Error('لا يوجد حساب مسجل حالياً.');
  }
  await sdk.authApi.sendEmailVerification(current);
}

export async function sendOwnerPasswordResetEmail(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) {
    throw new Error('يرجى إدخال بريد إلكتروني صحيح.');
  }
  const sdk = await initFirebaseViaCdn();
  await sdk.authApi.sendPasswordResetEmail(sdk.auth, trimmed);
}

export async function reloadCurrentOwnerUser(): Promise<FirebaseUserLite | null> {
  const sdk = await initFirebaseViaCdn();
  const current = sdk.auth.currentUser;
  if (!current) return null;
  await current.reload();
  return sdk.auth.currentUser;
}

export async function logoutOwner(): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  await sdk.authApi.signOut(sdk.auth);
}

export interface NewShopFirestorePayload {
  ownerId: string;
  ownerEmail: string;
  name: string;
  category: Exclude<ShopCategory, 'all'>;
  categoryLabel: string;
  governorate: string;
  center: string;
  village: string;
  address: string;
  phone: string;
  whatsapp: string;
  lat: number;
  lng: number;
  imageBase64: string;
  hoursNote: string;
}

export async function createPendingShopInFirestore(
  payload: NewShopFirestorePayload
): Promise<string> {
  const sdk = await initFirebaseViaCdn();
  const shopsRef = sdk.firestoreApi.collection(sdk.db, 'shops');

  const docData: Record<string, unknown> = {
    ownerId: payload.ownerId,
    ownerEmail: payload.ownerEmail,
    name: payload.name,
    category: payload.category,
    categoryLabel: payload.categoryLabel,
    governorate: payload.governorate,
    center: payload.center,
    village: payload.village,
    area: `${payload.village} · ${payload.center}`,
    address: payload.address,
    phone: payload.phone,
    whatsapp: payload.whatsapp,
    lat: payload.lat,
    lng: payload.lng,
    imageBase64: payload.imageBase64,
    hoursNote: payload.hoursNote || 'متاح لخدمتكم',
    isOpen: true,
    status: 'pending',
    isFeatured: false,
    isPro: false,
    offers: [],
    suspensionReason: '',
    createdAt: sdk.firestoreApi.serverTimestamp(),
    lastUpdated: sdk.firestoreApi.serverTimestamp(),
  };

  const docRef = await sdk.firestoreApi.addDoc(shopsRef, docData);
  return docRef.id;
}

export async function fetchOwnerShops(ownerId: string): Promise<Shop[]> {
  const sdk = await initFirebaseViaCdn();
  const { collection, query, where, getDocs } = sdk.firestoreApi;
  const q = query(
    collection(sdk.db, 'shops'),
    where('ownerId', '==', ownerId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => mapFirestoreDocToShop(d.id, d.data()));
}

export async function updateOwnerShopOpenStatus(
  shopId: string,
  isOpen: boolean,
  status: 'approved' | 'prayer' = 'approved'
): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId);
  await sdk.firestoreApi.updateDoc(ref, {
    isOpen,
    status,
    lastUpdated: sdk.firestoreApi.serverTimestamp(),
  });
}

export interface OwnerShopEditPayload {
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  hoursNote: string;
  imageBase64?: string;
}

export async function updateOwnerShopDetails(
  shopId: string,
  updates: OwnerShopEditPayload
): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId);
  const payload: Record<string, unknown> = {
    name: updates.name,
    address: updates.address,
    phone: updates.phone,
    whatsapp: updates.whatsapp,
    hoursNote: updates.hoursNote,
    lastUpdated: sdk.firestoreApi.serverTimestamp(),
  };
  if (typeof updates.imageBase64 === 'string') {
    payload.imageBase64 = updates.imageBase64;
  }
  await sdk.firestoreApi.updateDoc(ref, payload);
}

// ==========================================
// Admin Dashboard Operations
// ==========================================

export async function fetchAllShopsForAdmin(): Promise<Shop[]> {
  const sdk = await initFirebaseViaCdn();
  const shopsRef = sdk.firestoreApi.collection(sdk.db, 'shops');
  const snapshot = await sdk.firestoreApi.getDocs(shopsRef);
  return snapshot.docs.map((d) => mapFirestoreDocToShop(d.id, d.data()));
}

export async function approveShopInFirestore(shopId: string): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId);
  await sdk.firestoreApi.updateDoc(ref, {
    status: 'approved',
    suspensionReason: '',
    lastUpdated: sdk.firestoreApi.serverTimestamp(),
  });
}

export async function toggleShopFeaturedInFirestore(
  shopId: string,
  isFeatured: boolean
): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId);
  await sdk.firestoreApi.updateDoc(ref, {
    isFeatured,
    lastUpdated: sdk.firestoreApi.serverTimestamp(),
  });
}

export async function suspendShopInFirestore(
  shopId: string,
  reason: string
): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId);
  await sdk.firestoreApi.updateDoc(ref, {
    status: 'suspended',
    isOpen: false,
    suspensionReason: reason.trim(),
    lastUpdated: sdk.firestoreApi.serverTimestamp(),
  });
}

export async function unsuspendShopInFirestore(shopId: string): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId);
  await sdk.firestoreApi.updateDoc(ref, {
    status: 'approved',
    suspensionReason: '',
    lastUpdated: sdk.firestoreApi.serverTimestamp(),
  });
}

export async function deleteShopInFirestore(shopId: string): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId);
  await sdk.firestoreApi.deleteDoc(ref);
}

// ==========================================
// Phase 6: PRO Mode, Offers & Incoming Visits
// ==========================================

export async function toggleShopProInFirestore(
  shopId: string,
  isPro: boolean
): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId);
  await sdk.firestoreApi.updateDoc(ref, {
    isPro,
    lastUpdated: sdk.firestoreApi.serverTimestamp(),
  });
}

export async function updateOwnerShopOffersInFirestore(
  shopId: string,
  offers: ShopOffer[]
): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'shops', shopId);
  const sanitized = offers.slice(0, 4).map((o) => {
    const entry: Record<string, unknown> = {
      id: o.id,
      title: o.title.trim(),
      priceAfter: Number(o.priceAfter) || 0,
    };
    if (typeof o.priceBefore === 'number' && !Number.isNaN(o.priceBefore)) {
      entry.priceBefore = o.priceBefore;
    }
    if (o.discountNote && o.discountNote.trim()) {
      entry.discountNote = o.discountNote.trim();
    }
    if (o.imageUrl && o.imageUrl.trim()) {
      entry.imageUrl = o.imageUrl.trim();
    }
    if (o.createdAt) {
      entry.createdAt = o.createdAt;
    }
    return entry;
  });

  await sdk.firestoreApi.updateDoc(ref, {
    offers: sanitized,
    lastUpdated: sdk.firestoreApi.serverTimestamp(),
  });
}

function mapIncomingVisitDoc(
  id: string,
  data: Record<string, unknown>
): IncomingVisit {
  const ms =
    typeof data.createdAtMs === 'number' && !Number.isNaN(data.createdAtMs)
      ? data.createdAtMs
      : extractTimestampMs(data.createdAt) ?? Date.now();
  const tsFormatted = formatTimestampField(data.createdAt);
  const fallbackLabel = new Date(ms).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    id,
    shopId: String(data.shopId ?? ''),
    shopName:
      typeof data.shopName === 'string' && data.shopName.trim()
        ? data.shopName.trim()
        : undefined,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
    customerName:
      typeof data.customerName === 'string' && data.customerName.trim()
        ? data.customerName.trim()
        : 'عميل في الطريق',
    customerNote:
      typeof data.customerNote === 'string' ? data.customerNote.trim() : '',
    status: data.status === 'handled' ? 'handled' : 'active',
    createdAtMs: ms,
    createdAtLabel: tsFormatted ?? fallbackLabel,
  };
}

export async function createIncomingVisitInFirestore(payload: {
  shopId: string;
  shopName: string;
  ownerId?: string;
  customerName?: string;
  customerNote?: string;
}): Promise<string> {
  const sdk = await initFirebaseViaCdn();
  const colRef = sdk.firestoreApi.collection(sdk.db, 'incoming_visits');
  const docRef = await sdk.firestoreApi.addDoc(colRef, {
    shopId: payload.shopId,
    shopName: payload.shopName,
    ownerId: payload.ownerId ?? '',
    customerName: payload.customerName?.trim() || 'عميل عبر التطبيق',
    customerNote: payload.customerNote?.trim() || '',
    status: 'active',
    createdAtMs: Date.now(),
    createdAt: sdk.firestoreApi.serverTimestamp(),
  });
  return docRef.id;
}

export async function subscribeIncomingVisitsForOwner(
  ownerId: string,
  onVisits: (visits: IncomingVisit[]) => void,
  onError?: (err: unknown) => void
): Promise<() => void> {
  const sdk = await initFirebaseViaCdn();
  const { collection, query, where, onSnapshot } = sdk.firestoreApi;
  const q = query(
    collection(sdk.db, 'incoming_visits'),
    where('ownerId', '==', ownerId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const activeVisits = snapshot.docs
        .map((d) => mapIncomingVisitDoc(d.id, d.data()))
        .filter((v) => v.status !== 'handled')
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onVisits(activeVisits);
    },
    onError
  );
}

export async function markIncomingVisitHandledInFirestore(
  visitId: string
): Promise<void> {
  const sdk = await initFirebaseViaCdn();
  const ref = sdk.firestoreApi.doc(sdk.db, 'incoming_visits', visitId);
  await sdk.firestoreApi.updateDoc(ref, {
    status: 'handled',
    handledAt: sdk.firestoreApi.serverTimestamp(),
  });
}

export async function fetchAllIncomingVisitsForAdmin(): Promise<IncomingVisit[]> {
  const sdk = await initFirebaseViaCdn();
  const colRef = sdk.firestoreApi.collection(sdk.db, 'incoming_visits');
  const snapshot = await sdk.firestoreApi.getDocs(colRef);
  return snapshot.docs
    .map((d) => mapIncomingVisitDoc(d.id, d.data()))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

// ==========================================
// One-Time Dynamic Unlock Codes (unlock_codes)
// ==========================================

function generateSecureSixDigitCode(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / 900000) * 900000;
    let rand = 0;
    do {
      crypto.getRandomValues(buf);
      rand = buf[0];
    } while (rand >= limit);
    return String(100000 + (rand % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createOneTimeUnlockCodeInFirestore(): Promise<string> {
  const sdk = await initFirebaseViaCdn();
  if (!isAdminUser(sdk.auth.currentUser)) {
    throw new Error('غير مصرح بإنشاء أكواد فك الحظر إلا للإدارة فقط.');
  }

  const code = generateSecureSixDigitCode();
  const colRef = sdk.firestoreApi.collection(sdk.db, 'unlock_codes');
  await sdk.firestoreApi.addDoc(colRef, {
    code,
    used: false,
    createdAt: sdk.firestoreApi.serverTimestamp(),
  });
  return code;
}

export async function verifyAndBurnUnlockCodeInFirestore(
  rawCode: string
): Promise<boolean> {
  const normalized = String(rawCode ?? '').trim();
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const sdk = await initFirebaseViaCdn();
  const { collection, query, where, limit, getDocs, doc, updateDoc, serverTimestamp, runTransaction } =
    sdk.firestoreApi;

  const q = query(
    collection(sdk.db, 'unlock_codes'),
    where('code', '==', normalized),
    where('used', '==', false),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty || snapshot.docs.length === 0) {
    return false;
  }

  const matchedDoc = snapshot.docs[0];
  const docData = matchedDoc.data();
  if (!docData || docData.used !== false) {
    return false;
  }

  const codeDocRef = doc(sdk.db, 'unlock_codes', matchedDoc.id);

  if (typeof runTransaction === 'function') {
    return await runTransaction(sdk.db, async (transaction) => {
      const freshSnap = await transaction.get(codeDocRef);
      if (!freshSnap.exists()) return false;
      const freshData = freshSnap.data();
      if (!freshData || freshData.used !== false) {
        return false;
      }
      transaction.update(codeDocRef, {
        used: true,
        usedAt: serverTimestamp(),
      });
      return true;
    });
  }

  await updateDoc(codeDocRef, {
    used: true,
    usedAt: serverTimestamp(),
  });
  return true;
}

