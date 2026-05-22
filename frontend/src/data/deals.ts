export interface Deal {
  id: string;
  placeId?: string;
  businessName: string;
  title: string;
  discount: string;
  category: string;
  icon: string;
  validUntil: string;
  distanceKm: number;
  lat: number;
  lng: number;
  isNearby: boolean;
  savingsAmount: number;
}

export const DEALS: Deal[] = [
  {
    id: 'd1',
    placeId: 'p3',
    businessName: 'Seniman Coffee Studio',
    title: '15% off any single origin',
    discount: '15% OFF',
    category: 'Cafe',
    icon: '☕',
    validUntil: 'Today only',
    distanceKm: 0.6,
    lat: -8.5063, lng: 115.2625,
    isNearby: true,
    savingsAmount: 15000,
  },
  {
    id: 'd2',
    placeId: 'p7',
    businessName: 'Sacred Monkey Forest',
    title: 'Free entry for students',
    discount: 'FREE',
    category: 'Nature',
    icon: '🌿',
    validUntil: 'This week',
    distanceKm: 1.4,
    lat: -8.5188, lng: 115.2585,
    isNearby: true,
    savingsAmount: 80000,
  },
  {
    id: 'd3',
    businessName: 'Paon Bali Cooking Class',
    title: 'Cooking class — 2 for 1',
    discount: 'B2G1',
    category: 'Cultural',
    icon: '🍳',
    validUntil: '3 days left',
    distanceKm: 0.9,
    lat: -8.5071, lng: 115.2640,
    isNearby: true,
    savingsAmount: 250000,
  },
  {
    id: 'd4',
    placeId: 'p6',
    businessName: 'Hujan Locale',
    title: 'Free dessert with any main',
    discount: 'FREE ITEM',
    category: 'Foodie',
    icon: '🍽️',
    validUntil: 'Weekends only',
    distanceKm: 1.6,
    lat: -8.5085, lng: 115.2590,
    isNearby: false,
    savingsAmount: 65000,
  },
  {
    id: 'd5',
    businessName: 'Kopi Bali House',
    title: 'Buy 2 drinks, get 1 free',
    discount: 'B2G1',
    category: 'Cafe',
    icon: '🥤',
    validUntil: 'Tomorrow',
    distanceKm: 0.4,
    lat: -8.5049, lng: 115.2628,
    isNearby: true,
    savingsAmount: 35000,
  },
  {
    id: 'd6',
    businessName: 'Ubud Yoga Center',
    title: 'First class completely free',
    discount: 'FREE',
    category: 'Wellness',
    icon: '🧘',
    validUntil: '5 days left',
    distanceKm: 1.2,
    lat: -8.5180, lng: 115.2610,
    isNearby: false,
    savingsAmount: 130000,
  },
];

export function getDealsForPlace(placeId: string): Deal[] {
  return DEALS.filter((d) => d.placeId === placeId);
}

export function getNearbyDeals(): Deal[] {
  return DEALS.filter((d) => d.isNearby);
}
