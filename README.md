<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/cuqz/dns-firewall/master/assets/logo.svg">
    <img alt="DeepDNS" src="https://raw.githubusercontent.com/cuqz/dns-firewall/master/assets/logo.svg" width="120">
  </picture>
</p>

<p align="center">
  <h1 align="center">DeepDNS ⚡</h1>
</p>

<p align="center">
  <b>Network-wide ad & tracker blocking DNS server</b><br>
  <sub>Go backend · React dashboard · 200K+ blocked domains · Real-time analytics</sub>
</p>

<p align="center">
  <a href="https://github.com/cuqz/dns-firewall/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square&labelColor=1a1a2e" alt="License"></a>
  <a href="https://go.dev"><img src="https://img.shields.io/badge/Go-1.23-00ADD8?style=flat-square&labelColor=1a1a2e&logo=go" alt="Go"></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&labelColor=1a1a2e&logo=react" alt="React"></a>
  <a href="https://github.com/cuqz/dns-firewall/releases"><img src="https://img.shields.io/github/v/release/cuqz/dns-firewall?style=flat-square&labelColor=1a1a2e" alt="Release"></a>
  <a href="https://github.com/cuqz/dns-firewall/stargazers"><img src="https://img.shields.io/github/stars/cuqz/dns-firewall?style=flat-square&labelColor=1a1a2e" alt="Stars"></a>
</p>

<p align="center">
  <a href="#-quick-start">🚀 Quick Start</a> •
  <a href="#-features">✨ Features</a> •
  <a href="#-comparison">📊 Comparison</a> •
  <a href="#-router-setup">📡 Router Setup</a> •
  <a href="#-stack">🛠 Stack</a>
</p>

---

## 📸 Dashboard

<p align="center">
  <img src="https://raw.githubusercontent.com/cuqz/dns-firewall/master/assets/mockup-dashboard.png" alt="DeepDNS Dashboard" width="800">
  <br>
  <em>Real-time query analytics, live log viewer, and blocklist management</em>
</p>

---

## 🚀 Quick Start

### Run locally (no Docker, no install)

```bash
git clone https://github.com/cuqz/dns-firewall.git
cd dns-firewall/backend
go run . --dns-addr :8053 --api-addr :8080
```

Dashboard at **`http://localhost:8080`**. Set your device DNS to `localhost:8053`.

### Docker

```bash
git clone https://github.com/cuqz/dns-firewall.git
cd dns-firewall
docker compose up -d
```

### Build from source

```bash
# Backend
cd backend && go build -o dns-firewall .

# Frontend
cd frontend && npm install && npm run build

# Run
./dns-firewall --dns-addr :53 --api-addr :8080 --frontend-dir ./frontend/dist
```

---

## ✨ Features

### 🛡️ DNS-Level Blocking
Intercepts DNS queries at the network level. Ads, trackers, and malware domains never reach your devices. The **200K+ domain blocklist** updates automatically from 1Hosts Lite on every restart.

### 📊 Real-Time Dashboard
Live query log with per-client breakdown. See which domains are being queried, which are blocked, and which devices are making the requests — all in real time via **WebSocket** streaming.

### 📈 Query Analytics
Track total queries, blocked percentage, top domains, and top clients. Interactive time-series charts with hourly, daily, and monthly granularity. All updates happen live with no page refresh.

### 🔍 Blocklist Lookup
Search the entire blocklist of 200K+ domains instantly. Check if any domain is blocked and see it in context.

### 📝 Live Query Log
Browse every DNS query in real time. Filter by allowed/blocked status, search by domain name, client IP, or query type. Color-coded status badges for instant recognition.

### 📱 Per-Client Insights
See which devices trigger the most blocked domains — with real device hostnames and IPs. Identify infected or ad-heavy devices on your network at a glance.

### 🔄 Automatic Updates
Downloads the latest 1Hosts Lite blocklist on startup. No manual list management, no cron jobs, no maintenance.

### 📦 Tiny Footprint
~15 MB single binary. No PHP, no MySQL, no heavy dependencies. Runs on any Linux server with Go support.

---

## 📊 DeepDNS vs Alternatives

| Feature | 🟢 **DeepDNS** | 🔵 Pi‑hole | 🟠 AdGuard Home |
|---|---|---|---|
| **Size** | ~15 MB single binary | Requires PHP + SQLite + lighttpd | ~30 MB binary |
| **Setup** | One binary, one flag | Full LAMP stack installation | Docker compose required |
| **Dashboard** | React SPA with WebSocket live updates | PHP web interface | Go web interface |
| **Blocklist** | 200K+ domains, auto‑updated | Manual list management | Built‑in updater |
| **Real-time** | Native WebSocket streaming | Polling-based | Polling-based |
| **CPU/RAM** | <20 MB idle | ~100 MB+ | ~50 MB+ |
| **Dark Mode** | ✅ Native dark theme | Requires custom CSS | ✅ Built-in |
| **License** | MIT — free & open source | GPL — free | AGPL — free |

---

## 📡 Router Setup

Set your router's primary DNS to your DeepDNS server IP. Every device on your network gets protected instantly — no browser extensions, no app installs, no config per device.

### ASUS Routers
```
Advanced Settings → WAN → Internet Connection
WAN DNS Setting → DNS Server1: <your-server-ip>
WAN DNS Setting → DNS Server2: 1.1.1.1
Apply → Reboot router
```

### TP-Link Routers
```
Network → WAN → Advanced Settings
Primary DNS: <your-server-ip>
Secondary DNS: 1.1.1.1
Save → Reboot
```

### Google Nest/Home
```
Wi-Fi → Settings → Advanced Networking → DNS
Select "Custom DNS"
Primary: <your-server-ip>
Secondary: 1.1.1.1
Save
```

### Other Routers
The setting is usually under **Internet/WAN → DNS Server** in your router's admin panel. Set the primary DNS to your DeepDNS server IP and secondary to `1.1.1.1`.

> **💡 Don't have a server?** Deploy on any cloud provider or a Raspberry Pi at home. See the [Deploy Guide](#-deploy).

---

## 🛠 Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | [Go](https://go.dev) + [miekg/dns](https://github.com/miekg/dns) | DNS server, query processing, blocklist management |
| **Database** | [SQLite](https://modernc.org/sqlite) (pure Go) | Query logs, analytics, persistent storage |
| **Frontend** | [React 18](https://react.dev) + [TypeScript](https://www.typescriptlang.org/) | Dashboard UI, real-time data visualization |
| **Charts** | [Recharts](https://recharts.org) | Interactive time-series and bar charts |
| **Icons** | [Lucide](https://lucide.dev) | Clean, consistent UI icons |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) + custom dark theme | Premium dark-mode dashboard |
| **Build** | [Vite](https://vitejs.dev) | Fast frontend builds and HMR |
| **Blocklist** | [1Hosts Lite](https://github.com/badmojr/1Hosts) | 200K+ ad, tracker, and malware domains |
| **Real-time** | WebSocket | Live query streaming to dashboard |

---

## 🚢 Deploy

### AWS EC2 (recommended)

```bash
# Launch t3.small or larger (t3.micro can't build Go)
# Security Group: open ports 53 (UDP), 8080 (TCP), 22 (SSH)

# SSH in and run:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs golang-go

git clone https://github.com/cuqz/dns-firewall.git
cd dns-firewall/backend
go build -o dns-firewall .

cd ../frontend
npm install && npm run build

# Run (port 53 needs root)
sudo ./dns-firewall --dns-addr :53 --api-addr :8080 --frontend-dir ./frontend/dist
```

### Raspberry Pi

```bash
# Same as above — Go and Node run fine on ARM
# Use port 53 for system-wide blocking
```

### Fly.io

```bash
# Deploy with fly.toml
fly launch
fly deploy
```

### Oracle Cloud (Free Tier)

```bash
# ARM instances in the free tier work well
# Use port 53 for system-wide DNS blocking
```

---

## ⚙️ Configuration

### Command-line flags

| Flag | Default | Description |
|---|---|---|
| `--dns-addr` | `:53` | DNS server listen address |
| `--api-addr` | `:8080` | HTTP API / dashboard address |
| `--frontend-dir` | `./frontend/dist` | Path to built frontend assets |
| `--db-path` | `./dns-firewall.db` | SQLite database path |
| `--blocklist-url` | (1Hosts Lite) | Custom blocklist URL |
| `--log-level` | `info` | Log level (debug, info, warn, error) |

---

## 🔧 Development

```bash
# Backend (with hot reload)
cd backend
go run . --dns-addr :8053 --api-addr :8080

# Frontend (with HMR + proxy to backend)
cd frontend
npm install
npm run dev
```

Frontend dev server at `http://localhost:5180` — proxies `/api` and `/ws` to the Go backend.

---

## 📄 License

**MIT License** — free to use, modify, and distribute. See [LICENSE](https://github.com/cuqz/dns-firewall/blob/main/LICENSE).

---

<p align="center">
  <a href="https://github.com/cuqz/dns-firewall"><img src="https://img.shields.io/badge/⭐ Star%20on%20GitHub-1a1a2e?style=for-the-badge" alt="Star on GitHub"></a>
  <a href="https://github.com/cuqz/dns-firewall/issues"><img src="https://img.shields.io/badge/🐛 Report%20Issue-1a1a2e?style=for-the-badge" alt="Report Issue"></a>
  <a href="https://github.com/cuqz/dns-firewall/discussions"><img src="https://img.shields.io/badge/💬 Start%20Discussion-1a1a2e?style=for-the-badge" alt="Start Discussion"></a>
</p>

<p align="center">
  <sub>Block ads at the network level. One DNS change. Every device protected.</sub>
  <br>
  <sub>Built with ❤️ by the open source community</sub>
</p>
