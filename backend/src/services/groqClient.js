import crypto from 'crypto';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// llama-3.1-8b-instant was retired by Groq (Aug 2026). Override with GROQ_MODEL if needed.
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const MAX_NOTES_CHARS = 12000;
const CACHE_TTL_MS = 15 * 60 * 1000;

const extractCache = new Map();

const SYSTEM_PROMPT = `You extract action items from raw meeting notes.

Return STRICT JSON only. No markdown, no commentary, no code fences.
The JSON must be an object of this exact shape:
{"tasks":[{"title":string,"suggestedDueDate":string|null,"suggestedAssigneeName":string|null}]}

Rules:
- "title" is a short, imperative task title (e.g. "Send revised timeline to client").
- "suggestedDueDate" is an ISO date (YYYY-MM-DD) only when the notes clearly imply a date; otherwise null.
- "suggestedAssigneeName" is a person's name as it appears in the notes when clearly assigned; otherwise null.
- Ignore discussion that is not an action item.
- If there are no clear action items, return {"tasks":[]}.
- Do not invent people, dates, or tasks that are not supported by the notes.`;

function notesHash(notes, todayIso) {
  return crypto.createHash('sha256').update(`${todayIso}\n${notes}`).digest('hex');
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of extractCache) {
    if (now - entry.cachedAt > CACHE_TTL_MS) extractCache.delete(key);
  }
}

function stripFences(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseExtractedJson(rawText) {
  const stripped = stripFences(rawText);
  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const startObj = stripped.indexOf('{');
    const endObj = stripped.lastIndexOf('}');
    const startArr = stripped.indexOf('[');
    const endArr = stripped.lastIndexOf(']');

    try {
      if (startObj !== -1 && endObj > startObj && (startArr === -1 || startObj < startArr)) {
        parsed = JSON.parse(stripped.slice(startObj, endObj + 1));
      } else if (startArr !== -1 && endArr > startArr) {
        parsed = JSON.parse(stripped.slice(startArr, endArr + 1));
      } else {
        throw new Error('no json');
      }
    } catch {
      const err = new Error('The AI response was not valid JSON. Try again with clearer notes.');
      err.code = 'INVALID_JSON';
      throw err;
    }
  }

  const list = Array.isArray(parsed) ? parsed : parsed?.tasks;
  if (!Array.isArray(list)) {
    const err = new Error('The AI response was not a task list. Try again with clearer notes.');
    err.code = 'INVALID_JSON';
    throw err;
  }

  return list;
}

function isIsoDate(value) {
  if (!value || typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function normalizeSuggestions(rawList) {
  return rawList
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const title = String(item.title || '').trim();
      if (!title) return null;
      const dueRaw = item.suggestedDueDate ?? item.dueDate ?? null;
      const nameRaw = item.suggestedAssigneeName ?? item.assigneeName ?? null;
      return {
        title: title.slice(0, 200),
        suggestedDueDate: isIsoDate(String(dueRaw || '').slice(0, 10))
          ? String(dueRaw).slice(0, 10)
          : null,
        suggestedAssigneeName:
          typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim().slice(0, 80) : null,
      };
    })
    .filter(Boolean)
    .slice(0, 25);
}

export async function extractActionItems(notes) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('GROQ_API_KEY is not configured on the server.');
    err.code = 'CONFIG';
    throw err;
  }

  const trimmed = String(notes || '').trim();
  if (!trimmed) {
    const err = new Error('Meeting notes are required.');
    err.code = 'VALIDATION';
    throw err;
  }
  if (trimmed.length > MAX_NOTES_CHARS) {
    const err = new Error(`Notes are too long (max ${MAX_NOTES_CHARS} characters).`);
    err.code = 'VALIDATION';
    throw err;
  }

  pruneCache();
  const todayIso = new Date().toISOString().slice(0, 10);
  const cacheKey = notesHash(trimmed, todayIso);
  const cached = extractCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { suggestions: cached.suggestions, cached: true };
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Today's date is ${todayIso}. Extract action items from these meeting notes:\n\n${trimmed}`,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || `Groq request failed (${response.status})`;
    const err = new Error(detail);
    err.code = 'GROQ';
    err.status = response.status >= 400 && response.status < 500 ? 502 : 502;
    throw err;
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error('The AI returned an empty response. Try again.');
    err.code = 'GROQ';
    throw err;
  }

  const suggestions = normalizeSuggestions(parseExtractedJson(content));
  extractCache.set(cacheKey, { suggestions, cachedAt: Date.now() });
  return { suggestions, cached: false };
}
