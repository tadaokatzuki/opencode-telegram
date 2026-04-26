# OpenCode Orquestrator (v0.8.0)

A bot that orchestrates multiple [OpenCode](https://opencode.ai) instances through Telegram topics and WhatsApp groups.

## Features

- **Multi-instance**: Each topic/group gets a dedicated OpenCode instance
- **WhatsApp Integration**: Connect WhatsApp groups via Baileys
- **Real-time Streaming**: SSE events streamed as editable messages
- **Persistent State**: SQLite databases track mappings across restarts
- **Security**: Path validation, rate limiting, API authentication
- **Tests**: 139 tests with Vitest

## Quick Start

```bash
# Install
git clone https://github.com/tadaokatzuki/opencode-orquestrator.git
cd opencode-orquestrator
bun install

# Configure
cp .env.example .env
# Edit .env with your tokens

# Run
bun run start
```

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- [OpenCode](https://opencode.ai) CLI
- Telegram bot + supergroup with topics
- (Optional) WhatsApp account

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Supergroup ID (-100...) |
| `TELEGRAM_ALLOWED_USER_ID` | Yes | Your user ID |
| `API_KEY` | For API | API authentication |
| `ENABLE_WHATSAPP` | No | Enable WhatsApp (true/false) |
| `WHATSAPP_PHONE_NUMBER` | No | WhatsApp number |

## Commands

| Command | Description |
|---------|-------------|
| `/new <name>` | Create project + topic |
| `/status` | Show project status |
| `/list` | List all projects |
| `/stats` | Bot metrics |
| `/help` | Help |
| `/menu` | Commands menu |

## Development

```bash
bun run dev      # Hot reload
bun test         # Run tests
bun run coverage # Coverage report
```

## Documentation

- [DESIGN.md](DESIGN.md) - Architecture and design
- [API Spec](docs/openapi.yaml) - OpenAPI specification
- [DB Schema](docs/database-schema.md) - Database schema
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contributing guide
- [SECURITY.md](SECURITY.md) - Security policy

## License

MIT © 2026