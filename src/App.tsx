import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import PhoneFrame from './components/PhoneFrame';
import BottomNav from './components/BottomNav';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/Toast';
import Buddy from './components/Buddy';
import { motion } from 'framer-motion';
import { buddyImg } from './assets/images';

import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import GeneratePage from './pages/GeneratePage';
import MapPage from './pages/MapPage';
import NavigatePage from './pages/NavigatePage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import TripsPage from './pages/TripsPage';

function AppShell() {
  const { onboardingComplete, buddyOpen, setBuddyOpen } = useApp();
  const { pathname } = useLocation();

  const hideChrome = pathname.startsWith('/onboarding');
  const hideNav = pathname.startsWith('/navigate') || hideChrome;
  const hideBuddy = hideChrome || pathname.startsWith('/generate') || pathname.startsWith('/navigate');

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
          onClick={() => setBuddyOpen(true)}
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
