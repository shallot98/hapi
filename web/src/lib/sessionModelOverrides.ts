export type SessionModelOverride = {
    agent: 'claude' | 'codex' | 'gemini' | 'opencode'
    model: string
    savedAt: number
}

const STORAGE_KEY = 'hapi:sessionModelOverrides'
const MAX_ENTRIES = 200

let cached: Record<string, SessionModelOverride> | null = null

function safeReadAll(): Record<string, SessionModelOverride> {
    if (cached) return cached

    if (typeof localStorage === 'undefined') {
        cached = {}
        return cached
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            cached = {}
            return cached
        }

        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object') {
            cached = {}
            return cached
        }

        cached = parsed as Record<string, SessionModelOverride>
        return cached
    } catch {
        cached = {}
        return cached
    }
}

function safeWriteAll(next: Record<string, SessionModelOverride>): void {
    cached = next
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
        // ignore storage errors
    }
}

function pruneOverrides(entries: Record<string, SessionModelOverride>): Record<string, SessionModelOverride> {
    const ids = Object.keys(entries)
    if (ids.length <= MAX_ENTRIES) return entries

    const sorted = ids
        .map((id) => ({ id, savedAt: entries[id]?.savedAt ?? 0 }))
        .sort((a, b) => b.savedAt - a.savedAt)

    const keep = new Set(sorted.slice(0, MAX_ENTRIES).map((item) => item.id))
    const pruned: Record<string, SessionModelOverride> = {}
    for (const id of keep) {
        const value = entries[id]
        if (value) pruned[id] = value
    }
    return pruned
}

export function recordSessionModelOverride(sessionId: string, override: { agent: SessionModelOverride['agent']; model: string }): void {
    const trimmedId = sessionId.trim()
    if (!trimmedId) return

    const model = override.model.trim()
    if (!model) return

    const current = safeReadAll()
    const next: Record<string, SessionModelOverride> = {
        ...current,
        [trimmedId]: {
            agent: override.agent,
            model,
            savedAt: Date.now()
        }
    }
    safeWriteAll(pruneOverrides(next))
}

export function getSessionModelOverride(sessionId: string): SessionModelOverride | null {
    const trimmedId = sessionId.trim()
    if (!trimmedId) return null

    const current = safeReadAll()
    return current[trimmedId] ?? null
}

