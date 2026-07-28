/**
 * Connection limits constants
 *
 * These values define the maximum number of active connections allowed
 * per account in the current plan tier.
 */

/**
 * Maximum number of active connections per account (across all external accounts).
 *
 * Free/current plan: 2 active connections total.
 * Change this constant when implementing paid plans.
 */
export const MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT = 2

/**
 * Maximum number of active connections between the same pair of accounts.
 *
 * Enforced as: Account A ↔ Account B can only have 1 active connection at a time.
 */
export const MAX_ACTIVE_CONNECTIONS_PER_PAIR = 1
