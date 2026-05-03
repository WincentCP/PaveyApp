import { Home, MapPin, Wallet, User, Smile, Navigation, X } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';

interface Props {
  onBuddyOpen: () => void;
}

export default function BottomNav({ onBuddyOpen }: Props) {
  const { pathname } = useLocation();
  if (pathname.startsWith('/navigate')) return null;

  return (
    <>
      <NavigationBar />
      <div className="absolute inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
        <div className="relative">
          <div className="absolute inset-x-0 -top-6 flex justify-center pointer-events-none">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.04 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              onClick={onBuddyOpen}
              className="pointer-events-auto w-16 h-16 rounded-full bg-brand-500 text-white shadow-glow flex items-center justify-center ring-4 ring-white"
              aria-label="Open Buddy"
            >
              <Smile className="w-7 h-7" strokeWidth={2.4} />
            </motion.button>
          </div>

          <div className="bg-white border-t border-ink-100 grid grid-cols-5 px-2 pt-3 pb-3">
            <NavTab to="/" icon={Home} label="Home" />
            <NavTab to="/map" icon={MapPin} label="Map" />
            <div />
            <NavTab to="/wallet" icon={Wallet} label="Wallet" />
            <NavTab to="/profile" icon={User} label="Profile" />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Persistent navigation bar — shows when navigating from non-navigate pages ──
function NavigationBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { isNavigating, itinerary, navIndex, setIsNavigating } = useApp();

  if (!isNavigating || pathname === '/navigate') return null;

  const current = itinerary[navIndex];
  const next = itinerary[navIndex + 1];

  // Estimate remaining from navIndex
  const stopsLeft = itinerary.length - navIndex;

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNavigating(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="nav-bar"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="absolute inset-x-0 bottom-[72px] z-30 px-4"
      >
        <button
          onClick={() => nav('/navigate')}
          className="w-full bg-brand-500 rounded-2xl shadow-glow overflow-hidden press"
        >
          {/* Progress bar at top */}
          <div className="h-1 bg-white/20">
            <motion.div
              className="h-full bg-white/70"
              initial={{ width: `${(navIndex / Math.max(itinerary.length, 1)) * 100}%` }}
              animate={{ width: `${(navIndex / Math.max(itinerary.length, 1)) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            {/* Navigation icon pulsing */}
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 relative">
              <motion.span
                className="absolute inset-0 rounded-full bg-white/20"
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
              <Navigation className="w-5 h-5 text-white" />
            </div>

            <div className="flex-1 min-w-0 text-left">
              <div className="text-white/80 text-[11px] font-semibold uppercase tracking-wide">
                Navigating to
              </div>
              <div className="text-white font-bold text-sm leading-tight truncate">
                {current?.name ?? 'Current stop'}
              </div>
              {next && (
                <div className="text-white/60 text-[11px] truncate">
                  Then: {next.name}
                </div>
              )}
            </div>

            <div className="text-right shrink-0 mr-1">
              <div className="text-white font-bold text-sm">{stopsLeft}</div>
              <div className="text-white/70 text-[11px]">stop{stopsLeft !== 1 ? 's' : ''} left</div>
            </div>

            {/* Cancel button */}
            <button
              onClick={handleCancel}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center press shrink-0"
              aria-label="Cancel navigation"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </button>
      </motion.div>
    </AnimatePresence>
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
