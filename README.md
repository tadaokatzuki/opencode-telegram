# OpenCode Telegram Integration (v0.7.0)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![grammY](https://img.shields.io/badge/grammY-Bot%20Framework-blue)](https://grammy.dev/)

A Telegram bot that orchestrates multiple [OpenCode](https://opencode.ai) instances through forum topics. Each forum topic in a Telegram supergroup gets its own dedicated OpenCode instance, enabling multi-user/multi-project AI assistance.

## Features (v0.7.0)

- **Forum Topic to OpenCode Instance**: Each topic gets a dedicated OpenCode session
- **Real-time Streaming**: SSE events from OpenCode are streamed to Telegram as editable messages
- **Session Discovery**: Connect to any running OpenCode instance on your machine
- **Instance Lifecycle Management**: Auto-start, health checks, crash recovery, idle timeout
- **Persistent State**: SQLite databases track topic mappings and instance state across restarts
- **Permission Handling**: Approve/deny dangerous operations via inline buttons
- **Better Status**: Shows model, tokens, time, and tools in progress messages
- **File Attachments**: Receive documents and photos from users
- **Commands Menu**: Inline keyboard with common commands (/menu)
- **Context Compact**: Command to compact context when needed (/compact)
- **Debug Topic**: Separate topic for debug/process logs
- **Bun/Node Runtime**: Works on both Bun and Node.js via runtime shim
- **Security**: Path validation, rate limiting, sanitized inputs
- **Test Suite**: 76 tests with vitest

## Table of Contents

- [Quick Start](#quick-start)
- [Running with Docker](#running-with-docker)
- [Usage](#usage)
- [Architecture](#architecture)
- [Security](#security)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- [OpenCode](https://opencode.ai) CLI installed
- Telegram account

### Dependencias del Sistema

```bash
# Instalar Bun
curl -fsSL https://bun.sh/install | bash

# Verificar instalación
bun --version

# Instalar OpenCode
curl -fsSL https://opencode.ai/install.sh | bash
```

### 1. Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Create a Supergroup with Topics

1. Create a new Telegram group
2. Convert it to a supergroup (Settings → Group Type → Supergroup)
3. Enable Topics (Settings → Topics → Enable)
4. Add your bot as an **admin** with permissions to manage topics

### 3. Get Your Chat ID

The chat ID for supergroups starts with `-100`. You can find it by:

1. Adding [@RawDataBot](https://t.me/RawDataBot) to your group temporarily
2. It will show the chat ID in its message
3. Remove the bot after getting the ID

### 4. Get Your User ID

Your Telegram user ID is needed for the allowed users list:

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It will reply with your ID number (e.g., `1234567890`)

### 5. Configure Environment Variables

```bash
# Copiar ejemplo
cp .env.example .env

# Editar con tus datos
nano .env
```

### Variables Requeridas

| Variable                 | Cómo obtener | Ejemplo                                 |
|--------------------------|--------------|-----------------------------------------|
| `TELEGRAM_BOT_TOKEN`     | @BotFather   | `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz` |
| `TELEGRAM_CHAT_ID`       | @RawDataBot  | `-1001234567890`                        |
| `TELEGRAM_ALLOWED_USERS` | @userinfobot | `1234567890`                            |

### Variables Opcionales

| Variable                   | Default    | Descripción                    |
|----------------------------|------------|--------------------------------|
| `PROJECT_BASE_PATH`        | `~/oc-bot` | Directorio base para proyectos |
| `OPENCODE_PATH`            | `opencode` | Path al binario de OpenCode    |
| `OPENCODE_MAX_INSTANCES`   | `5`        | Instancias máximas             |
| `OPENCODE_PORT_START`      | `5100`     | Puerto inicial                 |
| `OPENCODE_IDLE_TIMEOUT_MS` | `1800000`  | Timeout inactivo (30 min)      |
| `API_PORT`                 | `4200`     | Puerto del API server          |

### 4. Install and Configure

```bash
# Clonar el repositorio
git clone https://github.com/huynle/opencode-telegram.git
cd opencode-telegram

# Instalar dependencias
bun install

# Configurar entorno
cp .env.example .env
# Edit .env con tu bot token y chat ID
```

### 5. Ejecutar el Bot

```bash
# Desarrollo con hot reload
bun run dev

# Producción
bun run start
```

---

## Instalación desde Cero

### Paso a Paso

```bash
# 1. Instalar Bun
curl -fsSL https://bun.sh/install | bash

# 2. Verificar Bun
bun --version

# 3. Instalar OpenCode
curl -fsSL https://opencode.ai/install.sh | bash

# 4. Clonar el proyecto
git clone https://github.com/huynle/opencode-telegram.git
cd opencode-telegram

# 5. Instalar dependencias
bun install

# 6. Crear archivo de configuración
cp .env.example .env

# 7. Configurar variables de entorno
nano .env  # o tu editor preferido

# 8. Iniciar el bot
bun run dev
```

### Archivo .env example

```bash
# Requerido
TELEGRAM_BOT_TOKEN=tu-token-aqui
TELEGRAM_CHAT_ID=-100xxxxxxxxx

# Opcional
PROJECT_BASE_PATH=~/oc-bot
OPENCODE_PATH=opencode
OPENCODE_MAX_INSTANCES=5
OPENCODE_PORT_START=5100
OPENCODE_IDLE_TIMEOUT_MS=1800000
API_PORT=4200
```

## Running with Docker

> **Important**: Running natively with Bun is recommended for full functionality. Docker has significant limitations for this project's use case.

### Why Native is Recommended

The bot's session discovery feature uses `ps` and `lsof` to find OpenCode instances running on your machine. Docker containers have isolated process namespaces, meaning **the bot cannot discover OpenCode sessions running on your host**.

| Feature                                    | Native (Bun) | Docker | Docker + `--pid=host` |
|--------------------------------------------|--------------|--------|-----------------------|
| `/new` - create managed instances          | Works        | Works  | Works                 |
| `/sessions` - discover host sessions       | Works        | **No** | Linux only            |
| `/connect` - attach to discovered sessions | Works        | **No** | Linux only            |
| External API registration                  | Works        | Works  | Works                 |
| Stream responses to Telegram               | Works        | Works  | Works                 |

### When Docker Makes Sense

- You only need **managed instances** (created via `/new` command)
- You're on Linux and can use `--pid=host`
- You want to use the **External API** to manually register instances

### Build the Image

```bash
docker build -t opencode-telegram .
```

### Option 1: Managed Instances Only

If you only use `/new` to create instances (no discovery of external sessions):

```bash
docker run -d --name opencode-telegram \
  --network=host \
  -v $(pwd)/data:/app/data \
  -v ~/oc-bot:/root/oc-bot \
  --env-file .env \
  opencode-telegram
```

**Volume Mounts:**
| Mount                   | Purpose                                       |
|-------------------------|-----------------------------------------------|
| `./data:/app/data`      | SQLite databases for persistent state         |
| `~/oc-bot:/root/oc-bot` | Project directories created by `/new` command |

### Option 2: With Discovery (Linux Only)

On Linux, you can share the host's process namespace to enable discovery:

```bash
docker run -d --name opencode-telegram \
  --network=host \
  --pid=host \
  -v $(pwd)/data:/app/data \
  -v ~/oc-bot:/root/oc-bot \
  --env-file .env \
  opencode-telegram
```

> **Warning**: `--pid=host` shares the host's process namespace with the container. The container can see all host processes.

### Option 3: External API Registration

Run the bot in Docker and manually register OpenCode instances via the API:

```bash
# Start the bot
docker run -d --name opencode-telegram \
  --network=host \
  -v $(pwd)/data:/app/data \
  -v ~/oc-bot:/root/oc-bot \
  --env-file .env \
  opencode-telegram

# Register an OpenCode instance running on the host
curl -X POST http://localhost:4200/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/project",
    "projectName": "my-project", 
    "opencodePort": 4096,
    "sessionId": "ses_abc123"
  }'
```

### macOS/Windows Note

On macOS and Windows, Docker Desktop runs containers in a Linux VM:
- `--network=host` doesn't provide true host networking
- `--pid=host` is not available
- **Discovery will not work** - use native Bun or the External API

### Docker Compose

```yaml
version: '3.8'

services:
  opencode-telegram:
    build: .
    container_name: opencode-telegram
    network_mode: host
    # Uncomment for discovery (Linux only):
    # pid: host
    volumes:
      - ./data:/app/data
      - ~/oc-bot:/root/oc-bot
    env_file:
      - .env
    restart: unless-stopped
```

```bash
docker compose up -d
docker compose logs -f
```

### Useful Docker Commands

```bash
# View logs
docker logs -f opencode-telegram

# Check container status
docker ps -a --filter name=opencode-telegram

# Stop the bot
docker stop opencode-telegram

# Remove container
docker rm opencode-telegram

# Rebuild after code changes
docker build -t opencode-telegram . && docker compose up -d
```

## Usage

### General Topic Commands (Control Plane)

These commands work in the General topic of your supergroup:

| Command | Description |
|---------|-------------|
| `/new <name>` | Create folder + topic + start OpenCode instance |
| `/sessions` | List all OpenCode sessions (managed + discovered) |
| `/connect <name>` | Connect to an existing session by name or ID |
| `/clear` | Clean up stale topic mappings |
| `/status` | Show orchestrator status |
| `/stats` | Show bot metrics |
| `/help` | Show context-aware help |

### Topic Commands (Inside a Session)

These commands work inside individual topic threads:

| Command | Description |
|---------|-------------|
| `/session` | Show current topic's OpenCode session info |
| `/link <path>` | Link topic to existing project directory |
| `/stream` | Toggle real-time streaming on/off |
| `/disconnect` | Disconnect session and delete topic |
| `/compact` | Compact context (reduce context window) |
| `/menu` | Show commands menu (inline keyboard) |
| `/help` | Show context-aware help |

### Session Discovery

The bot can discover any running OpenCode instance on your machine:

```
/sessions              # Lists all sessions including discovered ones
/connect myproject     # Connect to a discovered session by name
/connect ses_abc123    # Connect by session ID prefix
```

Discovered sessions show with a magnifying glass icon in `/sessions` output.

> **Note**: Discovery requires the bot to run natively (not in Docker) or with `--pid=host` on Linux. See [Running with Docker](#running-with-docker) for details.

### Topic Naming Convention

Topics follow the `<project>-<session title>` naming convention:

1. **On `/new <project>`**: Topic is created with just `<project>` name initially
2. **After first message**: Once OpenCode generates a session title, the topic is automatically renamed to `<project>-<session title>`
3. **On `/connect`**: If the session already has a title, the topic is created with `<project>-<session title>` immediately

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Telegram Supergroup (Forum)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                           │
│  │ Topic #1 │  │ Topic #2 │  │ Topic #3 │  ...                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                           │
└───────┼─────────────┼─────────────┼─────────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Integration Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ grammY Bot  │  │TopicManager │  │StreamHandler│                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Instance Manager (Orchestrator)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Instance #1  │  │ Instance #2  │  │ Instance #3  │  ...          │
│  │ Port 4100    │  │ Port 4101    │  │ Port 4102    │               │
│  │ opencode     │  │ opencode     │  │ opencode     │               │
│  │ serve        │  │ serve        │  │ serve        │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── index.ts              # Entry point
├── config.ts             # Configuration from environment
├── integration.ts        # Wires all components together
├── api-server.ts         # External instance registration API
├── bot/
│   └── handlers/
│       └── forum.ts      # Telegram message/command handlers
├── forum/
│   ├── topic-manager.ts  # Topic → Session mapping logic
│   └── topic-store.ts    # SQLite persistence for topic mappings
├── opencode/
│   ├── client.ts         # OpenCode REST API client
│   ├── discovery.ts      # Discover running OpenCode instances
│   ├── stream-handler.ts # SSE → Telegram message bridging
│   └── telegram-markdown.ts # Markdown conversion for Telegram
├── orchestrator/
│   ├── manager.ts        # Manages multiple instances
│   ├── instance.ts       # Single OpenCode instance lifecycle
│   ├── port-pool.ts      # Port allocation
│   └── state-store.ts    # SQLite persistence for instance state
└── types/
    ├── forum.ts          # Forum/topic types
    └── orchestrator.ts   # Orchestrator types
```

## Security

This project takes security seriously:

### Protecciones Implementadas

| Protección | Descripción |
|------------|-------------|
| **Path Validation** | API server valida rutas para prevenir path traversal (`../`, null bytes) |
| **Rate Limiting** | Endpoints API limitada a 100 peticiones/minuto |
| **Environment Filtering** | Solo variables de entorno seguras se pasan a instancias OpenCode |
| **Input Sanitization** | Todos los inputs de usuario son sanitizados antes de procesar |
| **API Key Required** | API server requiere autenticación para registros externos |
| **SQLite with WAL** | Usa modo WAL para acceso seguro a base de datos concurrente |
| **Constant-time Compare** | Comparación de API keys en tiempo constante para evitar timing attacks |
| **CORS Configurable** | Orígenes permitidos configurables (no usar `*` en producción) |

### Variables de Entorno Seguras

Solo estas variables se pasan a las instancias OpenCode:

```bash
HOME, USER, PATH, SHELL, TERM, TMPDIR, TEMP, TMP,
LANG, LC_ALL, LC_CTYPE, XDG_RUNTIME_DIR, XDG_CONFIG_DIRS, XDG_CONFIG_HOME
```

### Recomendaciones de Producción

1. **API_KEY**: Generar una clave fuerte:
   ```bash
   # En Linux/macOS
   openssl rand -base64 32
   
   # En macOS (alternativo)
   ruby -r securerandom -e 'puts SecureRandom.base64(32)'
   
   # Con Python
   python3 -c "import base64; import os; print(base64.b64encode(os.urandom(32)).decode())"
   ```

2. **CORS_ORIGINS**: No usar `*` en producción:
   ```
   CORS_ORIGINS=https://tu-dominio.com
   ```

3. **Rate Limiting**: El límite por defecto es 100req/5min por API key

4. **Puerto Externo**: Usar `OPENCODE_EXTERNAL_PORT=4096` para Docker

### GitHub Rulesets

El proyecto usa **GitHub Rulesets** para proteger la rama `main`:

```
Main Branch Rules:
├── Require pull request (0 approvals for direct pushes)
├── Block force pushes
├── Block deletions
└── Include administrators (rules apply to everyone)
```

Para configurar en tu repositorio:
1. Ve a **Settings → Rulesets**
2. Crea un nuevo ruleset para `main`
3. Agrega las restricciones deseadas

Ver [GitHub Rulesets Documentation](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)

## Configuration

| Variable                   | Required | Default    | Description                         |
|----------------------------|----------|------------|-------------------------------------|
| `TELEGRAM_BOT_TOKEN`       | Yes      | -          | Bot token from @BotFather           |
| `TELEGRAM_CHAT_ID`         | Yes      | -          | Supergroup ID (starts with -100)    |
| `PROJECT_BASE_PATH`        | No       | `~/oc-bot` | Where topic directories are created |
| `OPENCODE_PATH`            | No       | `opencode` | Path to opencode binary             |
| `OPENCODE_MAX_INSTANCES`   | No       | `10`       | Max concurrent instances            |
| `OPENCODE_PORT_START`      | No       | `4100`     | Starting port for instances         |
| `OPENCODE_IDLE_TIMEOUT_MS` | No       | `1800000`  | Idle timeout (30 min)               |
| `API_PORT`                 | No       | `4200`     | External API server port            |

See [.env.example](.env.example) for all available options.

## API Reference

### External Instance API

The bot exposes an API on port 4200 for external OpenCode instances to register. This is useful when running the bot in Docker without process discovery.

```bash
# Register an external instance
curl -X POST http://localhost:4200/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/project",
    "projectName": "my-project",
    "opencodePort": 4096,
    "sessionId": "ses_abc123"
  }'

# Unregister
curl -X POST http://localhost:4200/api/unregister \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/project"}'

# Check status
curl http://localhost:4200/api/status/$(echo -n "/path/to/project" | base64)

# List all instances
curl http://localhost:4200/api/instances

# Health check
curl http://localhost:4200/api/health
```

### OpenCode REST API (per instance)

Each OpenCode instance exposes:

```
GET  /global/health           # Health check
GET  /session                 # List sessions
POST /session                 # Create session
GET  /session/:id/message     # Get messages
POST /session/:id/message     # Send message (sync)
POST /session/:id/prompt_async # Send message (async)
GET  /event                   # SSE event stream
```

## Development

```bash
# Install dependencies
bun install

# Start with hot reload
bun run dev

# Type check
bun run typecheck

# Format code (if prettier configured)
bun run format
```

### Key Patterns

- **Event-driven**: Orchestrator emits events, integration layer handles them
- **State recovery**: Both orchestrator and topic manager recover state on restart
- **Graceful degradation**: Errors are logged but don't crash the bot

### Adding New Features

1. **New bot commands**: Add to `src/bot/handlers/forum.ts` in `createForumCommands()`
2. **New SSE event handling**: Modify `src/opencode/stream-handler.ts`
3. **New instance lifecycle events**: Modify `src/orchestrator/instance.ts`

## Troubleshooting

### Port Conflicts

**Symptom**: Instance crashes with "Failed to start server on port 4100"

**Solution**: The code auto-cleans ports before starting. For manual cleanup:

```bash
lsof -ti:4100 | xargs kill
```

### Duplicate Messages

**Symptom**: Multiple "Thinking..." or response messages

**Cause**: Multiple SSE subscriptions or improper error handling

**Solution**: Fixed in current version by cleaning up subscriptions on `instance:ready`

### Session Not Forwarding

**Symptom**: SSE events received but not forwarded to Telegram

**Solution**: Check that the topic is properly linked with `/session` command

### Discovery Not Working in Docker

**Symptom**: `/sessions` only shows managed instances, not host OpenCode sessions

**Cause**: Docker containers have isolated process namespaces - `ps` and `lsof` can only see container processes

**Solutions** (in order of recommendation):
1. **Run natively**: `bun run start` (recommended)
2. **Linux with `--pid=host`**: Shares host process namespace
3. **External API**: Manually register instances via `/api/register`

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guides including:
- Systemd service configuration
- PM2 setup
- Environment variables
- Troubleshooting

## Contributing

¡Contribuciones son bienvenidas! Por favor lee nuestra [Guía de Contribuciones](CONTRIBUTING.md) para detalles sobre el código de conducta y el proceso para enviar pull requests.

### Guía Rápida de Contribución

```bash
# 1. Fork el repositorio
# 2. Crea una rama feature
git checkout -b feature/nueva-caracteristica

# 3. Haz tus cambios
# 4. Ejecuta tests
bun test

# 5. Commitea tus cambios
git commit -m "feat: description"

# 6. Push a tu fork
git push origin feature/nueva-caracteristica

# 7. Crea Pull Request
```

### Requisitos

- Bun v1.0+ (el proyecto usa runtime shim para Bun/Node)
- TypeScript.strict enabled
- 76 tests passing

### Comandos de Desarrollo

| Comando | Descripción |
|---------|------------|
| `bun run dev` | Desarrollo con watch |
| `bun run build` | Build de producción |
| `bun run test` | Ejecutar tests |
| `bun run typecheck` | Verificar tipos |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Créditos / Credits

### Autor y Mantenedor

- ** forked from**: Original project by [@huynle](https://github.com/huynle)
- ** current version**: v0.6.0 - Enhanced with new features

### Librerías y Dependencias

| Librería                                                     | Uso                   | Licencia   |
|--------------------------------------------------------------|-----------------------|------------|
| [grammY](https://grammy.dev/)                                | Bot de Telegram       | MIT        |
| [Bun](https://bun.sh/)                                       | Runtime de JavaScript | GPL-3.0    |
| [TypeScript](https://www.typescriptlang.org/)                | Type checking         | Apache 2.0 |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | Base de datos local   | MIT        |
| [undici](https://undici.nodejs.org/)                         | Cliente HTTP/Fetch    | MIT        |

### Proyectos de Referencia (Inspiración)

| Proyecto                                                                                      | Descripción                                              | Relevante para             |
|-----------------------------------------------------------------------------------------------|----------------------------------------------------------|----------------------------|
| [grinev/opencode-telegram-bot](https://github.com/grinev/opencode-telegram-bot)               | Bot avanzado con scheduled tasks, voice, model switching | ✅ Scheduled tasks        |
| [HNGM-HP/opencode-bridge](https://github.com/HNGM-HP/opencode-bridge)                         | Bridge multi-plataforma (Telegram, Discord, WeCom, etc.) | ✅ Features empresariales |
| [tommertom/opencode-telegram](https://github.com/Tommertom/opencode-telegram)                 | Terminal PTY interactivo                                 | ❌ No comparable          |
| [tommertom/opencoder-telegram-plugin](https://github.com/Tommertom/opencoder-telegram-plugin) | Plugin de notificaciones OpenCode                        | ❌ No comparable          |

---

## Resumen de Modificaciones

### Nuevas Features Agregadas

- 🏠 **Forum Topics** - Múltiples proyectos en un solo chat
- 🔄 **Auto-retry** - Reintento automático con exponential backoff (3 intentos)
- 📊 **Métricas** - Comando `/stats` para ver usage
- 📝 **Logging** - timestamps y logging estructurado
- 📢 **Alertas** - Notificaciones de errores a Telegram
- 💬 **Responder a mensajes simples** - Bienvenida automática en General topic

### Comandos Nuevos

| Comando  | Descripción                  |
|----------|------------------------------|
| `/stats` | Ver métricas del bot         |
| `/help`  | Ayuda con todos los comandos |

---

## License

MIT © 2026

---

## 🐛 Bugs Corregidos (v0.2.0)

### Críticos

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 1 | Código muerto tras return en rate limit | `stream-handler.ts` | Eliminado return, agregado delay 5s antes del retry |
| 2 | Doble shutdown handler | `manager.ts` | Eliminado setupShutdownHandlers() del Manager |
| 3 | Binary path hardcodeado | `instance.ts` | Usa this.config.opencodePath |
| 4 | Race condition en createTopicWithInstance | `integration.ts` | Crea mapping solo con sessionId real |
| 5 | SSE sin reconexión | `client.ts` | Retry con backoff exponencial (5 intentos) |

### Menores

| #  | Bug                                 | Archivo          | Fix                                          |
|----|-------------------------------------|------------------|----------------------------------------------|
| 6  | stat variable sin usar              | `forum.ts`       | Eliminada                                    |
| 7  | RATE_LIMIT_MAX_MESSAGES sin usar    | `integration.ts` | Ahora usa contador de ventana                |
| 8  | ps aux frágil                       | `discovery.ts`   | Usa ps -eo pid,comm,args con parsing preciso |
| 9  | isValidPath no bloqueaba sensibles  | `api-server.ts`  | Retorna false para rutas bloqueadas          |
| 10 | lastSessionList stale               | `forum.ts`       | Agregado TTL de 60s                          |
| 11 | closeForumTopic vs deleteForumTopic | `integration.ts` | Cambiado a deleteForumTopic                  |
| 12 | externalPort crea duplicados        | `integration.ts` | Check + cleanup antes de crear suscripción   |

---

## 🚀 Nuevas Features (v0.2.0)

- Auto-retry con exponential backoff (3 intentos al iniciar)
- Comando /stats - Métricas del bot
- Logging con timestamps
- Alertas automáticas de errores a Telegram
- Bienvenida automática en General topic
- Cache de sesiones con TTL de 60s
- Limpieza de topics al fallar inicio

---

## 📦 Instalación de Dependencias

### Con Bun (Recomendado)
```bash
# Instalar Bun
curl -fsSL https://bun.sh/install | bash

# Instalar dependencias
bun install

# Verificar versiones
bun -v
tsc --version
```

### Con npm (Alternativo)
```bash
# Instalar dependencias
npm install

# Verificar versiones
node -v
npm -v
tsc --version
```

---

## 🐛 Bugs Corregidos (v0.7.0) - Runtime Shim

### Críticos

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 1 | Bun.$ no funciona con Node.js | `runtime.ts` | Creado shim detectivo Bun/Node |
| 2 | Bun.spawn no compatible con child_process | `runtime.ts` | Abstraído en rt.spawn() |
| 3 | Bun.file no existe en Node | `runtime.ts` | Abstraído en rt.file() |
| 4 | Bun.serve incompatible con http | `runtime.ts` | Abstraído en rt.serve() |
| 5 | lsof no disponible en algunos sistemas | `instance.ts` | CheckPath existe como fallback |

### Menores

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 6 | which path incorrecto en Ubuntu/Windows | `instance.ts` | Validación directa con rt.file().exists() |
| 7 | typecheck errors por Bun types | `tsconfig.json` | Agregado bun-types |
| 8 | Template strings no funcionan en Node | `runtime.ts` | Implementado $.textDirect() |
| 9 | file().exists() returnaba Promise en Node | `runtime.ts` | Sincronizado para Node |

---

## 🐛 Bugs Corregidos (v0.6.0)

### Críticos

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 1 | Error al crear topic sin nombre | `forum.ts` | Validación de nombre requise |
| 2 | Fallo health check por timeout | `instance.ts` | Aumentado timeout a 60s |
| 3 | Topic no se limpiaba al cerrar | `integration.ts` | Cleanup completo en close |

### Menores

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 4 | Estado no persistía correctamente | `state-store.ts` | Transacciones atomic |
| 5 | Logs muy largos (truncate) | `instance.ts` | Limite de 4000 chars |
| 6 | Emoji no se mostraba en Telegram | `telegram-markdown.ts` | Escape de emoji |

---

## 🚀 Nuevas Features (v0.7.0)

- Runtime shim Bun/Node para compatibilidad cruzada
- Validación de path directa (rt.file().exists())
- Mejor manejo de errores en saludos
- Docs de seguridad expandidas
- Guía de contribución actualizada

---

## 🚀 Nuevas Features (v0.6.0)

- Topic name auto-update con timestamp
- Auto-create de directorios
- Health check configurable
- Stale topic timeout configurable
- Debug topic separado
