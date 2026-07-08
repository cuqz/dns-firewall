import { Monitor } from 'lucide-react'

interface TopClientsProps {
  clients: { client_ip: string; hostname?: string; count: number }[]
}

export function TopClients({ clients }: TopClientsProps) {
  const maxCount = Math.max(...clients.map((c) => c.count), 1)

  return (
    <div className="card group">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-md bg-accent/10 border border-accent/15 flex items-center justify-center">
          <Monitor className="w-3.5 h-3.5 text-accent" />
        </span>
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Top Clients (24h)</h3>
      </div>
      {clients.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted">No data yet</div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div key={c.client_ip} className="flex items-center gap-3 py-1">
              <span className="w-6 h-6 rounded-full bg-surface-lighter border border-border flex items-center justify-center shrink-0">
                <span className="text-[9px] font-semibold text-muted font-mono">
                  {c.client_ip.split('.').pop()}
                </span>
              </span>
              <span className="text-xs text-text-primary flex-1 truncate">
                {c.hostname && c.hostname !== c.client_ip ? (
                  <>{c.hostname} <span className="text-text-muted">({c.client_ip})</span></>
                ) : (
                  <span className="font-mono">{c.client_ip}</span>
                )}
              </span>
              <span className="text-[10px] text-muted font-medium w-8 text-right">{c.count}</span>
              <div className="w-16 h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${(c.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
