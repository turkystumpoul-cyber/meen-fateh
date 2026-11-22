import { useEffect, useRef, useState } from 'react';
import {
  Crown,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  X,
} from 'lucide-react';
import { Shop, UserLocation } from '../types';

interface ShopMapViewProps {
  shops: Shop[];
  userLocation: UserLocation | null;
  isGpsActive: boolean;
}

interface LeafletLayerGroup {
  clearLayers: () => void;
  addTo: (map: LeafletMap) => LeafletLayerGroup;
}

interface LeafletMap {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  fitBounds: (bounds: [number, number][], options?: { padding: [number, number]; maxZoom?: number }) => void;
  remove: () => void;
}

interface LeafletMarker {
  addTo: (layer: LeafletLayerGroup) => LeafletMarker;
  bindPopup: (html: string, options?: { closeButton?: boolean; maxWidth?: number }) => LeafletMarker;
  on: (event: string, cb: () => void) => LeafletMarker;
}

interface LeafletGlobal {
  map: (el: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options?: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  layerGroup: () => LeafletLayerGroup;
  divIcon: (options: Record<string, unknown>) => unknown;
  marker: (coords: [number, number], options?: Record<string, unknown>) => LeafletMarker;
}

declare global {
  interface Window {
    L?: LeafletGlobal;
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function ShopMapView({
  shops,
  userLocation,
  isGpsActive,
}: ShopMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LeafletLayerGroup | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [leafletReady, setLeafletReady] = useState<boolean>(
    typeof window !== 'undefined' && Boolean(window.L)
  );

  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }

    const interval = window.setInterval(() => {
      if (window.L) {
        setLeafletReady(true);
        window.clearInterval(interval);
      }
    }, 150);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      const L = window.L;
      const map = L.map(mapContainerRef.current, {
        center: [29.265, 30.805],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersLayerRef.current = markersLayer;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, [leafletReady]);

  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || !markersLayerRef.current || !window.L) {
      return;
    }

    const L = window.L;
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    const boundsPoints: [number, number][] = [];

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'custom-gps-pin',
        html: `<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
          <span style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(14,165,233,0.3);animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>
          <span style="width:14px;height:14px;border-radius:9999px;background:#0284c7;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></span>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(layer)
        .bindPopup(
          `<div style="padding:10px 14px;font-weight:700;font-size:13px;">موقعك الحالي (GPS)</div>`
        );

      boundsPoints.push([userLocation.lat, userLocation.lng]);
    }

    shops.forEach((shop) => {
      const pinColor =
        shop.status === 'prayer'
          ? '#f59e0b'
          : shop.featured
            ? '#f59e0b'
            : shop.isOpen
              ? '#10b981'
              : '#f43f5e';
      const borderColor = shop.featured ? '#fef3c7' : '#ffffff';
      const badgeInner = shop.featured
        ? '★'
        : shop.isOpen
          ? ''
          : '';

      const icon = L.divIcon({
        className: 'custom-shop-pin',
        html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="width:30px;height:30px;border-radius:9999px;background:${pinColor};border:3px solid ${borderColor};box-shadow:0 4px 12px rgba(0,0,0,0.38);display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:800;font-size:13px;">
            ${badgeInner || `<span style="width:8px;height:8px;border-radius:9999px;background:#ffffff;display:block;"></span>`}
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${pinColor};margin-top:-2px;"></div>
        </div>`,
        iconSize: [30, 36],
        iconAnchor: [15, 36],
        popupAnchor: [0, -34],
      });

      const statusBadge =
        shop.status === 'prayer'
          ? `<span style="color:#f59e0b;font-weight:700;">● مغلق للصلاة 🕌</span>`
          : shop.isOpen
            ? `<span style="color:#10b981;font-weight:700;">● مفتوح الآن</span>`
            : `<span style="color:#f43f5e;font-weight:700;">● مغلق</span>`;

      const featuredTag = shop.featured
        ? `<span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;margin-bottom:4px;">★ مميز</span><br/>`
        : '';

      const waMsg = encodeURIComponent(
        `السلام عليكم، وجدت محلكم "${shop.name}" على خريطة مين فاتح دلوقتي؟`
      );

      const popupHtml = `
        <div style="padding:12px 14px;min-width:230px;line-height:1.5;">
          ${featuredTag}
          <div style="font-weight:800;font-size:14px;margin-bottom:4px;">${escapeHtml(shop.name)}</div>
          <div style="font-size:12px;margin-bottom:6px;">${statusBadge} · ${escapeHtml(shop.categoryLabel)}</div>
          <div style="font-size:12px;opacity:0.85;margin-bottom:10px;">${escapeHtml(shop.address)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <a href="tel:${escapeHtml(shop.phone)}" style="display:flex;align-items:center;justify-content:center;padding:7px 8px;border-radius:8px;background:#10b981;color:#ffffff;font-weight:700;font-size:12px;text-decoration:none;">اتصال</a>
            <a href="https://wa.me/${escapeHtml(shop.whatsapp)}?text=${waMsg}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;padding:7px 8px;border-radius:8px;background:#0f766e;color:#ffffff;font-weight:700;font-size:12px;text-decoration:none;">واتساب</a>
          </div>
        </div>
      `;

      const marker = L.marker([shop.lat, shop.lng], { icon })
        .addTo(layer)
        .bindPopup(popupHtml, { maxWidth: 280 });

      marker.on('click', () => {
        setSelectedShop(shop);
      });

      boundsPoints.push([shop.lat, shop.lng]);
    });

    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    } else if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, { padding: [45, 45], maxZoom: 15 });
    }
  }, [leafletReady, shops, userLocation]);

  useEffect(() => {
    if (selectedShop && !shops.some((s) => s.id === selectedShop.id)) {
      setSelectedShop(null);
    }
  }, [shops, selectedShop]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 border border-white inline-block" />
            <span>مميز</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white inline-block" />
            <span>مفتوح الآن</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 border border-white inline-block" />
            <span>مغلق</span>
          </span>
          {userLocation && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sky-600 border border-white inline-block" />
              <span>موقعك الحالي</span>
            </span>
          )}
        </div>
        <span>اضغط على أي دبوس لعرض التفاصيل والتواصل الفوري</span>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-200 dark:bg-slate-900">
        {!leafletReady && (
          <div className="h-[460px] sm:h-[540px] flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
            جاري تحميل خريطة الفيوم التفاعلية...
          </div>
        )}

        <div
          ref={mapContainerRef}
          className={`w-full h-[460px] sm:h-[540px] ${!leafletReady ? 'hidden' : 'block'}`}
        />

        {selectedShop && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-96 z-20 rounded-2xl p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  {selectedShop.featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-400/90 text-slate-950">
                      <Crown className="w-3 h-3" />
                      <span>مميز</span>
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${
                      selectedShop.status === 'prayer'
                        ? 'text-amber-600 dark:text-amber-400'
                        : selectedShop.isOpen
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <span>●</span>
                    <span>
                      {selectedShop.status === 'prayer'
                        ? 'مغلق للصلاة 🕌'
                        : selectedShop.isOpen
                          ? 'مفتوح الآن'
                          : 'مغلق'}
                    </span>
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300">
                    {selectedShop.distanceKm.toLocaleString('ar-EG', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{' '}
                    كم {isGpsActive ? '(فعلي)' : ''}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {selectedShop.name}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{selectedShop.address}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShop(null)}
                aria-label="إغلاق البطاقة المصغرة"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
              <a
                href={`tel:${selectedShop.phone}`}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 transition-colors whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>اتصال</span>
              </a>
              <a
                href={`https://wa.me/${selectedShop.whatsapp}?text=${encodeURIComponent(
                  `السلام عليكم، وجدت محلكم "${selectedShop.name}" على خريطة مين فاتح دلوقتي؟`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-2 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>واتساب</span>
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedShop.lat},${selectedShop.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
              >
                <Navigation className="w-3.5 h-3.5 shrink-0" />
                <span>الاتجاهات</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
