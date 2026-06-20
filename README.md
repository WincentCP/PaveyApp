# Pavey — Trip Planning App

**Pavey** is a mobile-first travel planning app that generates personalized day-by-day itineraries for popular destinations and links trip planning to a built-in expense wallet. Originally built as a frontend-only prototype, it is now powered by a robust multi-service architecture featuring a React PWA frontend, a FastAPI backend orchestrator connecting to Supabase, and a Python FastAPI AI Core microservice handling cosine-similarity RAG search, weather checks, and Llama LLM generation.

---

## 🌐 Multi-Service Overview & Key Features

This project is organized into three main active directories:

### 1. 📱 Frontend Application ([frontend/](file:///d:/PaveyApp/frontend))
The user-facing mobile-first React web application.
* **Tech Stack**: React 19, TypeScript, Vite, Tailwind CSS, Leaflet, Framer Motion.
* **Key Features**:
  * **Interactive Travel Intent Sheet**: Captures user preferences (destination, vibes, budget, pacing, travel dates).
  * **Visual Itinerary & Map Timeline**: Renders Leaflet maps and interactive step cards with reordering, replacement, and timing controls.
  * **Built-in Expense Wallet**: Connects trip budgets directly to expense logging and currency switching banners.
  * **TinTin AI Assistant**: Chatbot panel for travel inquiries, weather checks, and instant hotel lookups.

### 2. 🔌 Backend Orchestrator ([backend/](file:///d:/PaveyApp/backend))
The FastAPI backend that integrates databases, handles external APIs, and manages OCR parsing.
* **Tech Stack**: Python (FastAPI, httpx, asyncio, PaddleOCR, Supabase SDK).
* **Key Features**:
  * **Google Places Enrichment**: Concurrently fetches real coordinates (latitude/longitude), reviews, ratings, and maps pricing level to IDR.
  * **Duplicate-Free Generation Routing**: Tracks itinerary state and injects `exclude_names` lists to prevent duplicates.
  * **Receipt OCR Parsing**: Uses PaddleOCR to extract receipt data and automatically parse them into wallet expenses.
  * **TinTin AI Secure Router**: Protects internal credentials and API architecture context with strict system prompt limits.

### 3. 🧠 AI Core Engine ([ai-core/](file:///d:/PaveyApp/ai-core))
The recommendation and itinerary generation service running RAG pipelines.
* **Tech Stack**: Python (FastAPI, Sentence-Transformers/IBM Granite Embeddings, Groq Llama, Redis).
* **Key Features**:
  * **IBM Granite Embeddings and Recommendation System with Enhanced Cosine Similarity Algorithm**: Utilizes the IBM Granite Embedding R1.1 (30M parameters) model to transform textual data into high-dimensional semantic vectors. Applying Enhanced Cosine Similarity (by also considering the places' ratings on Google Maps) to these embeddings, the system can capture the deep contextual meaning and contextual nuances of locally scraped destination data, allowing it to recommend relevant attractions that match the user's vibe, even when different keywords are used.
  * **Groq Llama Itinerary Construction**: Generates structured, pacing-compliant day-by-day JSON schedules.
  * **Weather-Driven Dynamic Rerouting**: Checks live OpenWeather state and reroutes to indoor attractions when heavy rain is detected.
  * **Redis Cache Layer v7**: Caches itinerary requests with collision-resistant key hashes including excluded destination names.
  * **MLOps Observability**: Advanced Evidentiary data drift monitoring (KS-Test), Prometheus metrics, Grafana dashboard, Sentry error logging and tracking.

---

## ✨ Key Technical Capabilities (Slide Highlights)

* **🌧️ Real-time Weather Rerouting**: The system dynamically reroutes itineraries when rain or unfavorable weather is detected using the OpenWeather and Google Places APIs.
* **💬 Smart & Flexible Chatbot**: The TinTin travel assistant provides flexible, context-aware itinerary recommendations by combining inputs like local weather, spatial routing, budget constraints, and user preferences.
* **🔍 Advanced Recommendation System**: Leverages an **Enhanced Cosine Similarity** vector search on a local dataset, then formats the output into a clean JSON structure using Groq Llama LLMs for frontend rendering.
* **🦖 Limited Offline Fallback**: Guarantees a continuous user experience in low-connectivity areas by automatically falling back to locally cached historical destination databases.
* **📊 Supporting Features (Monitoring & Logging)**: Features a robust MLOps pipeline tracking system metrics with **Prometheus**, visualizing performance on **Grafana** dashboards, and reporting runtime errors using **Sentry**.

---

## 🚀 Live Demo & Local Setup

### 🔗 Live URL (Vercel)
You can access the live version of Pavey deployed on Vercel at: **[https://frontend-sage-ten-29.vercel.app/](https://frontend-sage-ten-29.vercel.app/)**

### 💻 Running Locally

#### 1. Frontend Setup (React PWA)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

#### 2. Backend Setup (FastAPI Orchestrator)
Make sure to configure the `.env` file inside `backend/` (refer to [backend/README.md](file:///d:/PaveyApp/backend/README.md) for required keys).
```bash
cd backend
# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 3. AI Core Setup (RAG Engine & Docker)
Make sure to configure the `.env` file inside `ai-core/` (refer to [ai-core/README.md](file:///d:/PaveyApp/ai-core/README.md)).
```bash
cd ai-core
docker compose up -d --build ai-core-api
```

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
9. [Single-City Flow](#9-single-city-flow)
10. [Validation Flow](#10-validation-flow)
11. [Itinerary Generation](#11-itinerary-generation)
12. [Travel-Day Logic (Deprecated)](#12-travel-day-logic-deprecated)
13. [GeneratePage — Review & Edit](#13-generatepage--review--edit)
14. [Recommendation Adding Flow](#14-recommendation-adding-flow)
15. [Trip Confirmation & Wallet Linkage](#15-trip-confirmation--wallet-linkage)
16. [Editing an Existing Trip](#16-editing-an-existing-trip)
17. [Density / Tight-Day Detection](#17-density--tight-day-detection)
18. [Warnings & Friction States](#18-warnings--friction-states)
19. [Regional Clustering Logic (Deprecated)](#19-regional-clustering-logic-deprecated)
20. [Itinerary Constraints & Pacing Rules](#20-itinerary-constraints--pacing-rules)
21. [Wallet Module](#21-wallet-module)
22. [State Management & Persistence](#22-state-management--persistence)
23. [Key Components Reference](#23-key-components-reference)
24. [Key Utility Libraries Reference](#24-key-utility-libraries-reference)
25. [Integrated Backend & AI Service Features](#25-integrated-backend--ai-service-features)

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

### City Hint

The intent sheet allows inputting one city at a time. If the user types a country, an inline hint guides them to a starting city (e.g., typing "Japan" will suggest starting with "Tokyo").

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

## 9. Single-City Flow

To ensure high-quality local recommendations, accurate weather rerouting, and consistent distance calculations, the application focus has been locked to a single-city trip planning flow.

### Onboarding & Creation Flow
- The user selects or types a single destination city (e.g. Bali, Jakarta, Tokyo).
- A single itinerary is generated for the duration of the trip within that city context.
- This prevents travel-fatigue schedules and ensures data database matches remain highly relevant.

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

## 12. Travel-Day Logic (Deprecated)

With the single-city destination flow lock, travel-day logic has been deprecated. Itineraries generated focus fully on active days within the selected destination.

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
| `duration-over-20` | 21–30 days | "That's a longer trip — near our 30-day limit…" |

**Secondary banners (independent of major):**

| Key | Condition | Copy |
|---|---|---|
| `duration-14-20` | 14–20 days | "Longer trips work best grouped by region…" |

These banners render as amber/yellow strips in the intent sheet. The user can dismiss or act. They do not prevent plan generation. Legacy multi-city warnings (`chaos-regions`, `chaos-cities`, `ratio-under-1`, `ratio-1-to-2`) are deprecated with the single-city flow.

### GeneratePage density banner

A separate amber banner at the top of the stop list fires when the current day's stops exceed any of the three density thresholds. It offers:
- "Switch to Relaxed" (if not already relaxed) — triggers a re-roll at 2 stops/day
- "Dismiss" — hides the banner for the session (`pavey_density_hint_dismissed` in localStorage)

### TripTooLongModal

A hard-block modal with a headline, body explaining the 30-day limit, a "Why?" expand section, and a "Got it" dismiss button. This is the only user-blocking UI element in the warning system.

### Overlap warning

When a new plan's dates overlap with the current active trip, a soft confirmation prompt appears. The user can confirm and proceed, or close and change dates.

---

## 19. Regional Clustering Logic (Deprecated)

With the lock to single-city trip generation, multi-city regional clustering and region fuzzy lookups have been deprecated.

---

## 20. Itinerary Constraints & Pacing Rules

### Hard constraints

| Constraint | Value | Enforced by |
|---|---|---|
| Maximum trip duration | 30 days | `TripTooLongModal`, URL safety net in GeneratePage |

### Soft constraints (advisory only)

| Scenario | Suggestion |
|---|---|
| 21–30 day trip | Consider splitting into smaller plans |
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

## 25. Integrated Backend & AI Service Features

Pavey has transitioned to a fully integrated backend architecture consisting of:
- **Frontend App**: React PWA that handles user flows and respects backend-enriched data.
- **FastAPI Backend (`backend`)**: Orchestrates data logic, connects to Supabase PostgreSQL, triggers daily generation pipelines, and enriches itinerary items concurrently with real Google Places API details (images, ratings, reviews, and IDR Rupiah pricing).
- **FastAPI AI Core (`ai-core`)**: A microservice that runs Cosine Similarity searches on local datasets via IBM Granite Embeddings, checks weather conditions, and prompts Llama models via Groq to structure itinerary days.

### Key Features Implemented:
* **Unique Multi-Day Recommendations**: Ensures that no duplicate locations are suggested across different days of an itinerary. The backend tracks already generated stop names and sends them via the `exclude_names` array to `ai-core`, which dynamically excludes them from the recommendation pool.
* **Cache Key Integrity (v7)**: The Redis caching layer in AI Core builds a key incorporating sorted, normalized excluded names to prevent daily cache hits that would otherwise cause deterministic duplicate outputs.
* **Concurrent Places API Enrichment**: In both guest preview and saved trip itineraries, the backend fetches real-world coordinates, rating metrics, photos, and estimated cost levels from the Google Places API concurrently (`asyncio.gather`), mapping them directly to IDR (e.g. `PRICE_LEVEL_MODERATE` to `Rp 100,000`).
* **Chatbot Security & Privacy Constraints**: The AI travel buddy (TinTin) prompt is reinforced to politely refuse queries regarding internal system technology (such as "using what APIs?", "what AI models?", or "who developed you?"), preventing internal system leaks.

---

*Last updated: Round 11 — Unique multi-day generation, Google Places API image/cost enrichment, and chatbot privacy guidelines.*
