import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Mail, Phone, MapPin, ChevronRight, Bookmark, Clock, CreditCard, HelpCircle, X, Crown,
  Compass, Sparkles, TrendingDown, Star, Target,
} from 'lucide-react';
import { useState } from 'react';
import StatusBar from '../components/StatusBar';
import { USER } from '../data/user';
import { formatRp } from '../lib/format';
import { useApp } from '../context/AppContext';

const STAT_CARDS = [
  {
    id: 'trips',
    label: 'Trips Completed',
    icon: Compass,
    color: '#3B5BFF',
    bg: '#EEF2FF',
    value: 12,
    display: '12',
    trend: '+2 this month',
    barPct: 0.48,
  },
  {
    id: 'places',
    label: 'Places Explored',
    icon: Sparkles,
    color: '#10B981',
    bg: '#ECFDF5',
    value: 47,
    display: '47',
    trend: '+5 this week',
    barPct: 0.72,
  },
  {
    id: 'gems',
    label: 'Hidden Gems',
    icon: Star,
    color: '#A855F7',
    bg: '#F5F3FF',
    value: 28,
    display: '28',
    trend: '4 away from badge',
    barPct: 0.56,
  },
  {
    id: 'saved',
    label: 'Money Saved',
    icon: TrendingDown,
    color: '#F59E0B',
    bg: '#FFFBEB',
    value: 450000,
    display: formatRp(450000),
    trend: 'vs standard prices',
    barPct: 0.65,
  },
];

const RECENT_TRIPS = [
  { name: 'Ubud Trip', date: 'Apr 28', days: 5, spent: 2_100_000, places: 12 },
  { name: 'Seminyak Weekend', date: 'Apr 12', days: 2, spent: 1_400_000, places: 7 },
  { name: 'Nusa Penida Day', date: 'Mar 30', days: 1, spent: 650_000, places: 4 },
];

export default function ProfilePage() {
  const { visited, savedPlaces } = useApp();
  const [statDetail, setStatDetail] = useState<null | string>(null);
  const totalPlaces = USER.stats.placesExplored + visited.size;

  return (
    <div className="absolute inset-0 bg-white overflow-y-auto pb-32 no-scrollbar">
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <div className="font-bold text-ink-900 text-lg font-display">PROFILE</div>
        <button className="w-9 h-9 rounded-full bg-ink-50 flex items-center justify-center press">
          <Settings className="w-4 h-4 text-ink-700" />
        </button>
      </div>

      {/* User card */}
      <div className="px-5">
        <div className="bg-white rounded-3xl p-4 border border-ink-100 shadow-soft flex gap-3">
          <motion.img whileHover={{ scale: 1.04 }} src={USER.avatar} alt="me" className="w-16 h-16 rounded-2xl object-cover" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="font-bold text-ink-900 font-display">{USER.name}</div>
              <button className="text-xs text-brand-600 font-semibold press">Edit</button>
            </div>
            <div className="text-xs text-ink-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {USER.location}</div>
            <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {USER.email}</div>
            <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {USER.phone}</div>
          </div>
        </div>
      </div>

      {/* Persona progress */}
      <div className="px-5 mt-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-br from-purple-50 to-brand-50 p-4 flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-2xl bg-white shadow-soft flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Persona Traveler</div>
            <div className="font-bold text-ink-900">{USER.persona.title}</div>
            <div className="mt-2 h-1.5 bg-white/70 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${USER.persona.progress * 100}%` }} transition={{ duration: 0.8 }} className="h-full bg-gradient-to-r from-brand-500 to-purple-500" />
            </div>
            <div className="text-[10px] text-ink-500 mt-1">
              {Math.round(USER.persona.progress * 100)}% · Next: <span className="font-semibold text-purple-600">{USER.persona.nextLevel}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-400 shrink-0" />
        </motion.div>
      </div>

      {/* Stats — visual cards */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-ink-900 font-display">My Stats</div>
          <button className="text-xs text-brand-600 font-semibold press">Full report ›</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {STAT_CARDS.map((s, i) => {
            const Icon = s.icon;
            const displayVal = s.id === 'places' ? totalPlaces : s.id === 'trips' ? USER.stats.trips : s.id === 'gems' ? USER.stats.hiddenGems : s.display;
            return (
              <motion.button
                key={s.id}
                whileTap={{ scale: 0.96 }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => setStatDetail(s.id)}
                className="rounded-2xl p-4 text-left press overflow-hidden relative"
                style={{ background: s.bg }}
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.color + '20' }}>
                  <Icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                {/* Value */}
                <div className="text-2xl font-extrabold text-ink-900 font-display leading-none">
                  {typeof displayVal === 'number' ? displayVal : displayVal}
                </div>
                <div className="text-xs font-semibold text-ink-600 mt-1">{s.label}</div>
                {/* Mini bar */}
                <div className="mt-2.5 h-1 rounded-full bg-black/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${s.barPct * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.1 * i }}
                    className="h-full rounded-full"
                    style={{ background: s.color }}
                  />
                </div>
                <div className="text-[10px] mt-1" style={{ color: s.color }}>{s.trend}</div>
                {/* Decorative circle */}
                <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full opacity-20" style={{ background: s.color }} />
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Recent Trips */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-ink-900 font-display">Recent Trips</div>
          <button className="text-xs text-brand-600 font-semibold press">See all ›</button>
        </div>
        <div className="space-y-2">
          {RECENT_TRIPS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 bg-white border border-ink-100 rounded-2xl px-4 py-3 press"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink-900 text-sm">{t.name}</div>
                <div className="text-xs text-ink-500 flex items-center gap-1.5 mt-0.5">
                  <span>{t.date}</span>
                  <span className="text-ink-300">·</span>
                  <span>{t.days}d</span>
                  <span className="text-ink-300">·</span>
                  <span>{t.places} places</span>
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

      {/* Badges */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-ink-900 font-display">My Badges</div>
          <button className="text-xs text-brand-600 font-semibold press">See all ›</button>
        </div>
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
                style={{ background: `linear-gradient(180deg, ${b.color} 0%, ${b.color}AA 100%)`, clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)' }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-2xl">{b.icon}</div>
              </div>
              <div className="text-[10px] font-bold text-ink-900 mt-1 leading-tight">{b.name}</div>
              <div className="text-[9px] text-ink-500">{b.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Settings list */}
      <div className="px-5 mt-5 space-y-2">
        <Row icon={<Bookmark className="w-4 h-4" />} label="Saved Places" badge={savedPlaces.length > 0 ? savedPlaces.length : undefined} />
        <Row icon={<Clock className="w-4 h-4" />} label="Travel History" />
        <Row icon={<CreditCard className="w-4 h-4" />} label="Payment Methods" />
        <Row icon={<HelpCircle className="w-4 h-4" />} label="Help & Support" />
      </div>

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
                  trips: 'You\'ve completed 12 trips. Your most explored region is Bali (5 trips). Your average trip lasts 4 days.',
                  places: `You've visited ${totalPlaces} unique places. Cafes are your favorite category (38%).`,
                  gems: '28 hidden gems unlocked. You\'re 4 away from "Hidden Gem Hunter" badge!',
                  saved: 'You\'ve saved Rp 450K thanks to deal alerts and budget-aware planning. Keep it up!',
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
