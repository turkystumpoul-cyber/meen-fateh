import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Footprints,
  Loader2,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import { createIncomingVisitInFirestore } from '../services/firebase';
import { Shop } from '../types';

interface OnTheWayModalProps {
  shop: Shop | null;
  onClose: () => void;
}

export function OnTheWayModal({ shop, onClose }: OnTheWayModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentWaUrl, setSentWaUrl] = useState<string | null>(null);
  const [firestoreWarning, setFirestoreWarning] = useState<string | null>(null);

  useEffect(() => {
    setCustomerName('');
    setCustomerNote('');
    setIsSending(false);
    setSentWaUrl(null);
    setFirestoreWarning(null);
  }, [shop?.id]);

  if (!shop || !shop.isPro) return null;

  const buildWhatsAppUrl = () => {
    const namePart = customerName.trim()
      ? `\nالاسم: ${customerName.trim()}`
      : '';
    const notePart = customerNote.trim()
      ? `\nطلبي/استفساري: ${customerNote.trim()}`
      : '';

    const message = `السلام عليكم، أنا في الطريق لمحلكم (${shop.name}) الآن عبر تطبيق (مين فاتح دلوقتي؟) 🚶‍♂️${namePart}${notePart}`;
    return `https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(message)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setFirestoreWarning(null);

    const waUrl = buildWhatsAppUrl();

    try {
      await createIncomingVisitInFirestore({
        shopId: shop.id,
        shopName: shop.name,
        ownerId: shop.ownerId,
        customerName: customerName.trim() || 'عميل في الطريق',
        customerNote: customerNote.trim(),
      });
    } catch (err) {
      console.warn('Could not save incoming visit to Firestore:', err);
      setFirestoreWarning(
        'تم تجهيز إشعار واتساب المباشر للمحل (تعذر الحفظ السحابي المؤقت).'
      );
    } finally {
      setIsSending(false);
      setSentWaUrl(waUrl);

      // Trigger WhatsApp navigation via anchor element (sandbox-safe, avoids window.open)
      const link = document.createElement('a');
      link.href = waUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="on-the-way-title"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
              <Footprints className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2
                  id="on-the-way-title"
                  className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white"
                >
                  أنا جايلك في الطريق 🚶‍♂️
                </h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-400 text-slate-950">
                  <Crown className="w-3 h-3" />
                  PRO
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[230px]">
                إلى: {shop.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {sentWaUrl ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  تم إرسال الإشعار للمحل بنجاح!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  ظهر طلبك الآن في لوحة صاحب المحل وتم توجيهك لواتساب لضمان سرعة الاستقبال.
                </p>
                {firestoreWarning && (
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {firestoreWarning}
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <a
                  href={sentWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>فتح محادثة واتساب مع المحل</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full min-h-[44px] rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                أبلغ صاحب المحل أنك قادم الآن ليجهز لك طلبك أو ينتظرك قبل الإغلاق (سيتم تسجيل التنبيه في لوحة المحل وفتح واتساب مباشرة).
              </p>

              <div>
                <label
                  htmlFor="otw-name"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  اسمك (اختياري)
                </label>
                <input
                  id="otw-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label
                  htmlFor="otw-note"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  طلبك أو استفسارك السريع (اختياري)
                </label>
                <textarea
                  id="otw-note"
                  rows={3}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="مثال: هل متوفر دواء كذا؟ أو قادم لتصليح كاوتش بعد 10 دقائق..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {isSending ? 'جاري الإبلاغ...' : 'إرسال وإبلاغ المحل'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
