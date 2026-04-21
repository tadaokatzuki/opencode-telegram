# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.7.x   | :white_check_mark: |
| < 0.7   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please open an issue or contact the maintainer directly.

---

## Security Measures

This project implements multiple layers of security:

### 1. User Authentication

- **TELEGRAM_ALLOWED_USER_ID**: Only whitelisted users can interact with the bot
- Messages from unauthorized users are silently ignored

### 2. Path Validation

All file paths are validated to prevent path traversal attacks:

```typescript
// api-server.ts - Path validation
- Decode URL-encoded paths first
- Check for null bytes (\0)
- Block path traversal attempts (../, ..\)
- Remove duplicate slashes
- Block sensitive system paths (/etc, /root, /home, etc.)
```

### 3. Rate Limiting

- API endpoints limited to 100 requests per minute per API key
- Prevents DoS attacks

### 4. Environment Variable Filtering

Only safe environment variables are passed to OpenCode instances:

```typescript
// Only these vars are passed:
- PATH
- HOME
- USER
- LANG
- LC_*
- OPENCODE_*
- TELEGRAM_*
```

### 5. API Key Authentication

External API requires authentication:

```typescript
// All /api/* endpoints require valid API_KEY
if (!apiKey || apiKey !== config.apiKey) {
  return { error: "Unauthorized" }, 401
}
```

### 6. Database Security

- SQLite with WAL mode for safe concurrent access
- No sensitive data stored in plain text

### 7. Input Sanitization

All user inputs are sanitized before processing:

- HTML escaping for Telegram messages
- URL decoding with validation
- Command argument sanitization

---

## Best Practices

1. **Never commit .env files** - Already in .gitignore
2. **Use strong API_KEY** in production
3. **Run as non-root user** in production
4. **Keep OpenCode binary updated**
5. **Monitor logs** for unauthorized access attempts

---

## Environment Variables Security

| Variable | Sensitive | Description |
|----------|----------|-------------|
| TELEGRAM_BOT_TOKEN | ✅ Yes | Bot token |
| API_KEY | ✅ Yes | API authentication |
| OPENCODE_API_KEY | ⚠️ Maybe | Depends on setup |
| TELEGRAM_CHAT_ID | ❌ No | Public group ID |
| PROJECT_BASE_PATH | ❌ No | Directory path |

---

## Known Limitations

- Bot runs locally (no external attack surface beyond Telegram API)
- No encryption for local SQLite databases (acceptable for local use)
- API server should be behind firewall in production
