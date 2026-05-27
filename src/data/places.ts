export type Vibe = 'nature' | 'cafe' | 'activities' | 'cultural' | 'balanced';
export type Category = 'Cafe' | 'Nature' | 'Cultural' | 'Historic' | 'Scenic' | 'Cozy' | 'Foodie' | 'Hidden Gem';

export interface Place {
  id: string;
  city: string;
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
  /* ── Ubud, Bali ──────────────────────────────── */
  {
    id: 'p1', city: 'Ubud', name: 'Campuhan Ridge Walk', category: 'Nature',
    tags: ['Scenic', 'Sunrise'], vibes: ['nature'],
    image: 'https://images.unsplash.com/photo-1604999333679-b86d54738315?auto=format&fit=crop&w=800&q=80',
    cost: 25000, priceRange: { min: 0, max: 50000 }, durationMin: 90, distanceKm: 1.2,
    lat: -8.5042, lng: 115.2562, rating: 4.8,
    description: 'Lush green ridge with panoramic Ubud views — perfect at sunrise.',
    openingHours: '06:00 – 18:00',
    indoor: false, openHour: 6, closeHour: 18,
  },
  {
    id: 'p2', city: 'Ubud', name: 'Tirta Empul Temple', category: 'Cultural',
    tags: ['Historic', 'Ritual'], vibes: ['cultural', 'nature'],
    image: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=800&q=80',
    cost: 50000, priceRange: { min: 50000, max: 50000 }, durationMin: 75, distanceKm: 3.4,
    lat: -8.4156, lng: 115.3147, rating: 4.9,
    description: 'Sacred Balinese water temple known for its purification ritual.',
    openingHours: '07:00 – 17:00',
    indoor: false, openHour: 7, closeHour: 17,
  },
  {
    id: 'p3', city: 'Ubud', name: 'Seniman Coffee Studio', category: 'Cafe',
    tags: ['Cozy', 'Specialty'], vibes: ['cafe'],
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80',
    cost: 40000, priceRange: { min: 35000, max: 95000 }, durationMin: 60, distanceKm: 0.6,
    lat: -8.5063, lng: 115.2625, rating: 4.7,
    description: 'Award-winning roaster with single-origin Indonesian beans.',
    openingHours: '08:00 – 22:00',
    indoor: true, openHour: 8, closeHour: 22,
  },
  {
    id: 'p4', city: 'Ubud', name: 'Ubud Palace', category: 'Historic',
    tags: ['Cultural', 'Architecture'], vibes: ['cultural'],
    image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=800&q=80',
    cost: 25000, priceRange: { min: 25000, max: 25000 }, durationMin: 60, distanceKm: 1.0,
    lat: -8.5070, lng: 115.2624, rating: 4.6,
    description: 'Royal palace with traditional Balinese carvings and dance shows.',
    openingHours: '08:00 – 17:00',
    indoor: false, openHour: 8, closeHour: 17,
  },
  {
    id: 'p5', city: 'Ubud', name: 'Tegalalang Rice Terrace', category: 'Nature',
    tags: ['Scenic', 'Photo'], vibes: ['nature'],
    image: 'https://images.unsplash.com/photo-1518544866330-95a2bec01b51?auto=format&fit=crop&w=800&q=80',
    cost: 35000, priceRange: { min: 35000, max: 80000 }, durationMin: 90, distanceKm: 9.4,
    lat: -8.4313, lng: 115.2795, rating: 4.7,
    description: 'Iconic emerald rice paddies cascading down a valley.',
    openingHours: '07:00 – 18:00',
    indoor: false, openHour: 7, closeHour: 18,
  },
  {
    id: 'p6', city: 'Ubud', name: 'Hujan Locale', category: 'Foodie',
    tags: ['Indonesian', 'Modern'], vibes: ['cafe', 'activities'],
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
    cost: 220000, priceRange: { min: 180000, max: 350000 }, durationMin: 90, distanceKm: 1.6,
    lat: -8.5085, lng: 115.2590, rating: 4.8,
    description: 'Modern Indonesian dining with seasonal ingredients.',
    openingHours: '12:00 – 22:00',
    indoor: true, openHour: 12, closeHour: 22,
  },
  {
    id: 'p7', city: 'Ubud', name: 'Sacred Monkey Forest', category: 'Nature',
    tags: ['Wildlife', 'Spiritual'], vibes: ['nature', 'activities'],
    image: 'https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=800&q=80',
    cost: 80000, priceRange: { min: 80000, max: 80000 }, durationMin: 75, distanceKm: 1.4,
    lat: -8.5188, lng: 115.2585, rating: 4.5,
    description: 'Ancient temple sanctuary inside a primordial forest.',
    openingHours: '08:30 – 18:00',
    indoor: false, openHour: 8, closeHour: 18,
  },
  {
    id: 'p8', city: 'Ubud', name: 'Locavore To Go', category: 'Cafe',
    tags: ['Brunch', 'Quick'], vibes: ['cafe'],
    image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=800&q=80',
    cost: 70000, priceRange: { min: 60000, max: 120000 }, durationMin: 45, distanceKm: 1.1,
    lat: -8.5051, lng: 115.2601, rating: 4.6,
    description: 'Fast, beautifully plated brunch from the Locavore team.',
    openingHours: '08:00 – 16:00',
    indoor: true, openHour: 8, closeHour: 16,
  },
  {
    id: 'p9', city: 'Ubud', name: 'Goa Gajah (Elephant Cave)', category: 'Hidden Gem',
    tags: ['Historic', 'Quiet'], vibes: ['cultural', 'nature'],
    image: 'https://images.unsplash.com/photo-1583309217394-d31c4ee5e3a8?auto=format&fit=crop&w=800&q=80',
    cost: 30000, priceRange: { min: 30000, max: 30000 }, durationMin: 60, distanceKm: 4.8,
    lat: -8.5232, lng: 115.2870, rating: 4.5,
    description: '9th-century meditation cave hidden in tropical garden.',
    openingHours: '08:00 – 17:00',
    indoor: false, openHour: 8, closeHour: 17,
  },
  {
    id: 'p10', city: 'Ubud', name: 'Kopi Joss Ubud', category: 'Cafe',
    tags: ['Local', 'Authentic'], vibes: ['cafe', 'activities'],
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
    cost: 20000, priceRange: { min: 12000, max: 45000 }, durationMin: 30, distanceKm: 0.8,
    lat: -8.5056, lng: 115.2633, rating: 4.4,
    description: 'Local warung famous for charcoal coffee and cheap bites.',
    openingHours: '07:00 – 21:00',
    indoor: true, openHour: 7, closeHour: 21,
  },
  {
    id: 'p11', city: 'Ubud', name: 'Komaneka Fine Dining', category: 'Foodie',
    tags: ['Fine Dining', 'View'], vibes: ['cafe'],
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    cost: 500000, priceRange: { min: 350000, max: 700000 }, durationMin: 120, distanceKm: 2.1,
    lat: -8.5044, lng: 115.2548, rating: 4.9,
    description: 'World-class dining overlooking the Campuhan river valley.',
    openingHours: '12:00 – 22:00',
    indoor: true, openHour: 12, closeHour: 22,
  },
  {
    id: 'p12', city: 'Ubud', name: 'Ubud Art Market', category: 'Cultural',
    tags: ['Shopping', 'Local'], vibes: ['cultural', 'activities'],
    image: 'https://images.unsplash.com/photo-1555990538-c4e5a4d1cf7b?auto=format&fit=crop&w=800&q=80',
    cost: 100000, priceRange: { min: 20000, max: 500000 }, durationMin: 60, distanceKm: 1.0,
    lat: -8.5070, lng: 115.2624, rating: 4.3,
    description: 'Bustling traditional market with batik, crafts, and souvenirs.',
    openingHours: '06:00 – 18:00',
    indoor: false, openHour: 6, closeHour: 18,
  },
  {
    id: 'p13', city: 'Ubud', name: 'Yoga Barn', category: 'Cozy',
    tags: ['Wellness', 'Peaceful'], vibes: ['nature'],
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
    cost: 130000, priceRange: { min: 100000, max: 200000 }, durationMin: 90, distanceKm: 1.8,
    lat: -8.5191, lng: 115.2601, rating: 4.7,
    description: 'Multi-level open-air yoga studio with daily classes and healings.',
    openingHours: '07:00 – 20:00',
    indoor: false, openHour: 7, closeHour: 20,
  },
  {
    id: 'p14', city: 'Ubud', name: "Wayan's Night Market", category: 'Foodie',
    tags: ['Street Food', 'Local'], vibes: ['activities', 'cafe'],
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    cost: 45000, priceRange: { min: 15000, max: 80000 }, durationMin: 60, distanceKm: 1.3,
    lat: -8.5079, lng: 115.2620, rating: 4.4,
    description: 'Lively night market with cheap sate, nasi goreng, and fresh juices.',
    openingHours: '18:00 – 00:00',
    indoor: false, openHour: 18, closeHour: 24,
  },
  {
    id: 'p15', city: 'Ubud', name: 'Pura Luhur Batukaru', category: 'Hidden Gem',
    tags: ['Spiritual', 'Off-beat'], vibes: ['cultural', 'nature'],
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
    cost: 30000, priceRange: { min: 30000, max: 50000 }, durationMin: 75, distanceKm: 36.0,
    lat: -8.3891, lng: 115.1282, rating: 4.8,
    description: "One of Bali's most sacred yet under-visited mountain temples.",
    openingHours: '08:00 – 18:00',
    indoor: false, openHour: 8, closeHour: 18,
  },

  /* ── Bangkok, Thailand ───────────────────────── */
  {
    id: 'b1', city: 'Bangkok', name: 'Wat Pho Temple', category: 'Cultural',
    tags: ['Historic', 'Spiritual'], vibes: ['cultural'],
    image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=800&q=80',
    cost: 200000, priceRange: { min: 200000, max: 200000 }, durationMin: 90, distanceKm: 1.2,
    lat: 13.7465, lng: 100.4927, rating: 4.8,
    description: 'Home of the giant Reclining Buddha and traditional Thai massage school.',
    openingHours: '08:00 – 18:30',
    indoor: false, openHour: 8, closeHour: 18,
  },
  {
    id: 'b2', city: 'Bangkok', name: 'Grand Palace', category: 'Historic',
    tags: ['Cultural', 'Architecture'], vibes: ['cultural'],
    image: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=800&q=80',
    cost: 450000, priceRange: { min: 450000, max: 450000 }, durationMin: 120, distanceKm: 0.8,
    lat: 13.7500, lng: 100.4913, rating: 4.7,
    description: 'Former royal residence and seat of the Thai king — dazzling gold spires and murals.',
    openingHours: '08:30 – 15:30',
    indoor: false, openHour: 8, closeHour: 15,
  },
  {
    id: 'b3', city: 'Bangkok', name: 'Chatuchak Weekend Market', category: 'Cultural',
    tags: ['Shopping', 'Local'], vibes: ['activities', 'balanced'],
    image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=800&q=80',
    cost: 100000, priceRange: { min: 20000, max: 300000 }, durationMin: 120, distanceKm: 11.5,
    lat: 13.7999, lng: 100.5500, rating: 4.5,
    description: 'One of the world\'s largest weekend markets — 8,000+ stalls of everything imaginable.',
    openingHours: '09:00 – 18:00',
    indoor: false, openHour: 9, closeHour: 18,
  },
  {
    id: 'b4', city: 'Bangkok', name: 'Yaowarat Chinatown Night Food', category: 'Foodie',
    tags: ['Street Food', 'Night'], vibes: ['activities', 'cafe'],
    image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
    cost: 80000, priceRange: { min: 30000, max: 150000 }, durationMin: 90, distanceKm: 2.0,
    lat: 13.7393, lng: 100.5109, rating: 4.6,
    description: 'Bangkok\'s electric Chinatown strip — dim sum, roast duck, and neon-lit alleys.',
    openingHours: '17:00 – 02:00',
    indoor: false, openHour: 17, closeHour: 26,
  },
  {
    id: 'b5', city: 'Bangkok', name: 'Asiatique The Riverfront', category: 'Foodie',
    tags: ['Nightlife', 'Riverside'], vibes: ['activities', 'cafe'],
    image: 'https://images.unsplash.com/photo-1523568114750-b593de7fb3b3?auto=format&fit=crop&w=800&q=80',
    cost: 120000, priceRange: { min: 50000, max: 250000 }, durationMin: 90, distanceKm: 5.2,
    lat: 13.7048, lng: 100.4986, rating: 4.4,
    description: 'Open-air riverfront mall with restaurants, live shows, and Ferris wheel views.',
    openingHours: '17:00 – 00:00',
    indoor: false, openHour: 17, closeHour: 24,
  },
  {
    id: 'b6', city: 'Bangkok', name: 'Roots Coffee Roaster', category: 'Cafe',
    tags: ['Specialty', 'Third Wave'], vibes: ['cafe'],
    image: 'https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=800&q=80',
    cost: 60000, priceRange: { min: 45000, max: 120000 }, durationMin: 60, distanceKm: 3.5,
    lat: 13.7205, lng: 100.5259, rating: 4.7,
    description: 'Bangkok\'s leading specialty coffee roaster with Thai single-origin beans.',
    openingHours: '08:00 – 18:00',
    indoor: true, openHour: 8, closeHour: 18,
  },
  {
    id: 'b7', city: 'Bangkok', name: 'Lumpini Park', category: 'Nature',
    tags: ['Peaceful', 'Morning'], vibes: ['nature'],
    image: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=800&q=80',
    cost: 0, priceRange: { min: 0, max: 0 }, durationMin: 75, distanceKm: 4.0,
    lat: 13.7316, lng: 100.5418, rating: 4.4,
    description: 'Bangkok\'s green lung — early morning tai chi, rowing boats, and monitor lizards.',
    openingHours: '05:00 – 21:00',
    indoor: false, openHour: 5, closeHour: 21,
  },
  {
    id: 'b8', city: 'Bangkok', name: 'Jim Thompson House Museum', category: 'Hidden Gem',
    tags: ['Historic', 'Architecture'], vibes: ['cultural'],
    image: 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?auto=format&fit=crop&w=800&q=80',
    cost: 150000, priceRange: { min: 150000, max: 150000 }, durationMin: 75, distanceKm: 3.0,
    lat: 13.7465, lng: 100.5286, rating: 4.6,
    description: 'Six interconnected traditional Thai houses filled with Asian antiques.',
    openingHours: '09:00 – 18:00',
    indoor: false, openHour: 9, closeHour: 18,
  },
  {
    id: 'b9', city: 'Bangkok', name: 'Wat Arun (Temple of Dawn)', category: 'Cultural',
    tags: ['Riverside', 'Sunset'], vibes: ['cultural', 'nature'],
    image: 'https://images.unsplash.com/photo-1598935898639-81586f7d2129?auto=format&fit=crop&w=800&q=80',
    cost: 100000, priceRange: { min: 100000, max: 100000 }, durationMin: 60, distanceKm: 1.5,
    lat: 13.7435, lng: 100.4888, rating: 4.7,
    description: 'Prang-style temple rising from the Chao Phraya — stunning at sunset.',
    openingHours: '08:00 – 18:00',
    indoor: false, openHour: 8, closeHour: 18,
  },
  {
    id: 'b10', city: 'Bangkok', name: 'Ko Ratanakosin Walking Tour', category: 'Scenic',
    tags: ['Old Town', 'Historic Walk'], vibes: ['cultural', 'activities'],
    image: 'https://images.unsplash.com/photo-1543259960-5b9e5b8c8a95?auto=format&fit=crop&w=800&q=80',
    cost: 30000, priceRange: { min: 0, max: 80000 }, durationMin: 90, distanceKm: 2.5,
    lat: 13.7505, lng: 100.4921, rating: 4.5,
    description: 'Self-guided walk through Bangkok\'s historic island — temples, markets, river.',
    openingHours: '07:00 – 19:00',
    indoor: false, openHour: 7, closeHour: 19,
  },

  /* ── Tokyo, Japan ────────────────────────────── */
  {
    id: 't1', city: 'Tokyo', name: 'Senso-ji Temple, Asakusa', category: 'Cultural',
    tags: ['Historic', 'Lanterns'], vibes: ['cultural'],
    image: 'https://images.unsplash.com/photo-1503899036392-e20a485af731?auto=format&fit=crop&w=800&q=80',
    cost: 0, priceRange: { min: 0, max: 30000 }, durationMin: 75, distanceKm: 7.5,
    lat: 35.7148, lng: 139.7967, rating: 4.8,
    description: 'Tokyo\'s oldest temple — the iconic Kaminarimon Gate and Nakamise shopping street.',
    openingHours: '06:00 – 17:00',
    indoor: false, openHour: 6, closeHour: 17,
  },
  {
    id: 't2', city: 'Tokyo', name: 'Shibuya Crossing & Scramble', category: 'Scenic',
    tags: ['Iconic', 'Busy'], vibes: ['activities', 'balanced'],
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
    cost: 10000, priceRange: { min: 0, max: 50000 }, durationMin: 45, distanceKm: 5.0,
    lat: 35.6595, lng: 139.7004, rating: 4.6,
    description: 'The world\'s busiest pedestrian crossing — an unmissable Tokyo spectacle.',
    openingHours: '00:00 – 24:00',
    indoor: false, openHour: 0, closeHour: 24,
  },
  {
    id: 't3', city: 'Tokyo', name: 'Tsukiji Outer Market', category: 'Foodie',
    tags: ['Seafood', 'Morning'], vibes: ['cafe', 'activities'],
    image: 'https://images.unsplash.com/photo-1517816428104-797678c7cf0c?auto=format&fit=crop&w=800&q=80',
    cost: 150000, priceRange: { min: 50000, max: 300000 }, durationMin: 90, distanceKm: 3.5,
    lat: 35.6654, lng: 139.7707, rating: 4.7,
    description: 'Sushi breakfast, tamagoyaki, and fresh seafood stalls — open since dawn.',
    openingHours: '05:00 – 14:00',
    indoor: false, openHour: 5, closeHour: 14,
  },
  {
    id: 't4', city: 'Tokyo', name: 'Shinjuku Gyoen Garden', category: 'Nature',
    tags: ['Peaceful', 'Garden'], vibes: ['nature'],
    image: 'https://images.unsplash.com/photo-1530507629858-5a16f1c11a55?auto=format&fit=crop&w=800&q=80',
    cost: 20000, priceRange: { min: 20000, max: 20000 }, durationMin: 90, distanceKm: 4.0,
    lat: 35.6851, lng: 139.7100, rating: 4.7,
    description: 'Spacious formal garden blending French, English, and Japanese styles.',
    openingHours: '09:00 – 16:30',
    indoor: false, openHour: 9, closeHour: 16,
  },
  {
    id: 't5', city: 'Tokyo', name: 'Harajuku Takeshita Street', category: 'Scenic',
    tags: ['Pop Culture', 'Fashion'], vibes: ['activities'],
    image: 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=800&q=80',
    cost: 80000, priceRange: { min: 20000, max: 200000 }, durationMin: 60, distanceKm: 1.5,
    lat: 35.6699, lng: 139.7024, rating: 4.4,
    description: 'Pedestrian street crammed with crepe shops, kawaii fashion, and street snacks.',
    openingHours: '10:00 – 20:00',
    indoor: false, openHour: 10, closeHour: 20,
  },
  {
    id: 't6', city: 'Tokyo', name: 'Blue Bottle Coffee Shinjuku', category: 'Cafe',
    tags: ['Minimalist', 'Specialty'], vibes: ['cafe'],
    image: 'https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=800&q=80',
    cost: 60000, priceRange: { min: 40000, max: 90000 }, durationMin: 60, distanceKm: 2.2,
    lat: 35.6896, lng: 139.6997, rating: 4.6,
    description: 'Tokyo\'s iconic specialty cafe — pour-over coffee in a sleek, peaceful setting.',
    openingHours: '08:00 – 19:00',
    indoor: true, openHour: 8, closeHour: 19,
  },
  {
    id: 't7', city: 'Tokyo', name: 'Meiji Jingu Shrine', category: 'Cultural',
    tags: ['Forest', 'Spiritual'], vibes: ['cultural', 'nature'],
    image: 'https://images.unsplash.com/photo-1491884662610-dfcd28f30cfb?auto=format&fit=crop&w=800&q=80',
    cost: 0, priceRange: { min: 0, max: 0 }, durationMin: 75, distanceKm: 1.2,
    lat: 35.6763, lng: 139.6993, rating: 4.7,
    description: 'Shinto shrine surrounded by a dense forested park — serene even on busy days.',
    openingHours: '05:00 – 18:00',
    indoor: false, openHour: 5, closeHour: 18,
  },
  {
    id: 't8', city: 'Tokyo', name: 'TeamLab Planets', category: 'Cozy',
    tags: ['Digital Art', 'Immersive'], vibes: ['activities'],
    image: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?auto=format&fit=crop&w=800&q=80',
    cost: 350000, priceRange: { min: 350000, max: 350000 }, durationMin: 90, distanceKm: 9.0,
    lat: 35.6498, lng: 139.7948, rating: 4.8,
    description: 'Walk through infinity mirror rooms and floating flower universes — mind-blowing.',
    openingHours: '10:00 – 21:00',
    indoor: true, openHour: 10, closeHour: 21,
  },
  {
    id: 't9', city: 'Tokyo', name: 'Yanaka Ginza Old Town', category: 'Hidden Gem',
    tags: ['Old Tokyo', 'Quiet'], vibes: ['cultural', 'activities'],
    image: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=800&q=80',
    cost: 60000, priceRange: { min: 20000, max: 150000 }, durationMin: 75, distanceKm: 6.5,
    lat: 35.7261, lng: 139.7622, rating: 4.6,
    description: 'Shitamachi shopping alley — old Tokyo atmosphere with artisan shops and cats.',
    openingHours: '10:00 – 18:00',
    indoor: false, openHour: 10, closeHour: 18,
  },
  {
    id: 't10', city: 'Tokyo', name: 'Nakameguro Canal Walk', category: 'Scenic',
    tags: ['Trendy', 'Waterside'], vibes: ['nature', 'cafe'],
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=800&q=80',
    cost: 80000, priceRange: { min: 30000, max: 180000 }, durationMin: 75, distanceKm: 3.5,
    lat: 35.6437, lng: 139.6989, rating: 4.7,
    description: 'Tree-lined canal flanked by boutique cafes and concept stores — perfect for a stroll.',
    openingHours: '00:00 – 24:00',
    indoor: false, openHour: 0, closeHour: 24,
  },

  /* ── Paris, France ───────────────────────────── */
  {
    id: 'pa1', city: 'Paris', name: 'Eiffel Tower', category: 'Scenic',
    tags: ['Iconic', 'View'], vibes: ['cultural', 'activities'],
    image: 'https://images.unsplash.com/photo-1499856871958-5b9357976b82?auto=format&fit=crop&w=800&q=80',
    cost: 400000, priceRange: { min: 150000, max: 400000 }, durationMin: 120, distanceKm: 2.0,
    lat: 48.8584, lng: 2.2945, rating: 4.7,
    description: 'The iron lady — go at golden hour and book summit tickets in advance.',
    openingHours: '09:00 – 00:45',
    indoor: false, openHour: 9, closeHour: 24,
  },
  {
    id: 'pa2', city: 'Paris', name: 'Louvre Museum', category: 'Cultural',
    tags: ['Art', 'World-Class'], vibes: ['cultural'],
    image: 'https://images.unsplash.com/photo-1502602915892-af96e8d9f73e?auto=format&fit=crop&w=800&q=80',
    cost: 250000, priceRange: { min: 250000, max: 250000 }, durationMin: 150, distanceKm: 3.5,
    lat: 48.8606, lng: 2.3376, rating: 4.7,
    description: 'The world\'s largest museum — the Mona Lisa, Venus de Milo, and 35,000 artworks.',
    openingHours: '09:00 – 18:00',
    indoor: true, openHour: 9, closeHour: 18,
  },
  {
    id: 'pa3', city: 'Paris', name: 'Café de Flore', category: 'Cafe',
    tags: ['Historic', 'Literary'], vibes: ['cafe'],
    image: 'https://images.unsplash.com/photo-1549294413-26f195200c16?auto=format&fit=crop&w=800&q=80',
    cost: 120000, priceRange: { min: 80000, max: 200000 }, durationMin: 60, distanceKm: 2.5,
    lat: 48.8538, lng: 2.3325, rating: 4.5,
    description: 'Saint-Germain institution where Sartre and Simone de Beauvoir wrote their books.',
    openingHours: '07:30 – 01:30',
    indoor: true, openHour: 7, closeHour: 25,
  },
  {
    id: 'pa4', city: 'Paris', name: 'Montmartre & Sacré-Cœur', category: 'Scenic',
    tags: ['Hilltop', 'Artists'], vibes: ['cultural', 'nature'],
    image: 'https://images.unsplash.com/photo-1542853639-47e4b1bc4b59?auto=format&fit=crop&w=800&q=80',
    cost: 30000, priceRange: { min: 0, max: 80000 }, durationMin: 90, distanceKm: 4.5,
    lat: 48.8867, lng: 2.3431, rating: 4.8,
    description: 'Cobblestone hilltop village, white-domed basilica, and panoramic Paris views.',
    openingHours: '06:00 – 22:30',
    indoor: false, openHour: 6, closeHour: 22,
  },
  {
    id: 'pa5', city: 'Paris', name: 'Sainte-Chapelle', category: 'Historic',
    tags: ['Gothic', 'Stained Glass'], vibes: ['cultural'],
    image: 'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=800&q=80',
    cost: 170000, priceRange: { min: 170000, max: 170000 }, durationMin: 60, distanceKm: 1.2,
    lat: 48.8555, lng: 2.3450, rating: 4.8,
    description: 'The most dazzling stained glass windows in the world — 15th-century Gothic masterpiece.',
    openingHours: '09:00 – 17:00',
    indoor: true, openHour: 9, closeHour: 17,
  },
  {
    id: 'pa6', city: 'Paris', name: "Marché des Enfants Rouges", category: 'Hidden Gem',
    tags: ['Food Market', 'Local'], vibes: ['cafe', 'activities'],
    image: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?auto=format&fit=crop&w=800&q=80',
    cost: 100000, priceRange: { min: 40000, max: 200000 }, durationMin: 60, distanceKm: 2.8,
    lat: 48.8632, lng: 2.3596, rating: 4.6,
    description: "Paris's oldest covered market (1628) — Moroccan couscous, Japanese bento, fresh oysters.",
    openingHours: '08:30 – 21:00',
    indoor: true, openHour: 8, closeHour: 21,
  },
  {
    id: 'pa7', city: 'Paris', name: 'Jardin du Luxembourg', category: 'Nature',
    tags: ['Garden', 'Peaceful'], vibes: ['nature'],
    image: 'https://images.unsplash.com/photo-1555992643-c6b79e7f3f7d?auto=format&fit=crop&w=800&q=80',
    cost: 15000, priceRange: { min: 0, max: 30000 }, durationMin: 75, distanceKm: 1.8,
    lat: 48.8462, lng: 2.3372, rating: 4.7,
    description: 'Senate gardens with model sailboats, sculptures, and the finest picnic lawn in Paris.',
    openingHours: '07:30 – 21:30',
    indoor: false, openHour: 7, closeHour: 21,
  },
  {
    id: 'pa8', city: 'Paris', name: "Musée d'Orsay", category: 'Cultural',
    tags: ['Impressionism', 'Art'], vibes: ['cultural'],
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
    cost: 250000, priceRange: { min: 250000, max: 250000 }, durationMin: 120, distanceKm: 1.5,
    lat: 48.8600, lng: 2.3266, rating: 4.8,
    description: 'Monet, Renoir, Van Gogh — the world\'s best Impressionist collection in a converted train station.',
    openingHours: '09:30 – 18:00',
    indoor: true, openHour: 9, closeHour: 18,
  },
  {
    id: 'pa9', city: 'Paris', name: 'Canal Saint-Martin', category: 'Cozy',
    tags: ['Waterside', 'Trendy'], vibes: ['nature', 'cafe'],
    image: 'https://images.unsplash.com/photo-1564594736005-f2bdb0e93a16?auto=format&fit=crop&w=800&q=80',
    cost: 60000, priceRange: { min: 20000, max: 120000 }, durationMin: 60, distanceKm: 3.8,
    lat: 48.8726, lng: 2.3635, rating: 4.6,
    description: 'Iron footbridges, canal-side picnics, and indie cafes — the hipster heart of Paris.',
    openingHours: '00:00 – 24:00',
    indoor: false, openHour: 0, closeHour: 24,
  },
  {
    id: 'pa10', city: 'Paris', name: 'Le Marais District', category: 'Cultural',
    tags: ['Fashion', 'History'], vibes: ['activities', 'cultural'],
    image: 'https://images.unsplash.com/photo-1571863533956-01c88e79957e?auto=format&fit=crop&w=800&q=80',
    cost: 80000, priceRange: { min: 30000, max: 200000 }, durationMin: 90, distanceKm: 2.0,
    lat: 48.8579, lng: 2.3573, rating: 4.6,
    description: 'Medieval quarter with the Place des Vosges, trendy boutiques, and the best falafel.',
    openingHours: '10:00 – 20:00',
    indoor: false, openHour: 10, closeHour: 20,
  },
];

export function parseOpenHour(s: string): number {
  const m = s.match(/(\d+):(\d+)/); return m ? parseInt(m[1]) : 0;
}
export function parseCloseHour(s: string): number {
  const m = s.match(/\d+:\d+.*?(\d+):(\d+)/); return m ? parseInt(m[1]) : 24;
}

export function pickDayItinerary(
  vibe: Vibe,
  budget: number,
  dayIndex: number,
  usedIds: Set<string>,
  maxStops = 3,
  indoorOnly = false,
  city?: string,
): Place[] {
  // Use city-specific places when available
  const cityPool = city
    ? PLACES.filter((p) => city.toLowerCase().includes(p.city.toLowerCase()))
    : [];
  const pool = cityPool.length > 0 ? cityPool : PLACES;

  let candidates = pool.filter(
    (p) => (vibe === 'balanced' || p.vibes.includes(vibe))
      && p.cost <= budget
      && (!indoorOnly || p.indoor)
      && !usedIds.has(p.id),
  ).sort((a, b) => b.rating - a.rating);

  if (candidates.length < maxStops) {
    const offset = dayIndex % Math.max(1, pool.length);
    const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
    rotated.forEach((p) => {
      if (candidates.length < maxStops && !candidates.find((x) => x.id === p.id)) candidates.push(p);
    });
  }
  return candidates.slice(0, Math.max(0, maxStops));
}

export function pickItinerary(vibe: Vibe, budget: number, indoorOnly = false): Place[] {
  let candidates = PLACES.filter(
    (p) => (vibe === 'balanced' || p.vibes.includes(vibe)) && p.cost <= budget && (!indoorOnly || p.indoor),
  ).sort((a, b) => b.rating - a.rating);

  if (candidates.length < 3) {
    PLACES.forEach((p) => {
      if (candidates.length < 3 && !candidates.find((x) => x.id === p.id)) candidates.push(p);
    });
  }

  const count = 3 + (vibe === 'activities' ? 1 : 0);
  return candidates.slice(0, Math.min(count, candidates.length));
}
