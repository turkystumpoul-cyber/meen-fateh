import { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'hero' | 'banner';
}

export function PWAInstallButton({ variant = 'hero' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'unavailable') {
        setShowGuideModal(true);
      }
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className="mt-8 rounded-2xl p-4 sm:p-5 bg-gradient-to-l from-emerald-600/15 via-emerald-500/10 to-sky-500/10 dark:from-emerald-500/15 dark:via-slate-900 dark:to-sky-500/10 border border-emerald-300/70 dark:border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3.5">
          <div className="flex items-center gap-3 text-center sm:text-right">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                ثبّت &quot;مين فاتح دلوقتي؟&quot; كتطبيق على شاشة هاتفك
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                وصول سريع بضغطة واحدة للطوارئ ليلاً حتى مع ضعف الإنترنت.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleClick()}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-slate-950 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>تثبيت التطبيق على هاتفك 📲</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleClick()}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-800 dark:text-white bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
        >
          <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>تثبيت التطبيق على هاتفك 📲</span>
        </button>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3
                  id="pwa-guide-title"
                  className="text-base font-extrabold text-slate-900 dark:text-white"
                >
                  تثبيت التطبيق على هاتفك 📲
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="إغلاق"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <p className="font-semibold">لتثبيت التطبيق على أجهزة iPhone و iPad:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm">
                  <li className="flex items-center gap-1.5">
                    <span>1. اضغط على زر المشاركة</span>
                    <Share className="w-4 h-4 text-sky-500 inline shrink-0" />
                    <span>في شريط متصفح Safari.</span>
                  </li>
                  <li>2. اختر &quot;إضافة إلى الشاشة الرئيسية&quot; (Add to Home Screen).</li>
                  <li>3. اضغط &quot;إضافة&quot; لتظهر أيقونة التطبيق مباشرة على جهازك.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <p className="font-semibold">
                  لإضافة أيقونة &quot;مين فاتح دلوقتي؟&quot; إلى الشاشة الرئيسية:
                </p>
                <ol className="space-y-1.5">
                  <li>1. افتح قائمة المتصفح (النقاط الثلاث ⋮ في الأعلى).</li>
                  <li>2. اختر &quot;تثبيت التطبيق&quot; (Install App) أو &quot;الإضافة إلى الشاشة الرئيسية&quot;.</li>
                  <li>3. افتح الرابط مباشرة في علامة تبويب مستقلة إذا كنت تتصفحه من داخل تطبيق آخر.</li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 transition-colors cursor-pointer"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
}
