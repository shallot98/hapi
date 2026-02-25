function getUserAgent(): string {
    if (typeof navigator === 'undefined') {
        return ''
    }
    return String(navigator.userAgent ?? '')
}

export function isIOS162(userAgent: string = getUserAgent()): boolean {
    const source = String(userAgent || '')
    const isAppleWebKit = /AppleWebKit/i.test(source)
    const isMobileApple = /(Mobile|iP(hone|ad|od))/i.test(source)
    const byOsToken = /OS 16_2(?:_|\b)/i.test(source)
    const byVersionToken = /Version\/16\.2/i.test(source) && isAppleWebKit && isMobileApple
    return byOsToken || byVersionToken
}

export async function maybeResetPwaStateForIOS162(options: {
    appVersion: string
    maxReloadWindowMs?: number
}): Promise<{ reloaded: boolean }> {
    if (!isIOS162()) {
        return { reloaded: false }
    }

    const maxReloadWindowMs = options.maxReloadWindowMs ?? 10_000
    const reloadKey = `hapi:ios162:compat-reload:${options.appVersion}`
    const now = Date.now()

    const hasServiceWorkerController = (() => {
        try {
            return 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller)
        } catch {
            return false
        }
    })()

    const registrations = await (async () => {
        try {
            if (!('serviceWorker' in navigator)) {
                return []
            }
            return await navigator.serviceWorker.getRegistrations()
        } catch {
            return []
        }
    })()

    try {
        await Promise.all(registrations.map((registration) => registration.unregister()))
    } catch {
        // ignore
    }

    try {
        if (typeof caches?.keys === 'function') {
            const keys = await caches.keys()
            await Promise.all(keys.map((key) => caches.delete(key)))
        }
    } catch {
        // ignore
    }

    const shouldReload = hasServiceWorkerController || registrations.length > 0
    if (!shouldReload) {
        return { reloaded: false }
    }

    const lastReload = (() => {
        try {
            return Number(localStorage.getItem(reloadKey) || 0)
        } catch {
            return 0
        }
    })()

    if (lastReload && now - lastReload < maxReloadWindowMs) {
        return { reloaded: false }
    }

    try {
        localStorage.setItem(reloadKey, String(now))
    } catch {
        // ignore
    }

    try {
        window.location.reload()
    } catch {
        // ignore
    }

    return { reloaded: true }
}

