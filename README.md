# OpenCode Telegram Integration (v0.8.0)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![grammY](https://img.shields.io/badge/grammY-Bot%20Framework-blue)](https://grammy.dev/)

A Telegram bot that orchestrates multiple [OpenCode](https://opencode.ai) instances through forum topics. Each forum topic in a Telegram supergroup gets its own dedicated OpenCode instance, enabling multi-user/multi-project AI assistance.

## Features

- **Forum Topics**: Each topic = dedicated OpenCode instance
- **Real-time Streaming**: SSE → Telegram editable messages
- **Multi-instance**: Up to 10 simultaneous instances
- **Health Checks**: Auto-restart on failures
- **Idle Timeout**: Auto-stop after inactivity
- **Session Discovery**: Connect to running OpenCode instances
- **External API**: Register remote instances
- **Security**: Path validation, rate limiting, user whitelist
- **Bun/Node**: Works on both runtimes via shim
- **Tests**: 174 tests with vitest

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) v1.0+ or Node.js 20+
- [OpenCode](https://opencode.ai) CLI
- Telegram account

### Setup

```bash
# 1. Clone and install
git clone https://github.com/tadaokatzuki/opencode-telegram.git
cd opencode-telegram
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID

# 3. Run
bun run start
```

### Environment Variables

**Required:**
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_ALLOWED_USER_ID=your_user_id
```

**Optional:**
```env
PROJECT_BASE_PATH=~/oc-bot
OPENCODE_PATH=opencode
OPENCODE_MAX_INSTANCES=10
API_KEY=your_secure_key
```

## Usage

### General Commands
| Command | Description |
|---------|-------------|
| `/start` | Initialize bot |
| `/menu` | Show commands |
| `/sessions` | List all sessions |
| `/stats` | Bot statistics |

### Topic Commands
| Command | Description |
|---------|-------------|
| `/new <name>` | Create project + topic |
| `/connect <name>` | Connect to session |
| `/disconnect` | Disconnect session |
| `/status` | Instance status |

## Architecture

```
src/
├── index.ts           # Entry point
├── config.ts         # Configuration
├── integration.ts    # Main integration layer
├── api-server.ts    # External API
├── core/            # Core utilities (anti-loop, rate-limit, SSE)
├── bot/handlers/    # Telegram handlers
├── forum/           # Topic management
├── opencode/        # OpenCode client
├── orchestrator/    # Instance manager
└── types/           # TypeScript types
```

### Storage
- `orchestrator.db`: Instance state
- `topics.db`: Topic → session mappings
- Port pool: 4100-4199

## Security

- **Path validation**: Blocks `../`, null bytes, system paths
- **Rate limiting**: 100 req/min per API key
- **User whitelist**: Only allowed users can interact
- **Env filtering**: Only safe vars passed to OpenCode
- **API authentication**: API_KEY required

See [SECURITY.md](./SECURITY.md) for details.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production guides.

### Systemd (Linux)
```ini
[Unit]
Description=OpenCode Telegram Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/opencode-telegram
ExecStart=/home/youruser/.bun/bin/bun run src/index.ts
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Docker
```bash
docker build -t opencode-telegram .
docker run -d --env-file .env opencode-telegram
```

## Configuration

| Variable | Required | Default | Description |
|---------|----------|---------|-------------|
| TELEGRAM_BOT_TOKEN | Yes | - | Bot token |
| TELEGRAM_CHAT_ID | Yes | - | Supergroup ID |
| TELEGRAM_ALLOWED_USER_ID | No | - | User whitelist |
| PROJECT_BASE_PATH | No | ~/oc-bot | Projects dir |
| OPENCODE_PATH | No | opencode | Binary path |
| OPENCODE_MAX_INSTANCES | No | 10 | Max instances |
| OPENCODE_PORT_START | No | 4100 | Port pool |
| API_KEY | No | - | API auth |
| API_PORT | No | 4200 | API port |
| IDLE_TIMEOUT_MS | No | 1800000 | 30 min idle |

## API Reference

### External Instance Registration
```
POST /api/register
{
  "projectPath": "/path/to/project",
  "projectName": "my-project",
  "opencodePort": 4096,
  "sessionId": "abc123"
}
```

## Development

```bash
# Install dependencies
npm install

# Development with hot reload
bun run dev

# Run tests
bun test

# Typecheck
bun run typecheck
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](./LICENSE)

## Credits

Forked from [@huynle/opencode-telegram](https://github.com/huynle/opencode-telegram)

Dependencies:
- [grammY](https://grammy.dev/) - Telegram Bot Framework
- [Bun](https://bun.sh/) - Runtime
- [TypeScript](https://www.typescriptlang.org/) - Type checking
- [bun:sqlite](https://bun.sh/docs/runtime/sqlite) - SQLite