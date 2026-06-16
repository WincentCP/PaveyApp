/**
 * ai.ts — LLM gateway for TinTin chatbot bridged securely to the backend
 */

import type { AIResult } from './types';
import { apiChat } from '../lib/api';

export const SYSTEM_PROMPT = '';

/** Strip the DATA_JSON block from the visible text, return both parts. */
export function stripDataJson(raw: string): { display: string; json: string | null } {
    const trimmed = raw.trim();

    // 1. Try matching the DATA_JSON block format
    let match = trimmed.match(/DATA_JSON>\s*([\s\S]*?)\s*<DATA_JSON/);
    if (match) {
        const display = trimmed.replace(/DATA_JSON>[\s\S]*?<DATA_JSON/, '').trim();
        return { display, json: match[1].trim() };
    }
    
    // 2. Try matching <DATA_JSON>...</DATA_JSON>
    match = trimmed.match(/<DATA_JSON>\s*([\s\S]*?)\s*<\/DATA_JSON>/i);
    if (match) {
        const display = trimmed.replace(/<DATA_JSON>[\s\S]*?<\/DATA_JSON>/gi, '').trim();
        return { display, json: match[1].trim() };
    }

    // 3. Try matching ```json ... ```
    match = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    if (match) {
        const display = trimmed.replace(/```json[\s\S]*?```/gi, '').trim();
        return { display, json: match[1].trim() };
    }

    // 4. Try matching raw JSON if the entire response is a JSON object
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.intent) {
                return { display: parsed.intro || '', json: trimmed };
            }
        } catch {}
    }

    return { display: trimmed, json: null };
}

/** Parse the extracted JSON string into AIResult, with safety fallback. */
export function parseAIResult(jsonStr: string): AIResult | null {
    try {
        // Remove markdown code fences if the model misbehaved
        const clean = jsonStr.replace(/^```(?:json)?|```$/gm, '').trim();
        const parsed = JSON.parse(clean) as AIResult;
        if (!parsed.intent || !parsed.intro) return null;
        return parsed;
    } catch {
        return null;
    }
}

export interface HistoryMsg {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * Send a message to the AI via secure backend router.
 */
export async function sendMessage(
    history: HistoryMsg[],
    userMessage: string,
    onChunk?: (chunk: string) => void,
    tripId?: string,
    context?: string,
): Promise<string> {
    const res = await apiChat(userMessage, tripId, context);
    const reply = res.reply || '';
    if (onChunk && reply) {
        // No streaming chunk-by-chunk over standard HTTP JSON response,
        // so we just return it as a single chunk
        const { display } = stripDataJson(reply);
        onChunk(display);
    }
    return reply;
}

