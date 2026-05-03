import { useState } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import PhoneFrame from './components/PhoneFrame';
import BottomNav from './components/BottomNav';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/Toast';
import Buddy from './components/Buddy';

import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import GeneratePage from './pages/GeneratePage';
import TransitionPage from './pages/TransitionPage';
import MapPage from './pages/MapPage';
import NavigatePage from './pages/NavigatePage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';

function AppShell() {
  const [buddyOpen, setBuddyOpen] = useState(false);
  const { onboardingComplete } = useApp();
  const { pathname } = useLocation();

  const hideChrome = pathname.startsWith('/onboarding') || pathname === '/transition';
  const hideNav = pathname.startsWith('/navigate') || hideChrome;

  return (
    <div className="flex-1 relative overflow-hidden">
      <Routes>
        {/* Onboarding / auth — always accessible */}
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Guard: redirect to onboarding until complete */}
        {!onboardingComplete && (
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        )}

        {/* Main app routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/transition" element={<TransitionPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/navigate" element={<NavigatePage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!hideNav && <BottomNav onBuddyOpen={() => setBuddyOpen(true)} />}
      {!hideChrome && <Buddy open={buddyOpen} onClose={() => setBuddyOpen(false)} />}
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
