import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, Plus, Scan, Clock, X, Check, Receipt,
  Pencil, Wallet, CalendarDays,
  TrendingDown, Globe, AlertTriangle, Search, Link2,
  Coffee, Ticket, Car, ShoppingBag, CheckCircle, Info, Compass,
} from 'lucide-react';
import { COPY } from '../lib/copy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import PageHeader from '../components/PageHeader';
import WalletOnboardingEmpty from '../components/WalletOnboardingEmpty';
import { useApp } from '../context/AppContext';
import {
  CATEGORY_COLORS, type Transaction, type TxnCategory,
  type Currency, CURRENCY_SYMBOLS, formatCurrencyAmount,
} from '../data/wallet';
import { relativeDay } from '../lib/format';
import { useToast } from '../components/Toast';

export default function WalletPage() {
  const nav = useNavigate();
  const {
    transactions, addTransaction,
    tripBudget, setTripBudget,
    tripName, setTripName,
    tripDays, tripDaysRemaining, setTripDaysRemaining,
    totalSpent, dailyAllowance,
    trips, activeTrip,
    currency, setCurrency,
    isNavigating, tripCompleted,
    itinerary, perDayItineraries,
    destinations, journeyStart,
  } = useApp();
  const { show } = useToast();

  const hasItinerary = perDayItineraries.flat().length > 0 || itinerary.length > 0;
  const hasUserTrips = trips.some(t => t.id !== 'trip-default');
  const showEmptyOnboarding = !hasItinerary && !hasUserTrips && transactions.length === 0;
  const isLinkedTrip = !!activeTrip?.linkedToPlan;

  const [sheet, setSheet] = useState<null | 'editBudget' | 'addExpense' | 'scan' | 'history' | 'currencyPicker'>(null);
  // First-visit explainer for auto-linked wallet — dismissed permanently via localStorage.
  const [explainerDismissed, setExplainerDismissed] = useState(() => {
    try { return localStorage.getItem('pavey_wallet_explained') === '1'; } catch { return false; }
  });
  const showLinkedExplainer = isLinkedTrip && !explainerDismissed;
  const dismissExplainer = () => {
    setExplainerDismissed(true);
    try { localStorage.setItem('pavey_wallet_explained', '1'); } catch { /* ignore */ }
  };

  const breakdown = useMemo(() => {
    const map = new Map<TxnCategory, number>();
    transactions.filter((t) => t.amount < 0).forEach((t) => {
      map.set(t.category, (map.get(t.category) || 0) + Math.abs(t.amount));
    });
    const total = Array.from(map.values()).reduce((s, n) => s + n, 0) || 1;
    return Array.from(map.entries()).map(([cat, val]) => ({
      cat, val, pct: val / total,
    })).sort((a, b) => b.val - a.val);
  }, [transactions]);

  const remaining = tripBudget - totalSpent;
  const usedPct = Math.min(1, totalSpent / tripBudget);
  const isOverBudget = totalSpent > tripBudget;

  // Smart insight: project total spend
  const daysTotal = tripDays;
  const daysElapsed = daysTotal - tripDaysRemaining;
  const projectedTotal = daysElapsed > 0
    ? Math.round((totalSpent / daysElapsed) * daysTotal)
    : 0;
  const isOnTrack = projectedTotal <= tripBudget;

  const fmt = (n: number) => formatCurrencyAmount(n, currency);

  return (
    <div className="absolute inset-0 bg-white overflow-y-auto pb-32 no-scrollbar">
      <StatusBar />

      {/* Header */}
      <PageHeader
        icon={Wallet}
        title="Wallet"
        right={
          tripCompleted
            ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">COMPLETED</span>
            : <button className="w-9 h-9 rounded-full bg-ink-50 flex items-center justify-center press" onClick={() => show('Notifications: 0 new', 'info')}>
                <Bell className="w-4 h-4 text-ink-700" />
              </button>
        }
      />

      {/* Empty onboarding state — no plan, no user trips, no expenses yet. */}
      {showEmptyOnboarding && (
        <WalletOnboardingEmpty
          onCreatePlan={() => nav('/?newPlan=1')}
          onLogQuickExpense={() => setSheet('addExpense')}
        />
      )}

      {/* First-visit explainer for auto-linked trips. */}
      {!showEmptyOnboarding && showLinkedExplainer && (
        <div className="mx-5 mb-3 bg-brand-50/70 border border-brand-100 rounded-2xl px-3.5 py-2.5 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
          <div className="flex-1 text-[11px] text-brand-900 leading-relaxed">
            This wallet was created from your trip plan. Track expenses, set budgets, or skip it anytime.
          </div>
          <button onClick={dismissExplainer} className="shrink-0 press mt-0.5">
            <X className="w-3.5 h-3.5 text-brand-400" />
          </button>
        </div>
      )}

      {!showEmptyOnboarding && (<>

      {/* Trip Budget Card — solid, no gradient */}
      <div className="px-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl bg-brand-600 p-5 text-white overflow-hidden shadow-glow"
        >
          {/* Trip name row */}
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <div className="text-xs text-white/70">Current Trip</div>
              <div className="font-bold text-lg font-display truncate">{tripName}</div>
              {isLinkedTrip && (
                <div className="text-[10px] text-white/70 mt-0.5 flex items-center gap-1">
                  <Link2 className="w-2.5 h-2.5" /> {COPY.wallet.linkedSubtitle}
                </div>
              )}
              {(itinerary.length > 0 || destinations.length > 0) && (
                <div className="text-[11px] text-white/70 mt-0.5 truncate">
                  {destinations.length > 0 ? `${destinations.length} ${destinations.length === 1 ? 'city' : 'cities'} · ` : ''}
                  {itinerary.length > 0 ? `${itinerary.length} stop${itinerary.length !== 1 ? 's' : ''}` : 'No plan yet'}
                  {journeyStart.date && journeyStart.date !== 'today' ? ` · ${new Date(journeyStart.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Currency chip */}
              <button
                onClick={() => setSheet('currencyPicker')}
                className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors press"
              >
                <Globe className="w-3 h-3" />
                {CURRENCY_SYMBOLS[currency]} {currency}
              </button>
              <button
                onClick={() => setSheet('editBudget')}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors press"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            </div>
          </div>

          {/* Budget numbers */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <div className="text-xs text-white/70">Total Budget</div>
              <div className="text-base font-extrabold font-display">{fmt(tripBudget)}</div>
            </div>
            <div>
              <div className="text-xs text-white/70">Spent</div>
              <div className="text-base font-extrabold font-display text-red-300">{fmt(totalSpent)}</div>
            </div>
            <div>
              <div className="text-xs text-white/70">Remaining</div>
              <div className={`text-base font-extrabold font-display ${isOverBudget ? 'text-red-300' : 'text-emerald-300'}`}>
                {isOverBudget ? '-' : ''}{fmt(Math.abs(remaining))}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(usedPct * 100, 100)}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className={`h-full rounded-full ${isOverBudget ? 'bg-red-400' : usedPct > 0.8 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/70 mt-1">
              <span>{Math.round(usedPct * 100)}% used</span>
              <span>{Math.round((1 - usedPct) * 100)}% left</span>
            </div>
          </div>

          {/* Daily allowance */}
          <div className="flex items-center justify-between bg-white/10 rounded-2xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white/80" />
              <div>
                <div className="text-xs text-white/70">Daily Allowance</div>
                <div className="font-bold text-sm">{fmt(dailyAllowance)} / day</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/70">Days Left</div>
              <div className="font-bold text-sm">{tripDaysRemaining} of {tripDays}</div>
            </div>
          </div>

          {/* Smart insight */}
          {daysElapsed > 0 && (
            <div className={`mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2 ${isOnTrack ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {isOnTrack
                ? <TrendingDown className="w-4 h-4 text-emerald-300 shrink-0" />
                : <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />}
              <div className="text-xs text-white/90 leading-snug">
                {isOnTrack
                  ? `On track — projected total ${fmt(projectedTotal)}, under budget by ${fmt(tripBudget - projectedTotal)}`
                  : `At this pace you'll overspend by ${fmt(projectedTotal - tripBudget)} — try to save ${fmt(Math.ceil((projectedTotal - tripBudget) / Math.max(1, tripDaysRemaining)))} / day`}
              </div>
            </div>
          )}

          {/* Deco */}
          <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 4 }}
            className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-white/8" />
        </motion.div>
      </div>

      {/* Trip completed summary banner */}
      {tripCompleted && (
        <div className="px-5 mt-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <div className="font-bold text-emerald-800">Trip completed!</div>
                <div className="text-xs text-emerald-700">Wallet is now read-only</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-xl p-2.5">
                <div className="font-bold text-ink-900 text-sm">{fmt(totalSpent)}</div>
                <div className="text-[10px] text-ink-500">Total spent</div>
              </div>
              <div className="bg-white rounded-xl p-2.5">
                <div className={`font-bold text-sm ${tripBudget - totalSpent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmt(Math.abs(tripBudget - totalSpent))}
                </div>
                <div className="text-[10px] text-ink-500">
                  {tripBudget - totalSpent >= 0 ? 'Saved' : 'Over budget'}
                </div>
              </div>
              <div className="bg-white rounded-xl p-2.5">
                <div className="font-bold text-ink-900 text-sm">{transactions.filter((t) => t.amount < 0).length}</div>
                <div className="text-[10px] text-ink-500">Transactions</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-2 px-5 mt-4 grid-cols-3">
        <QuickBtn
          icon={<Plus />}
          label="Add Expense"
          onClick={() => !isNavigating && !tripCompleted && setSheet('addExpense')}
          disabled={isNavigating || tripCompleted}
        />
        <QuickBtn icon={<Scan />} label="Scan" onClick={() => !tripCompleted && setSheet('scan')} disabled={tripCompleted} />
        <QuickBtn icon={<Clock />} label="History" onClick={() => setSheet('history')} />
      </div>
      {(isNavigating || tripCompleted) && (
        <div className="px-5 mt-2">
          <div className={`rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-2 ${tripCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {tripCompleted ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> : <Compass className="w-4 h-4 text-amber-500 shrink-0" />}
            {tripCompleted ? 'Trip is complete — expenses are locked' : 'Add expenses after your journey ends'}
          </div>
        </div>
      )}

      {/* Breakdown */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between">
          <div className="font-bold text-ink-900 font-display">Expense Breakdown</div>
          <button className="text-xs text-brand-600 font-semibold press">This trip ›</button>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Donut breakdown={breakdown} totalSpent={totalSpent} fmt={fmt} />
          <div className="flex-1 space-y-2">
            {breakdown.map(({ cat, val, pct }) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[cat] }} />
                <span className="text-sm text-ink-800 flex-1">{cat}</span>
                <span className="text-xs font-semibold text-ink-900">{fmt(val)}</span>
                <span className="text-[11px] text-ink-500 w-9 text-right">{Math.round(pct * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between">
          <div className="font-bold text-ink-900 font-display">Recent Transactions</div>
          {transactions.length > 0 && (
            <button onClick={() => setSheet('history')} className="text-xs text-brand-600 font-semibold press">See all ›</button>
          )}
        </div>
        {transactions.length === 0 ? (
          <div className="mt-3 py-10 flex flex-col items-center gap-3 text-center bg-ink-50 rounded-2xl px-6">
            <Receipt className="w-10 h-10 text-ink-300 shrink-0" />
            <div>
              <div className="font-bold text-ink-800 text-sm">
                {isLinkedTrip && tripName ? COPY.hints.walletEmptyLinked(tripName) : 'No expenses yet'}
              </div>
              <div className="text-xs text-ink-400 mt-1 leading-snug max-w-[220px]">
                Tap "Add Expense" above to log your first spend — no trip plan required.
              </div>
            </div>
            <button
              onClick={() => !tripCompleted && setSheet('addExpense')}
              disabled={tripCompleted}
              className="h-9 px-4 rounded-xl bg-brand-500 text-white text-xs font-bold press shadow-glow disabled:opacity-40"
            >
              + Log first expense
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {transactions.slice(0, 5).map((t) => <TxnRow key={t.id} t={t} currency={currency} />)}
          </div>
        )}
      </div>
      </>)}

      {/* Sheets */}
      <Sheet open={sheet === 'editBudget'} title="Edit Trip Budget" onClose={() => setSheet(null)}>
        <EditBudgetSheet
          tripBudget={tripBudget}
          tripName={tripName}
          tripDaysRemaining={tripDaysRemaining}
          currency={currency}
          hasTransactions={transactions.length > 0}
          onSave={(budget, name, daysRem) => {
            setTripBudget(budget);
            setTripName(name);
            setTripDaysRemaining(daysRem);
            show('Budget updated ✓', 'success');
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'addExpense'} title="Add Expense" onClose={() => setSheet(null)}>
        <AddExpenseSheet currency={currency} onSubmit={(t) => {
          addTransaction(t);
          show(`Added ${t.title}`, 'success');
          setSheet(null);
        }} />
      </Sheet>

      <Sheet open={sheet === 'scan'} title="Scan receipt" onClose={() => setSheet(null)}>
        <ScanSheet
          currency={currency}
          onResult={(amt, title) => {
            addTransaction({ title, category: 'Food & Drinks', amount: -amt, icon: '🧾' });
            show(`Receipt parsed: ${fmt(amt)}`, 'success');
            setSheet(null);
          }}
          onAddAllItems={(items) => {
            items.forEach(({ name, price }) => addTransaction({ title: name, category: 'Food & Drinks', amount: -price, icon: '🧾' }));
            show(`Added ${items.length} items`, 'success');
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'history'} title="All transactions" onClose={() => setSheet(null)}>
        <HistorySheet transactions={transactions} currency={currency} />
      </Sheet>

      <Sheet open={sheet === 'currencyPicker'} title="Select Currency" onClose={() => setSheet(null)}>
        <CurrencyPickerSheet
          current={currency}
          hasTransactions={transactions.length > 0}
          onSelect={(c) => {
            setCurrency(c);
            show(`Currency set to ${c}`, 'success');
            setSheet(null);
          }}
        />
      </Sheet>


    </div>
  );
}

/* ----------------------------------------- */

function QuickBtn({ icon, label, onClick, highlight, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; highlight?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 py-3 rounded-2xl bg-white border border-ink-100 transition-colors ${disabled ? 'opacity-40 cursor-default' : 'press hover:border-brand-300'}`}
    >
      <span className={`w-10 h-10 rounded-full flex items-center justify-center ${highlight && !disabled ? 'bg-brand-500 text-white shadow-glow' : 'bg-brand-50 text-brand-600'}`}>{icon}</span>
      <span className="text-[10px] font-semibold text-ink-800 text-center leading-tight px-1">{label}</span>
    </button>
  );
}

function Donut({ breakdown, totalSpent, fmt }: { breakdown: { cat: TxnCategory; val: number; pct: number }[]; totalSpent: number; fmt: (n: number) => string }) {
  const r = 38, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative w-[110px] h-[110px] shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#EEF1F7" strokeWidth="14" />
        {breakdown.map(({ cat, pct }, i) => {
          const len = c * pct, dash = `${len} ${c - len}`, offset = -acc;
          acc += len;
          return (
            <motion.circle key={cat} cx="50" cy="50" r={r} fill="none"
              stroke={CATEGORY_COLORS[cat]} strokeWidth="14" strokeDasharray={dash} strokeDashoffset={offset}
              initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: dash }}
              transition={{ delay: 0.05 * i, duration: 0.7 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[9px] text-ink-500">Spent</div>
        <div className="text-sm font-bold text-ink-900">{fmt(totalSpent)}</div>
      </div>
    </div>
  );
}

function tagStyle(tag: string): string {
  if (tag === 'you owe') return 'bg-red-50 text-red-600';
  if (tag === 'owed to you') return 'bg-emerald-50 text-emerald-600';
  if (tag === 'settled') return 'bg-ink-50 text-ink-400 line-through';
  if (tag === 'Over budget') return 'bg-red-50 text-red-600';
  if (tag === 'Great deal') return 'bg-emerald-50 text-emerald-600';
  if (tag === 'Saved') return 'bg-emerald-50 text-emerald-600';
  if (tag === 'Top up') return 'bg-brand-50 text-brand-600';
  return 'bg-brand-50 text-brand-600';
}

function getCategoryIcon(cat: TxnCategory) {
  switch (cat) {
    case 'Food & Drinks':
      return <Coffee className="w-4 h-4 text-brand-600" />;
    case 'Attractions':
      return <Ticket className="w-4 h-4 text-emerald-600" />;
    case 'Transport':
      return <Car className="w-4 h-4 text-amber-600" />;
    case 'Shopping':
      return <ShoppingBag className="w-4 h-4 text-violet-600" />;
    default:
      return <Receipt className="w-4 h-4 text-ink-600" />;
  }
}

function TxnRow({ t, currency }: { t: Transaction; currency: Currency }) {
  const positive = t.amount > 0;
  const fmt = (n: number) => formatCurrencyAmount(n, currency);
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 bg-white border border-ink-100 rounded-2xl px-3 py-2">
      <div className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center shrink-0">
        {getCategoryIcon(t.category)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-ink-900 truncate text-sm">{t.title}</div>
        <div className="text-[11px] text-ink-500 flex items-center gap-1 flex-wrap">
          {relativeDay(t.date)}
          {t.tag && (
            <span className={`ml-1 px-1.5 rounded-full text-[10px] font-semibold ${tagStyle(t.tag)}`}>{t.tag}</span>
          )}
        </div>
      </div>
      <div className={`text-sm font-bold shrink-0 ${positive ? 'text-emerald-600' : t.tag === 'you owe' ? 'text-red-600' : 'text-ink-900'}`}>
        {positive ? '+' : '–'} {fmt(Math.abs(t.amount))}
      </div>
    </motion.div>
  );
}

/* -------- Sheet Wrapper -------- */

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 z-40 bg-ink-900/40" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-card max-h-[85%] flex flex-col"
          >
            <div className="w-12 h-1.5 bg-ink-100 rounded-full mx-auto mt-3" />
            <div className="px-5 pt-3 pb-2 flex items-center justify-between shrink-0">
              <div className="font-bold text-ink-900 font-display">{title}</div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto px-5 pb-6 no-scrollbar flex-1">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* -------- Edit Budget Sheet -------- */

function EditBudgetSheet({ tripBudget, tripName, tripDaysRemaining, currency, hasTransactions, onSave }: {
  tripBudget: number; tripName: string; tripDaysRemaining: number; currency: Currency;
  hasTransactions: boolean;
  onSave: (budget: number, name: string, daysRem: number) => void;
}) {
  const [budget, setBudget] = useState(tripBudget);
  const [name, setName] = useState(tripName);
  const [daysRem, setDaysRem] = useState(tripDaysRemaining);
  const presets = currency === 'IDR'
    ? [1_000_000, 2_000_000, 3_000_000, 5_000_000]
    : currency === 'USD' ? [100, 250, 500, 1000]
    : currency === 'JPY' ? [10000, 25000, 50000, 100000]
    : [100, 200, 500, 1000];
  return (
    <div className="space-y-3">
      {/* Issue 20: mid-trip warning */}
      {hasTransactions && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-snug">
            You have existing transactions. Changing the budget won't recalculate past expenses.
          </p>
        </div>
      )}
      <div className="bg-ink-50 rounded-2xl p-4">
        <div className="text-xs text-ink-500">Trip Name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent text-lg font-bold text-ink-900 outline-none mt-1" />
      </div>
      <div className="bg-ink-50 rounded-2xl p-4">
        <div className="text-xs text-ink-500">Total Budget ({CURRENCY_SYMBOLS[currency]})</div>
        <input type="number" value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))} className="w-full bg-transparent text-2xl font-bold text-ink-900 outline-none mt-1" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {presets.map((p) => (
          <button key={p} onClick={() => setBudget(p)} className={`py-2 rounded-xl text-xs font-semibold press ${budget === p ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'}`}>
            {formatCurrencyAmount(p, currency)}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between bg-ink-50 rounded-2xl px-4 py-3">
        <div className="text-sm text-ink-700">Days remaining</div>
        <div className="flex items-center gap-3">
          <button onClick={() => setDaysRem((d) => Math.max(1, d - 1))} className="w-8 h-8 rounded-full bg-white press flex items-center justify-center font-bold text-ink-700">−</button>
          <span className="font-bold w-6 text-center">{daysRem}</span>
          <button onClick={() => setDaysRem((d) => d + 1)} className="w-8 h-8 rounded-full bg-white press flex items-center justify-center font-bold text-ink-700">+</button>
        </div>
      </div>
      <button onClick={() => onSave(budget, name, daysRem)} className="w-full h-12 rounded-2xl bg-brand-500 text-white font-bold shadow-glow press">
        Save Budget
      </button>
    </div>
  );
}

/* -------- Add Expense Sheet -------- */

function AddExpenseSheet({ currency, onSubmit }: { currency: Currency; onSubmit: (t: { title: string; category: TxnCategory; amount: number; icon: string }) => void }) {
  const [title, setTitle] = useState('');
  const [amt, setAmt] = useState(50_000);
  const [cat, setCat] = useState<TxnCategory>('Food & Drinks');
  const cats: { id: TxnCategory; icon: React.ReactNode; label: string }[] = [
    { id: 'Food & Drinks', icon: <Coffee className="w-4.5 h-4.5" />, label: 'Food' },
    { id: 'Attractions', icon: <Ticket className="w-4.5 h-4.5" />, label: 'Attraction' },
    { id: 'Transport', icon: <Car className="w-4.5 h-4.5" />, label: 'Transport' },
    { id: 'Shopping', icon: <ShoppingBag className="w-4.5 h-4.5" />, label: 'Shopping' },
  ];
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="space-y-3">
      <input ref={inputRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What did you spend on?" className="w-full bg-ink-50 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-300" />
      <div className="bg-ink-50 rounded-2xl p-4">
        <div className="text-xs text-ink-500">Amount ({CURRENCY_SYMBOLS[currency]})</div>
        <input type="number" value={amt} onChange={(e) => setAmt(Math.max(0, Number(e.target.value)))} className="w-full bg-transparent text-2xl font-bold text-ink-900 outline-none mt-1" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cats.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-[11px] font-semibold press ${cat === c.id ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'}`}>
            {c.icon} <span>{c.label}</span>
          </button>
        ))}
      </div>
      <button
        disabled={!title.trim() || amt <= 0}
        onClick={() => onSubmit({ title, category: cat, amount: -amt, icon: '' })}
        className="w-full h-12 rounded-2xl bg-brand-500 disabled:bg-ink-300 text-white font-bold shadow-glow press"
      >
        Add Expense
      </button>
    </div>
  );
}

/* -------- Scan Sheet (enhanced) -------- */

type ScannedItem = { name: string; price: number; confidence: number };

function ScanSheet({ currency, onResult, onAddAllItems }: { currency: Currency; onResult: (amt: number, title: string) => void; onAddAllItems: (items: { name: string; price: number }[]) => void }) {
  const [scanning, setScanning] = useState(true);
  const [items] = useState<ScannedItem[]>([
    { name: 'Nasi Goreng Spesial', price: 45_000, confidence: 97 },
    { name: 'Es Kelapa Muda', price: 25_000, confidence: 91 },
    { name: 'Sate Lilit (4 pcs)', price: 35_000, confidence: 88 },
  ]);
  const detectedTotal = items.reduce((s, i) => s + i.price, 0);
  const fmt = (n: number) => formatCurrencyAmount(n, currency);

  useEffect(() => { const t = setTimeout(() => setScanning(false), 2200); return () => clearTimeout(t); }, []);
  return (
    <div className="space-y-3">
      <div className="relative h-48 bg-ink-900 rounded-2xl overflow-hidden flex items-center justify-center">
        <Receipt className="w-14 h-14 text-white/20" />
        {scanning && <div className="absolute left-4 right-4 h-0.5 bg-brand-500 shadow-glow animate-scanLine" />}
        <div className="absolute inset-3 rounded-2xl border-2 border-white/30 border-dashed" />
        <div className="absolute bottom-3 left-3 right-3 text-center text-white/80 text-xs">{scanning ? 'Scanning receipt…' : 'Receipt parsed ✓'}</div>
      </div>
      {scanning ? (
        <div className="space-y-2"><div className="h-3 rounded shimmer w-2/3" /><div className="h-3 rounded shimmer w-1/2" /><div className="h-3 rounded shimmer w-3/4" /></div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Detected items */}
          <div className="bg-ink-50 rounded-2xl p-3 space-y-2">
            <div className="text-xs font-bold text-ink-500 tracking-wider">DETECTED ITEMS</div>
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: item.confidence >= 95 ? '#22C55E' : item.confidence >= 85 ? '#F59E0B' : '#EF4444' }}
                  />
                  <span className="text-sm text-ink-800 truncate">{item.name}</span>
                  <span className="text-[10px] text-ink-400 shrink-0">{item.confidence}%</span>
                </div>
                <span className="text-sm font-semibold text-ink-900 ml-2 shrink-0">{fmt(item.price)}</span>
              </div>
            ))}
            <div className="border-t border-ink-200 pt-2 flex justify-between">
              <span className="text-sm font-bold text-ink-900">Total</span>
              <span className="text-sm font-extrabold text-brand-600">{fmt(detectedTotal)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> High confidence</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Medium</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Verify</div>
          </div>
          {/* Issue 22: two options — add all items or add total */}
          <div className="flex flex-col gap-2">
            <button onClick={() => onAddAllItems(items.map(({ name, price }) => ({ name, price })))} className="w-full h-12 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow inline-flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add all items ({items.length})
            </button>
            <button onClick={() => onResult(detectedTotal, 'Warung Babi Guling Ibu Oka')} className="w-full h-11 rounded-2xl bg-ink-50 text-ink-800 font-semibold press border border-ink-200 inline-flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Add total only ({fmt(detectedTotal)})
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* -------- History Sheet -------- */

function HistorySheet({ transactions, currency }: { transactions: Transaction[]; currency: Currency }) {
  return <div className="space-y-2">{transactions.map((t) => <TxnRow key={t.id} t={t} currency={currency} />)}</div>;
}

/* -------- New Trip Sheet -------- */

/* -------- Currency Picker Sheet -------- */

const CURRENCIES: { id: Currency; name: string }[] = [
  { id: 'IDR', name: 'Indonesian Rupiah' },
  { id: 'USD', name: 'US Dollar' },
  { id: 'EUR', name: 'Euro' },
  { id: 'JPY', name: 'Japanese Yen' },
  { id: 'SGD', name: 'Singapore Dollar' },
  { id: 'AUD', name: 'Australian Dollar' },
  { id: 'GBP', name: 'British Pound' },
  { id: 'THB', name: 'Thai Baht' },
  { id: 'MYR', name: 'Malaysian Ringgit' },
  { id: 'KRW', name: 'South Korean Won' },
  { id: 'HKD', name: 'Hong Kong Dollar' },
  { id: 'CNY', name: 'Chinese Yuan' },
  { id: 'INR', name: 'Indian Rupee' },
  { id: 'NZD', name: 'New Zealand Dollar' },
  { id: 'CAD', name: 'Canadian Dollar' },
];

function CurrencyPickerSheet({ current, hasTransactions, onSelect }: { current: Currency; hasTransactions: boolean; onSelect: (c: Currency) => void }) {
  const [query, setQuery] = useState('');
  const filtered = query.trim()
    ? CURRENCIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.id.toLowerCase().includes(query.toLowerCase()))
    : CURRENCIES;
  return (
    <div className="space-y-2">
      {/* Issue 23: conversion warning */}
      {hasTransactions && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-snug">
            Changing currency won't convert existing transaction amounts.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2 bg-ink-50 rounded-xl px-3 py-2.5 border border-ink-200 mb-1">
        <Search className="w-4 h-4 text-ink-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search currency…"
          className="flex-1 bg-transparent text-sm text-ink-800 placeholder:text-ink-400 outline-none"
        />
      </div>
      {filtered.length === 0 && (
        <div className="py-4 text-center text-sm text-ink-400">No currencies found</div>
      )}
      {filtered.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl press transition-colors ${c.id === current ? 'bg-brand-50 border border-brand-200' : 'bg-ink-50'}`}
        >
          <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 font-bold flex items-center justify-center shrink-0 text-xs">
            {c.id}
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold text-ink-900 text-sm">{c.name}</div>
            <div className="text-xs text-ink-500">{CURRENCY_SYMBOLS[c.id]} · {c.id}</div>
          </div>
          {c.id === current && <Check className="w-4 h-4 text-brand-500" />}
        </button>
      ))}
    </div>
  );
}

