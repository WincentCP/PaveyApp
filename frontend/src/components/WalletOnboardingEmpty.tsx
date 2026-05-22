/**
 * Empty-state shown on /wallet when the user has no trip plan AND no
 * user-created wallet trips. Replaces the previous "banner over broken wallet"
 * pattern with a coherent purpose-explaining screen.
 *
 * The primary CTA gets the user into a trip plan; the secondary text-button
 * preserves standalone use (a quick expense without a trip) without making
 * it the default path.
 */

import { motion } from 'framer-motion';
import { Wallet, Wand2 } from 'lucide-react';

interface Props {
  onCreatePlan: () => void;
  onLogQuickExpense: () => void;
}

export default function WalletOnboardingEmpty({ onCreatePlan, onLogQuickExpense }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mx-5 mt-2 bg-white rounded-3xl border border-ink-100 shadow-card px-6 py-8 text-center"
    >
      <div className="w-16 h-16 mx-auto rounded-3xl bg-brand-50 flex items-center justify-center mb-4">
        <Wallet className="w-7 h-7 text-brand-600" />
      </div>
      <div className="font-bold text-ink-900 font-display text-lg">
        Your wallet, ready when you travel
      </div>
      <p className="text-sm text-ink-500 mt-2 leading-relaxed max-w-[280px] mx-auto">
        The wallet tracks your spending against your trip budget — once you've got a plan,
        your wallet links up automatically.
      </p>

      <button
        onClick={onCreatePlan}
        className="mt-5 inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow"
      >
        <Wand2 className="w-4 h-4" />
        Create a trip plan
      </button>

      <div className="mt-4">
        <button
          onClick={onLogQuickExpense}
          className="text-xs text-ink-500 underline-offset-4 hover:underline press"
        >
          Log a quick expense without a trip
        </button>
      </div>
    </motion.div>
  );
}
