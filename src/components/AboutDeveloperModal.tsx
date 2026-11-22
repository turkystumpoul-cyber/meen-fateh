import { useState } from 'react';
import {
  Check,
  Code2,
  ExternalLink,
  FileText,
  Mail,
  Send,
  Share2,
  Shield,
  Star,
  X,
} from 'lucide-react';

interface AboutDeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LegalDocType = 'privacy' | 'terms' | null;

const DEVELOPER_EMAIL = 'jhgfc351@gmail.com';
const DEVELOPER_FACEBOOK_URL = 'https://www.facebook.com/share/1Erx2asJpW/';
const SUPPORT_MAILTO_URL = `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(
  'دعم تطبيق مين فاتح دلوقتي'
)}`;

const RATING_LABELS: Record<number, string> = {
  1: 'ضعيف جداً',
  2: 'مقبول',
  3: 'جيد',
  4: 'جيد جداً',
  5: 'ممتاز',
};

export function AboutDeveloperModal({
  isOpen,
  onClose,
}: AboutDeveloperModalProps) {
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [ratingNote, setRatingNote] = useState('');
  const [ratingSent, setRatingSent] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType>(null);

  if (!isOpen) return null;

  const copyFallback = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback below
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const handleShareApp = async () => {
    const shareUrl =
      typeof window !== 'undefined' ? window.location.origin : '';
    const shareData = {
      title: 'مين فاتح دلوقتي؟',
      text: 'تطبيق "مين فاتح دلوقتي؟" — اعرف المحلات والخدمات المتاحة وتواصل فوراً بخصوصية وسرعة.',
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    const copied = await copyFallback(shareUrl);
    if (copied) {
      setShareFeedback('تم نسخ الرابط');
      window.setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  const ratingSubject = encodeURIComponent(
    `تقييم تطبيق مين فاتح دلوقتي (${ratingStars} من 5 نجوم)`
  );
  const ratingBody = encodeURIComponent(
    `التقييم: ${ratingStars} / 5 نجوم (${RATING_LABELS[ratingStars] ?? ''})\n\nملاحظات المستخدم:\n${
      ratingNote.trim() || 'لا توجد ملاحظات إضافية.'
    }\n\nإصدار التطبيق: v1.0.0`
  );
  const ratingMailtoHref = `mailto:${DEVELOPER_EMAIL}?subject=${ratingSubject}&body=${ratingBody}`;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-developer-title"
      >
        <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                <Code2 className="w-5 h-5" />
              </div>
              <h2
                id="about-developer-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white"
              >
                حول المطور
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة حول المطور"
              className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            {/* 1. بطاقة تعريف المطور */}
            <section
              aria-label="بطاقة تعريف المطور"
              className="rounded-2xl p-5 bg-gradient-to-br from-slate-50 to-emerald-50/50 dark:from-slate-950 dark:to-emerald-950/25 border border-slate-200 dark:border-slate-800 text-center space-y-3"
            >
              <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 dark:from-emerald-500 dark:to-teal-400 text-white dark:text-slate-950 flex items-center justify-center shadow-md ring-4 ring-emerald-500/15">
                <Code2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h3
                  dir="ltr"
                  className="text-sm sm:text-base font-extrabold tracking-wide text-slate-900 dark:text-white leading-snug"
                >
                  AHMED ABDELTAWAB ABDELRAZEK HASSAN
                </h3>
                <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  مطور تطبيقات الويب والموبايل
                </p>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
                تم تطوير تطبيق &quot;مين فاتح دلوقتي&quot; لتسهيل معرفة المتاحين والتواصل الفوري بين الأصدقاء بخصوصية وسرعة.
              </p>
            </section>

            {/* 2. أزرار التواصل والدعم الفني */}
            <section aria-label="التواصل والدعم الفني" className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 px-1">
                التواصل والدعم الفني
              </h4>

              <div className="grid grid-cols-1 gap-2.5">
                <a
                  href={SUPPORT_MAILTO_URL}
                  className="min-h-[46px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-slate-950 transition-colors shadow-sm"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>مراسلة عبر البريد الإلكتروني (دعم / اقتراحات)</span>
                </a>

                <a
                  href={DEVELOPER_FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[46px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#1877F2] hover:bg-[#166FE5] transition-colors shadow-sm"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>حساب المطور على فيسبوك</span>
                </a>
              </div>
            </section>

            {/* 3. أزرار التفاعل والتحديثات */}
            <section aria-label="التفاعل والتحديثات" className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 px-1">
                التفاعل والتحديثات
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleShareApp()}
                  className="min-h-[46px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  {shareFeedback ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {shareFeedback}
                      </span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>مشاركة التطبيق</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRatingSent(false);
                    setIsRatingModalOpen(true);
                  }}
                  className="min-h-[46px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shadow-sm"
                >
                  <Star className="w-4 h-4 fill-slate-950 shrink-0" />
                  <span>تقييم التطبيق</span>
                </button>
              </div>
            </section>
          </div>

          {/* 4. التذييل والجانب القانوني (Footer) */}
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs shrink-0">
            <span className="font-bold text-slate-600 dark:text-slate-400 tabular-nums">
              الإصدار v1.0.0
            </span>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveLegalDoc('privacy')}
                className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer py-1"
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>سياسة الخصوصية</span>
              </button>

              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                |
              </span>

              <button
                type="button"
                onClick={() => setActiveLegalDoc('terms')}
                className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer py-1"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>شروط الاستخدام</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Modal: تقييم التطبيق بالنجوم */}
      {isRatingModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rate-app-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3
                id="rate-app-title"
                className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <Star className="w-5 h-5 text-amber-500 fill-amber-400 shrink-0" />
                <span>تقييم التطبيق</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsRatingModalOpen(false)}
                aria-label="إغلاق نافذة التقييم"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-center">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                اختر تقييمك لتطبيق &quot;مين فاتح دلوقتي&quot; من 1 إلى 5 نجوم:
              </p>
              <div
                dir="ltr"
                className="flex items-center justify-center gap-2 py-2"
                role="radiogroup"
                aria-label="التقييم بالنجوم"
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const selected = star <= ratingStars;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingStars(star)}
                      aria-label={`${star} نجوم`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-transform active:scale-95 cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 transition-colors ${
                          selected
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {ratingStars} / 5 — {RATING_LABELS[ratingStars]}
              </p>
            </div>

            <div>
              <label
                htmlFor="app-rating-note"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                ملاحظاتك أو اقتراحاتك (اختياري)
              </label>
              <textarea
                id="app-rating-note"
                rows={3}
                value={ratingNote}
                onChange={(e) => setRatingNote(e.target.value)}
                placeholder="اكتب رأيك في التطبيق أو أي ميزة تود إضافتها..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {ratingSent && (
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-2.5 text-center">
                شكراً لتقييمك! تم فتح تطبيق البريد لإرسال ملاحظاتك إلى المطور.
              </p>
            )}

            <div className="flex gap-2.5">
              <a
                href={ratingMailtoHref}
                onClick={() => setRatingSent(true)}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-slate-950 transition-colors shadow-sm"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>إرسال التقييم لبريد المطور</span>
              </a>
              <button
                type="button"
                onClick={() => setIsRatingModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal: سياسة الخصوصية / شروط الاستخدام */}
      {activeLegalDoc && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-doc-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
              <h3
                id="legal-doc-title"
                className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2"
              >
                {activeLegalDoc === 'privacy' ? (
                  <>
                    <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>سياسة الخصوصية — مين فاتح دلوقتي</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>شروط الاستخدام — مين فاتح دلوقتي</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setActiveLegalDoc(null)}
                aria-label="إغلاق"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
              {activeLegalDoc === 'privacy' ? (
                <>
                  <p className="font-bold text-slate-900 dark:text-white">
                    نحن نحترم خصوصيتك في تطبيق &quot;مين فاتح دلوقتي&quot; ونلتزم بحماية بياناتك بالكامل:
                  </p>
                  <ul className="list-disc list-inside space-y-2">
                    <li>
                      <span className="font-bold text-slate-900 dark:text-white">
                        حماية حالة الاتصال والتوافر:
                      </span>{' '}
                      تُستخدم حالة الاتصال والتوافر (مفتوح / متاح الآن) فقط لإظهار الجاهزية الفورية للمستخدمين والأصدقاء، ولا يتم تتبع نشاطك الشخصي خارج نطاق التطبيق.
                    </li>
                    <li>
                      <span className="font-bold text-slate-900 dark:text-white">
                        الموقع الجغرافي (GPS):
                      </span>{' '}
                      يُستخدم اختيارياً وبإذنك المباشر لحساب المسافات وترتيب الأماكن الأقرب إليك لحظياً على جهازك دون بيع أو مشاركة موقعك مع أي جهة تسويقية.
                    </li>
                    <li>
                      <span className="font-bold text-slate-900 dark:text-white">
                        بيانات الحساب والإشعارات:
                      </span>{' '}
                      تُحفظ بيانات المسجلين بأمان عبر خدمات موثوقة، وتُستخدم الإشعارات حصراً للتنبيه الفوري بالطلبات أو التحديثات المطلوبة دون أي إزعاج.
                    </li>
                    <li>
                      <span className="font-bold text-slate-900 dark:text-white">
                        سجل المصروفات والزيارات المحلي:
                      </span>{' '}
                      يتم حفظ سجل زياراتك ومصروفاتك محلياً على متصفحك الخاص ولا يطلع عليه أي طرف آخر.
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-900 dark:text-white">
                    باستخدامك لتطبيق &quot;مين فاتح دلوقتي&quot; فإنك توافق على الشروط المبسطة التالية:
                  </p>
                  <ul className="list-disc list-inside space-y-2">
                    <li>
                      <span className="font-bold text-slate-900 dark:text-white">
                        دقة حالة التوافر والاتصال:
                      </span>{' '}
                      يلتزم أصحاب المحلات والمشاركون بتحديث حالة التوافر (مفتوح / مغلق) وبيانات التواصل بصدق لتسهيل الوصول السريع عند الحاجة.
                    </li>
                    <li>
                      <span className="font-bold text-slate-900 dark:text-white">
                        الاستخدام المسؤول واحترام الخصوصية:
                      </span>{' '}
                      يُحظر استخدام أرقام الهواتف أو ميزة التنبيه الفوري بغرض الإزعاج أو نشر بيانات وهمية أو مضللة.
                    </li>
                    <li>
                      <span className="font-bold text-slate-900 dark:text-white">
                        الإدارة والمراجعة:
                      </span>{' '}
                      تحتفظ إدارة التطبيق بحق مراجعة الحسابات وتجميد أي حساب يثبت مخالفته للمصداقية حفاظاً على موثوقية الخدمة للجميع.
                    </li>
                    <li>
                      <span className="font-bold text-slate-900 dark:text-white">
                        الدعم والتعديلات:
                      </span>{' '}
                      في حال وجود أي استفسار أو طلب حذف بيانات، يمكنك التواصل مباشرة مع المطور عبر البريد الإلكتروني{' '}
                      <span dir="ltr" className="font-bold text-emerald-700 dark:text-emerald-400">
                        {DEVELOPER_EMAIL}
                      </span>
                      .
                    </li>
                  </ul>
                </>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
              <button
                type="button"
                onClick={() => setActiveLegalDoc(null)}
                className="w-full min-h-[42px] rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 transition-colors cursor-pointer"
              >
                فهمت، إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
