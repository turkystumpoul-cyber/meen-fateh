import { useState } from 'react';
import {
  Apple,
  Beef,
  Check,
  Coffee,
  CreditCard,
  Croissant,
  Crown,
  Droplets,
  FlaskConical,
  Footprints,
  Laptop,
  Lightbulb,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Pill,
  Pin,
  Scissors,
  Share2,
  Shirt,
  ShoppingBag,
  Smartphone,
  Snowflake,
  Sparkles,
  Stethoscope,
  Utensils,
  Wrench,
} from 'lucide-react';
import { Shop, ShopCategory } from '../types';
import { copyShopDeepLink } from '../utils/shareShop';

interface ShopCardProps {
  shop: Shop;
  isGpsActive?: boolean;
  onOpenDetails: (shop: Shop) => void;
  onOpenOnTheWay: (shop: Shop) => void;
}

function FallbackSpecialtyVisual({
  category,
  label,
}: {
  category: Exclude<ShopCategory, 'all'>;
  label: string;
}) {
  const styles: Record<
    Exclude<ShopCategory, 'all'>,
    { bg: string; iconColor: string; Icon: typeof Pill }
  > = {
    pharmacy: {
      bg: 'from-emerald-100 via-teal-50 to-slate-100 dark:from-emerald-950/80 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-emerald-600/80 dark:text-emerald-400/80',
      Icon: Pill,
    },
    clinic: {
      bg: 'from-sky-100 via-cyan-50 to-slate-100 dark:from-sky-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-sky-600/80 dark:text-sky-400/80',
      Icon: Stethoscope,
    },
    labs: {
      bg: 'from-cyan-100 via-teal-50 to-slate-100 dark:from-cyan-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-cyan-600/80 dark:text-cyan-400/80',
      Icon: FlaskConical,
    },
    restaurant: {
      bg: 'from-orange-100 via-amber-50 to-slate-100 dark:from-orange-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-orange-600/80 dark:text-orange-400/80',
      Icon: Utensils,
    },
    cafe: {
      bg: 'from-amber-100 via-yellow-50 to-slate-100 dark:from-amber-950/60 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-amber-700/80 dark:text-amber-400/80',
      Icon: Coffee,
    },
    supermarket: {
      bg: 'from-indigo-100 via-slate-50 to-slate-100 dark:from-indigo-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-indigo-600/80 dark:text-indigo-400/80',
      Icon: ShoppingBag,
    },
    bakery: {
      bg: 'from-amber-100 via-orange-50 to-slate-100 dark:from-amber-950/60 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-amber-600/80 dark:text-amber-400/80',
      Icon: Croissant,
    },
    butcher: {
      bg: 'from-rose-100 via-red-50 to-slate-100 dark:from-rose-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-rose-600/80 dark:text-rose-400/80',
      Icon: Beef,
    },
    produce: {
      bg: 'from-lime-100 via-emerald-50 to-slate-100 dark:from-lime-950/60 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-lime-600/80 dark:text-lime-400/80',
      Icon: Apple,
    },
    mobile_repair: {
      bg: 'from-blue-100 via-sky-50 to-slate-100 dark:from-blue-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-blue-600/80 dark:text-blue-400/80',
      Icon: Smartphone,
    },
    computer_print: {
      bg: 'from-violet-100 via-indigo-50 to-slate-100 dark:from-violet-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-violet-600/80 dark:text-violet-400/80',
      Icon: Laptop,
    },
    auto_parts: {
      bg: 'from-slate-200 via-slate-100 to-zinc-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-slate-600/80 dark:text-slate-300/80',
      Icon: Wrench,
    },
    plumbing_electrical: {
      bg: 'from-yellow-100 via-amber-50 to-slate-100 dark:from-yellow-950/60 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-yellow-600/80 dark:text-yellow-400/80',
      Icon: Lightbulb,
    },
    appliances_ac: {
      bg: 'from-cyan-100 via-sky-50 to-slate-100 dark:from-cyan-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-cyan-600/80 dark:text-cyan-400/80',
      Icon: Snowflake,
    },
    barber: {
      bg: 'from-slate-200 via-zinc-100 to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-slate-700/80 dark:text-slate-300/80',
      Icon: Scissors,
    },
    beauty_salon: {
      bg: 'from-pink-100 via-rose-50 to-slate-100 dark:from-pink-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-pink-600/80 dark:text-pink-400/80',
      Icon: Sparkles,
    },
    clothing: {
      bg: 'from-purple-100 via-slate-50 to-slate-100 dark:from-purple-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-purple-600/80 dark:text-purple-400/80',
      Icon: Shirt,
    },
    laundry: {
      bg: 'from-sky-100 via-blue-50 to-slate-100 dark:from-sky-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-sky-600/80 dark:text-sky-400/80',
      Icon: Droplets,
    },
    payments_telecom: {
      bg: 'from-emerald-100 via-green-50 to-slate-100 dark:from-emerald-950/70 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-emerald-600/80 dark:text-emerald-400/80',
      Icon: CreditCard,
    },
    other: {
      bg: 'from-slate-200 via-slate-100 to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950',
      iconColor: 'text-slate-600/80 dark:text-slate-400/80',
      Icon: Pin,
    },
  };

  const config = styles[category] ?? styles.other;
  const Icon = config.Icon;

  return (
    <div
      aria-label={label}
      className={`w-full h-full bg-gradient-to-br ${config.bg} flex items-center justify-center select-none transition-transform duration-500 ease-out group-hover:scale-105`}
    >
      <Icon className={`w-12 h-12 ${config.iconColor}`} strokeWidth={1.6} />
    </div>
  );
}

export function ShopCard({
  shop,
  isGpsActive = false,
  onOpenDetails,
  onOpenOnTheWay,
}: ShopCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const whatsappMessage = encodeURIComponent(
    `السلام عليكم، وجدت محلكم "${shop.name}" على تطبيق مين فاتح دلوقتي؟ وأحتاج استفساراً سريعاً.`
  );
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;
  const showImage = Boolean(shop.imageUrl && !imageFailed);
  const offersCount = shop.isPro && shop.offers ? shop.offers.length : 0;
  const activeOfferTitle = shop.isPro
    ? shop.activeOffer ||
      shop.offerText ||
      (shop.offers && shop.offers.length > 0 ? shop.offers[0].title : '')
    : '';

  const handleShareShop = async () => {
    await copyShopDeepLink(shop.id);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 2600);
  };

  return (
    <article
      className={`group relative flex flex-col justify-between rounded-2xl overflow-hidden transition-all duration-200 ${
        shop.isPro
          ? 'bg-gradient-to-br from-slate-900 via-amber-950/25 to-slate-900 border-2 border-amber-400/70 shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 hover:border-amber-300/90'
          : shop.featured
            ? 'bg-slate-900 border border-amber-400/75 shadow-sm shadow-amber-500/10 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-700'
            : 'bg-slate-900 border border-slate-800 shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-slate-700'
      }`}
    >
      {shop.isPro && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 z-20 pro-shimmer-sweep"
        />
      )}

      <div>
        {/* Image Header (h-36) — clean image only with zero overlaid text */}
        <div
          onClick={() => onOpenDetails(shop)}
          className="relative h-36 w-full overflow-hidden bg-slate-950 cursor-pointer"
        >
          {showImage ? (
            <img
              src={shop.imageUrl}
              alt={shop.name}
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <FallbackSpecialtyVisual
              category={shop.category}
              label={shop.categoryLabel}
            />
          )}
        </div>

        {/* Lower Dark Section */}
        <div
          className={`p-4 pb-3 space-y-2.5 ${
            shop.isPro ? 'bg-transparent' : 'bg-slate-900'
          }`}
        >
          {/* Row 1: Shop Name (right) + Status Badge (left) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2
                onClick={() => onOpenDetails(shop)}
                className={`text-lg font-bold leading-snug truncate cursor-pointer transition-colors ${
                  shop.isPro
                    ? 'pro-gold-title font-extrabold'
                    : 'text-white group-hover:text-emerald-400'
                }`}
              >
                {shop.name}
              </h2>

              {shop.isPro && (
                <div className="inline-flex items-center gap-1 shrink-0">
                  <span aria-hidden="true" className="text-sm leading-none">
                    👑
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950 shadow-sm whitespace-nowrap">
                    معتمد PRO
                  </span>
                </div>
              )}
            </div>

            <span
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-extrabold whitespace-nowrap shrink-0 ${
                shop.status === 'prayer'
                  ? 'bg-amber-950/90 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/20'
                  : shop.isOpen
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50 shadow-md shadow-emerald-500/20'
                    : 'bg-rose-950 text-rose-300 border border-rose-700/50'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block rounded-full h-2.5 w-2.5 shrink-0 ${
                  shop.status === 'prayer'
                    ? 'bg-amber-400 live-pulse-dot'
                    : shop.isOpen
                      ? 'bg-emerald-400 live-pulse-dot'
                      : 'bg-rose-400'
                }`}
              />
              <span>
                {shop.status === 'prayer'
                  ? 'مغلق للصلاة 🕌'
                  : shop.isOpen
                    ? 'مفتوح الآن'
                    : 'مغلق'}
              </span>
            </span>
          </div>

          {/* Row 2: Single Horizontal Strip — Category + Area + Distance (km) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shrink-0">
              {shop.categoryLabel}
            </span>

            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/80 max-w-[140px] truncate shrink-0">
              {shop.area}
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums bg-sky-500/15 text-sky-300 border border-sky-500/25 shrink-0">
              <Navigation className="w-3 h-3 shrink-0" />
              <span>
                {shop.distanceKm.toLocaleString('ar-EG', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                كم
                {isGpsActive ? ' (فعلي)' : ''}
              </span>
            </span>
          </div>

          {/* Highlighted PRO Special Offer Strip */}
          {shop.isPro && activeOfferTitle && (
            <div
              onClick={() => onOpenDetails(shop)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-amber-500/20 transition-colors"
            >
              <span className="truncate">🎁 عرض خاص: {activeOfferTitle}</span>
            </div>
          )}

          {/* Compact Address + VIP badge */}
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <p className="flex items-center gap-1.5 min-w-0 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{shop.address}</span>
            </p>
            {shop.featured && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                <Crown className="w-3 h-3 shrink-0" />
                <span>مميز</span>
              </span>
            )}
          </div>

          {shop.isPro && (
            <button
              type="button"
              onClick={() => onOpenOnTheWay(shop)}
              className="w-full min-h-[36px] inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shadow-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <Footprints className="w-3.5 h-3.5 shrink-0" />
                <span>أنا جايلك في الطريق 🚶‍♂️</span>
              </span>
              {offersCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-950/15 tabular-nums">
                  {offersCount} عروض
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Row 3: Compact Action Bar (Wide Details Button + 4 Square w-11 h-11 Icon Buttons) */}
      <div
        className={`px-4 pb-4 pt-2.5 border-t ${
          shop.isPro
            ? 'border-amber-500/25 bg-transparent'
            : 'border-slate-800/90 bg-slate-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenDetails(shop)}
            className="flex-1 h-11 rounded-xl font-bold flex items-center justify-center px-3 text-sm text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors whitespace-nowrap cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <span>التفاصيل</span>
          </button>

          <a
            href={`tel:${shop.phone}`}
            title="اتصال مباشر"
            aria-label={`اتصال مباشر بـ ${shop.name}`}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors active:scale-95"
          >
            <Phone className="w-4 h-4" />
          </a>

          <a
            href={`https://wa.me/${shop.whatsapp}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            title="واتساب"
            aria-label={`مراسلة ${shop.name} عبر واتساب`}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-teal-300 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 transition-colors active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
          </a>

          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="الاتجاهات"
            aria-label={`الاتجاهات إلى ${shop.name}`}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sky-300 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 transition-colors active:scale-95"
          >
            <Navigation className="w-4 h-4" />
          </a>

          <button
            type="button"
            onClick={() => void handleShareShop()}
            title={shareCopied ? 'تم نسخ الرابط!' : 'مشاركة المحل'}
            aria-label={shareCopied ? 'تم نسخ رابط المحل' : `مشاركة ${shop.name}`}
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors cursor-pointer active:scale-95 ${
              shareCopied
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700'
            }`}
          >
            {shareCopied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {shareCopied && (
          <p className="mt-1.5 text-[11px] font-bold text-emerald-400 text-center">
            تم نسخ رابط المحل المباشر!
          </p>
        )}
      </div>
    </article>
  );
}
