/**
 * Integration Layer
 * 
 * Exporta todos los módulos de la capa de integración.
 */

export { AntiLoopManager, createAntiLoopManager } from "./anti-loop-manager"
export type { AntiLoopConfig } from "./anti-loop-manager"

export { RateLimiter, createRateLimiter, DEFAULT_RATE_LIMIT_CONFIG } from "./rate-limiter"
export type { RateLimiterConfig, RateLimitResult } from "./rate-limiter"

export { SseSubscriptionManager, createSseSubscriptionManager } from "./sse-subscription-manager"
export type { SubscriptionEntry } from "./sse-subscription-manager"

export { createIntegrationConfig } from "./config"
export type { IntegrationConfig } from "./config"