import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useState } from 'react';
import PhoneFrame from './components/PhoneFrame';
import BottomNav from './components/BottomNav';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/Toast';
import Buddy from './components/Buddy';
import { AnimatePresence, motion } from 'framer-motion';
import { buddyImg } from './assets/images';
import { COPY } from './lib/copy';
import { X } from 'lucide-react';

import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import GeneratePage from './pages/GeneratePage';
import MapPage from './pages/MapPage';
import NavigatePage from './pages/NavigatePage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import TripsPage from './pages/TripsPage';

const BUDDY_INTRO_KEY = 'pavey_buddy_intro_seen';

function shouldShowBuddyIntro(): boolean {
  // Show only if the user has never interacted with the intro before.
  // Dismissal writes a timestamp and the bubble never returns.
  try { return !localStorage.getItem(BUDDY_INTRO_KEY); } catch { return false; }
}

function AppShell() {
  const { onboardingComplete, buddyOpen, setBuddyOpen } = useApp();
  const { pathname } = useLocation();
  const [buddyIntroOpen, setBuddyIntroOpen] = useState(() => shouldShowBuddyIntro());

  const dismissBuddyIntro = () => {
    setBuddyIntroOpen(false);
    try { localStorage.setItem(BUDDY_INTRO_KEY, String(Date.now())); } catch { /* ignore */ }
  };

  const hideChrome = pathname.startsWith('/onboarding');
  const hideNav = pathname.startsWith('/navigate') || hideChrome;
  const hideBuddy = hideChrome || pathname.startsWith('/generate') || pathname.startsWith('/navigate');
  // Only show the intro bubble on the home screen.
  const showBuddyIntro = buddyIntroOpen && !hideBuddy && pathname === '/' && !buddyOpen;

  return (
    <div className="flex-1 relative overflow-hidden">
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />

        {!onboardingComplete && (
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        )}

        <Route path="/" element={<HomePage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/navigate" element={<NavigatePage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/trips" element={<TripsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!hideNav && <BottomNav />}

      {/* Buddy floating button — single entry point, visible on all main pages */}
      {!hideBuddy && !hideNav && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          onClick={() => { dismissBuddyIntro(); setBuddyOpen(true); }}
          className="absolute right-3 bottom-24 z-20 w-12 h-12 rounded-full bg-brand-500 shadow-glow overflow-hidden press"
          aria-label="Open Buddy AI"
        >
          {/* buddy.svg: 997 × 1036 px — replace with buddy.png */}
          <img
            src={buddyImg}
            alt="Buddy"
            className="w-full h-full object-cover"
            style={{ aspectRatio: '997/1036' }}
          />
        </motion.button>
      )}

      {/* First-launch intro bubble — anchored above the Buddy button on Home. */}
      <AnimatePresence>
        {showBuddyIntro && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="absolute right-3 bottom-[148px] z-20 max-w-[230px] bg-white rounded-2xl shadow-card border border-ink-100 px-3 py-2.5"
          >
            <button
              onClick={dismissBuddyIntro}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink-900 text-white flex items-center justify-center press"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="text-[11px] font-bold text-brand-600 mb-0.5">Meet Buddy</div>
            <div className="text-xs text-ink-700 leading-snug">{COPY.hints.buddyIntro}</div>
            <div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-white border-r border-b border-ink-100 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {!hideBuddy && <Buddy open={buddyOpen} onClose={() => setBuddyOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <PhoneFrame>
          <AppShell />
        </PhoneFrame>
      </ToastProvider>
    </AppProvider>
  );
}
