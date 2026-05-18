# Pavey — Trip Planning App

**Pavey** is a mobile-first travel planning app that generates personalized day-by-day itineraries, handles multi-city trips with automatic travel days, and links trip planning to a built-in expense wallet. It is built entirely on the frontend — there is no backend API today. The planning engine is a set of pure TypeScript functions designed to be extracted to a backend service without touching any React code.

---

## Table of Contents

1. [Product Philosophy](#1-product-philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack](#3-tech-stack)
4. [App Entry & Routing](#4-app-entry--routing)
5. [Onboarding Flow](#5-onboarding-flow)
6. [Home Flow & Intent Sheet](#6-home-flow--intent-sheet)
7. [Destination Input](#7-destination-input)
8. [Date Selection](#8-date-selection)
9. [Multi-City Flow](#9-multi-city-flow)
10. [Validation Flow](#10-validation-flow)
11. [Itinerary Generation](#11-itinerary-generation)
12. [Travel-Day Logic](#12-travel-day-logic)
13. [GeneratePage — Review & Edit](#13-generatepage--review--edit)
14. [Recommendation Adding Flow](#14-recommendation-adding-flow)
15. [Trip Confirmation & Wallet Linkage](#15-trip-confirmation--wallet-linkage)
16. [Editing an Existing Trip](#16-editing-an-existing-trip)
17. [Density / Tight-Day Detection](#17-density--tight-day-detection)
18. [Warnings & Friction States](#18-warnings--friction-states)
19. [Regional Clustering Logic](#19-regional-clustering-logic)
20. [Itinerary Constraints & Pacing Rules](#20-itinerary-constraints--pacing-rules)
21. [Wallet Module](#21-wallet-module)
22. [State Management & Persistence](#22-state-management--persistence)
23. [Key Components Reference](#23-key-components-reference)
24. [Key Utility Libraries Reference](#24-key-utility-libraries-reference)
25. [Frontend-Only Scope & Known Limitations](#25-frontend-only-scope--known-limitations)
26. [Backend Migration Path](#26-backend-migration-path)

---

## 1. Product Philosophy

### What Pavey is optimized for

Pavey is designed for **first-time and casual travelers** who want a practical, pre-filled day plan they can adjust — not a blank canvas that forces them to research everything themselves. The app makes opinionated decisions by default and lets the user override them.

Key design commitments:

- **Realistic pacing over ambition.** The default is 3 stops per day ("balanced" pace). Cramming 8 museums into a day is technically possible but quietly discouraged through soft warnings and density detection.
- **Beginner-friendly defaults.** Every field has a sensible default. Users should be able to complete the flow without reading any documentation.
- **Show, don't block.** Most warnings are soft: they show context and suggest a fix, but they do not prevent the user from proceeding. The only hard blocks are a 30-day trip-length cap and a "more cities than days" scenario, because those produce mathematically broken plans.
- **One action at a time.** The app avoids multi-step modals. Decisions happen inline or in a single bottom sheet.
- **Copy drives UX.** All user-facing strings live in `src/lib/copy.ts`. The tone is conversational, not technical. Errors explain what to do, not just what went wrong.

### What is intentionally out of scope (frontend only)

- No real flight/train search or booking
- No real weather data (28° / Partly Cloudy is a mock)
- No real place distance or routing engine — distances in `Place.distanceKm` are seeded data
- No user accounts, authentication, or server persistence — `localStorage` is the only store
- No i18n — all copy is English, but `src/lib/copy.ts` is the swap point for future i18n
- No map tiles with live turn-by-turn directions (MapPage shows a visual-only placeholder)

---

## 2. Architecture Overview

```
src/
├── App.tsx                     Route shell, provider wrappers
├── context/
│   └── AppContext.tsx           Central React state + planning adapter
├── lib/
│   ├── itinerary.ts            Pure planning engine (generate, allocate, pace)
│   ├── planValidation.ts       Pure validation rules (banners, caps)
│   ├── density.ts              Pure tight-day detection
│   ├── copy.ts                 All user-facing strings
│   ├── format.ts               Currency/number formatting helpers
│   └── dateUtils.ts            Date arithmetic helpers
├── data/
│   ├── places.ts               Place catalogue (seed data)
│   ├── regions.ts              City → region mapping for chaos detection
│   ├── wallet.ts               Trip/Transaction types + currency helpers
│   ├── cultural.ts             Cultural intel tips per place
│   └── countryHints.ts         Country → suggested city mapping
├── pages/
│   ├── OnboardingPage.tsx      First-run wizard (auth + preferences)
│   ├── HomePage.tsx            Main dashboard + intent sheet
│   ├── GeneratePage.tsx        Generated itinerary review + edit
│   ├── MapPage.tsx             Visual map view of the itinerary
│   ├── WalletPage.tsx          Expense tracking
│   ├── TripsPage.tsx           Multi-trip list
│   ├── NavigatePage.tsx        Turn-by-turn navigation (visual only)
│   └── ProfilePage.tsx         User profile
└── components/
    ├── MiniCalendar.tsx         Canonical date-range picker
    ├── IntentBanners.tsx        Soft warning banners in intent sheet
    ├── TripTooLongModal.tsx     Hard 30-day block modal
    ├── TimePicker.tsx           Circular time selector
    ├── Toast.tsx                Toast notification system
    ├── Buddy.tsx                AI assistant floating panel
    ├── BottomNav.tsx            Tab bar
    └── ...
```

### Data flow summary

```
User inputs (intent sheet)
        ↓
   Validation (planValidation.ts)
        ↓
   proceedIntent() → sets AppContext state
        ↓
   /generate route → buildFullItinerary()
        ↓
   generateItinerary() (itinerary.ts) — pure function
        ↓
   GeneratePage renders perDayItineraries + perDayMeta
        ↓
   User edits/confirms → itinerary saved to AppContext + localStorage
```

---

## 3. Tech Stack

| Concern | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Routing | React Router v6 |
| Styling | TailwindCSS (custom `ink-*` / `brand-*` palette) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Persistence | `localStorage` (`pavey_state` key) |

---

## 4. App Entry & Routing

`App.tsx` wraps everything in three providers: `AppProvider` (state), `ToastProvider` (toasts), `PhoneFrame` (visual mobile shell for desktop preview).

The `AppShell` component applies auth-gating: if `onboardingComplete` is `false`, every route redirects to `/onboarding`. Once onboarding is complete, the full route set is available:

| Route | Page | Notes |
|---|---|---|
| `/onboarding` | OnboardingPage | No chrome (no nav, no Buddy) |
| `/` | HomePage | Main dashboard + intent sheet |
| `/generate` | GeneratePage | Itinerary review/edit — no Buddy |
| `/map` | MapPage | Visual map |
| `/navigate` | NavigatePage | Turn-by-turn (no nav bar) |
| `/wallet` | WalletPage | Expense tracker |
| `/profile` | ProfilePage | User settings |
| `/trips` | TripsPage | Multi-trip list |

The Buddy AI floating button is hidden on `/onboarding`, `/generate`, and `/navigate` to reduce distraction during focused flows.

---

## 5. Onboarding Flow

**File:** `src/pages/OnboardingPage.tsx`

Onboarding is a linear 8-step wizard: `welcome → auth_form → vibe → destinations → dates → budget → location → generating`.

Progress is shown on steps 3–7 (`PROGRESS_STEPS`). The welcome and auth screens have no progress bar.

### Step breakdown

| Step | What happens | Key state |
|---|---|---|
| `welcome` | Splash screen with app logo | → `auth_form` |
| `auth_form` | Sign up / log in form (name, email, password) | `name`, `email`, `password` — validation runs inline |
| `vibe` | Pick one of 5 travel vibes | `selectedVibe` |
| `destinations` | Add 1–6 city/country destinations, set days per city | `destList[]` |
| `dates` | Pick trip start and end with `MiniCalendar` | `startDate`, `endDate` |
| `budget` | Drag slider to set daily budget | `budget` (stored in IDR internally) |
| `location` | Request device location (optional, skippable) | `locationGranted` |
| `generating` | Animated 2.2s loading screen while plan is assembled | `genPhase` |

### Auth logic

Auth is frontend-only — no real server. Signing up or logging in sets `isAuthenticated = true` in AppContext. The `everOnboarded` flag persists so returning users land on the login screen, not the welcome splash.

### What onboarding writes to AppContext

When the user completes the final step, `completeOnboarding()` is called with:

```ts
{
  name, email, vibe,
  destinations: destList,   // [{ name: string, days: number }]
  totalDays,                // computed from startDate/endDate
  budget,                   // IDR amount
  startDate,                // ISO date string
}
```

This call:
1. Sets `authUser`, `isAuthenticated`, `vibe`, `budget`
2. Creates `Destination[]` objects with auto-suggested currency per city
3. Sets `journeyStart` with the selected dates
4. Creates the first wallet `Trip` (only if destinations were entered — the wallet is not created for empty-destination onboarding)
5. Sets `onboardingComplete = true`, which unlocks the main app routes

After onboarding, the user is navigated to `/generate?after=onboarding` to immediately see their generated plan.

---

## 6. Home Flow & Intent Sheet

**File:** `src/pages/HomePage.tsx`

The home screen serves two roles simultaneously:

1. **Active trip dashboard** — shows today's plan, budget status, destination progress, and the daily vibe card when a trip is in progress.
2. **Intent sheet launcher** — the entry point for creating any new itinerary plan.

### Intent sheet modes

There are two sheet modes, both launched from the hero area:

- **AI mode** (`intentSheet === 'ai'`): The user describes where and when; the app generates a plan automatically.
- **Manual mode** (`intentSheet === 'manual'`): The user searches for and hand-picks stops with no AI generation.

Both modes share the same validation and routing logic. They differ only in what GeneratePage does on arrival.

### Intent sheet field flow (AI mode)

```
WHERE (destination text input)
  ↓ country entered? → inline hint: "That's a country — we'll start with [city]. Tap to use it."
WHEN (collapsible MiniCalendar, start + end date)
  ↓ only start entered? → single-day warning shown before proceeding
YOUR VIBE (5 vibe chips)
YOUR BUDGET (slider, currency-aware)
PACE (relaxed / balanced / fast)
  ↓
[ Continue to review ]
```

### Rotating placeholder

While the destination input is focused and empty, the placeholder cycles every 2.5 seconds through three copy variants from `COPY.destInput.placeholders`. This teaches new users that both city names and country names are valid input without a tooltip or help text.

### Multi-city hint

When `destinations.length > 1`, a muted line appears below the destination row:

> "We'll add travel days automatically between cities."

This sets expectations before generation so travel days are not a surprise.

---

## 7. Destination Input

**File:** `src/pages/HomePage.tsx` (intent sheet + add-destination sub-sheet)

### Single destination (AI intent sheet)

The `intentDest` text field accepts free-text city or country names. There is no autocomplete — the field is intentionally open to avoid constraining the user to a fixed catalogue of supported cities.

**Country hint:** `src/data/countryHints.ts` maps country names to a representative starting city. When the user types a country name (detected by a keyword match), an inline tap-target appears:

> "That's a country — we'll start with Tokyo. Tap to use it."

Tapping replaces the text with the suggested city name.

### Adding destinations to an existing trip

The "Add destination" sub-sheet (`addDestSheet`) is accessible from the home dashboard. Fields:
- City/country name
- Arrival date and departure date (optional — auto-calculates days from the date span)
- Days (number stepper — used when no dates are set)

Validations in `handleAddDest`:
- Name cannot be empty
- Duplicate destinations are rejected (`isDuplicateDestination()` from `src/lib/format.ts`)
- Maximum 6 destinations (`MAX_DESTINATIONS = 6`) — after that, `COPY.maxDestinations` is shown as an inline error

When a destination is added, `addDestination()` in AppContext creates a `Destination` object with an auto-suggested currency for the city using `suggestCurrency()` from `src/data/wallet.ts`.

---

## 8. Date Selection

**Component:** `src/components/MiniCalendar.tsx`

`MiniCalendar` is the single canonical date picker used in both the onboarding wizard and the intent sheet. It replaces native `<input type="date">` everywhere in the app for visual consistency.

### Interaction model

- **First tap** on any date sets `startDate`
- **Second tap** on any date after the start sets `endDate`
- **Tapping again** after a range is set restarts the selection (new `startDate`, clears `endDate`)
- Dates before today are disabled (`isPast` check) and rendered in muted grey
- Today gets a `ring-1 ring-brand-400` indicator
- The range between start and end is filled with `bg-brand-100` (light brand tint)
- Start and end dots use `bg-brand-500 rounded-full` (full brand colour)

### Props

```ts
interface Props {
  startDate: Date | null;
  endDate: Date | null;
  onSelect: (d: Date) => void;  // caller owns state
}
```

The calendar owns navigation (prev/next month) but delegates selection to the caller. In the intent sheet, `onSelect` runs:

```ts
// first call sets start, second call sets end, third restarts
if (!intentDate || (intentDate && intentEndDate)) {
  setIntentDate(toISO(d));
  setIntentEndDate('');
} else {
  setIntentEndDate(toISO(d));
}
```

ISO strings (`YYYY-MM-DD`) are used for storage; `Date` objects only at the MiniCalendar boundary.

### Intent sheet calendar disclosure

The calendar is wrapped in a collapsible disclosure in the intent sheet so the sheet does not grow tall by default. The summary line (`Start: Jun 14 → End: Jun 18`) is tappable to expand the calendar.

---

## 9. Multi-City Flow

Multi-city is enabled any time `destinations.length > 1` in AppContext.

### How multi-city affects the intent sheet

When the user has multiple destinations set, `handleIntentConfirm` collects destination names from the `destinations` array rather than the single `intentDest` text field:

```ts
const journeyCitiesNow = destinations.length > 0
  ? destinations.map((d) => d.name)
  : [intentDest].filter(Boolean);
```

### How multi-city affects generation

`buildFullItinerary` passes all destinations to `generateItinerary()` in `src/lib/itinerary.ts`. The engine calls `allocateDays()` which inserts exactly **one travel day between each adjacent destination pair**. This is automatic and invisible to the user until they see the generated plan.

### Day allocation across cities

`allocateDays()` distributes the total trip days proportionally across destinations:

1. Calculates a weight for each destination: `departDate - arriveDate` span if both are set; otherwise `dest.days` (default 1).
2. Subtracts `destinations.length - 1` days for travel days to get `planDays`.
3. Distributes `planDays` proportionally using the weights, with a floor of 1 per destination.
4. Reconciles the sum to exactly `planDays` using a round-robin correction loop.
5. Inserts travel days between each adjacent pair in the final `DayPlan[]` array.

### Destination switching on the dashboard

When `activeDestIdx` changes (user taps a destination tab), AppContext:
1. Loads the stored `itinerary` for that destination into the global `itinerary` slice.
2. When `itinerary` changes, saves it back to the active destination's stored itinerary.

AppContext also auto-advances `activeDestIdx` based on today's date — if today falls within a destination's `arriveDate`/`departDate` window, that destination becomes active automatically.

### Currency switching

When the active destination changes and its currency differs from the active wallet trip's currency, a non-blocking amber banner appears:

> "You're now in Bangkok · Switch wallet to THB?"

The user can accept or dismiss. This is purely informational — the wallet currency is independent of the plan.

---

## 10. Validation Flow

Validation is layered. Each layer catches a different class of problem.

### Layer 1 — Field-level errors (before confirmation)

Caught in `handleIntentConfirm()`:

| Condition | Error shown |
|---|---|
| No destination | "Please enter your destination to continue" |
| No start date | "Please pick a start date to continue" |
| End date before start date | "End date must be after start date" |

These are attached as `intentErrors.dest` or `intentErrors.date` and render inline below the respective field. The confirmation button does not navigate until these are cleared.

### Layer 2 — Soft single-day warning

If the user is in AI mode and has not set an end date (single-day trip), a warning dialog appears before proceeding. The user can dismiss it and continue or go back to add an end date. This is a gentle suggestion, not a block.

### Layer 3 — Hard 30-day cap

`exceedsMaxDuration(intentDays)` from `src/lib/planValidation.ts` checks if `days > MAX_TRIP_DAYS` (30). If true:

- `TripTooLongModal` slides up with a friendly explanation and suggestions.
- The user cannot proceed until they shorten the trip.
- The 30-day cap also runs as a URL safety net on GeneratePage arrival — a malformed URL with `?days=45` triggers a toast and redirects to `/`.

**Why 30 days?** Plans longer than 30 days produce diminishing quality — the place catalogue is finite, repetition increases, and day-by-day plans become hard to follow. The cap is a product decision, not a technical limit.

### Layer 4 — Over-dense city/day ratio

`isOverDense(citiesCount, days)` returns true when `citiesCount > 1 && citiesCount > days`.

**Example:** 4 cities in 3 days → impossible because there would not be a full day for each city even ignoring travel days.

When this fires, a field-level error is set on the date field:

> "You have 4 cities in 3 days. Add more days or remove a city."

The user fixes the input in the intent sheet before reaching the generation screen.

### Layer 5 — Overlap warning

If a new plan's date range overlaps with the current active trip's range, a soft confirmation dialog:

> "This overlaps with [trip name]. Plan anyway?"

The user can confirm (`overlapAcknowledged = true`) and proceed, or change their dates.

### Layer 6 — Soft intent banners

`computeIntentBanners()` in `src/lib/planValidation.ts` produces up to one major and one secondary advisory banner (rendered by `<IntentBanners>`) when problematic configurations are detected. These are informational — they do not block confirmation. See [Section 18](#18-warnings--friction-states) for the full banner priority ladder.

---

## 11. Itinerary Generation

**File:** `src/lib/itinerary.ts`

The planning engine is a pure TypeScript module with no React dependencies. It takes a `GenerateInput` and returns a `GenerateResult`.

### GenerateInput

```ts
interface GenerateInput {
  destinations: PlannerDestination[];
  activeDestIdx: number;
  totalDays: number;
  pace: TripPace;           // 'relaxed' | 'balanced' | 'fast'
  vibe: Vibe;               // 'nature' | 'cafe' | 'activities' | 'cultural' | 'balanced'
  budget: number;           // IDR amount per day
  rainyDayMode: boolean;    // filters for indoor places only
  arrivalTime: string;      // "HH:MM" — affects stop count on day 1
  departureTime: string;    // "HH:MM" — affects stop count on last day
}
```

### GenerateResult

```ts
interface GenerateResult {
  days: Place[][];    // per-day stops; travel days are []
  meta: DayPlan[];    // per-day metadata (kind, fromCity, toCity)
}
```

### Generation pipeline

```
1. allocateDays(destinations, totalDays)
        → DayPlan[] — assigns each day to a destination, inserts travel days

2. For each day:
   a. Skip travel days → push [] and DayPlan to output, continue
   b. computeMaxStops(dayIndex, totalDays, pace, vibe, arrivalTime, departureTime, prevWasTravel)
        → max stop count for this day
   c. pickDayItinerary(vibe, budget, dayIndex, usedIds, maxStops, rainyDayMode, city)
        → Place[] — selects stops from the catalogue, excludes already-used IDs
   d. Mark all picked IDs as used (global deduplication across the full trip)

3. Return { days, meta }
```

### Pace baseline

```ts
const PACE_STOPS: Record<TripPace, number> = {
  relaxed: 2,
  balanced: 3,
  fast: 4,
};
```

Activities vibe adds +1 stop to the baseline (activities-heavy vibes warrant a more packed schedule).

### Stop count tapers

`computeMaxStops()` reduces the stop count based on arrival/departure times and post-travel recovery:

| Situation | Effect |
|---|---|
| Arrival day, arrival time ≥ 18:00 | 0 stops (too late) |
| Arrival day, arrival time 15:00–17:59 | 1 stop max |
| Arrival day, arrival time 12:00–14:59 | 2 stops max |
| Departure day, departure ≤ 10:00 | 0 stops |
| Departure day, departure 10:00–12:00 | 1 stop max |
| Departure day, departure 12:00–14:00 | 2 stops max |
| Day after a travel day | −1 stop (recovery day) |

**Why tapers?** A user arriving at 6 PM should not have 3 museum visits queued. A day after a long transit is naturally lower energy. Tapers make the schedule physically realistic without the user configuring it.

### Place selection (`pickDayItinerary`)

`pickDayItinerary()` filters `PLACES` by:

1. **City match** — place's `city` field matches the destination city (case-insensitive substring)
2. **Vibe match** — place's `vibes` array includes the user's selected vibe
3. **Budget** — place's `priceRange.max <= budget` per day
4. **Rainy day** — if `rainyDayMode`, only `indoor: true` places
5. **Already used** — excludes IDs in `usedIds` (cross-day deduplication)

Results are shuffled using `dayIndex` as a seed offset to produce different suggestions on each day while keeping day-to-day variation predictable.

---

## 12. Travel-Day Logic

Travel days are a first-class day type in the engine. They exist as entries in `DayPlan[]` with `kind: 'travel'`.

### Insertion rule

`allocateDays()` inserts exactly **one travel day between each adjacent destination pair**:

```
Tokyo (3 days)  →  [travel day]  →  Kyoto (2 days)  →  [travel day]  →  Osaka (2 days)
```

For a 7-day trip across Tokyo → Kyoto → Osaka: 7 total − 2 travel = 5 plan days, distributed proportionally.

### Travel day content

Travel days are intentionally left empty (`days.push([])`). GeneratePage renders these as an `EmptyDayCard` with:

- A label like "Travel day — Tokyo to Kyoto"
- A soft copy line: "A relaxed day to move between cities. Explore the train station or rest up."

**Why empty?** Scheduling stops on a travel day creates unrealistic plans — the user is on a train or at an airport. An empty card with a label is more honest than filling it with nearby airport cafes.

### Recovery day

The day immediately after a travel day gets one fewer scheduled stop (`prevWasTravel && max > 1 → max -= 1`). Arriving in a new city typically means settling in, not running a full itinerary from 9 AM.

---

## 13. GeneratePage — Review & Edit

**File:** `src/pages/GeneratePage.tsx`

GeneratePage is the combined loading + review + edit screen. It operates in several modes depending on URL parameters.

### URL parameters

| Param | Effect |
|---|---|
| `?mode=manual` | Skips loading, shows manual stop-search flow |
| `?edit=1` | Skips loading, shows existing itinerary for editing |
| `?after=onboarding` | Shows "Review Your Plan" header variant, CTA reads "Start My Trip →" |
| `?days=N` | Number of trip days to generate |
| `?startTime=HH:MM` | Arrival time (affects Day 1 stop count) |
| `?endTime=HH:MM` | Departure time (affects last day stop count) |
| `?pace=relaxed\|balanced\|fast` | Overrides current pace setting |

### Loading phase

`phase === 'loading'` shows an animated loading screen. Step messages cycle every 700ms. After 2.2 seconds, `phase` flips to `reveal`. The loading state exists for UX pacing — the actual generation is synchronous and instantaneous.

Multi-city loading steps specifically mention travel days and region clustering to set user expectations for what they are about to see.

### Multi-day tab strip

When `isMultiDay`, a horizontal scrollable tab strip appears at the top of the reveal screen. Each tab shows "Day N · DD Mon". The active day's content renders below.

### Stop card interactions

Each stop card supports:
- **Remove** (swipe-left gesture or X button) — calls `removeWithUndo()`, showing a 6-second undo toast
- **Reorder** (up/down arrow buttons)
- **Replace** — opens a replacement picker sheet
- **Edit time** — opens `TimePicker` to set a custom scheduled time for that stop

### Cultural intel cards

Below each stop that has associated cultural data, a `CulturalCard` appears with local tips or context. The first stop's cultural card auto-expands. Others are collapsed. Cards are dismissible per-stop.

### Conflict detection

`hasConflict(place, timeStr)` checks if the scheduled end time (`startTime + durationMin`) exceeds the place's `closeHour`. Conflicting stops are flagged visually.

### Re-roll

"Re-roll suggestions" re-runs `buildFullItinerary()` with the same inputs. Because place selection uses a day-index shuffle, re-rolling produces a different selection from the same vibe/budget filter set.

---

## 14. Recommendation Adding Flow

**File:** `src/pages/GeneratePage.tsx` (Recommendations section)

Below the day's stop list, a "RECOMMENDATIONS" section shows up to 4 alternative places not already in the current itinerary.

### Adding a recommendation

Each recommendation card has a single **"Add"** button. When tapped:

1. The current day's stops plus the candidate place are projected: `[...displayItinerary, altP]`.
2. `dayIsTight(projected)` is called (see [Section 17](#17-density--tight-day-detection)).
3. **If not tight:** `addStop(altP)` is called immediately. Toast: `"{name} added"`.
4. **If tight:** A bottom decision sheet (`tightAdd` state) slides up.

### Tight-day decision sheet

When `dayIsTight` returns `{ tight: true, reason }`, the user sees:

> **This may make your day tighter.**
> You'd have N stops on this day — already close to a full schedule.

Three tap-row options:
- **Adjust the timing** — closes the sheet and scrolls to the day's time editing area
- **Keep it anyway** — calls `addStop(altP)`, shows toast "Added — your day is packed."
- **Skip for now** — closes the sheet with no action

**Why this UX?** Silent adds to an over-packed day create impossible schedules. A hard block is frustrating for experienced users who know what they're doing. A three-option sheet respects user autonomy while making the decision conscious.

---

## 15. Trip Confirmation & Wallet Linkage

### Confirmation

Tapping the primary CTA calls `onConfirm()`:

1. Clears any pending undo state.
2. If manual mode: writes `manualStops` to the global `itinerary`.
3. Fires a success toast.
4. If `isPostOnboarding`: navigates to `/` after 700ms.
5. Otherwise: opens a wallet-link prompt. After 5 seconds with no action, auto-dismisses and navigates to `/map`.

### Wallet auto-mint on first plan

In `proceedIntent()` (HomePage), before navigating to `/generate`:

```ts
const hasUserTrip = trips.some((t) => t.id !== DEFAULT_TRIP.id);
if (!hasUserTrip && intentSheet === 'ai') {
  createTrip({ name: tripName, destination: cities.join(' → '), ... });
  show(COPY.wallet.tripCreatedToast(tripName), 'success');
}
```

A wallet `Trip` is automatically created for the first AI-generated plan. Subsequent plans require the user to manually create wallet trips. The auto-mint only fires once (guarded by `hasUserTrip`).

**Trip naming:**
- Single city: `"Tokyo Trip"`
- Multi-city: `"Tokyo + 2 more"`

The wallet trip's budget is `dailyBudget × days`. The trip is marked `linkedToPlan: true` to distinguish auto-minted trips from manually created ones.

---

## 16. Editing an Existing Trip

Editing re-uses GeneratePage with `?edit=1` in the URL. This parameter:

- Skips the loading animation (jumps directly to `phase = 'reveal'`)
- Changes the header to "Edit Journey"
- Changes the CTA to "Save Changes"

The existing `itinerary` and `perDayItineraries` from AppContext are used as the starting state. All stop-level interactions work identically to the initial review flow.

---

## 17. Density / Tight-Day Detection

**File:** `src/lib/density.ts`

```ts
export interface DensityStop {
  distanceKm: number;
  durationMin: number;
}

export function dayIsTight(stops: DensityStop[]): { tight: boolean; reason: string }
```

### Thresholds

| Metric | Threshold | Reason string |
|---|---|---|
| Stop count | > 5 | `"N stops"` |
| Total distance | > 30 km | `"N km of travel"` |
| Total duration | > 600 min (10 hours) | `"Nh of activity"` |

The function checks all three conditions and returns on the first match. Priority: too many stops → too far → too long.

### Usage

`dayIsTight` is called in two places:
1. **Recommendation Add button** (GeneratePage) — to decide whether to show the decision sheet
2. **Density soft banner** (GeneratePage) — to decide whether to show the amber warning for the current day

The `density.ts` module is intentionally a pure function with no React. The same thresholds and logic can be mirrored on a future backend `/plan` endpoint.

---

## 18. Warnings & Friction States

### Intent sheet banners (`computeIntentBanners`)

**File:** `src/lib/planValidation.ts`

Returns at most one major and one secondary banner. Priority ladder (highest first):

**Major banners:**

| Key | Condition | Copy |
|---|---|---|
| `chaos-regions` | ≥3 distinct regions AND days ≤ regions × 4 | "N regions in N days can feel scattered…" |
| `chaos-cities` | ≥2 regions AND ≥4 cities AND ratio < 2 days/city | "Lots of cities across regions…" |
| `duration-over-20` | 21–30 days | "That's a longer trip — near our 30-day limit…" |
| `ratio-under-1` | cities > 1 AND days < cities | "Each city needs at least a day…" |

**Secondary banners (independent of major):**

| Key | Condition | Copy |
|---|---|---|
| `duration-14-20` | 14–20 days | "Longer trips work best grouped by region…" |
| `ratio-1-to-2` | cities > 1 AND 1 ≤ days/city < 2 | "Less than 2 days per city — it'll feel a bit fast." |

These banners render as amber/yellow strips in the intent sheet with action chips ("Keep only Southeast Asia", "Remove a city"). The user can dismiss or act. They do not prevent plan generation.

### GeneratePage density banner

A separate amber banner at the top of the stop list fires when the current day's stops exceed any of the three density thresholds. It offers:
- "Switch to Relaxed" (if not already relaxed) — triggers a re-roll at 2 stops/day
- "Dismiss" — hides the banner for the session (`pavey_density_hint_dismissed` in localStorage)

### TripTooLongModal

A hard-block modal with a headline, body explaining the 30-day limit, a "Why?" expand section, and a "Got it" dismiss button. This is the only user-blocking UI element in the warning system.

### Overlap warning

When a new plan's dates overlap with the current active trip, a soft confirmation prompt appears. The user can confirm and proceed, or close and change dates.

---

## 19. Regional Clustering Logic

**File:** `src/data/regions.ts`

The region system supports the chaos-detection banners and loading screen messages.

### Region lookup

`getRegion(cityName)` does a fuzzy substring match on the lowercased input against a known keyword table. For example, `"Bangkok, Thailand"` matches the key `"bangkok"` → `'Southeast Asia'`.

9 regions are supported: Southeast Asia, East Asia, South Asia, Europe, North America, Oceania, Middle East, Latin America, Africa.

Cities not in the table return `null`. Unknown cities are silently skipped in chaos detection (they do not count as a distinct region — this is conservative and avoids false positives for unsupported cities).

### Region functions

```ts
getRegion(cityName): Region | null
countDistinctRegions(destNames: string[]): number
suggestPrimaryRegion(destNames: string[]): Region | null  // modal region, ties by first-seen order
filterDestinationsByRegion(destinations, region): Destination[]
```

`suggestPrimaryRegion` picks the most-represented region in the destination list. Used by chaos banners to offer a "Keep only [Southeast Asia]" action chip.

`filterDestinationsByRegion` returns the subset of destinations in that region. Called when the user taps the "Keep only" chip in an intent banner.

---

## 20. Itinerary Constraints & Pacing Rules

### Hard constraints

| Constraint | Value | Enforced by |
|---|---|---|
| Maximum trip duration | 30 days | `TripTooLongModal`, URL safety net in GeneratePage |
| Maximum destinations | 6 | `MAX_DESTINATIONS` constant in HomePage |
| Minimum 1 day per destination | 1 | `allocateDays` floor |
| Cities > days | blocked | `isOverDense()` field error |

### Soft constraints (advisory only)

| Scenario | Suggestion |
|---|---|
| ≥ 3 regions in a short window | Focus on one area |
| ≥ 4 cities across regions, < 2 days each | Narrow to one region |
| 21–30 day trip | Consider splitting into smaller plans |
| < 2 days per city (multi-city) | Add more days |
| 14–20 day trip | Group by region |
| Day > 5 stops / > 30 km / > 10 h | Density warning, offer pace switch |

### Place deduplication

The `usedIds` set in `generateItinerary()` is **global across the full trip**. A place used on Day 1 will not appear again on Day 4. This prevents repetitive plans on longer trips.

### Places exhaustion

If the place catalogue does not have enough places for the city/vibe combination to fill all days, some days will have fewer stops than the pace setting. GeneratePage shows an informational note when this occurs.

---

## 21. Wallet Module

**File:** `src/data/wallet.ts`, `src/pages/WalletPage.tsx`, `src/pages/TripsPage.tsx`

### Data model

```
Trip
  ├── id
  ├── name                    e.g. "Tokyo Trip"
  ├── destination             e.g. "Tokyo → Kyoto"
  ├── currency
  ├── budget                  total amount
  ├── daysTotal
  ├── daysRemaining
  ├── transactions: Transaction[]
  ├── linkedToPlan?: boolean  true = auto-minted from a plan
  └── createdAt

Transaction
  ├── id
  ├── title
  ├── category                'Food & Drinks' | 'Attractions' | 'Transport' | 'Shopping' | 'Top up'
  ├── amount                  negative = expense, positive = top-up
  ├── date
  └── icon
```

### Currency handling

15 currencies are supported. `formatCurrencyAmount()` formats display values per currency rules (e.g. IDR uses "K" abbreviations, JPY rounds to integer). `CURRENCY_RATES_TO_IDR` holds approximate exchange rates for budget arithmetic.

`suggestCurrency(destination)` infers the appropriate currency from the destination name using a keyword table. Used when creating a wallet trip from a plan (e.g. "Tokyo" → JPY).

### Daily allowance

```ts
dailyAllowance = (tripBudget - totalSpent) / daysRemaining
```

Displayed on the wallet home screen. Updates live as expenses are added.

### Empty state

`SEED_TXNS = []` — new users see a true empty wallet state, not demo data. The empty state has an illustration and a prompt to add the first expense.

---

## 22. State Management & Persistence

**File:** `src/context/AppContext.tsx`

AppContext is a single React context using `useState` hooks. All state lives in `AppProvider`. Components consume it via `useApp()`.

### Persistence

A single `localStorage` key (`pavey_state`) holds a JSON snapshot of all persisted state. It is written on every state change via a `useEffect` watching all persisted slices. On mount, `loadPersistedState()` reads the snapshot and pre-populates all `useState` initializers.

**Persisted slices:** `isAuthenticated`, `authUser`, `onboardingComplete`, `everOnboarded`, `vibe`, `budget`, `itinerary`, `savedPlaces`, `destinations`, `trips`, `activeTripId`, `journeyStart`, `placeRatings`, `visitedPlaceIds`, `perDayItineraries`, `pace`.

**Not persisted (session-only):** `rainyDayMode`, `buddyOpen`, `isNavigating`, `visited`, `perDayMeta`.

### Logout

`logout()` resets all state slices to defaults. `everOnboarded` is preserved so returning users skip the welcome splash. A minimal localStorage entry `{ everOnboarded: true }` is written to survive the reset.

### buildFullItinerary

The adapter between React state and the pure planning engine:

```ts
buildFullItinerary: (days, arrivalTime, departureTime) => {
  const { days: planDays, meta } = generateItinerary({
    destinations, activeDestIdx,
    totalDays: days, pace, vibe, budget, rainyDayMode,
    arrivalTime, departureTime,
  });
  setPerDayItineraries(planDays);
  setPerDayMeta(meta);
  setItinerary(planDays.flat());
}
```

Replacing `generateItinerary(...)` with `await api.plan(...)` is the complete backend migration for the planning feature.

---

## 23. Key Components Reference

### `MiniCalendar` (`src/components/MiniCalendar.tsx`)

Canonical date picker. Used in OnboardingPage and HomePage. 7-column grid, range fill, today indicator, past-date disabled. Caller owns all state; the component handles only navigation (prev/next month).

### `IntentBanners` (`src/components/IntentBanners.tsx`)

Renders one major and one secondary advisory banner based on keys from `computeIntentBanners()`. Each major banner can include action chips ("Keep only [region]", "Remove a city"). All copy read from `COPY.banners`.

### `TripTooLongModal` (`src/components/TripTooLongModal.tsx`)

Hard-block slide-up modal for trips > 30 days. Non-dismissible except via "Got it". Explains the limit with a collapsible "Why?" section.

### `TimePicker` (`src/components/TimePicker.tsx`)

Circular clock-face picker for selecting a time. Used for manual time assignment to stops in GeneratePage.

### `Toast` (`src/components/Toast.tsx`)

Bottom-anchored toast notification system. `useToast()` hook exposes `show(message, type)`. Types: `'success'` | `'info'` | `'error'`.

### `Buddy` (`src/components/Buddy.tsx`)

Floating AI assistant panel. Accessible from all main pages via the floating button (hidden on `/generate` and `/navigate`).

### `BottomNav` (`src/components/BottomNav.tsx`)

Tab bar with Home, Map, Wallet, Trips, Profile. Hidden on `/navigate` and `/onboarding`.

---

## 24. Key Utility Libraries Reference

### `src/lib/itinerary.ts`
Pure planning engine. `generateItinerary()`, `allocateDays()`, `computeMaxStops()`. No React. Safe to unit-test with no DOM setup. This is the backend migration target.

### `src/lib/planValidation.ts`
Validation rules. `computeIntentBanners()`, `exceedsMaxDuration()`, `isOverDense()`, `filterDestinationsByRegion()`. No React. `MAX_TRIP_DAYS = 30`. Backend should mirror these rules on the `/plan` endpoint.

### `src/lib/density.ts`
Tight-day detection. `dayIsTight(stops: DensityStop[])`. No React. Thresholds: 5 stops, 30 km, 600 min. Backend can mirror for server-side plan validation.

### `src/lib/copy.ts`
All user-facing strings. No React. Import `COPY` and reference `COPY.section.key`. Template functions accept variables and return strings. This is the i18n swap point — wrapping with an i18n library requires no caller changes.

### `src/lib/format.ts`
`formatCost()`, `isDuplicateDestination()`, `tripsOverlap()`. General-purpose formatting and comparison helpers.

### `src/lib/dateUtils.ts`
`tripDurationDays()`, `isPastDate()`. Date arithmetic helpers used across pages.

### `src/data/regions.ts`
`getRegion()`, `countDistinctRegions()`, `suggestPrimaryRegion()`, `filterDestinationsByRegion()`. City-to-region fuzzy mapping for chaos detection and clustering suggestions.

### `src/data/wallet.ts`
Wallet types (`Trip`, `Transaction`, `Currency`), currency utilities (`suggestCurrency`, `formatCurrencyAmount`, `CURRENCY_SYMBOLS`, `CURRENCY_RATES_TO_IDR`).

---

## 25. Frontend-Only Scope & Known Limitations

### Scope limitations

- **Place catalogue is static seed data.** `PLACES` in `src/data/places.ts` is a hard-coded array. New cities require code changes. There is no API call to a places database.
- **No real distance/routing.** `distanceKm` on each `Place` is an approximate seeded value, not computed from actual coordinates. The density check uses these values, so thresholds are calibrated to seeded distances.
- **No real weather.** The weather card on HomePage is a UI mock (28°C, Partly Cloudy).
- **No authentication server.** Login/signup writes to React state and localStorage only. Any credentials are accepted.
- **No payment or booking.** Wallet tracks expenses manually; no integration with booking services.
- **No push notifications.** All reminders and alerts are in-app only.
- **Currency rates are approximate.** `CURRENCY_RATES_TO_IDR` uses rough static rates. There is no live exchange rate feed.

### Known UX gaps (deferred)

- **MapPage and per-destination date sub-sheet** still use native `<input type="date">`. Replacing them with `MiniCalendar` was deferred.
- **Sticky review header during loading** (journey summary visible while plan generates) was not implemented.
- **Route-level fade transition** (intent-sheet exit → GeneratePage fade-in with no flash) was not implemented.
- **State preservation on "Edit trip"** (restoring intent-sheet values when navigating back from GeneratePage) was not implemented.
- **Unified CTA copy** — GeneratePage still uses legacy strings (`"Start My Trip →"`, `"Confirm My Journey"`) instead of the unified `COPY.ctas.reviewStart`. These should be consolidated.
- **Loading headline** — GeneratePage loading phase does not yet use `COPY.ctas.loadingHeadline` ("Building your plan…").

---

## 26. Backend Migration Path

The frontend planning logic was written with backend extraction in mind. The migration is a series of one-file changes, not a rewrite.

### Planning engine (`itinerary.ts`)

```ts
// Current (frontend — synchronous)
const result = generateItinerary(input);

// Future (backend — async)
const result = await api.post('/plan', input);
```

`GenerateInput` and `GenerateResult` are the exact request/response shapes for a `POST /plan` endpoint. No changes to callers in AppContext.

### Validation (`planValidation.ts`)

These rules should be mirrored on the backend as request validation for `POST /plan`:
- `exceedsMaxDuration(days)` → reject with 422 if `days > 30`
- `isOverDense(citiesCount, days)` → reject with 422 if `citiesCount > days`
- `computeIntentBanners()` → optionally return advisory `warnings[]` in the response body

### Place data

`PLACES` in `src/data/places.ts` becomes a database query:

```
GET /places?city=Tokyo&vibe=cultural&budget=500000
```

`pickDayItinerary()` becomes the query + filtering logic on the backend.

### Wallet

The wallet's entity model maps directly to database tables:

```
GET    /trips
POST   /trips
GET    /trips/:id/transactions
POST   /trips/:id/transactions
```

AppContext's wallet state becomes `useQuery` / `useMutation` calls. The proxy accessors (`tripBudget`, `totalSpent`, etc.) remain unchanged in the interface.

### Auth

Replace the `completeOnboarding` / `signIn` no-ops with real JWT auth. The `isAuthenticated` flag in AppContext continues to control routing — only the source of truth changes.

---

*Last updated: Round 10 — Unified date picker, merged review screen, density-aware Add, beginner-first UX refinements.*
