export interface QueryLogEntry {
  id: number
  timestamp: string
  client_ip: string
  domain: string
  query_type: string
  blocked: boolean
  duration_ms: number
}

export interface Stats {
  total_queries: number
  blocked_count: number
  blocked_pct: number
  top_domains: { domain: string; count: number }[]
  top_blocked_domains: { domain: string; count: number }[]
  top_clients: { client_ip: string; hostname?: string; count: number }[]
  top_blocked_clients: { client_ip: string; hostname?: string; count: number }[]
  query_types: { type: string; count: number }[]
  queries_last_24h: { hour: string; total: number; blocked: number; avg_duration_ms: number }[]
}

export interface DashboardData {
  stats: Stats
  blocklist_domains: number
  blocklist_updated: string
}

export interface WSMessage {
  type: 'query' | 'stats'
  data: QueryLogEntry | Stats
}
