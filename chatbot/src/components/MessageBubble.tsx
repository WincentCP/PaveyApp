import type { ChatMessage } from '../types'
import { MapView } from './MapView'
import { PlaceCarousel } from './PlaceCard'
import { WeatherWidget } from './WeatherWidget'
import { TravelPlanView } from './TravelPlanView'
import { Bot, User } from 'lucide-react'

function renderMarkdownAndCleanJSON(text: string): string {
    // Bersihkan block XML/JSON data dari layout rendering
    let cleaned = text.replace(/<DATA_JSON>[\s\S]*?<\/DATA_JSON>/g, '')
    cleaned = cleaned.replace(/<DATA_JSON>[\s\S]*/g, '') // bersihkan trailing open tags secara aman

    return cleaned
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Perbaikan escape asteris bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>')             // Perbaikan escape asteris italic
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 rounded text-cyan-400 text-xs">$1</code>')
    .replace(/\n/g, '<br/>')
}

interface Props {
    message: ChatMessage
    isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: Props) {
    const isUser = message.role === 'user'
    const rich = message.richContent
    const displayHtml = renderMarkdownAndCleanJSON(message.content)

    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start my-2`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
            ${isUser ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gradient-to-br from-purple-600 to-blue-600 text-white'}`}>
            {isUser ? <User size={16} /> : <Bot size={16} />}
            </div>

            <div className="flex flex-col max-w-[85%] gap-2">
            {displayHtml.trim().length > 0 && (
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words
                    ${isUser ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-zinc-900 border border-white/5 text-zinc-100 rounded-tl-none'}`}>
                    <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
                    {isStreaming && (
                        <span className="inline-block w-1.5 h-4 bg-cyan-400 ml-1 animate-pulse rounded-sm" />
                    )}
                    </div>
            )}

            {rich && !isStreaming && (
                <div className="w-full mt-1">
                {rich.type === 'weather' && (
                    <WeatherWidget data={rich.data} />
                )}

                {rich.type === 'map' && (
                    <div className="space-y-3">
                    <MapView places={rich.places} center={rich.center} zoom={rich.zoom} hotel={rich.hotel} />
                    {rich.places.length > 0 && <PlaceCarousel places={rich.places} />}
                    </div>
                )}

                {rich.type === 'place_cards' && (
                    <PlaceCarousel places={rich.places} />
                )}

                {rich.type === 'travel_plan' && (
                    <TravelPlanView plan={rich.plan} />
                )}
                </div>
            )}

            <p className={`text-[10px] text-zinc-500 ${isUser ? 'text-right' : 'text-left'}`}>
            {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
            </div>
            </div>
    )
}
