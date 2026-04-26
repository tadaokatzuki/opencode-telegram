# Deployment Guide

## Quick Start

```bash
git clone https://github.com/tadaokatzuki/opencode-orquestrator.git
cd opencode-orquestrator
bun install
cp .env.example .env
# Edit .env with your tokens
bun run start
```

## Deployment Options

### Systemd Service (Recommended)

```ini
# /etc/systemd/system/opencode-orquestrator.service
[Unit]
Description=OpenCode Orquestrator
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/opencode-orquestrator
ExecStart=/home/youruser/.bun/bin/bun run /home/youruser/opencode-orquestrator/src/index.ts
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable opencode-orquestrator
sudo systemctl start opencode-orquestrator
```

### Docker

```bash
docker build -t opencode-orquestrator .
docker run -d --name opencode-orquestrator \
  --env-file .env \
  opencode-orquestrator
```

### PM2

```bash
bun install -g pm2
pm2 start src/index.ts --name opencode-orquestrator
pm2 save
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Supergroup ID (-100...) |
| `TELEGRAM_ALLOWED_USER_ID` | Your user ID |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_BASE_PATH` | `~/oc-bot` | Project directories |
| `OPENCODE_MAX_INSTANCES` | 10 | Max concurrent instances |
| `OPENCODE_PORT_START` | 4100 | Port pool start |
| `API_PORT` | 4200 | API server port |
| `API_KEY` | - | API authentication (required for external access) |
| `ENABLE_WHATSAPP` | false | Enable WhatsApp integration |
| `WHATSAPP_PHONE_NUMBER` | - | WhatsApp number (with country code) |

## Troubleshooting

### Bot not responding
```bash
sudo journalctl -u opencode-orquestrator -n 100
sudo systemctl restart opencode-orquestrator
```

### Port conflicts
```bash
lsof -i :4200
kill -9 <PID>
```

### Health check failures
```bash
which opencode
# or set OPENCODE_PATH=/full/path/to/opencode
```

## Security Checklist

- [ ] Use strong `API_KEY` in production
- [ ] Run as non-root user
- [ ] Keep `.env` file private
- [ ] Enable firewall for API port (4200)
- [ ] Monitor logs for unauthorized access