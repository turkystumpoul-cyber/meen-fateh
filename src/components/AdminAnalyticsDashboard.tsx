import { useMemo, useState } from 'react';
import { BarChart3, Crown, Layers, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { IncomingVisit, Shop, ShopCategory } from '../types';

interface AdminAnalyticsDashboardProps {
  shops: Shop[];
  incomingVisits: IncomingVisit[];
  isLoading: boolean;
}

type RangeDays = 7 | 14 | 30;
type ProChartView = 'daily' | 'shops';

const CATEGORY_META: Array<{
  id: Exclude<ShopCategory, 'all'>;
  label: string;
  color: string;
}> = [
  { id: 'pharmacy', label: 'صيدليات', color: '#10b981' },
  { id: 'clinic', label: 'عيادات ومراكز طبية', color: '#0ea5e9' },
  { id: 'labs', label: 'معامل تحاليل وأشعة', color: '#06b6d4' },
  { id: 'restaurant', label: 'مطاعم ومأكولات', color: '#f97316' },
  { id: 'cafe', label: 'كافيهات ومقاهي', color: '#d97706' },
  { id: 'supermarket', label: 'سوبر ماركت وبقالة', color: '#6366f1' },
  { id: 'bakery', label: 'مخبوزات وحلواني', color: '#eab308' },
  { id: 'butcher', label: 'جزارة ودواجن وأسماك', color: '#f43f5e' },
  { id: 'produce', label: 'خضار وفاكهة', color: '#84cc16' },
  { id: 'mobile_repair', label: 'صيانة ومستلزمات موبايل', color: '#3b82f6' },
  { id: 'computer_print', label: 'كمبيوتر وخدمات طباعة', color: '#8b5cf6' },
  { id: 'auto_parts', label: 'صيانة سيارات وكاوتش', color: '#64748b' },
  { id: 'plumbing_electrical', label: 'سباكة وكهرباء وحدايد', color: '#f59e0b' },
  { id: 'appliances_ac', label: 'صيانة أجهزة وتكييف', color: '#22d3ee' },
  { id: 'barber', label: 'حلاقة رجالي', color: '#475569' },
  { id: 'beauty_salon', label: 'كوافير وتجميل', color: '#ec4899' },
  { id: 'clothing', label: 'ملابس وأحذية', color: '#a855f7' },
  { id: 'laundry', label: 'مغاسل ودراي كلين', color: '#38bdf8' },
  { id: 'payments_telecom', label: 'خدمات دفع واتصالات', color: '#14b8a6' },
  { id: 'other', label: 'أخرى', color: '#94a3b8' },
];

function toLocalDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatArabicShortDate(date: Date): string {
  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
  });
}

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      dir="rtl"
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[140px]"
    >
      {label && (
        <p className="font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
          {label}
        </p>
      )}
      {payload.map((entry, idx) => (
        <div
          key={`${entry.dataKey ?? entry.name ?? idx}`}
          className="flex items-center justify-between gap-4"
        >
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color || '#10b981' }}
            />
            <span>{entry.name}</span>
          </span>
          <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
            {Number(entry.value ?? 0).toLocaleString('ar-EG')}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AdminAnalyticsDashboard({
  shops,
  incomingVisits,
  isLoading,
}: AdminAnalyticsDashboardProps) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(14);
  const [proChartView, setProChartView] = useState<ProChartView>('daily');

  const dayBuckets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list: Array<{ key: string; label: string; fullLabel: string }> = [];

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      list.push({
        key: toLocalDayKey(d.getTime()),
        label: d.toLocaleDateString('ar-EG', {
          day: 'numeric',
          month: 'numeric',
        }),
        fullLabel: formatArabicShortDate(d),
      });
    }
    return list;
  }, [rangeDays]);

  const dailyRegistrationsData = useMemo(() => {
    const countsByDay = new Map<
      string,
      { total: number; approved: number; pending: number }
    >();
    for (const bucket of dayBuckets) {
      countsByDay.set(bucket.key, { total: 0, approved: 0, pending: 0 });
    }

    let missingTimestampCount = 0;

    for (const shop of shops) {
      const ts = shop.createdAtMs ?? shop.lastUpdatedMs;
      if (!ts) {
        missingTimestampCount += 1;
        continue;
      }
      const key = toLocalDayKey(ts);
      const bucket = countsByDay.get(key);
      if (!bucket) continue;

      bucket.total += 1;
      if (shop.status === 'approved' || shop.status === 'prayer') {
        bucket.approved += 1;
      } else if ((shop.status ?? 'pending') === 'pending') {
        bucket.pending += 1;
      }
    }

    const rows = dayBuckets.map((b) => {
      const stats = countsByDay.get(b.key) ?? {
        total: 0,
        approved: 0,
        pending: 0,
      };
      return {
        day: b.label,
        fullDate: b.fullLabel,
        'تسجيلات جديدة': stats.total,
        'محلات مفعلة': stats.approved,
      };
    });

    const periodTotal = rows.reduce((sum, r) => sum + r['تسجيلات جديدة'], 0);

    return { rows, periodTotal, missingTimestampCount };
  }, [shops, dayBuckets]);

  const categoryDistribution = useMemo(() => {
    const counts = new Map<Exclude<ShopCategory, 'all'>, number>();
    for (const meta of CATEGORY_META) {
      counts.set(meta.id, 0);
    }

    for (const shop of shops) {
      const prev = counts.get(shop.category) ?? 0;
      counts.set(shop.category, prev + 1);
    }

    const total = shops.length;
    return CATEGORY_META.map((meta) => {
      const count = counts.get(meta.id) ?? 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        ...meta,
        count,
        pct,
      };
    }).sort((a, b) => b.count - a.count);
  }, [shops]);

  const proMetrics = useMemo(() => {
    const proShops = shops.filter((s) => Boolean(s.isPro));
    const proShopIds = new Set(proShops.map((s) => s.id));
    const totalProOffers = proShops.reduce(
      (sum, s) => sum + (s.offers?.length ?? 0),
      0
    );

    const proVisits = incomingVisits.filter(
      (v) => proShopIds.has(v.shopId) || shops.length === 0
    );
    const activeVisitsCount = proVisits.filter(
      (v) => v.status !== 'handled'
    ).length;
    const handledVisitsCount = proVisits.filter(
      (v) => v.status === 'handled'
    ).length;

    // Daily visits chart
    const dailyMap = new Map<string, { handled: number; active: number }>();
    for (const bucket of dayBuckets) {
      dailyMap.set(bucket.key, { handled: 0, active: 0 });
    }
    for (const visit of proVisits) {
      const key = toLocalDayKey(visit.createdAtMs);
      const entry = dailyMap.get(key);
      if (!entry) continue;
      if (visit.status === 'handled') {
        entry.handled += 1;
      } else {
        entry.active += 1;
      }
    }

    const dailyVisitsData = dayBuckets.map((b) => {
      const entry = dailyMap.get(b.key) ?? { handled: 0, active: 0 };
      return {
        day: b.label,
        'تم الاستقبال': entry.handled,
        'في الطريق الآن': entry.active,
      };
    });

    // Per-PRO-shop engagement ranking
    const visitsByShop = new Map<string, number>();
    for (const v of incomingVisits) {
      visitsByShop.set(v.shopId, (visitsByShop.get(v.shopId) ?? 0) + 1);
    }

    const topProShopsData = proShops
      .map((s) => ({
        id: s.id,
        name: s.name.length > 16 ? `${s.name.slice(0, 15)}…` : s.name,
        fullName: s.name,
        'زيارات العملاء': visitsByShop.get(s.id) ?? 0,
        'العروض المنشورة': s.offers?.length ?? 0,
      }))
      .sort(
        (a, b) =>
          b['زيارات العملاء'] - a['زيارات العملاء'] ||
          b['العروض المنشورة'] - a['العروض المنشورة']
      )
      .slice(0, 7);

    return {
      proCount: proShops.length,
      proSharePct:
        shops.length > 0 ? Math.round((proShops.length / shops.length) * 100) : 0,
      totalProOffers,
      totalProVisits: proVisits.length,
      activeVisitsCount,
      handledVisitsCount,
      dailyVisitsData,
      topProShopsData,
    };
  }, [shops, incomingVisits, dayBuckets]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: Title + Timeframe Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>مؤشرات النمو والتفاعل المباشر</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            بيانات حية مستخلصة من قاعدة بيانات المحلات وطلبات زيارة البرو
          </p>
        </div>

        <div
          role="group"
          aria-label="نطاق الأيام للرسوم البيانية"
          className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0"
        >
          {([7, 14, 30] as RangeDays[]).map((days) => {
            const active = rangeDays === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => setRangeDays(days)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                آخر {days} يوم
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-bold text-emerald-400">
            تسجيلات آخر {rangeDays} يوم
          </p>
          <p className="text-3xl font-extrabold text-white tabular-nums mt-2 leading-none">
            {dailyRegistrationsData.periodTotal.toLocaleString('ar-EG')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            من أصل {shops.length.toLocaleString('ar-EG')} محل مسجل
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-bold text-amber-400">
            المشتركين في باقة PRO
          </p>
          <p className="text-3xl font-extrabold text-white tabular-nums mt-2 leading-none">
            {proMetrics.proCount.toLocaleString('ar-EG')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            يمثلون {proMetrics.proSharePct.toLocaleString('ar-EG')}% من الدليل
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-bold text-sky-400">
            زيارات العملاء للبرو
          </p>
          <p className="text-3xl font-extrabold text-white tabular-nums mt-2 leading-none">
            {proMetrics.totalProVisits.toLocaleString('ar-EG')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            {proMetrics.handledVisitsCount.toLocaleString('ar-EG')} مكتملة ·{' '}
            {proMetrics.activeVisitsCount.toLocaleString('ar-EG')} في الطريق
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-bold text-slate-300">
            العروض المنشورة (PRO)
          </p>
          <p className="text-3xl font-extrabold text-white tabular-nums mt-2 leading-none">
            {proMetrics.totalProOffers.toLocaleString('ar-EG')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            عروض ومنتجات نشطة للجمهور
          </p>
        </div>
      </div>

      {/* Chart 1: Daily New Shop Registrations */}
      <section className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>عدد التسجيلات الجديدة يومياً</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              مقارنة إجمالي المحلات المسجلة يومياً بالمحلات التي تم تفعيلها خلال آخر{' '}
              {rangeDays} يوماً
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span>تسجيلات جديدة</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
              <span>محلات مفعلة</span>
            </span>
          </div>
        </div>

        <div dir="ltr" className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={dailyRegistrationsData.rows}
              margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="regTotalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="regApprovedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#94a3b8"
                strokeOpacity={0.2}
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={rangeDays === 30 ? 3 : rangeDays === 14 ? 1 : 0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="تسجيلات جديدة"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#regTotalGrad)"
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="محلات مفعلة"
                stroke="#0ea5e9"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#regApprovedGrad)"
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {dailyRegistrationsData.missingTimestampCount > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            ملاحظة: يوجد{' '}
            <span className="font-bold tabular-nums">
              {dailyRegistrationsData.missingTimestampCount.toLocaleString('ar-EG')}
            </span>{' '}
            محلات قديمة مسجلة قبل تفعيل ختم التاريخ الزمني التلقائي.
          </p>
        )}
      </section>

      {/* Bottom 2-Column Grid: Category Breakdown + PRO Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 2: Distribution by Category */}
        <section className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-500 shrink-0" />
              <span>توزيع المحلات حسب التخصص</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              نسبة وأعداد كل نشاط مسجل في المنصة
            </p>
          </div>

          {shops.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-400">
              لا توجد محلات مسجلة لعرض توزيع التخصصات بعد.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div dir="ltr" className="sm:col-span-5 h-52 relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={categoryDistribution.filter((c) => c.count > 0)}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {categoryDistribution
                        .filter((c) => c.count > 0)
                        .map((entry) => (
                          <Cell key={entry.id} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">
                    {shops.length.toLocaleString('ar-EG')}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                    إجمالي
                  </span>
                </div>
              </div>

              <div className="sm:col-span-7 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {categoryDistribution
                  .filter((cat) => cat.count > 0)
                  .map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-100 dark:border-slate-800/80 last:border-b-0"
                    >
                      <span className="inline-flex items-center gap-2 min-w-0 font-bold text-slate-700 dark:text-slate-200">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.label}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300 font-bold">
                        {cat.count.toLocaleString('ar-EG')}{' '}
                        <span className="text-slate-400 dark:text-slate-500 font-semibold">
                          ({cat.pct.toLocaleString('ar-EG')}%)
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* Chart 3: PRO Shops Engagement */}
        <section className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                <span>حجم التفاعل مع المحلات البرو</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                طلبات &quot;أنا جايلك في الطريق&quot; والعروض النشطة
              </p>
            </div>

            <div
              role="group"
              aria-label="طريقة عرض تفاعل البرو"
              className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0"
            >
              <button
                type="button"
                onClick={() => setProChartView('daily')}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  proChartView === 'daily'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                التفاعل اليومي
              </button>
              <button
                type="button"
                onClick={() => setProChartView('shops')}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  proChartView === 'shops'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ترتيب المحلات PRO
              </button>
            </div>
          </div>

          {proChartView === 'daily' ? (
            proMetrics.totalProVisits === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-center px-4">
                <Crown className="w-7 h-7 text-amber-400 mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  لم يتم تسجيل طلبات زيارة لعملاء البرو بعد
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                  عند ضغط أي زائر على &quot;أنا جايلك في الطريق&quot; في المحلات البرو، سيظهر حجم التفاعل اليومي هنا تلقائياً.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                    <span>تم الاستقبال</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span>في الطريق الآن</span>
                  </span>
                </div>
                <div dir="ltr" className="w-full h-52">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart
                      data={proMetrics.dailyVisitsData}
                      margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#94a3b8"
                        strokeOpacity={0.2}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval={rangeDays === 30 ? 4 : rangeDays === 14 ? 2 : 0}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        dataKey="تم الاستقبال"
                        stackId="visits"
                        fill="#f59e0b"
                        radius={[0, 0, 4, 4]}
                      />
                      <Bar
                        dataKey="في الطريق الآن"
                        stackId="visits"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )
          ) : proMetrics.topProShopsData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center px-4">
              <Crown className="w-7 h-7 text-amber-400 mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                لا توجد محلات مفعلة بباقة PRO حالياً
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                قم بترقية أي محل من تبويب &quot;المحلات المفعلة&quot; لمتابعة زياراته وعروضه هنا.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  <span>زيارات العملاء</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
                  <span>العروض المنشورة</span>
                </span>
              </div>
              <div dir="ltr" className="w-full h-52">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    data={proMetrics.topProShopsData}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#94a3b8"
                      strokeOpacity={0.2}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="زيارات العملاء"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="العروض المنشورة"
                      fill="#0ea5e9"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
