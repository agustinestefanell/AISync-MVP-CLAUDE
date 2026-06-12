export type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>
}
