/**
 * AI Service — Open Source LLM providers
 * Priority: Groq → OpenRouter → Ollama (local)
 */
import type { ChatMessage } from '../types'

const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export type AIProvider = 'ollama' | 'groq' | 'openrouter'

function detectProvider(): AIProvider {
    if (import.meta.env.VITE_GROQ_KEY) return 'groq'
        if (import.meta.env.VITE_OPENROUTER_KEY) return 'openrouter'
            return 'ollama'
}

function getModel(provider: AIProvider): string {
    switch (provider) {
        case 'groq': return import.meta.env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant'
        case 'openrouter': return import.meta.env.VITE_OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free'
        case 'ollama': return import.meta.env.VITE_OLLAMA_MODEL || 'llama3.2'
    }
}

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
    onStream?: (chunk: string) => void
): Promise<AIResult> {
    const provider = detectProvider()
    const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
                                    { role: 'user', content: userMessage },
    ]

    let rawText = ''
try {
    if (provider === 'ollama') {
        rawText = await callOllama(apiMessages, onStream)
    } else if (provider === 'groq') {
        rawText = await callOpenAICompat(GROQ_URL, import.meta.env.VITE_GROQ_KEY!, getModel('groq'), apiMessages, onStream)
    } else {
        rawText = await callOpenAICompat(OPENROUTER_URL, import.meta.env.VITE_OPENROUTER_KEY!, getModel('openrouter'), apiMessages, onStream)
    }
} catch (err) {
    console.error('[AI] Error:', err)
    return {
        displayText: 'Sorry, there was a connection issue. Please check your API key or try again.',
        jsonBlock: null,
    }
}

return parseResponse(rawText)
}

/**
 * parseResponse — clean separation of display text vs structured data.
 * Handles both well-formed ```json blocks AND the legacy DATA_JSON leak
 * so even if the model misbehaves, the user never sees raw JSON.
 */
function parseResponse(raw: string): AIResult {
    // Strip any legacy DATA_JSON format the model might output (belt+suspenders)
    const cleaned = raw
    .replace(/\(?DATA_JSON>[\s\S]*?\)?/g, '')
    .replace(/<DATA_JSON>[\s\S]*?<\/DATA_JSON>/g, '')
    .trim()

    // Extract ```json block
    const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)```/)
    if (!jsonMatch) {
        // Pure conversational response
        return { displayText: cleaned, jsonBlock: null }
    }

    let jsonBlock: any = null
    try {
        jsonBlock = JSON.parse(jsonMatch[1].trim())
    } catch (e) {
        // Malformed JSON — strip it and show whatever text remains
        const textOnly = cleaned.replace(/```json[\s\S]*?```/g, '').trim()
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

// ── Provider calls ──────────────────────────────────────────────────────────

async function callOllama(messages: any[], onStream?: (c: string) => void): Promise<string> {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: getModel('ollama'), messages, stream: !!onStream }),
    })
    if (!res.ok) throw new Error(`Ollama ${res.status}`)
        if (!onStream) {
            const data = await res.json()
            return data.message?.content || ''
        }
        return streamLines(res, (line) => {
            try { return JSON.parse(line).message?.content || '' } catch { return '' }
        }, onStream)
}

async function callOpenAICompat(
    url: string, key: string, model: string,
    messages: any[], onStream?: (c: string) => void
): Promise<string> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages, stream: !!onStream, temperature: 0.7 }),
    })
    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`${url} → ${res.status}: ${errText}`)
    }
    if (!onStream) {
        const data = await res.json()
        return data.choices?.[0]?.message?.content || ''
    }
    return streamLines(res, (line) => {
        if (line === '[DONE]') return null
            try { return JSON.parse(line).choices?.[0]?.delta?.content || '' } catch { return '' }
    }, onStream)
}

async function streamLines(
    res: Response,
    parser: (line: string) => string | null,
                           onChunk: (c: string) => void
): Promise<string> {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let full = ''
while (true) {
    const { done, value } = await reader.read()
    if (done) break
        for (const line of decoder.decode(value).split('\n')) {
            const data = line.startsWith('data: ') ? line.slice(6).trim() : line.trim()
            if (!data) continue
                const chunk = parser(data)
                if (chunk === null) continue
                    full += chunk
                    if (chunk) onChunk(chunk)
        }
}
return full
}
