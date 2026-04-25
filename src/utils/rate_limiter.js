/**
 * Generic Rate Limiter using chrome.storage.local to persist across service worker restarts.
 * Uses a simple fixed-window (per duration) approach.
 */
export class RateLimiter {
    /**
     * @param {string} name - Identifier for the service (e.g., 'Groq', 'Cartesia')
     * @param {number} maxRequests - Max requests allowed in the window
     * @param {number} windowMs - Window duration in milliseconds
     */
    constructor(name, maxRequests, windowMs) {
        this.name = name;
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.storageKey = `rate_limit_${name}`;
    }

    /**
     * Checks if a request is allowed.
     * @returns {Promise<{allowed: boolean, waitTime?: number, message?: string}>}
     */
    async checkLimit() {
        const data = await chrome.storage.local.get(this.storageKey);
        const history = data[this.storageKey] || [];
        const now = Date.now();

        // Filter out requests older than the window
        const recentRequests = history.filter(ts => now - ts < this.windowMs);

        if (recentRequests.length >= this.maxRequests) {
            const oldestValid = recentRequests[0];
            const waitTime = Math.ceil((this.windowMs - (now - oldestValid)) / 1000);
            return {
                allowed: false,
                waitTime,
                message: `Rate limit hit for ${this.name}. Try again in ${waitTime}s.`
            };
        }

        return { allowed: true };
    }

    /**
     * Records a new request timestamp in storage.
     */
    async recordRequest() {
        const data = await chrome.storage.local.get(this.storageKey);
        const history = data[this.storageKey] || [];
        const now = Date.now();

        // Filter and add new request
        const recentRequests = history.filter(ts => now - ts < this.windowMs);
        recentRequests.push(now);

        await chrome.storage.local.set({ [this.storageKey]: recentRequests });
    }
}
