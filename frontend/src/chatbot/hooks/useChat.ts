/**
 * useChat.ts — Main chat state + intent orchestrator with history fetching
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { sendMessage, stripDataJson, parseAIResult, type HistoryMsg } from '../ai';
import { fetchWeather } from '../services/weather';
import { enrichPlaces } from '../services/geocoding';
import { searchHotels } from '../services/hotels';
import { generateTravelPlan } from '../services/planner';
import type { ChatMsg, RichContent, ChatPlace } from '../types';
import { useApp } from '../../context/AppContext';
import { apiGetChatHistory } from '../../lib/api';

function uid() {
    return Math.random().toString(36).slice(2, 9);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChat(tripId?: string, itineraryContext?: string) {
    const { isAuthenticated } = useApp();
    const [msgs, setMsgs] = useState<ChatMsg[]>([
        {
            id: uid(),
            role: 'assistant',
            text: "Hey! 👋 I'm TinTin, your Pavey travel companion. Ask me anything — places to visit, weather, hotels, or a full day itinerary!",
        },
    ]);
    const [loading, setLoading] = useState(false);

    // Keep conversation history for multi-turn context (excluding system prompt)
    const historyRef = useRef<HistoryMsg[]>([]);

    const updateMsg = useCallback((id: string, patch: Partial<ChatMsg>) => {
        setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    }, []);

    // ── Intent processors ────────────────────────────────────────────────────────

    async function processIntent(
        assistantId: string,
        displayText: string,
        rawFull: string,
    ) {
        const { json } = stripDataJson(rawFull);
        if (!json) {
            updateMsg(assistantId, { isStreaming: false });
            return;
        }

        const result = parseAIResult(json);
        if (!result) {
            updateMsg(assistantId, { isStreaming: false });
            return;
        }

        let richContent: RichContent | undefined;

        try {
            switch (result.intent) {
                case 'check_weather': {
                    const city = result.city ?? 'Unknown';
                    const weather = await fetchWeather(city);
                    richContent = { type: 'weather', weather };
                    break;
                }

                case 'recommend_places': {
                    const city = result.city ?? '';
                    const raw: ChatPlace[] = (result.places ?? []).map((p) => ({
                        ...p,
                        type: (p.type as ChatPlace['type']) || 'destination',
                    }));
                    const enriched = city ? await enrichPlaces(raw, city) : raw;
                    richContent = { type: 'places', places: enriched };
                    break;
                }

                case 'travel_plan': {
                    const city = result.city ?? '';
                    const raw: ChatPlace[] = (result.places ?? []).map((p) => ({
                        ...p,
                        type: (p.type as ChatPlace['type']) || 'destination',
                    }));
                    const enriched = city ? await enrichPlaces(raw, city) : raw;
                    const plan = await generateTravelPlan(
                        city,
                        enriched,
                        result.start_time ?? '09:00',
                        result.hotel_name,
                    );
                    richContent = { type: 'travel_plan', plan };
                    break;
                }

                case 'search_hotels': {
                    const city = result.city ?? '';
                    const hotels = await searchHotels(city);
                    richContent = { type: 'hotels', places: hotels };
                    break;
                }

                default:
                    break;
            }
        } catch {
            // Silent fail
        }

        updateMsg(assistantId, {
            text: result.intro || displayText,
            isStreaming: false,
            richContent,
        });
    }

    // ── Load Chat History ────────────────────────────────────────────────────────

    useEffect(() => {
        if (!isAuthenticated || !tripId) {
            setMsgs([
                {
                    id: uid(),
                    role: 'assistant',
                    text: "Hey! 👋 I'm TinTin, your Pavey travel companion. Ask me anything — places to visit, weather, hotels, or a full day itinerary!",
                },
            ]);
            historyRef.current = [];
            return;
        }

        setLoading(true);
        apiGetChatHistory(tripId)
            .then(async (res) => {
                const historyItems = res.history || [];
                if (historyItems.length === 0) {
                    setMsgs([
                        {
                            id: uid(),
                            role: 'assistant',
                            text: "Hey! 👋 I'm TinTin, your Pavey travel companion. Ask me anything — places to visit, weather, hotels, or a full day itinerary!",
                        },
                    ]);
                    historyRef.current = [];
                    return;
                }

                // Map to historyRef format
                const mappedHistory: HistoryMsg[] = historyItems.map((m: any) => ({
                    role: m.from === 'me' ? 'user' : 'assistant',
                    content: m.text,
                }));
                historyRef.current = mappedHistory;

                // Map to ChatMsg state for display
                const mappedMsgs: ChatMsg[] = historyItems.map((m: any) => {
                    const isMe = m.from === 'me';
                    let displayText = m.text;
                    if (!isMe) {
                        const { display, json } = stripDataJson(m.text);
                        displayText = display;
                        if (json) {
                            const parsed = parseAIResult(json);
                            if (parsed) {
                                displayText = parsed.intro || display;
                            }
                        }
                    }
                    return {
                        id: uid(),
                        role: isMe ? 'user' : 'assistant',
                        text: displayText,
                    };
                });

                setMsgs(mappedMsgs);

                // Populate widget content for the last assistant message
                const lastAssistantIdx = historyItems.map((m: any) => m.from).lastIndexOf('buddy');
                if (lastAssistantIdx !== -1) {
                    const rawContent = historyItems[lastAssistantIdx].text;
                    const { display } = stripDataJson(rawContent);
                    const lastMsgId = mappedMsgs[lastAssistantIdx].id;
                    await processIntent(lastMsgId, display, rawContent);
                }
            })
            .catch((err) => {
                console.error("Failed to load chat history:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [tripId, isAuthenticated]);

    // ── Send ─────────────────────────────────────────────────────────────────────

    const send = useCallback(
        async (userText: string) => {
            if (!userText.trim() || loading) return;

            // 1. Append user bubble
            const userMsg: ChatMsg = { id: uid(), role: 'user', text: userText };
            setMsgs((prev) => [...prev, userMsg]);

            // 2. Placeholder assistant bubble
            const assistantId = uid();
            const assistantMsg: ChatMsg = {
                id: assistantId,
                role: 'assistant',
                text: '',
                isStreaming: true,
            };
            setMsgs((prev) => [...prev, assistantMsg]);
            setLoading(true);

            try {
                const history: HistoryMsg[] = historyRef.current;
                let displayAccumulated = '';
                let fullRaw = '';

                fullRaw = await sendMessage(
                    history,
                    userText,
                    (chunk) => {
                        displayAccumulated += chunk;
                        updateMsg(assistantId, { text: displayAccumulated });
                    },
                    tripId,
                    itineraryContext,
                );

                if (!displayAccumulated) {
                    const { display } = stripDataJson(fullRaw);
                    displayAccumulated = display;
                    updateMsg(assistantId, { text: displayAccumulated });
                }

                historyRef.current = [
                    ...history,
                    { role: 'user', content: userText },
                    { role: 'assistant', content: fullRaw },
                ].slice(-20);

                await processIntent(assistantId, displayAccumulated, fullRaw);
            } catch (err) {
                updateMsg(assistantId, {
                    text: "Sorry, I couldn't reach my brain right now. Please try again! 🙏",
                    isStreaming: false,
                });
            } finally {
                setLoading(false);
            }
        },
        [loading, updateMsg],
    );

    return { msgs, loading, send };
}
