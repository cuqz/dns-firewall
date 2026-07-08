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

function truncateDomain(domain: string, max = 48) {
  if (domain.length <= max) return domain
  return domain.slice(0, max - 3) + '...'
}

export function QueryLog({ queries }: QueryLogProps) {
  return (
    <div className="card animate-slide-up">
      <div className="card-inner p-0 overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-wire">
          <div>
            <h3 className="text-sm font-semibold text-ink">Live Query Log</h3>
            <p className="text-[11px] text-ink-muted mt-0.5">Real-time DNS resolution feed</p>
          </div>
          <div className="flex items-center gap-2">
            {/* live pulse indicator */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-[10px] text-ink-muted font-mono">WebSocket live</span>
          </div>
        </div>

        {/* column headers */}
        <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-surface-raised border-b border-wire">
          <span className="col-span-2 col-header">Time</span>
          <span className="col-span-3 col-header">Client</span>
          <span className="col-span-5 col-header">Domain</span>
          <span className="col-span-1 col-header text-center">Type</span>
          <span className="col-span-1 col-header text-right">Status</span>
        </div>

        {/* rows */}
        <div className="divide-y divide-wire/50 max-h-[560px] overflow-y-auto">
          {queries.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 rounded-xl bg-accent-muted border border-accent-border flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
              <p className="text-sm text-ink-secondary">Waiting for DNS queries</p>
              <p className="text-xs text-ink-muted mt-1">Queries will stream in real-time</p>
            </div>
          ) : (
            queries.map((q, i) => (
              <div
                key={`${q.domain}-${i}`}
                className={`grid grid-cols-12 gap-2 px-5 py-2.5 text-xs transition-colors duration-150 log-row-enter
                  ${q.blocked
                    ? 'hover:bg-danger/[0.04]'
                    : 'hover:bg-accent/[0.03]'
                  }`}
              >
                <span className="col-span-2 text-ink-muted font-mono">{formatTime(q.timestamp)}</span>
                <span className="col-span-3 text-ink-secondary font-mono">{q.client_ip}</span>
                <span className="col-span-5 text-ink font-mono truncate" title={q.domain}>
                  {truncateDomain(q.domain)}
                </span>
                <span className="col-span-1 text-center text-ink-muted font-mono text-[10px]">{q.query_type}</span>
                <span className="col-span-1 text-right">
                  {q.blocked
                    ? <span className="badge-blocked">BLOCK</span>
                    : <span className="badge-ok">OK</span>
                  }
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
