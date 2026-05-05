import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Mail, Phone, MapPin, ChevronRight, Bookmark, Clock, CreditCard, HelpCircle, X, Crown,
  Compass, Footprints, TrendingDown, Star, LogOut, User,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import PageHeader from '../components/PageHeader';
import { USER } from '../data/user';
import { formatRp } from '../lib/format';
import { useApp } from '../context/AppContext';

const RECENT_TRIPS = [
  { name: 'Ubud Trip', date: 'Apr 28', days: 5, spent: 2_100_000, places: 12 },
  { name: 'Seminyak Weekend', date: 'Apr 12', days: 2, spent: 1_400_000, places: 7 },
  { name: 'Nusa Penida Day', date: 'Mar 30', days: 1, spent: 650_000, places: 4 },
];

const LOCKED_BADGES = [
  { id: 'explorer', name: 'Explorer', sub: 'Visit 5 places', icon: '🗺️', color: '#E5E7EB' },
  { id: 'foodie', name: 'Foodie', sub: 'Try 3 restaurants', icon: '🍜', color: '#E5E7EB' },
  { id: 'gem', name: 'Gem Hunter', sub: 'Find hidden gems', icon: '💎', color: '#E5E7EB' },
  { id: 'culture', name: 'Culture Kid', sub: 'Visit 2 temples', icon: '🏛️', color: '#E5E7EB' },
];

const DEST_FLAG: Record<string, string> = {
  bali: '🇮🇩', indonesia: '🇮🇩', jakarta: '🇮🇩',
  japan: '🇯🇵', tokyo: '🇯🇵', osaka: '🇯🇵', kyoto: '🇯🇵',
  france: '🇫🇷', paris: '🇫🇷',
  singapore: '🇸🇬',
  usa: '🇺🇸', 'new york': '🇺🇸', 'los angeles': '🇺🇸',
  australia: '🇦🇺', sydney: '🇦🇺', melbourne: '🇦🇺',
  thailand: '🇹🇭', bangkok: '🇹🇭',
  korea: '🇰🇷', seoul: '🇰🇷',
};

function getFlag(destination: string): string {
  const lower = destination.toLowerCase();
  for (const [key, flag] of Object.entries(DEST_FLAG)) {
    if (lower.includes(key)) return flag;
  }
  return '🗺️';
}

export default function ProfilePage() {
  const { visited, savedPlaces, logout, transactions, authUser, trips, visitedPlaceIds } = useApp();
  const nav = useNavigate();
  const [statDetail, setStatDetail] = useState<null | string>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const totalPlaces = Math.max(visited.size, visitedPlaceIds.size);
  const userTrips = trips.filter((t) => t.id !== 'trip-default');
  const isNewUser = visited.size === 0 && transactions.length === 0;
  const displayName = authUser?.name?.split(' ')[0] ?? USER.firstName;
  const displayEmail = authUser?.email ?? USER.email;

  const handleLogout = () => {
    logout();
    nav('/onboarding', { replace: true });
  };

  const STAT_CARDS = [
    {
      id: 'trips',
      label: 'Trips Completed',
      icon: Compass,
      color: '#3B5BFF',
      bg: '#EEF2FF',
      value: isNewUser ? 0 : USER.stats.trips,
      display: isNewUser ? '0' : String(USER.stats.trips),
      trend: isNewUser ? 'Start your first trip' : '+2 this month',
      barPct: isNewUser ? 0 : 0.48,
    },
    {
      id: 'places',
      label: 'Places Explored',
      icon: Footprints,
      color: '#10B981',
      bg: '#ECFDF5',
      value: totalPlaces,
      display: String(totalPlaces),
      trend: isNewUser ? 'No places yet' : `${totalPlaces} unique spots`,
      barPct: isNewUser ? 0 : Math.min(1, totalPlaces / 50),
    },
    {
      id: 'gems',
      label: 'Hidden Gems',
      icon: Star,
      color: '#A855F7',
      bg: '#F5F3FF',
      value: isNewUser ? 0 : USER.stats.hiddenGems,
      display: isNewUser ? '0' : String(USER.stats.hiddenGems),
      trend: isNewUser ? 'Explore to find gems' : '4 away from badge',
      barPct: isNewUser ? 0 : 0.56,
    },
    {
      id: 'saved',
      label: 'Saved Places',
      icon: TrendingDown,
      color: '#F59E0B',
      bg: '#FFFBEB',
      value: savedPlaces.length,
      display: String(savedPlaces.length),
      trend: savedPlaces.length === 0 ? 'Save places to revisit' : `${savedPlaces.length} saved`,
      barPct: isNewUser ? 0 : Math.min(1, savedPlaces.length / 20),
    },
  ];

  return (
    <div className="absolute inset-0 bg-white overflow-y-auto pb-32 no-scrollbar">
      <StatusBar />

      {/* Header */}
      <PageHeader
        icon={User}
        title="Profile"
        right={
          <button className="w-9 h-9 rounded-full bg-ink-50 flex items-center justify-center press">
            <Settings className="w-4 h-4 text-ink-700" />
          </button>
        }
      />

      {/* User card */}
      <div className="px-5">
        <div className="bg-white rounded-3xl p-4 border border-ink-100 shadow-soft flex gap-3">
          <motion.img whileHover={{ scale: 1.04 }} src={USER.avatar} alt="me" className="w-16 h-16 rounded-2xl object-cover" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="font-bold text-ink-900 font-display truncate">{displayName}</div>
              <button className="text-xs text-brand-600 font-semibold press shrink-0 ml-2">Edit</button>
            </div>
            <div className="text-xs text-ink-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" /> {USER.location}</div>
            <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{displayEmail}</span></div>
            <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3 shrink-0" /> {USER.phone}</div>
          </div>
        </div>
      </div>

      {/* Persona progress — hide if new user */}
      {!isNewUser && (
        <div className="px-5 mt-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-brand-50 border border-brand-100 p-4 flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-2xl bg-white shadow-soft flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Persona Traveler</div>
              <div className="font-bold text-ink-900">{USER.persona.title}</div>
              <div className="mt-2 h-1.5 bg-white/70 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${USER.persona.progress * 100}%` }} transition={{ duration: 0.8 }} className="h-full bg-brand-500 rounded-full" />
              </div>
              <div className="text-[10px] text-ink-500 mt-1">
                {Math.round(USER.persona.progress * 100)}% · Next: <span className="font-semibold text-purple-600">{USER.persona.nextLevel}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-400 shrink-0" />
          </motion.div>
        </div>
      )}

      {/* New user welcome banner */}
      {isNewUser && (
        <div className="px-5 mt-3">
          <div className="rounded-3xl bg-brand-50 border border-brand-100 p-4 flex items-center gap-3">
            <div className="text-3xl shrink-0">✈️</div>
            <div>
              <div className="font-bold text-ink-900 text-sm">Ready to explore?</div>
              <div className="text-xs text-ink-500 mt-0.5 leading-relaxed">Your stats, badges, and journey history will appear here as you travel.</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-ink-900 font-display">My Stats</div>
          {!isNewUser && <button className="text-xs text-brand-600 font-semibold press">Full report ›</button>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {STAT_CARDS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.button
                key={s.id}
                whileTap={{ scale: 0.96 }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => !isNewUser && setStatDetail(s.id)}
                className="rounded-2xl p-4 text-left press overflow-hidden relative"
                style={{ background: s.bg }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.color + '20' }}>
                  <Icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-extrabold text-ink-900 font-display leading-none">{s.display}</div>
                <div className="text-xs font-semibold text-ink-600 mt-1">{s.label}</div>
                <div className="mt-2.5 h-1 rounded-full bg-black/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${s.barPct * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.1 * i }}
                    className="h-full rounded-full"
                    style={{ background: s.color }}
                  />
                </div>
                <div className="text-[10px] mt-1" style={{ color: s.color }}>{s.trend}</div>
                <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full opacity-20" style={{ background: s.color }} />
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Passport — Your Trips */}
      {(userTrips.length > 0 || !isNewUser) && (
        <div className="px-5 mt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-ink-900 font-display">My Passport</div>
            <span className="text-xs text-ink-400">{userTrips.length} trip{userTrips.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {userTrips.map((t, i) => {
              const flag = getFlag(t.destination);
              const totalSpent = t.transactions.filter((x) => x.amount < 0).reduce((s, x) => s + Math.abs(x.amount), 0);
              const dateStr = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 bg-white border-l-4 border-brand-500 border border-ink-100 rounded-2xl px-4 py-3"
                >
                  <div className="text-2xl shrink-0">{flag}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-ink-900 text-sm leading-snug">{t.name}</div>
                    <div className="text-[10px] text-ink-500 uppercase tracking-wider mt-0.5">{t.destination}</div>
                    <div className="text-xs text-ink-400 mt-0.5">Visited {dateStr} · {t.daysTotal}d</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-ink-900">{formatRp(totalSpent)}</div>
                    <div className="text-[10px] text-ink-400">spent</div>
                  </div>
                </motion.div>
              );
            })}
            {/* Static past trips if no real trips */}
            {userTrips.length === 0 && !isNewUser && RECENT_TRIPS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 bg-white border-l-4 border-ink-300 border border-ink-100 rounded-2xl px-4 py-3"
              >
                <div className="text-2xl">🇮🇩</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-900 text-sm">{t.name}</div>
                  <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5">
                    <span>{t.date}</span> · <span>{t.days}d</span> · <span>{t.places} places</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-ink-900">{formatRp(t.spent)}</div>
                  <div className="text-[10px] text-ink-400">spent</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-ink-900 font-display">My Badges</div>
          {!isNewUser && <button className="text-xs text-brand-600 font-semibold press">See all ›</button>}
        </div>
        {isNewUser ? (
          <div className="grid grid-cols-4 gap-2">
            {LOCKED_BADGES.map((b) => (
              <div key={b.id} className="bg-ink-50 border border-ink-100 rounded-2xl p-2 text-center opacity-60">
                <div className="relative mx-auto w-12 h-14 bg-ink-200 rounded-xl flex items-center justify-center">
                  <span className="text-2xl grayscale opacity-40">{b.icon}</span>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-ink-400 text-lg">🔒</span>
                  </div>
                </div>
                <div className="text-[10px] font-bold text-ink-500 mt-1 leading-tight">{b.name}</div>
                <div className="text-[9px] text-ink-400">{b.sub}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {USER.badges.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i, type: 'spring', stiffness: 360, damping: 18 }}
                className="bg-white border border-ink-100 rounded-2xl p-2 text-center"
              >
                <div
                  className="relative mx-auto w-12 h-14"
                  style={{ background: b.color, clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)' }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">{b.icon}</div>
                </div>
                <div className="text-[10px] font-bold text-ink-900 mt-1 leading-tight">{b.name}</div>
                <div className="text-[9px] text-ink-500">{b.sub}</div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Settings list */}
      <div className="px-5 mt-5 space-y-2">
        <Row icon={<Bookmark className="w-4 h-4" />} label="Saved Places" badge={savedPlaces.length > 0 ? savedPlaces.length : undefined} />
        <Row icon={<Clock className="w-4 h-4" />} label="Travel History" />
        <Row icon={<CreditCard className="w-4 h-4" />} label="Payment Methods" />
        <Row icon={<HelpCircle className="w-4 h-4" />} label="Help & Support" />
      </div>

      {/* Logout */}
      <div className="px-5 mt-4 mb-2">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center gap-3 press"
        >
          <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <LogOut className="w-4 h-4" />
          </span>
          <span className="flex-1 text-left text-sm font-semibold text-red-600">Log Out</span>
        </button>
      </div>

      {/* Logout confirmation */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLogoutConfirm(false)} className="absolute inset-0 z-40 bg-ink-900/50" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl p-5 shadow-card"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mb-4" />
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <LogOut className="w-7 h-7 text-red-500" />
              </div>
              <div className="text-center mb-1 font-bold text-ink-900 font-display text-lg">Log out?</div>
              <div className="text-center text-sm text-ink-500 mb-6">You'll be taken back to the welcome screen.</div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowLogoutConfirm(false)} className="h-12 rounded-2xl bg-ink-50 text-ink-700 font-semibold press">Cancel</button>
                <button onClick={handleLogout} className="h-12 rounded-2xl bg-red-500 text-white font-semibold press shadow-sm">Log Out</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Stat detail sheet */}
      <AnimatePresence>
        {statDetail && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setStatDetail(null)} className="absolute inset-0 z-40 bg-ink-900/40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl p-5 shadow-card pb-8"
            >
              <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-ink-900 font-display">Stat Detail</div>
                <button onClick={() => setStatDetail(null)} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
              </div>
              <div className="text-sm text-ink-700 leading-relaxed">
                {{
                  trips: `You've completed ${USER.stats.trips} trips. Your most explored region is Bali (5 trips). Average trip: 4 days.`,
                  places: `You've visited ${totalPlaces} unique places. Cafes are your top category.`,
                  gems: `${USER.stats.hiddenGems} hidden gems found. Keep exploring to unlock more!`,
                  saved: `${savedPlaces.length} place${savedPlaces.length !== 1 ? 's' : ''} saved for later.`,
                }[statDetail]}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ icon, label, badge }: { icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button className="w-full bg-white border border-ink-100 rounded-2xl px-4 py-3 flex items-center gap-3 press">
      <span className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center text-ink-700">{icon}</span>
      <span className="flex-1 text-left text-sm font-semibold text-ink-900">{label}</span>
      {badge !== undefined && (
        <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>
      )}
      <ChevronRight className="w-4 h-4 text-ink-400" />
    </button>
  );
}
