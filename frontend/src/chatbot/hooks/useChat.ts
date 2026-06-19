/**
 * useChat.ts — Chat state + intent orchestrator
 *
 * Flows:
 *   "Places Near Me"     → detect GPS/IP location → fetch weather → recommend places
 *   "Plan My Day"        → ask city in chat → fetch weather → build itinerary
 *   "Check Weather"      → city from message → fetchWeather (no login needed)
 *   "Find Hotels"        → city from message → searchHotels
 *   "Plan Around Hotel"  → ask hotel name + city in chat → hotel-anchor plan
 *   "Edit My Plan"       → ask edit instruction → regenerate
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { sendMessage, stripDataJson, parseAIResult, type HistoryMsg } from '../ai';
import { fetchWeather, fetchWeatherByCoords } from '../services/weather';
import { enrichPlaces } from '../services/geocoding';
import { searchHotels } from '../services/hotels';
import { generateTravelPlan } from '../services/planner';
import { detectUserLocation } from '../services/location';
import type { ChatMsg, RichContent, ChatPlace, PendingFlow, TravelPlan } from '../types';

function uid() {
    return Math.random().toString(36).slice(2, 9);
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChat(tripId?: string) {
    const [msgs, setMsgs] = useState<ChatMsg[]>([
        {
            id: uid(),
                                                role: 'assistant',
                                                text: "Hey! 👋 I'm TinTin, your Pavey travel companion. Ask me anything — places to visit, weather, hotels, or a full day itinerary!",
        },
    ]);
    const [loading, setLoading] = useState(false);

    // Multi-turn flow state: what we're waiting for from the user
    const pendingFlowRef = useRef<PendingFlow>(null);

    // Last generated plan (for edit flow)
    const lastPlanRef = useRef<TravelPlan | null>(null);

    // Last active/detected city to preserve context across messages for guest sessions
    const lastCityRef = useRef<string>('');

    const historyRef = useRef<HistoryMsg[]>([]);

    const pushHistory = (role: 'user' | 'assistant', content: string) => {
        historyRef.current = [
            ...historyRef.current,
            { role, content },
        ].slice(-20);
    };

    // ── Helpers ──────────────────────────────────────────────────────────────────

    const appendMsg = useCallback((msg: ChatMsg) => {
        setMsgs((prev) => [...prev, msg]);
    }, []);

    const updateMsg = useCallback((id: string, patch: Partial<ChatMsg>) => {
        setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    }, []);

    const addAssistant = useCallback((text: string, richContent?: RichContent): string => {
        const id = uid();
        setMsgs((prev) => [...prev, { id, role: 'assistant', text, richContent }]);
        return id;
    }, []);

    // ── Call LLM via backend ─────────────────────────────────────────────────────

    async function callLLM(
        userText: string,
        context?: string,
    ): Promise<{ display: string; raw: string }> {
        const assistantId = uid();
        appendMsg({ id: assistantId, role: 'assistant', text: '', isStreaming: true });

        let display = '';
        const raw = await sendMessage(
            historyRef.current,
            userText,
            (chunk) => {
                display += chunk;
                updateMsg(assistantId, { text: display });
            },
            tripId,
            context,
        );

        if (!display) {
            const { display: d } = stripDataJson(raw);
            display = d;
            updateMsg(assistantId, { text: display });
        }

        updateMsg(assistantId, { isStreaming: false });

        pushHistory('user', userText);
        pushHistory('assistant', raw);

        return { display, raw };
    }

    // ── Intent processor ─────────────────────────────────────────────────────────

    async function processIntent(msgId: string, display: string, raw: string) {
        const { json } = stripDataJson(raw);
        if (!json) {
            updateMsg(msgId, { isStreaming: false });
            return;
        }

        const result = parseAIResult(json);
        if (!result) {
            updateMsg(msgId, { isStreaming: false });
            return;
        }

        if (result.city) {
            lastCityRef.current = result.city;
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
                    const raw2: ChatPlace[] = (result.places ?? []).map((p) => ({
                        ...p,
                        type: (p.type as ChatPlace['type']) || 'destination',
                    }));
                    const enriched = city ? await enrichPlaces(raw2, city) : raw2;
                    richContent = { type: 'places', places: enriched };
                    break;
                }

                case 'travel_plan': {
                    const city = result.city ?? '';
                    const raw2: ChatPlace[] = (result.places ?? []).map((p) => ({
                        ...p,
                        type: (p.type as ChatPlace['type']) || 'destination',
                    }));
                    const enriched = city ? await enrichPlaces(raw2, city) : raw2;
                    const plan = await generateTravelPlan(city, enriched, result.start_time ?? '09:00', result.hotel_name);
                    lastPlanRef.current = plan;
                    richContent = { type: 'travel_plan', plan };
                    break;
                }

                case 'search_hotels': {
                    const city = result.city ?? '';
                    const hotels = await searchHotels(city);
                    const enriched = city ? await enrichPlaces(hotels, city) : hotels;
                    richContent = { type: 'hotels', places: enriched };
                    break;
                }

                default:
                    break;
            }
        } catch { /* silent */ }

        updateMsg(msgId, {
            text: result.intro || display,
            isStreaming: false,
            richContent,
        });
    }

    // ── Flow: Places Near Me ─────────────────────────────────────────────────────

    async function flowPlacesNearMe() {
        setLoading(true);
        const detectingId = addAssistant('📍 Detecting your location...');

        try {
            const loc = await detectUserLocation();

            if (!loc) {
                updateMsg(detectingId, {
                    text: "I couldn't detect your location 📍 Which city are you currently in?",
                });
                pendingFlowRef.current = { type: 'awaiting_city_for_places' };
                setLoading(false);
                return;
            }

            updateMsg(detectingId, { text: `Got it! You're in ${loc.city}. Let me check what's nearby...` });
            lastCityRef.current = loc.city;

            // Fetch weather
            const weather = await fetchWeatherByCoords(loc.lat, loc.lon, loc.city);
            const weatherHint = weather.isRainy
            ? 'It is currently raining. Prioritize indoor places like museums, cafes, and malls.'
            : weather.isExtreme
            ? 'Weather is extreme (very hot or strong wind). Recommend indoor or shaded spots.'
            : 'Weather is clear and pleasant. Recommend a mix of outdoor and indoor places.';

            // Ask LLM for recommendations with weather context
            const userText = `Recommend tourist attractions and interesting places near ${loc.city}. ${weatherHint} Give 5 real, specific places.`;

            appendMsg({ id: uid(), role: 'user', text: `Show me places near me in ${loc.city}` });

            const assistantId = uid();
            appendMsg({ id: assistantId, role: 'assistant', text: '', isStreaming: true });

            let display = '';
            const raw = await sendMessage(
                historyRef.current,
                userText,
                (chunk) => {
                    display += chunk;
                    updateMsg(assistantId, { text: display });
                },
                tripId,
                `User location: ${loc.city} (${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}). ${weatherHint}`,
            );

            if (!display) {
                const { display: d } = stripDataJson(raw);
                display = d;
            }

            pushHistory('user', userText);
            pushHistory('assistant', raw);

            // Parse result
            const { json } = stripDataJson(raw);
            const result = json ? parseAIResult(json) : null;

            let richContent: RichContent | undefined = { type: 'weather', weather };

            if (result?.intent === 'recommend_places' && result.places?.length) {
                const raw2: ChatPlace[] = result.places.map((p) => ({
                    ...p,
                    type: (p.type as ChatPlace['type']) || 'destination',
                }));
                const enriched = await enrichPlaces(raw2, loc.city);
                richContent = { type: 'places', places: enriched };
            }

            updateMsg(assistantId, {
                text: result?.intro || display,
                isStreaming: false,
                richContent,
                // Attach weather as a secondary widget via extra field
            });

            // Also show weather card separately
            setMsgs((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantId);
                if (idx < 0) return prev;
                const weatherMsg: ChatMsg = {
                    id: uid(),
                    role: 'assistant',
                    text: `Current weather in ${weather.city}:`,
                    richContent: { type: 'weather', weather },
                };
                const next = [...prev];
                next.splice(idx, 0, weatherMsg);
                return next;
            });
        } catch (err) {
            addAssistant("Sorry, something went wrong while detecting your location. Please tell me your city!");
        } finally {
            setLoading(false);
        }
    }

    // ── Flow: Plan My Day ────────────────────────────────────────────────────────

    async function flowPlanMyDay() {
        pendingFlowRef.current = { type: 'awaiting_city_for_plan' };
        addAssistant("Sure! Which city are you planning to explore? 🗺️");
    }

    // ── Flow: Plan Around Hotel ──────────────────────────────────────────────────

    async function flowPlanAroundHotel() {
        pendingFlowRef.current = { type: 'awaiting_hotel_and_city' };
        addAssistant(
            "I'll build a route around your hotel! Which hotel are you staying at, and in which city? (e.g. \"The Mulia, Bali\")",
        );
    }

    // ── Flow: Edit My Plan ───────────────────────────────────────────────────────

    async function flowEditPlan() {
        if (!lastPlanRef.current) {
            addAssistant(
                "I don't have a saved travel plan to edit yet. Try asking me to \"Plan My Day\" first!",
            );
            return;
        }
        pendingFlowRef.current = { type: 'awaiting_edit_instruction', plan: lastPlanRef.current };
        addAssistant(
            `Here's your current plan for ${lastPlanRef.current.city} with ${lastPlanRef.current.stops.length} stops. What would you like to change? (e.g. "Remove the restaurant", "Add a museum", "Start at 10am instead")`,
        );
    }

    // ── Handle pending flow replies ───────────────────────────────────────────────

    async function handlePendingFlow(userText: string): Promise<boolean> {
        const flow = pendingFlowRef.current;
        if (!flow) return false;

        setLoading(true);

    // awaiting_city_for_places — GPS failed/IP used, user typed their city or confirmed IP city
        if (flow.type === 'awaiting_city_for_places') {
            pendingFlowRef.current = null;
            appendMsg({ id: uid(), role: 'user', text: userText });

            // Detect confirmation words (user confirming the IP-detected city)
            const confirmWords = /^(yes|ya|iya|ok|okay|yep|yup|correct|betul|benar|oke|bener)[\.!]?$/i;
            const city = confirmWords.test(userText.trim())
                ? lastCityRef.current || userText.trim()
                : userText.trim();

            lastCityRef.current = city;
            const assistantId = uid();
            appendMsg({ id: assistantId, role: 'assistant', text: `📍 Looking for places in ${city}...`, isStreaming: true });

            try {
                const weather = await fetchWeather(city);
                const weatherHint = weather.isRainy
                ? 'It is currently raining. Prioritize indoor places like museums, cafes, and malls.'
                : weather.isExtreme
                ? 'Weather is extreme. Recommend indoor or shaded spots.'
                : 'Weather is clear. Recommend a mix of outdoor and indoor places.';

                const userText2 = `Recommend tourist attractions and interesting places in ${city}. ${weatherHint} Give 5 real, specific places.`;

                let display = '';
                const raw = await sendMessage(
                    historyRef.current,
                    userText2,
                    (chunk) => { display += chunk; updateMsg(assistantId, { text: display }); },
                    tripId,
                    `City: ${city}. ${weatherHint}`,
                );

                if (!display) {
                    const { display: d } = stripDataJson(raw);
                    display = d;
                }

                pushHistory('user', userText2);
                pushHistory('assistant', raw);

                const { json } = stripDataJson(raw);
                const result = json ? parseAIResult(json) : null;
                let richContent: RichContent | undefined;

                if (result?.intent === 'recommend_places' && result.places?.length) {
                    const raw2: ChatPlace[] = result.places.map((p) => ({
                        ...p,
                        type: (p.type as ChatPlace['type']) || 'destination',
                    }));
                    const enriched = await enrichPlaces(raw2, city);
                    richContent = { type: 'places', places: enriched };
                }

                // Also show weather card
                setMsgs((prev) => {
                    const weatherMsg: ChatMsg = {
                        id: uid(),
                        role: 'assistant',
                        text: `Current weather in ${weather.city}:`,
                        richContent: { type: 'weather', weather },
                    };
                    const idx = prev.findIndex((m) => m.id === assistantId);
                    const next = [...prev];
                    next.splice(idx, 0, weatherMsg);
                    return next;
                });

                updateMsg(assistantId, {
                    text: result?.intro || display,
                    isStreaming: false,
                    richContent,
                });
            } catch {
                updateMsg(assistantId, { text: "Sorry, something went wrong. Please try again!", isStreaming: false });
            }

            setLoading(false);
            return true;
        }

        // awaiting_city_for_plan
        if (flow.type === 'awaiting_city_for_plan') {
            pendingFlowRef.current = null;
            appendMsg({ id: uid(), role: 'user', text: userText });

            const city = userText.trim();
            lastCityRef.current = city;
            const assistantId = uid();
            appendMsg({ id: assistantId, role: 'assistant', text: '⏳ Checking weather and planning your day...', isStreaming: true });

            try {
                const weather = await fetchWeather(city);
                const weatherHint = weather.isRainy
                ? 'It is currently raining. Include indoor places (museums, cafes, malls). Avoid outdoor-only stops.'
                : weather.isExtreme
                ? 'Weather is extreme. Recommend mostly indoor or shaded locations.'
                : 'Weather is great. Mix of outdoor landmarks and indoor places is ideal.';

                const prompt = `Build a full 1-day travel itinerary in ${city}. ${weatherHint} Include breakfast, lunch, dinner spots, and 3-4 attractions. Give real place names.`;

                let display = '';
                const raw = await sendMessage(
                    historyRef.current,
                    prompt,
                    (chunk) => { display += chunk; updateMsg(assistantId, { text: display }); },
                                              tripId,
                                              `Weather in ${city}: ${weather.temp}°C, ${weather.description}. ${weatherHint}`,
                );

                if (!display) {
                    const { display: d } = stripDataJson(raw);
                    display = d;
                }

                pushHistory('user', prompt);
                pushHistory('assistant', raw);

                const { json } = stripDataJson(raw);
                const result = json ? parseAIResult(json) : null;
                let richContent: RichContent | undefined;

                if (result?.intent === 'travel_plan' && result.places?.length) {
                    const raw2: ChatPlace[] = result.places.map((p) => ({
                        ...p,
                        type: (p.type as ChatPlace['type']) || 'destination',
                    }));
                    const enriched = await enrichPlaces(raw2, city);
                    const plan = await generateTravelPlan(city, enriched, result.start_time ?? '09:00', result.hotel_name);
                    lastPlanRef.current = plan;
                    richContent = { type: 'travel_plan', plan };
                }

                // Show weather first
                setMsgs((prev) => {
                    const weatherMsg: ChatMsg = {
                        id: uid(),
                        role: 'assistant',
                        text: `Current weather in ${weather.city}:`,
                        richContent: { type: 'weather', weather },
                    };
                    const idx = prev.findIndex((m) => m.id === assistantId);
                    const next = [...prev];
                    next.splice(idx, 0, weatherMsg);
                    return next;
                });

                updateMsg(assistantId, {
                    text: result?.intro || display,
                    isStreaming: false,
                    richContent,
                });
            } catch {
                updateMsg(assistantId, { text: "Sorry, something went wrong. Please try again!", isStreaming: false });
            }

            setLoading(false);
            return true;
        }

        // awaiting_city_for_weather
        if (flow.type === 'awaiting_city_for_weather') {
            pendingFlowRef.current = null;
            appendMsg({ id: uid(), role: 'user', text: userText });

            const city = userText.trim();
            lastCityRef.current = city;
            const assistantId = uid();
            appendMsg({ id: assistantId, role: 'assistant', text: '⏳ Checking weather...', isStreaming: true });

            try {
                const weather = await fetchWeather(city);
                const prompt = `User wants weather details for ${city}. Present the weather info friendly. You MUST respond with check_weather intent in the JSON schema.`;
                let display = '';
                const raw = await sendMessage(
                    historyRef.current,
                    prompt,
                    (chunk) => { display += chunk; updateMsg(assistantId, { text: display }); },
                    tripId,
                    `Weather: ${weather.temp}°C, ${weather.description}`
                );

                if (!display) {
                    const { display: d } = stripDataJson(raw);
                    display = d;
                }

                pushHistory('user', prompt);
                pushHistory('assistant', raw);

                const { json } = stripDataJson(raw);
                const result = json ? parseAIResult(json) : null;

                updateMsg(assistantId, {
                    text: result?.intro || display || `Here's the weather in ${weather.city}.`,
                    isStreaming: false,
                    richContent: { type: 'weather', weather }
                });
            } catch {
                updateMsg(assistantId, { text: "Sorry, I couldn't fetch the weather right now.", isStreaming: false });
            }

            setLoading(false);
            return true;
        }

        // awaiting_hotel_and_city
        if (flow.type === 'awaiting_hotel_and_city') {
            pendingFlowRef.current = null;
            appendMsg({ id: uid(), role: 'user', text: userText });

            const assistantId = uid();
            appendMsg({ id: assistantId, role: 'assistant', text: '⏳ Checking weather and planning your hotel route...', isStreaming: true });

            try {
                // Best-effort city extraction: last comma-separated part (e.g. "The Mulia, Bali" → "Bali")
                const weatherCity = userText.includes(',')
                    ? userText.split(',').slice(-1)[0].trim()
                    : userText.trim();
                lastCityRef.current = weatherCity;

                const weather = await fetchWeather(weatherCity);
                const weatherHint = weather.isRainy
                ? 'It is currently raining. Include mostly indoor venues — cafes, museums, malls.'
                : weather.isExtreme
                ? 'Weather is extreme. Recommend indoor or shaded spots.'
                : 'Weather is great. Mix of outdoor and indoor places ideal.';

                const prompt = `The user is staying at: "${userText}". Build a full 1-day hotel-anchored travel itinerary. Extract the hotel name and city from the user message. ${weatherHint} Include breakfast, lunch, and dinner spots plus 3–4 nearby attractions. First and last stop should be nearest to the hotel. Give real place names. You MUST use the "travel_plan" intent in the JSON schema.`;

                let display = '';
                const raw = await sendMessage(
                    historyRef.current,
                    prompt,
                    (chunk) => { display += chunk; updateMsg(assistantId, { text: display }); },
                    tripId,
                    `Weather in ${weatherCity}: ${weather.temp}°C, ${weather.description}. ${weatherHint}`,
                );

                if (!display) {
                    const { display: d } = stripDataJson(raw);
                    display = d;
                }

                pushHistory('user', prompt);
                pushHistory('assistant', raw);

                const { json } = stripDataJson(raw);
                const result = json ? parseAIResult(json) : null;
                let richContent: RichContent | undefined;

                if (result?.intent === 'travel_plan' && result.places?.length) {
                    const raw2: ChatPlace[] = result.places.map((p) => ({
                        ...p,
                        type: (p.type as ChatPlace['type']) || 'destination',
                    }));
                    // Prefer LLM-extracted city, fallback to user-extracted city
                    const planCity = result.city ?? weatherCity;
                    const hotelNameFromText = userText.split(',')[0]?.trim();
                    const enriched = await enrichPlaces(raw2, planCity);
                    const plan = await generateTravelPlan(planCity, enriched, result.start_time ?? '09:00', result.hotel_name ?? hotelNameFromText);
                    lastPlanRef.current = plan;
                    richContent = { type: 'travel_plan', plan };
                }

                // Show weather card first (same as Plan My Day)
                setMsgs((prev) => {
                    const weatherMsg: ChatMsg = {
                        id: uid(),
                        role: 'assistant',
                        text: `Current weather in ${weather.city}:`,
                        richContent: { type: 'weather', weather },
                    };
                    const idx = prev.findIndex((m) => m.id === assistantId);
                    const next = [...prev];
                    next.splice(idx, 0, weatherMsg);
                    return next;
                });

                updateMsg(assistantId, {
                    text: result?.intro || display,
                    isStreaming: false,
                    richContent,
                });
            } catch {
                updateMsg(assistantId, { text: 'Sorry, something went wrong. Please try again!', isStreaming: false });
            }

            setLoading(false);
            return true;
        }

        // awaiting_edit_instruction
        if (flow.type === 'awaiting_edit_instruction') {
            const oldPlan = flow.plan;
            pendingFlowRef.current = null;
            appendMsg({ id: uid(), role: 'user', text: userText });

            const assistantId = uid();
            appendMsg({ id: assistantId, role: 'assistant', text: '⏳ Updating your travel plan...', isStreaming: true });

            try {
                const stopNames = oldPlan.stops.map((s) => s.name).join(', ');
                const prompt = `Current travel plan for ${oldPlan.city}: ${stopNames}. User wants to edit: "${userText}". Generate an updated 1-day itinerary for ${oldPlan.city} applying the requested changes. Give real place names.`;

                const weather = await fetchWeather(oldPlan.city);
                const weatherHint = weather.isRainy
                ? 'It is raining. Prefer indoor spots.'
                : 'Weather is fine. Mix of indoor and outdoor is good.';

                let display = '';
                const raw = await sendMessage(
                    historyRef.current,
                    prompt,
                    (chunk) => { display += chunk; updateMsg(assistantId, { text: display }); },
                                              tripId,
                                              `Weather: ${weather.temp}°C, ${weather.description}. ${weatherHint}`,
                );

                if (!display) {
                    const { display: d } = stripDataJson(raw);
                    display = d;
                }

                pushHistory('user', prompt);
                pushHistory('assistant', raw);

                const { json } = stripDataJson(raw);
                const result = json ? parseAIResult(json) : null;
                let richContent: RichContent | undefined;

                if (result?.intent === 'travel_plan' && result.places?.length) {
                    const raw2: ChatPlace[] = result.places.map((p) => ({
                        ...p,
                        type: (p.type as ChatPlace['type']) || 'destination',
                    }));
                    const enriched = await enrichPlaces(raw2, oldPlan.city);
                    const plan = await generateTravelPlan(oldPlan.city, enriched, result.start_time ?? '09:00', result.hotel_name ?? oldPlan.hotel?.name);
                    lastPlanRef.current = plan;
                    richContent = { type: 'travel_plan', plan };
                }

                updateMsg(assistantId, {
                    text: result?.intro || display,
                    isStreaming: false,
                    richContent,
                });
            } catch {
                updateMsg(assistantId, { text: "Sorry, couldn't update the plan. Please try again!", isStreaming: false });
            }

            setLoading(false);
            return true;
        }

        return false;
    }

    // ── Main send ────────────────────────────────────────────────────────────────

    const send = useCallback(
        async (userText: string) => {
            if (!userText.trim() || loading) return;

            // Check if we're in a pending flow first
            const handled = await handlePendingFlow(userText);
            if (handled) return;

            // Normal message: show user bubble then call LLM
            appendMsg({ id: uid(), role: 'user', text: userText });
            setLoading(true);

            const assistantId = uid();
            appendMsg({ id: assistantId, role: 'assistant', text: '', isStreaming: true });

            try {
                let display = '';
    const raw = await sendMessage(
        historyRef.current,
        userText,
        (chunk) => {
            display += chunk;
            updateMsg(assistantId, { text: display });
        },
        tripId,
        lastCityRef.current ? `User is currently interested in or located in: ${lastCityRef.current}` : undefined,
    );

    if (!display) {
        const { display: d } = stripDataJson(raw);
        display = d;
        updateMsg(assistantId, { text: display });
    }

    pushHistory('user', userText);
    pushHistory('assistant', raw);

    await processIntent(assistantId, display, raw);
            } catch {
                updateMsg(assistantId, {
                    text: "Sorry, I couldn't reach my brain right now. Please try again! 🙏",
                    isStreaming: false,
                });
            } finally {
                setLoading(false);
            }
        },
        [loading, appendMsg, updateMsg, tripId],
    );

    // ── Quick prompt triggers (called from Buddy.tsx) ─────────────────────────

    const triggerPlacesNearMe = useCallback(() => {
        if (loading) return;
        flowPlacesNearMe();
    }, [loading]);

    const triggerPlanMyDay = useCallback(() => {
        if (loading) return;
        flowPlanMyDay();
    }, [loading]);

    const triggerPlanAroundHotel = useCallback(() => {
        if (loading) return;
        flowPlanAroundHotel();
    }, [loading]);

    const triggerEditPlan = useCallback(() => {
        if (loading) return;
        flowEditPlan();
    }, [loading]);

    const triggerCheckWeather = useCallback(() => {
        if (loading) return;
        pendingFlowRef.current = { type: 'awaiting_city_for_weather' };
        addAssistant("Sure! Which city would you like the weather for? 🌤️");
    }, [loading]);

    return {
        msgs,
        loading,
        send,
        triggerPlacesNearMe,
        triggerPlanMyDay,
        triggerPlanAroundHotel,
        triggerEditPlan,
        triggerCheckWeather,
    };
}
