# Pavey Frontend Application (`frontend`)

This directory contains the main user interface for Pavey, built with React, Vite, Tailwind CSS, and TypeScript. It is designed as a mobile-first travel companion web app.

## Tech Stack
* **Framework**: React 19 & TypeScript
* **Build System**: Vite 8
* **Styling**: Tailwind CSS & Vanilla CSS
* **Animations**: Framer Motion
* **Maps**: Leaflet & React Leaflet (OSM tiles)
* **Icons**: Lucide React

## Structure & Architecture

```
frontend/
├── src/
│   ├── main.tsx          # App entry point
│   ├── App.tsx           # Router and top-level layout
│   ├── components/       # Reusable UI components (BottomNav, Buddy, MiniCalendar, Toast, etc.)
│   ├── context/          # AppContext.tsx for global state management
│   ├── data/             # Static configurations & seed catalogs (places, regions, cultural tips)
│   ├── lib/              # Utility helpers (format, dateUtils, density warning system)
│   ├── pages/            # View pages (HomePage, GeneratePage, MapPage, WalletPage, NavigatePage, etc.)
│   └── chatbot/          # Integrated AI Chatbot components and hooks
├── public/               # Asset folders, icons, SVGs
├── package.json          # Node dependencies
├── vite.config.ts        # Vite configuration
└── tailwind.config.js    # Tailwind layout utility configurations
```

## Running Locally

1. Make sure you are in the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the local app at the URL printed in the terminal (usually `http://localhost:5173`).

## Production Build & Deployments

* **Build command**: `npm run build`
* The project is configured for serverless hosting on Vercel via the `vercel.json` configuration file.
