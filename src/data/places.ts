export type Vibe = 'chill' | 'chaos' | 'zen' | 'luxury';
export type Category = 'Cafe' | 'Nature' | 'Cultural' | 'Historic' | 'Scenic' | 'Cozy' | 'Foodie' | 'Hidden Gem';

export interface Place {
  id: string;
  name: string;
  category: Category;
  tags: string[];
  vibes: Vibe[];
  image: string;
  cost: number;
  priceRange: { min: number; max: number };
  durationMin: number;
  distanceKm: number;
  lat: number;
  lng: number;
  rating: number;
  description: string;
  openingHours: string;
  indoor: boolean;
  openHour: number;
  closeHour: number;
}

export const PLACES: Place[] = [
  {
    id: 'p1', name: 'Campuhan Ridge Walk', category: 'Nature',
    tags: ['Scenic', 'Sunrise'], vibes: ['zen', 'chill'],
    image: 'https://images.unsplash.com/photo-1604999333679-b86d54738315?auto=format&fit=crop&w=800&q=80',
    cost: 25000, priceRange: { min: 0, max: 50000 }, durationMin: 90, distanceKm: 1.2,
    lat: -8.5042, lng: 115.2562, rating: 4.8,
    description: 'Lush green ridge with panoramic Ubud views — perfect at sunrise.',
    openingHours: '06:00 – 18:00',
    indoor: false, openHour: 6, closeHour: 18,
  },
  {
    id: 'p2', name: 'Tirta Empul Temple', category: 'Cultural',
    tags: ['Historic', 'Ritual'], vibes: ['zen', 'chill'],
    image: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=800&q=80',
    cost: 50000, priceRange: { min: 50000, max: 50000 }, durationMin: 75, distanceKm: 3.4,
    lat: -8.4156, lng: 115.3147, rating: 4.9,
    description: 'Sacred Balinese water temple known for its purification ritual.',
    openingHours: '07:00 – 17:00',
    indoor: false, openHour: 7, closeHour: 17,
  },
  {
    id: 'p3', name: 'Seniman Coffee Studio', category: 'Cafe',
    tags: ['Cozy', 'Specialty'], vibes: ['chill', 'luxury'],
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80',
    cost: 40000, priceRange: { min: 35000, max: 95000 }, durationMin: 60, distanceKm: 0.6,
    lat: -8.5063, lng: 115.2625, rating: 4.7,
    description: 'Award-winning roaster with single-origin Indonesian beans.',
    openingHours: '08:00 – 22:00',
    indoor: true, openHour: 8, closeHour: 22,
  },
  {
    id: 'p4', name: 'Ubud Palace', category: 'Historic',
    tags: ['Cultural', 'Architecture'], vibes: ['zen', 'chill', 'luxury'],
    image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=800&q=80',
    cost: 25000, priceRange: { min: 25000, max: 25000 }, durationMin: 60, distanceKm: 1.0,
    lat: -8.5070, lng: 115.2624, rating: 4.6,
    description: 'Royal palace with traditional Balinese carvings and dance shows.',
    openingHours: '08:00 – 17:00',
    indoor: false, openHour: 8, closeHour: 17,
  },
  {
    id: 'p5', name: 'Tegalalang Rice Terrace', category: 'Nature',
    tags: ['Scenic', 'Photo'], vibes: ['chill', 'zen'],
    image: 'https://images.unsplash.com/photo-1518544866330-95a2bec01b51?auto=format&fit=crop&w=800&q=80',
    cost: 35000, priceRange: { min: 35000, max: 80000 }, durationMin: 90, distanceKm: 9.4,
    lat: -8.4313, lng: 115.2795, rating: 4.7,
    description: 'Iconic emerald rice paddies cascading down a valley.',
    openingHours: '07:00 – 18:00',
    indoor: false, openHour: 7, closeHour: 18,
  },
  {
    id: 'p6', name: 'Hujan Locale', category: 'Foodie',
    tags: ['Indonesian', 'Modern'], vibes: ['luxury', 'chaos'],
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
    cost: 220000, priceRange: { min: 180000, max: 350000 }, durationMin: 90, distanceKm: 1.6,
    lat: -8.5085, lng: 115.2590, rating: 4.8,
    description: 'Modern Indonesian dining with seasonal ingredients.',
    openingHours: '12:00 – 22:00',
    indoor: true, openHour: 12, closeHour: 22,
  },
  {
    id: 'p7', name: 'Sacred Monkey Forest', category: 'Nature',
    tags: ['Wildlife', 'Spiritual'], vibes: ['chaos', 'chill'],
    image: 'https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=800&q=80',
    cost: 80000, priceRange: { min: 80000, max: 80000 }, durationMin: 75, distanceKm: 1.4,
    lat: -8.5188, lng: 115.2585, rating: 4.5,
    description: 'Ancient temple sanctuary inside a primordial forest.',
    openingHours: '08:30 – 18:00',
    indoor: false, openHour: 8, closeHour: 18,
  },
  {
    id: 'p8', name: 'Locavore To Go', category: 'Cafe',
    tags: ['Brunch', 'Quick'], vibes: ['chill'],
    image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=800&q=80',
    cost: 70000, priceRange: { min: 60000, max: 120000 }, durationMin: 45, distanceKm: 1.1,
    lat: -8.5051, lng: 115.2601, rating: 4.6,
    description: 'Fast, beautifully plated brunch from the Locavore team.',
    openingHours: '08:00 – 16:00',
    indoor: true, openHour: 8, closeHour: 16,
  },
  {
    id: 'p9', name: 'Goa Gajah (Elephant Cave)', category: 'Hidden Gem',
    tags: ['Historic', 'Quiet'], vibes: ['zen'],
    image: 'https://images.unsplash.com/photo-1583309217394-d31c4ee5e3a8?auto=format&fit=crop&w=800&q=80',
    cost: 30000, priceRange: { min: 30000, max: 30000 }, durationMin: 60, distanceKm: 4.8,
    lat: -8.5232, lng: 115.2870, rating: 4.5,
    description: '9th-century meditation cave hidden in tropical garden.',
    openingHours: '08:00 – 17:00',
    indoor: false, openHour: 8, closeHour: 17,
  },
  {
    id: 'p10', name: 'Kopi Joss Ubud', category: 'Cafe',
    tags: ['Local', 'Authentic'], vibes: ['chaos', 'chill'],
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
    cost: 20000, priceRange: { min: 12000, max: 45000 }, durationMin: 30, distanceKm: 0.8,
    lat: -8.5056, lng: 115.2633, rating: 4.4,
    description: 'Local warung famous for charcoal coffee and cheap bites.',
    openingHours: '07:00 – 21:00',
    indoor: true, openHour: 7, closeHour: 21,
  },
  {
    id: 'p11', name: 'Komaneka Fine Dining', category: 'Foodie',
    tags: ['Fine Dining', 'View'], vibes: ['luxury'],
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    cost: 500000, priceRange: { min: 350000, max: 700000 }, durationMin: 120, distanceKm: 2.1,
    lat: -8.5044, lng: 115.2548, rating: 4.9,
    description: 'World-class dining overlooking the Campuhan river valley.',
    openingHours: '12:00 – 22:00',
    indoor: true, openHour: 12, closeHour: 22,
  },
  {
    id: 'p12', name: 'Ubud Art Market', category: 'Cultural',
    tags: ['Shopping', 'Local'], vibes: ['chaos', 'chill', 'luxury'],
    image: 'https://images.unsplash.com/photo-1555990538-c4e5a4d1cf7b?auto=format&fit=crop&w=800&q=80',
    cost: 100000, priceRange: { min: 20000, max: 500000 }, durationMin: 60, distanceKm: 1.0,
    lat: -8.5070, lng: 115.2624, rating: 4.3,
    description: 'Bustling traditional market with batik, crafts, and souvenirs.',
    openingHours: '06:00 – 18:00',
    indoor: false, openHour: 6, closeHour: 18,
  },
  {
    id: 'p13', name: 'Yoga Barn', category: 'Cozy',
    tags: ['Wellness', 'Peaceful'], vibes: ['zen'],
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
    cost: 130000, priceRange: { min: 100000, max: 200000 }, durationMin: 90, distanceKm: 1.8,
    lat: -8.5191, lng: 115.2601, rating: 4.7,
    description: 'Multi-level open-air yoga studio with daily classes and healings.',
    openingHours: '07:00 – 20:00',
    indoor: false, openHour: 7, closeHour: 20,
  },
  {
    id: 'p14', name: "Wayan's Night Market", category: 'Foodie',
    tags: ['Street Food', 'Local'], vibes: ['chaos'],
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    cost: 45000, priceRange: { min: 15000, max: 80000 }, durationMin: 60, distanceKm: 1.3,
    lat: -8.5079, lng: 115.2620, rating: 4.4,
    description: 'Lively night market with cheap sate, nasi goreng, and fresh juices.',
    openingHours: '18:00 – 00:00',
    indoor: false, openHour: 18, closeHour: 24,
  },
  {
    id: 'p15', name: 'Pura Luhur Batukaru', category: 'Hidden Gem',
    tags: ['Spiritual', 'Off-beat'], vibes: ['zen', 'chill'],
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
    cost: 30000, priceRange: { min: 30000, max: 50000 }, durationMin: 75, distanceKm: 36.0,
    lat: -8.3891, lng: 115.1282, rating: 4.8,
    description: "One of Bali's most sacred yet under-visited mountain temples.",
    openingHours: '08:00 – 18:00',
    indoor: false, openHour: 8, closeHour: 18,
  },
];

export function parseOpenHour(s: string): number {
  const m = s.match(/(\d+):(\d+)/); return m ? parseInt(m[1]) : 0;
}
export function parseCloseHour(s: string): number {
  const m = s.match(/\d+:\d+.*?(\d+):(\d+)/); return m ? parseInt(m[1]) : 24;
}

export function pickItinerary(vibe: Vibe, budget: number, indoorOnly = false): Place[] {
  let candidates = PLACES.filter(
    (p) => p.vibes.includes(vibe) && p.cost <= budget && (!indoorOnly || p.indoor),
  ).sort((a, b) => b.rating - a.rating);

  if (candidates.length < 3) {
    PLACES.forEach((p) => {
      if (candidates.length < 3 && !candidates.find((x) => x.id === p.id)) candidates.push(p);
    });
  }

  const count = 3 + (vibe === 'chaos' ? 1 : 0);
  return candidates.slice(0, Math.min(count, candidates.length));
}
