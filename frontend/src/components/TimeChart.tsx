import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

interface TimeBucket {
  hour: string
  total: number
  blocked: number
}

interface TimeChartProps {
  data: TimeBucket[]
}

function formatHour(hour: string) {
  if (!hour) return '--'
  const d = new Date(hour)
  if (isNaN(d.getTime())) return hour
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const total = payload.find((p: any) => p.name === 'Allowed')?.value ?? 0
  const blocked = payload.find((p: any) => p.name === 'Blocked')?.value ?? 0
  const pct = total + blocked > 0 ? ((blocked / (total + blocked)) * 100).toFixed(1) : '0'

  return (
    <div
      className="rounded-xl px-3.5 py-3 text-xs shadow-2xl"
      style={{
        background: '#12121e',
        border: '1px solid #2a2a40',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,200,0.08)',
      }}
    >
      <p className="text-ink-muted font-mono mb-2 text-[10px]">{formatHour(label)}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-ink-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Allowed
          </span>
          <span className="font-mono font-medium text-ink">{total.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-ink-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            Blocked
          </span>
          <span className="font-mono font-medium text-danger">{blocked.toLocaleString()}</span>
        </div>
        <div className="divider mt-2 pt-2 flex items-center justify-between gap-6">
          <span className="text-ink-muted">Block rate</span>
          <span className="font-mono font-semibold text-ink">{pct}%</span>
        </div>
      </div>
    </div>
  )
}

export function TimeChart({ data }: TimeChartProps) {
  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-52 gap-3">
        <div className="w-8 h-8 rounded-xl bg-accent-muted border border-accent-border flex items-center justify-center">
          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-xs text-ink-muted">No data yet — queries will appear here</p>
      </div>
    )
  }

  return (
    <div className="h-52 md:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={1} barCategoryGap="30%" margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#55556a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatHour}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#55556a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,212,200,0.04)', radius: 4 }} />
          <Bar dataKey="total" name="Allowed" fill="#00d4c8" radius={[3, 3, 0, 0]} stackId="a" opacity={0.85} />
          <Bar dataKey="blocked" name="Blocked" fill="#ff4757" radius={[3, 3, 0, 0]} stackId="a" opacity={0.9} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
