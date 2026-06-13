// src/App.tsx
import { useState, useRef, useEffect } from 'react'
import { useChat } from './hooks/useChat'
import { MessageBubble } from './components/MessageBubble'
import { Send, Navigation, Map, Calendar, CloudSun, Hotel, Compass } from 'lucide-react'

const QUICK_PROMPTS = [
  { icon: <Compass size={14} />, id: 'wisata', label: 'Explore Places Near Me', prompt: 'Recommend historical museums and top local attractions around my current location' },
{ icon: <Calendar size={14} />, id: 'plan', label: '1-Day Travel Plan', prompt: 'Generate a detailed 1-day itinerary with efficient routing' },
{ icon: <CloudSun size={14} />, id: 'weather', label: 'Check Current Weather', prompt: 'What is the real-time weather update right now?' },
{ icon: <Hotel size={14} />, id: 'hotel', label: 'Plan Around My Hotel', prompt: 'I am staying at a local hotel, build a Pythagorean proximity route itinerary' },
]

export default function App() {
  const { messages, isLoading, sendChat, detectLocation, preferences } = useChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
      sendChat(input)
      setInput('')
      if (inputRef.current) inputRef.current.style.height = '40px'
  }

  const handleQuickPrompt = async (promptText: string) => {
    if (isLoading) return
      if (!preferences.currentCity) {
        const loc = await detectLocation()
        if (!loc) {
          const targetCity = prompt('Please enter your target city name to proceed (e.g., London, Medan):')
          if (!targetCity) return
            sendChat(`${promptText} in ${targetCity}`)
            return
        }
        sendChat(`${promptText} around my detected coordinate location`)
      } else {
        sendChat(`${promptText} in ${preferences.currentCity}`)
      }
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-50 font-sans overflow-hidden">
    {/* Main Interaction Screen */}
    <div className="flex flex-col flex-1 h-full relative">
    {/* Header Navbar */}
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-zinc-900/50 backdrop-blur">
    <div className="flex items-center gap-2">
    <div className="w-7 h-7 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-xs text-white">P</div>
    <span className="font-semibold text-sm tracking-wide bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Pavey AI Terminal</span>
    </div>
    {preferences.currentCity && (
      <div className="text-xs px-2.5 py-1 bg-zinc-800 rounded-full text-zinc-400 flex items-center gap-1.5 border border-white/5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
      <span>{preferences.currentCity}</span>
      </div>
    )}
    </header>

    {/* Dialog Streams Panel */}
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-4xl w-full mx-auto">
    {messages.map((msg) => (
      <MessageBubble key={msg.id} message={msg} isStreaming={msg.isStreaming} />
    ))}
    <div ref={bottomRef} />
    </div>

    {/* Control Action Center */}
    <div className="p-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent max-w-4xl w-full mx-auto space-y-3">
    {/* Horizontal Quick Context Action Bar */}
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mask-gradient">
    {QUICK_PROMPTS.map((qp, index) => (
      <button
      key={index}
      onClick={() => handleQuickPrompt(qp.prompt)}
      disabled={isLoading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/5 text-xs text-zinc-300 hover:text-cyan-400 hover:bg-zinc-850 hover:border-cyan-500/30 transition shadow-sm whitespace-nowrap disabled:opacity-50"
      >
      {qp.icon}
      <span>{qp.label}</span>
      </button>
    ))}
    </div>

    {/* Rich Input Field Core */}
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-2 flex items-end gap-2 focus-within:border-cyan-500/40 transition shadow-inner">
    <textarea
    ref={inputRef}
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }}
    placeholder="Ask about local sights, weather, or requests a smart travel plan..."
    rows={1}
    className="flex-1 bg-transparent text-zinc-100 text-sm placeholder:text-zinc-500 resize-none outline-none px-2 py-1.5 max-h-32 leading-relaxed"
    style={{ height: '40px' }}
    onInput={(e) => {
      const t = e.target as HTMLTextAreaElement
      t.style.height = 'auto'
  t.style.height = `${Math.min(t.scrollHeight, 128)}px`
    }}
    />
    <div className="flex items-center gap-1">
    <button
    onClick={detectLocation}
    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-cyan-400 transition"
    title="Sync Geolocation"
    >
    <Navigation size={16} />
    </button>
    <button
    onClick={handleSend}
    disabled={!input.trim() || isLoading}
    className="w-9 h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-zinc-950 transition font-bold"
    >
    <Send size={15} />
    </button>
    </div>
    </div>
    <p className="text-center text-[10px] text-zinc-600">
    Press Enter to send · Shift+Enter for a new line · All engine connections are open-source.
    </p>
    </div>
    </div>
    </div>
  )
}
