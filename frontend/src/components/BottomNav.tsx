import { Home, MapPin, Wallet, User, Navigation, CalendarDays } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';

export default function BottomNav() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/navigate')) return null;

  return (
    <>
      <NavigationBar />
      <div className="absolute inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
        <div className="bg-white border-t border-ink-100 grid grid-cols-5 px-2 pt-1 pb-3 items-end overflow-visible">
          <NavTab to="/" icon={Home} label="Home" />
          <NavTab to="/map" icon={MapPin} label="Map" />
          <CenterNavTab to="/trips" />
          <NavTab to="/wallet" icon={Wallet} label="Wallet" />
          <NavTab to="/profile" icon={User} label="Profile" />
        </div>
      </div>
    </>
  );
}

// ── Persistent navigation pill — shown at TOP when navigating from non-navigate pages ──
function NavigationBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { isNavigating, itinerary, navIndex } = useApp();

  if (!isNavigating || pathname === '/navigate') return null;

  const current = itinerary[navIndex];

  return (
    <AnimatePresence>
      <motion.div
        key="nav-pill"
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -48, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="absolute inset-x-4 top-10 z-50"
      >
        <button
          onClick={() => nav('/navigate')}
          className="w-full bg-brand-500 rounded-2xl shadow-glow press flex items-center gap-3 px-4 py-2.5"
        >
          <motion.span
            animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0.3, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="block w-2 h-2 rounded-full bg-white shrink-0"
          />
          <Navigation className="w-4 h-4 text-white shrink-0" />
          <span className="flex-1 text-white font-semibold text-sm truncate text-left">
            Navigating to {current?.name ?? 'stop'}
          </span>
          <span className="text-white/70 text-xs shrink-0">Tap to open →</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

function CenterNavTab({ to }: { to: string }) {
  return (
    <NavLink to={to} className="flex flex-col items-center gap-1 -translate-y-3">
      {({ isActive }) => (
        <>
          <span className={`w-14 h-14 rounded-full flex items-center justify-center shadow-glow transition-colors ${isActive ? 'bg-brand-600' : 'bg-brand-500'}`}>
            <CalendarDays className="w-7 h-7 text-white" strokeWidth={2} />
          </span>
          <span className={`text-[11px] font-semibold ${isActive ? 'text-brand-700' : 'text-brand-500'}`}>My Plan</span>
        </>
      )}
    </NavLink>
  );
}

function NavTab({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-brand-500' : 'text-ink-400'}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="w-6 h-6" strokeWidth={isActive ? 2.6 : 2} />
          <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}


