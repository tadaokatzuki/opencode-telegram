# Contexto del Proyecto - opencode-telegram

## Estado Actual (Abril 2026)

### Proyecto
- **Nombre**: opencode-telegram
- **Repo**: https://github.com/tadaokatzuki/opencode-telegram
- **Versión**: v0.7.0
- **Stack**: TypeScript + Bun + Grammy (Telegram)

### Ultimos Cambios Aplicados
1. **Limpieza de dependencias** - Removido: unzip, adm-zite3, better-sqlite3, esbuild, tsx, bun
2. **Fix types** - Cambiado `as any` por `as unknown as Type`
3. **Documentación** - README, SECURITY.md, DEPLOYMENT.md actualizados
4. **Tests** - 152 tests passing, coverage ~60% objetivo

### Archivos Clave
- `src/index.ts` - Entry point
- `src/runtime.ts` - Bun/Node shim
- `src/api-server.ts` - API server
- `src/orchestrator/` - Instance management
- `src/forum/` - Topic management
- `src/opencode/` - OpenCode client

### Bugs Conocidos
- Coverage bajo en api-server.ts (19%)
- 47 usages de `any` (algunos corregidos)

### Git
- Branch: main
- Commits recientes sobre limpieza de deps y docs

### Skills Instaladas (12)
changelog-generator, code-review, debugging-wizard, document-skills, file-organizer, git-commit, prompt-engineer, security-review, skill-creator, test-generator, typescript-pro, webapp-testing

### Archivos en backup
- consolidado/backups/ - Backup del proyecto
