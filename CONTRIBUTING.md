# Contributing to OpenCode Orquestrator

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/opencode-orquestrator.git`
3. Install: `bun install`
4. Copy env: `cp .env.example .env`

## Development

```bash
bun run dev          # Development with hot reload
bun test             # Run tests (139 passing)
bun run coverage     # Coverage report
bun run typecheck    # TypeScript check
```

## Project Structure

```
src/
├── index.ts              # Entry point
├── config.ts            # Configuration
├── integration.ts       # Main orchestration
├── api-server.ts        # REST API
├── runtime.ts           # Bun/Node compatibility
├── core/                # Core utilities
│   ├── anti-loop-manager.ts
│   ├── rate-limiter.ts
│   └── sse-subscription-manager.ts
├── bot/handlers/        # Telegram handlers
├── forum/              # Topic management
├── opencode/           # OpenCode client
├── orchestrator/       # Instance management
└── utils/             # Utilities
```

## Branch Naming

- `feature/add-feature` - New features
- `fix/fix-bug` - Bug fixes
- `docs/update-docs` - Documentation
- `refactor/improve-code` - Code improvements

## Commit Format

```
type: short description

- Bullet points for details
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Pull Requests

1. Create feature branch from `main`
2. Make changes with tests
3. Ensure `bun test` passes
4. Update documentation if needed
5. Open PR with clear description

## Code Standards

- TypeScript with strict mode
- Use `const` by default
- Explicit types over `any`
- Error handling with context
- 2-space indentation

## Testing

```bash
bun test              # Run all tests
bun test --watch      # Watch mode
bun test tests/api-server.test.ts  # Specific file
```

## Questions?

- Check existing issues
- Open a Discussion on GitHub