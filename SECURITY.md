# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.8.x | ✅ Yes |
| < 0.8 | ❌ No |

## Reporting a Vulnerability

Open an issue or contact the maintainer directly.

---

## Security Measures

### 1. User Authentication
- `TELEGRAM_ALLOWED_USER_ID` - Only whitelisted users can interact
- Unauthorized messages are silently ignored

### 2. Path Validation
Prevents path traversal attacks:
- Decode URL-encoded paths
- Block null bytes (`\0`)
- Block `../` traversal
- Block sensitive system paths

### 3. Rate Limiting
- 100 requests/minute per API key
- Prevents DoS attacks

### 4. Environment Variable Filtering
Only safe variables passed to OpenCode:
- `PATH`, `HOME`, `USER`, `LANG`
- `OPENCODE_*`, `TELEGRAM_*`

### 5. API Authentication
- `X-API-Key` header required for all `/api/*` endpoints
- Constant-time comparison to prevent timing attacks

### 6. Input Sanitization
- HTML escaping for Telegram messages
- Command argument sanitization
- Error messages don't expose stack traces

---

## Environment Variables

| Variable | Sensitive | Description |
|----------|-----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | Bot token |
| `API_KEY` | ✅ Yes | API authentication |
| `WHATSAPP_PHONE_NUMBER` | ✅ Yes | WhatsApp number |
| `TELEGRAM_CHAT_ID` | ❌ No | Public group ID |
| `PROJECT_BASE_PATH` | ❌ No | Directory path |

---

## Best Practices

1. Never commit `.env` files (already in .gitignore)
2. Use strong `API_KEY` in production
3. Run as non-root user
4. Keep OpenCode binary updated
5. Monitor logs for unauthorized access

---

## Known Limitations

- Bot runs locally (limited attack surface)
- SQLite databases not encrypted (acceptable for local use)
- API server should be behind firewall in production