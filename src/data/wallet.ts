export type TxnTag = 'Great deal' | 'Over budget' | 'Saved' | 'Top up' | 'you owe' | 'owed to you' | 'settled';
export type TxnCategory = 'Food & Drinks' | 'Attractions' | 'Transport' | 'Shopping' | 'Top up';

export type Currency = 'IDR' | 'USD' | 'EUR' | 'JPY' | 'SGD' | 'AUD';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  IDR: 'Rp', USD: '$', EUR: '€', JPY: '¥', SGD: 'S$', AUD: 'A$',
};

// Approximate rates (base: 1 unit of currency → IDR)
export const CURRENCY_RATES_TO_IDR: Record<Currency, number> = {
  IDR: 1, USD: 15800, EUR: 17200, JPY: 106, SGD: 11700, AUD: 10300,
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
  switch (currency) {
    case 'IDR':
      if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
      if (amount >= 1_000) return `Rp ${Math.round(amount / 1_000)}K`;
      return `Rp ${Math.round(amount)}`;
    case 'JPY':
      return `¥${Math.round(amount).toLocaleString()}`;
    case 'USD':
      return `$${amount.toFixed(2)}`;
    case 'EUR':
      return `€${amount.toFixed(2)}`;
    case 'SGD':
      return `S$${amount.toFixed(2)}`;
    case 'AUD':
      return `A$${amount.toFixed(2)}`;
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
}

export const SEED_TXNS: Transaction[] = [
  { id: 't1', title: 'Seniman Coffee Studio', category: 'Food & Drinks', amount: -40000, date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), icon: '☕', tag: 'Great deal' },
  { id: 't2', title: 'Tirta Empul Temple', category: 'Attractions', amount: -50000, date: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), icon: '🛕' },
  { id: 't3', title: 'Hujan Locale — split with Made', category: 'Food & Drinks', amount: -73000, date: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), icon: '🍽️', tag: 'you owe' },
  { id: 't4', title: 'Gojek Ride', category: 'Transport', amount: -28000, date: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), icon: '🛵' },
  { id: 't5', title: 'Paid for group dinner', category: 'Food & Drinks', amount: -220000, date: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), icon: '🍽️', tag: 'owed to you' },
  { id: 't6', title: 'Ubud Market Souvenirs', category: 'Shopping', amount: -140000, date: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), icon: '🛍️' },
];

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
