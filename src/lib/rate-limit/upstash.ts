import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { RateLimiter, RateLimitResult } from './types'

type UpstashRateLimiterOptions = {
  limit: number
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`
  prefix: string
}

export class UpstashRateLimiter implements RateLimiter {
  // Lazy init: Redis.fromEnv() throws when the Upstash env vars are missing
  // (e.g. local dev). Building the Ratelimit inside check() keeps that case
  // inside the fail-open try/catch instead of crashing at module load.
  private limiter: Ratelimit | null = null
  private readonly options: UpstashRateLimiterOptions

  constructor(options: UpstashRateLimiterOptions) {
    this.options = options
  }

  private getLimiter(): Ratelimit {
    if (!this.limiter) {
      this.limiter = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(this.options.limit, this.options.window),
        prefix: this.options.prefix,
      })
    }
    return this.limiter
  }

  async check(key: string): Promise<RateLimitResult> {
    try {
      const result = await this.getLimiter().limit(key)

      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      }
    } catch (error) {
      console.error('[rate-limit] fail-open after Upstash error', error)

      return {
        success: true,
        limit: this.options.limit,
        remaining: this.options.limit,
        reset: Date.now(),
      }
    }
  }
}
