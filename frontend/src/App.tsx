import { useState } from 'react'
import { useDashboard, useWebSocket } from './hooks/useWebSocket'
import { StatsCard } from './components/StatsCard'
import { QueryLog } from './components/QueryLog'
import { TopDomains } from './components/TopDomains'
import { TopClients } from './components/TopClients'
import { TopBlockedClients } from './components/TopBlockedClients'
import { TimeChart } from './components/TimeChart'
import { Shield, Activity, Clock, ListFilter, Gauge } from 'lucide-react'

export default function App() {
  const { data } = useDashboard()
  const { queries } = useWebSocket()
  const [activeTab, setActiveTab] = useState<'overview' | 'queries' | 'blocklist'>('overview')

  const stats = data?.stats
  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: Gauge },
    { id: 'queries' as const, label: 'Live Log', icon: Clock },
    { id: 'blocklist' as const, label: 'Blocklist', icon: ListFilter },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-light/90 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-text-primary leading-tight">DNS Firewall</h1>
                <p className="text-[10px] text-muted">Network-level ad & tracker blocking</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-[10px] text-muted hidden sm:inline">
                {data ? `${data.blocklist_domains.toLocaleString()} blocked` : 'Active'}
              </span>
            </div>
          </div>

          <nav className="flex gap-1 -mb-px">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2.5 text-xs font-medium border-b-2 transition-all duration-200 ${
                    activeTab === item.id
                      ? 'border-accent text-text-primary'
                      : 'border-transparent text-muted hover:text-text-primary hover:border-border'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6 md:space-y-8 animate-slide-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                label="Total Queries (24h)"
                value={stats?.total_queries?.toLocaleString() ?? '—'}
                icon={Activity}
                trend={stats?.total_queries ? `${stats.blocked_count.toLocaleString()} blocked` : ''}
              />
              <StatsCard
                label="Blocked"
                value={stats?.blocked_count?.toLocaleString() ?? '—'}
                icon={Shield}
                variant="danger"
                trend={stats?.blocked_pct ? `${stats.blocked_pct.toFixed(1)}% of traffic` : ''}
              />
              <StatsCard
                label="Blocklist"
                value={data?.blocklist_domains?.toLocaleString() ?? '—'}
                icon={ListFilter}
                variant="blue"
                trend="domains on blocklist"
              />
              <StatsCard
                label="Block Rate"
                value={stats?.blocked_pct ? `${stats.blocked_pct.toFixed(1)}%` : '—'}
                icon={Activity}
                variant="warning"
                trend={stats?.blocked_count ? `${stats.blocked_count} requests blocked` : ''}
              />
            </div>

            {/* Chart */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Query Volume (24h)</h3>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-muted">Allowed</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-danger" />
                    <span className="text-muted">Blocked</span>
                  </span>
                </div>
              </div>
              <TimeChart data={stats?.queries_last_24h ?? []} />
            </div>

            {/* Bottom grid: domains, clients, blocked-by-device */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <TopDomains domains={stats?.top_domains ?? []} />
              <TopClients clients={stats?.top_clients ?? []} />
              <TopBlockedClients clients={stats?.top_blocked_clients ?? []} />
            </div>
          </div>
        )}

        {activeTab === 'queries' && (
          <div className="animate-slide-in">
            <QueryLog queries={queries} />
          </div>
        )}

        {activeTab === 'blocklist' && (
          <div className="animate-slide-in">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Blocked Domains</h3>
                <span className="text-[10px] text-muted">{data?.blocklist_domains?.toLocaleString() ?? '—'} domains</span>
              </div>
              <div className="text-xs text-muted">
                Blocklist loaded at startup. Add domains to <code className="text-accent">backend/blocklists/default.txt</code> and restart.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
