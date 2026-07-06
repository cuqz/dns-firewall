import { Globe } from 'lucide-react'

interface TopDomainsProps {
  domains: { domain: string; count: number }[]
}

export function TopDomains({ domains }: TopDomainsProps) {
  const maxCount = Math.max(...domains.map((d) => d.count), 1)

  return (
    <div className="card group">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-md bg-accent/10 border border-accent/15 flex items-center justify-center">
          <Globe className="w-3.5 h-3.5 text-accent" />
        </span>
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Top Domains (24h)</h3>
      </div>
      {domains.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted">No data yet</div>
      ) : (
        <div className="space-y-2">
          {domains.map((d) => (
            <div key={d.domain} className="flex items-center gap-3 py-1">
              <span className="text-xs text-text-primary font-mono truncate flex-1" title={d.domain}>
                {d.domain}
              </span>
              <span className="text-[10px] text-muted w-8 text-right shrink-0">{d.count}</span>
              <div className="w-16 h-1.5 bg-surface-lighter rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-[#31929A] rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
