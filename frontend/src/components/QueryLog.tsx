import type { QueryLogEntry } from '../types'

interface QueryLogProps {
  queries: QueryLogEntry[]
}

function formatTime(ts: string) {
  if (!ts) return '--'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '--'
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function truncateDomain(domain: string, max = 40) {
  if (domain.length <= max) return domain
  return domain.slice(0, max - 3) + '...'
}

export function QueryLog({ queries }: QueryLogProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Live Query Log</h3>
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
          </span>
          <span className="text-[10px] text-muted">WebSocket connected</span>
        </div>
      </div>

      {/* Headers */}
      <div className="grid grid-cols-12 gap-2 table-header px-3">
        <span className="col-span-2">Time</span>
        <span className="col-span-3">Client</span>
        <span className="col-span-5">Domain</span>
        <span className="col-span-1 text-center">Type</span>
        <span className="col-span-1 text-right">Status</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
        {queries.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            Waiting for DNS queries...
          </div>
        ) : (
          queries.map((q, i) => (
            <div
              key={`${q.domain}-${i}`}
              className="grid grid-cols-12 gap-2 table-cell px-3 hover:bg-surface-lighter/50 transition-colors duration-150 log-row-enter text-xs"
            >
              <span className="col-span-2 text-muted font-mono">{formatTime(q.timestamp)}</span>
              <span className="col-span-3 text-muted font-mono">{q.client_ip}</span>
              <span className="col-span-5 text-text-primary font-mono truncate" title={q.domain}>
                {truncateDomain(q.domain)}
              </span>
              <span className="col-span-1 text-center text-muted font-mono text-[10px]">{q.query_type}</span>
              <span className="col-span-1 text-right">
                {q.blocked ? (
                  <span className="badge-red">BLOCKED</span>
                ) : (
                  <span className="badge-green">OK</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
