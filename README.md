# Pavey — AI-Powered Travel Planning App

## Overview

Pavey is a mobile-first travel planning application built with React 19, TypeScript, Vite, TailwindCSS, and Framer Motion. It enables users to plan, navigate, and budget multi-destination trips through an AI-assisted or fully manual workflow. The app adapts to the user's travel style ("vibe"), filters places by budget, and provides turn-by-turn itinerary navigation with a real-time wallet tracker.

**Core value proposition:** Plan a full day of travel in seconds — or build it stop by stop — then navigate and track spending, all in one app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | TailwindCSS (custom design tokens) |
| Animation | Framer Motion 12 |
| Routing | React Router v6 |
| State | React Context API (`AppContext`) |
| Icons | Lucide React |

---

## Design System

**Colors**
- `brand-*` — Primary blue (`#3B5BFF` = brand-500)
- `ink-*` — Neutrals (ink-900 = near-black, ink-50 = near-white)
- `amber-*` — Highlights and warnings
- `emerald-*` — Success states

**No color gradients.** All backgrounds are solid. Image overlays (photo darkening) and scroll-fade helpers are the only uses of opacity transitions.

**Typography**
- Display headings: `font-display` (bold, tight tracking)
- Body: system sans-serif
- Minimum readable size: 11px (labels), 13px (body)

**Interaction**
- `press` class: `active:scale-95` tap feedback on all interactive elements
- `shadow-glow`: brand-colored glow on primary CTAs
- `no-scrollbar`: hidden scrollbars on all scroll containers

---

## Application Layout

```
App
└── AppProvider (global state)
    └── ToastProvider
        └── PhoneFrame (fluid full-height wrapper)
            └── AppShell (routing + chrome)
                ├── Routes
                │   ├── /onboarding   → OnboardingPage
                │   ├── /             → HomePage
                │   ├── /generate     → GeneratePage

                │   ├── /map          → MapPage
                │   ├── /navigate     → NavigatePage
                │   ├── /wallet       → WalletPage
                │   └── /profile      → ProfilePage
                ├── BottomNav (hidden during /navigate and /onboarding)
                └── Buddy (AI assistant, hidden during /onboarding)
```

**Auth Guard:** `AppShell` reads `onboardingComplete` from context. If false, all routes redirect to `/onboarding`. Onboarding is always accessible regardless of auth state.

**BottomNav tabs:** Home · Map · Wallet · Profile (4-tab grid, no center FAB)

**Buddy FAB:** Floating button anchored at `bottom-[72px] right-4` — outside the nav bar, always accessible.

**Persistent Navigation Bar:** When `isNavigating = true`, a compact pill appears at the **top** of the screen (`inset-x-4 top-10`) showing the current destination. Tapping it returns to `/navigate`.

---

## Global State (AppContext)

### Authentication

| Field | Type | Description |
|---|---|---|
| `isAuthenticated` | boolean | Whether user has signed in |
| `onboardingComplete` | boolean | Whether full onboarding flow finished |
| `isOnboarded` | boolean | Alias for `onboardingComplete` |
| `authUser` | `{name, email} \| null` | Signed-in user info |
| `signIn(name, email)` | fn | Quick sign-in (sets auth + skips onboarding) |
| `completeOnboarding(data)` | fn | Finishes onboarding, creates wallet trip, sets all state |
| `logout()` | fn | Clears all auth + resets itinerary, saved, nav state |

### Itinerary

| Field | Type | Description |
|---|---|---|
| `vibe` | `'chill'\|'chaos'\|'zen'\|'luxury'` | Travel style filter |
| `budget` | number | Per-stop budget in local currency |
| `itinerary` | `Place[]` | Ordered list of planned stops |
| `buildItinerary()` | fn | Generates itinerary from vibe + budget |
| `reorderStop(from, to)` | fn | Drag-reorder stops |
| `removeStop(id)` | fn | Remove a stop by ID |
| `replaceStop(id, place)` | fn | Swap one stop for another |
| `addStop(place)` | fn | Append a stop (deduplicates) |
| `alternatives(excludeIds)` | fn | Get 8 alternative places not in plan |

### Multi-Destination

| Field | Type | Description |
|---|---|---|
| `destinations` | `Destination[]` | Array of trip legs (`id, name, days, currency, itinerary`) |
| `activeDestIdx` | number | Index of currently active destination |
| `addDestination(dest)` | fn | Add a new destination leg |
| `removeDestination(id)` | fn | Remove a destination leg |
| `insertDestination(afterIdx, dest)` | fn | Insert leg at specific position |

### Wallet

| Field | Type | Description |
|---|---|---|
| `trips` | `Trip[]` | All wallet trips |
| `activeTripId` | string | Currently selected trip |
| `activeTrip` | `Trip` | Resolved active trip object |
| `transactions` | `Transaction[]` | Active trip's transactions |
| `addTransaction(t)` | fn | Add expense or income |
| `tripBudget` | number | Active trip total budget |
| `totalSpent` | number | Sum of negative transactions |
| `dailyAllowance` | number | Remaining budget ÷ days remaining |
| `currency` | `Currency` | Active trip currency (IDR, USD, EUR, JPY, SGD, AUD, GBP, THB, MYR, KRW, HKD, CNY, INR, NZD, CAD) |
| `createTrip(data)` | fn | Create new wallet trip |
| `deleteTrip(id)` | fn | Delete trip (minimum 1 must remain) |

### Navigation

| Field | Type | Description |
|---|---|---|
| `isNavigating` | boolean | Whether turn-by-turn nav is active |
| `navIndex` | number | Current stop index in navigation |
| `visited` | `Set<string>` | Set of visited place IDs |
| `markVisited(id)` | fn | Add place to visited set |

### Saved Places

| Field | Type | Description |
|---|---|---|
| `savedPlaces` | `Place[]` | User's bookmarked places |
| `savePlace(p)` | fn | Bookmark a place (deduplicates) |
| `removeSavedPlace(id)` | fn | Remove bookmark |
| `isSaved(id)` | fn | Check if place is bookmarked |

---

## Page-by-Page Documentation

---

### 1. OnboardingPage (`/onboarding`)

**Purpose:** New user setup. Collects auth credentials and trip preferences, then calls `completeOnboarding()` to set up the full app state.

**Skip condition:** If `onboardingComplete` is already true when the page mounts, the user is immediately redirected to `/` (handles back-navigation and already-authenticated users).

**Step Flow:**
```
welcome → auth_form → vibe → destinations → dates → budget → interests → location → /
```

**Progress bar** shown on steps: vibe (1/6) → destinations (2/6) → dates (3/6) → budget (4/6) → interests (5/6) → location (6/6)

**Layout structure:**
```
flex column (full height)
├── Progress bar + back button (shrink-0, always visible)
├── Scrollable content area (flex-1, overflow-y-auto)
│   └── Step title + step-specific UI
└── CTA button footer (shrink-0, always visible, never clipped)
```

The CTA is **outside** the scroll container — it is always visible regardless of content height, screen size, or keyboard state.

---

#### Step: `welcome`

**Design:** White (`bg-white`) full-screen background. Centered SVG logo placeholder (`/mascot.svg`, 160×160) — no app description or tagline text. Two CTAs slide up from the bottom.

**Actions:**
- "Get Started — it's free" → sets `authMode = 'signup'`, goes to `auth_form`
- "I already have an account" → sets `authMode = 'login'`, goes to `auth_form`

---

#### Step: `auth_form`

**Design:** White background. Back arrow returns to `welcome`. Scrollable form fields. CTA pinned at bottom.

**Sign Up fields:** Full Name, Email, Password (show/hide toggle), Confirm Password
**Login fields:** Email, Password

**Validation:**
- Email: required, valid format
- Password: required, minimum 6 characters
- Name (signup only): required
- Confirm Password (signup only): must match password

**On submit:** 1.2s simulated auth loading spinner, then advances to `vibe`.

**Toggle:** "Already have an account? Sign in" / "Don't have an account? Sign up" switches mode without losing entered data.

---

#### Step: `vibe`

**Design:** 2×2 grid of vibe cards.

**Options:**
- 🌴 Chill — "Relaxed beaches & slow mornings"
- 🔥 Chaos — "Full days & hidden street food"
- 🧘 Zen — "Temples, nature & mindful walks"
- 💎 Luxury — "Boutique stays & fine dining"

Active card shows brand-500 border + background + checkmark badge. Default: Zen.

**Continue** → `destinations`

---

#### Step: `destinations`

**Design:** Text input + Add button. Added destinations appear as a reorderable list.

**Quick suggestions** shown when list is empty: Paris, Rome, Bali, Tokyo, Barcelona (tap to add instantly).

**Destination list features:**
- Numbered badges (1, 2, 3…)
- Editable day count per destination (−/+ stepper, min 1)
- Up/Down reorder arrows (disabled at boundaries)
- X remove button
- Multi-city divider banner when 2+ destinations added

**If Continue pressed with empty list:** auto-adds "My Destination" as placeholder.

**Continue** → `dates`

---

#### Step: `dates`

**Design:** Date range picker with a compact inline calendar.

**Two-phase selection:**
- Phase 1 (DEPART): tap a start date → automatically moves to phase 2
- Phase 2 (RETURN): tap an end date (must be ≥ start date)

**Date display chips** at top show selected dates. When both selected, a "DAYS" chip shows total trip duration.

**Reset dates** link clears both dates and returns to phase 1.

**Past dates** are disabled (grayed out, `cursor-default`).

**Continue label:** "Continue" if both dates selected, "Skip for now" if not.

**Continue** → `budget` (duration step removed — days are calculated from date range automatically)

---

#### Step: `budget`

**Design:** Large budget display + range slider + preset buttons.

**Range:** Rp 50K → Rp 1jt+ (IDR, 50,000 to 1,000,000 in 10,000 steps)
**Default:** Rp 500,000
**Presets:** Rp 150K / Rp 300K / Rp 600K
**Wallet preview:** When `totalDays > 1`, shows estimated total trip budget (`budget × 3 stops/day × days`).
**Info note:** "Budget covers entry fees, food, and activities. Transport is extra."

**Date display** shows year when the selected date is in a different calendar year.

**Continue** → `interests`

---

#### Step: `interests`

**Design:** Chip grid of 12 interest options. Optional step.

**Options:** Coffee ☕, Beaches 🏖️, History 🏛️, Art 🎨, Street Food 🍜, Shopping 🛍️, Hiking 🥾, Photography 📷, Nightlife 🌃, Wellness 🧖, Architecture 🏙️, Local Markets 🏪

Multi-select. Active chips show brand-500 fill + checkmark.

**Continue** → `location`
**Skip** → `location` (skips without selecting anything)

---

#### Step: `location`

**Design:** Explanation card + allow/skip actions.

**Benefits listed:**
- 📍 Nearby discovery — find hidden gems within walking distance
- 🧭 Turn-by-turn navigation — live directions between stops
- 🔔 Smart alerts — know when you're close to your next stop

**"Allow Location Access"** button: simulates permission flow (800ms), shows success state with green checkmark when granted.

**"Skip for now"** shows location-denied warning but allows continuing.

**CTA when granted:** "Start exploring →" (emerald green)
**CTA when not granted:** "Continue without location"

**On Continue:** calls `completeOnboarding(data)` which:
1. Sets `authUser`, `isAuthenticated`, `onboardingComplete`
2. Sets `vibe` and `budget`
3. Creates `destinations[]` from entered destinations + date-derived day counts
4. Creates a wallet `Trip` with full budget (budget × totalDays)
5. Sets `journeyStart` with start date and total days
6. Clears `itinerary` (user generates from Home)
7. Navigates to `/`

---

### 2. HomePage (`/`)

**Purpose:** Central dashboard. Shows current itinerary, search, vibe/budget controls, and CTAs to generate a plan.

**Layout:** Full-height scroll. Hero image at top, overlapping glass card, then content sections.

**Top section:**
- Hero image with dark overlay
- Greeting: "Good morning, [FirstName] 👋"
- Current location chip (from `activeDest` or fallback USER.current)
- Search icon button (top right, next to avatar) — expands inline search bar when tapped, collapses on tap again
- Avatar button (top right)

**Daily Vibe Card** (overlaps hero bottom):
- Weather: 28° Partly Cloudy, Humidity 74%
- "Today's Vibe" label with dynamic text
- Estimated cost for nearby spots
- "Sample preview" italic note (clarifies the weather card is placeholder data)

---

#### Section: Multi-Destination Route Strip

Shown only when `destinations.length > 1`.

Horizontal scrollable pill row with destination names and day counts. Active destination highlighted in brand-500. Arrow separators between stops.

"Add stop +" button opens Add Destination sheet.

Tapping a destination pill calls `setActiveDestIdx(i)` to switch context.

---

#### Section: Search + Filter

**Collapsed by default.** Tapping the Search icon in the hero header expands an inline search bar with AnimatePresence transition.

**Search behavior:** Real-time filtering of `PLACES[]` by name, category, and tags. Results appear as dropdown list (max 5). Tapping a result opens the Place Detail sheet.

**Filter sheet:** Opens on filter button tap. Filters: Category (multi-select chips) and Minimum Rating (0, 4.0, 4.3, 4.5, 4.7). Active filter count shown on button badge.

---

#### Section: TODAY'S PLAN

**Header:** "TODAY'S PLAN" label + inline vibe chip (e.g., "🌴 Chill Plan ✏️"). Tapping the chip opens the Vibe & Budget sheet.

**Vibe & Budget Sheet** (bottom sheet):
- 4-vibe grid picker
- Budget range slider
- "Regenerate Plan" CTA → `/generate`

**Case A — Plan exists (`itinerary.length > 0`):**
- If navigating: "Navigation active" banner → taps to `/navigate`
- Day header: DAY N — date — city name
- Vertical timeline of stops with time estimates and distance gaps
- Each stop: tap opens Place Detail sheet, bookmark button toggles saved
- Clear, **Edit Plan**, and **View Map** buttons below timeline
- Edit Plan → `/generate?edit=1` (opens GeneratePage in edit mode, no rebuild)
- View Map → `/map`

**Case B — No plan:**
- Empty state card 🗺️ with contextual message
- "Generate my plan" primary CTA (brand-500, full-width, shadow-glow) → `/generate`
- "or build it stop by stop" text link → `/generate?mode=manual`

**Case C — Next destination preview:**
Shown when `nextDest` exists. Card with destination name, days, currency. "Plan →" button switches active destination.

**Case D — Add destination CTA:**
Shown when single-destination trip and user is onboarded. Dashed border "Add another destination" button.

---

#### Section: Generate CTAs

Two cards side by side:
- **AI Generate** (brand-500) → `/generate`
- **Plan Manually** (outlined) → `/generate?mode=manual`

---

#### Section: Saved Places

Shown only when `savedPlaces.length > 0`. Horizontal scroll of place cards with remove (×) button. Tapping opens Place Detail sheet.

---

#### Place Detail Sheet (modal)

Slides from bottom. Shows: hero image, name, category, rating, hours, price range, distance, description, tags. Actions: Save/Unsave, View on Map.

---

#### Add Destination Sheet (modal)

City/country input + day count stepper. "Add to Trip" button calls `addDestination()`.

---

### 3. GeneratePage (`/generate`)

**Purpose:** Build or edit an itinerary — either AI-generated or manually.

**Entry points:**
- `/generate` — AI mode (loading → reveal)
- `/generate?mode=manual` — Manual mode (instant reveal, plan + search UI)
- `/generate?edit=1` — Edit mode (skips rebuild, shows existing itinerary)

**URL params:**
- `mode=manual` → `isManualMode = true`
- `edit=1` → `isEditMode = true`

**Phase logic:**
```
isManualMode || isEditMode  → phase = 'reveal' (skip loading)
AI mode                     → phase = 'loading' → 'reveal' (after 2.3s)
```

**On mount:**
```
if (!isManualMode && !isEditMode) setItinerary(buildItinerary())
```
Edit mode preserves existing itinerary without rebuilding.

---

#### AI Mode — Loading Phase

Full-screen loading skeleton (1.2s delay) → 2.3s total → transitions to reveal phase. Shows shimmer placeholders for stop cards.

---

#### AI Mode — Reveal Phase

**Stop list** (top): Numbered cards with image, name, category, rating, time, price. Each card has:
- Drag handle (reorder)
- × remove button (4s undo toast)
- Cultural intelligence row (collapsible) — shows local tips, etiquette, language phrases

**Undo system:** Removed stops show "Undo" toast for 6 seconds. Tapping restores the stop in its original position.

**Alternatives section** (bottom): "Try instead" recommendations — 2-column grid of places not in current plan. Tap to add.

**"Add More Stops" button** → opens AlternativesSheet.

**AlternativesSheet (modal):**
- Search input (filters all PLACES by name/category, excludes already-added stops)
- X clear button on search
- Results list with add buttons
- "Add custom place" at bottom

**Confirm Plan** → navigates directly to `/map` (TransitionPage removed)

---

#### Manual Mode — Layout

```
1. YOUR PLAN (top) — existing stops with cultural intel
2. ADD MORE STOPS divider
3. Search input (primary interaction)
4. Filtered results (excluding already-added stops)
5. Add custom place option
6. RECOMMENDED section (places not in plan)
```

Cultural intel shown inline on each plan stop — same as AI reveal mode.

---

#### Shared Features (both modes)

**Start time picker:** Preset time chips (08:00–15:00) for quick selection, plus a "Custom" option that reveals a native `<input type="time">` field.

**Cultural Intelligence per stop:** Collapsible row showing locale-specific tips (etiquette, language, food, transport). Color-coded by category. **First stop auto-expands** on initial load.

---

### 4. MapPage (`/map`)

**Purpose:** Visualize itinerary on map. Switch between map view and list view. Start navigation. Remove stops inline.

**Header:** `PageHeader` with Map icon, title "Map", subtitle showing destination + stop count. Right slot: List/Map toggle button.

**No Edit button in header** — editing happens inline on the cards.

---

#### Multi-Destination Switcher

Shown when `destinations.length > 1`. Horizontal pill row. Active destination is brand-500 filled. Tapping switches `activeDestIdx`.

---

#### Map View

Simulated map canvas (`map-bg` class) with:
- Grid overlay (faint blue lines)
- White road paths (SVG curves)
- Dashed brand-blue route line connecting all stops (animated path-length on mount)
- Animated user location dot (pulsing ring at fixed position)
- Stop pins: white label bubble + numbered brand-500 circle + diamond pointer — tap to open PlaceCard

**Float controls (right side):**
- Crosshair button: re-centers map (toast feedback)
- Navigation button (brand-500): starts navigation → calls `setIsNavigating(true)`, `setNavIndex(0)`, navigates to `/navigate` after 240ms

**Empty state:** If no stops, shows centered empty state card with "Plan [Destination]" CTA → `/generate`.

**ItineraryBottomSheet:**
- Collapsed: drag handle + stop count hint + 3-col stats (Time / Distance / Cost) + Start Navigation button
- Expanded: scrollable stop list (max 32vh) showing each stop with time, rating, price range, and **inline × remove button**
- Removing a stop calls `removeStop(id)` from context immediately

---

#### List View

Scrollable list of stop cards. Between stops: travel distance + estimated drive time dividers.

Each card:
- Full-width hero image (h-28) with darkening overlay
- Stop number badge (top-left)
- Name, category (bottom of image)
- Rating badge (bottom-right)
- Below image: hours, price, scheduled time range, description (2 lines)
- **Inline × remove button** (top-right corner of image, `bg-black/40 backdrop-blur-sm`)

Start Navigation button at bottom.

---

#### PlaceCard (modal)

Slides from bottom when a map pin is tapped. Shows:
- Hero image + close button + stop number badge + name + category + rating + scheduled time
- Previous place "from here" distance indicator
- Info blocks: Hours, Price, Distance
- Description
- Tags
- Cultural intelligence section (collapsible)
- Actions: Save/Unsave + Navigate (starts navigation)
- "Ask Buddy about this" button

---

#### Empty Destination State

Two variants:
- **Overlay** (map view): Slides from bottom with 🗺️ emoji, message, and "Plan [Destination]" button
- **Inline** (list view): Centered in scroll area with same content

---

### 6. NavigatePage (`/navigate`)

**Purpose:** Turn-by-turn navigation through itinerary stops. Simulates GPS progress.

**Entry:** From MapPage Start Navigation button → `isNavigating = true`, `navIndex = 0`, navigate to `/navigate`.

**BottomNav is hidden** on this route.

**Layout:**
```
StatusBar
Top bar: Back to map | Navigation destination chip | Pause button
Map canvas (flex-1): Simulated route + user dot progress
Bottom card: Arrived state OR In-progress state
```

---

#### Top Bar

- **Back arrow** → `/map` (does not cancel navigation)
- **Destination chip** (brand-500): shows "Navigating to [stop name]", ETA, distance remaining
- **Pause/Resume** button: pauses progress simulation

---

#### Map Canvas

- White road SVG paths
- Animated brand route line (full path + traveled portion overlaid)
- User dot moves along bezier path based on `progress` (0→1)
- Stop destination marker (brand-500 pill label + diamond pointer) at destination position
- All stops mini list (top-right): shows ✓ (visited), → (current), or number badge

**Buddy prompt:** Appears mid-journey (at ~55% progress) with a contextual tip. Dismiss button.

---

#### Progress Simulation

`setInterval` (120ms) increments `progress` by 0.012 per tick (~84 ticks to complete = ~10 seconds). Pauses when `paused = true`. When `progress >= 1`, sets `arrived = true`.

---

#### Bottom Card — In-Progress

- Stop image thumbnail + number badge + name + category + hours
- Progress bar (animated width)
- ETA and distance remaining
- Action buttons: Visited | Skip | Buddy
- Cancel Navigation button (red border)
- "Up next" preview of next stop

---

#### Bottom Card — Arrived

Full-width emerald card:
- "You've arrived! 🎉" + stop name
- "Mark visited" → calls `markVisited(current.id)`, shows success toast
- "Next stop ›" or "Finish trip 🏁" (if last stop)

**"Next stop":** increments `navIndex`, resets `progress` to 0, resets `arrived`, shows toast "Heading to [next stop name]".

**"Finish trip":** calls `setIsNavigating(false)`, `completeTrip()`, navigates to `/profile` after 600ms.

---

#### Cancel Navigation Modal

Confirmation sheet:
- "Stop navigating?" header
- "Continue navigating" — full-width brand-500 primary button (top)
- "Stop and go to map" — red text link below (no button shape)

Stop and go to map → `setIsNavigating(false)`, navigates to `/map`.

---

#### Edge Case: No Current Stop

If `itinerary` is empty or `navIndex` is out of range, shows full-screen fallback:
- ⚠️ warning icon
- "No active route. Go back to the map to start navigation."
- "Back to Map" button

---

### 7. WalletPage (`/wallet`)

**Purpose:** Budget tracking for the active trip. Add expenses, split bills, scan receipts.

**Header:** `PageHeader` with Wallet icon. Right slot: Bell notification button (default) or "COMPLETED" badge (when `tripCompleted`).

---

#### Trip Selector Pills

Horizontal scrollable pill row of all trips. Active trip: brand-500 filled. Inactive: ink-50 outlined. No inline delete buttons.

"New Trip +" button opens NewTripSheet.

**"Manage" button** appears when `trips.length > 1` and opens a Manage Trips bottom sheet — allows switching active trip and deleting trips (with confirmation modal).

---

#### Budget Card

Solid brand-600 blue card. Shows:
- Trip name + Edit button (opens EditBudgetSheet) + Currency chip (opens CurrencyPickerSheet)
- Total Budget / Spent / Remaining (3-column grid)
- Remaining: emerald if under, red if over budget
- Progress bar: emerald → amber (>80%) → red (over budget)
- Daily Allowance: `(budget - spent) / daysRemaining`
- Days Left counter
- **Smart insight** (shown after day 1): "On track — projected total X" or "At this pace you'll overspend by X — save Y/day"

---

#### Quick Actions

Grid of action buttons (adapts columns based on `isNavigating` and `tripCompleted`):
- **Add Expense** — opens AddExpenseSheet (hidden during navigation or when trip completed)
- **Split Bill** — opens SplitBillSheet
- **Scan** — opens ScanSheet (receipt OCR simulation)
- **History** — opens HistorySheet

If navigating or trip completed, shows a contextual info banner.

---

#### Expense Breakdown

Donut chart (SVG, animated) showing spending by category. Legend below with category name, amount, percentage.

---

#### Recent Transactions

Last 5 transactions with icon, title, date (relative), amount, optional tag badge.

**Empty state:** When `transactions.length === 0`, shows 💸 "No expenses yet" centered card with helper text.

**"See all ›"** → opens HistorySheet (only shown when transactions exist).

---

#### Sheets

**EditBudgetSheet:** Trip name input, budget number input, preset buttons (currency-aware), days remaining stepper.

**AddExpenseSheet:** Title input (auto-focused), amount input, category selector (Food, Attraction, Transport, Shopping). Submit disabled until title and amount > 0.

**ScanSheet:** Simulated camera view with scan line animation (2.2s), then shows detected items list with confidence scores (color-coded: green ≥95%, amber ≥85%, red below). "Add total to Expenses" button.

**HistorySheet:** Full transaction list (all transactions, scrollable).

**NewTripSheet:** Trip name, destination (auto-suggests currency), budget input, day count stepper.

**CurrencyPickerSheet:** Searchable list of 15 currencies (IDR, USD, EUR, JPY, SGD, AUD, GBP, THB, MYR, KRW, HKD, CNY, INR, NZD, CAD) with flag, name, symbol. Live search filters by name or code. Checkmark on current selection. Warning banner when existing transactions are present (currency change won't convert historical amounts).

**SplitBillSheet:** Multi-step flow:
1. **Entry** — Choose: Scan Receipt / Upload Photo / Add Manually
2. **Scanning** — Animated scan screen (2.2s) → auto-populates items
3. **Edit** — Bill title, item list (editable name/price, delete), add new items, tax/service sliders, grand total
4. **People** — Split type (Equal / Custom / By Item), participant list, add people
5. **Assign** (By Item mode only) — Tap people to assign items; unassigned = split evenly
6. **Review** — Per-person breakdown, "who paid" selector, wallet impact note, Share + Confirm

---

#### Trip Completed State

When `tripCompleted = true`:
- "COMPLETED" badge in header
- Summary banner with total spent, saved/over budget, transaction count
- Wallet is read-only (Add Expense hidden, locked banner shown)

---

### 8. ProfilePage (`/profile`)

**Purpose:** User profile, travel stats, badges, settings, and logout.

**Header:** `PageHeader` with User icon. Right slot: Settings gear button.

---

#### User Card

Avatar image, display name, location, email, phone. "Edit" button (placeholder).

---

#### Persona Progress (returning users only)

Brand-50 solid background card. Shows persona title (e.g., "The Wanderer"), progress bar (solid brand-500), percentage, and next level label. Chevron indicates it's tappable.

---

#### New User Welcome Banner

Shown when `visited.size === 0 && transactions.length === 0`. Solid brand-50 banner with ✈️ and "Ready to explore? Your stats, badges, and journey history will appear here as you travel."

---

#### Stats Grid (2×2)

Stat cards with colored backgrounds. Fields populated dynamically:

| Stat | New User | Returning User |
|---|---|---|
| Trips Completed | 0 | `USER.stats.trips` |
| Places Explored | 0 | `visited.size` |
| Hidden Gems | 0 | `USER.stats.hiddenGems` |
| Saved Places | `savedPlaces.length` | `savedPlaces.length` |

Tapping a stat card (returning users only) opens a detail sheet with contextual insight text.

---

#### Recent Trips (returning users only)

List of past trips with date, duration, place count, and total spend.

---

#### Badges

**New user:** 4 locked badge slots (greyed out, 🔒 overlay) with names and unlock conditions.

**Returning user:** Animated badge hexagons with solid color fills (no gradients), name and subtitle.

---

#### Settings List

- Saved Places (with badge count if any)
- Travel History
- Payment Methods
- Help & Support

---

#### Logout

Red-tinted row button → shows confirmation bottom sheet.

**Logout confirmation:**
- 🚪 "Log out?" with message "You'll be taken back to the welcome screen."
- "Stay logged in" — full-width brand-500 primary button (top, shadow-glow)
- "Log out" — red text link below (no button shape)
- "Log out" calls `logout()` + `nav('/onboarding', { replace: true })`

`logout()` clears: `isAuthenticated`, `authUser`, `onboardingComplete`, `itinerary`, `visited`, `savedPlaces`, `isNavigating`, `navIndex`.

---

## Navigation Structure

```
/onboarding ←─── auth guard (if !onboardingComplete)
     │
     └──── completeOnboarding() ──→ /

/  (HomePage)
     ├──→ /generate              (AI Generate CTA)
     ├──→ /generate?mode=manual  (Plan Manually CTA)
     ├──→ /generate?edit=1       (Edit Plan button)
     └──→ /map                   (View Map button)

/generate
     └──→ /map                   (Confirm Plan — TransitionPage removed)

/map
     ├──→ /generate?edit=1       (edit now inline on cards)
     └──→ /navigate              (Start Navigation)

/navigate
     ├──→ /map                   (Back arrow or Cancel)
     └──→ /profile               (Finish Trip)

/wallet  — self-contained, sheets only
/profile — self-contained, sheets only; logout → /onboarding
```

**BottomNav** links: `/` · `/map` · `/wallet` · `/profile` (4-tab grid, hidden on `/navigate` and `/onboarding`)

**Buddy FAB:** Floating `bottom-[72px] right-4` button. Hidden on `/onboarding`.

**Persistent Navigation Bar:** Compact top pill shown when `isNavigating = true` on any non-navigate page. Tapping goes to `/navigate`.

---

## State Handling

### Empty States

| Scenario | UI |
|---|---|
| No itinerary on Home | 🗺️ card + "Generate my plan" primary CTA + "or build it stop by stop" text link |
| No itinerary on Map (map view) | Animated bottom card with "Plan [Destination]" CTA |
| No itinerary on Map (list view) | Centered empty state with same CTA |
| No transactions in Wallet | 💸 "No expenses yet" card with helper text |
| New user on Profile | Welcome banner + locked badges + zero stats |
| No current stop in Navigate | ⚠️ fallback screen with "Back to Map" |

### Loading States

| Scenario | UI |
|---|---|
| AI itinerary generation | 1.2s delay → shimmer skeleton cards → reveal with animation |
| Auth form submission | Rotating Sparkles spinner on button for 1.2s |
| Receipt scanning | Animated scan line for 2.2s |

### Edge Cases

| Scenario | Behavior |
|---|---|
| User navigates to `/onboarding` when already authed | Redirected to `/` on mount |
| GeneratePage opened with `?edit=1` | No itinerary rebuild, loads in `reveal` phase |
| Stop removed during navigation | `visited` set and `navIndex` unaffected; stop removed from `itinerary` |
| Trip deletion when only 1 trip exists | `deleteTrip` no-ops |
| Wallet Add Expense when `isNavigating = true` | Button hidden; locked banner shown |
| Wallet all actions when `tripCompleted = true` | Add Expense hidden, Split/Scan disabled, read-only banner |
| Back navigation during onboarding | `back()` follows `FLOW` array order; never goes to removed `duration` step |

---

## Key Entry Points Summary

| Action | Entry Point | Route |
|---|---|---|
| Start AI plan | Home "AI Generate" card | `/generate` |
| Start manual plan | Home "Plan Manually" card | `/generate?mode=manual` |
| Edit existing plan | Home "Edit Plan" button | `/generate?edit=1` |
| Remove a stop | Map bottom sheet × button | inline |
| Remove a stop | Map list view × button | inline |
| Start navigation | Map "Start Navigation" button | `/navigate` |
| Return to navigation | Persistent nav bar (any page) | `/navigate` |
| Add a destination | Home route strip "+" | Add Destination sheet |
| Add a stop | GeneratePage "Add More Stops" | AlternativesSheet |
| Log out | Profile → Log Out | `/onboarding` |
| Track expense | Wallet "Add Expense" | AddExpenseSheet |
| Split a bill | Wallet "Split Bill" | SplitBillSheet |
| Create new wallet trip | Wallet "New Trip +" | NewTripSheet |

---

## User Scenarios

### Scenario 1: First-Time User

1. Opens app → `onboardingComplete = false` → redirected to `/onboarding`
2. Welcome screen (solid blue bg, white logo): taps "Get Started"
3. Auth form: enters name, email, password, confirm → "Create Account" → 1.2s load → moves to Vibe
4. Selects Vibe (e.g., Chill) → Continue
5. Adds "Bali, Indonesia" to destinations → Continue
6. Selects date range (e.g., Jun 15 → Jun 20, 6 days) → Continue
7. Sets budget Rp 300K → Continue
8. Selects interests (Coffee, Beaches) → Continue
9. Taps "Allow Location Access" → granted → CTA becomes "Start exploring →"
10. Taps continue → `completeOnboarding()` → lands on `/`
11. HomePage: empty plan, sees action grid with AI Generate and Plan Manually
12. Taps "AI Generate" → `/generate` → 2.3s loading → itinerary revealed
13. Reviews stops, maybe removes one, taps "Confirm My Journey"
14. Navigates directly to `/map` with itinerary on map
15. Taps "Start Navigation" → `/navigate`
16. Follows route, marks stops visited, finishes → redirected to `/profile`

---

### Scenario 2: Returning Authenticated User

1. Opens app → `onboardingComplete = true` → redirected to `/` immediately (OnboardingPage skips)
2. HomePage shows existing itinerary with timeline
3. User wants to change a stop → taps "Edit Plan" → `/generate?edit=1`
4. GeneratePage loads in reveal phase (no rebuild) showing existing stops
5. User removes a stop (6s undo toast shown), swaps another via AlternativesSheet
6. Taps "Confirm My Journey" → directly to `/map`

---

### Scenario 3: Editing Plan Mid-Trip (from Map)

1. User is on `/map` viewing their plan
2. Notices a stop they want to remove
3. Taps collapsed bottom sheet to expand → sees stop list with × buttons
4. Taps × on unwanted stop → stop removed immediately from `itinerary` via `removeStop()`
5. Alternatively switches to List view → taps × on card image overlay
6. No navigation away from map required

---

### Scenario 4: Multi-Destination Trip

1. During onboarding destinations step: adds "Tokyo, Japan" → "Kyoto, Japan" → "Osaka, Japan"
2. Three numbered destinations appear in reorderable list
3. Completes onboarding → `destinations[]` has 3 entries with auto-distributed days
4. Home shows route strip: Tokyo → Kyoto → Osaka with day counts
5. Active destination (Tokyo) is highlighted
6. User generates plan for Tokyo (AI) → confirmed
7. Taps "Kyoto" pill in route strip → `activeDestIdx = 1`
8. Home shows "No plans for Kyoto" empty state → taps "AI Generate"
9. On Map: destination switcher shows all 3, active one highlighted

---

### Scenario 5: Wallet — Full Trip Budget Flow

1. After onboarding, wallet has one trip auto-created with budget = `dailyBudget × totalDays`
2. User opens Wallet → sees Budget Card with full budget, 0 spent
3. No transactions → "No expenses yet" empty state
4. Taps "Add Expense" → enters "Nasi Goreng Rp 45,000", category Food → Add
5. Transaction appears, donut chart updates, remaining balance decreases
6. After 2 days, Smart Insight appears: projects total and compares to budget
7. User wants to split dinner → "Split Bill" → scans receipt → assigns items to friends → confirms: adds "your share" to wallet
8. Trip ends → `completeTrip()` called → COMPLETED badge in header, wallet read-only, summary banner shown

---

### Scenario 6: Changing Vibe Mid-Trip

1. On HomePage, taps the "🌴 Chill Plan ✏️" chip next to "TODAY'S PLAN"
2. Vibe & Budget sheet slides up
3. Taps "🔥 Chaos" vibe
4. Adjusts budget slider to Rp 600K
5. Taps "Regenerate Plan" → navigates to `/generate` with updated vibe + budget

---

## Flows That Were Removed / Changed

| Old Behavior | New Behavior |
|---|---|
| "Trip Duration" onboarding step existed | Removed entirely; duration derived from date range |
| Onboarding used `position: fixed` CTA button | CTA is `shrink-0` flex footer, always visible |
| Phone frame clipped fixed-position elements on desktop | PhoneFrame is now a fluid full-height wrapper |
| OnboardingPage accessible even when logged in | Redirects to `/` on mount if `onboardingComplete = true` |
| MapPage header had "Edit" button → `/generate?edit=1` | Edit button removed; inline × on cards |
| Timeline vertical line bled into Edit Plan button | Buttons moved outside timeline `relative` container |
| Purple gradient backgrounds throughout app | All color gradients replaced with solid brand/ink colors |
| Welcome screen: blue→purple gradient | Solid `bg-brand-500` blue |
| TransitionPage existed as loading screen | Removed; Confirm Plan navigates directly to `/map` |
| Gradient in persona progress, badges, banners | Solid colors throughout |

---

*This README reflects the app as implemented after all UX fixes described in the development session.*
