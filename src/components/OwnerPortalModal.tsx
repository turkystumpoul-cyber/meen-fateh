import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  Bell,
  BellRing,
  Camera,
  CheckCircle2,
  Clock,
  Crosshair,
  Crown,
  Edit3,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  MailCheck,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  CENTER_DEFAULT_COORDS,
  GOVERNORATES,
  GOVERNORATE_DEFAULT_COORDS,
  getCentersForGovernorate,
  getVillagesForCenter,
} from '../data/locations';
import { CATEGORY_OPTIONS } from '../data/shops';
import {
  FirebaseUserLite,
  NewShopFirestorePayload,
  createPendingShopInFirestore,
  fetchOwnerShops,
  loginOwnerWithEmail,
  logoutOwner,
  mapFirebaseAuthErrorToArabic,
  markIncomingVisitHandledInFirestore,
  registerOwnerAndSendVerification,
  reloadCurrentOwnerUser,
  resendOwnerVerificationEmail,
  updateOwnerShopDetails,
  updateOwnerShopOffersInFirestore,
  updateOwnerShopOpenStatus,
  verifyAndBurnUnlockCodeInFirestore,
  sendOwnerPasswordResetEmail,
} from '../services/firebase';
import { GovernorateName, IncomingVisit, Shop, ShopCategory, ShopOffer } from '../types';
import { compressImageToWebP } from '../utils/imageCompression';
import {
  playVisitNotificationSound,
  showSystemPushNotification,
} from '../utils/notificationSound';
import {
  enableOneSignalForProOwner,
  syncOneSignalProOwnerIdentity,
} from '../utils/onesignal';

interface OwnerPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUserLite | null;
  allShops: Shop[];
  incomingVisits: IncomingVisit[];
  onVillageDiscovered: (gov: string, center: string, village: string) => void;
  onShopUpdated: () => void;
}

type ModalTab = 'login' | 'register';

interface PendingDraft {
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

const DRAFT_STORAGE_KEY = 'minFateh_pendingShopDraft';
const LOGIN_GUARD_STORAGE_KEY = 'minFateh_ownerLoginGuard';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const EGYPT_MOBILE_REGEX = /^01[0125][0-9]{8}$/;
const ADMIN_WHATSAPP = '201012345678';

interface LoginGuardState {
  failedAttempts: number;
  lockedUntil: number | null;
}

function readLoginGuard(): LoginGuardState {
  try {
    const raw = localStorage.getItem(LOGIN_GUARD_STORAGE_KEY);
    if (!raw) return { failedAttempts: 0, lockedUntil: null };
    const parsed = JSON.parse(raw) as Partial<LoginGuardState>;
    const now = Date.now();
    const lockedUntil =
      typeof parsed.lockedUntil === 'number' && parsed.lockedUntil > now
        ? parsed.lockedUntil
        : null;
    if (typeof parsed.lockedUntil === 'number' && parsed.lockedUntil <= now) {
      localStorage.removeItem(LOGIN_GUARD_STORAGE_KEY);
      return { failedAttempts: 0, lockedUntil: null };
    }
    const failedAttempts =
      typeof parsed.failedAttempts === 'number' && parsed.failedAttempts > 0
        ? parsed.failedAttempts
        : 0;
    return { failedAttempts, lockedUntil };
  } catch {
    return { failedAttempts: 0, lockedUntil: null };
  }
}

function writeLoginGuard(state: LoginGuardState) {
  try {
    localStorage.setItem(LOGIN_GUARD_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function clearLoginGuard() {
  try {
    localStorage.removeItem(LOGIN_GUARD_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

function formatCountdownMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function saveDraftLocally(uid: string, draft: PendingDraft) {
  try {
    sessionStorage.setItem(
      `${DRAFT_STORAGE_KEY}_${uid}`,
      JSON.stringify(draft)
    );
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function loadDraftLocally(uid: string): PendingDraft | null {
  try {
    const raw = sessionStorage.getItem(`${DRAFT_STORAGE_KEY}_${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as PendingDraft;
  } catch {
    return null;
  }
}

function clearDraftLocally(uid: string) {
  try {
    sessionStorage.removeItem(`${DRAFT_STORAGE_KEY}_${uid}`);
  } catch {
    // Ignore
  }
}

function normalizeWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('20')) return digits;
  if (digits.startsWith('0')) return `2${digits}`;
  return `20${digits}`;
}

function stripWhatsAppPrefix(wa: string): string {
  if (wa.startsWith('20') && wa.length === 12) return wa.slice(1);
  return wa;
}

export function OwnerPortalModal({
  isOpen,
  onClose,
  currentUser,
  allShops,
  incomingVisits,
  onVillageDiscovered,
  onShopUpdated,
}: OwnerPortalModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('login');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Login & 15-minute lockout guard state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [failedLoginAttempts, setFailedLoginAttempts] = useState<number>(
    () => readLoginGuard().failedAttempts
  );
  const [lockedUntilMs, setLockedUntilMs] = useState<number | null>(
    () => readLoginGuard().lockedUntil
  );
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState<number>(
    () => {
      const until = readLoginGuard().lockedUntil;
      return until && until > Date.now()
        ? Math.ceil((until - Date.now()) / 1000)
        : 0;
    }
  );
  const [showUnlockCodeForm, setShowUnlockCodeForm] = useState(false);
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [unlockCodeError, setUnlockCodeError] = useState<string | null>(null);
  const [isVerifyingUnlockCode, setIsVerifyingUnlockCode] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [forgotPasswordCooldown, setForgotPasswordCooldown] = useState(0);

  // Owner dashboard state
  const [ownerShops, setOwnerShops] = useState<Shop[]>([]);
  const [isLoadingOwnerShops, setIsLoadingOwnerShops] = useState(false);
  const [togglingShopId, setTogglingShopId] = useState<string | null>(null);
  const [showAddFormWhileLoggedIn, setShowAddFormWhileLoggedIn] =
    useState(false);

  // Edit approved shop state
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editHoursNote, setEditHoursNote] = useState('');
  const [editImageBase64, setEditImageBase64] = useState<string | undefined>(
    undefined
  );
  const [editImageSizeKb, setEditImageSizeKb] = useState<number | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // PRO incoming visits & offers state
  const [handlingVisitId, setHandlingVisitId] = useState<string | null>(null);
  const [isEnablingNotifShopId, setIsEnablingNotifShopId] = useState<
    string | null
  >(null);
  const [linkedOneSignalShopIds, setLinkedOneSignalShopIds] = useState<
    Record<string, boolean>
  >({});
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const [offerFormShopId, setOfferFormShopId] = useState<string | null>(null);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerPriceAfter, setOfferPriceAfter] = useState('');
  const [offerPriceBefore, setOfferPriceBefore] = useState('');
  const [offerDiscountNote, setOfferDiscountNote] = useState('');
  const [offerImageBase64, setOfferImageBase64] = useState('');
  const [offerImageSizeKb, setOfferImageSizeKb] = useState<number | null>(null);
  const [isCompressingOfferImg, setIsCompressingOfferImg] = useState(false);
  const [isSavingOffers, setIsSavingOffers] = useState(false);

  // Registration & Shop creation state
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] =
    useState<Exclude<ShopCategory, 'all'>>('pharmacy');
  const [shopGov, setShopGov] = useState<GovernorateName>('الفيوم');
  const [shopCenter, setShopCenter] = useState<string>('مركز إطسا');
  const [shopVillage, setShopVillage] = useState<string>('جردو');
  const [manualVillage, setManualVillage] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [shopWhatsapp, setShopWhatsapp] = useState('');
  const [shopHoursNote, setShopHoursNote] = useState('متاح لخدمتكم — خدمة ليلية');

  // GPS capture state
  const [capturedCoords, setCapturedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);

  // Image compression state
  const [imageBase64, setImageBase64] = useState('');
  const [imageSizeKb, setImageSizeKb] = useState<number | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  // Verification & submission states
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [isCheckingVerify, setIsCheckingVerify] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const centerChoices = getCentersForGovernorate(shopGov, allShops);
  const villageChoices = getVillagesForCenter(shopGov, shopCenter, allShops);
  const categoryChoices = CATEGORY_OPTIONS.filter(
    (
      c
    ): c is { id: Exclude<ShopCategory, 'all'>; label: string; emoji: string } =>
      c.id !== 'all'
  );

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    const guard = readLoginGuard();
    setFailedLoginAttempts(guard.failedAttempts);
    setLockedUntilMs(guard.lockedUntil);
  }, [isOpen]);

  useEffect(() => {
    if (!lockedUntilMs) {
      setLockoutRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const diffMs = lockedUntilMs - Date.now();
      if (diffMs <= 0) {
        clearLoginGuard();
        setLockedUntilMs(null);
        setFailedLoginAttempts(0);
        setLockoutRemainingSeconds(0);
        setShowUnlockCodeForm(false);
        setUnlockCodeError(null);
        return false;
      }
      setLockoutRemainingSeconds(Math.ceil(diffMs / 1000));
      return true;
    };

    if (!updateRemaining()) return;
    const timer = window.setInterval(() => {
      if (!updateRemaining()) {
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntilMs]);

  useEffect(() => {
    if (forgotPasswordCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setForgotPasswordCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [forgotPasswordCooldown]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const reloadOwnerShopsList = async (uid: string) => {
    setIsLoadingOwnerShops(true);
    try {
      const list = await fetchOwnerShops(uid);
      setOwnerShops(list);
      const firstPro = list.find(
        (s) => s.isPro && (s.status === 'approved' || s.status === 'prayer')
      );
      if (firstPro) {
        void syncOneSignalProOwnerIdentity(firstPro.id);
      }
    } catch (err) {
      console.warn('Could not load owner shops:', err);
    } finally {
      setIsLoadingOwnerShops(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !currentUser || !currentUser.emailVerified) return;
    void reloadOwnerShopsList(currentUser.uid);
  }, [isOpen, currentUser, submissionSuccess]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGovChange = (gov: GovernorateName) => {
    setShopGov(gov);
    const centers = getCentersForGovernorate(gov, allShops);
    const firstCenter = centers[0] ?? '';
    setShopCenter(firstCenter);
    const villages = getVillagesForCenter(gov, firstCenter, allShops);
    setShopVillage(villages[0] ?? '__manual__');
    setManualVillage('');
  };

  const handleCenterChange = (center: string) => {
    setShopCenter(center);
    const villages = getVillagesForCenter(shopGov, center, allShops);
    setShopVillage(villages[0] ?? '__manual__');
    setManualVillage('');
  };

  const handleCaptureShopGps = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setErrorMsg('متصفحك لا يدعم تحديد الموقع الجغرافي (GPS).');
      return;
    }

    setErrorMsg(null);
    setIsCapturingGps(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCapturedCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setIsCapturingGps(false);
        setInfoMsg('تم التقاط إحداثيات المحل الحالية بنجاح.');
      },
      (err) => {
        setIsCapturingGps(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg(
            'لم يتم السماح بالوصول لموقعك. يرجى تفعيل إذن الموقع أو سيتم استخدام إحداثيات المركز التقريبية.'
          );
        } else {
          setErrorMsg('تعذر التقاط إحداثيات GPS حالياً. حاول مرة أخرى.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsCompressingImage(true);
    try {
      const compressed = await compressImageToWebP(file, 800, 0.75, 70);
      setImageBase64(compressed.base64);
      setImageSizeKb(compressed.sizeKb);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر ضغط الصورة المختارة.'
      );
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleEditImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsCompressingImage(true);
    try {
      const compressed = await compressImageToWebP(file, 800, 0.75, 70);
      setEditImageBase64(compressed.base64);
      setEditImageSizeKb(compressed.sizeKb);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر ضغط الصورة المختارة.'
      );
    } finally {
      setIsCompressingImage(false);
    }
  };

  const buildValidatedDraft = (): PendingDraft | null => {
    const trimmedName = shopName.trim();
    const trimmedPhone = shopPhone.trim();
    const effectiveWhatsapp = (sameWhatsapp ? trimmedPhone : shopWhatsapp).trim();
    const finalVillage =
      shopVillage === '__manual__' ? manualVillage.trim() : shopVillage.trim();

    if (!trimmedName) {
      setErrorMsg('يرجى إدخال اسم المحل.');
      return null;
    }

    if (!finalVillage) {
      setErrorMsg('يرجى اختيار القرية / الحي أو كتابتها يدوياً.');
      return null;
    }

    if (!EGYPT_MOBILE_REGEX.test(trimmedPhone)) {
      setErrorMsg(
        'رقم الهاتف المصري غير صحيح: يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.'
      );
      return null;
    }

    if (!EGYPT_MOBILE_REGEX.test(effectiveWhatsapp)) {
      setErrorMsg(
        'رقم الواتساب غير صحيح: يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.'
      );
      return null;
    }

    const catLabel =
      categoryChoices.find((c) => c.id === shopCategory)?.label ?? 'خدمات';

    const fallbackCoords =
      CENTER_DEFAULT_COORDS[shopCenter] ??
      GOVERNORATE_DEFAULT_COORDS[shopGov] ?? { lat: 29.2369, lng: 30.7885 };

    const coords = capturedCoords ?? fallbackCoords;
    const addressText = shopAddress.trim()
      ? `${finalVillage}، ${shopAddress.trim()}`
      : `${finalVillage}، ${shopCenter}، ${shopGov}`;

    return {
      name: trimmedName,
      category: shopCategory,
      categoryLabel: catLabel,
      governorate: shopGov,
      center: shopCenter,
      village: finalVillage,
      address: addressText,
      phone: trimmedPhone,
      whatsapp: normalizeWhatsApp(effectiveWhatsapp),
      lat: coords.lat,
      lng: coords.lng,
      imageBase64,
      hoursNote: shopHoursNote.trim() || 'متاح لخدمتكم',
    };
  };

  const persistShopToFirestore = async (
    user: FirebaseUserLite,
    draft: PendingDraft
  ) => {
    const payload: NewShopFirestorePayload = {
      ownerId: user.uid,
      ownerEmail: user.email ?? regEmail.trim(),
      ...draft,
    };
    await createPendingShopInFirestore(payload);
    onVillageDiscovered(draft.governorate, draft.center, draft.village);
    clearDraftLocally(user.uid);
    setPendingDraft(null);
    setSubmissionSuccess(true);
    setShowAddFormWhileLoggedIn(false);
  };

  const handleRegisterAndVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!currentUser) {
      if (!regEmail.trim() || !regEmail.includes('@')) {
        setErrorMsg('يرجى إدخال بريد إلكتروني صحيح.');
        return;
      }
      if (regPassword.length < 6) {
        setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل.');
        return;
      }
    }

    const draft = buildValidatedDraft();
    if (!draft) return;

    setIsSubmittingReg(true);
    try {
      if (currentUser && currentUser.emailVerified) {
        await persistShopToFirestore(currentUser, draft);
        return;
      }

      const createdUser = await registerOwnerAndSendVerification(
        regEmail.trim(),
        regPassword
      );
      setPendingDraft(draft);
      saveDraftLocally(createdUser.uid, draft);
      setResendCooldown(30);
      setInfoMsg(
        `تم إنشاء الحساب وإرسال رابط التفعيل إلى ${createdUser.email ?? regEmail}.`
      );
    } catch (err: unknown) {
      setErrorMsg(mapFirebaseAuthErrorToArabic(err));
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleCheckEmailVerified = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsCheckingVerify(true);

    try {
      const refreshedUser = await reloadCurrentOwnerUser();
      if (!refreshedUser) {
        setErrorMsg('انتهت جلسة التسجيل. يرجى تسجيل الدخول مرة أخرى.');
        return;
      }

      if (!refreshedUser.emailVerified) {
        setErrorMsg(
          'لم يتم تأكيد البريد الإلكتروني بعد. يرجى فتح بريدك (أو مجلد الرسائل غير المرغوب فيها Spam) والضغط على رابط التأكيد، ثم الضغط هنا مجدداً.'
        );
        return;
      }

      const draftToSave = pendingDraft ?? loadDraftLocally(refreshedUser.uid);
      if (draftToSave) {
        await persistShopToFirestore(refreshedUser, draftToSave);
      } else {
        setInfoMsg('تم تأكيد بريدك الإلكتروني بنجاح!');
      }
    } catch (err: unknown) {
      setErrorMsg(mapFirebaseAuthErrorToArabic(err));
    } finally {
      setIsCheckingVerify(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setIsResendingEmail(true);
    try {
      await resendOwnerVerificationEmail();
      setResendCooldown(30);
      setInfoMsg('تمت إعادة إرسال رابط التأكيد إلى بريدك الإلكتروني.');
    } catch (err: unknown) {
      setErrorMsg(mapFirebaseAuthErrorToArabic(err));
    } finally {
      setIsResendingEmail(false);
    }
  };

  const isLoginLocked = Boolean(lockedUntilMs && lockedUntilMs > Date.now());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (lockedUntilMs && lockedUntilMs > Date.now()) {
      return;
    }

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const user = await loginOwnerWithEmail(loginEmail.trim(), loginPassword);
      clearLoginGuard();
      setFailedLoginAttempts(0);
      setLockedUntilMs(null);
      setLockoutRemainingSeconds(0);
      setShowUnlockCodeForm(false);
      setUnlockCodeInput('');
      setUnlockCodeError(null);
      if (!user.emailVerified) {
        setInfoMsg(
          'تم تسجيل الدخول، ولكن يجب تأكيد بريدك الإلكتروني أولاً قبل المتابعة.'
        );
      }
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      const nextAttempts =
        code === 'auth/too-many-requests'
          ? MAX_LOGIN_ATTEMPTS
          : failedLoginAttempts + 1;

      if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_DURATION_MS;
        writeLoginGuard({ failedAttempts: nextAttempts, lockedUntil: until });
        setFailedLoginAttempts(nextAttempts);
        setLockedUntilMs(until);
        setLockoutRemainingSeconds(Math.ceil(LOCKOUT_DURATION_MS / 1000));
        setErrorMsg(null);
      } else {
        writeLoginGuard({ failedAttempts: nextAttempts, lockedUntil: null });
        setFailedLoginAttempts(nextAttempts);
        const remaining = MAX_LOGIN_ATTEMPTS - nextAttempts;
        const baseMsg = mapFirebaseAuthErrorToArabic(err);
        setErrorMsg(
          remaining <= 3
            ? `${baseMsg} (تبقى ${remaining} محاولات قبل الحظر المؤقت لمدة 15 دقيقة).`
            : baseMsg
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifyUnlockCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockCodeError(null);
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmed = unlockCodeInput.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setUnlockCodeError('هذا الكود غير صالح أو تم استخدامه مسبقاً');
      return;
    }

    setIsVerifyingUnlockCode(true);
    try {
      const unlocked = await verifyAndBurnUnlockCodeInFirestore(trimmed);
      if (unlocked) {
        clearLoginGuard();
        setFailedLoginAttempts(0);
        setLockedUntilMs(null);
        setLockoutRemainingSeconds(0);
        setShowUnlockCodeForm(false);
        setUnlockCodeInput('');
        setUnlockCodeError(null);
        setErrorMsg(null);
        setInfoMsg(
          'تم التحقق من الكود وفك الحظر بنجاح! يمكنك تسجيل الدخول الآن.'
        );
      } else {
        setUnlockCodeError('هذا الكود غير صالح أو تم استخدامه مسبقاً');
      }
    } catch {
      setUnlockCodeError('هذا الكود غير صالح أو تم استخدامه مسبقاً');
    } finally {
      setIsVerifyingUnlockCode(false);
    }
  };

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmed = forgotEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }

    setIsSendingPasswordReset(true);
    try {
      await sendOwnerPasswordResetEmail(trimmed);
      setForgotPasswordCooldown(60);
      setInfoMsg(
        'تم إرسال رابط تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح (يرجى مراجعة صندوق الوارد أو الرسائل غير المرغوب فيها Spam).'
      );
    } catch (err: unknown) {
      setErrorMsg(mapFirebaseAuthErrorToArabic(err));
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  const handleLogout = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmissionSuccess(false);
    setPendingDraft(null);
    setShowAddFormWhileLoggedIn(false);
    setEditingShop(null);
    await logoutOwner();
  };

  const handleSetOwnerShopMode = async (
    shop: Shop,
    mode: 'open' | 'prayer' | 'closed'
  ) => {
    if (shop.status !== 'approved' && shop.status !== 'prayer') return;
    setTogglingShopId(shop.id);
    setErrorMsg(null);
    setInfoMsg(null);
    const nextOpen = mode === 'open';
    const nextStatus: 'approved' | 'prayer' =
      mode === 'prayer' ? 'prayer' : 'approved';
    try {
      await updateOwnerShopOpenStatus(shop.id, nextOpen, nextStatus);
      setOwnerShops((prev) =>
        prev.map((s) =>
          s.id === shop.id
            ? { ...s, isOpen: nextOpen, status: nextStatus, lastUpdated: 'الآن' }
            : s
        )
      );
      onShopUpdated();
      const modeLabel =
        mode === 'prayer'
          ? 'مغلق للصلاة 🕌'
          : mode === 'open'
            ? 'مفتوح الآن 🟢'
            : 'مغلق حالياً 🔴';
      setInfoMsg(`تم تحديث حالة "${shop.name}" إلى ${modeLabel}.`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر تحديث حالة المحل في قاعدة البيانات.'
      );
    } finally {
      setTogglingShopId(null);
    }
  };

  const startEditingShop = (shop: Shop) => {
    if (shop.status !== 'approved' && shop.status !== 'prayer') return;
    setEditingShop(shop);
    setEditName(shop.name);
    setEditAddress(shop.address);
    setEditPhone(shop.phone);
    setEditWhatsapp(stripWhatsAppPrefix(shop.whatsapp));
    setEditHoursNote(shop.hoursNote);
    setEditImageBase64(undefined);
    setEditImageSizeKb(null);
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleSaveShopEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingShop ||
      (editingShop.status !== 'approved' && editingShop.status !== 'prayer')
    )
      return;

    setErrorMsg(null);
    if (!editName.trim() || !editAddress.trim()) {
      setErrorMsg('يرجى إدخال اسم المحل والعنوان.');
      return;
    }
    if (!EGYPT_MOBILE_REGEX.test(editPhone.trim())) {
      setErrorMsg(
        'رقم الهاتف المصري غير صحيح: يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.'
      );
      return;
    }
    if (!EGYPT_MOBILE_REGEX.test(editWhatsapp.trim())) {
      setErrorMsg(
        'رقم الواتساب غير صحيح: يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.'
      );
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateOwnerShopDetails(editingShop.id, {
        name: editName.trim(),
        address: editAddress.trim(),
        phone: editPhone.trim(),
        whatsapp: normalizeWhatsApp(editWhatsapp.trim()),
        hoursNote: editHoursNote.trim() || 'متاح لخدمتكم',
        imageBase64: editImageBase64,
      });
      if (currentUser) {
        await reloadOwnerShopsList(currentUser.uid);
      }
      onShopUpdated();
      setInfoMsg(`تم حفظ تعديلات "${editName.trim()}" بنجاح.`);
      setEditingShop(null);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر حفظ التعديلات حالياً.'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEnableDeviceNotifications = async (shop: Shop) => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsEnablingNotifShopId(shop.id);
    playVisitNotificationSound();

    try {
      const res = await enableOneSignalForProOwner(shop.id);
      setNotifPermission(res.permission);

      if (res.oneSignalLinked) {
        setLinkedOneSignalShopIds((prev) => ({ ...prev, [shop.id]: true }));
      }

      if (res.granted) {
        await showSystemPushNotification(
          `تم تفعيل إشعارات الهاتف الفورية 🔔 (${shop.name})`,
          'تم ربط جهازك بمحلك بنجاح وستصلك إشعارات OneSignal الفورية والتنبيه الصوتي عند قدوم أي عميل.',
          `min-fateh-test-${shop.id}`
        );
        setInfoMsg(
          res.oneSignalLinked
            ? `تم تفعيل إشعارات الهاتف الفورية وربط جهازك بمعرف المحل (${shop.name}) عبر OneSignal بنجاح!`
            : 'تم تفعيل إشعارات المتصفح والتنبيه الصوتي بنجاح! ستصلك التنبيهات فور وصول أي عميل.'
        );
      } else if (res.permission === 'denied') {
        setErrorMsg(
          'تم حظر الإشعارات من إعدادات المتصفح. يمكنك السماح بالإشعارات للموقع من علامة القفل بجانب الرابط.'
        );
      } else if (res.permission === 'unsupported') {
        setInfoMsg(
          'تم تشغيل التنبيه الصوتي بنجاح! (المتصفح الحالي لا يدعم إشعارات النظام المنبثقة).'
        );
      }
    } catch (err) {
      console.warn('Notification permission request failed:', err);
      setErrorMsg('تعذر تفعيل الإشعارات حالياً. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsEnablingNotifShopId(null);
    }
  };

  const handleMarkVisitHandled = async (visitId: string) => {
    setHandlingVisitId(visitId);
    setErrorMsg(null);
    try {
      await markIncomingVisitHandledInFirestore(visitId);
      setInfoMsg('تم تأكيد استقبال العميل وإخفاء التنبيه.');
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تحديث حالة التنبيه حالياً.'
      );
    } finally {
      setHandlingVisitId(null);
    }
  };

  const handleOfferImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsCompressingOfferImg(true);
    try {
      // Compress offer photo: max 500px width, WebP under 45KB
      const compressed = await compressImageToWebP(file, 500, 0.72, 44);
      setOfferImageBase64(compressed.base64);
      setOfferImageSizeKb(compressed.sizeKb);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر ضغط صورة المنتج.'
      );
    } finally {
      setIsCompressingOfferImg(false);
    }
  };

  const handleAddOffer = async (e: React.FormEvent, shop: Shop) => {
    e.preventDefault();
    const existingOffers = shop.offers ?? [];
    if (existingOffers.length >= 4) {
      setErrorMsg('الحد الأقصى للعروض هو 4 عروض. احذف عرضاً لإضافة جديد.');
      return;
    }

    const trimmedTitle = offerTitle.trim();
    const afterVal = Number(offerPriceAfter);
    const beforeVal = offerPriceBefore.trim()
      ? Number(offerPriceBefore)
      : undefined;

    if (!trimmedTitle) {
      setErrorMsg('يرجى إدخال اسم المنتج أو العرض.');
      return;
    }
    if (!Number.isFinite(afterVal) || afterVal <= 0) {
      setErrorMsg('يرجى إدخال سعر العرض بعد الخصم بشكل صحيح.');
      return;
    }

    const newOffer: ShopOffer = {
      id: `offer-${Date.now()}`,
      title: trimmedTitle,
      priceAfter: afterVal,
      priceBefore:
        typeof beforeVal === 'number' && !Number.isNaN(beforeVal) && beforeVal > 0
          ? beforeVal
          : undefined,
      discountNote: offerDiscountNote.trim() || undefined,
      imageUrl: offerImageBase64 || undefined,
      createdAt: new Date().toISOString(),
    };

    const nextOffers = [...existingOffers, newOffer];
    setIsSavingOffers(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await updateOwnerShopOffersInFirestore(shop.id, nextOffers);
      setOwnerShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, offers: nextOffers } : s))
      );
      onShopUpdated();
      setOfferTitle('');
      setOfferPriceAfter('');
      setOfferPriceBefore('');
      setOfferDiscountNote('');
      setOfferImageBase64('');
      setOfferImageSizeKb(null);
      setOfferFormShopId(null);
      setInfoMsg(`تم إضافة العرض "${trimmedTitle}" بنجاح.`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر حفظ العرض في قاعدة البيانات.'
      );
    } finally {
      setIsSavingOffers(false);
    }
  };

  const handleDeleteOffer = async (shop: Shop, offerId: string) => {
    const nextOffers = (shop.offers ?? []).filter((o) => o.id !== offerId);
    setIsSavingOffers(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await updateOwnerShopOffersInFirestore(shop.id, nextOffers);
      setOwnerShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, offers: nextOffers } : s))
      );
      onShopUpdated();
      setInfoMsg('تم حذف العرض بنجاح.');
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر حذف العرض حالياً.'
      );
    } finally {
      setIsSavingOffers(false);
    }
  };

  const renderRegistrationForm = (forAuthenticatedOwner: boolean) => (
    <form onSubmit={handleRegisterAndVerify} className="space-y-3.5">
      {!forAuthenticatedOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
          <div>
            <label
              htmlFor="reg-email"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              البريد الإلكتروني
            </label>
            <input
              id="reg-email"
              type="email"
              dir="ltr"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="owner@example.com"
              className="w-full min-h-[44px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div>
            <label
              htmlFor="reg-password"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              كلمة المرور
            </label>
            <input
              id="reg-password"
              type="password"
              dir="ltr"
              minLength={6}
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="6 أحرف على الأقل"
              className="w-full min-h-[44px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="shop-name-input"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            اسم المحل / النشاط
          </label>
          <input
            id="shop-name-input"
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="مثال: صيدلية الشفاء"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label
            htmlFor="shop-cat-select"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            التخصص
          </label>
          <select
            id="shop-cat-select"
            value={shopCategory}
            onChange={(e) =>
              setShopCategory(e.target.value as Exclude<ShopCategory, 'all'>)
            }
            className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {categoryChoices.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.emoji} {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label
            htmlFor="reg-gov"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            المحافظة
          </label>
          <select
            id="reg-gov"
            value={shopGov}
            onChange={(e) => handleGovChange(e.target.value as GovernorateName)}
            className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="reg-center"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            المركز / المدينة
          </label>
          <select
            id="reg-center"
            value={shopCenter}
            onChange={(e) => handleCenterChange(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {centerChoices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="reg-village"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            القرية / الحي
          </label>
          <select
            id="reg-village"
            value={shopVillage}
            onChange={(e) => setShopVillage(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {villageChoices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
            <option value="__manual__">+ كتابة اسم قرية يدوياً</option>
          </select>
        </div>
      </div>

      {shopVillage === '__manual__' && (
        <div>
          <label
            htmlFor="manual-village"
            className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1"
          >
            اكتب اسم القرية أو الحي (سيُضاف تلقائياً للقائمة)
          </label>
          <input
            id="manual-village"
            type="text"
            value={manualVillage}
            onChange={(e) => setManualVillage(e.target.value)}
            placeholder="مثال: عزبة عاشور"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-emerald-400 dark:border-emerald-500/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>
      )}

      <div>
        <label
          htmlFor="shop-address-input"
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
        >
          الشارع وأقرب علامة مميزة
        </label>
        <input
          id="shop-address-input"
          type="text"
          value={shopAddress}
          onChange={(e) => setShopAddress(e.target.value)}
          placeholder="مثال: شارع البحر بجوار المسجد الكبير"
          className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="shop-phone-input"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            رقم الهاتف المصري (11 رقماً)
          </label>
          <input
            id="shop-phone-input"
            type="tel"
            dir="ltr"
            maxLength={11}
            value={shopPhone}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setShopPhone(val);
              if (sameWhatsapp) setShopWhatsapp(val);
            }}
            placeholder="01012345678"
            className={`w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 ${
              shopPhone.length > 0 && !EGYPT_MOBILE_REGEX.test(shopPhone)
                ? 'border-rose-400 focus:ring-rose-500'
                : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500'
            }`}
            required
          />
          {shopPhone.length > 0 && !EGYPT_MOBILE_REGEX.test(shopPhone) && (
            <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقماً
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="shop-wa-input"
              className="text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              رقم الواتساب
            </label>
            <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer">
              <input
                type="checkbox"
                checked={sameWhatsapp}
                onChange={(e) => {
                  setSameWhatsapp(e.target.checked);
                  if (e.target.checked) setShopWhatsapp(shopPhone);
                }}
                className="accent-emerald-600"
              />
              <span>نفس الهاتف</span>
            </label>
          </div>
          <input
            id="shop-wa-input"
            type="tel"
            dir="ltr"
            maxLength={11}
            disabled={sameWhatsapp}
            value={sameWhatsapp ? shopPhone : shopWhatsapp}
            onChange={(e) =>
              setShopWhatsapp(e.target.value.replace(/\D/g, ''))
            }
            placeholder="01012345678"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            required
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="shop-hours-input"
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
        >
          مواعيد العمل
        </label>
        <input
          id="shop-hours-input"
          type="text"
          value={shopHoursNote}
          onChange={(e) => setShopHoursNote(e.target.value)}
          placeholder="مثال: خدمة طوارئ 24 ساعة"
          className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>إحداثيات موقع المحل على الخريطة</span>
          </div>
          <button
            type="button"
            onClick={handleCaptureShopGps}
            disabled={isCapturingGps}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white dark:text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isCapturingGps ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Crosshair className="w-3.5 h-3.5" />
            )}
            <span>
              {isCapturingGps
                ? 'جاري التقاط الموقع...'
                : 'تحديد موقع المحل الحالي (GPS)'}
            </span>
          </button>
        </div>

        {capturedCoords ? (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            تم التقاط الإحداثيات بنجاح: ({capturedCoords.lat}, {capturedCoords.lng})
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            اضغط الزر وأنت داخل المحل لحفظ موقعه بدقة للعملاء على الخريطة.
          </p>
        )}
      </div>

      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="shop-photo-upload"
            className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"
          >
            <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>صورة واجهة المحل (تُضغط تلقائياً WebP &lt; 70KB)</span>
          </label>
          {imageBase64 && (
            <button
              type="button"
              onClick={() => {
                setImageBase64('');
                setImageSizeKb(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف</span>
            </button>
          )}
        </div>

        <input
          id="shop-photo-upload"
          type="file"
          accept="image/*"
          onChange={(e) => void handleImageSelect(e)}
          className="block w-full text-xs text-slate-600 dark:text-slate-300 file:ml-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 dark:file:bg-emerald-500 dark:file:text-slate-950 cursor-pointer"
        />

        {isCompressingImage && (
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>جاري تصغير وضغط الصورة إلى WebP...</span>
          </p>
        )}

        {imageBase64 && (
          <div className="space-y-1.5">
            <img
              src={imageBase64}
              alt="معاينة واجهة المحل"
              className="w-full h-36 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
            />
            {imageSizeKb !== null && (
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                تم ضغط الصورة بنجاح بصيغة WebP — الحجم الجديد: {imageSizeKb} كيلوبايت
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmittingReg || isCompressingImage}
        className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
      >
        {isSubmittingReg && <Loader2 className="w-4 h-4 animate-spin" />}
        <span>
          {forAuthenticatedOwner
            ? isSubmittingReg
              ? 'جاري حفظ المحل...'
              : 'إرسال بيانات المحل للمراجعة'
            : isSubmittingReg
              ? 'جاري إنشاء الحساب وإرسال التفعيل...'
              : 'إنشاء الحساب وإرسال رابط تأكيد البريد'}
        </span>
      </button>
    </form>
  );

  const renderVerificationScreen = (user: FirebaseUserLite) => (
    <div className="space-y-4 py-2 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
        <MailCheck className="w-7 h-7" />
      </div>

      <div>
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
          يرجى تأكيد بريدك الإلكتروني
        </h3>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          أرسلنا رسالة تفعيل حقيقية إلى بريدك:{' '}
          <span className="font-bold text-slate-900 dark:text-white" dir="ltr">
            {user.email}
          </span>
          <br />
          افتح بريدك واضغط على رابط التأكيد قبل إرسال بيانات المحل.
        </p>
      </div>

      <div className="space-y-2.5 pt-2">
        <button
          type="button"
          onClick={() => void handleCheckEmailVerified()}
          disabled={isCheckingVerify}
          className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
        >
          {isCheckingVerify ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>
            {isCheckingVerify
              ? 'جاري التحقق وحفظ المحل...'
              : 'تحققت من بريدي الآن'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => void handleResendVerification()}
          disabled={isResendingEmail || resendCooldown > 0}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-60"
        >
          <RefreshCw
            className={`w-4 h-4 ${isResendingEmail ? 'animate-spin' : ''}`}
          />
          <span>
            {resendCooldown > 0
              ? `إعادة إرسال الرابط بعد (${resendCooldown} ث)`
              : 'إعادة إرسال الرابط'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>تسجيل الخروج أو استخدام بريد آخر</span>
        </button>
      </div>
    </div>
  );

  const renderSuccessScreen = () => (
    <div className="space-y-4 py-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
          تم استلام طلبك بنجاح
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
          تم استلام طلبك بنجاح، سيقوم فريق المراجعة بالتواصل معك لتفعيل المحل خلال ساعات.
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={() => setSubmissionSuccess(false)}
          className="flex-1 min-h-[44px] rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 transition-colors cursor-pointer"
        >
          الانتقال للوحة تحكم محلي
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 min-h-[44px] rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          العودة للدليل
        </button>
      </div>
    </div>
  );

  const renderEditShopForm = (shop: Shop) => (
    <form onSubmit={handleSaveShopEdit} className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
          تعديل بيانات: {shop.name}
        </h3>
        <button
          type="button"
          onClick={() => setEditingShop(null)}
          className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
        >
          إلغاء التعديل
        </button>
      </div>

      <div>
        <label
          htmlFor="edit-shop-name"
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
        >
          اسم المحل
        </label>
        <input
          id="edit-shop-name"
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
      </div>

      <div>
        <label
          htmlFor="edit-shop-address"
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
        >
          العنوان
        </label>
        <input
          id="edit-shop-address"
          type="text"
          value={editAddress}
          onChange={(e) => setEditAddress(e.target.value)}
          className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="edit-shop-phone"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            رقم الهاتف
          </label>
          <input
            id="edit-shop-phone"
            type="tel"
            dir="ltr"
            maxLength={11}
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>
        <div>
          <label
            htmlFor="edit-shop-wa"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            رقم الواتساب
          </label>
          <input
            id="edit-shop-wa"
            type="tel"
            dir="ltr"
            maxLength={11}
            value={editWhatsapp}
            onChange={(e) => setEditWhatsapp(e.target.value.replace(/\D/g, ''))}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="edit-shop-hours"
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
        >
          مواعيد العمل
        </label>
        <input
          id="edit-shop-hours"
          type="text"
          value={editHoursNote}
          onChange={(e) => setEditHoursNote(e.target.value)}
          className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
        <label
          htmlFor="edit-shop-photo"
          className="block text-xs font-bold text-slate-700 dark:text-slate-200"
        >
          تحديث صورة المحل (اختياري — WebP &lt; 70KB)
        </label>
        <input
          id="edit-shop-photo"
          type="file"
          accept="image/*"
          onChange={(e) => void handleEditImageSelect(e)}
          className="block w-full text-xs text-slate-600 dark:text-slate-300 file:ml-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
        />
        {(editImageBase64 || shop.imageUrl) && (
          <img
            src={editImageBase64 ?? shop.imageUrl}
            alt="معاينة صورة المحل"
            className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
          />
        )}
        {editImageSizeKb !== null && (
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            تم ضغط الصورة الجديدة: {editImageSizeKb} كيلوبايت (WebP)
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSavingEdit || isCompressingImage}
        className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
      >
        {isSavingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
        <span>{isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
      </button>
    </form>
  );

  const renderShopDashboardCard = (shop: Shop) => {
    const status = shop.status ?? 'pending';

    if (status === 'suspended') {
      const waSettlementText = encodeURIComponent(
        `السلام عليكم إدارة تطبيق مين فاتح دلوقتي؟، أرغب في تسوية المخالفة الخاصة بمحل "${shop.name}" (${shop.area}). سبب المخالفة: ${shop.suspensionReason || 'غير محدد'}.`
      );
      return (
        <div
          key={shop.id}
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/35 border-2 border-rose-400 dark:border-rose-500/60 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm sm:text-base font-extrabold text-rose-900 dark:text-rose-200">
                تم تجميد حساب المحل مؤقتاً لوجود مخالفة
              </h4>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                {shop.name} · {shop.area}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/90 border border-rose-200 dark:border-rose-500/30">
            <p className="text-xs font-bold text-rose-800 dark:text-rose-300 mb-1">
              سبب المخالفة المسجل:
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {shop.suspensionReason?.trim() ||
                'مخالفة دقة حالة المحل أو بيانات التواصل.'}
            </p>
          </div>

          <a
            href={`https://wa.me/${ADMIN_WHATSAPP}?text=${waSettlementText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>تواصل مع الإدارة عبر واتساب لتسوية المخالفة</span>
          </a>
        </div>
      );
    }

    if (status === 'pending') {
      return (
        <div
          key={shop.id}
          className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {shop.name}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {shop.categoryLabel} · {shop.area}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-200/80 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>قيد المراجعة</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 leading-relaxed">
            طلبك قيد المراجعة حالياً وسيظهر للجمهور فور اعتماده من الإدارة.
          </p>
        </div>
      );
    }

    // Case 3: Approved Shop
    const isToggling = togglingShopId === shop.id;
    const shopVisits = incomingVisits.filter((v) => v.shopId === shop.id);
    const shopOffers = shop.offers ?? [];
    const proUpgradeWaUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(
      `السلام عليكم إدارة تطبيق مين فاتح دلوقتي؟، أرغب في ترقية محلي "${shop.name}" (${shop.area}) إلى باقة PRO 👑.`
    )}`;

    return (
      <div
        key={shop.id}
        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                <span>معتمد ومُفعل</span>
              </span>
              {shop.isPro && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950">
                  <span>PRO 👑</span>
                </span>
              )}
              {shop.featured && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-400/90 text-slate-950">
                  مميز ⭐
                </span>
              )}
            </div>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
              {shop.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {shop.address}
            </p>
            {shop.lastUpdated && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">
                آخر تحديث: {shop.lastUpdated}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => startEditingShop(shop)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>تعديل البيانات</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400">
              تغيير حالة المحل الفورية:
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-extrabold ${
                shop.status === 'prayer'
                  ? 'bg-amber-950/90 text-amber-300 border border-amber-500/40'
                  : shop.isOpen
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                    : 'bg-rose-950 text-rose-300 border border-rose-700/50'
              }`}
            >
              {isToggling && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>
                {shop.status === 'prayer'
                  ? 'مغلق للصلاة 🕌'
                  : shop.isOpen
                    ? 'مفتوح الآن 🟢'
                    : 'مغلق 🔴'}
              </span>
            </span>
          </div>

          <div
            role="group"
            aria-label={`تغيير حالة ${shop.name}`}
            className="grid grid-cols-3 gap-2"
          >
            <button
              type="button"
              disabled={isToggling}
              aria-pressed={shop.status !== 'prayer' && shop.isOpen}
              onClick={() => void handleSetOwnerShopMode(shop, 'open')}
              className={`min-h-[48px] px-2.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-60 ${
                shop.status !== 'prayer' && shop.isOpen
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20 dark:bg-emerald-500 dark:text-slate-950'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              <span>مفتوح 🟢</span>
            </button>

            <button
              type="button"
              disabled={isToggling}
              aria-pressed={shop.status === 'prayer'}
              onClick={() => void handleSetOwnerShopMode(shop, 'prayer')}
              className={`min-h-[48px] px-2.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-60 ${
                shop.status === 'prayer'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-300/70 dark:border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-900/40'
              }`}
            >
              <span>مغلق للصلاة 🕌</span>
            </button>

            <button
              type="button"
              disabled={isToggling}
              aria-pressed={shop.status !== 'prayer' && !shop.isOpen}
              onClick={() => void handleSetOwnerShopMode(shop, 'closed')}
              className={`min-h-[48px] px-2.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-60 ${
                shop.status !== 'prayer' && !shop.isOpen
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-rose-500/50 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
            >
              <span>مغلق 🔴</span>
            </button>
          </div>
        </div>

        {/* PRO Features Section */}
        {!shop.isPro ? (
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300/70 dark:border-amber-500/35 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-400/25 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                  مميزات باقة PRO 👑 (العروض + إشعارات الزبائن القادمين عبر واتساب واللوحة)
                </h5>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  رقّي محلك الآن لعرض حتى 4 منتجات وعروض حصرية واستقبال إشعارات فورية بالعملاء القادمين في الطريق إليك.
                </p>
              </div>
            </div>

            <a
              href={proUpgradeWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-sm"
            >
              <Crown className="w-4 h-4 shrink-0" />
              <span>اطلب الترقية إلى PRO عبر واتساب الإدارة</span>
            </a>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {/* 1. Incoming Visits Live Alerts */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300/60 dark:border-amber-500/30 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                  <BellRing className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>زبائن في الطريق إليك الآن 🔔</span>
                </h5>
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 tabular-nums">
                  {shopVisits.length}
                </span>
              </div>

              <button
                type="button"
                disabled={isEnablingNotifShopId === shop.id}
                onClick={() => void handleEnableDeviceNotifications(shop)}
                className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold border transition-colors cursor-pointer disabled:opacity-60 ${
                  notifPermission === 'granted' && linkedOneSignalShopIds[shop.id]
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/30'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 shadow-sm'
                }`}
              >
                {isEnablingNotifShopId === shop.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>جاري ربط الإشعارات الفورية...</span>
                  </>
                ) : notifPermission === 'granted' &&
                  linkedOneSignalShopIds[shop.id] ? (
                  <>
                    <Volume2 className="w-4 h-4 shrink-0" />
                    <span>
                      إشعارات الهاتف الفورية مفعّلة 🔔 (اضغط لتجربة الرنة)
                    </span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 shrink-0" />
                    <span>تفعيل إشعارات الهاتف الفورية 🔔</span>
                  </>
                )}
              </button>

              {shopVisits.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  لا يوجد زبائن قادمون في هذه اللحظة — سيصلك تنبيه صوتي وإشعار نظام فوري عند ضغط أي عميل على &quot;أنا جايلك في الطريق&quot;.
                </p>
              ) : (
                <div className="space-y-2">
                  {shopVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                          <span>{visit.customerName}</span>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                            · {visit.createdAtLabel}
                          </span>
                        </div>
                        {visit.customerNote && (
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                            الطلب/الاستفسار: {visit.customerNote}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={handlingVisitId === visit.id}
                        onClick={() => void handleMarkVisitHandled(visit.id)}
                        className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                      >
                        {handlingVisitId === visit.id
                          ? 'جاري...'
                          : 'تم الاستقبال / إخفاء'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Offers & Products Manager (Up to 4 Offers) */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    إدارة العروض والمنتجات ({shopOffers.length} / 4)
                  </span>
                </h5>

                {shopOffers.length < 4 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOfferFormShopId((prev) =>
                        prev === shop.id ? null : shop.id
                      );
                      setErrorMsg(null);
                    }}
                    className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {offerFormShopId === shop.id
                        ? 'إلغاء'
                        : 'إضافة عرض جديد'}
                    </span>
                  </button>
                )}
              </div>

              {offerFormShopId === shop.id && (
                <form
                  onSubmit={(e) => void handleAddOffer(e, shop)}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-amber-300/60 dark:border-amber-500/30 space-y-2.5"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      اسم المنتج أو العرض
                    </label>
                    <input
                      type="text"
                      value={offerTitle}
                      onChange={(e) => setOfferTitle(e.target.value)}
                      placeholder="مثال: عرض تغيير زيت + فلتر هدية"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        السعر الحالي / بعد الخصم (جنيه)
                      </label>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        dir="ltr"
                        value={offerPriceAfter}
                        onChange={(e) => setOfferPriceAfter(e.target.value)}
                        placeholder="250"
                        className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        السعر قبل الخصم (اختياري)
                      </label>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        dir="ltr"
                        value={offerPriceBefore}
                        onChange={(e) => setOfferPriceBefore(e.target.value)}
                        placeholder="350"
                        className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نسبة الخصم أو وصف العرض (اختياري)
                    </label>
                    <input
                      type="text"
                      value={offerDiscountNote}
                      onChange={(e) => setOfferDiscountNote(e.target.value)}
                      placeholder="مثال: خصم 25% لعملاء التطبيق"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      صورة المنتج (تُضغط تلقائياً WebP ≤ 500px وأقل من 45KB)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleOfferImageSelect(e)}
                      className="block w-full text-xs text-slate-600 dark:text-slate-300 file:ml-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-400 file:text-slate-950 cursor-pointer"
                    />
                    {isCompressingOfferImg && (
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>جاري ضغط صورة العرض إلى WebP...</span>
                      </p>
                    )}
                    {offerImageBase64 && (
                      <div className="flex items-center gap-2.5 pt-1">
                        <img
                          src={offerImageBase64}
                          alt="معاينة صورة العرض"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                        />
                        {offerImageSizeKb !== null && (
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            WebP · {offerImageSizeKb} كيلوبايت
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingOffers || isCompressingOfferImg}
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isSavingOffers && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSavingOffers ? 'جاري النشر...' : 'حفظ ونشر العرض'}</span>
                  </button>
                </form>
              )}

              {shopOffers.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  لم تضف أي عروض بعد. أضف حتى 4 منتجات أو عروض حصرية لتظهر للجمهور على بطاقة محلك.
                </p>
              ) : (
                <div className="space-y-2">
                  {shopOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {offer.imageUrl ? (
                          <img
                            src={offer.imageUrl}
                            alt={offer.title}
                            className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <Tag className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {offer.title}
                          </p>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {offer.priceAfter.toLocaleString('ar-EG')} جنيه
                            {typeof offer.priceBefore === 'number' &&
                              offer.priceBefore > offer.priceAfter && (
                                <span className="mr-1.5 text-[11px] text-slate-400 line-through">
                                  {offer.priceBefore.toLocaleString('ar-EG')} جنيه
                                </span>
                              )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSavingOffers}
                        onClick={() => void handleDeleteOffer(shop, offer.id)}
                        aria-label={`حذف ${offer.title}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderVerifiedDashboard = (user: FirebaseUserLite) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            حساب صاحب المحل المفعّل
          </p>
          <p
            className="text-sm font-bold text-slate-900 dark:text-white truncate"
            dir="ltr"
          >
            {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>تسجيل خروج</span>
        </button>
      </div>

      {editingShop ? (
        renderEditShopForm(editingShop)
      ) : showAddFormWhileLoggedIn ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              تسجيل محل جديد تحت حسابك
            </h3>
            <button
              type="button"
              onClick={() => setShowAddFormWhileLoggedIn(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              رجوع للوحة تحكم محلي
            </button>
          </div>
          {renderRegistrationForm(true)}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              محلاتك المسجلة ({ownerShops.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowAddFormWhileLoggedIn(true)}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة محل</span>
            </button>
          </div>

          {isLoadingOwnerShops ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span>جاري تحميل محلاتك...</span>
            </div>
          ) : ownerShops.length > 0 ? (
            <div className="space-y-3">
              {ownerShops.map((shop) => renderShopDashboardCard(shop))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                لا توجد محلات مسجلة على حسابك بعد
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                أضف بيانات محلك ليظهر للعملاء في محافظتك بعد المراجعة.
              </p>
              <button
                type="button"
                onClick={() => setShowAddFormWhileLoggedIn(true)}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تسجيل محل جديد الآن</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-modal-title"
    >
      <div className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="owner-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                {currentUser ? 'لوحة تحكم محلي' : 'بوابة أصحاب المحلات والخدمات'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                سجّل محلك أو حدّث حالة الفتح والإغلاق بأمان
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!currentUser && !submissionSuccess && (
          <div className="flex gap-2 p-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              تسجيل دخول
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل محل جديد</span>
            </button>
          </div>
        )}

        <div className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {submissionSuccess ? (
            renderSuccessScreen()
          ) : currentUser ? (
            currentUser.emailVerified ? (
              renderVerifiedDashboard(currentUser)
            ) : (
              renderVerificationScreen(currentUser)
            )
          ) : activeTab === 'login' ? (
            isLoginLocked ? (
              <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-500/40 space-y-4">
                <div className="flex flex-col items-center text-center space-y-2.5">
                  <div className="w-14 h-14 rounded-2xl bg-rose-600/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-rose-900 dark:text-rose-200">
                    تم حظر تسجيل الدخول مؤقتاً لمدة 15 دقيقة
                  </h3>
                  <p className="text-xs sm:text-sm text-rose-800/90 dark:text-rose-200/85 leading-relaxed max-w-md">
                    تم استنفاد الحد الأقصى لمحاولات تسجيل الدخول الخاطئة لحماية حسابك. يرجى الانتظار حتى انتهاء المؤقت أو استخدام كود فك حظر من الإدارة.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-rose-200 dark:border-rose-500/40 text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>
                      الوقت المتبقي: {formatCountdownMMSS(lockoutRemainingSeconds)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnlockCodeForm((prev) => !prev);
                      setUnlockCodeError(null);
                    }}
                    className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shadow-sm"
                  >
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>إدخال كود فك الحظر من الإدارة 🔑</span>
                  </button>

                  {showUnlockCodeForm && (
                    <form
                      onSubmit={handleVerifyUnlockCode}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/70 dark:border-amber-500/35 space-y-3"
                    >
                      <div>
                        <label
                          htmlFor="unlock-code-input"
                          className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                        >
                          أدخل كود فك الحظر (6 أرقام — صالح لمرة واحدة فقط)
                        </label>
                        <input
                          id="unlock-code-input"
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          maxLength={6}
                          value={unlockCodeInput}
                          onChange={(e) => {
                            setUnlockCodeInput(
                              e.target.value.replace(/\D/g, '').slice(0, 6)
                            );
                            if (unlockCodeError) setUnlockCodeError(null);
                          }}
                          placeholder="000000"
                          className="w-full min-h-[46px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center text-lg font-black tracking-[0.35em] text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                          required
                        />
                      </div>

                      {unlockCodeError && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 p-2.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                        >
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{unlockCodeError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isVerifyingUnlockCode}
                        className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {isVerifyingUnlockCode && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        <span>
                          {isVerifyingUnlockCode
                            ? 'جاري التحقق...'
                            : 'تأكيد الكود وفك الحظر'}
                        </span>
                      </button>
                    </form>
                  )}

                  <a
                    href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(
                      'السلام عليكم إدارة تطبيق مين فاتح دلوقتي؟، تم حظر تسجيل الدخول مؤقتاً وأحتاج كود فك حظر لمرة واحدة.'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>طلب كود فك حظر من الإدارة عبر واتساب</span>
                  </a>
                </div>
              </div>
            ) : showForgotPassword ? (
              <form onSubmit={handleSendPasswordReset} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    استعادة كلمة المرور
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    العودة لتسجيل الدخول
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً آمناً عبر Firebase لتعيين كلمة مرور جديدة.
                </p>

                <div>
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    البريد الإلكتروني المسجل
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    dir="ltr"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="owner@example.com"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSendingPasswordReset || forgotPasswordCooldown > 0}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  {isSendingPasswordReset && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>
                    {forgotPasswordCooldown > 0
                      ? `إعادة إرسال الرابط بعد (${forgotPasswordCooldown} ث)`
                      : 'إرسال رابط تعيين كلمة مرور جديدة 📧'}
                  </span>
                </button>

                <a
                  href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(
                    'السلام عليكم إدارة تطبيق مين فاتح دلوقتي؟، أواجه مشكلة في استعادة كلمة المرور عبر البريد وأحتاج المساعدة.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>تعذر الوصول للبريد؟ تواصل مع الإدارة عبر واتساب</span>
                </a>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    البريد الإلكتروني
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    dir="ltr"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="owner@example.com"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-200"
                    >
                      كلمة المرور
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setErrorMsg(null);
                        setInfoMsg(null);
                        setForgotEmail(loginEmail);
                      }}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>نسيت كلمة المرور؟ 🔄</span>
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    dir="ltr"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isLoggingIn ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}</span>
                </button>

                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  ليس لديك حساب لمحلك؟{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setErrorMsg(null);
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    سجّل محلاً جديداً الآن
                  </button>
                </p>
              </form>
            )
          ) : (
            renderRegistrationForm(false)
          )}
        </div>
      </div>
    </div>
  );
}
