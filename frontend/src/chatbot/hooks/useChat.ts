/**
 * useChat — rewritten for reliability
 *
 * KEY DESIGN DECISIONS:
 *
 * 1. City resolution order:
 * a) City from AI JSON (`aiCity`) — AI extracts it from user message, most reliable
 * b) Cached `preferences.city` from prior turn
 * c) IP geolocation — LAST resort, only if truly no city anywhere
 * → Never ask "Where?" if city was in the user's original message
 *
 * 2. No `awaitingCityFor` pattern — it causes cascading failures where
 * subsequent valid messages get eaten by the pending-city handler.
 * Instead: if city truly can't be resolved, reply with inline prompt
 * and let the user's next message naturally contain the city.
 *
 * 3. Geocoding with city suffix — "Café Lotus Bali Indonesia" not "Café Lotus"
 * prevents wrong-continent matches (Europe vs Asia).
 *
 * 4. Hotels: always produce output. TripAdvisor → OSM → mock, never silent.
 *
 * 5. Weather: city from JSON always passed directly — no IP fallback needed
 * because the AI always extracts the city from the user's message.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage, RichContent, UserPreferences, Place, LatLng } from '../types'
import { sendMessage, parseResponse } from '../services/ai'
import { getWeatherByCity, getWeatherByCoords } from '../services/weather'
import { geocodeCity, searchPlacesOSM } from '../services/geocoding'
import { searchHotels, geocodeHotel } from '../services/hotel'
import { generateTravelPlan } from '../services/planner'
import { haversineKm } from '../services/routing'
import { apiGetChatHistory } from '../../lib/api'

let _counter = 0
function uid() { return `m${++_counter}-${Date.now()}` }

function stripJsonBlocks(text: string): string {
    return text
        .replace(/```json[\s\S]*?```/gi, '')   
        .replace(/```json[\s\S]*/gi, '')       
        .replace(/```[\s\S]*?```/g, '')         
        .replace(/<DATA_JSON>[\s\S]*?<\/DATA_JSON>/gi, '') 
        .replace(/^\s*[\[{][\s\S]*$/m, '')     
        .trim()
}

// ── IP geolocation — used only as absolute last resort ─────────────────────

async function detectCityFromIP(): Promise<{ city: string; lat: number; lng: number } | null> {
    // Try multiple CORS-friendly IP geo services
    const services = [
        'https://ipapi.co/json/',
        'https://ip-api.com/json/?fields=city,lat,lon,status',
    ]
    for (const url of services) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
            if (!res.ok) continue
                const data = await res.json()
                // ipapi.co format
                if (data.city && data.latitude) return { city: data.city, lat: data.latitude, lng: data.longitude }
                // ip-api.com format
                if (data.status === 'success' && data.city) return { city: data.city, lat: data.lat, lng: data.lon }
        } catch { /* try next */ }
    }
    return null
}

// ── Place enrichment — geocodes with city suffix to prevent continent drift ─

async function enrichPlaces(
    rawPlaces: any[],
    city: string,
    cityCenter: LatLng,
    hotel?: Place
): Promise<Place[]> {
    const osmData = await searchPlacesOSM(cityCenter, 5000)

    const enriched: Place[] = []
    const targetPlaces = rawPlaces.slice(0, 4)

    for (let i = 0; i < targetPlaces.length; i++) {
        const raw = targetPlaces[i]
        const nameWord = raw.name?.split(' ')[0]?.toLowerCase() || ''
        const osmMatch = osmData.find(
            (o) =>
            o.name.toLowerCase().includes(nameWord) ||
            nameWord.includes(o.name.toLowerCase().split(' ')[0])
        )

        let coords: LatLng | null = null
        if (!osmMatch) {
            const countryHint = city
            coords = await geocodeCity(`${raw.name} ${countryHint}`)
            if (!coords) {
                await new Promise((r) => setTimeout(r, 300))
                coords = await geocodeCity(`${raw.name} ${raw.address || ''} ${countryHint}`.trim())
            }
        }

        const lat = osmMatch?.lat ?? coords?.lat ?? cityCenter.lat + (Math.random() - 0.5) * 0.02
        const lng = osmMatch?.lng ?? coords?.lng ?? cityCenter.lng + (Math.random() - 0.5) * 0.02

        const place: Place = {
            id: `place-${i}-${Date.now()}`,
            name: raw.name,
            type: raw.type || 'destination',
            category: raw.category || osmMatch?.category || 'attraction',
            lat,
            lng,
            rating: raw.rating ?? osmMatch?.rating,
            address: raw.address || osmMatch?.address || '',
            description: raw.description || osmMatch?.description || '',
            openHours: raw.openHours || osmMatch?.openHours || '',
        }

        if (hotel) {
            place.distanceFromHotel = haversineKm({ lat: hotel.lat, lng: hotel.lng }, { lat, lng })
        }

        enriched.push(place)
    }

    return enriched
}

// ── Intent specific rich content fetcher ────────────────────────────────────

async function getRichContentForIntent(
    jsonBlock: any,
    city: string,
    coords: LatLng,
    hotel?: Place
): Promise<RichContent | undefined> {
    const { intent, hotel_name, start_time, places: rawPlaces } = jsonBlock
    try {
        switch (intent) {
            case 'check_weather': {
                const weather = await getWeatherByCity(city)
                return { type: 'weather', data: weather! }
            }
            case 'search_hotels': {
                const hotels = await searchHotels(city)
                return { type: 'hotel_search', hotels, city }
            }
            case 'recommend_places': {
                if (!rawPlaces?.length) return undefined
                const places = await enrichPlaces(rawPlaces, city, coords, hotel)
                return { type: 'map', places, center: coords, zoom: 13, hotel }
            }
            case 'travel_plan': {
                if (!rawPlaces?.length) return undefined
                const [places, weather] = await Promise.all([
                    enrichPlaces(rawPlaces, city, coords, hotel),
                    getWeatherByCity(city),
                ])
                const dateStr = new Date().toLocaleDateString('en-US', {
                    weekday: 'long', day: 'numeric', month: 'long',
                })
                const plan = generateTravelPlan(
                    places, hotel || null, start_time || '09:00', weather, dateStr
                )
                return { type: 'travel_plan', plan }
            }
        }
    } catch (err) {
        console.error('Error reconstructing rich content:', err)
    }
    return undefined
}

// ── Main hook ───────────────────────────────────────────────────────────────

export function useChat(tripId?: string, itineraryContext?: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'intro',
            role: 'assistant',
            content: "Hey there! I'm **Pavey** 👋 — your AI travel companion.\n\nI can help you:\n🗺️ **Discover places** in any city\n📅 **Build a full itinerary** with a live map\n🌤️ **Check real-time weather**\n🏨 **Find & compare hotels**\n\nTry: *\"Things to do in Bali\"* or *\"Plan a day in Yogyakarta\"* 🚀",
            timestamp: new Date(),
                                                            isStreaming: false,
        },
    ])
    const [isLoading, setIsLoading] = useState(false)
    const [preferences, setPreferences] = useState<UserPreferences>({})

    // Always-fresh refs to avoid stale closures in callbacks
    const messagesRef = useRef<ChatMessage[]>(messages)
    useEffect(() => { messagesRef.current = messages }, [messages])
    const preferencesRef = useRef<UserPreferences>(preferences)
    useEffect(() => { preferencesRef.current = preferences }, [preferences])

    const pushMsg = useCallback((msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg])
    }, [])

    const updateMsg = useCallback((id: string, patch: Partial<ChatMessage>) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    }, [])

    // ── City resolution ─────────────────────────────────────────────────────
    // Priority: AI-provided city → cached preference → IP → null

    const resolveCity = useCallback(
        async (aiCity?: string): Promise<{ city: string; coords: LatLng } | null> => {
            const candidates = [
                aiCity,
                preferencesRef.current.city,
            ].filter(Boolean) as string[]

            for (const candidate of candidates) {
                const coords = await geocodeCity(candidate)
                if (coords) {
                    setPreferences((p) => ({ ...p, city: candidate }))
                    return { city: candidate, coords }
                }
            }

            // True last resort: IP geo
            const ip = await detectCityFromIP()
            if (ip) {
                const coords = { lat: ip.lat, lng: ip.lng }
                setPreferences((p) => ({ ...p, city: ip.city, userLocation: coords }))
                return { city: ip.city, coords }
            }

            return null
        },
        []
    )
    

    // ── Intent processor ────────────────────────────────────────────────────

    const processIntent = useCallback(
        async (jsonBlock: any, assistantMsgId: string, displayText: string) => {
            const { city: aiCity, hotel_name } = jsonBlock

            // Show clean intro text with loading spinner while enriching
            updateMsg(assistantMsgId, { content: displayText, isStreaming: true, richContent: undefined })

            const cityResult = await resolveCity(aiCity)

            if (!cityResult) {
                // Truly can't determine city — ask inline, don't block future messages
                updateMsg(assistantMsgId, {
                    content: displayText + '\n\nCould you tell me which city you\'re interested in?',
                    isStreaming: false,
                })
                return
            }

            const { city, coords } = cityResult

            // Hotel resolution
            let hotel: Place | undefined = preferencesRef.current.hotel
            const hotelName = hotel_name || preferencesRef.current.pendingHotelName
            if (hotelName && !hotel) {
                const hotelCoords = await geocodeHotel(hotelName, city)
                if (hotelCoords) {
                    hotel = {
                        id: `hotel-${Date.now()}`,
                                      name: hotelName,
                                      type: 'hotel',
                                      lat: hotelCoords.lat,
                                      lng: hotelCoords.lng,
                                      address: `${hotelName}, ${city}`,
                    }
                    setPreferences((p) => ({ ...p, hotel, pendingHotelName: undefined }))
                }
            }

            const richContent = await getRichContentForIntent(jsonBlock, city, coords, hotel)
            updateMsg(assistantMsgId, { content: displayText, richContent, isStreaming: false })
        },
        [resolveCity, updateMsg]
    )

    // ── sendChat ────────────────────────────────────────────────────────────

    const sendChat = useCallback(
        async (userText: string) => {
            if (!userText.trim() || isLoading) return

                // Detect hotel mention
                const hotelMatch = userText.match(
                    /(?:staying at|stay at|hotel|menginap di|nginap di)\s+([A-Z][^\n,.]{2,40})/i
                )
                if (hotelMatch?.[1] && !preferencesRef.current.hotel) {
                    setPreferences((p) => ({ ...p, pendingHotelName: hotelMatch[1].trim() }))
                }

                const userMsg: ChatMessage = {
                    id: uid(), role: 'user', content: userText, timestamp: new Date(), isStreaming: false,
                }
                pushMsg(userMsg)

                const assistantId = uid()
                pushMsg({ id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true })
                setIsLoading(true)

                try {
                    const historySnapshot = messagesRef.current
                    
                    const { displayText, jsonBlock } = await sendMessage(
                        historySnapshot,
                        userText,
                        undefined,
                        tripId,
                        itineraryContext
                    )

                    if (jsonBlock) {
                        await processIntent(jsonBlock, assistantId, displayText)
                    } else {
                        updateMsg(assistantId, {
                            content: displayText || 'Done!',
                            isStreaming: false,
                        })
                    }
                } catch (err) {
                    console.error('[useChat] sendChat error:', err)
                    updateMsg(assistantId, {
                        content: 'Sorry, something went wrong. Please try again!',
                        isStreaming: false,
                    })
                } finally {
                    setIsLoading(false)
                }
        },
        [isLoading, pushMsg, updateMsg, processIntent, tripId, itineraryContext]
    )

    // ── GPS detection ───────────────────────────────────────────────────────

    const detectLocation = useCallback(async () => {
        if (!navigator.geolocation) return
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const coords: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                    setPreferences((p) => ({ ...p, userLocation: coords }))
                    const weather = await getWeatherByCoords(coords)
                    if (weather) {
                        setPreferences((p) => ({ ...p, city: weather.city }))
                        pushMsg({
                            id: uid(),
                                role: 'assistant',
                                content: `📍 Location detected — you're in **${weather.city}**! ${weather.temp}°C, ${weather.description}. What would you like to explore?`,
                                timestamp: new Date(),
                                isStreaming: false,
                                richContent: { type: 'weather', data: weather },
                        })
                    }
                },
                (err) => console.warn('[useChat] geolocation denied:', err.message)
            )
    }, [pushMsg])

    // ── Load Chat History ───────────────────────────────────────────────────

    useEffect(() => {
        if (!tripId || !/^[0-9a-f-]{36}$/i.test(tripId)) {
            // Reset to default intro message if tripId is not a backend UUID
            setMessages([
                {
                    id: 'intro',
                    role: 'assistant',
                    content: "Hey there! I'm **Pavey** 👋 — your AI travel companion.\n\nI can help you:\n🗺️ **Discover places** in any city\n📅 **Build a full itinerary** with a live map\n🌤️ **Check real-time weather**\n🏨 **Find & compare hotels**\n\nTry: *\"Things to do in Bali\"* or *\"Plan a day in Yogyakarta\"* 🚀",
                    timestamp: new Date(),
                    isStreaming: false,
                },
            ])
            return
        }

        let isMounted = true
        setIsLoading(true)

        apiGetChatHistory(tripId)
            .then(async (res) => {
                if (!isMounted) return
                if (res && res.history && res.history.length > 0) {
                    // Map history entries to ChatMessage format
                    const loadedMsgs: ChatMessage[] = res.history.map((h: any, idx: number) => {
                        const role = h.from === 'me' ? 'user' : 'assistant'
                        const content = h.text || ''
                        return {
                            id: `history-${idx}-${Date.now()}`,
                            role,
                            content,
                            timestamp: new Date(),
                            isStreaming: false,
                        }
                    })

                    // Reconstruct rich content for the latest assistant message if it has a JSON block
                    let lastAssistantIdx = -1
                    for (let i = loadedMsgs.length - 1; i >= 0; i--) {
                        if (loadedMsgs[i].role === 'assistant') {
                            lastAssistantIdx = i
                            break
                        }
                    }

                    if (lastAssistantIdx !== -1) {
                        const lastMsg = loadedMsgs[lastAssistantIdx]
                        const { displayText, jsonBlock } = parseResponse(lastMsg.content)
                        // Update content to display text (excluding json)
                        lastMsg.content = displayText

                        if (jsonBlock) {
                            const { city: aiCity, hotel_name } = jsonBlock
                            const cityResult = await resolveCity(aiCity)
                            if (cityResult) {
                                const { city, coords } = cityResult
                                
                                // Resolve hotel
                                let hotel: Place | undefined = preferencesRef.current.hotel
                                const hotelName = hotel_name || preferencesRef.current.pendingHotelName
                                if (hotelName && !hotel) {
                                    const hotelCoords = await geocodeHotel(hotelName, city)
                                    if (hotelCoords) {
                                        hotel = {
                                            id: `hotel-${Date.now()}`,
                                            name: hotelName,
                                            type: 'hotel',
                                            lat: hotelCoords.lat,
                                            lng: hotelCoords.lng,
                                            address: `${hotelName}, ${city}`,
                                        }
                                        setPreferences((p) => ({ ...p, hotel, pendingHotelName: undefined }))
                                    }
                                }

                                const richContent = await getRichContentForIntent(jsonBlock, city, coords, hotel)
                                if (richContent) {
                                    lastMsg.richContent = richContent
                                }
                            }
                        }
                    }

                    setMessages(loadedMsgs)
                } else {
                    setMessages([
                        {
                            id: 'intro',
                            role: 'assistant',
                            content: "Hey there! I'm **Pavey** 👋 — your AI travel companion.\n\nI can help you:\n🗺️ **Discover places** in any city\n📅 **Build a full itinerary** with a live map\n🌤️ **Check real-time weather**\n🏨 **Find & compare hotels**\n\nTry: *\"Things to do in Bali\"* or *\"Plan a day in Yogyakarta\"* 🚀",
                            timestamp: new Date(),
                            isStreaming: false,
                        },
                    ])
                }
            })
            .catch((err) => {
                console.error('[useChat] Failed to load chat history:', err)
            })
            .finally(() => {
                if (isMounted) setIsLoading(false)
            })

        return () => {
            isMounted = false
        }
    }, [tripId, resolveCity])

    return { messages, isLoading, sendChat, detectLocation, preferences }
}
