// Rate limiting constants matching server-side configuration
export const RATE_LIMITS = {
  MESSAGES_PER_MIN: 5,
  MESSAGES_PER_HOUR: 60,
  MESSAGES_PER_DAY: 200,
  STARS_PER_MIN: 20,
  WORK_LINKS_PER_10MIN: 2,
  WORK_LINKS_PER_HOUR: 4,
} as const;

// Client-side rate limit tracking (for UI feedback)
interface RateLimitEntry {
  count: number;
  windowStart: number;
  windowDuration: number;
}

class ClientRateLimiter {
  private limits = new Map<string, RateLimitEntry>();

  private getKey(action: string, windowType: string): string {
    return `${action}:${windowType}`;
  }

  private getWindowDuration(windowType: string): number {
    switch (windowType) {
      case 'minute': return 60 * 1000;
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case '10min': return 10 * 60 * 1000;
      default: return 60 * 1000;
    }
  }

  checkLimit(action: string, windowType: string, maxCount: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const key = this.getKey(action, windowType);
    const now = Date.now();
    const windowDuration = this.getWindowDuration(windowType);
    
    let entry = this.limits.get(key);
    
    // Initialize or reset window if expired
    if (!entry || now - entry.windowStart > windowDuration) {
      entry = {
        count: 0,
        windowStart: now,
        windowDuration,
      };
      this.limits.set(key, entry);
    }
    
    const remaining = Math.max(0, maxCount - entry.count);
    const resetTime = entry.windowStart + windowDuration;
    const allowed = entry.count < maxCount;
    
    return { allowed, remaining, resetTime };
  }

  recordAction(action: string, windowType: string): void {
    const key = this.getKey(action, windowType);
    const entry = this.limits.get(key);
    
    if (entry) {
      entry.count += 1;
      this.limits.set(key, entry);
    }
  }

  getRemainingCooldown(action: string, windowType: string, maxCount: number): number {
    const { allowed, resetTime } = this.checkLimit(action, windowType, maxCount);
    
    if (allowed) return 0;
    
    const now = Date.now();
    return Math.max(0, Math.ceil((resetTime - now) / 1000));
  }

  // Check multiple rate limits for messages
  checkMessageLimits(): {
    allowed: boolean;
    cooldownSeconds: number;
    limitType?: string;
  } {
    const checks = [
      { type: 'minute', limit: RATE_LIMITS.MESSAGES_PER_MIN },
      { type: 'hour', limit: RATE_LIMITS.MESSAGES_PER_HOUR },
      { type: 'day', limit: RATE_LIMITS.MESSAGES_PER_DAY },
    ];

    for (const check of checks) {
      const result = this.checkLimit('message', check.type, check.limit);
      if (!result.allowed) {
        const cooldownSeconds = this.getRemainingCooldown('message', check.type, check.limit);
        return {
          allowed: false,
          cooldownSeconds,
          limitType: check.type,
        };
      }
    }

    return { allowed: true, cooldownSeconds: 0 };
  }

  // Check star rate limits
  checkStarLimits(): {
    allowed: boolean;
    cooldownSeconds: number;
  } {
    const result = this.checkLimit('star', 'minute', RATE_LIMITS.STARS_PER_MIN);
    if (!result.allowed) {
      const cooldownSeconds = this.getRemainingCooldown('star', 'minute', RATE_LIMITS.STARS_PER_MIN);
      return { allowed: false, cooldownSeconds };
    }

    return { allowed: true, cooldownSeconds: 0 };
  }

  // Check work link rate limits
  checkWorkLinkLimits(): {
    allowed: boolean;
    cooldownSeconds: number;
    limitType?: string;
  } {
    const checks = [
      { type: '10min', limit: RATE_LIMITS.WORK_LINKS_PER_10MIN },
      { type: 'hour', limit: RATE_LIMITS.WORK_LINKS_PER_HOUR },
    ];

    for (const check of checks) {
      const result = this.checkLimit('work_link', check.type, check.limit);
      if (!result.allowed) {
        const cooldownSeconds = this.getRemainingCooldown('work_link', check.type, check.limit);
        return {
          allowed: false,
          cooldownSeconds,
          limitType: check.type,
        };
      }
    }

    return { allowed: true, cooldownSeconds: 0 };
  }

  recordMessage(): void {
    this.recordAction('message', 'minute');
    this.recordAction('message', 'hour');
    this.recordAction('message', 'day');
  }

  recordStar(): void {
    this.recordAction('star', 'minute');
  }

  recordWorkLink(): void {
    this.recordAction('work_link', '10min');
    this.recordAction('work_link', 'hour');
  }

  // Clean up old entries to prevent memory leaks
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of Array.from(this.limits.entries())) {
      if (now - entry.windowStart > entry.windowDuration * 2) {
        this.limits.delete(key);
      }
    }
  }
}

// Singleton instance for the app
export const rateLimiter = new ClientRateLimiter();

// Clean up old entries periodically
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes
