export type CulturalTipType = 'dress' | 'etiquette' | 'avoid' | 'fact';

export interface CulturalTip {
  icon: string;
  type: CulturalTipType;
  title: string;
  body: string;
}

export interface CulturalIntel {
  prompt: string;
  accentColor: string; // tailwind bg color class
  tips: CulturalTip[];
}

// Keyed by place ID first, then category as fallback
export const CULTURAL_INTEL: Record<string, CulturalIntel> = {
  // ── Place-specific ─────────────────────────────────────────
  p2: {
    prompt: 'Before entering Tirta Empul…',
    accentColor: '#F59E0B',
    tips: [
      { icon: '👗', type: 'dress', title: 'Sarong required', body: 'A sarong and sash must be worn to enter. They can be borrowed for free at the entrance gate.' },
      { icon: '🤫', type: 'etiquette', title: 'Speak softly inside', body: 'Locals may be actively praying at the spring. Keep voices low and move calmly.' },
      { icon: '🚫', type: 'avoid', title: 'Don\'t enter the pools casually', body: 'The purification pools are sacred. Entering without proper intention or attire is disrespectful.' },
      { icon: '✨', type: 'fact', title: 'Fun fact', body: 'The spring has flowed continuously for over 1,000 years and is believed by Balinese Hindus to have healing powers.' },
    ],
  },
  p4: {
    prompt: 'A tip before you visit Ubud Palace',
    accentColor: '#A855F7',
    tips: [
      { icon: '👗', type: 'dress', title: 'Modest clothing expected', body: 'Shoulders and knees should be covered. The palace is still a royal residence — dress respectfully.' },
      { icon: '📸', type: 'etiquette', title: 'Photography is welcome', body: 'Feel free to photograph the carvings and courtyards, but avoid photographing ceremonies in progress.' },
      { icon: '✨', type: 'fact', title: 'Still a living palace', body: 'The Puri Saren Agung is home to the current royal family of Ubud. Traditional dances are performed here nightly.' },
    ],
  },
  p9: {
    prompt: 'Cultural note — Goa Gajah ahead',
    accentColor: '#10B981',
    tips: [
      { icon: '👗', type: 'dress', title: 'Sarong & sash needed', body: 'Required for both men and women. Rentable at entrance, included in the ticket price.' },
      { icon: '📵', type: 'avoid', title: 'No flash photography inside', body: 'Inside the cave, flash photography is not permitted out of respect for the sacred space.' },
      { icon: '✨', type: 'fact', title: '9th century carving', body: 'The gaping face above the cave entrance is a Bhoma (protective demon), carved around 900 AD to guard the sanctuary.' },
    ],
  },
  p1: {
    prompt: 'Ridge walk etiquette',
    accentColor: '#3B5BFF',
    tips: [
      { icon: '🌅', type: 'fact', title: 'Best at sunrise', body: 'The walk is most magical before 8 AM. You\'ll likely have the ridge to yourself and catch golden hour light.' },
      { icon: '🌿', type: 'etiquette', title: 'Stay on the path', body: 'The ridge passes through active rice terraces. Stepping off the path damages the farmers\' irrigation systems.' },
    ],
  },
  p13: {
    prompt: 'Sacred temple ahead — please read',
    accentColor: '#10B981',
    tips: [
      { icon: '👗', type: 'dress', title: 'Full sarong required', body: 'One of Bali\'s holiest temples. Full sarong, sash, and shoulder coverage are mandatory without exception.' },
      { icon: '🦶', type: 'avoid', title: 'Never point feet at shrines', body: 'Sitting or standing with feet aimed toward an altar or shrine is deeply offensive in Balinese culture.' },
      { icon: '✨', type: 'fact', title: 'Rarely visited', body: 'Fewer than 5% of Bali tourists visit this temple, making it one of the most authentic and uncrowded sacred sites on the island.' },
    ],
  },
  p15: {
    prompt: 'Remote sacred site — prepare yourself',
    accentColor: '#10B981',
    tips: [
      { icon: '👗', type: 'dress', title: 'Full traditional dress', body: 'This deeply sacred site requires sarong, sash, and shoulder coverage. Guides recommend long sleeves.' },
      { icon: '🤫', type: 'etiquette', title: 'Silence is respected', body: 'Few tourists visit — locals here take ceremony seriously. Let silence and observation guide your experience.' },
      { icon: '✨', type: 'fact', title: 'One of the 9 Directional Temples', body: 'Pura Luhur Batukaru is one of Bali\'s Sad Kahyangan — the six most important temples on the island.' },
    ],
  },

  // ── Category fallbacks ──────────────────────────────────────
  Cultural: {
    prompt: 'Cultural etiquette for this stop',
    accentColor: '#F59E0B',
    tips: [
      { icon: '👗', type: 'dress', title: 'Dress modestly', body: 'Cover shoulders and knees at cultural sites. Lightweight linen fabrics work well in Bali\'s heat.' },
      { icon: '🤝', type: 'etiquette', title: 'Balinese greeting', body: '"Om Swastiastu" with a slight bow and pressed palms is the traditional greeting. Locals will appreciate the effort.' },
      { icon: '🚫', type: 'avoid', title: 'Don\'t touch offerings', body: 'Canang sari (small woven baskets) placed on streets and shrines are sacred — never step on or move them.' },
    ],
  },
  Historic: {
    prompt: 'Before you explore this historic site',
    accentColor: '#A855F7',
    tips: [
      { icon: '🚶', type: 'etiquette', title: 'Walk, don\'t run', body: 'Historic and sacred spaces call for a measured pace. Rushing through shows disrespect to the site and locals.' },
      { icon: '✨', type: 'fact', title: 'Tip for photos', body: 'Visit in the first 30 minutes after opening for the best light and fewest crowds.' },
    ],
  },
  Nature: {
    prompt: 'Respect nature — a quick note',
    accentColor: '#10B981',
    tips: [
      { icon: '🌿', type: 'etiquette', title: 'Leave no trace', body: 'Bali\'s natural sites are considered sacred. Carry out all waste and stay on marked paths.' },
      { icon: '✨', type: 'fact', title: 'Early bird advantage', body: 'Most natural sites are at their best before 8 AM — cooler, quieter, and dramatically lit.' },
    ],
  },
  Cafe: {
    prompt: 'Local café customs',
    accentColor: '#F97316',
    tips: [
      { icon: '🤝', type: 'etiquette', title: 'Greet the staff', body: '"Selamat pagi" (good morning) or "Terima kasih" (thank you) is always warmly received by local staff.' },
      { icon: '✨', type: 'fact', title: 'Tipping culture', body: 'Service charge is rarely included in local cafés. A Rp 5,000–15,000 tip is generous and deeply appreciated.' },
    ],
  },
  Foodie: {
    prompt: 'Before you eat here…',
    accentColor: '#EF4444',
    tips: [
      { icon: '✋', type: 'etiquette', title: 'Right hand for eating', body: 'In Balinese and Indonesian culture, the right hand is used for eating and passing food.' },
      { icon: '🐷', type: 'avoid', title: 'Clarify dietary needs early', body: 'Bali is predominantly Hindu — pork is common. Always ask early if you need halal, vegetarian, or allergen-free options.' },
      { icon: '✨', type: 'fact', title: 'Sharing is natural', body: 'Indonesian meals are traditionally shared family-style. Ordering a few dishes for the table is perfectly normal.' },
    ],
  },
  'Hidden Gem': {
    prompt: 'You\'ve found a hidden gem',
    accentColor: '#3B5BFF',
    tips: [
      { icon: '📵', type: 'etiquette', title: 'Keep it quiet', body: 'Hidden spots stay hidden when visitors are respectful. Keep noise low and avoid mass social media geotags.' },
      { icon: '✨', type: 'fact', title: 'Support local', body: 'These spots are usually family-run. Buying directly supports local livelihoods — skip the middleman apps.' },
    ],
  },
};

export function getCulturalIntel(placeId: string, category: string): CulturalIntel | null {
  return CULTURAL_INTEL[placeId] ?? CULTURAL_INTEL[category] ?? null;
}
