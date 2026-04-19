# AGENTS.md - OpenCode Telegram Bot

## Project
Telegram bot que gestiona instancias de OpenCode a través de forum topics.

## Bugs Corregidos (Recientes)

1. **Binary validation** - usa `which` en vez de `test -f`
2. **Health check IPv6** - usa `127.0.0.1` en vez de `localhost`
3. **ReadableStream locked** - removido duplicate stderr read
4. **Instance not ready** - fallback para crear cliente
5. **Timeout aumentado** - de 2 min a 5 min ( HARD_TIMEOUT_MS = 300000 )
6. **Topic renaming disabled** - causaba "Session not registered"
7. **permission.asked** - soportado nuevo tipo de evento de permisos
8. **escapeHtml undefined** - protegido contra valores undefined

## Dependencias Actualizadas

- grammy: ^1.42.0 (antes ^1.22.0)
- typescript: ^5.9.0 (antes ^5.4.0)

## Scripts

```bash
bun run dev    # Desarrollo con hot reload
bun run start  # Producción
```

## Estado de BD

- orchestrator.db: 0 instancias
- topics.db: 0 mappings
- projects/: solo "telegrambot"