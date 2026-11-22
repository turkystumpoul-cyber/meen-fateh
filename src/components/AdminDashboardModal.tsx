import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  BarChart3,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  KeyRound,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Store,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { CATEGORY_OPTIONS } from '../data/shops';
import {
  FirebaseUserLite,
  approveShopInFirestore,
  createOneTimeUnlockCodeInFirestore,
  deleteShopInFirestore,
  fetchAllIncomingVisitsForAdmin,
  fetchAllShopsForAdmin,
  isAdminUser,
  suspendShopInFirestore,
  toggleShopFeaturedInFirestore,
  toggleShopProInFirestore,
  unsuspendShopInFirestore,
} from '../services/firebase';
import { IncomingVisit, Shop, ShopCategory } from '../types';
import {
  playVisitNotificationSound,
  showSystemPushNotification,
} from '../utils/notificationSound';
import {
  enableOneSignalForAdmin,
  syncOneSignalAdminIdentity,
} from '../utils/onesignal';
import { AdminAnalyticsDashboard } from './AdminAnalyticsDashboard';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUserLite | null;
  onDirectoryMutated: () => void;
}

type AdminTab = 'analytics' | 'pending' | 'approved' | 'suspended';

const PRESET_VIOLATION_REASONS = [
  'ترك حالة المحل مفتوح رغم إغلاقه في الواقع',
  'بيانات أو رقم هاتف غير صحيح أو لا يرد',
  'صور أو عنوان غير مطابق للنشاط الحقيقي',
];

export function AdminDashboardModal({
  isOpen,
  onClose,
  currentUser,
  onDirectoryMutated,
}: AdminDashboardModalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<ShopCategory>('all');
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [incomingVisits, setIncomingVisits] = useState<IncomingVisit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyShopId, setBusyShopId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // In-modal violation suspension dialog
  const [suspendTarget, setSuspendTarget] = useState<Shop | null>(null);
  const [selectedPresetReason, setSelectedPresetReason] = useState(
    PRESET_VIOLATION_REASONS[0]
  );
  const [customReason, setCustomReason] = useState('');
  const [useCustomReason, setUseCustomReason] = useState(false);

  // In-modal delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<Shop | null>(null);

  // Admin OneSignal push notifications state
  const [adminNotifPermission, setAdminNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [isEnablingAdminNotif, setIsEnablingAdminNotif] = useState(false);
  const [adminOneSignalLinked, setAdminOneSignalLinked] = useState(false);

  // One-Time Dynamic Unlock Code generator state
  const [generatedUnlockCode, setGeneratedUnlockCode] = useState<string | null>(
    null
  );
  const [isGeneratingUnlockCode, setIsGeneratingUnlockCode] = useState(false);
  const [unlockCodeCopied, setUnlockCodeCopied] = useState(false);

  const authorized = isAdminUser(currentUser);

  const loadAllShops = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [list, visits] = await Promise.all([
        fetchAllShopsForAdmin(),
        fetchAllIncomingVisitsForAdmin().catch(() => [] as IncomingVisit[]),
      ]);
      setAllShops(list);
      setIncomingVisits(visits);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر جلب بيانات المحلات من قاعدة البيانات.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && authorized) {
      void loadAllShops();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setAdminNotifPermission(Notification.permission);
        if (Notification.permission === 'granted') {
          void syncOneSignalAdminIdentity();
        }
      }
    }
  }, [isOpen, authorized]);

  const pendingShops = useMemo(
    () => allShops.filter((s) => (s.status ?? 'pending') === 'pending'),
    [allShops]
  );
  const approvedShops = useMemo(
    () =>
      allShops.filter(
        (s) => s.status === 'approved' || s.status === 'prayer'
      ),
    [allShops]
  );
  const suspendedShops = useMemo(
    () => allShops.filter((s) => s.status === 'suspended'),
    [allShops]
  );

  const stats = useMemo(
    () => ({
      total: allShops.length,
      openNow: approvedShops.filter((s) => s.isOpen).length,
      vip: approvedShops.filter((s) => s.featured).length,
      suspended: suspendedShops.length,
    }),
    [allShops, approvedShops, suspendedShops]
  );

  if (!isOpen || !authorized) return null;

  const baseTabShops =
    activeTab === 'pending'
      ? pendingShops
      : activeTab === 'approved'
        ? approvedShops
        : suspendedShops;

  const displayedShops =
    selectedCategoryFilter === 'all'
      ? baseTabShops
      : baseTabShops.filter((s) => s.category === selectedCategoryFilter);

  const handleApprove = async (shop: Shop) => {
    setBusyShopId(shop.id);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await approveShopInFirestore(shop.id);
      setAllShops((prev) =>
        prev.map((s) =>
          s.id === shop.id
            ? { ...s, status: 'approved', suspensionReason: '' }
            : s
        )
      );
      onDirectoryMutated();
      setInfoMsg(`تم قبول وتفعيل "${shop.name}" وإظهاره للجمهور.`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر اعتماد المحل حالياً.'
      );
    } finally {
      setBusyShopId(null);
    }
  };

  const handleToggleVip = async (shop: Shop) => {
    setBusyShopId(shop.id);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const nextVip = !shop.featured;
      await toggleShopFeaturedInFirestore(shop.id, nextVip);
      setAllShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, featured: nextVip } : s))
      );
      onDirectoryMutated();
      setInfoMsg(
        nextVip
          ? `تمت ترقية "${shop.name}" إلى محل مميز (VIP).`
          : `تم إلغاء تمييز "${shop.name}".`
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تحديث حالة التمييز.'
      );
    } finally {
      setBusyShopId(null);
    }
  };

  const handleTogglePro = async (shop: Shop) => {
    setBusyShopId(shop.id);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const nextPro = !shop.isPro;
      await toggleShopProInFirestore(shop.id, nextPro);
      setAllShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, isPro: nextPro } : s))
      );
      onDirectoryMutated();
      setInfoMsg(
        nextPro
          ? `تم تفعيل باقة PRO 👑 لمحل "${shop.name}" بنجاح.`
          : `تم إيقاف باقة PRO عن "${shop.name}".`
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تحديث باقة PRO حالياً.'
      );
    } finally {
      setBusyShopId(null);
    }
  };

  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    const finalReason = useCustomReason
      ? customReason.trim()
      : selectedPresetReason;

    if (!finalReason) {
      setErrorMsg('يرجى تحديد أو كتابة سبب المخالفة أولاً.');
      return;
    }

    setBusyShopId(suspendTarget.id);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await suspendShopInFirestore(suspendTarget.id, finalReason);
      setAllShops((prev) =>
        prev.map((s) =>
          s.id === suspendTarget.id
            ? {
                ...s,
                status: 'suspended',
                isOpen: false,
                suspensionReason: finalReason,
              }
            : s
        )
      );
      onDirectoryMutated();
      setInfoMsg(
        `تم تجميد "${suspendTarget.name}" وإخفاؤه من الدليل العام مع تسجيل سبب المخالفة.`
      );
      setSuspendTarget(null);
      setCustomReason('');
      setUseCustomReason(false);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تجميد المحل حالياً.'
      );
    } finally {
      setBusyShopId(null);
    }
  };

  const handleUnsuspend = async (shop: Shop) => {
    setBusyShopId(shop.id);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await unsuspendShopInFirestore(shop.id);
      setAllShops((prev) =>
        prev.map((s) =>
          s.id === shop.id
            ? { ...s, status: 'approved', suspensionReason: '' }
            : s
        )
      );
      onDirectoryMutated();
      setInfoMsg(`تم فك التجميد وإعادة تفعيل "${shop.name}" بنجاح.`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر فك التجميد حالياً.'
      );
    } finally {
      setBusyShopId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyShopId(deleteTarget.id);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await deleteShopInFirestore(deleteTarget.id);
      setAllShops((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      onDirectoryMutated();
      setInfoMsg(`تم حذف "${deleteTarget.name}" نهائياً من قاعدة البيانات.`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر حذف المحل حالياً.'
      );
    } finally {
      setBusyShopId(null);
    }
  };

  const handleEnableAdminNotifications = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsEnablingAdminNotif(true);
    playVisitNotificationSound();

    try {
      const res = await enableOneSignalForAdmin();
      setAdminNotifPermission(res.permission);
      if (res.oneSignalLinked) {
        setAdminOneSignalLinked(true);
      }

      if (res.granted) {
        await showSystemPushNotification(
          'تم تفعيل إشعارات الإدارة الفورية 🔔',
          'سيصلك إشعار فوري عند تسجيل أي محل جديد بانتظار المراجعة.',
          'min-fateh-admin-test'
        );
        setInfoMsg(
          res.oneSignalLinked
            ? 'تم تفعيل إشعارات الأدمن وربطها عبر OneSignal (وسم role: admin) بنجاح!'
            : 'تم تفعيل إشعارات المتصفح والتنبيه الصوتي للإدارة بنجاح!'
        );
      } else if (res.permission === 'denied') {
        setErrorMsg(
          'تم حظر الإشعارات من إعدادات المتصفح. يرجى السماح بالإشعارات للموقع من علامة القفل بجانب الرابط.'
        );
      } else if (res.permission === 'unsupported') {
        setInfoMsg(
          'تم تشغيل التنبيه الصوتي بنجاح! (المتصفح الحالي لا يدعم إشعارات النظام المنبثقة).'
        );
      }
    } catch (err) {
      console.warn('Admin notification permission failed:', err);
      setErrorMsg('تعذر تفعيل إشعارات الأدمن حالياً.');
    } finally {
      setIsEnablingAdminNotif(false);
    }
  };

  const handleGenerateUnlockCode = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setUnlockCodeCopied(false);
    setIsGeneratingUnlockCode(true);
    try {
      const code = await createOneTimeUnlockCodeInFirestore();
      setGeneratedUnlockCode(code);
      setInfoMsg(
        'تم إنشاء كود فك حظر جديد (صالح لمرة واحدة فقط) وحفظه في قاعدة البيانات.'
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر توليد كود فك الحظر حالياً. حاول مرة أخرى.'
      );
    } finally {
      setIsGeneratingUnlockCode(false);
    }
  };

  const handleCopyUnlockCode = async () => {
    if (!generatedUnlockCode) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(generatedUnlockCode);
      } else {
        const el = document.createElement('textarea');
        el.value = generatedUnlockCode;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setUnlockCodeCopied(true);
      window.setTimeout(() => setUnlockCodeCopied(false), 2500);
    } catch {
      setErrorMsg('تعذر نسخ الكود تلقائياً، يمكنك نسخه يدوياً.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="w-full sm:max-w-5xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* 1. Founder Executive Banner */}
        <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="relative bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-950 border border-amber-400/50 rounded-2xl p-4 sm:p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 text-xs font-extrabold">
                  <span aria-hidden="true" className="text-sm leading-none">
                    👑
                  </span>
                  <span>المؤسس والمطور التنفيذي | Founder &amp; Developer</span>
                </div>

                <p
                  dir="ltr"
                  className="text-base sm:text-xl tracking-wide leading-snug founder-gold-name text-right break-words"
                >
                  AHMED ABDELTAWAB ABDELRAZEK HASSAN
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span
                    id="admin-modal-title"
                    className="inline-flex items-center gap-1.5 font-bold text-slate-200"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>غرفة القيادة التنفيذية · لوحة الإدارة الحصرية</span>
                  </span>
                  <span dir="ltr" className="text-slate-400">
                    {currentUser?.email}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void loadAllShops()}
                  disabled={isLoading}
                  title="تحديث القائمة"
                  aria-label="تحديث القائمة"
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="إغلاق لوحة الإدارة"
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-200 bg-slate-900/90 hover:bg-rose-950 hover:text-rose-200 border border-slate-700/80 hover:border-rose-500/40 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Executive Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* 2. KPI Stat Cards (grid-cols-2 gap-3) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-slate-200">
                  إجمالي المحلات
                </p>
                <div className="w-8 h-8 rounded-xl bg-slate-700/70 text-slate-200 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white text-center tabular-nums mt-3 leading-none">
                {stats.total.toLocaleString('ar-EG')}
              </p>
            </div>

            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-emerald-300">
                  المفتوحة الآن
                </p>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-emerald-400 text-center tabular-nums mt-3 leading-none">
                {stats.openNow.toLocaleString('ar-EG')}
              </p>
            </div>

            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-amber-300">
                  المميزة (VIP)
                </p>
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-amber-400 text-center tabular-nums mt-3 leading-none">
                {stats.vip.toLocaleString('ar-EG')}
              </p>
            </div>

            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-rose-300">
                  المجمدة لمخالفة
                </p>
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-rose-400 text-center tabular-nums mt-3 leading-none">
                {stats.suspended.toLocaleString('ar-EG')}
              </p>
            </div>
          </div>

          {/* 3a. Admin Push Notifications Banner (Royal Gold Gradient) */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-l from-slate-900 via-amber-950/25 to-slate-900 border border-amber-400/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-200 leading-relaxed">
              احصل على إشعار فوري على هاتفك عند تسجيل أي محل جديد بانتظار المراجعة.
            </p>
            <button
              type="button"
              disabled={isEnablingAdminNotif}
              onClick={() => void handleEnableAdminNotifications()}
              className={`h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 disabled:opacity-60 ${
                adminNotifPermission === 'granted' && adminOneSignalLinked
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'bg-gradient-to-l from-amber-300 via-amber-400 to-yellow-500 hover:brightness-105 text-slate-950 shadow-md shadow-amber-500/25'
              }`}
            >
              {isEnablingAdminNotif ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>جاري التفعيل...</span>
                </>
              ) : adminNotifPermission === 'granted' && adminOneSignalLinked ? (
                <>
                  <BellRing className="w-4 h-4 shrink-0" />
                  <span>إشعارات الأدمن مفعّلة 🔔 (تجربة)</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 shrink-0" />
                  <span>تفعيل إشعارات الأدمن الفورية 🔔</span>
                </>
              )}
            </button>
          </div>

          {/* 3b. One-Time Dynamic Unlock Code Generator Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-extrabold text-white">
                  توليد كود فك حظر لمرة واحدة 🎲
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  أنشئ كوداً مؤقتاً من 6 أرقام لفك الحظر المؤقت عن صاحب محل، ويُحرق تلقائياً فور استخدامه.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {generatedUnlockCode && (
                <div className="inline-flex items-center gap-2 px-3 h-10 rounded-xl bg-slate-950 border border-amber-400/50">
                  <span
                    dir="ltr"
                    className="text-base font-black tracking-[0.22em] text-amber-300 tabular-nums select-all"
                  >
                    {generatedUnlockCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyUnlockCode()}
                    aria-label="نسخ كود فك الحظر"
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      unlockCodeCopied
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {unlockCodeCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <button
                type="button"
                disabled={isGeneratingUnlockCode}
                onClick={() => void handleGenerateUnlockCode()}
                className="h-10 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl text-xs font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shrink-0 disabled:opacity-60 shadow-sm"
              >
                {isGeneratingUnlockCode ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الإنشاء...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>إنشاء كود جديد</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3c. Sleek Equal-Height Tab Bar */}
          <div
            role="tablist"
            className="rounded-xl p-1 bg-slate-950/70 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'analytics'}
              onClick={() => setActiveTab('analytics')}
              className={`h-11 px-3 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-l from-amber-300 via-amber-400 to-yellow-400 text-slate-950 shadow-sm font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>لوحة البيانات</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'pending'}
              onClick={() => setActiveTab('pending')}
              className={`h-11 px-3 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-400 text-slate-950 shadow-sm font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>طلبات المراجعة</span>
              <span className="px-1.5 py-0.5 rounded-md text-[11px] bg-black/15 tabular-nums">
                {pendingShops.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'approved'}
              onClick={() => setActiveTab('approved')}
              className={`h-11 px-3 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'approved'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>المحلات والبرو</span>
              <span className="px-1.5 py-0.5 rounded-md text-[11px] bg-black/15 tabular-nums">
                {approvedShops.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'suspended'}
              onClick={() => setActiveTab('suspended')}
              className={`h-11 px-3 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'suspended'
                  ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Ban className="w-4 h-4 shrink-0" />
              <span>المجمدة</span>
              <span className="px-1.5 py-0.5 rounded-md text-[11px] bg-black/20 tabular-nums">
                {suspendedShops.length}
              </span>
            </button>
          </div>

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

          {activeTab !== 'analytics' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <label
                htmlFor="admin-category-filter"
                className="text-xs font-bold text-slate-600 dark:text-slate-400"
              >
                تصفية حسب التخصص:
              </label>
              <select
                id="admin-category-filter"
                value={selectedCategoryFilter}
                onChange={(e) =>
                  setSelectedCategoryFilter(e.target.value as ShopCategory)
                }
                className="min-h-[38px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'analytics' ? (
            <AdminAnalyticsDashboard
              shops={allShops}
              incomingVisits={incomingVisits}
              isLoading={isLoading}
            />
          ) : isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <span>جاري تحميل كافة المحلات من قاعدة البيانات...</span>
            </div>
          ) : displayedShops.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <Store className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                لا توجد محلات في هذا القسم حالياً
              </p>
            </div>
          ) : (
            displayedShops.map((shop) => {
              const isBusy = busyShopId === shop.id;
              return (
                <div
                  key={shop.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between"
                >
                  <div className="flex gap-3.5 min-w-0 flex-1">
                    {shop.imageUrl ? (
                      <img
                        src={shop.imageUrl}
                        alt={shop.name}
                        className="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-800"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                        <Store className="w-7 h-7" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          {shop.name}
                        </h3>
                        {shop.isPro && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950 border border-amber-200">
                            PRO 👑
                          </span>
                        )}
                        {shop.featured && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-400 text-slate-950">
                            مميز ⭐
                          </span>
                        )}
                        {(shop.status === 'approved' ||
                          shop.status === 'prayer') && (
                          <span
                            className={`text-xs font-bold ${
                              shop.status === 'prayer'
                                ? 'text-amber-600 dark:text-amber-400'
                                : shop.isOpen
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            ·{' '}
                            {shop.status === 'prayer'
                              ? 'مغلق للصلاة 🕌'
                              : shop.isOpen
                                ? 'مفتوح الآن'
                                : 'مغلق'}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {shop.categoryLabel} · {shop.governorate} · {shop.center} ·{' '}
                        {shop.village}
                      </p>

                      <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{shop.address}</span>
                      </p>

                      <p className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span dir="ltr">{shop.phone}</span>
                        </span>
                        {shop.ownerEmail && (
                          <span dir="ltr" className="text-slate-500">
                            {shop.ownerEmail}
                          </span>
                        )}
                      </p>

                      {shop.status === 'suspended' && shop.suspensionReason && (
                        <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-800 dark:text-rose-200 font-semibold">
                          سبب التجميد: {shop.suspensionReason}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col flex-wrap gap-2 justify-end shrink-0">
                    {activeTab === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleApprove(shop)}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>قبول وتفعيل</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setDeleteTarget(shop)}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>رفض وحذف نهائي</span>
                        </button>
                      </>
                    )}

                    {activeTab === 'approved' && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleTogglePro(shop)}
                          className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-60 ${
                            shop.isPro
                              ? 'bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950 shadow-sm hover:brightness-95'
                              : 'bg-slate-200 text-slate-800 hover:bg-amber-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-500/20'
                          }`}
                        >
                          <Crown className="w-3.5 h-3.5" />
                          <span>
                            {shop.isPro ? 'إلغاء باقة PRO 👑' : 'تفعيل باقة PRO 👑'}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleVip(shop)}
                          className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                            shop.featured
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                              : 'bg-slate-200 text-slate-800 hover:bg-amber-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-500/20'
                          }`}
                        >
                          <Crown className="w-3.5 h-3.5" />
                          <span>
                            {shop.featured ? 'إلغاء التمييز (VIP)' : 'تمييز المحل (VIP)'}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setSuspendTarget(shop);
                            setSelectedPresetReason(PRESET_VIOLATION_REASONS[0]);
                            setCustomReason('');
                            setUseCustomReason(false);
                          }}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>تجميد لمخالفة</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setDeleteTarget(shop)}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 border border-rose-200 dark:border-rose-500/30 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف نهائي</span>
                        </button>
                      </>
                    )}

                    {activeTab === 'suspended' && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleUnsuspend(shop)}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                          <span>فك التجميد وإعادة التفعيل</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setDeleteTarget(shop)}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف نهائي</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Violation Reason Sub-Modal */}
      {suspendTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  تجميد المحل لمخالفة
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {suspendTarget.name} — سيختفي من الجمهور وتظهر رسالة المخالفة لصاحبه.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {PRESET_VIOLATION_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <input
                    type="radio"
                    name="violationReason"
                    checked={!useCustomReason && selectedPresetReason === reason}
                    onChange={() => {
                      setUseCustomReason(false);
                      setSelectedPresetReason(reason);
                    }}
                    className="accent-orange-600"
                  />
                  <span>{reason}</span>
                </label>
              ))}

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                <input
                  type="radio"
                  name="violationReason"
                  checked={useCustomReason}
                  onChange={() => setUseCustomReason(true)}
                  className="accent-orange-600"
                />
                <span>كتابة سبب مخصص آخر</span>
              </label>

              {useCustomReason && (
                <textarea
                  rows={3}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="اكتب تفاصيل المخالفة هنا ليراها صاحب المحل..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-orange-400 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={busyShopId === suspendTarget.id}
                onClick={() => void handleConfirmSuspend()}
                className="flex-1 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                {busyShopId === suspendTarget.id
                  ? 'جاري التجميد...'
                  : 'تأكيد التجميد'}
              </button>
              <button
                type="button"
                onClick={() => setSuspendTarget(null)}
                className="flex-1 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Sub-Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  تأكيد الحذف النهائي
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  هل أنت متأكد من حذف &quot;{deleteTarget.name}&quot; نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={busyShopId === deleteTarget.id}
                onClick={() => void handleConfirmDelete()}
                className="flex-1 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                {busyShopId === deleteTarget.id
                  ? 'جاري الحذف...'
                  : 'نعم، احذف نهائياً'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
