export const formatRp = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `Rp ${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}M`;
  if (abs >= 1000) return `Rp ${Math.round(abs / 1000)}K`;
  return `Rp ${abs}`;
};

import type { Currency } from '../data/wallet';
import { CURRENCY_RATES_TO_IDR } from '../data/wallet';

import { CURRENCY_SYMBOLS } from '../data/wallet';

// Convert a place cost (stored in IDR) to the given currency and format it.
export function formatCost(amountIDR: number, currency: Currency): string {
  if (currency === 'IDR') return formatRp(amountIDR);
  const rate = CURRENCY_RATES_TO_IDR[currency] ?? 1;
  const converted = amountIDR / rate;
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  if (currency === 'JPY' || currency === 'KRW') return `${sym}${Math.round(converted).toLocaleString()}`;
  return `${sym}${converted < 1 ? converted.toFixed(2) : converted.toFixed(0)}`;
}

export const formatRpFull = (n: number) =>
  `Rp ${Math.abs(n).toLocaleString('id-ID')}`;

export const formatTime = (d: string | Date) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const relativeDay = (d: string | Date) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  if (diff < 1000 * 60 * 60 * 12) return `Today, ${formatTime(date)}`;
  if (diff < 1000 * 60 * 60 * 36) return `Yesterday, ${formatTime(date)}`;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

export function isDuplicateDestination(
  name: string,
  list: ReadonlyArray<{ name: string }>,
): boolean {
  const norm = name.trim().toLowerCase();
  if (!norm) return false;
  return list.some((d) => d.name.trim().toLowerCase() === norm);
}

export function tripsOverlap(
  startA: string, daysA: number,
  startB: string, daysB: number,
): boolean {
  const aStart = new Date(startA).getTime();
  const aEnd = aStart + (daysA - 1) * 86400000;
  const bStart = new Date(startB).getTime();
  const bEnd = bStart + (daysB - 1) * 86400000;
  return aStart <= bEnd && bStart <= aEnd;
}
