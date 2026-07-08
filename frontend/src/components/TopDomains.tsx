import { Globe } from 'lucide-react'

interface TopDomainsProps {
  domains: { domain: string; count: number }[]
}

export function TopDomains({ domains }: TopDomainsProps) {
  const maxCount = Math.max(...domains.map((d) => d.count), 1)

  return (
    <div className="card animate-slide-up" style={{ animationDelay: '0.05s' }}>
      <div className="card-inner">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-muted border border-accent-border flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-ink leading-none">Top Domains</h3>
              <p className="text-[10px] text-ink-muted mt-0.5">Last 24 hours</p>
            </div>
          </div>
          <span className="eyebrow">{domains.length} total</span>
        </div>

        {domains.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-muted">No data yet</div>
        ) : (
          <div className="space-y-3">
            {domains.map((d, i) => (
              <div key={d.domain} className="group">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-[10px] text-ink-ghost font-mono w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-xs text-ink font-mono flex-1 truncate" title={d.domain}>{d.domain}</span>
                  <span className="text-[11px] text-ink-secondary font-mono font-medium shrink-0">{d.count.toLocaleString()}</span>
                </div>
                <div className="bar-track ml-7">
                  <div
                    className="bar-fill-accent"
                    style={{ width: `${(d.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
