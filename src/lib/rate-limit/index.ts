import { UpstashRateLimiter } from './upstash'

export const rateLimiters = {
  chat: new UpstashRateLimiter({
    limit: 30,
    window: '1 m',
    prefix: 'rate-limit:chat',
  }),
  connections: new UpstashRateLimiter({
    limit: 10,
    window: '1 m',
    prefix: 'rate-limit:connections',
  }),
  context: new UpstashRateLimiter({
    limit: 20,
    window: '1 m',
    prefix: 'rate-limit:context',
  }),
  teams: new UpstashRateLimiter({
    limit: 10,
    window: '1 m',
    prefix: 'rate-limit:teams',
  }),
} as const

export type { RateLimiter, RateLimitResult } from './types'
export { UpstashRateLimiter } from './upstash'
