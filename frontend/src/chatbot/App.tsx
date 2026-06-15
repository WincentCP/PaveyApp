import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from './hooks/useChat'
import { MessageBubble } from './components/MessageBubble'
import {
  Send, MapPin, Navigation, Map, Calendar,
  CloudSun, Hotel, Menu, X, Compass, Search,
} from 'lucide-react'

// ── Quick prompt definitions ─────────────────────────────────────────────────
// Each prompt either fires directly (if city known) or triggers city-ask modal

interface QuickPrompt {
  icon: JSX.Element
  label: string
  buildPrompt: (city: string) => string
  needsCity: boolean
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    icon: <Map size={14} />,
    label: 'Places Near Me',
    buildPrompt: (city) => `What are the best tourist spots and attractions in ${city}?`,
    needsCity: true,
  },
{
  icon: <Calendar size={14} />,
  label: 'Plan My Day',
  buildPrompt: (city) => `Build me a full 1-day travel itinerary in ${city}`,
  needsCity: true,
},
{
  icon: <CloudSun size={14} />,
  label: 'Check Weather',
  buildPrompt: (city) => `What is the current weather in ${city}?`,
  needsCity: true,
},
{
  icon: <Hotel size={14} />,
  label: 'Find Hotels',
  buildPrompt: (city) => `Find me hotels in ${city}`,
  needsCity: true,
},
]

// ── City ask modal ────────────────────────────────────────────────────────────

interface CityModalProps {
  promptLabel: string
  onConfirm: (city: string) => void
  onClose: () => void
}

function CityModal({ promptLabel, onConfirm, onClose }: CityModalProps) {
  const [city, setCity] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = () => {
    if (city.trim()) { onConfirm(city.trim()); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
    <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
    <div className="flex items-center justify-between mb-4">
    <div>
    <p className="text-white font-semibold">Which city?</p>
    <p className="text-xs text-muted mt-0.5">for <span className="text-accent">{promptLabel}</span></p>
    </div>
    <button onClick={onClose} className="text-muted hover:text-white transition">
    <X size={18} />
    </button>
    </div>

    <div className="flex gap-2">
    <input
    ref={inputRef}
    value={city}
    onChange={(e) => setCity(e.target.value)}
    onKeyDown={(e) => e.key === 'Enter' && submit()}
    placeholder="e.g. Bali, Jakarta, Yogyakarta"
    className="flex-1 bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-muted outline-none focus:border-accent/60 transition"
    />
    <button
    onClick={submit}
    disabled={!city.trim()}
    className="px-4 py-2.5 bg-accent text-ink-950 rounded-xl font-semibold text-sm disabled:opacity-40 transition hover:bg-accent/80"
    >
    Go
    </button>
    </div>

    <p className="text-xs text-muted mt-3 text-center">
    Or just type your question in the chat below
    </p>
    </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { messages, isLoading, sendChat, detectLocation, preferences } = useChat()
  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cityModal, setCityModal] = useState<{ prompt: QuickPrompt } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isLoading) return
      sendChat(text)
      setInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
  }, [input, isLoading, sendChat])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickPrompt = (prompt: QuickPrompt) => {
    setSidebarOpen(false)
    // If we already know the city (IP detected or user told us), fire immediately
    if (preferences.city) {
      sendChat(prompt.buildPrompt(preferences.city))
      return
    }
    // Otherwise open the city modal
    setCityModal({ prompt })
  }

  const handleCityConfirm = (city: string) => {
    if (!cityModal) return
      sendChat(cityModal.prompt.buildPrompt(city))
      setCityModal(null)
  }

  return (
    <div className="flex h-dvh bg-surface font-sans overflow-hidden">

    {/* ── City modal ──────────────────────────────────────────────────────── */}
    {cityModal && (
      <CityModal
      promptLabel={cityModal.prompt.label}
      onConfirm={handleCityConfirm}
      onClose={() => setCityModal(null)}
      />
    )}

    {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
    <aside className={`
      absolute inset-y-0 left-0 z-40 w-72 bg-card border-r border-border
      transform transition-transform duration-300
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:static lg:translate-x-0
      `}>
      <div className="flex flex-col h-full p-4 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
      <Compass size={16} className="text-white" />
      </div>
      <div>
      <p className="font-display font-bold text-white leading-none">Pavey</p>
      <p className="text-xs text-muted">AI Travel Companion</p>
      </div>
      </div>
      <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted hover:text-white">
      <X size={20} />
      </button>
      </div>

      {/* Active context */}
      {(preferences.city || preferences.hotel) && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 mb-4 space-y-1.5">
        <p className="text-xs text-accent font-semibold uppercase tracking-wider">Active Context</p>
        {preferences.city && (
          <p className="text-sm text-white flex items-center gap-1.5">
          <MapPin size={12} className="text-accent" />
          {preferences.city}
          </p>
        )}
        {preferences.hotel && (
          <p className="text-sm text-white flex items-center gap-1.5">
          <Hotel size={12} className="text-purple-400" />
          {preferences.hotel.name}
          </p>
        )}
        </div>
      )}

      {/* Quick actions */}
      <p className="text-xs text-muted uppercase tracking-wider mb-2 font-mono">Quick Actions</p>
      <div className="space-y-1">
      {QUICK_PROMPTS.map((q) => (
        <button
        key={q.label}
        onClick={() => handleQuickPrompt(q)}
        className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:text-white transition flex items-center gap-2.5"
        >
        <span className="text-accent">{q.icon}</span>
        {q.label}
        </button>
      ))}
      </div>

      {/* Detect location */}
      <button
      onClick={() => { detectLocation(); setSidebarOpen(false) }}
      className="mt-3 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:text-white border border-border transition"
      >
      <Navigation size={14} className="text-warm" />
      Detect My Location
      </button>

      {/* Search */}
      <button
      onClick={() => {
        setSidebarOpen(false)
        textareaRef.current?.focus()
      }}
      className="mt-2 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:text-white border border-border transition"
      >
      <Search size={14} className="text-accent" />
      Search a destination
      </button>

      <div className="mt-auto pt-4 border-t border-border">
      <p className="text-xs text-muted leading-relaxed">
      Powered by open-source AI<br />
      Leaflet · OSRM · OpenStreetMap<br />
      OpenWeatherMap · TripAdvisor
      </p>
      </div>
      </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="absolute inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main chat ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full">

      {/* Topbar */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
      <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted hover:text-white">
      <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
      <Compass size={13} className="text-white" />
      </div>
      <span className="font-display font-bold text-white">Pavey</span>
      </div>
      {preferences.city && (
        <span className="text-xs text-muted flex items-center gap-1">
        <MapPin size={10} className="text-accent" />
        {preferences.city}
        </span>
      )}
      {isLoading && (
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
        <span className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" />
        Thinking…
        </div>
      )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
      </main>

      {/* Quick prompt chips — only show at start */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
        {QUICK_PROMPTS.map((q) => (
          <button
          key={q.label}
          onClick={() => handleQuickPrompt(q)}
          className="flex-shrink-0 flex items-center gap-1.5 bg-card border border-border text-slate-300 text-xs px-3 py-2 rounded-full hover:border-accent/50 hover:text-white transition"
          >
          <span className="text-accent">{q.icon}</span>
          {q.label}
          </button>
        ))}
        </div>
      )}

      {/* Input bar */}
      <footer className="px-4 pb-safe pb-4 pt-2 flex-shrink-0">
      <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-3 py-2 focus-within:border-accent/50 transition">
      <textarea
      ref={textareaRef}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={handleKey}
      placeholder="Ask about places, weather, hotels, or request a travel plan…"
      rows={1}
      className="flex-1 bg-transparent text-white text-sm placeholder:text-muted resize-none outline-none py-1.5 max-h-32 leading-relaxed"
      style={{ minHeight: '36px' }}
      onInput={(e) => {
        const t = e.target as HTMLTextAreaElement
        t.style.height = 'auto'
        t.style.height = Math.min(t.scrollHeight, 128) + 'px'
      }}
      />
      <div className="flex items-center gap-1 pb-0.5">
      <button
      onClick={detectLocation}
      title="Detect my location"
      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted hover:text-warm transition"
      >
      <Navigation size={15} />
      </button>
      <button
      onClick={handleSend}
      disabled={!input.trim() || isLoading}
      className="w-8 h-8 rounded-xl bg-accent hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-ink-950 transition"
      >
      <Send size={15} />
      </button>
      </div>
      </div>
      <p className="text-center text-xs text-muted mt-1.5">
      Enter to send · Shift+Enter for new line
      </p>
      </footer>
      </div>
      </div>
  )
}
