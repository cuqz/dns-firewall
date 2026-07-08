import { useState, useMemo } from 'react'
import { useDashboard, useWebSocket } from './hooks/useWebSocket'
import { Shield, Activity, Ban, Globe, Monitor } from 'lucide-react'

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// bit of a hack — hostnames like "102-220-210-250" are ISP PTR records, not real device names
function friendlyName(hostname: string | undefined, ip: string): string {
  if (!hostname || hostname === ip) return ip
  // Skip PTR-style names that look like dashes-in-ip (ISP assigned, not device name)
  if (/^\d{1,3}(-\d{1,3}){3}/.test(hostname)) return ip
  // Skip .local suffix — just show device name
  const parts = hostname.split('.')
  return parts[0] || hostname
}

function Dd({ v, set, opts }: { v: number; set: (n: number) => void; opts: { v: number; l: string }[] }) {
  return (
    <select value={v} onChange={e => set(Number(e.target.value))}
      className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded text-sm text-[#e8e8ee] px-3 py-1.5 outline-none cursor-pointer hover:border-[rgba(74,158,255,0.3)] transition-colors"
    >
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  )
}

export default function App() {
  const { data, error } = useDashboard()
  const { queries } = useWebSocket()
  const stats = data?.stats
  const [tab, setTab] = useState<'overview' | 'log'>('overview')

  const now = new Date()
  const today = now.getDate()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  // Restrict to: min = 7 days ago or install date, max = today
  const minDate = new Date(now)
  minDate.setDate(minDate.getDate() - 7)
  const minDay = minDate.getDate()
  const minMonth = minDate.getMonth()
  const minYear = minDate.getFullYear()
  const minTs = minDate.getTime()

  const [fd, setFd] = useState(today)
  const [fm, setFm] = useState(thisMonth)
  const [fy, setFy] = useState(thisYear)

  // Clamp date — never future, never before min
  const clamp = (d: number, m: number, y: number) => {
    const ts = new Date(y, m, d).getTime()
    if (ts > now.getTime()) { setFd(today); setFm(thisMonth); setFy(thisYear); return }
    if (ts < minTs) { setFd(minDay); setFm(minMonth); setFy(minYear); return }
  }

  const handleDay = (d: number) => { setFd(d); clamp(d, fm, fy) }
  const handleMonth = (m: number) => { const dim = new Date(fy, m + 1, 0).getDate(); setFd(Math.min(fd, dim)); setFm(m); clamp(Math.min(fd, dim), m, fy) }
  const handleYear = (y: number) => { setFy(y); clamp(fd, fm, y) }

  const qs = useMemo(() => queries.filter(q => {
    const d = new Date(q.timestamp)
    return d.getDate() === fd && d.getMonth() === fm && d.getFullYear() === fy
  }), [queries, fd, fm, fy])

  const dim = new Date(fy, fm + 1, 0).getDate()
  const days = Array.from({ length: dim }, (_, i) => i + 1)
  const years = Array.from({ length: 2 }, (_, i) => now.getFullYear() - 1 + i)

  if (error) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center max-w-sm px-8">
        <Shield className="w-10 h-10 text-[#4a9eff]/50 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-[#e8e8ee] mb-2">Cannot connect</h2>
        <p className="text-sm text-[#888]">Make sure the DNS Firewall is running and refresh.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="border-b border-[rgba(255,255,255,0.06)] bg-[#0d0d14]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <picture>
                <source srcSet="/logo-dark.png" media="(prefers-color-scheme: dark)" />
                <img src="/logo-light.png" alt="DeepDNS" className="h-9 w-auto" />
              </picture>
            </div>
            <div className="flex items-center gap-4">
              {stats && (
                <div className="hidden sm:flex items-center gap-3 text-xs text-[#888] font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                    Active
                  </span>
                  <span className="opacity-30">|</span>
                  <span>{data?.blocklist_domains?.toLocaleString() ?? '—'} blocked</span>
                </div>
              )}
              <div className="flex items-center bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-lg overflow-hidden">
                <button onClick={() => setTab('overview')} className={`px-4 py-1.5 text-sm font-medium transition-all ${tab === 'overview' ? 'bg-[#4a9eff] text-white' : 'text-[#888] hover:text-[#e8e8ee]'}`}>Overview</button>
                <button onClick={() => setTab('log')} className={`px-4 py-1.5 text-sm font-medium transition-all ${tab === 'log' ? 'bg-[#4a9eff] text-white' : 'text-[#888] hover:text-[#e8e8ee]'}`}>Log</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-slide-in">
        {tab === 'overview' && stats && <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { l: 'Total Queries', v: stats.total_queries.toLocaleString(), icon: Activity, c: 'text-[#4a9eff]' },
              { l: 'Blocked', v: stats.blocked_count.toLocaleString(), icon: Ban, c: 'text-[#f85149]', s: `${stats.blocked_pct.toFixed(1)}% of traffic` },
              { l: 'Blocklist', v: data?.blocklist_domains?.toLocaleString() ?? '—', icon: Shield, c: 'text-[#4a9eff]' },
              { l: 'Block Rate', v: `${stats.blocked_pct.toFixed(1)}%`, icon: Activity, c: 'text-[#f0883e]', s: `${stats.blocked_count} blocked` },
            ].map(item => {
              const Icon = item.icon
              return (
                <div key={item.l} className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5 hover:border-[rgba(74,158,255,0.15)] transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${item.c}`} />
                    <span className="text-xs text-[#888] uppercase tracking-wider font-medium">{item.l}</span>
                  </div>
                  <p className="text-2xl font-semibold text-[#e8e8ee]">{item.v}</p>
                  {item.s && <p className="text-[11px] text-[#888] mt-1">{item.s}</p>}
                </div>
              )
            })}
          </div>

          {/* Chart with date filter */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888]">Query Volume</h3>
              <div className="flex items-center gap-2">
                <Dd v={fd} set={handleDay} opts={days.map(d => ({ v: d, l: String(d).padStart(2, '0') }))} />
                <Dd v={fm} set={handleMonth} opts={months.map((m, i) => ({ v: i, l: m }))} />
                <Dd v={fy} set={handleYear} opts={years.map(y => ({ v: y, l: String(y) }))} />
              </div>
            </div>
            {stats.queries_last_24h?.length ? (
              <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
                <div className="h-44 flex items-end gap-[2px]">
                  {stats.queries_last_24h.map((b, i) => {
                    const mx = Math.max(...stats.queries_last_24h.map(x => x.total), 1)
                    const h = mx > 0 ? (b.total / mx) * 100 : 0
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end h-full relative group">
                        <div className="w-full bg-[#1a1a24] rounded-t" style={{ height: `${h}%` }}>
                          <div className="absolute inset-x-0 bottom-0 bg-[#f85149]/60" style={{ height: `${b.blocked > 0 ? (b.blocked / b.total) * 100 : 0}%` }} />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 text-[10px] text-[#e8e8ee] whitespace-nowrap transition-opacity pointer-events-none z-10">
                          {b.total} req · {b.blocked} blocked
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[11px] text-[#888]">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#1a1a24]" /> Allowed</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#f85149]/60" /> Blocked</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl py-12 text-center">
                <p className="text-sm text-[#888]">No data for this period</p>
              </div>
            )}
          </div>

          {/* Bottom */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-4 h-4 text-[#4a9eff]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888]">Top Clients</h3>
              </div>
              {stats.top_clients?.length ? (
                <div className="space-y-2">
                  {stats.top_clients.map((c, i) => {
                    const mx = Math.max(...stats.top_clients.map(x => x.count), 1)
                    const name = friendlyName(c.hostname, c.client_ip)
                    return (
                      <div key={c.client_ip} className="flex items-center gap-3 py-1.5">
                        <span className="w-5 text-[10px] text-[#888] font-mono text-right shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#e8e8ee] truncate flex items-center gap-2">
                            {name !== c.client_ip ? (
                              <><span className="font-medium">{name}</span><span className="text-[#888] text-[11px] font-mono">{c.client_ip}</span></>
                            ) : (
                              <span className="font-mono text-sm">{c.client_ip}</span>
                            )}
                          </div>
                          <div className="w-full h-1 bg-[#1a1a24] rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-[#4a9eff]/60 rounded-full" style={{ width: `${(c.count / mx) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-[#e8e8ee] font-mono w-10 text-right">{c.count}</span>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-sm text-[#888] py-8 text-center">No data yet</p>}
            </div>
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-[#888]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888]">Top Domains</h3>
              </div>
              {stats.top_domains?.length ? (
                <div className="space-y-2">
                  {stats.top_domains.map((d, i) => {
                    const mx = Math.max(...stats.top_domains.map(x => x.count), 1)
                    return (
                      <div key={d.domain} className="flex items-center gap-3 py-1.5">
                        <span className="w-5 text-[10px] text-[#888] font-mono text-right shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#e8e8ee] font-mono truncate">{d.domain}</div>
                          <div className="w-full h-1 bg-[#1a1a24] rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-[#888]/40 rounded-full" style={{ width: `${(d.count / mx) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-[#e8e8ee] font-mono w-10 text-right">{d.count}</span>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-sm text-[#888] py-8 text-center">No data yet</p>}
            </div>
          </div>

          {/* Blocked by device */}
          {stats.top_blocked_clients?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888] mb-4">Blocked by Device</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {stats.top_blocked_clients.map(c => {
                  const mx = Math.max(...stats.top_blocked_clients.map(x => x.count), 1)
                  const name = friendlyName(c.hostname, c.client_ip)
                  return (
                    <div key={c.client_ip} className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 hover:border-[rgba(248,81,73,0.2)] transition-all">
                      <div className="text-sm text-[#e8e8ee] font-medium truncate">{name}</div>
                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-xl font-bold text-[#f85149]">{c.count}</span>
                        <span className="text-xs text-[#888]">blocked</span>
                      </div>
                      <div className="w-full h-1 bg-[#1a1a24] rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-[#f85149] rounded-full" style={{ width: `${(c.count / mx) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>}

        {tab === 'log' && <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888]">Live Query Log</h3>
            <div className="flex items-center gap-3">
              <Dd v={fd} set={handleDay} opts={days.map(d => ({ v: d, l: String(d).padStart(2, '0') }))} />
              <Dd v={fm} set={handleMonth} opts={months.map((m, i) => ({ v: i, l: m }))} />
              <Dd v={fy} set={handleYear} opts={years.map(y => ({ v: y, l: String(y) }))} />
              <span className="text-xs text-[#888] font-mono">{qs.length} entries</span>
            </div>
          </div>
          <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {qs.length === 0 ? (
                <div className="py-16 text-center text-sm text-[#888]">No queries for this date</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] text-[#888] font-mono uppercase tracking-wider border-b border-[rgba(255,255,255,0.06)]">
                      <th className="text-left px-5 py-3 w-20">Status</th>
                      <th className="text-left px-2 py-3">Domain</th>
                      <th className="text-left px-2 py-3 w-16">Type</th>
                      <th className="text-left px-2 py-3 w-36 hidden sm:table-cell">Client</th>
                      <th className="text-right px-5 py-3 w-16">Ms</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                    {qs.map(q => (
                      <tr key={q.id} className={`text-sm transition-colors ${q.blocked ? 'hover:bg-[rgba(248,81,73,0.04)]' : 'hover:bg-[rgba(74,158,255,0.03)]'}`}>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider font-mono ${
                            q.blocked ? 'text-[#f85149] bg-[rgba(248,81,73,0.1)] border border-[rgba(248,81,73,0.2)]' : 'text-[#22c55e] bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)]'
                          }`}>
                            {q.blocked ? 'blocked' : 'allowed'}
                          </span>
                        </td>
                        <td className="px-2 py-3 font-mono text-[#e8e8ee] max-w-[300px] truncate">{q.domain}</td>
                        <td className="px-2 py-3 text-[#888] text-xs font-mono">{q.query_type}</td>
                        <td className="px-2 py-3 text-[#888] text-xs font-mono truncate hidden sm:table-cell">{q.client_ip}</td>
                        <td className="px-5 py-3 text-[#888] text-xs font-mono text-right">{q.duration_ms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>}
      </main>
    </div>
  )
}
