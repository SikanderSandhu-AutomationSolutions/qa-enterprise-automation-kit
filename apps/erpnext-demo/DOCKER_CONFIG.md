# ERPNext Docker Configuration — In-Depth Reference

> **Scope:** This document explains every configuration file in this directory, what each setting does, and documents all changes made to fix the `websocket` Redis `ECONNREFUSED` error (March 2026).

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [`.env` — Environment Variables](#env--environment-variables)
3. [`compose.yaml` — Main Compose File](#composeyaml--main-compose-file)
   - [YAML Anchors](#yaml-anchors)
   - [Services](#services)
   - [Volumes](#volumes)
4. [`pwd.yml` — Disposable Demo Stack](#pwdyml--disposable-demo-stack)
5. [`overrides/` — Compose Override Files](#overrides--compose-override-files)
6. [Startup Order & Dependency Graph](#startup-order--dependency-graph)
7. [Change Log — What Was Fixed and Why](#change-log--what-was-fixed-and-why)
8. [How `common_site_config.json` Works](#how-common_site_configjson-works)
9. [Troubleshooting Reference](#troubleshooting-reference)

---

## Directory Structure

```
qa-enterprise-automation-kit/
├── apps/
│   └── erpnext-demo/          # ← ERPNext target system (isolated)
│       ├── compose.yaml       # Main compose file
│       ├── pwd.yml            # Demo stack
│       └── ...
├── framework/                 # Reusable core automation framework
├── tests/                     # Domain-specific test suites
├── ci/                        # CI/CD pipelines
└── apps/erpnext-demo/DOCKER_CONFIG.md  # ← This file
```

---

## `.env` — Environment Variables

The `.env` file is automatically loaded by `docker compose`. It sets the values interpolated throughout `compose.yaml` using `${VAR_NAME}` syntax.

### Key Variables

| Variable | Default | Purpose |
|---|---|---|
| `ERPNEXT_VERSION` | `v16.7.3` | Docker image tag for `frappe/erpnext`. Controls the exact ERPNext release. |
| `DB_PASSWORD` | `123` | Root password for MariaDB (used when composing with `compose.mariadb.yaml` override). |
| `DB_HOST` | _(empty)_ | External database host. Leave blank to use the `db` service from the MariaDB override. |
| `DB_PORT` | _(empty)_ | External database port. Leave blank for default `3306`. |
| `REDIS_CACHE` | _(empty)_ | External Redis cache URL. Leave blank to use the internal `redis-cache` service. |
| `REDIS_QUEUE` | _(empty)_ | External Redis queue URL. Leave blank to use the internal `redis-queue` service. |
| `CUSTOM_IMAGE` | `frappe/erpnext` | Override the Docker image (e.g., for custom-built images). |
| `CUSTOM_TAG` | _(from ERPNEXT_VERSION)_ | Override the image tag independently of `ERPNEXT_VERSION`. |
| `PULL_POLICY` | `always` | Docker pull policy. Set to `missing` to avoid re-pulling on every `up`. |
| `RESTART_POLICY` | `unless-stopped` | Service restart policy applied to most services via the anchor. |
| `FRAPPE_SITE_NAME_HEADER` | _(empty)_ | Forces NGINX to resolve to a specific site name instead of deriving it from the `Host` header. Set to your site name (e.g., `mysite.localhost`) when accessing via `127.0.0.1`. |
| `HTTP_PUBLISH_PORT` | `8080` | Host port mapped to the frontend NGINX container. |
| `PROXY_READ_TIMEOUT` | `120s` | NGINX proxy timeout. Increase for slow print formats or long-running operations. |
| `CLIENT_MAX_BODY_SIZE` | `50m` | NGINX upload size limit. Increase if Frappe's upload limit is raised. |
| `LETSENCRYPT_EMAIL` | `mail@example.com` | Email for Let's Encrypt certificate requests (HTTPS override only). |

### Variable Interpolation

Variables are used in `compose.yaml` like this:

```yaml
image: ${CUSTOM_IMAGE:-frappe/erpnext}:${CUSTOM_TAG:-$ERPNEXT_VERSION}
```

- `${VAR:-default}` — use `VAR` if set, otherwise use `default`
- The image tag falls back to `$ERPNEXT_VERSION` if `CUSTOM_TAG` is not set

---

## `compose.yaml` — Main Compose File

This is the **central orchestration file**. It defines all services, their configuration, start-up ordering, and health checks.

### YAML Anchors

Anchors (`&name`) and aliases (`*name`) are YAML's way to avoid repetition — like variables for config blocks.

#### `x-customizable-image` (`&customizable_image`)

```yaml
x-customizable-image: &customizable_image
  image: ${CUSTOM_IMAGE:-frappe/erpnext}:${CUSTOM_TAG:-$ERPNEXT_VERSION}
  pull_policy: ${PULL_POLICY:-always}
  restart: ${RESTART_POLICY:-unless-stopped}
```

Used by: **all Frappe application services** (configurator, backend, frontend, websocket, queue workers, scheduler).

Sets the shared image reference and restart policy. Any service using `<<: *customizable_image` inherits all three fields.

#### `x-backend-defaults` (`&backend_defaults`)

```yaml
x-backend-defaults: &backend_defaults
  <<: *customizable_image        # inherits image, pull_policy, restart
  volumes:
    - sites:/home/frappe/frappe-bench/sites
  platform: linux/amd64
```

Used by: **backend services only** (configurator, backend, queue-short, queue-long, scheduler).

Adds two things on top of `customizable_image`:
- **`volumes`** — mounts the shared `sites` Docker volume. This volume holds `common_site_config.json`, site data, and `apps.txt`. It is the single source of truth that all backend services read.
- **`platform: linux/amd64`** — forces x86-64 emulation. Required because `frappe/erpnext` images are built for `amd64`; on Apple Silicon (M1/M2/M3), Docker Desktop runs these via Rosetta 2 transparently.

> **Note:** `frontend` and `websocket` do **not** use `*backend_defaults` — they use the lighter `*customizable_image` anchor. The `websocket` service mounts `sites/` directly in its own `volumes:` block.

---

### Services

#### `configurator` ⚙️

**Purpose:** One-time setup task that runs on first `docker compose up`. It writes `common_site_config.json` with the correct Docker service hostnames for the database and Redis. Without this, every Frappe service defaults to `127.0.0.1` — which doesn't work in a Docker network where services are reached by name.

```yaml
configurator:
  <<: *backend_defaults
  restart: "no"
  entrypoint: [bash, -c]
  command:
    - |
      set -e
      # 1. Wait for all three Redis services to accept connections
      until python3 -c "import socket; s=socket.create_connection(('redis-cache',6379),2)..."
      # 2. Write apps.txt (list of installed Frappe apps)
      ls -1 /home/frappe/frappe-bench/apps > /home/frappe/frappe-bench/sites/apps.txt
      # 3. Write common_site_config.json via Python heredoc
      python3 - <<'PYEOF'
        ...writes db_host, redis_cache, redis_queue, redis_socketio, socketio_port, chromium_path...
      PYEOF
      sleep infinity
  healthcheck:
    test: python3 -c "... assert 'redis-socketio' in cfg['redis_socketio'] ..."
    interval: 5s
    retries: 30
    start_period: 15s
```

**Key design decisions:**

| Decision | Reason |
|---|---|
| Uses `python3` heredoc instead of `bench set-config` | The `frappe/erpnext` production image blocks `bench` CLI commands at container startup. `python3` is unrestricted and reads/writes JSON natively. |
| `restart: "no"` | Configurator is a one-shot task. If it fails, a visible error is better than a silent restart loop. The `sleep infinity` at the end keeps it alive for health checks after setup completes. |
| Polls Redis with `python3 -c socket.create_connection(...)` | Avoids `nc` (not always installed) and doesn't require `bash` builtins. Pure Python, guaranteed available. |
| `healthcheck` using `python3` JSON parse | Verifies the config file was **actually written with the correct content** — not just that the file exists. A `grep`-based check could pass on a partially written file. |
| 30 retries × 5s interval + 15s start_period = ~165s max wait | Gives ample time for the image to pull and Redis to start, especially on slow connections or cold starts. |

**Files written by this service:**

- `/home/frappe/frappe-bench/sites/apps.txt` — newline-separated list of installed apps, read by `bench` to know which apps are active.
- `/home/frappe/frappe-bench/sites/common_site_config.json` — global Frappe configuration shared across all sites.

---

#### `backend` 🖥️

**Purpose:** Runs the Frappe/ERPNext WSGI application server (gunicorn) on port `8000`. Handles all HTTP API requests.

```yaml
backend:
  <<: *backend_defaults
  depends_on:
    configurator:
      condition: service_healthy
```

The `depends_on: configurator: service_healthy` ensures the WSGI server only starts after `common_site_config.json` has been written with the correct database and Redis hostnames.

---

#### `frontend` 🌐

**Purpose:** NGINX reverse proxy. Routes HTTP requests to either `backend:8000` (API/page requests) or `websocket:9000` (real-time WebSocket connections).

```yaml
frontend:
  <<: *customizable_image
  command: nginx-entrypoint.sh
  environment:
    BACKEND: backend:8000
    SOCKETIO: websocket:9000
  depends_on:
    - backend
    - websocket
```

No `platform: linux/amd64` — this service uses `*customizable_image` (not `*backend_defaults`), so it inherits whichever platform Docker resolves for the image. NGINX itself is architecture-agnostic.

---

#### `websocket` 🔌

**Purpose:** Runs Frappe's real-time push notification service (`socketio.js` / `realtime/index.js`) on port `9000`. Used for live updates in the ERPNext UI (notifications, form updates, etc.).

```yaml
websocket:
  <<: *customizable_image
  command: node /home/frappe/frappe-bench/apps/frappe/socketio.js
  environment:
    REDIS_CACHE: redis-cache:6379
    REDIS_QUEUE: redis-queue:6379
    REDIS_SOCKETIO: redis-socketio:6379
  volumes:
    - sites:/home/frappe/frappe-bench/sites
  depends_on:
    redis-socketio:
      condition: service_started
    configurator:
      condition: service_healthy
```

**Critical:** `realtime/index.js` reads its Redis connection string from `common_site_config.json` at startup — **not** from the environment variables shown above. The env vars are present for compatibility but the live code reads the file. This is why `depends_on: configurator: service_healthy` is essential.

---

#### `queue-short` and `queue-long` 📋

**Purpose:** Background job workers. Frappe queues tasks via Redis; these workers pick them up and execute them.

- `queue-short` — handles `short` and `default` priority jobs (quick operations, emails, etc.)
- `queue-long` — handles `long`, `default`, and `short` priority jobs (reports, bulk operations, imports)

```yaml
queue-short:
  <<: *backend_defaults
  command: bench worker --queue short,default
  depends_on:
    backend:
      condition: service_started
    redis-queue:
      condition: service_started
```

Workers inherit `common_site_config.json` (via the shared `sites` volume from `backend_defaults`) which has the Redis queue URL. They start after `backend` and `redis-queue` are up.

---

#### `scheduler` ⏰

**Purpose:** Runs Frappe's cron-like task scheduler. Triggers periodic jobs defined in app hooks (e.g., nightly reports, scheduled email digests).

```yaml
scheduler:
  <<: *backend_defaults
  command: bench schedule
  depends_on:
    backend:
      condition: service_started
    redis-cache:
      condition: service_started
```

---

#### Redis Services 🗄️

Three separate Redis instances are used to isolate concerns:

| Service | Port | Purpose |
|---|---|---|
| `redis-cache` | 6379 | Frappe page/object cache. Cleared when deploying new code. |
| `redis-queue` | 6379 | Background job queue (RQ). Stores pending and failed jobs. |
| `redis-socketio` | 6379 | Pub/sub channel for real-time WebSocket push events. |

All three use `redis:7-alpine` (minimal Alpine-based image) with `restart: always` — they should always be running as they are foundational infrastructure.

> **Why three separate instances?** Isolation prevents a cache flush from losing queued jobs, and a queue backlog from impacting real-time events.

---

### Volumes

```yaml
volumes:
  sites:
```

A single named Docker volume called `sites` is mounted at `/home/frappe/frappe-bench/sites` in every backend container. It persists:

- `common_site_config.json` — global config written by `configurator`
- `apps.txt` — list of installed apps
- `assets/` — compiled frontend assets
- Per-site directories (e.g., `mysite.localhost/`) containing site-specific config, uploaded files, and backups

> **Important:** Do not use `docker compose down -v` unless you intend to wipe all site data. Use `docker compose down` (without `-v`) to preserve the volume.

---

## `pwd.yml` — Disposable Demo Stack

This file is a **self-contained stack** designed for quick evaluation or QA automation where a persistent database is not required. Unlike `compose.yaml`, it does not require overrides for basic functionality.

### Key Differences from Main Stack

| Feature | `compose.yaml` | `pwd.yml` |
|---|---|---|
| Infrastructure | Split across files/overrides | All-in-one file |
| Database | MariaDB 11.8 (via override) | MariaDB 10.6 (built-in) |
| Site Creation | Manual (`bench new-site`) | Automatic (`create-site` service) |
| Best Use Case | Long-lived dev/prod | Disposable CI/QA automation |

### Special Services in `pwd.yml`

#### `create-site` 🏗️
Automatically creates a new ERPNext site once the database and Redis services are healthy. 
- **Admin Password**: `admin`
- **Default Site Name**: `frontend` (internally resolved)

---

## `overrides/` — Compose Override Files

Override files are layered on top of `compose.yaml` using `-f` flags:

```bash
docker compose -f compose.yaml -f overrides/compose.mariadb.yaml up
```

### `compose.mariadb.yaml`
Adds a `db` MariaDB 11.8 service with a health check. The `configurator` service gets a `depends_on: db: service_healthy` entry so it waits for the database to be ready before writing config. Most production setups use this overlay.

### `compose.redis.yaml`
Alternative Redis setup using Redis 6.2 (older than the built-in Redis 7 in `compose.yaml`). Includes persistent volume for `redis-queue`. Use this if you need Redis data persistence across restarts.

### `compose.proxy.yaml` / `compose.traefik.yaml`
Adds a Traefik reverse proxy in front of the `frontend` service. Required for HTTPS and multi-site setups. Not needed for local QA automation.

### `compose.https.yaml`
Adds Let's Encrypt SSL termination via Traefik. Requires `LETSENCRYPT_EMAIL` and a publicly resolvable domain.

### `compose.noproxy.yaml`
Exposes the frontend directly on the host port (no reverse proxy). Useful for simple local testing.

### `compose.multi-bench.yaml`
Allows multiple ERPNext sites on different domains on the same host.

---

## Startup Order & Dependency Graph

```
Redis services (redis-cache, redis-queue, redis-socketio)
        │
        ▼ (service_started)
  configurator  ──── writes common_site_config.json ────►  (healthcheck passes)
        │                                                          │
        │ service_healthy                           service_healthy│
        ▼                                                          ▼
     backend                                                  websocket
        │                                                          │
        │ service_started                           service_started│
        ▼                                                          ▼
queue-short, queue-long, scheduler                           frontend
```

**Key principle:** No service that reads `common_site_config.json` starts until `configurator` reports healthy. This is enforced through `depends_on: configurator: condition: service_healthy`.

---

## Change Log — What Was Fixed and Why

### Problem (March 2026)

The `websocket` service was failing at startup with:

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

This means `realtime/index.js` was trying to connect to Redis on `localhost` (127.0.0.1) instead of the Docker service `redis-socketio`. Inside a Docker network, services must be addressed by their service name — `localhost` resolves to the container itself, which has no Redis.

### Root Cause — Two Bugs Stacked

**Bug 1: `bench set-config` was silently failing.**

The original `configurator` used:
```yaml
entrypoint: [bash, -c]
command: |
  bench set-config -g redis_socketio "redis://redis-socketio:6379"
  ...
```

The `frappe/erpnext` production image has a built-in guard that blocks certain commands (`bash`, `bench`, etc.) when invoked directly as the container's process. The guard printed a warning and exited 0 without running the commands, so `common_site_config.json` stayed as `{}` (empty object).

**Bug 2: `websocket` had no dependency on `configurator`.**

Even if `bench set-config` had worked, `websocket` was not waiting for `configurator` to finish:

```yaml
# ORIGINAL — broken
websocket:
  depends_on:
    - redis-socketio    # only waited for Redis, not for config to be written
```

Since Docker starts services in parallel where possible, `websocket` started before `configurator` could write the Redis URL. `realtime/index.js` read the empty config and fell back to its hardcoded default: `127.0.0.1:6379`.

### Fix Applied (March 2026)

The resolution involved a dual-stack fix applied to both `compose.yaml` and `pwd.yml`.

#### 1. Redis Standardization
`pwd.yml` was upgraded from Redis 6.2 to **Redis 7-alpine**. This maintains parity with the main stack and prevents "Can't handle RDB format version 12" errors when switching between stacks.

#### 2. Robust Configurator (Python Heredoc)
Both stacks now use a Python-based configuration script instead of `bench set-config`.
- **Why?** Production images block `bench` commands at startup. Python is unrestricted and more reliable for reading/writing JSON.
- **Fixed Bug:** Corrected `redis-socketio` connection in `pwd.yml` which was incorrectly pointing to `redis-queue`.

#### 3. Health-Based Dependency Graph
Services like `websocket` and `backend` now wait for `configurator: service_healthy` before starting. This guarantees `common_site_config.json` is fully written before the application tries to connect to services.

### Summary of All Changed Lines

| File | Change |
|---|---|
| `compose.yaml` | `configurator.entrypoint` changed from `[bash, -c]` + `bench set-config` → `[bash, -c]` + `python3 heredoc` |
| `compose.yaml` | Added `configurator.restart: "no"` |
| `compose.yaml` | Added `configurator.healthcheck` block |
| `compose.yaml` | Added `backend.depends_on.configurator: service_healthy` |
| `compose.yaml` | Added `websocket.depends_on.configurator: service_healthy` |
| `compose.yaml` | Converted `queue-short`, `queue-long`, `scheduler` `depends_on` from shorthand list to map syntax with explicit `condition: service_started` |

---

## How `common_site_config.json` Works

This JSON file is Frappe's global configuration store. It lives on the shared `sites` volume at:

```
/home/frappe/frappe-bench/sites/common_site_config.json
```

**Every** Frappe service (backend, workers, scheduler, websocket) reads this file at startup to know how to reach the database and Redis. There is no other mechanism — environment variables are **not** used for this in the production image.

### Expected content after `configurator` runs:

```json
{
  "db_host": "db",
  "db_port": 3306,
  "redis_cache": "redis://redis-cache:6379",
  "redis_queue": "redis://redis-queue:6379",
  "redis_socketio": "redis://redis-socketio:6379",
  "socketio_port": 9000,
  "chromium_path": "/usr/bin/chromium-headless-shell"
}
```

### To manually verify the config is correct:

```bash
docker exec erpnext-docker-configurator-1 \
  python3 -c "import json; print(json.dumps(json.load(open('/home/frappe/frappe-bench/sites/common_site_config.json')), indent=2))"
```

---

## Troubleshooting Reference

### `websocket` fails with `ECONNREFUSED 127.0.0.1:6379`

**Cause:** `common_site_config.json` was not written before `websocket` started.

**Check:** `docker logs erpnext-docker-configurator-1` — look for `"Config written:"`.

**Fix:** Ensure `configurator` is healthy before proceeding: `docker compose ps` should show `(healthy)` next to configurator.

---

### `configurator` is unhealthy

**Cause:** The Python script failed to write `common_site_config.json`.

**Check:**
```bash
docker logs erpnext-docker-configurator-1
docker exec erpnext-docker-configurator-1 \
  cat /home/frappe/frappe-bench/sites/common_site_config.json
```

**Common sub-causes:**
- `sites` volume is read-only or has a permission issue
- Redis services didn't come up within the 120-second polling timeout (network issues)

---

### `dependency failed to start: container ... is unhealthy`

When `backend` or `websocket` report this error, it means `configurator` failed its health check. See "configurator is unhealthy" above.

---

### Sites volume is empty / `apps.txt` missing

If `apps.txt` is missing, `bench` won't know which apps are installed.

```bash
docker exec erpnext-docker-configurator-1 \
  cat /home/frappe/frappe-bench/sites/apps.txt
```

If missing, restart the `configurator`:
```bash
docker compose restart configurator
```

---

### Full clean restart (wipes all data)

> ⚠️ **This deletes all site data, uploads, and configuration.**

```bash
docker compose down -v   # removes containers AND the sites volume
docker compose up
```

### Soft restart (preserves data)

```bash
docker compose down       # removes containers only — volume is preserved
docker compose up
```
