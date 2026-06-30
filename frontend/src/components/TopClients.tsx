import { Monitor } from 'lucide-react'

interface TopClientsProps {
  clients: { client_ip: string; count: number }[]
}

export function TopClients({ clients }: TopClientsProps) {
  const maxCount = Math.max(...clients.map((c) => c.count), 1)

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Monitor className="w-3.5 h-3.5 text-muted" />
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Top Clients (24h)</h3>
      </div>
      {clients.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted">No data yet</div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div key={c.client_ip} className="flex items-center gap-3">
              <span className="text-xs text-text-primary font-mono flex-1">{c.client_ip}</span>
              <span className="text-[10px] text-muted w-8 text-right">{c.count}</span>
              <div className="w-20 h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                <div
                  className="h-full bg-warning rounded-full transition-all duration-500"
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
