<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/cuqz/dns-firewall/master/assets/logo-dark.svg">
    <img alt="DeepDNS" src="https://raw.githubusercontent.com/cuqz/dns-firewall/master/assets/logo-light.svg" width="360">
  </picture>
</p>

<p align="center">
  <b>Network-wide ad and tracker blocking DNS server</b><br>
  Go backend · React dashboard · 200K+ blocked domains
</p>

<p align="center">
  <a href="https://github.com/cuqz/dns-firewall"><img src="https://img.shields.io/badge/Open%20Source-MIT-blue" alt="License"></a>
  <a href="https://go.dev"><img src="https://img.shields.io/badge/Built%20with-Go-00ADD8" alt="Go"></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/Frontend-React-61DAFB" alt="React"></a>
  <a href="https://github.com/cuqz/dns-firewall/releases"><img src="https://img.shields.io/github/v/release/cuqz/dns-firewall" alt="Release"></a>
</p>

---

## What is DeepDNS?

DeepDNS is a **network-wide DNS firewall** that blocks ads, trackers, and malware domains at the router level. Every device on your network gets protected — no browser extensions, no app installs, no configuration per device.

Just set your router's DNS once and forget it.

### DeepDNS vs Alternatives

| | **DeepDNS** | Pi‑hole | AdGuard Home |
|---|---|---|---|
| **Size** | ~15 MB binary | Requires PHP + SQLite | ~30 MB binary |
| **Setup** | One binary, one flag | Full LAMP stack | Docker compose |
| **Dashboard** | React SPA, real‑time | PHP web interface | Go web interface |
| **Blocklist** | 1Hosts Lite, auto‑update | Manual list management | Built‑in updater |
| **License** | MIT (free) | GPL (free) | AGPL (free) |

---

## Features

### DNS-Level Blocking

Intercepts DNS queries at the network level. Ads, trackers, and malware domains never reach your devices. The 200K+ domain blocklist updates automatically from 1Hosts Lite.

### Real-Time Dashboard

Live query log with per-client breakdown. See which domains are being queried, which are blocked, and which devices are making the requests — all in real time via WebSocket.

### Query Analytics

Track total queries, blocked percentage, top domains, and top clients over 24 hours. Charts update live with no page refresh.

### Per-Client Block Stats

See which devices trigger the most blocked domains — with real device hostnames and IPs. Identify infected or ad-heavy devices on your network at a glance.

### Automatic Blocklist Updates

Downloads the latest 1Hosts Lite blocklist on startup. No manual list management required.

---

## Quick Start

```bash
# Run locally (no Docker, no install)
cd backend && go run . --dns-addr :8053 --api-addr :8080
```

Dashboard at `http://localhost:8080`. Set your device DNS to `localhost` port 8053.

### Docker

```bash
docker compose up -d
```

---

## Deploy

| Provider | Region | DNS | Dashboard | Status |
|---|---|---|---|---|
| **AWS EC2** | Cape Town (af‑south‑1) | `15.240.37.146` | `http://15.240.37.146:8080` | Live |
| **Fly.io** | Amsterdam | — | `https://dns-firewall.fly.dev` | Live |
| **Oracle Cloud** | Johannesburg | — | — | Pending capacity |
| **Local** | Your machine | `:8053` | `:8080` | Dev |

---

## Router Setup

Set your router's primary DNS to `15.240.37.146`. Secondary to `1.1.1.1`.

### ASUS

```
Advanced Settings → WAN → Internet Connection
WAN DNS Setting → DNS Server1: 15.240.37.146
WAN DNS Setting → DNS Server2: 1.1.1.1
Apply
```

### Other routers

The setting is usually under **Internet/WAN** → **DNS Server** in your router's admin panel.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Go, [miekg/dns](https://github.com/miekg/dns), [modernc.org/sqlite](https://modernc.org/sqlite) |
| Frontend | React, TypeScript, Vite, Recharts |
| Blocklist | [1Hosts Lite](https://github.com/badmojr/1Hosts) (70K+ domains) |
| Deploy | Docker, AWS EC2, Fly.io |

---

<p align="center">
  <b>DeepDNS</b> · MIT License<br>
  <sub>Block ads at the network level. One DNS change. Every device.</sub>
</p>
