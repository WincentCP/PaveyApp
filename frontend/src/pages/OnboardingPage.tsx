import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp,
  Eye, EyeOff, Lock,
  Mail, MapPin, Plus, RefreshCw, User, X,
  Trees, Coffee, Compass, Landmark, Scale, Bell,
  Wallet, Info, AlertTriangle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Vibe } from '../data/places';
import { pickItinerary } from '../data/places';
import { suggestCurrency, CURRENCY_SYMBOLS, CURRENCY_RATES_TO_IDR } from '../data/wallet';
import { splashImg, welcomeImg } from '../assets/images';
import MiniCalendar from '../components/MiniCalendar';
import { apiLogin, apiRegister } from '../lib/api';
import { useToast } from '../components/Toast';

type AuthMode = 'signup' | 'login';
type Step =
  | 'welcome'
  | 'destinations'
  | 'vibe'
  | 'dates'
  | 'preview'
  | 'budget'
  | 'location'
  | 'generating'
  | 'auth_form';

const VIBES: { id: Vibe; label: string; desc: string }[] = [
  { id: 'nature', label: 'Nature', desc: 'Outdoors, parks & scenic spots' },
  { id: 'cafe', label: 'Café', desc: 'Coffee shops, food & cozy hangouts' },
  { id: 'activities', label: 'Activities', desc: 'Fun, adventure & active experiences' },
  { id: 'cultural', label: 'Cultural', desc: 'History, museums & local traditions' },
  { id: 'balanced', label: 'Balanced', desc: 'A bit of everything — no strong preference' },
];

function getVibeIcon(id: Vibe, className = "w-6 h-6") {
  switch (id) {
    case 'nature':
      return <Trees className={className} />;
    case 'cafe':
      return <Coffee className={className} />;
    case 'activities':
      return <Compass className={className} />;
    case 'cultural':
      return <Landmark className={className} />;
    case 'balanced':
    default:
      return <Scale className={className} />;
  }
}

// Round 11 #1 & #2 — destinations comes first (anchors the vibe question),
// dates flow into a preview confirmation, auth is deferred until the user
// has seen a generated plan.
const FLOW: Step[] = ['welcome', 'destinations', 'vibe', 'dates', 'preview', 'budget', 'location', 'generating', 'auth_form'];
const PROGRESS_STEPS: Step[] = ['destinations', 'vibe', 'dates', 'preview', 'budget', 'location'];

const GEN_STEPS = [
  'Finding top-rated spots…',
  'Matching your vibe & budget…',
  'Optimizing your route…',
  'Crafting your perfect day…',
];

export default function OnboardingPage() {
  const nav = useNavigate();
  const { completeOnboarding, onboardingComplete, everOnboarded, setItinerary } = useApp();
  const { show } = useToast();
  const justCompletedRef = useRef(false);

  // Skip onboarding if already authenticated (but not if we just completed it)
  useEffect(() => {
    if (onboardingComplete && !justCompletedRef.current) nav('/', { replace: true });
  }, [onboardingComplete, nav]);

  // After logout (everOnboarded=true, onboardingComplete=false) → start on login screen
  const [step, setStep] = useState<Step>(everOnboarded ? 'auth_form' : 'welcome');
  const [authMode, setAuthMode] = useState<AuthMode>(everOnboarded ? 'login' : 'signup');

  // Auth form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [authErrors, setAuthErrors] = useState<Record<string, string>>({});
  const [authLoading, setAuthLoading] = useState(false);
  // Issue 1: inline validation touch tracking
  const [confirmTouched, setConfirmTouched] = useState(false);
  // Issue 2: auth toggle keeps email notice
  const [justToggled, setJustToggled] = useState(false);

  // Onboarding state
  const [selectedVibe, setSelectedVibe] = useState<Vibe>('balanced');
  const [destInput, setDestInput] = useState('');
  const [destList, setDestList] = useState<{ name: string; days: number }[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [calPhase, setCalPhase] = useState<'start' | 'end'>('start');
  const [budget, setBudget] = useState(500_000);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  // Generating animation state
  const [genPhase, setGenPhase] = useState(0);

  const destInputRef = useRef<HTMLInputElement>(null);

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  }, [startDate, endDate]);

  // Issue 3: currency-aware budget based on first destination
  const budgetCurrency = useMemo(() => destList.length > 0 ? suggestCurrency(destList[0].name) : 'IDR', [destList]);
  const currencySymbol = CURRENCY_SYMBOLS[budgetCurrency];
  const toLocalBudget = (idrAmount: number) => Math.round(idrAmount / CURRENCY_RATES_TO_IDR[budgetCurrency]);
  const fromLocalBudget = (local: number) => Math.round(local * CURRENCY_RATES_TO_IDR[budgetCurrency]);
  const budgetMin = fromLocalBudget(budgetCurrency === 'IDR' ? 50_000 : budgetCurrency === 'JPY' ? 500 : 5);
  const budgetMax = fromLocalBudget(budgetCurrency === 'IDR' ? 1_000_000 : budgetCurrency === 'JPY' ? 20_000 : 100);
  const fmtBudget = (n: number) => {
    const local = toLocalBudget(n);
    if (budgetCurrency === 'IDR') return local >= 1_000_000 ? `Rp ${(local/1_000_000).toFixed(1)}jt` : `Rp ${Math.round(local/1000)}K`;
    if (budgetCurrency === 'JPY') return `¥${local.toLocaleString()}`;
    return `${currencySymbol}${local}`;
  };

  const progressIdx = PROGRESS_STEPS.indexOf(step);

  const validateAuth = (): boolean => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email format';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 6) errs.password = 'Minimum 6 characters';
    if (authMode === 'signup') {
      if (!name.trim()) errs.name = 'Name is required';
      if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
      else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    }
    setAuthErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const { setAccessToken } = useApp();

  const handleAuthSubmit = async () => {
    if (!validateAuth()) return;
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const res = await apiLogin(email, password);
        setAccessToken(res.access_token);
        justCompletedRef.current = true;
        const loggedInName = res.name || email.split('@')[0] || 'Traveler';
        completeOnboarding({
          name: loggedInName,
          email: res.email || email,
          vibe: 'balanced',
          destinations: [],
          totalDays: 3,
          budget: 500_000,
          startDate: 'today',
        });
        show(`Welcome back, ${loggedInName}!`, 'success');
        nav('/', { replace: true });
      } else {
        await apiRegister(email, password);
        const res = await apiLogin(email, password);
        setAccessToken(res.access_token);
        show('Account created successfully!', 'success');
        finalizeOnboarding();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setAuthErrors({ email: msg });
      show(msg, 'warn');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoToGenerate = () => {
    go('generating');
    setGenPhase(0);

    // Animate through loading steps.
    const phaseTimer = setInterval(() => setGenPhase((p) => (p + 1) % GEN_STEPS.length), 700);
    setTimeout(() => {
      clearInterval(phaseTimer);
      go('auth_form');
    }, 2200);
  };

  // Called by auth_form when the user submits (after the plan preview).
  // Finalizes onboarding and routes into the generated plan.
  const finalizeOnboarding = () => {
    const generated = pickItinerary(selectedVibe, budget);
    const startStr = startDate
      ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
      : 'today';
    justCompletedRef.current = true;
    const isRealUser = !!email.trim();
    completeOnboarding({
      name: isRealUser ? (name || email.split('@')[0] || 'Traveler') : 'Guest',
      email: isRealUser ? email : '',
      vibe: selectedVibe,
      destinations: destList.length > 0
        ? destList.map((d) => ({ name: d.name, days: d.days }))
        : [],
      totalDays,
      budget,
      startDate: startStr,
      isGuest: !isRealUser,
    });
    setItinerary(generated);
    nav('/generate?after=onboarding', { replace: true });
  };

  const go = (s: Step) => setStep(s);
  const back = () => {
    const idx = FLOW.indexOf(step);
    if (idx > 0) setStep(FLOW[idx - 1]);
  };

  const handleCalSelect = (d: Date) => {
    if (calPhase === 'start') {
      setStartDate(d); setEndDate(null); setCalPhase('end');
    } else {
      if (startDate && d < startDate) { setStartDate(d); setEndDate(null); }
      else setEndDate(d);
    }
  };

  const addDest = () => {
    const val = destInput.trim();
    if (!val || destList.some((d) => d.name === val)) return;
    setDestList((prev) => [...prev, { name: val, days: 2 }]);
    setDestInput('');
    destInputRef.current?.focus();
  };

  const removeDest = (i: number) => setDestList((prev) => prev.filter((_, idx) => idx !== i));
  const moveDest = (from: number, to: number) => {
    if (to < 0 || to >= destList.length) return;
    setDestList((prev) => {
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };


  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  // ── Per-step CTA config ───────────────────────────────
  type CTAConfig = { label: string; onClick: () => void; disabled?: boolean; className?: string; skipLabel?: string; onSkip?: () => void };

  const ctaConfig: Partial<Record<Step, CTAConfig>> = {
    destinations: {
      label: 'Continue',
      onClick: () => go('vibe'),
      disabled: destList.length === 0,
    },
    vibe: { label: 'Continue', onClick: () => go('dates') },
    dates: {
      label: startDate && endDate ? 'Continue' : 'Skip for now',
      onClick: () => { if (!startDate) setStartDate(new Date()); go('preview'); },
    },
    preview: { label: 'Yes, continue', onClick: () => go('budget') },
    budget: { label: 'Continue', onClick: () => go('location') },
    location: {
      label: locationGranted ? 'Generate My Trip →' : 'Continue without location',
      onClick: handleGoToGenerate,
      className: locationGranted ? 'bg-emerald-500 text-white' : undefined,
    },
  };

  const cta = ctaConfig[step];

  return (
    <div className="absolute inset-0 bg-white flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">

        {/* ── WELCOME ── */}
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col"
          >
            <div className="relative flex-1 flex flex-col bg-white">
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 20 }}
                >
                  {/* splash.svg → replace with splash.png (605 × 944 px) */}
                  <img
                    src={splashImg}
                    alt="Pavey"
                    className="w-[62vw] max-w-[280px] max-h-[52vh] object-contain"
                    style={{ aspectRatio: '605/944' }}
                  />
                </motion.div>
              </div>

              <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.55, type: 'spring', stiffness: 280, damping: 30 }}
                className="relative z-10 px-6 pt-6 pb-10"
              >
                <button
                  onClick={() => { setAuthMode('signup'); go('destinations'); }}
                  className="w-full h-14 rounded-2xl bg-brand-500 text-white font-bold text-base press shadow-glow flex items-center justify-center gap-2 mb-3"
                >
                  <ArrowRight className="w-5 h-5" /> Create Account (Sign Up)
                </button>
                <button
                  onClick={() => { setAuthMode('login'); go('auth_form'); }}
                  className="w-full h-12 rounded-2xl bg-ink-50 text-ink-800 font-bold text-sm press flex items-center justify-center gap-2 mb-4"
                >
                  Sign In (Login)
                </button>
                <button
                  onClick={() => {
                    justCompletedRef.current = true;
                    completeOnboarding({
                      name: 'Guest',
                      email: '',
                      vibe: 'balanced',
                      destinations: [],
                      totalDays: 3,
                      budget: 500_000,
                      startDate: 'today',
                      isGuest: true,
                    });
                    show('Continuing in Guest Mode', 'success');
                    nav('/', { replace: true });
                  }}
                  className="w-full py-2 text-ink-500 hover:text-brand-500 font-bold text-xs press flex items-center justify-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" /> Continue as Guest
                </button>
                <p className="text-center text-[11px] text-ink-400 mt-4 leading-relaxed">
                  By continuing you agree to our Terms &amp; Privacy Policy
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── AUTH FORM ── */}
        {step === 'auth_form' && (
          <motion.div
            key="auth_form"
            variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col"
          >
            {/* Back + title */}
            <div className="px-5 pt-12 pb-4 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => go(authMode === 'login' ? 'welcome' : 'location')} className="w-10 h-10 -ml-2 flex items-center justify-center text-ink-700 press">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {/* Round 11 — signup happens after the user previews their plan. */}
                {authMode === 'signup' && <span className="text-xs text-ink-400 font-semibold">Save your trip</span>}
              </div>
              <div className="flex items-center gap-3 mb-3">
                {/* welcome.svg → replace with welcome.png (990 × 1037 px) */}
                <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
                  <img
                    src={welcomeImg}
                    alt=""
                    className="w-7 h-7 object-contain"
                    style={{ aspectRatio: '990/1037' }}
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-ink-900 font-display leading-tight">
                    {authMode === 'signup' ? 'Save your trip — sign up' : 'Welcome back'}
                  </h2>
                  <p className="text-sm text-ink-500">
                    {authMode === 'signup' ? "We'll remember your plan so you can edit it later." : 'Sign in to continue your journey'}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable fields */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-5 space-y-4 pb-4">
              {authMode === 'signup' && (
                <FormField
                  label="Full Name" icon={<User className="w-4 h-4" />}
                  value={name} onChange={setName} placeholder="Your name" error={authErrors.name}
                />
              )}
              <FormField
                label="Email Address" icon={<Mail className="w-4 h-4" />}
                value={email} onChange={setEmail} placeholder="you@email.com"
                type="email" error={authErrors.email} autoFocus
              />
              <div>
                <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> PASSWORD
                </div>
                <div className={`flex items-center gap-3 bg-ink-50 rounded-xl px-3 py-3 border-2 transition-colors ${authErrors.password ? 'border-red-400' : 'border-transparent focus-within:border-brand-400'}`}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
                  />
                  <button onClick={() => setShowPw((v) => !v)} className="press text-ink-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {authErrors.password && <p className="text-xs text-red-500 mt-1">{authErrors.password}</p>}
              </div>
              {authMode === 'signup' && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1.5">CONFIRM PASSWORD</div>
                  <input
                    type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setConfirmTouched(true)}
                    placeholder="Repeat password"
                    className={`w-full bg-ink-50 rounded-xl px-3 py-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none border-2 transition-colors ${(authErrors.confirmPassword || (confirmTouched && confirmPassword && password !== confirmPassword)) ? 'border-red-400' : 'border-transparent focus:border-brand-400'}`}
                  />
                  {/* Issue 1: on-type mismatch warning */}
                  {confirmTouched && confirmPassword && password !== confirmPassword && !authErrors.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                  )}
                  {authErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{authErrors.confirmPassword}</p>}
                </div>
              )}
            </div>

            {/* Fixed bottom CTA */}
            <div className="px-5 pt-3 pb-8 bg-white shrink-0 border-t border-ink-50 space-y-2">
              <button
                onClick={handleAuthSubmit}
                disabled={authLoading}
                className="w-full h-14 rounded-2xl bg-brand-500 disabled:bg-brand-300 text-white font-bold text-base press shadow-glow flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    <RefreshCw className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <>{authMode === 'signup' ? 'Create Account' : 'Sign In'} <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              <button
                onClick={() => {
                  setAuthMode(authMode === 'signup' ? 'login' : 'signup');
                  setPassword('');
                  setConfirmPassword('');
                  setConfirmTouched(false);
                  setAuthErrors({});
                  setJustToggled(true);
                  setTimeout(() => setJustToggled(false), 3000);
                }}
                className="w-full text-center text-sm text-ink-500 press py-2"
              >
                {authMode === 'signup'
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
              {authMode === 'signup' && (
                <button
                  onClick={finalizeOnboarding}
                  className="w-full text-center text-xs text-ink-400 hover:text-brand-500 font-bold press py-1.5 mt-1"
                >
                  Skip and Continue as Guest
                </button>
              )}
              {/* Issue 2: email kept notice after toggle */}
              <AnimatePresence>
                {justToggled && email && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-center text-xs text-brand-600 font-medium"
                  >
                    Your email has been kept
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── POST-AUTH STEPS ── */}
        {PROGRESS_STEPS.includes(step) && (
          <motion.div
            key={step}
            variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Progress bar */}
            <div className="px-5 pt-12 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={back} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press shrink-0">
                  <ArrowLeft className="w-4 h-4 text-ink-700" />
                </button>
                <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-brand-500 rounded-full"
                    initial={false}
                    animate={{ width: `${((progressIdx + 1) / PROGRESS_STEPS.length) * 100}%` }}
                    transition={{ duration: 0.35 }}
                  />
                </div>
                <span className="text-xs text-ink-500 font-semibold shrink-0">
                  {progressIdx + 1}/{PROGRESS_STEPS.length}
                </span>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">

              {/* VIBE */}
              {step === 'vibe' && (
                <>
                  <StepTitle title="What's your travel vibe?" subtitle="This shapes every recommendation we make" />
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {VIBES.map((v) => {
                      const active = selectedVibe === v.id;
                      return (
                        <motion.button
                          key={v.id} whileTap={{ scale: 0.96 }}
                          onClick={() => setSelectedVibe(v.id)}
                          className={`relative p-4 rounded-2xl border-2 text-left transition-colors press ${v.id === 'balanced' ? 'col-span-2' : ''} ${active ? 'border-brand-500 bg-brand-50' : 'border-ink-100 bg-white'}`}
                        >
                          {active && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className={`text-brand-500 mb-2 ${v.id === 'balanced' ? 'inline-block' : ''}`}>{getVibeIcon(v.id, "w-8 h-8")}</div>
                          <div className="font-bold text-ink-900 font-display">{v.label}</div>
                          <div className="text-xs text-ink-500 mt-0.5 leading-snug">{v.desc}</div>
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* DESTINATIONS */}
              {step === 'destinations' && (
                <>
                  <StepTitle title="Where are you headed?" subtitle="Add one or more destinations — in order" />
                  <div className="mt-4 flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-ink-50 rounded-xl px-3 py-2.5 border-2 border-transparent focus-within:border-brand-400 transition-colors">
                      <MapPin className="w-4 h-4 text-ink-400 shrink-0" />
                      <input
                        ref={destInputRef}
                        value={destInput}
                        onChange={(e) => setDestInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addDest()}
                        placeholder="City or country…"
                        className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
                      />
                    </div>
                    <button
                      onClick={addDest}
                      disabled={!destInput.trim()}
                      className="w-11 h-11 rounded-xl bg-brand-500 disabled:bg-ink-200 text-white flex items-center justify-center press shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {/* UI10 — Country-level detection */}
                  {(() => {
                    const COUNTRY_CITIES: Record<string, string[]> = {
                      japan: ['Tokyo', 'Kyoto', 'Osaka', 'Sapporo', 'Hiroshima'],
                      indonesia: ['Bali', 'Jakarta', 'Yogyakarta', 'Lombok'],
                      bali: ['Ubud', 'Seminyak', 'Canggu', 'Nusa Dua'],
                      singapore: ['Singapore'],
                      thailand: ['Bangkok', 'Chiang Mai', 'Phuket', 'Koh Samui'],
                      korea: ['Seoul', 'Busan', 'Jeju', 'Incheon'],
                      vietnam: ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Hoi An'],
                      malaysia: ['Kuala Lumpur', 'Penang', 'Langkawi', 'Malacca'],
                    };
                    const lower = destInput.toLowerCase().trim();
                    const match = Object.entries(COUNTRY_CITIES).find(([key]) => lower === key || lower.startsWith(key));
                    if (!match) return null;
                    const [country, cities] = match;
                    return (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 bg-brand-50 rounded-xl p-3 border border-brand-100">
                        <div className="text-xs font-semibold text-brand-700 mb-2 capitalize">{country} is a big one! Which cities?</div>
                        <div className="flex flex-wrap gap-1.5">
                          {cities.map((city) => (
                            <button
                              key={city}
                              onClick={() => { setDestList((prev) => prev.some((d) => d.name === city) ? prev : [...prev, { name: city, days: 2 }]); setDestInput(''); }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-brand-200 text-brand-700 text-xs font-semibold press"
                            >
                              <Plus className="w-3 h-3" /> {city}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })()}
                  {/* Issue 4: prompt when no destination added yet */}
                  {destList.length === 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-2">Add at least one destination to continue.</p>
                  )}
                  {destList.length === 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['Bali, Indonesia', 'Jakarta, Indonesia', 'Kuala Lumpur, Malaysia', 'Singapore', 'Sydney, Australia'].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDestList((prev) => prev.some((x) => x.name === d) ? prev : [...prev, { name: d, days: 2 }])}
                          className="px-3 py-1.5 rounded-full bg-ink-50 text-ink-700 text-xs font-semibold press border border-ink-100"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                  {destList.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1">YOUR ROUTE</div>
                      <AnimatePresence>
                        {destList.map((d, i) => (
                          <motion.div
                            key={d.name} layout
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 bg-white border border-ink-100 rounded-xl px-3 py-2.5"
                          >
                            <div className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                            <span className="flex-1 text-sm font-semibold text-ink-900 truncate">{d.name}</span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => moveDest(i, i - 1)} disabled={i === 0} className="w-6 h-6 flex items-center justify-center text-ink-300 disabled:opacity-20 press">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => moveDest(i, i + 1)} disabled={i === destList.length - 1} className="w-6 h-6 flex items-center justify-center text-ink-300 disabled:opacity-20 press">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeDest(i)} className="w-6 h-6 flex items-center justify-center text-ink-400 hover:text-red-500 press">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {destList.length > 1 && (
                        <div className="flex items-center gap-2 py-1 px-2">
                          <div className="flex-1 h-px border-t border-dashed border-brand-200" />
                          <span className="text-[11px] text-brand-500 font-semibold shrink-0">Multi-city route ✈️</span>
                          <div className="flex-1 h-px border-t border-dashed border-brand-200" />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* DATES */}
              {step === 'dates' && (
                <>
                  <StepTitle title="When are you traveling?" subtitle="Pick your start and end dates" />
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`flex-1 py-2 px-3 rounded-xl text-center text-xs font-semibold border-2 transition-colors ${calPhase === 'start' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-100 bg-ink-50 text-ink-600'}`}>
                        <div className="text-[9px] text-ink-400 mb-0.5">DEPART</div>
                        {startDate ? startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: startDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : 'Select'}
                      </div>
                      <span className="text-ink-300 font-bold">→</span>
                      <div className={`flex-1 py-2 px-3 rounded-xl text-center text-xs font-semibold border-2 transition-colors ${calPhase === 'end' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-100 bg-ink-50 text-ink-600'}`}>
                        <div className="text-[9px] text-ink-400 mb-0.5">RETURN</div>
                        {endDate ? endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: endDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : 'Select'}
                      </div>
                      {startDate && endDate && (
                        <div className="bg-brand-50 border-2 border-brand-100 rounded-xl px-3 py-2 text-center shrink-0">
                          <div className="text-[9px] text-brand-500 mb-0.5">DAYS</div>
                          <div className="text-sm font-bold text-brand-700">{totalDays}</div>
                        </div>
                      )}
                    </div>
                    <MiniCalendar startDate={startDate} endDate={endDate} onSelect={handleCalSelect} />
                    {startDate && (
                      <button
                        onClick={() => { setStartDate(null); setEndDate(null); setCalPhase('start'); }}
                        className="mt-2 text-xs text-brand-500 font-semibold press"
                      >
                        Reset dates
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* PREVIEW — Round 11 #17. One-line confirmation before budget. */}
              {step === 'preview' && (
                <>
                  <StepTitle title="Sound right?" subtitle="Quick check before we plan the rest." />
                  <div className="mt-6 bg-brand-50 border border-brand-100 rounded-2xl p-5">
                    <div className="text-[10px] font-bold tracking-widest text-brand-600 mb-2">YOUR TRIP</div>
                    <div className="text-xl font-extrabold text-ink-900 font-display leading-snug">
                      {(() => {
                        const city = destList[0]?.name.split(',')[0] ?? 'your destination';
                        const extra = destList.length > 1 ? ` + ${destList.length - 1} more` : '';
                        return `${totalDays}-day ${city}${extra} trip`;
                      })()}
                    </div>
                    <div className="text-xs text-ink-500 mt-2 leading-snug">
                      {startDate ? startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Today'}
                      {endDate ? ` → ${endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}
                      {' · '}{VIBES.find((v) => v.id === selectedVibe)?.label} vibe
                    </div>
                  </div>
                  <button
                    onClick={() => go('dates')}
                    className="mt-3 text-xs text-brand-600 font-semibold press flex items-center gap-1"
                  >
                    Change dates
                  </button>
                </>
              )}

              {/* BUDGET */}
              {step === 'budget' && (
                <>
                  <StepTitle title="What's your daily budget?" subtitle={`Per day · shown in ${budgetCurrency} (${currencySymbol})`} />
                  <div className="mt-6 space-y-3">
                    {(() => {
                      const predefinedValues = [
                        Math.round((budgetMin + budgetMax * 0.3) / 2),
                        Math.round(budgetMax * 0.45),
                        Math.round(budgetMax * 0.8),
                        budgetMax
                      ];
                      const isCustom = !predefinedValues.includes(budget);

                      return (
                        <>
                          {[
                            { label: 'Budget', desc: `${fmtBudget(budgetMin)} – ${fmtBudget(Math.round(budgetMax * 0.3))}/day`, value: Math.round((budgetMin + budgetMax * 0.3) / 2) },
                            { label: 'Mid-range', desc: `${fmtBudget(Math.round(budgetMax * 0.3))} – ${fmtBudget(Math.round(budgetMax * 0.6))}/day`, value: Math.round(budgetMax * 0.45) },
                            { label: 'Comfortable', desc: `${fmtBudget(Math.round(budgetMax * 0.6))} – ${fmtBudget(budgetMax)}/day`, value: Math.round(budgetMax * 0.8) },
                            { label: 'No limit', desc: `${fmtBudget(budgetMax)}+/day`, value: budgetMax },
                          ].map((opt) => (
                            <button
                              key={opt.label}
                              onClick={() => setBudget(opt.value)}
                              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 press transition-colors ${budget === opt.value ? 'border-brand-500 bg-brand-50' : 'border-ink-100 bg-white'}`}
                            >
                              <div className="text-left">
                                <div className={`font-bold text-sm ${budget === opt.value ? 'text-brand-700' : 'text-ink-900'}`}>{opt.label}</div>
                                <div className="text-xs text-ink-500 mt-0.5">{opt.desc}</div>
                              </div>
                              {budget === opt.value && (
                                <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                              )}
                            </button>
                          ))}

                          <div className={`w-full p-4 rounded-2xl border-2 transition-colors bg-white ${isCustom ? 'border-brand-500 bg-brand-50' : 'border-ink-100'}`}>
                            <div className="flex items-center justify-between">
                              <div className="text-left flex-1 min-w-0 mr-3">
                                <div className="font-bold text-sm text-ink-900">Custom daily budget</div>
                                <div className="text-xs text-ink-500 mt-0.5">Enter preferred amount</div>
                              </div>
                              <div className="flex items-center bg-ink-50 rounded-xl px-3 py-2 border border-ink-200 focus-within:border-brand-400 transition-colors w-36 shrink-0">
                                <span className="text-sm font-semibold text-ink-500 mr-1">{currencySymbol}</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={isCustom ? toLocalBudget(budget) : ''}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val > 0) {
                                      setBudget(fromLocalBudget(val));
                                    } else {
                                      setBudget(budgetMin);
                                    }
                                  }}
                                  className="w-full bg-transparent text-sm font-bold text-ink-900 outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                    {totalDays > 1 && (
                      <div className="mt-2 flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-2xl p-3">
                        <Wallet className="w-5 h-5 text-brand-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-ink-500">Est. total trip budget</div>
                          <div className="font-bold text-brand-700 text-sm">{fmtBudget(budget * totalDays)}</div>
                          <div className="text-[10px] text-ink-400">{totalDays} day{totalDays !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2.5 bg-ink-50 rounded-2xl p-3">
                      <Info className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-ink-600 leading-relaxed">
                        Budget covers entry fees, food, and activities per day. Transport is extra. We'll always show you free alternatives.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* LOCATION */}
              {step === 'location' && (
                <>
                  <StepTitle title="Enable location?" subtitle="We'll use it to find nearby places and navigate" />
                  <div className="mt-6 space-y-4">
                    <div className="bg-brand-50 rounded-2xl p-4 border border-brand-100 space-y-3">
                      {[
                        { icon: <MapPin className="w-5 h-5 text-brand-500 shrink-0" />, title: 'Nearby discovery', desc: 'Find hidden gems within walking distance' },
                        { icon: <Compass className="w-5 h-5 text-brand-500 shrink-0" />, title: 'Turn-by-turn navigation', desc: 'Live directions between stops' },
                        { icon: <Bell className="w-5 h-5 text-brand-500 shrink-0" />, title: 'Smart alerts', desc: "Know when you're close to your next stop" },
                      ].map((item) => (
                        <div key={item.title} className="flex items-start gap-3">
                          {item.icon}
                          <div>
                            <div className="font-semibold text-ink-900 text-sm">{item.title}</div>
                            <div className="text-xs text-ink-500">{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {locationDenied && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-start gap-2.5 bg-amber-50 rounded-xl p-3 border border-amber-200"
                        >
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-amber-800 text-sm">Location access denied</div>
                            <div className="text-xs text-amber-700 mt-0.5">You can enable it later in Settings → Location</div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {!locationGranted ? (
                      <button
                        onClick={() => {
                          setTimeout(() => { setLocationGranted(true); setLocationDenied(false); }, 800);
                          setLocationDenied(false);
                        }}
                        className="w-full h-13 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow flex items-center justify-center gap-2 py-3.5"
                      >
                        <MapPin className="w-5 h-5" /> Allow Location Access
                      </button>
                    ) : (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-3 bg-emerald-50 rounded-2xl p-3 border border-emerald-200"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-emerald-800">Location enabled</div>
                          <div className="text-xs text-emerald-700">Full navigation features unlocked</div>
                        </div>
                      </motion.div>
                    )}
                    {!locationGranted && (
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => setLocationDenied(true)}
                          className="w-full text-center text-sm text-ink-400 press py-1"
                        >
                          Skip for now
                        </button>
                        <p className="text-xs text-ink-400 text-center">You can enable location later anytime.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>

            {/* CTA — always at bottom, outside scroll, never clipped */}
            {cta && (
              <div className="px-5 pt-3 pb-8 bg-white shrink-0 border-t border-ink-50 space-y-2">
                <button
                  onClick={cta.onClick}
                  disabled={cta.disabled}
                  className={`w-full h-14 rounded-2xl font-bold text-base press shadow-glow flex items-center justify-center gap-2 disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none ${cta.className ?? 'bg-brand-500 text-white'}`}
                >
                  {cta.label} {!cta.className && <ArrowRight className="w-4 h-4" />}
                </button>
                {cta.skipLabel && cta.onSkip && (
                  <button onClick={cta.onSkip} className="w-full text-center text-sm text-ink-400 press py-1">
                    {cta.skipLabel}
                  </button>
                )}
                {/* Issue 5: dates needed for daily allowance note */}
                {step === 'dates' && !(startDate && endDate) && (
                  <p className="text-center text-xs text-ink-400">
                    Dates are needed to calculate your daily allowance in the wallet.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── GENERATING — matches GeneratePage LoadingState style ── */}
        {step === 'generating' && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center justify-center px-6 text-center bg-white"
          >
            {/* Bobbing & Pulsing mascot container */}
            <div className="relative w-32 h-32 flex items-center justify-center mb-8">
              {/* Pulsing ring 1 */}
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.4, 0.15] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-brand-500/10 animate-pulse"
              />
              {/* Pulsing ring 2 */}
              <motion.div
                animate={{ scale: [1.1, 1.6, 1.1], opacity: [0.1, 0.3, 0.1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.4 }}
                className="absolute inset-0 rounded-full bg-brand-500/5"
              />
              
              {/* White inner container */}
              <div className="relative w-24 h-24 rounded-full bg-white border border-brand-100 flex items-center justify-center shadow-sm z-10">
                {/* Bobbing TinTin */}
                <motion.img
                  src="/mascot.svg"
                  alt="TinTin"
                  className="w-12 h-12"
                  animate={{ y: [-6, 6, -6] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                />
              </div>
            </div>

            {/* Texts */}
            <h3 className="text-ink-900 font-bold text-lg font-display mb-2">
              Planning your adventure
            </h3>
            
            <div className="min-h-[24px] flex items-center justify-center text-brand-600 font-semibold text-sm mb-1.5">
              <AnimatePresence mode="wait">
                <motion.span
                  key={genPhase}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="text-[15px]"
                >
                  {GEN_STEPS[genPhase % GEN_STEPS.length]}
                </motion.span>
              </AnimatePresence>
            </div>
            
            <p className="text-xs text-ink-400">Just a moment…</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pt-1 pb-2">
      <h2 className="text-2xl font-extrabold text-ink-900 font-display leading-snug">{title}</h2>
      <p className="text-sm text-ink-500 mt-1">{subtitle}</p>
    </div>
  );
}

function FormField({
  label, icon, value, onChange, placeholder, type = 'text', error, autoFocus,
}: {
  label: string; icon: React.ReactNode; value: string;
  onChange: (v: string) => void; placeholder: string;
  type?: string; error?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1.5 flex items-center gap-1.5">
        {icon} {label.toUpperCase()}
      </div>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full bg-ink-50 rounded-xl px-3 py-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none border-2 transition-colors ${error ? 'border-red-400' : 'border-transparent focus:border-brand-400'}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

