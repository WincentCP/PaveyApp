/**
 * AI Service — Open Source LLM providers
 * Priority: Groq → OpenRouter → Ollama (local)
 */
import type { ChatMessage } from '../types'



/**
 * CRITICAL RULES IN SYSTEM PROMPT:
 * - Never output DATA_JSON or any other tag format
 * - For structured intents: output ONLY the ```json block, nothing else
 * - intro field handles all human-readable text
 * - No prose before or after the json block
 */
export const SYSTEM_PROMPT = `You are Pavey, a smart and friendly AI travel assistant.
You help users plan trips, recommend places, check weather, and find hotels.
Always respond in the same language the user uses — Indonesian or English.

## CRITICAL OUTPUT RULES

For place recommendations, travel plans, weather, and hotel search, you MUST output ONLY a single \`\`\`json code block — NO text before it, NO text after it, NO explanation outside it. The "intro" field inside the JSON is where you put your human-readable response.

FORBIDDEN: Do NOT use <DATA_JSON>, (DATA_JSON>, XML tags, or any other format. ONLY \`\`\`json blocks.
FORBIDDEN: Do NOT write prose paragraphs then append a JSON block at the end.
CORRECT: Output ONLY the \`\`\`json block for any travel-related request.

## JSON FORMATS

Place recommendations:
\`\`\`json
{
    "intent": "recommend_places",
    "city": "city name",
    "intro": "Warm 1-2 sentence response in the user's language — this is what the user sees",
    "places": [
        {
            "name": "Place Name",
            "type": "destination",
            "category": "museum",
            "description": "1-2 sentence description",
            "address": "Full address if known",
            "rating": 4.5
        }
    ]
}
\`\`\`

Travel plan (1 day itinerary):
\`\`\`json
{
    "intent": "travel_plan",
    "city": "city name",
    "start_time": "09:00",
    "hotel_name": "Hotel name if user mentioned one, otherwise null",
    "intro": "Warm 1-2 sentence response in the user's language",
    "places": [
        {
            "name": "Place Name",
            "type": "destination",
            "category": "museum",
            "description": "Brief activity description",
            "address": "Address if known",
            "rating": 4.2
        }
    ]
}
\`\`\`

Weather check:
\`\`\`json
{
    "intent": "check_weather",
    "city": "city name",
    "intro": "Brief sentence in user's language confirming you're checking weather"
}
\`\`\`

Hotel search:
\`\`\`json
{
    "intent": "search_hotels",
    "city": "city name",
    "intro": "Brief sentence in user's language confirming you're searching hotels"
}
\`\`\`

## PLAIN TEXT (for everything else)
For greetings, general questions, and non-travel chat, respond normally in plain text. No JSON needed.

## NEVER
- Never output coordinates — the system geocodes everything
- Never use DATA_JSON, XML, or any format other than \`\`\`json
- Never write a long description THEN add a JSON block at the end`

export interface AIResult {
    displayText: string
    jsonBlock: any | null
}

export async function sendMessage(
    history: ChatMessage[],
    userMessage: string,
    onStream?: (chunk: string) => void,
    tripId?: string,
    context?: string
): Promise<AIResult> {
    try {
        const { apiChat } = await import('../../lib/api');
        const res = await apiChat(userMessage, tripId, context);
        return parseResponse(res.reply);
    } catch (err) {
        console.error('[AI] Error calling backend:', err);
        return {
            displayText: 'Sorry, there was a connection issue. Please check your connection or try again.',
            jsonBlock: null,
        };
    }
}

/**
 * parseResponse — clean separation of display text vs structured data.
 * Handles both well-formed ```json blocks AND the legacy DATA_JSON leak
 * so even if the model misbehaves, the user never sees raw JSON.
 */
export function parseResponse(raw: string): AIResult {
    // Strip any legacy DATA_JSON format the model might output (belt+suspenders)
    const cleaned = raw
    .replace(/\(?DATA_JSON>[\s\S]*?\)?/g, '')
    .replace(/<DATA_JSON>[\s\S]*?<\/DATA_JSON>/g, '')
    .trim()

    // 1. Try to extract ```json block
    let jsonMatch = cleaned.match(/```json\s*([\s\S]*?)```/)
    
    // 2. If no ```json block, try to extract any generic ``` block
    if (!jsonMatch) {
        jsonMatch = cleaned.match(/```\s*([\s\S]*?)```/)
    }

    let jsonStr: string | null = null
    if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
    } else {
        // 3. Fallback: check if there is a curly brace block anywhere
        const firstBrace = cleaned.indexOf('{')
        const lastBrace = cleaned.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = cleaned.slice(firstBrace, lastBrace + 1).trim()
        }
    }

    if (!jsonStr) {
        return { displayText: cleaned, jsonBlock: null }
    }

    let jsonBlock: any = null
    try {
        jsonBlock = JSON.parse(jsonStr)
    } catch (e) {
        // Malformed JSON — strip it and show whatever text remains
        const textOnly = cleaned.replace(/```(json)?[\s\S]*?```/g, '').trim()
        return { displayText: textOnly || 'Got it! Working on that now.', jsonBlock: null }
    }

    // Display text = intro from JSON — NEVER the raw block
    const displayText = (jsonBlock?.intro as string | undefined)?.trim() || defaultIntro(jsonBlock?.intent)
    return { displayText, jsonBlock }
}

function defaultIntro(intent?: string): string {
    switch (intent) {
        case 'recommend_places': return "Here are some great spots I found for you!"
        case 'travel_plan': return "Here's your travel plan!"
        case 'check_weather': return "Checking the weather for you…"
        case 'search_hotels': return "Searching for hotels…"
        default: return "Here you go!"
    }
}
