# AGENTS.md - OpenCode Telegram Bot

## Project
Telegram bot que gestiona instancias de OpenCode a través de forum topics.

## Tech Stack
- **Runtime**: Bun v1.3+ / Node.js 20+ (runtime shim)
- **Language**: TypeScript
- **Bot Framework**: Grammy v1.42
- **Testing**: Vitest (152 tests)
- **Database**: bun:sqlite (WAL mode)

## Version
**Current: v0.7.0**

## Bugs Corregidos (Recientes)

1. **Binary validation** - usa `which` en vez de `test -f`
2. **Health check IPv6** - usa `127.0.0.1` en vez de `localhost`
3. **ReadableStream locked** - removido duplicate stderr read
4. **Instance not ready** - fallback para crear cliente
5. **Timeout aumentado** - de 2 min a 5 min ( HARD_TIMEOUT_MS = 300000 )
6. **Topic renaming disabled** - causaba "Session not registered"
7. **permission.asked** - soportado nuevo tipo de evento de permisos
8. **escapeHtml undefined** - protegido contra valores undefined
9. **Path validation** - seguridad mejorada contra path traversal
10. **Runtime shim** - Bun/Node cross-compatibility
11. **Typecheck errors** - Fix cast types

## Dependencias

- grammy: ^1.42.0
- typescript: ^5.9.0
- vitest: ^2.0.0

## Scripts

```bash
npm install           # Instalar deps (para Termux)
bun install          # Instalar deps (Bun)
bun run dev          # Desarrollo con hot reload
bun run start        # Producción
bun test            # Tests (152 tests)
bun run typecheck   # Verificar tipos
```

## Seguridad

- Path validation con decodeURIComponent y null byte check
- Rate limiting (100 req/min)
- Environment filtering para instancias
- API key requerida para registros externos
- User ID whitelist

## Estado de BD

- orchestrator.db: SQLite con WAL
- topics.db: SQLite con WAL
- Port pool: 4100-4199