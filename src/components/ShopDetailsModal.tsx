import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Crown,
  Footprints,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  Receipt,
  Share2,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { CustomerShopRecord, Shop } from '../types';
import {
  addCustomerShopVisit,
  getCustomerShopRecord,
} from '../utils/customerVisits';
import {
  buildShopWhatsAppShareUrl,
  copyShopDeepLink,
} from '../utils/shareShop';

interface ShopDetailsModalProps {
  shop: Shop | null;
  onClose: () => void;
  onOpenOnTheWay: (shop: Shop) => void;
}

export function ShopDetailsModal({
  shop,
  onClose,
  onOpenOnTheWay,
}: ShopDetailsModalProps) {
  const [visitRecord, setVisitRecord] = useState<CustomerShopRecord>({
    visitsCount: 0,
    totalSpent: 0,
    entries: [],
  });
  const [showAddVisitForm, setShowAddVisitForm] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [visitSavedFlash, setVisitSavedFlash] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!shop) return;
    setVisitRecord(getCustomerShopRecord(shop.id));
    setShowAddVisitForm(false);
    setAmountInput('');
    setVisitSavedFlash(false);
    setShareCopied(false);
  }, [shop]);

  if (!shop) return null;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;
  const whatsappMessage = encodeURIComponent(
    `السلام عليكم، وجدت محلكم "${shop.name}" على تطبيق مين فاتح دلوقتي؟ وأحتاج استفساراً سريعاً.`
  );
  const firstOffer =
    shop.isPro && shop.offers && shop.offers.length > 0 ? shop.offers[0] : null;
  const activeOfferTitle = shop.isPro
    ? shop.activeOffer || shop.offerText || firstOffer?.title || ''
    : '';
  const activeOfferDetails =
    firstOffer?.discountNote ||
    (firstOffer
      ? `السعر بعد العرض: ${firstOffer.priceAfter.toLocaleString('ar-EG')} جنيه${
          typeof firstOffer.priceBefore === 'number' &&
          firstOffer.priceBefore > firstOffer.priceAfter
            ? ` (بدلاً من ${firstOffer.priceBefore.toLocaleString('ar-EG')} جنيه)`
            : ''
        }`
      : '');
  const offerWhatsAppUrl = activeOfferTitle
    ? `https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(
        `السلام عليكم، أرغب في الاستفادة من العرض الخاص "${activeOfferTitle}" المعلن في محلكم "${shop.name}" على تطبيق مين فاتح دلوقتي؟`
      )}`
    : '';

  const handleSaveNewVisit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(amountInput);
    const safeAmount = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const updated = addCustomerShopVisit(shop.id, safeAmount);
    setVisitRecord(updated);
    setAmountInput('');
    setShowAddVisitForm(false);
    setVisitSavedFlash(true);
    window.setTimeout(() => setVisitSavedFlash(false), 2600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-details-title"
    >
      <div
        className={`w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[92vh] flex flex-col shadow-2xl border ${
          shop.isPro
            ? 'bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border-amber-400/60 shadow-amber-500/15'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        {/* 1. Panoramic Hero Header (h-44) */}
        <div className="relative h-44 w-full bg-slate-950 shrink-0 overflow-hidden">
          {shop.imageUrl ? (
            <img
              src={shop.imageUrl}
              alt={shop.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-900/40 via-slate-900 to-slate-950 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-400">
                {shop.categoryLabel}
              </span>
            </div>
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"
          />

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق تفاصيل المحل"
            className="absolute top-3 left-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-slate-950/75 hover:bg-slate-950 text-white backdrop-blur-md border border-white/20 cursor-pointer transition-colors shadow-md"
          >
            <X className="w-5 h-5" />
          </button>

          {shop.featured && (
            <div className="absolute top-3 right-3 z-10">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-400/95 text-slate-950 shadow-sm">
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span>مميز ⭐</span>
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Storefront Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Title + PRO Partner Badge + Live Dynamic Status Badge */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="shop-details-title"
                  className={`text-2xl font-extrabold leading-snug ${
                    shop.isPro ? 'pro-gold-title' : 'text-white'
                  }`}
                >
                  {shop.name}
                </h2>

                {shop.isPro && (
                  <div className="inline-flex items-center gap-1.5 shrink-0">
                    <span aria-hidden="true" className="text-lg leading-none">
                      👑
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950 shadow-sm whitespace-nowrap">
                      شريك معتمد PRO
                    </span>
                  </div>
                )}
              </div>
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
                    : 'مغلق حالياً'}
              </span>
            </span>
          </div>

          {/* 2. Structured Info & Live Status Box */}
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                {shop.categoryLabel}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900/90 text-slate-200 border border-slate-700">
                {shop.area}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums bg-sky-500/15 text-sky-300 border border-sky-500/25">
                <Navigation className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {shop.distanceKm.toLocaleString('ar-EG', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{' '}
                  كم
                </span>
              </span>
            </div>

            <p className="flex items-start gap-2 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>{shop.address}</span>
            </p>

            {shop.services.length > 0 && (
              <p className="text-xs text-slate-400 leading-relaxed">
                الخدمات المتوفرة: {shop.services.join(' · ')}
              </p>
            )}

            <p
              className={`flex items-center gap-2 text-xs sm:text-sm font-bold pt-1 border-t border-slate-700/60 ${
                shop.status === 'prayer'
                  ? 'text-amber-300'
                  : shop.isOpen
                    ? 'text-emerald-400'
                    : 'text-rose-400'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                {shop.status === 'prayer'
                  ? 'مغلق مؤقتاً لأداء الصلاة 🕌 (سيعود للعمل خلال دقائق)'
                  : shop.isOpen
                    ? 'مفتوح الآن 🟢'
                    : 'مغلق حالياً 🔴'}
              </span>
              {shop.status !== 'prayer' &&
                shop.hoursNote &&
                !shop.hoursNote.includes('مفتوح الآن') && (
                  <span className="font-medium text-slate-400">
                    ({shop.hoursNote})
                  </span>
                )}
            </p>
          </div>

          {/* 3. VIP Exclusive PRO Offer Card */}
          {shop.isPro && activeOfferTitle && (
            <div className="border-2 border-dashed border-amber-400/70 bg-amber-950/25 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-extrabold text-amber-300 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>عرض حصري من شريك PRO 👑</span>
                  </p>
                  <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug">
                    🎁 {activeOfferTitle}
                  </h3>
                  {activeOfferDetails && (
                    <p className="text-xs sm:text-sm font-semibold text-amber-200/90">
                      {activeOfferDetails}
                    </p>
                  )}
                </div>
              </div>

              <a
                href={offerWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-11 rounded-xl font-extrabold text-xs sm:text-sm text-slate-950 bg-gradient-to-l from-amber-300 via-amber-400 to-yellow-400 hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>استفد من العرض عبر واتساب 🎁</span>
              </a>
            </div>
          )}

          {/* 4. Quick Contact Bar (4 equal h-11 buttons) + Wide On-The-Way PRO Button */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <a
                href={`tel:${shop.phone}`}
                className="h-11 rounded-xl flex items-center justify-center gap-1.5 px-3 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors whitespace-nowrap"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span>اتصال مباشر</span>
              </a>

              <a
                href={`https://wa.me/${shop.whatsapp}?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 rounded-xl flex items-center justify-center gap-1.5 px-3 text-xs font-bold text-teal-300 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>واتساب</span>
              </a>

              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 rounded-xl flex items-center justify-center gap-1.5 px-3 text-xs font-bold text-sky-300 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 transition-colors whitespace-nowrap"
              >
                <Navigation className="w-4 h-4 shrink-0" />
                <span>الاتجاهات</span>
              </a>

              <button
                type="button"
                onClick={async () => {
                  await copyShopDeepLink(shop.id);
                  setShareCopied(true);
                  window.setTimeout(() => setShareCopied(false), 3000);
                }}
                className={`h-11 rounded-xl flex items-center justify-center gap-1.5 px-3 text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                  shareCopied
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                }`}
              >
                {shareCopied ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 shrink-0" />
                    <span>مشاركة رابط المحل</span>
                  </>
                )}
              </button>
            </div>

            {shop.isPro && (
              <button
                type="button"
                onClick={() => onOpenOnTheWay(shop)}
                className="w-full h-12 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-l from-amber-300 via-amber-400 to-yellow-400 hover:brightness-105 transition-all cursor-pointer shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Footprints className="w-4 h-4 shrink-0" />
                <span>أنا جايلك في الطريق 🏃‍♂️</span>
              </button>
            )}

            <div className="flex items-center justify-between gap-2 text-[11px]">
              <a
                href={buildShopWhatsAppShareUrl(shop)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-emerald-400 hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>أو شارك بطاقة المحل عبر واتساب</span>
              </a>
              {shareCopied && (
                <span className="font-bold text-emerald-400">
                  تم نسخ الرابط المباشر!
                </span>
              )}
            </div>
          </div>

          {/* PRO Multi-Offer Products Grid Showcase (preserved when offers > 0) */}
          {shop.isPro && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-extrabold text-white inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>المنتجات والعروض الحصرية (PRO 👑)</span>
                </h3>
                {shop.offers && shop.offers.length > 0 && (
                  <span className="text-xs font-bold text-amber-400 tabular-nums">
                    {shop.offers.length} عروض متاحة
                  </span>
                )}
              </div>

              {shop.offers && shop.offers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shop.offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-2xl overflow-hidden bg-slate-950/90 border border-amber-500/35 flex flex-col"
                    >
                      {offer.imageUrl ? (
                        <img
                          src={offer.imageUrl}
                          alt={offer.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-32 object-cover bg-slate-800"
                        />
                      ) : (
                        <div className="w-full h-24 bg-gradient-to-br from-amber-950/40 via-slate-900 dark:to-slate-950 flex items-center justify-center text-amber-400">
                          <Tag className="w-7 h-7" />
                        </div>
                      )}

                      <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-sm font-extrabold text-white leading-snug">
                            {offer.title}
                          </h4>
                          {offer.discountNote && (
                            <p className="text-xs font-bold text-amber-400 mt-0.5">
                              {offer.discountNote}
                            </p>
                          )}
                        </div>

                        <div className="flex items-baseline gap-2 pt-1 tabular-nums">
                          <span className="text-base font-extrabold text-emerald-400">
                            {offer.priceAfter.toLocaleString('ar-EG')} جنيه
                          </span>
                          {typeof offer.priceBefore === 'number' &&
                            offer.priceBefore > offer.priceAfter && (
                              <span className="text-xs text-slate-400 line-through">
                                {offer.priceBefore.toLocaleString('ar-EG')} جنيه
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !activeOfferTitle && (
                  <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 text-center text-xs text-slate-400">
                    لم يضف المحل عروضاً جديدة حالياً — يمكنك استخدام زر &quot;أنا جايلك في الطريق&quot; للاستفسار السريع.
                  </div>
                )
              )}
            </div>
          )}

          {/* 5. Visit & Expense Tracker */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold text-white">
                  سجل زياراتي ومصروفاتي هنا
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAddVisitForm((prev) => !prev)}
                className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تسجيل زيارة / فاتورة جديدة +</span>
              </button>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60 text-xs sm:text-sm font-bold text-slate-200 tabular-nums">
              عدد زياراتك لهذا المحل:{' '}
              <span className="text-sky-400">
                {visitRecord.visitsCount.toLocaleString('ar-EG')} مرة
              </span>{' '}
              <span className="mx-1.5 text-slate-500">|</span>
              إجمالي ما صرفته هنا:{' '}
              <span className="text-emerald-400">
                {visitRecord.totalSpent.toLocaleString('ar-EG')} جنيه
              </span>
            </div>

            {visitSavedFlash && (
              <p className="text-xs font-bold text-emerald-400">
                تم حفظ الزيارة والفاتورة في سجل هاتفك بنجاح!
              </p>
            )}

            {showAddVisitForm && (
              <form
                onSubmit={handleSaveNewVisit}
                className="flex flex-col sm:flex-row gap-2 pt-1"
              >
                <input
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="المبلغ المدفوع بالجنيه (مثال: 150)"
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
                <button
                  type="submit"
                  className="min-h-[42px] px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer shrink-0"
                >
                  حفظ الفاتورة
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
