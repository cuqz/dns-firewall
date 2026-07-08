import { Monitor } from 'lucide-react'

interface TopClientsProps {
  clients: { client_ip: string; count: number }[]
}

function ipSuffix(ip: string) {
  return ip.split('.').pop() ?? '?'
}

export function TopClients({ clients }: TopClientsProps) {
  const maxCount = Math.max(...clients.map((c) => c.count), 1)

  return (
    <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <div className="card-inner">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-muted border border-accent-border flex items-center justify-center">
              <Monitor className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-ink leading-none">Top Clients</h3>
              <p className="text-[10px] text-ink-muted mt-0.5">By query volume</p>
            </div>
          </div>
          <span className="eyebrow">{clients.length} devices</span>
        </div>

        {clients.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-muted">No data yet</div>
        ) : (
          <div className="space-y-3">
            {clients.map((c, i) => (
              <div key={c.client_ip} className="group">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-[10px] text-ink-ghost font-mono w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <div className="w-6 h-6 rounded-full bg-surface-edge border border-wire flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-mono font-semibold text-ink-muted">{ipSuffix(c.client_ip)}</span>
                  </div>
                  <span className="text-xs text-ink font-mono flex-1 truncate">{c.client_ip}</span>
                  <span className="text-[11px] text-ink-secondary font-mono font-medium shrink-0">{c.count.toLocaleString()}</span>
                </div>
                <div className="bar-track ml-7">
                  <div className="bar-fill-accent" style={{ width: `${(c.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
