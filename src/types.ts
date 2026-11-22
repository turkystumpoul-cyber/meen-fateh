export type ShopCategory =
  | 'all'
  | 'pharmacy'
  | 'clinic'
  | 'labs'
  | 'restaurant'
  | 'cafe'
  | 'supermarket'
  | 'bakery'
  | 'butcher'
  | 'produce'
  | 'mobile_repair'
  | 'computer_print'
  | 'auto_parts'
  | 'plumbing_electrical'
  | 'appliances_ac'
  | 'barber'
  | 'beauty_salon'
  | 'clothing'
  | 'laundry'
  | 'payments_telecom'
  | 'other';

export type GovernorateName =
  | 'الفيوم'
  | 'بني سويف'
  | 'المنيا'
  | 'أسيوط'
  | 'سوهاج'
  | 'قنا'
  | 'الأقصر'
  | 'أسوان'
  | 'الجيزة'
  | 'القاهرة'
  | 'القليوبية'
  | 'المنوفية'
  | 'الغربية'
  | 'الشرقية'
  | 'الدقهلية'
  | 'البحيرة'
  | 'كفر الشيخ'
  | 'دمياط'
  | 'الإسكندرية'
  | 'الإسماعيلية'
  | 'السويس'
  | 'بورسعيد'
  | 'البحر الأحمر'
  | 'الوادي الجديد'
  | 'مطروح'
  | 'شمال سيناء'
  | 'جنوب سيناء';

export interface ShopOffer {
  id: string;
  title: string;
  priceBefore?: number;
  priceAfter: number;
  discountNote?: string;
  imageUrl?: string;
  createdAt?: string;
}

export interface Shop {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  name: string;
  category: Exclude<ShopCategory, 'all'>;
  categoryLabel: string;
  governorate: GovernorateName | string;
  center: string;
  village: string;
  area: string;
  address: string;
  distanceKm: number;
  lat: number;
  lng: number;
  imageUrl?: string;
  isOpen: boolean;
  hoursNote: string;
  featured: boolean;
  isPro?: boolean;
  offers?: ShopOffer[];
  activeOffer?: string;
  offerText?: string;
  status?: string;
  suspensionReason?: string;
  lastUpdated?: string;
  createdAtMs?: number;
  lastUpdatedMs?: number;
  phone: string;
  whatsapp: string;
  services: string[];
}

export interface IncomingVisit {
  id: string;
  shopId: string;
  shopName?: string;
  ownerId?: string;
  customerName: string;
  customerNote: string;
  status: 'active' | 'handled';
  createdAtMs: number;
  createdAtLabel: string;
}

export interface CustomerShopExpenseEntry {
  id: string;
  amount: number;
  dateIso: string;
}

export interface CustomerShopRecord {
  visitsCount: number;
  totalSpent: number;
  entries: CustomerShopExpenseEntry[];
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}
