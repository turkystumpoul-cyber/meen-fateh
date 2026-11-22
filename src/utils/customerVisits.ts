import { CustomerShopRecord } from '../types';

const STORAGE_KEY = 'minFateh_customerVisits_v1';

type CustomerVisitsMap = Record<string, CustomerShopRecord>;

function readAllRecords(): CustomerVisitsMap {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CustomerVisitsMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllRecords(map: CustomerVisitsMap): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota issues gracefully
  }
}

export function getCustomerShopRecord(shopId: string): CustomerShopRecord {
  const all = readAllRecords();
  const existing = all[shopId];
  if (!existing) {
    return { visitsCount: 0, totalSpent: 0, entries: [] };
  }
  return {
    visitsCount: Number(existing.visitsCount) || 0,
    totalSpent: Number(existing.totalSpent) || 0,
    entries: Array.isArray(existing.entries) ? existing.entries : [],
  };
}

export function addCustomerShopVisit(
  shopId: string,
  amountPaid: number
): CustomerShopRecord {
  const safeAmount =
    Number.isFinite(amountPaid) && amountPaid >= 0
      ? Math.round(amountPaid * 100) / 100
      : 0;
  const all = readAllRecords();
  const current = all[shopId] ?? {
    visitsCount: 0,
    totalSpent: 0,
    entries: [],
  };

  const nextRecord: CustomerShopRecord = {
    visitsCount: (Number(current.visitsCount) || 0) + 1,
    totalSpent:
      Math.round(((Number(current.totalSpent) || 0) + safeAmount) * 100) / 100,
    entries: [
      {
        id: `visit-${Date.now()}`,
        amount: safeAmount,
        dateIso: new Date().toISOString(),
      },
      ...(Array.isArray(current.entries) ? current.entries : []),
    ].slice(0, 30),
  };

  all[shopId] = nextRecord;
  writeAllRecords(all);
  return nextRecord;
}
