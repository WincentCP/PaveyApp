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