# Deployment Guide - OpenCode Telegram Bot

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/tadaokatzuki/opencode-telegram.git
cd opencode-telegram
npm install

# 2. Configure .env
cp .env.example .env
# Edit .env with your tokens

# 3. Run
bun run start
```

## Production Deployment

### Option 1: Systemd Service (Recommended)

Create `/etc/systemd/system/opencode-telegram.service`:

```ini
[Unit]
Description=OpenCode Telegram Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/opencode-telegram
Environment="HOME=/home/youruser"
ExecStart=/home/youruser/.bun/bin/bun run /home/youruser/opencode-telegram/src/index.ts
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable opencode-telegram
sudo systemctl start opencode-telegram
sudo journalctl -u opencode-telegram -f
```

### Option 2: Screen

```bash
screen -S opencode-bot
bun run start
# Detach: Ctrl+A, D
```

### Option 3: PM2

```bash
npm install -g pm2
pm2 start src/index.ts --name opencode-telegram
pm2 save
pm2 startup
```

## Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| TELEGRAM_BOT_TOKEN | Token from @BotFather |
| TELEGRAM_CHAT_ID | Supergroup ID (-100...) |
| TELEGRAM_ALLOWED_USER_ID | Your user ID |

### Optional
| Variable | Default | Description |
|----------|---------|-------------|
| PROJECT_BASE_PATH | ~/oc-bot | Project directories |
| OPENCODE_PATH | opencode | OpenCode binary |
| OPENCODE_MAX_INSTANCES | 10 | Max concurrent |
| OPENCODE_PORT_START | 4100 | Port pool start |
| API_PORT | 4200 | API server port |
| API_KEY | - | API authentication |
| IDLE_TIMEOUT_MS | 1800000 | 30 min idle timeout |

## Forum Topic Setup

1. Create a Supergroup in Telegram
2. Go to Group Info > Edit > Topics > Enable
3. Use topic IDs for multi-project support

## Troubleshooting

### Bot not responding
```bash
# Check logs
sudo journalctl -u opencode-telegram -n 100

# Restart
sudo systemctl restart opencode-telegram
```

### Port conflicts
```bash
# Find process using port
lsof -i :4200

# Kill if needed
kill -9 <PID>
```

### Health check failures
Check that OpenCode binary is accessible:
```bash
which opencode
# or set OPENCODE_PATH=/full/path/to/opencode
```

## Security

- Always use API_KEY in production
- Run as non-root user
- Keep .env file private (already in .gitignore)