# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.8.0] - 2026-04-23

### Added

- **src/core/anti-loop-manager.ts** - New module that prevents infinite loops by enforcing:
  - Max tool calls per session (10)
  - Hard timeout (10 minutes)
  - Warning timeout (3 minutes)
  - Automatic cleanup on session end

- **src/core/rate-limiter.ts** - New module for Telegram API rate limiting:
  - Message count per time window (60 messages per 5 minutes)
  - 429 response handling with retry-after support
  - Configurable limits via `DEFAULT_RATE_LIMIT_CONFIG`

- **src/core/sse-subscription-manager.ts** - New module for SSE connection lifecycle management:
  - Register/unregister SSE subscriptions
  - Track client↔session↔topic relationships
  - Graceful cleanup on shutdown

### Fixed

- Anti-loop protection now properly tracks tool execution and resets counters on new session
- Rate limiting correctly handles 429 responses with proper wait times
- SSE subscription cleanup properly aborts connections and closes clients

### Changed

- Improved anti-loop detection to only count `tool.execute` events (not message chunks)
- Session timeout increased from 5 min to 10 min for long-running tasks
- Warning timeout at 3 min to notify users of ongoing work

### Tests

- Added 22 new tests for core modules (174 total tests passing)

---

## [0.7.0] - Previous Release

### Added

- Forum topics support for multi-instance management
- SSE streaming for real-time responses
- Path validation security improvements
- Comprehensive test suite (152 tests)

### Fixed

- Binary validation using `which` instead of `test -f`
- Health check using `127.0.0.1` instead of `localhost`
- ReadableStream locked issue with duplicate stderr read
- Instance not ready fallback for client creation
- Topic renaming disabled (caused "Session not registered")
- `permission.asked` event type support
- `escapeHtml undefined` protection
- Runtime shim for Bun/Node cross-compatibility