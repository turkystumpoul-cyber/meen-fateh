import { Code2, LogOut, MapPin, Moon, ShieldCheck, Store, Sun } from 'lucide-react';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  locationLabel: string;
  ownerEmail?: string | null;
  isAdmin?: boolean;
  showOwnerDashboardButton?: boolean;
  incomingVisitsCount?: number;
  onFocusAreaSelect: () => void;
  onOpenOwnerModal: () => void;
  onOpenAdminModal: () => void;
  onOpenAboutModal?: () => void;
  onLogout: () => void;
}

export function Header({
  isDark,
  onToggleTheme,
  locationLabel,
  ownerEmail,
  isAdmin = false,
  showOwnerDashboardButton = true,
  incomingVisitsCount = 0,
  onFocusAreaSelect,
  onOpenOwnerModal,
  onOpenAdminModal,
  onOpenAboutModal,
  onLogout,
}: HeaderProps) {
  const isLoggedIn = Boolean(ownerEmail);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/90 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 sm:gap-x-2.5 gap-y-2.5">
        {/* الصف الأول يميناً: شعار واسم التطبيق كاملاً بوضوح */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 sm:w-5 sm:h-5"
            >
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15.5 14" />
            </svg>
          </div>
          <a
            href="#top"
            className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            مين فاتح دلوقتي؟
          </a>
        </div>

        {/* الصف الأول يساراً: زر المنطقة (ديسكتوب) + زر الوضع الليلي/النهاري (+ زر الدخول قبل تسجيل الدخول) */}
        <div
          className={`flex items-center gap-1.5 sm:gap-2.5 shrink-0 ${
            isLoggedIn ? 'sm:ms-auto' : ''
          }`}
        >
          <button
            type="button"
            onClick={onFocusAreaSelect}
            className="hidden md:inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="تغيير المحافظة أو المركز أو القرية"
          >
            <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate max-w-[130px] lg:max-w-[155px]">
              {locationLabel}
            </span>
          </button>

          {onOpenAboutModal && (
            <button
              type="button"
              onClick={onOpenAboutModal}
              className="hidden md:inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="حول المطور"
            >
              <Code2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>حول المطور</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            className="min-h-[42px] min-w-[42px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shrink-0"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700" />
            )}
          </button>

          {!isLoggedIn && (
            <button
              type="button"
              onClick={onOpenOwnerModal}
              className="min-h-[42px] sm:min-h-[44px] inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              <Store className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">دخول أصحاب المحلات</span>
              <span className="sm:hidden">أصحاب المحلات</span>
            </button>
          )}
        </div>

        {/* الصف الثاني على الموبايل (يظهر فقط عند تسجيل الدخول): أزرار التحكم موزعة بتناسق */}
        {isLoggedIn && (
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 sm:border-t-0 sm:pt-0 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdminModal}
                className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">لوحة الإدارة (Admin)</span>
                <span className="sm:hidden">
                  {showOwnerDashboardButton ? 'الإدارة' : 'لوحة الإدارة'}
                </span>
              </button>
            )}

            {showOwnerDashboardButton && (
              <button
                type="button"
                onClick={onOpenOwnerModal}
                className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-slate-950 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
              >
                <Store className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">لوحة تحكم محلي</span>
                <span className="sm:hidden">لوحة محلي</span>
                {incomingVisitsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-400 text-slate-950 tabular-nums">
                    {incomingVisitsCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
              className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-[44px] sm:min-w-[44px] px-2.5 sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="sm:hidden">تسجيل خروج</span>
              <span className="hidden lg:inline">خروج</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
