/// <reference types="vite/client" />

interface ImportMetaEnv {
    // LLM — Ollama (local)
    readonly VITE_OLLAMA_URL?: string
    readonly VITE_OLLAMA_MODEL?: string

    // LLM — Groq (free cloud)
    readonly VITE_GROQ_KEY?: string
    readonly VITE_GROQ_MODEL?: string

    // LLM — OpenRouter (free cloud)
    readonly VITE_OPENROUTER_KEY?: string
    readonly VITE_OPENROUTER_MODEL?: string

    // Weather
    readonly VITE_OPENWEATHER_KEY?: string

    // Routing (OSRM self-hosted override)
    readonly VITE_OSRM_URL?: string

    // TripAdvisor
    readonly VITE_RAPIDAPI_KEY?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
