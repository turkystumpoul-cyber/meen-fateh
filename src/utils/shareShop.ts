import { Shop } from '../types';

export function buildShopDeepLink(shopId: string): string {
  if (typeof window === 'undefined') {
    return `?shop=${encodeURIComponent(shopId)}`;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('shop', shopId);
  return url.toString();
}

export function buildShopWhatsAppShareUrl(shop: Shop): string {
  const link = buildShopDeepLink(shop.id);
  const statusText =
    shop.status === 'prayer'
      ? 'مغلق للصلاة 🕌 (سيعود خلال دقائق)'
      : shop.isOpen
        ? 'مفتوح الآن 🟢'
        : 'مغلق حالياً 🔴';
  const proText = shop.isPro ? ' (حساب PRO 👑)' : '';
  const text = `شاهد محل "${shop.name}"${proText} على تطبيق مين فاتح دلوقتي؟\nالتخصص: ${shop.categoryLabel} · ${shop.area}\nالحالة: ${statusText}\nالعنوان: ${shop.address}\n\nافتح تفاصيل المحل والعروض مباشرة:\n${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function copyShopDeepLink(shopId: string): Promise<string> {
  const link = buildShopDeepLink(shopId);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(link);
      return link;
    } catch {
      // Fallback below
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = link;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
  return link;
}
