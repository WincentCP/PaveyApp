/**
 * Centralized user-facing copy.
 *
 * Single source of truth for blocking/guiding/warning strings. Pure constants
 * and template functions — no React, no JSX. Importing this file is the only
 * way to put a string in front of the user for any validation, warning, or
 * informational moment.
 *
 * Why this exists: with UX now driven by copy (Round 9), inconsistent wording
 * erodes trust. The same concept ("trip too long") used to be phrased three
 * different ways across the codebase. One file = one tone review.
 *
 * Future i18n: this file becomes the literal swap point. Add a `lang` arg to
 * each template, or wrap with an i18n lib — no callers need to change.
 */

import { MAX_TRIP_DAYS } from './planValidation';

export const COPY = {
  tripTooLong: {
    headline: "Let's keep this trip realistic",
    body: (_days: number, max: number) =>
      `Trips longer than ${max} days can become hard to plan well. Try shortening it, or split it into a few smaller plans.`,
    why: 'Long plans tend to feel repetitive and harder to follow day-to-day.',
    urlToast: (max: number) =>
      `Trips longer than ${max} days are out of scope — try a shorter window.`,
  },
  banners: {
    chaosRegions: (regions: number, days: number) =>
      `${regions} regions in ${days} day${days !== 1 ? 's' : ''} can feel scattered. Focus on one area for a smoother plan.`,
    chaosCities: (region: string) =>
      `That's a lot of cities for the time you have — narrowing to ${region} usually plans better.`,
    durationOver20: `That's a longer trip — close to our ${MAX_TRIP_DAYS}-day limit. Splitting it into two plans can help.`,
    ratioUnder1: 'Each city needs at least a day. Try adding more days, or trimming a city.',
    duration1420: 'Longer trips work best when grouped by region — try sticking to one country or area.',
    ratio1to2: "Less than 2 days per city — it'll feel a bit fast.",
  },
  friction: {
    chaosRegions: 'This trip crosses several regions in a short window. Plan it anyway?',
    chaosCities: 'Lots of cities across regions. Plan it anyway?',
    durationOver20: `Long trip — near our ${MAX_TRIP_DAYS}-day limit. Plan it anyway?`,
    ratioUnder1: 'You have more cities than days. Plan it anyway?',
  },
  wallet: {
    tripCreatedToast: (name: string) => `Wallet trip created for ${name}`,
    linkedSubtitle: 'Linked from your trip plan',
    linkedDeleteBody: 'This wallet was created from your trip plan. Deleting removes all expenses. Or keep it as a standalone wallet.',
    unlinkToast: 'Wallet kept — plan link removed.',
  },
  destInput: {
    cityHint: (city: string) => `That's a country — we'll start with ${city}. Tap to use it.`,
    placeholders: [
      'Try a city — Tokyo, Paris, Bali',
      'Or a country — Japan, France',
      "We'll suggest a starting city for countries",
    ],
  },
  maxDestinations: "Six is plenty — let's make it a great trip.",
  ctas: {
    intentSheetContinue: 'Continue to review',
    reviewStart: 'Start my trip',
    reviewStartFriction: 'Yes, start anyway',
    loadingHeadline: 'Building your plan…',
  },
  sections: {
    reviewHeader: 'Review your trip',
  },
  recommendations: {
    add: 'Add',
    tightHeadline: 'This may make your day tighter.',
    tightBody: (stops: number) =>
      `You'd have ${stops} stops on this day — already close to a full schedule.`,
    adjust: 'Adjust the timing',
    keep: 'Keep it anyway',
    skip: 'Skip for now',
    packedToast: 'Added — your day is packed.',
    addedToast: (name: string) => `${name} added`,
  },
  hints: {
    travelDays: "We'll add travel days automatically between cities.",
    singleDay: "Just one day? We'll plan a short visit.",
    densityWhy: '5+ stops in a day usually means rushing between places.',
    rerollConfirm: 'This will replace today\'s stops with new suggestions. Keep your edits?',
    buddyIntro: 'Ask me to suggest a restaurant near your next stop, or anything about your trip.',
    onboardingPreview: (days: number, city: string) =>
      `Sounds like a ${days}-day ${city} trip — sound right?`,
    walletEmptyLinked: (tripName: string) => `Track your spending for ${tripName}`,
    manualSecondary: 'Pick stops manually instead',
  },
} as const;
