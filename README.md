# Persona — Travel Companion

A polished, mobile-first travel companion frontend built with **React + Vite + TypeScript**, **TailwindCSS**, and **Framer Motion**.

It implements four engines from the spec:

- **Home** — Discovery: vibe selector, budget slider, daily-vibe card, "Generate My Journey" CTA, today's plan timeline.
- **Map / Itinerary** — Navigation: faux map, smart pins, route line, place card, drag-aware itinerary, **Start Navigation** flow.
- **Navigation Mode** — Real-time guidance with route progress, smart re-routing prompt, Buddy weather/budget context, arrival state.
- **Wallet** — Finance: balance card, Top Up / Send / Scan / History, **Split bill** with **Add Manually**, donut breakdown, transaction list, OCR scan animation.
- **Profile** — Identity: user card, persona progression, stats grid, badge collection.
- **Buddy** — Global AI overlay launched from the center FAB, with quick actions and conversational replies.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 3 (custom `brand` / `ink` palette)
- Framer Motion (springy, bouncy transitions)
- React Router (page transitions and Generate → Map → Navigate flow)
- lucide-react icons
- Fonts: **Satoshi** (display) + **Plus Jakarta Sans** (body)

All data is mocked in `src/data/*` and managed in `src/context/AppContext.tsx`. There is no backend — every button on Home, Map, and Wallet is fully functional with realistic dummy state.

## Run

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Key flows

- **Generate My Journey** — press → 100ms press feedback → skeleton-shimmer loading with rotating status copy → spring reveal of itinerary → reorder / replace / remove / add stop → Confirm → glow pulse → Map.
- **Start Navigation** — press → Navigation Mode with bold route, pulsing user dot, Buddy prompt, dynamic ETA. Mark visited / Skip / Add expense / Next stop. Arrival celebrates with success card.
- **Wallet** — Top Up, Send, Scan (animated OCR with shimmer + auto-fill), History, **Split bill** with **Add Manually** path. All actions update balance + transactions in real time.

## File map

```
src/
  App.tsx                  # routing + providers
  components/
    PhoneFrame.tsx         # mobile shell
    StatusBar.tsx
    BottomNav.tsx          # 5-tab nav with center Buddy FAB
    Buddy.tsx              # AI overlay (70% sheet)
    Toast.tsx              # global toasts
  pages/
    HomePage.tsx
    GeneratePage.tsx       # loading → reveal → edit → confirm
    MapPage.tsx            # map + pins + itinerary sheet + place card
    NavigatePage.tsx       # navigation mode
    WalletPage.tsx
    ProfilePage.tsx
  context/AppContext.tsx
  data/{places,wallet,user}.ts
  lib/format.ts
```
