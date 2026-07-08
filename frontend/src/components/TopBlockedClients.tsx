import { ShieldOff } from 'lucide-react'

interface TopBlockedClientsProps {
  clients: { client_ip: string; count: number }[]
}

function ipSuffix(ip: string) {
  return ip.split('.').pop() ?? '?'
}

export function TopBlockedClients({ clients }: TopBlockedClientsProps) {
  const maxCount = Math.max(...clients.map((c) => c.count), 1)

  return (
    <div className="card animate-slide-up" style={{ animationDelay: '0.15s' }}>
      <div className="card-inner">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-danger-muted border border-danger-border flex items-center justify-center">
              <ShieldOff className="w-3.5 h-3.5 text-danger" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-ink leading-none">Blocked by Device</h3>
              <p className="text-[10px] text-ink-muted mt-0.5">Highest block count</p>
            </div>
          </div>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.15em]"
            style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.15)', color: '#ff4757' }}
          >
            {clients.length} devices
          </span>
        </div>

        {clients.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-muted">No blocked queries yet</div>
        ) : (
          <div className="space-y-3">
            {clients.map((c, i) => (
              <div key={c.client_ip} className="group">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-[10px] text-ink-ghost font-mono w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <div className="w-6 h-6 rounded-full bg-danger-muted border border-danger-border flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-mono font-semibold text-danger">{ipSuffix(c.client_ip)}</span>
                  </div>
                  <span className="text-xs text-ink font-mono flex-1 truncate">{c.client_ip}</span>
                  <span className="text-[11px] text-danger font-mono font-medium shrink-0">{c.count.toLocaleString()}</span>
                </div>
                <div className="bar-track ml-7">
                  <div className="bar-fill-danger" style={{ width: `${(c.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
