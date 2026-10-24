/**
 * AI Provider Manager
 * - Groq primary (fast, llama models) with 10-key rotation
 * - Gemini fallback (reliable, handles Groq outages)
 * - Per-key health tracking — bad keys are skipped automatically
 * - Exponential backoff on rate limits
 * - Response caching to avoid duplicate API calls
 */

// No SDK needed — using native REST API with x-goog-api-key header
// This supports both legacy AIzaSy... keys and new AQ.Ab... Auth keys (Sept 2026+)

// ==================== Types ====================
export interface AIProviderConfig {
  provider: 'groq' | 'gemini';
  keyIndex: number;
  lastUsed: number;
  failureCount: number;
  isHealthy: boolean;
}

export interface AIResponse {
  text: string;
  provider: 'groq' | 'gemini';
  keyIndex: number;
  timestamp: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ==================== Key Collection ====================

/** Collects keys from VITE_GROQ_API_KEY, VITE_GROQ_API_KEY1 … VITE_GROQ_API_KEY9 */
const collectKeys = (prefix: string): string[] => {
  const keys: string[] = [];

  // Try JSON array first (VITE_GROQ_KEYS or VITE_GEMINI_KEYS)
  try {
    const raw = (import.meta.env as any)[`${prefix}S`] || '';
    if (raw.startsWith('[')) {
      const parsed = JSON.parse(raw).filter(Boolean);
      keys.push(...parsed);
    } else if (raw.trim()) {
      keys.push(raw.trim());
    }
  } catch { /* ignore */ }

  // Collect VITE_GROQ_API_KEY, VITE_GROQ_API_KEY1 … VITE_GROQ_API_KEY9
  for (let i = 0; i <= 9; i++) {
    const envKey = i === 0 ? `${prefix}` : `${prefix}${i}`;
    const key = (import.meta.env as any)[envKey];
    if (key?.trim()) keys.push(key.trim());
  }

  return [...new Set(keys)]; // deduplicate
};

const GROQ_KEYS  = collectKeys('VITE_GROQ_API_KEY');
const GEMINI_KEYS = collectKeys('VITE_GEMINI_API_KEY');

// Groq models to try in order — updated Oct 2026
// Retired from free tier: llama-3.1-8b-instant (Aug 16), llama-3.3-70b-specdec (Aug 16),
//   llama-4-scout (Jun 17), mistral-saba-24b (Jul 2025)
// Currently active on free tier (Oct 2026):
const GROQ_MODELS = [
  'openai/gpt-oss-20b',                            // fastest, 1000 tok/s, free tier
  'openai/gpt-oss-120b',                           // flagship open-weight, free tier
  'meta-llama/llama-4-maverick-17b-128e-instruct', // Llama 4 Maverick — still on free tier
  'qwen/qwen3.6-27b',                              // Qwen fallback — free tier
];

// Gemini models to try in order — updated Oct 2026
// gemini-1.5-pro — 404 on v1beta free; gemini-2.5-flash — paid only
const GEMINI_MODELS = [
  'gemini-1.5-flash',      // high quota, fast, widely available on free tier
  'gemini-1.5-flash-8b',   // highest free quota
];

// ==================== Per-Key Health State ====================

interface KeyHealth {
  failures: number;
  lastFailure: number;
  banned: boolean; // 401/403 = permanently skip this key
}

const groqHealth:   KeyHealth[] = GROQ_KEYS.map(() => ({ failures: 0, lastFailure: 0, banned: false }));
const geminiHealth: KeyHealth[] = GEMINI_KEYS.map(() => ({ failures: 0, lastFailure: 0, banned: false }));

// Round-robin indices
let groqKeyIndex   = 0;
let geminiKeyIndex = 0;
let lastProviderUsed: 'groq' | 'gemini' = 'groq';

// Simple in-memory response cache (prompt → response, max 50 entries, 10 min TTL)
const responseCache = new Map<string, { response: AIResponse; ts: number }>();
const CACHE_TTL_MS  = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX     = 50;

function cacheGet(key: string): AIResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { responseCache.delete(key); return null; }
  return entry.response;
}

function cacheSet(key: string, response: AIResponse): void {
  if (responseCache.size >= CACHE_MAX) {
    // Evict oldest entry
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) responseCache.delete(oldest[0]);
  }
  responseCache.set(key, { response, ts: Date.now() });
}

// ==================== Helpers ====================

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const backoff = (attempt: number): number =>
  Math.min(500 * Math.pow(2, attempt), 15000) + Math.random() * 500;

const isRateLimit = (err: any): boolean => {
  const s = err?.status ?? err?.response?.status ?? 0;
  const m = (err?.message || '').toLowerCase();
  return s === 429 || m.includes('rate limit') || m.includes('quota') || m.includes('too many');
};

const isAuthError = (err: any): boolean => {
  const s = err?.status ?? err?.response?.status ?? 0;
  const m = (err?.message || '').toLowerCase();
  return s === 401 || s === 403 || m.includes('api_key_invalid') || m.includes('invalid api key') || m.includes('unauthorized');
};

/** Returns next healthy Groq key index, cycling through all keys */
function nextHealthyGroqKey(): { key: string; index: number } | null {
  const total = GROQ_KEYS.length;
  if (total === 0) return null;

  for (let i = 0; i < total; i++) {
    const idx = (groqKeyIndex + i) % total;
    const h   = groqHealth[idx];
    if (h.banned) continue;
    // Cool-down: skip keys that failed within last 60s (rate limit)
    if (h.failures > 0 && Date.now() - h.lastFailure < 60_000) continue;
    groqKeyIndex = (idx + 1) % total; // advance for next call
    return { key: GROQ_KEYS[idx], index: idx };
  }

  // All keys on cooldown — reset and try from current index
  groqHealth.forEach(h => { if (!h.banned) { h.failures = 0; h.lastFailure = 0; } });
  const idx = groqKeyIndex % total;
  if (!groqHealth[idx].banned) {
    groqKeyIndex = (idx + 1) % total;
    return { key: GROQ_KEYS[idx], index: idx };
  }
  return null;
}

/** Returns next healthy Gemini key index */
function nextHealthyGeminiKey(): { key: string; index: number } | null {
  const total = GEMINI_KEYS.length;
  if (total === 0) return null;

  for (let i = 0; i < total; i++) {
    const idx = (geminiKeyIndex + i) % total;
    const h   = geminiHealth[idx];
    if (h.banned) continue;
    if (h.failures > 0 && Date.now() - h.lastFailure < 60_000) continue;
    geminiKeyIndex = (idx + 1) % total;
    return { key: GEMINI_KEYS[idx], index: idx };
  }

  // All keys on cooldown — reset
  geminiHealth.forEach(h => { if (!h.banned) { h.failures = 0; h.lastFailure = 0; } });
  const idx = geminiKeyIndex % total;
  if (!geminiHealth[idx].banned) {
    geminiKeyIndex = (idx + 1) % total;
    return { key: GEMINI_KEYS[idx], index: idx };
  }
  return null;
}

// ==================== Groq API ====================

export const callGroqAPI = async (
  prompt: string,
  maxRetries = 3
): Promise<AIResponse> => {
  return callGroqAPIWithHistory([{ role: 'user', content: prompt }], maxRetries);
};

export const callGroqAPIWithHistory = async (
  messages: ChatMessage[],
  maxRetries = 3
): Promise<AIResponse> => {
  if (GROQ_KEYS.length === 0) throw new Error('No Groq API keys configured');

  let lastError: any;

  // Try each model × each key combination
  for (const model of GROQ_MODELS) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const slot = nextHealthyGroqKey();
      if (!slot) break; // all keys banned/cooling

      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slot.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 1024,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const err = {
            status: response.status,
            message: errData?.error?.message || `HTTP ${response.status}`,
          };

          if (isAuthError(err)) {
            groqHealth[slot.index].banned = true;
            console.warn(`[Groq] Key ${slot.index} banned (auth error on ${model})`);
            break; // try next model with different key
          }
          if (isRateLimit(err)) {
            groqHealth[slot.index].failures++;
            groqHealth[slot.index].lastFailure = Date.now();
            await sleep(backoff(attempt));
            continue;
          }
          throw err;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim() || '';
        if (!text) throw new Error('Empty response from Groq');

        // Reset health on success
        groqHealth[slot.index].failures   = 0;
        groqHealth[slot.index].lastFailure = 0;
        lastProviderUsed = 'groq';

        return { text, provider: 'groq', keyIndex: slot.index, timestamp: Date.now() };

      } catch (error: any) {
        lastError = error;
        if (!isAuthError(error)) {
          groqHealth[slot.index].failures++;
          groqHealth[slot.index].lastFailure = Date.now();
        }
        if (attempt < maxRetries - 1) await sleep(backoff(attempt));
      }
    }
  }

  throw new Error(`Groq failed on all models/keys: ${lastError?.message}`);
};

// ==================== Gemini API ====================

export const callGeminiAPI = async (
  prompt: string,
  maxRetries = 3
): Promise<AIResponse> => {
  if (GEMINI_KEYS.length === 0) throw new Error('No Gemini API keys configured');

  let lastError: any;

  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const slot = nextHealthyGeminiKey();
      if (!slot) break;

      try {
        // Use native REST API with x-goog-api-key header — supports both
        // legacy AIzaSy... keys and new AQ.Ab... Auth keys (required Sept 2026+)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': slot.key,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${response.status}`;
          const err = { status: response.status, message: errMsg };

          if (isAuthError(err)) {
            geminiHealth[slot.index].banned = true;
            console.warn(`[Gemini] Key ${slot.index} banned (auth error on ${modelName}): ${errMsg}`);
            break; // try next model with different key
          }
          if (isRateLimit(err)) {
            geminiHealth[slot.index].failures++;
            geminiHealth[slot.index].lastFailure = Date.now();
            continue; // rotate to next key
          }
          throw err;
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (!text) throw new Error('Empty response from Gemini');

        geminiHealth[slot.index].failures   = 0;
        geminiHealth[slot.index].lastFailure = 0;
        lastProviderUsed = 'gemini';

        return { text, provider: 'gemini', keyIndex: slot.index, timestamp: Date.now() };

      } catch (error: any) {
        lastError = error;

        if (isAuthError(error)) {
          geminiHealth[slot.index].banned = true;
          console.warn(`[Gemini] Key ${slot.index} banned (auth error on ${modelName})`);
          break;
        }
        if (isRateLimit(error)) {
          geminiHealth[slot.index].failures++;
          geminiHealth[slot.index].lastFailure = Date.now();
          continue;
        }

        geminiHealth[slot.index].failures++;
        geminiHealth[slot.index].lastFailure = Date.now();
        if (attempt < maxRetries - 1) await sleep(backoff(attempt));
      }
    }
  }

  throw new Error(`Gemini failed on all models/keys: ${lastError?.message}`);
};

// ==================== Unified Entry Points ====================

/**
 * Primary call — Groq first (fast), Gemini fallback (reliable).
 * Responses for identical prompts are cached for 10 minutes.
 */
export const callAIAPI = async (
  prompt: string,
  preferredProvider: 'groq' | 'gemini' | 'auto' = 'auto',
  useCache = true
): Promise<AIResponse> => {
  if (useCache) {
    const cached = cacheGet(prompt);
    if (cached) return cached;
  }

  const result = await callAIAPIWithHistory(
    [{ role: 'user', content: prompt }],
    preferredProvider
  );

  if (useCache) cacheSet(prompt, result);
  return result;
};

/**
 * Multi-turn chat with full history.
 * System message (first element with role:'system') sets the AI persona.
 */
export const callAIAPIWithHistory = async (
  messages: ChatMessage[],
  preferredProvider: 'groq' | 'gemini' | 'auto' = 'auto'
): Promise<AIResponse> => {
  const errors: string[] = [];

  // Determine provider order
  const useGroqFirst =
    preferredProvider === 'groq'
      ? GROQ_KEYS.length > 0
      : preferredProvider === 'gemini'
        ? false
        : GROQ_KEYS.length > 0; // 'auto' → try Groq first (faster)

  const order: Array<'groq' | 'gemini'> = useGroqFirst
    ? ['groq', 'gemini']
    : ['gemini', 'groq'];

  for (const provider of order) {
    try {
      if (provider === 'groq') {
        return await callGroqAPIWithHistory(messages);
      } else {
        // Flatten history to a single prompt for Gemini
        const systemMsg = messages.find(m => m.role === 'system')?.content || '';
        const turns = messages
          .filter(m => m.role !== 'system')
          .map(m => (m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`))
          .join('\n\n');
        const fullPrompt = systemMsg ? `${systemMsg}\n\n${turns}` : turns;
        return await callGeminiAPI(fullPrompt);
      }
    } catch (err: any) {
      errors.push(`${provider}: ${err.message}`);
      console.warn(`[AI] ${provider} failed, trying next provider...`);
    }
  }

  throw new Error(`All AI providers failed. ${errors.join(' | ')}`);
};

// ==================== Health & Stats ====================

export const getProviderHealth = () => ({
  groq: {
    totalKeys:   GROQ_KEYS.length,
    activeKeys:  groqHealth.filter(h => !h.banned).length,
    bannedKeys:  groqHealth.filter(h => h.banned).length,
    currentIndex: groqKeyIndex,
    available:   GROQ_KEYS.length > 0,
    lastUsed:    lastProviderUsed === 'groq',
  },
  gemini: {
    totalKeys:   GEMINI_KEYS.length,
    activeKeys:  geminiHealth.filter(h => !h.banned).length,
    bannedKeys:  geminiHealth.filter(h => h.banned).length,
    currentIndex: geminiKeyIndex,
    available:   GEMINI_KEYS.length > 0,
    lastUsed:    lastProviderUsed === 'gemini',
  },
  cache: {
    size:    responseCache.size,
    maxSize: CACHE_MAX,
  },
  lastProviderUsed,
  timestamp: Date.now(),
});

export const resetProviderHealth = () => {
  groqHealth.forEach(h   => { h.failures = 0; h.lastFailure = 0; h.banned = false; });
  geminiHealth.forEach(h => { h.failures = 0; h.lastFailure = 0; h.banned = false; });
  groqKeyIndex   = 0;
  geminiKeyIndex = 0;
  responseCache.clear();
};

export const getAPIStats = () => ({
  groq: {
    totalKeys:    GROQ_KEYS.length,
    activeKeys:   groqHealth.filter(h => !h.banned).length,
    currentIndex: groqKeyIndex,
    keyHealth:    groqHealth.map((h, i) => ({ key: i, ...h })),
  },
  gemini: {
    totalKeys:    GEMINI_KEYS.length,
    activeKeys:   geminiHealth.filter(h => !h.banned).length,
    currentIndex: geminiKeyIndex,
    keyHealth:    geminiHealth.map((h, i) => ({ key: i, ...h })),
  },
  models: {
    groq:   GROQ_MODELS,
    gemini: GEMINI_MODELS,
  },
});

// Legacy named exports kept for backward compatibility
export const getNextGroqKey   = () => nextHealthyGroqKey()?.key ?? '';
export const getNextGeminiKey = () => nextHealthyGeminiKey()?.key ?? '';
