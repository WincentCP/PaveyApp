/**
 * Wallet data model.
 *
 * Entity relationship:
 *
 *     Trip 1 ─── many ─── Transaction
 *
 * A Trip owns its transactions (they live inside the `Trip.transactions` array,
 * not in a global pool). The active trip is identified by `activeTripId` in
 * AppContext. AppContext exposes "active trip proxies" (`tripBudget`,
 * `totalSpent`, `transactions`, etc.) so callers don't have to walk the trips
 * array themselves.
 *
 * A trip's lifecycle is independent of any itinerary plan — the wallet is a
 * standalone tool. When a user generates an itinerary the wallet prompt offers
 * to link the trip, but the wallet works without one (see WalletPage).
 *
 * Backend mapping (future):
 *   GET    /trips                  → Trip[]
 *   POST   /trips                  → Trip
 *   GET    /trips/:id/transactions → Transaction[]
 *   POST   /trips/:id/transactions → Transaction
 */

export type TxnTag = 'Great deal' | 'Over budget' | 'Saved' | 'Top up' | 'you owe' | 'owed to you' | 'settled';
export type TxnCategory = 'Food & Drinks' | 'Attractions' | 'Transport' | 'Shopping' | 'Top up';

export type Currency = 'IDR' | 'USD' | 'EUR' | 'JPY' | 'SGD' | 'AUD' | 'GBP' | 'THB' | 'MYR' | 'KRW' | 'HKD' | 'CNY' | 'INR' | 'NZD' | 'CAD';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  IDR: 'Rp', USD: '$', EUR: '€', JPY: '¥', SGD: 'S$', AUD: 'A$',
  GBP: '£', THB: '฿', MYR: 'RM', KRW: '₩', HKD: 'HK$', CNY: '¥', INR: '₹', NZD: 'NZ$', CAD: 'C$',
};

// Approximate rates (base: 1 unit of currency → IDR)
export const CURRENCY_RATES_TO_IDR: Record<Currency, number> = {
  IDR: 1, USD: 15800, EUR: 17200, JPY: 106, SGD: 11700, AUD: 10300,
  GBP: 19900, THB: 445, MYR: 3400, KRW: 11.9, HKD: 2020, CNY: 2200, INR: 190, NZD: 9700, CAD: 11600,
};

// Auto-suggest currency by destination keyword
export const DESTINATION_CURRENCY_HINTS: Record<string, Currency> = {
  bali: 'IDR', indonesia: 'IDR', jakarta: 'IDR', yogyakarta: 'IDR', lombok: 'IDR',
  japan: 'JPY', tokyo: 'JPY', osaka: 'JPY', kyoto: 'JPY',
  france: 'EUR', paris: 'EUR', germany: 'EUR', spain: 'EUR', italy: 'EUR',
  usa: 'USD', 'new york': 'USD', 'los angeles': 'USD', america: 'USD',
  singapore: 'SGD',
  australia: 'AUD', sydney: 'AUD', melbourne: 'AUD',
};

export function suggestCurrency(destination: string): Currency {
  const lower = destination.toLowerCase();
  for (const [key, currency] of Object.entries(DESTINATION_CURRENCY_HINTS)) {
    if (lower.includes(key)) return currency;
  }
  return 'IDR';
}

export function formatCurrencyAmount(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency];
  switch (currency) {
    case 'IDR':
      if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
      if (amount >= 1_000) return `Rp ${Math.round(amount / 1_000)}K`;
      return `Rp ${Math.round(amount)}`;
    case 'JPY':
    case 'KRW':
      return `${sym}${Math.round(amount).toLocaleString()}`;
    default:
      return `${sym}${amount < 1 ? amount.toFixed(2) : amount.toFixed(0)}`;
  }
}

export interface Transaction {
  id: string;
  title: string;
  category: TxnCategory;
  amount: number; // negative = expense, positive = income/topup
  date: string;
  icon: string;
  tag?: TxnTag;
  note?: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  currency: Currency;
  budget: number;
  daysTotal: number;
  daysRemaining: number;
  transactions: Transaction[];
  createdAt: string;
  /** True when this trip was auto-minted from a confirmed itinerary plan.
   *  Used by the wallet to render the "Linked from your trip plan" subtitle. */
  linkedToPlan?: boolean;
}

/**
 * Default seed is intentionally empty. A brand-new user should land on the
 * wallet's onboarding empty state, not a wall of fake demo transactions —
 * see WalletPage's `showEmptyOnboarding` gate. The previous demo data
 * misled new users into thinking they had an existing trip.
 */
export const SEED_TXNS: Transaction[] = [];

export const DEFAULT_TRIP: Trip = {
  id: 'trip-default',
  name: 'Ubud Trip',
  destination: 'Bali, Indonesia',
  currency: 'IDR',
  budget: 3_000_000,
  daysTotal: 5,
  daysRemaining: 3,
  transactions: SEED_TXNS,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
};

export const BUDGET_TOTAL = DEFAULT_TRIP.budget;

export const CATEGORY_COLORS: Record<TxnCategory, string> = {
  'Food & Drinks': '#3B5BFF',
  'Attractions': '#22C55E',
  'Transport': '#F59E0B',
  'Shopping': '#A855F7',
  'Top up': '#10B981',
};
