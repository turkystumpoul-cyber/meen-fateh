import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Crosshair,
  Database,
  LayoutList,
  Loader2,
  Map as MapIcon,
  MapPin,
  RotateCcw,
  Search,
  WifiOff,
  X,
} from 'lucide-react';
import { AboutDeveloperModal } from './components/AboutDeveloperModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { EmergencyChatbot } from './components/EmergencyChatbot';
import { Header } from './components/Header';
import { OnTheWayModal } from './components/OnTheWayModal';
import { OwnerPortalModal } from './components/OwnerPortalModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SearchableSelect } from './components/SearchableSelect';
import { ShopCard } from './components/ShopCard';
import { ShopDetailsModal } from './components/ShopDetailsModal';
import { ShopMapView } from './components/ShopMapView';
import {
  ALL_CENTERS_OPTION,
  ALL_VILLAGES_OPTION,
  GOVERNORATES,
  getCentersForGovernorate,
  getVillagesForCenter,
} from './data/locations';
import { CATEGORY_OPTIONS, INITIAL_SHOPS } from './data/shops';
import {
  FirebaseUserLite,
  fetchApprovedShopsPage,
  fetchOwnerShops,
  fetchShopByIdFromFirestore,
  isAdminUser,
  logoutOwner,
  subscribeIncomingVisitsForOwner,
  subscribeOwnerAuthState,
} from './services/firebase';
import {
  GovernorateName,
  IncomingVisit,
  Shop,
  ShopCategory,
  UserLocation,
} from './types';
import { calculateHaversineKm } from './utils/geo';
import {
  playVisitNotificationSound,
  showSystemPushNotification,
} from './utils/notificationSound';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [shops, setShops] = useState<Shop[]>(INITIAL_SHOPS);
  const [extraVillages, setExtraVillages] = useState<
    Array<{ gov: string; center: string; village: string }>
  >([]);
  const [isSamplePreview, setIsSamplePreview] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreFromServer, setHasMoreFromServer] = useState(false);
  const [lastFirestoreDoc, setLastFirestoreDoc] = useState<unknown | null>(null);

  const [currentUser, setCurrentUser] = useState<FirebaseUserLite | null>(null);
  const [adminHasOwnShop, setAdminHasOwnShop] = useState(false);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isServingFromCache, setIsServingFromCache] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory>('all');
  const [selectedGovernorate, setSelectedGovernorate] =
    useState<GovernorateName>('الفيوم');
  const [selectedCenter, setSelectedCenter] = useState<string>('مركز إطسا');
  const [selectedVillage, setSelectedVillage] =
    useState<string>(ALL_VILLAGES_OPTION);
  const [openNowOnly, setOpenNowOnly] = useState(false);

  const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);

  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [detailsShopId, setDetailsShopId] = useState<string | null>(null);
  const [deepLinkedShop, setDeepLinkedShop] = useState<Shop | null>(null);
  const [onTheWayShop, setOnTheWayShop] = useState<Shop | null>(null);
  const [incomingVisits, setIncomingVisits] = useState<IncomingVisit[]>([]);

  const govTriggerRef = useRef<HTMLButtonElement | null>(null);
  const categoryStripRef = useRef<HTMLDivElement | null>(null);
  const initialVisitsLoadedRef = useRef(false);
  const prevVisitIdsRef = useRef<Set<string>>(new Set());
  const deepLinkHandledRef = useRef(false);

  const adminLoggedIn = isAdminUser(currentUser);

  const refreshAdminShopPresence = useCallback(
    async (user: FirebaseUserLite | null) => {
      if (!user || !isAdminUser(user)) {
        setAdminHasOwnShop(false);
        return;
      }
      try {
        const owned = await fetchOwnerShops(user.uid);
        setAdminHasOwnShop(owned.length > 0);
      } catch (err) {
        console.warn('Could not check admin owned shops:', err);
        setAdminHasOwnShop(false);
      }
    },
    []
  );

  useEffect(() => {
    void refreshAdminShopPresence(currentUser);
  }, [currentUser, refreshAdminShopPresence]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    subscribeOwnerAuthState((user) => {
      if (active) {
        setCurrentUser(user);
      }
    })
      .then((unsub) => {
        if (active) {
          unsubscribe = unsub;
        } else {
          unsub();
        }
      })
      .catch((err) => {
        console.warn('Auth subscription warning:', err);
      });

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.uid || !currentUser.emailVerified) {
      setIncomingVisits([]);
      initialVisitsLoadedRef.current = false;
      prevVisitIdsRef.current = new Set();
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;

    subscribeIncomingVisitsForOwner(
      currentUser.uid,
      (visits) => {
        if (!active) return;
        const incomingIds = new Set(visits.map((v) => v.id));

        if (initialVisitsLoadedRef.current) {
          const newArrivals = visits.filter(
            (v) => !prevVisitIdsRef.current.has(v.id)
          );
          if (newArrivals.length > 0) {
            playVisitNotificationSound();
            const latest = newArrivals[0];
            void showSystemPushNotification(
              `عميل جايلك في الطريق 🚶‍♂️ (${latest.shopName || 'محلك'})`,
              `${latest.customerName}${
                latest.customerNote
                  ? ` — ${latest.customerNote}`
                  : ' متجه إلى محلك الآن'
              }`,
              `visit-${latest.id}`
            );
          }
        }

        initialVisitsLoadedRef.current = true;
        prevVisitIdsRef.current = incomingIds;
        setIncomingVisits(visits);
      },
      (err) => {
        console.warn('Global incoming visits subscription warning:', err);
      }
    )
      .then((unsub) => {
        if (active) {
          unsubscribe = unsub;
        } else {
          unsub();
        }
      })
      .catch((err) => {
        console.warn('Could not subscribe to incoming visits:', err);
      });

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.uid, currentUser?.emailVerified]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshPublicShops = useCallback(async () => {
    try {
      const result = await fetchApprovedShopsPage({ pageSize: 20 });
      setIsServingFromCache(result.fromCache);

      if (result.isEmpty || result.shops.length === 0) {
        setShops(INITIAL_SHOPS);
        setIsSamplePreview(true);
        setHasMoreFromServer(false);
        setLastFirestoreDoc(null);
      } else {
        setShops(result.shops);
        setIsSamplePreview(false);
        setHasMoreFromServer(result.hasMore);
        setLastFirestoreDoc(result.lastDoc);
      }
    } catch (err) {
      console.warn('Firestore initial fetch fallback to sample preview:', err);
      setShops(INITIAL_SHOPS);
      setIsSamplePreview(true);
      setHasMoreFromServer(false);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsInitialLoading(true);
    void refreshPublicShops();
  }, [refreshPublicShops]);

  useEffect(() => {
    if (isInitialLoading || deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetShopId = params.get('shop')?.trim();
    if (!targetShopId) return;

    const localMatch = shops.find((s) => s.id === targetShopId);
    if (localMatch) {
      setDetailsShopId(localMatch.id);
      return;
    }

    let active = true;
    fetchShopByIdFromFirestore(targetShopId)
      .then((fetchedShop) => {
        if (!active || !fetchedShop) return;
        setDeepLinkedShop(fetchedShop);
        setDetailsShopId(fetchedShop.id);
      })
      .catch((err) => {
        console.warn('Could not resolve deep-linked shop:', err);
      });

    return () => {
      active = false;
    };
  }, [isInitialLoading, shops]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreFromServer || !lastFirestoreDoc) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchApprovedShopsPage({
        lastDoc: lastFirestoreDoc,
        pageSize: 20,
      });
      setIsServingFromCache(result.fromCache);
      if (result.shops.length > 0) {
        setShops((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const uniqueNext = result.shops.filter((s) => !existingIds.has(s.id));
          return [...prev, ...uniqueNext];
        });
      }
      setLastFirestoreDoc(result.lastDoc);
      setHasMoreFromServer(result.hasMore);
    } catch (err) {
      console.warn('Error loading more shops from Firestore:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const centerOptions = useMemo(() => {
    const centers = getCentersForGovernorate(selectedGovernorate, shops);
    return [ALL_CENTERS_OPTION, ...centers];
  }, [selectedGovernorate, shops]);

  const villageOptions = useMemo(() => {
    if (selectedCenter === ALL_CENTERS_OPTION) {
      const fromShops = shops
        .filter(
          (s) => s.governorate === selectedGovernorate && s.village.trim() !== ''
        )
        .map((s) => s.village.trim());
      const fromExtra = extraVillages
        .filter((v) => v.gov === selectedGovernorate && v.village.trim() !== '')
        .map((v) => v.village.trim());
      return [
        ALL_VILLAGES_OPTION,
        ...Array.from(new Set([...fromShops, ...fromExtra])),
      ];
    }
    const villages = getVillagesForCenter(
      selectedGovernorate,
      selectedCenter,
      shops
    );
    const fromExtra = extraVillages
      .filter(
        (v) =>
          v.gov === selectedGovernorate &&
          v.center === selectedCenter &&
          v.village.trim() !== ''
      )
      .map((v) => v.village.trim());
    return [
      ALL_VILLAGES_OPTION,
      ...Array.from(new Set([...villages, ...fromExtra])),
    ];
  }, [selectedGovernorate, selectedCenter, shops, extraVillages]);

  const handleGovernorateChange = (govStr: string) => {
    const gov = govStr as GovernorateName;
    setSelectedGovernorate(gov);
    const centers = getCentersForGovernorate(gov, shops);
    if (gov === 'الفيوم' && centers.includes('مركز إطسا')) {
      setSelectedCenter('مركز إطسا');
    } else {
      setSelectedCenter(centers[0] ?? ALL_CENTERS_OPTION);
    }
    setSelectedVillage(ALL_VILLAGES_OPTION);
  };

  const handleCenterChange = (center: string) => {
    setSelectedCenter(center);
    setSelectedVillage(ALL_VILLAGES_OPTION);
  };

  const shopsWithDistance = useMemo(() => {
    if (!userLocation) return shops;
    return shops.map((shop) => ({
      ...shop,
      distanceKm: calculateHaversineKm(
        userLocation.lat,
        userLocation.lng,
        shop.lat,
        shop.lng
      ),
    }));
  }, [shops, userLocation]);

  const filteredAndSortedShops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = shopsWithDistance.filter((shop) => {
      const shopStatus = shop.status ?? 'approved';
      if (shopStatus !== 'approved' && shopStatus !== 'prayer') {
        return false;
      }

      if (shop.governorate !== selectedGovernorate) {
        return false;
      }

      if (
        selectedCenter !== ALL_CENTERS_OPTION &&
        shop.center !== selectedCenter
      ) {
        return false;
      }

      if (
        selectedVillage !== ALL_VILLAGES_OPTION &&
        shop.village !== selectedVillage
      ) {
        return false;
      }

      if (selectedCategory !== 'all' && shop.category !== selectedCategory) {
        return false;
      }

      if (openNowOnly && !shop.isOpen && shop.status !== 'prayer') {
        return false;
      }

      if (q) {
        const haystack = [
          shop.name,
          shop.categoryLabel,
          shop.governorate,
          shop.center,
          shop.village,
          shop.area,
          shop.address,
          ...shop.services,
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      const aPro = Boolean(a.isPro);
      const bPro = Boolean(b.isPro);
      if (aPro !== bPro) {
        return aPro ? -1 : 1;
      }
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }
      const rankA = a.isOpen ? 2 : a.status === 'prayer' ? 1 : 0;
      const rankB = b.isOpen ? 2 : b.status === 'prayer' ? 1 : 0;
      if (userLocation) {
        if (a.distanceKm !== b.distanceKm) {
          return a.distanceKm - b.distanceKm;
        }
        return rankB - rankA;
      }
      if (rankA !== rankB) {
        return rankB - rankA;
      }
      return a.distanceKm - b.distanceKm;
    });
  }, [
    shopsWithDistance,
    selectedGovernorate,
    selectedCenter,
    selectedVillage,
    selectedCategory,
    openNowOnly,
    searchQuery,
    userLocation,
  ]);

  const openCount = useMemo(
    () => filteredAndSortedShops.filter((s) => s.isOpen).length,
    [filteredAndSortedShops]
  );

  const handleRequestGps = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsWarning(
        'متصفحك الحالي لا يدعم خدمة تحديد الموقع الجغرافي. يتم عرض المسافات التقريبية حالياً.'
      );
      return;
    }

    setIsLocating(true);
    setGpsWarning(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsWarning(
            'لم يتم السماح بالوصول إلى موقعك. لا تقلق، يتم عرض المسافات التقريبية المعتادة بشكل طبيعي.'
          );
        } else {
          setGpsWarning(
            'تعذر تحديد موقعك بدقة الآن. يتم عرض المسافات التقريبية المعتادة.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleFocusAreaSelect = () => {
    govTriggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    govTriggerRef.current?.click();
  };

  const handleVillageDiscovered = (
    gov: string,
    center: string,
    village: string
  ) => {
    setExtraVillages((prev) => [...prev, { gov, center, village }]);
  };

  const handleHeaderLogout = async () => {
    setIsOwnerModalOpen(false);
    setIsAdminModalOpen(false);
    await logoutOwner();
  };

  const handleOpenShopDetails = (shop: Shop) => {
    setDetailsShopId(shop.id);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('shop', shop.id);
        window.history.replaceState(null, '', url.toString());
      } catch {
        // Ignore history state restrictions safely
      }
    }
  };

  const handleCloseShopDetails = () => {
    setDetailsShopId(null);
    setDeepLinkedShop(null);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('shop');
        window.history.replaceState(null, '', url.toString());
      } catch {
        // Ignore history state restrictions safely
      }
    }
  };

  const activeDetailsShop = useMemo(() => {
    if (!detailsShopId) return null;
    const inList = shopsWithDistance.find((s) => s.id === detailsShopId);
    if (inList) return inList;
    if (deepLinkedShop && deepLinkedShop.id === detailsShopId) {
      if (!userLocation) return deepLinkedShop;
      return {
        ...deepLinkedShop,
        distanceKm: calculateHaversineKm(
          userLocation.lat,
          userLocation.lng,
          deepLinkedShop.lat,
          deepLinkedShop.lng
        ),
      };
    }
    return null;
  }, [detailsShopId, shopsWithDistance, deepLinkedShop, userLocation]);

  const visibleCategoryOptions = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return CATEGORY_OPTIONS;
    return CATEGORY_OPTIONS.filter(
      (cat) => cat.id === 'all' || cat.label.toLowerCase().includes(q)
    );
  }, [categorySearchQuery]);

  const scrollCategoryStrip = (direction: 'start' | 'end') => {
    const el = categoryStripRef.current;
    if (!el) return;
    // In RTL, scrolling left uses negative offset and scrolling right uses positive offset
    const delta = direction === 'start' ? 240 : -240;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategorySearchQuery('');
    setSelectedCategory('all');
    setSelectedGovernorate('الفيوم');
    setSelectedCenter(ALL_CENTERS_OPTION);
    setSelectedVillage(ALL_VILLAGES_OPTION);
    setOpenNowOnly(false);
  };

  const hasCustomFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedGovernorate !== 'الفيوم' ||
    selectedCenter !== 'مركز إطسا' ||
    selectedVillage !== ALL_VILLAGES_OPTION ||
    openNowOnly;

  const headerLocationLabel =
    selectedVillage !== ALL_VILLAGES_OPTION
      ? `${selectedCenter} · ${selectedVillage}`
      : selectedCenter !== ALL_CENTERS_OPTION
        ? `${selectedGovernorate} · ${selectedCenter}`
        : `محافظة ${selectedGovernorate}`;

  const chatbotLocationContext = `${selectedGovernorate} - ${selectedCenter} - ${selectedVillage}`;

  return (
    <div
      id="top"
      className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300"
    >
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        locationLabel={headerLocationLabel}
        ownerEmail={currentUser?.email ?? null}
        isAdmin={adminLoggedIn}
        showOwnerDashboardButton={!adminLoggedIn || adminHasOwnShop}
        incomingVisitsCount={incomingVisits.length}
        onFocusAreaSelect={handleFocusAreaSelect}
        onOpenOwnerModal={() => setIsOwnerModalOpen(true)}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onOpenAboutModal={() => setIsAboutModalOpen(true)}
        onLogout={() => void handleHeaderLogout()}
      />

      {(!isOnline || isServingFromCache) && (
        <div
          role="status"
          className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/25 px-4 py-2 text-center"
        >
          <p className="max-w-7xl mx-auto inline-flex items-center justify-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>أنت تتصفح النسخة المحفوظة حالياً</span>
          </p>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28">
        <section className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug text-balance">
              اعرف مين فاتح دلوقتي في محافظة {selectedGovernorate}
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              دليل فوري للصيدليات المناوبة، عيادات الطوارئ، ومراكز الصيانة والخدمات الليلية في جميع محافظات ومراكز وقرى مصر.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRequestGps}
              disabled={isLocating}
              className={`min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap border ${
                userLocation
                  ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500 shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
              }`}
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Crosshair className="w-4 h-4 shrink-0" />
              )}
              <span>
                {isLocating
                  ? 'جاري تحديد موقعك...'
                  : userLocation
                    ? 'تم تفعيل الأقرب إليّ (GPS)'
                    : 'تحديد موقعي والأقرب إليّ (GPS)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span>اسأل مساعد الفيوم الذكي</span>
            </button>

            <PWAInstallButton variant="hero" />

            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="md:hidden min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Code2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>حول المطور</span>
            </button>
          </div>
        </section>

        {gpsWarning && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 border border-amber-200 dark:border-amber-500/30 text-xs sm:text-sm font-semibold"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{gpsWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setGpsWarning(null)}
              aria-label="إخفاء التنبيه"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-500/20 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <section
          aria-label="أدوات البحث والفلترة"
          className="space-y-4 mb-6 rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-8 relative">
              <label htmlFor="shop-search" className="sr-only">
                ابحث عن محل أو صيدلية أو خدمة
              </label>
              <Search
                className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="shop-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم المحل، التخصص (صيدلية، سباكة، موبايل...)، الشارع أو القرية..."
                className="w-full min-h-[46px] pr-11 pl-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="lg:col-span-4">
              <button
                type="button"
                role="switch"
                aria-checked={openNowOnly}
                onClick={() => setOpenNowOnly((prev) => !prev)}
                className={`w-full min-h-[46px] px-4 rounded-xl text-sm font-bold inline-flex items-center justify-between gap-3 border transition-all duration-200 cursor-pointer ${
                  openNowOnly
                    ? 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-500 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>عرض المفتوح الآن فقط</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                    openNowOnly
                      ? 'bg-white/30 dark:bg-slate-950/30 justify-start'
                      : 'bg-slate-300 dark:bg-slate-700 justify-end'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </span>
              </button>
            </div>
          </div>

          <div
            aria-label="الفلترة الجغرافية المتدرجة"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <SearchableSelect
              id="gov-selector"
              label="المحافظة (27 محافظة)"
              value={selectedGovernorate}
              options={GOVERNORATES}
              onChange={handleGovernorateChange}
              searchPlaceholder="ابحث عن المحافظة..."
              prefixOptionText="محافظة"
              triggerRef={govTriggerRef}
              icon={
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              }
            />

            <SearchableSelect
              id="center-selector"
              label="المركز / المدينة"
              value={selectedCenter}
              options={centerOptions}
              onChange={handleCenterChange}
              searchPlaceholder="ابحث عن المركز أو المدينة..."
            />

            <SearchableSelect
              id="village-selector"
              label="القرية / الحي"
              value={selectedVillage}
              options={villageOptions}
              onChange={setSelectedVillage}
              searchPlaceholder="ابحث عن القرية أو الحي..."
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1">
            <div className="relative sm:w-52 shrink-0">
              <label htmlFor="category-quick-search" className="sr-only">
                بحث سريع في التخصصات
              </label>
              <Search
                className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="category-quick-search"
                type="search"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder="بحث سريع في التخصصات..."
                className="w-full min-h-[40px] pr-9 pl-8 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
              {categorySearchQuery && (
                <button
                  type="button"
                  onClick={() => setCategorySearchQuery('')}
                  aria-label="مسح بحث التخصص"
                  className="min-h-[34px] min-w-[34px] flex items-center justify-center absolute left-0.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => scrollCategoryStrip('start')}
                aria-label="التمرير لبداية التخصصات"
                className="hidden md:flex min-h-[40px] min-w-[36px] items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div
                ref={categoryStripRef}
                role="tablist"
                aria-label="فلترة حسب التخصص"
                className="flex items-center gap-2 overflow-x-auto scroll-smooth no-scrollbar py-0.5 flex-1 min-w-0"
              >
                {visibleCategoryOptions.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white shadow-sm'
                          : 'bg-slate-100/80 text-slate-700 border-slate-200 hover:bg-slate-200/80 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span aria-hidden="true" className="text-base leading-none">
                        {cat.emoji}
                      </span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
                {visibleCategoryOptions.length === 1 && categorySearchQuery && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap px-2">
                    لا توجد تخصصات مطابقة
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => scrollCategoryStrip('end')}
                aria-label="التمرير لباقي التخصصات"
                className="hidden md:flex min-h-[40px] min-w-[36px] items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 px-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              النتائج:{' '}
              <span className="text-slate-900 dark:text-white font-bold tabular-nums">
                {filteredAndSortedShops.length.toLocaleString('ar-EG')}
              </span>{' '}
              محل وخدمة{' '}
              <span className="mx-1.5 text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                {openCount.toLocaleString('ar-EG')} مفتوح الآن
              </span>
              {userLocation && (
                <>
                  <span className="mx-1.5 text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-sky-600 dark:text-sky-400 font-bold">
                    مرتبة من الأقرب لموقعك
                  </span>
                </>
              )}
            </p>

            {isSamplePreview && !isInitialLoading && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                <Database className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>بيانات تجريبية للمعاينة</span>
              </span>
            )}

            {userLocation && (
              <button
                type="button"
                onClick={() => setUserLocation(null)}
                className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>إلغاء فرز GPS</span>
              </button>
            )}

            {hasCustomFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>عرض كل مراكز الفيوم</span>
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="طريقة عرض النتائج"
            className="inline-flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0"
          >
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutList className="w-4 h-4 shrink-0" />
              <span>عرض القائمة</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('map')}
              aria-pressed={viewMode === 'map'}
              className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MapIcon className="w-4 h-4 shrink-0" />
              <span>عرض الخريطة</span>
            </button>
          </div>
        </div>

        {isInitialLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 animate-pulse"
              >
                <div className="h-40 bg-slate-200 dark:bg-slate-800" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-10 w-full rounded-xl bg-slate-200 dark:bg-slate-800 mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedShops.length > 0 ? (
          <>
            {viewMode === 'cards' ? (
              <section
                aria-label="قائمة المحلات والخدمات"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pb-28"
              >
                {filteredAndSortedShops.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    isGpsActive={Boolean(userLocation)}
                    onOpenDetails={(s) => handleOpenShopDetails(s)}
                    onOpenOnTheWay={(s) => setOnTheWayShop(s)}
                  />
                ))}
              </section>
            ) : (
              <section aria-label="خريطة المحلات التفاعلية">
                <ShopMapView
                  shops={filteredAndSortedShops}
                  userLocation={userLocation}
                  isGpsActive={Boolean(userLocation)}
                />
              </section>
            )}

            {hasMoreFromServer && !isSamplePreview && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={isLoadingMore}
                  className="min-h-[46px] inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isLoadingMore && (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  )}
                  <span>{isLoadingMore ? 'جاري التحميل...' : 'عرض المزيد'}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <section className="rounded-2xl p-8 sm:p-12 text-center bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
              لا توجد نتائج مطابقة في هذا النطاق حالياً
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-5">
              جرّب اختيار &quot;كل المراكز والمدن&quot; أو &quot;كل القرى والأحياء&quot;، أو إلغاء فلتر المفتوح الآن فقط، أو أضف محلك ليكون متاحاً للجميع.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>عرض كل مراكز الفيوم</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOwnerModalOpen(true)}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <span>أضف محلك في هذه المنطقة</span>
              </button>
            </div>
          </section>
        )}

        <PWAInstallButton variant="banner" />
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/80 pt-6 pb-28 px-4 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p>مين فاتح دلوقتي؟ — دليل الطوارئ والخدمات الليلية بجميع محافظات مصر</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <p className="tabular-nums">
              أرقام الطوارئ الرسمية: الإسعاف 123 · النجدة 122 · الحماية المدنية 180
            </p>
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>حول المطور</span>
            </button>
          </div>
        </div>
      </footer>

      <button
        type="button"
        onClick={() => setIsChatOpen(true)}
        aria-label="فتح مساعد الطوارئ الذكي"
        className="fixed bottom-4 left-4 z-40 px-4 py-2.5 text-sm rounded-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white dark:text-slate-950 shadow-lg shadow-emerald-600/25 inline-flex items-center gap-1.5 font-bold transition-transform duration-200 active:scale-95 cursor-pointer"
      >
        <Bot className="w-4 h-4 shrink-0" />
        <span className="whitespace-nowrap">مساعد الطوارئ</span>
      </button>

      <OwnerPortalModal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
        currentUser={currentUser}
        allShops={shopsWithDistance}
        incomingVisits={incomingVisits}
        onVillageDiscovered={handleVillageDiscovered}
        onShopUpdated={() => {
          void refreshPublicShops();
          void refreshAdminShopPresence(currentUser);
        }}
      />

      <AdminDashboardModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        currentUser={currentUser}
        onDirectoryMutated={() => {
          void refreshPublicShops();
          void refreshAdminShopPresence(currentUser);
        }}
      />

      <ShopDetailsModal
        shop={activeDetailsShop}
        onClose={handleCloseShopDetails}
        onOpenOnTheWay={(shop) => setOnTheWayShop(shop)}
      />

      <OnTheWayModal
        shop={onTheWayShop}
        onClose={() => setOnTheWayShop(null)}
      />

      <EmergencyChatbot
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        shops={shopsWithDistance}
        selectedArea={chatbotLocationContext}
      />

      <AboutDeveloperModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />
    </div>
  );
}
