import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
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
  try {
    const d = new Date(hour)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
  } catch {
    return hour
  }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-lighter border border-border rounded-[10px] px-3 py-2 text-xs shadow-xl">
      <p className="text-muted mb-1">{formatHour(label)}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export function TimeChart({ data }: TimeChartProps) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-muted">
        No data yet — queries will appear here
      </div>
    )
  }

  return (
    <div className="h-48 md:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#888888', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatHour}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#888888', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#222222' }} />
          <Bar dataKey="total" name="Allowed" fill="#31929A" radius={[3, 3, 0, 0]} stackId="a" />
          <Bar dataKey="blocked" name="Blocked" fill="#f85149" radius={[3, 3, 0, 0]} stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
