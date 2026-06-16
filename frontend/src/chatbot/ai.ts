/**
 * ai.ts — LLM gateway for TinTin chatbot
 *
 * All calls go through the backend /chatbot/message which holds the Groq key.
 * The system prompt is injected server-side (chatbot.py). This file just:
 *   1. Calls apiChat
 *   2. Strips the DATA_JSON block safely
 *   3. Parses the structured result
 */

import type { AIResult } from './types';
import { apiChat } from '../lib/api';

export interface HistoryMsg {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// ─── Strip DATA_JSON from raw response ───────────────────────────────────────

export function stripDataJson(raw: string): { display: string; json: string | null } {
    const trimmed = raw.trim();

    // Format 1: DATA_JSON> {...} <DATA_JSON
    let m = trimmed.match(/DATA_JSON>\s*([\s\S]*?)\s*<DATA_JSON/);
    if (m) {
        const display = trimmed.replace(/DATA_JSON>[\s\S]*?<DATA_JSON/, '').trim();
        return { display: cleanDisplay(display), json: m[1].trim() };
    }

    // Format 2: <DATA_JSON>...</DATA_JSON>
    m = trimmed.match(/<DATA_JSON>\s*([\s\S]*?)\s*<\/DATA_JSON>/i);
    if (m) {
        const display = trimmed.replace(/<DATA_JSON>[\s\S]*?<\/DATA_JSON>/gi, '').trim();
        return { display: cleanDisplay(display), json: m[1].trim() };
    }

    // Format 3: ```json ... ```
    m = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    if (m) {
        const display = trimmed.replace(/```json[\s\S]*?```/gi, '').trim();
        return { display: cleanDisplay(display), json: m[1].trim() };
    }

    // Format 4: entire response is JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.intent) {
                return { display: cleanDisplay(parsed.intro || ''), json: trimmed };
            }
        } catch { /* not json */ }
    }

    return { display: cleanDisplay(trimmed), json: null };
}

/**
 * Clean display text:
 * - Remove any trailing open DATA_JSON tags
 * - Remove raw JSON blobs that leaked into text
 * - Clean markdown bold/italic artifacts if unmatched
 */
function cleanDisplay(text: string): string {
    return text
    // Remove any orphan DATA_JSON tags
    .replace(/DATA_JSON>[\s\S]*/gi, '')
    .replace(/<\/?DATA_JSON>/gi, '')
    // Remove raw JSON blobs { ... }
    .replace(/\{[\s\S]{0,2000}?\}/g, (match) => {
        try { const p = JSON.parse(match); if (p.intent) return ''; } catch { /* not json */ }
        return match;
    })
    // Clean unmatched markdown asterisks (bold **)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Clean unmatched single asterisk italic
    .replace(/\*([^*\n]+)\*/g, '$1')
    // Remove trailing open tags
    .replace(/<[a-zA-Z_]+>$/g, '')
    .trim();
}

// ─── Parse AIResult ───────────────────────────────────────────────────────────

export function parseAIResult(jsonStr: string): AIResult | null {
    try {
        const clean = jsonStr.replace(/^```(?:json)?|```$/gm, '').trim();
        const parsed = JSON.parse(clean) as AIResult;
        if (!parsed.intent || typeof parsed.intro !== 'string') return null;
        return parsed;
    } catch {
        return null;
    }
}

// ─── Send message ─────────────────────────────────────────────────────────────

export async function sendMessage(
    _history: HistoryMsg[],
    userMessage: string,
    onChunk?: (chunk: string) => void,
                                  tripId?: string,
                                  context?: string,
): Promise<string> {
    const res = await apiChat(userMessage, tripId, context);
    const reply: string = res.reply || '';

    if (onChunk && reply) {
        const { display } = stripDataJson(reply);
        if (display) onChunk(display);
    }

    return reply;
}
