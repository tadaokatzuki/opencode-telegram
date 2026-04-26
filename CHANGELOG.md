# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.8.0] - 2026-04-25

### Added

- **Prometheus metrics endpoint** (`/metrics`) - Mensajes, errores, sesiones, uptime
- **WhatsApp integration** - Soporte para grupos WhatsApp via Baileys
- **OpenAPI specification** - Documentación completa en `docs/openapi.yaml`
- **Database schema docs** - Diagramas y ejemplos en `docs/database-schema.md`

### Security

- Eliminada carpeta `whatsapp.backup/` con logging sensible
- Previene exposición de stack traces en respuestas API
- Función `sanitizeError()` para mensajes de error seguros
- Prevención de command injection con argumentos seguros

### Refactoring

- DESIGN.md refactorizado (1094 → ~350 líneas)
- Runtime shim mejorado con métodos seguros

### Tests

- 139 tests passing

---

## [0.7.0] - 2026-04-19

### Added

- Forum topics support para multi-instance management
- SSE streaming para respuestas en tiempo real
- Path validation security improvements
- Comprehensive test suite
- Anti-loop protection
- Rate limiter para Telegram API
- SSE subscription manager

### Fixed

- Binary validation usando `which` en vez de `test -f`
- Health check usando `127.0.0.1` en vez de `localhost`
- ReadableStream locked issue
- Instance not ready fallback
- Topic renaming disabled
- `permission.asked` event type support
- Runtime shim para Bun/Node cross-compatibility