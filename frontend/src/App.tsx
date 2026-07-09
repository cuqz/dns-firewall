import { useState, useMemo, useRef, useEffect } from 'react'
import { useDashboard, useWebSocket } from './hooks/useWebSocket'
import { Shield, Activity, Ban, Globe, Monitor, Search, X, Clock, AlertTriangle } from 'lucide-react'

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// bit of a hack — hostnames like "102-220-210-250" are ISP PTR records, not real device names
function friendlyName(hostname: string | undefined, ip: string): string {
  if (!hostname || hostname === ip) return ip
  if (/^\d{1,3}(-\d{1,3}){3}/.test(hostname)) return ip
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

// Skeleton components for loading state
function SkCard() {
  return (
    <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5 animate-pulse">
      <div className="h-3 w-20 bg-[#1a1a24] rounded mb-3" />
      <div className="h-7 w-28 bg-[#1a1a24] rounded" />
      <div className="h-2 w-16 bg-[#1a1a24] rounded mt-2" />
    </div>
  )
}

function SkBar({ i }: { i: number }) {
  const h = 20 + (i % 7) * 10
  return (
    <div className="flex-1 bg-[#1a1a24] rounded-t animate-pulse" style={{ height: `${h}%` }} />
  )
}

type RangePreset = 'day' | 'week' | 'month' | 'year' | 'all'

const presets: { key: RangePreset; label: string }[] = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
]

// Map preset → group_by param
function groupByForPreset(preset: RangePreset): string {
  switch (preset) {
    case 'day': return 'hour'
    case 'week':
    case 'month': return 'day'
    case 'year':
    case 'all': return 'month'
  }
}

// Format a period label based on group_by
function formatPeriod(period: string, groupBy: string): string {
  // period format: "2026-07-08T14:00:00Z" (hour) or "2026-07-08T00:00:00Z" (day) or "2026-07-01T00:00:00Z" (month)
  const d = new Date(period)
  if (isNaN(d.getTime())) return period
  switch (groupBy) {
    case 'month': {
      return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
    }
    case 'day': {
      return `${dayNames[d.getDay()]} ${d.getDate()}`
    }
    default: {
      const h = d.getHours()
      return `${String(h).padStart(2, '0')}:00`
    }
  }
}

export default function App() {
  const now = new Date()
  const today = now.getDate()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const [fd, setFd] = useState(today)
  const [fm, setFm] = useState(thisMonth)
  const [fy, setFy] = useState(thisYear)
  const [rangePreset, setRangePreset] = useState<RangePreset>('day')
  const currentGroupBy = groupByForPreset(rangePreset)

  const minDate = new Date(now)
  minDate.setDate(minDate.getDate() - 7)
  const minDay = minDate.getDate()
  const minMonth = minDate.getMonth()
  const minYear = minDate.getFullYear()
  const minTs = minDate.getTime()

  // Compute ISO timestamps from preset + date state
  const dateRange = useMemo(() => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const e = end.toISOString()

    switch (rangePreset) {
      case 'day': {
        const d = new Date(fy, fm, fd)
        const s = new Date(d); s.setHours(0, 0, 0, 0)
        const u = new Date(d); u.setHours(23, 59, 59, 999)
        return { since: s.toISOString(), until: u.toISOString() }
      }
      case 'week': {
        const s = new Date()
        s.setDate(s.getDate() - 6)
        s.setHours(0, 0, 0, 0)
        return { since: s.toISOString(), until: e }
      }
      case 'month': {
        const d = new Date()
        const s = new Date(d.getFullYear(), d.getMonth(), 1)
        s.setHours(0, 0, 0, 0)
        return { since: s.toISOString(), until: e }
      }
      case 'year': {
        const d = new Date()
        const s = new Date(d.getFullYear(), 0, 1)
        s.setHours(0, 0, 0, 0)
        return { since: s.toISOString(), until: e }
      }
      case 'all':
        return { since: '2020-01-01T00:00:00.000Z', until: e }
    }
  }, [rangePreset, fd, fm, fy])

  const { data, error, loading, lastRefresh } = useDashboard(dateRange.since, dateRange.until, currentGroupBy)
  const { queries } = useWebSocket()
  const stats = data?.stats
  const [tab, setTab] = useState<'overview' | 'log' | 'blocklist'>('overview')

  // Log search/filter state
  const [logSearch, setLogSearch] = useState('')
  const [logFilter, setLogFilter] = useState<'all' | 'allowed' | 'blocked'>('all')

  // Blocklist search state
  const [blQuery, setBlQuery] = useState('')
  const [blResults, setBlResults] = useState<string[]>([])
  const [blTotal, setBlTotal] = useState(0)
  const [blSearching, setBlSearching] = useState(false)
  const blTimer = useRef<number>(0)

  // Clamp date — never future, never before min
  const clamp = (d: number, m: number, y: number) => {
    const ts = new Date(y, m, d).getTime()
    if (ts > now.getTime()) { setFd(today); setFm(thisMonth); setFy(thisYear); return }
    if (ts < minTs) { setFd(minDay); setFm(minMonth); setFy(minYear); return }
  }

  const handleDay = (d: number) => { setFd(d); clamp(d, fm, fy) }
  const handleMonth = (m: number) => { const dim = new Date(fy, m + 1, 0).getDate(); setFd(Math.min(fd, dim)); setFm(m); clamp(Math.min(fd, dim), m, fy) }
  const handleYear = (y: number) => { setFy(y); clamp(fd, fm, y) }

  // Filter queries by selected date AND search/filter
  const qs = useMemo(() => {
    let filtered = queries.filter(q => {
      const d = new Date(q.timestamp)
      return d.getDate() === fd && d.getMonth() === fm && d.getFullYear() === fy
    })
    if (logFilter === 'allowed') filtered = filtered.filter(q => !q.blocked)
    if (logFilter === 'blocked') filtered = filtered.filter(q => q.blocked)
    if (logSearch.trim()) {
      const s = logSearch.toLowerCase()
      filtered = filtered.filter(q =>
        (q.domain || '').toLowerCase().includes(s) ||
        (q.client_ip || '').toLowerCase().includes(s) ||
        (q.query_type || '').toLowerCase().includes(s)
      )
    }
    return filtered
  }, [queries, fd, fm, fy, logSearch, logFilter])

  const dim = new Date(fy, fm + 1, 0).getDate()
  const days = Array.from({ length: dim }, (_, i) => i + 1)
  const years = Array.from({ length: 2 }, (_, i) => now.getFullYear() - 1 + i)

  // Blocklist search with debounce
  const searchBlocklist = (q: string) => {
    if (blTimer.current) clearTimeout(blTimer.current)
    if (!q.trim()) { setBlResults([]); setBlTotal(0); return }
    blTimer.current = window.setTimeout(async () => {
      setBlSearching(true)
      try {
        const res = await fetch('/api/blocklist?q=' + encodeURIComponent(q))
        const json = await res.json()
        setBlResults(json.results || [])
        setBlTotal(json.total || 0)
      } catch {}
      setBlSearching(false)
    }, 300)
  }

  // Live clock — updates every second
  const [clock, setClock] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const localTime = clock.toLocaleTimeString()
  const lastRefreshed = lastRefresh?.toLocaleTimeString() ?? null

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
              <a href="/" className="flex items-center gap-3 group">
                <img src="/favicon.svg" alt="DeepDNS" className="h-8 w-8" />
                <span className="text-base font-semibold text-[#e8e8ee] tracking-tight">DeepDNS</span>
              </a>
            </div>
            <div className="flex items-center gap-4">
              {stats && (
                <div className="hidden sm:flex items-center gap-3 text-xs text-[#888] font-mono">
                  <span className="flex items-center gap-1.5" title="Your local time">
                    <Clock className="w-3 h-3" />
                    {localTime}
                  </span>
                  <span className="opacity-30">|</span>
                  {lastRefreshed && (
                    <span className="text-[#555]">Refreshed {lastRefreshed}</span>
                  )}
                  <span className="opacity-30">|</span>
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
                <button onClick={() => setTab('blocklist')} className={`px-4 py-1.5 text-sm font-medium transition-all ${tab === 'blocklist' ? 'bg-[#4a9eff] text-white' : 'text-[#888] hover:text-[#e8e8ee]'}`}>Blocklist</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-slide-in">

        {/* ======= OVERVIEW TAB ======= */}
        {tab === 'overview' && <>

          {/* Full loading skeleton */}
          {loading && !stats && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SkCard /><SkCard /><SkCard /><SkCard />
              </div>
              <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
                <div className="h-44 flex items-end gap-[2px]">
                  {Array.from({ length: 24 }, (_, i) => <SkBar key={i} i={i} />)}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5 space-y-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="h-10 bg-[#1a1a24] rounded animate-pulse" />
                  ))}
                </div>
                <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5 space-y-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="h-10 bg-[#1a1a24] rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subtle loading pulse on preset switch */}
          {loading && stats && (
            <div className="fixed top-4 right-4 z-50">
              <div className="flex items-center gap-2 bg-[#111118] border border-[rgba(74,158,255,0.3)] rounded-lg px-3 py-2 shadow-lg">
                <div className="w-2 h-2 rounded-full bg-[#4a9eff] animate-pulse" />
                <span className="text-xs text-[#4a9eff] font-mono">Refreshing...</span>
              </div>
            </div>
          )}

          {stats && <>
            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { l: 'Total Queries', v: stats.total_queries.toLocaleString(), icon: Activity, c: 'text-[#4a9eff]', bar: 100 },
                { l: 'Blocked', v: stats.blocked_count.toLocaleString(), icon: Ban, c: 'text-[#f85149]', s: `${stats.blocked_pct.toFixed(1)}% of traffic`, bar: stats.blocked_pct },
                { l: 'Block Rate', v: `${stats.blocked_pct.toFixed(1)}%`, icon: Activity, c: 'text-[#f0883e]', s: `${stats.blocked_count} blocked`, bar: stats.blocked_pct },
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
                    {item.bar !== undefined && (
                      <div className="w-full h-1.5 bg-[#1a1a24] rounded-full mt-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{
                          width: `${item.bar}%`,
                          background: item.bar > 50 ? '#f85149' : item.bar > 25 ? '#f0883e' : '#4a9eff'
                        }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Main chart */}
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888]">Query Volume</h3>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {presets.map(p => (
                    <button key={p.key} onClick={() => setRangePreset(p.key)}
                      className={`text-xs px-2.5 py-1 rounded transition-all ${
                        rangePreset === p.key
                          ? 'bg-[#4a9eff] text-white'
                          : 'text-[#888] hover:text-[#e8e8ee] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(74,158,255,0.3)]'
                      }`}
                    >{p.label}</button>
                  ))}
                  {rangePreset === 'day' && <>
                    <span className="text-[#333] text-xs">|</span>
                    <Dd v={fd} set={handleDay} opts={days.map(d => ({ v: d, l: String(d).padStart(2, '0') }))} />
                    <Dd v={fm} set={handleMonth} opts={months.map((m, i) => ({ v: i, l: m }))} />
                    <Dd v={fy} set={handleYear} opts={years.map(y => ({ v: y, l: String(y) }))} />
                  </>}
                </div>
              </div>
              {stats.queries_last_24h?.length ? (
                <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
                  <div className="h-48 flex items-end gap-[2px] relative">
                    {stats.queries_last_24h.map((b, i) => {
                      const bx = stats.queries_last_24h!
                      const mx = Math.max(...bx.map(x => x.total), 1)
                      const h = mx > 0 ? (b.total / mx) * 100 : 0
                      const ratePct = b.total > 0 ? (b.blocked / b.total) * 100 : 0
                      const isSmall = bx.length > 30
                      return (
                        <div key={i} className="flex-1 flex flex-col justify-end h-full relative group cursor-pointer">
                          {/* Bar background — changes subtly based on blocked rate */}
                          <div
                            className="w-full rounded-t transition-all duration-200 relative overflow-hidden"
                            style={{
                              height: `${Math.max(h, isSmall ? 1 : 2)}%`,
                              background: ratePct > 20
                                ? `linear-gradient(to top, rgba(248,81,73,0.7), rgba(248,81,73,0.3))`
                                : `linear-gradient(to top, rgba(74,158,255,0.5), rgba(74,158,255,0.15))`,
                              minHeight: isSmall ? '1px' : '2px',
                            }}
                          >
                            {/* Blocked portion overlay */}
                            {ratePct > 0 && (
                              <div
                                className="absolute inset-x-0 bottom-0 bg-[#f85149] transition-all duration-300"
                                style={{ height: `${ratePct}%` }}
                              />
                            )}
                          </div>
                          {/* Tooltip */}
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-[#0d0d14] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[10px] text-[#e8e8ee] whitespace-nowrap transition-all pointer-events-none z-10 shadow-xl shadow-black/40 leading-relaxed">
                            <div className="font-medium text-[11px] mb-0.5">{formatPeriod(b.hour, currentGroupBy)}</div>
                            <div className="text-[#888]">{b.total.toLocaleString()} req · <span className="text-[#f85149]">{b.blocked} blocked</span> ({ratePct.toFixed(0)}%)</div>
                            {b.avg_duration_ms > 0 && <div className="text-[#4a9eff]">{b.avg_duration_ms.toFixed(0)}ms avg</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* X-axis labels — smart spacing based on bucket count */}
                  <div className="flex items-center mt-2 text-[9px] text-[#555] font-mono">
                    {stats.queries_last_24h.filter((_, i) => {
                      const len = stats.queries_last_24h!.length
                      // For ≤24 buckets, show every 6th; for day buckets (≤31), show ~5 labels; for month (≤12), show all
                      if (len <= 12) return true
                      const step = len <= 24 ? Math.max(1, Math.floor(len / 4)) : Math.max(1, Math.floor(len / 5))
                      return i % step === 0
                    }).map(b => (
                      <span key={b.hour} className="flex-1">{formatPeriod(b.hour, currentGroupBy)}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[11px] text-[#888]">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[rgba(74,158,255,0.4)]" /> Allowed</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#f85149]" /> Blocked</span>
                  </div>
                </div>
              ) : (
                <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl py-12 text-center">
                  <p className="text-sm text-[#888]">No data for this period</p>
                </div>
              )}
            </div>

            {/* REWORKED Response Time — premium area chart */}
            {stats.queries_last_24h?.some(b => b.avg_duration_ms > 0) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888]">Response Time</h3>
                  <span className="text-[10px] text-[#555] font-mono">
                    {(Math.min(...stats.queries_last_24h.filter(b => b.avg_duration_ms > 0).map(b => b.avg_duration_ms))).toFixed(0)}ms avg – {Math.max(...stats.queries_last_24h.filter(b => b.avg_duration_ms > 0).map(b => b.avg_duration_ms)).toFixed(0)}ms peak
                  </span>
                </div>
                <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
                  <div className="h-28 flex items-end gap-[1px] relative">
                    {/* Gradient area fill */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="resp-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4a9eff" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#4a9eff" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      <polyline
                        fill="url(#resp-grad)"
                        stroke="none"
                        points={(() => {
                          const bx = stats.queries_last_24h!
                          const mx = Math.max(...bx.map(x => x.avg_duration_ms), 1)
                          const divisor = Math.max(bx.length - 1, 1)
                          const pts = bx.map((b, i) => {
                            const x = (i / divisor) * 100
                            const y = ((mx - b.avg_duration_ms) / mx) * 100
                            return `${x},${y}`
                          })
                          return `0,100 ${pts.join(' ')} 100,100`
                        })()}
                      />
                      {/* Line overlay */}
                      <polyline
                        fill="none"
                        stroke="#4a9eff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={(() => {
                          const bx = stats.queries_last_24h!
                          const mx = Math.max(...bx.map(x => x.avg_duration_ms), 1)
                          const divisor = Math.max(bx.length - 1, 1)
                          return bx.map((b, i) => {
                            const x = (i / divisor) * 100
                            const y = ((mx - b.avg_duration_ms) / mx) * 100
                            return `${x},${y}`
                          }).join(' ')
                        })()}
                      />
                    </svg>
                    {/* Actual bars for hover targets */}
                    {stats.queries_last_24h.map((b, i) => {
                      const mx = Math.max(...stats.queries_last_24h!.map(x => x.avg_duration_ms), 1)
                      const h = mx > 0 ? (b.avg_duration_ms / mx) * 100 : 0
                      return (
                        <div key={i} className="flex-1 h-full relative group cursor-pointer">
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0d0d14] border border-[rgba(255,255,255,0.1)] rounded-lg px-2.5 py-1.5 text-[10px] text-[#e8e8ee] whitespace-nowrap transition-all pointer-events-none z-10 shadow-xl shadow-black/40">
                            <div className="font-medium">{formatPeriod(b.hour, currentGroupBy)}</div>
                            <div className="text-[#4a9eff]">{b.avg_duration_ms.toFixed(0)}ms avg</div>
                          </div>
                          {/* invisible hover target */}
                          <div className="w-full h-full" style={{ minHeight: '1px' }} />
                        </div>
                      )
                    })}
                  </div>
                  {/* Mini legend */}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-[#555] font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-[2px] rounded bg-[#4a9eff]" /> Avg latency
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm bg-[rgba(74,158,255,0.15)]" /> Range
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Query type breakdown */}
            {stats.query_types?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888] mb-3">Query Types</h3>
                <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const total = stats.query_types.reduce((s, t) => s + t.count, 0)
                      const colors = ['#4a9eff', '#22c55e', '#f0883e', '#a855f7', '#f85149', '#06b6d4', '#eab308', '#ec4899']
                      return stats.query_types.map((t, i) => (
                        <div key={t.type} className="flex items-center gap-2 bg-[#1a1a24] rounded-lg px-3 py-2 text-xs">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                          <span className="text-[#e8e8ee] font-mono font-medium">{t.type}</span>
                          <span className="text-[#888]">{t.count.toLocaleString()}</span>
                          <span className="text-[#555]">({(t.count / total * 100).toFixed(1)}%)</span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Top blocked domains */}
            {stats.top_blocked_domains?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888] mb-4">Top Blocked Domains</h3>
                <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
                  <div className="space-y-2">
                    {stats.top_blocked_domains.map((d, i) => {
                      const mx = Math.max(...stats.top_blocked_domains.map(x => x.count), 1)
                      return (
                        <div key={d.domain} className="flex items-center gap-3 py-1.5">
                          <span className="w-5 text-[10px] text-[#888] font-mono text-right shrink-0">{String(i + 1).padStart(2, '0')}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-[#e8e8ee] font-mono truncate">{d.domain}</div>
                            <div className="w-full h-1 bg-[#1a1a24] rounded-full mt-1.5 overflow-hidden">
                              <div className="h-full bg-[#f85149]/60 rounded-full" style={{ width: `${(d.count / mx) * 100}%` }} />
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-[#f85149] font-mono w-14 text-right">{d.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom: Top Clients + Top Domains */}
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
        </>}

        {/* ======= LOG TAB ======= */}
        {tab === 'log' && <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]" />
                <input type="text" value={logSearch} onChange={e => setLogSearch(e.target.value)}
                  placeholder="Search domain, IP, or type..."
                  className="w-full bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-lg pl-8 pr-8 py-2 text-sm text-[#e8e8ee] outline-none placeholder:text-[#555] focus:border-[rgba(74,158,255,0.3)] transition-colors font-mono"
                />
                {logSearch && (
                  <button onClick={() => setLogSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3 h-3 text-[#555] hover:text-[#e8e8ee] transition-colors" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-[#1a1a24] rounded-lg overflow-hidden">
                {(['all', 'allowed', 'blocked'] as const).map(f => (
                  <button key={f} onClick={() => setLogFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium transition-all ${
                      logFilter === f ? 'bg-[#4a9eff] text-white' : 'text-[#888] hover:text-[#e8e8ee]'
                    }`}
                  >{f === 'all' ? 'All' : f === 'allowed' ? 'Allowed' : 'Blocked'}</button>
                ))}
              </div>
              {rangePreset === 'day' && <>
                <span className="text-[#333] text-xs">|</span>
                <Dd v={fd} set={handleDay} opts={days.map(d => ({ v: d, l: String(d).padStart(2, '0') }))} />
                <Dd v={fm} set={handleMonth} opts={months.map((m, i) => ({ v: i, l: m }))} />
                <Dd v={fy} set={handleYear} opts={years.map(y => ({ v: y, l: String(y) }))} />
              </>}
              <span className="text-xs text-[#888] font-mono">{qs.length} entries</span>
            </div>
          </div>
          <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {qs.length === 0 ? (
                <div className="py-16 text-center text-sm text-[#888]">
                  {logSearch || logFilter !== 'all' ? 'No matching queries' : 'No queries for this date'}
                </div>
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

        {/* ======= BLOCKLIST TAB ======= */}
        {tab === 'blocklist' && <>
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888]">Blocklist Lookup</h3>
              <span className="text-xs text-[#888] font-mono">{data?.blocklist_domains?.toLocaleString() ?? '—'} domains blocked</span>
            </div>
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
              <div className="relative max-w-md mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                <input type="text" value={blQuery}
                  onChange={e => { setBlQuery(e.target.value); searchBlocklist(e.target.value) }}
                  placeholder="Search blocked domains..."
                  className="w-full bg-[#1a1a24] border border-[rgba(255,255,255,0.06)] rounded-lg pl-10 pr-10 py-2.5 text-sm text-[#e8e8ee] outline-none placeholder:text-[#555] focus:border-[rgba(74,158,255,0.3)] transition-colors font-mono"
                />
                {blSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#4a9eff] border-t-transparent rounded-full animate-spin" />
                )}
                {blQuery && !blSearching && (
                  <button onClick={() => { setBlQuery(''); setBlResults([]); setBlTotal(0) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-[#555] hover:text-[#e8e8ee] transition-colors" />
                  </button>
                )}
              </div>
              {blResults.length > 0 && (
                <>
                  <p className="text-xs text-[#555] mb-3 font-mono">{blTotal} result{blTotal !== 1 ? 's' : ''} for &ldquo;{blQuery}&rdquo;</p>
                  <div className="space-y-1 max-h-[500px] overflow-y-auto">
                    {blResults.map(d => (
                      <div key={d} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1a1a24] transition-colors">
                        <AlertTriangle className="w-3 h-3 text-[#f85149] shrink-0" />
                        <span className="text-sm text-[#e8e8ee] font-mono">{d}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {blQuery && !blSearching && blResults.length === 0 && (
                <p className="text-sm text-[#888] py-8 text-center">No blocked domains matching &ldquo;{blQuery}&rdquo;</p>
              )}
              {!blQuery && (
                <p className="text-sm text-[#555] py-8 text-center">Type to search the blocklist of {data?.blocklist_domains?.toLocaleString() ?? '—'} domains</p>
              )}
            </div>
          </div>
        </>}
      </main>
    </div>
  )
}
