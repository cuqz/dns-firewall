import { ShieldOff } from 'lucide-react'

interface TopBlockedClientsProps {
  clients: { client_ip: string; count: number }[]
}

export function TopBlockedClients({ clients }: TopBlockedClientsProps) {
  const maxCount = Math.max(...clients.map((c) => c.count), 1)

  return (
    <div className="card group">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-md bg-danger/10 border border-danger/15 flex items-center justify-center">
          <ShieldOff className="w-3.5 h-3.5 text-danger" />
        </span>
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Blocked by Device</h3>
      </div>
      {clients.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted">No blocked queries yet</div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div key={c.client_ip} className="flex items-center gap-3 py-1">
              <span className="w-6 h-6 rounded-full bg-surface-lighter border border-border flex items-center justify-center shrink-0">
                <span className="text-[9px] font-semibold text-muted font-mono">
                  {c.client_ip.split('.').pop()}
                </span>
              </span>
              <span className="text-xs text-text-primary font-mono flex-1 truncate">{c.client_ip}</span>
              <span className="text-[10px] text-danger font-medium w-8 text-right">{c.count}</span>
              <div className="w-16 h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                <div
                  className="h-full bg-danger rounded-full transition-all duration-700 ease-out group-hover:opacity-80"
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
