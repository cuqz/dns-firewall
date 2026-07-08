import type { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: string
  icon: LucideIcon
  trend?: string
  variant?: 'default' | 'danger' | 'warning' | 'success'
}

const variantConfig = {
  default:  { icon: 'bg-accent-muted border-accent-border text-accent', bar: 'bg-accent/30' },
  danger:   { icon: 'bg-danger-muted border-danger-border text-danger',  bar: 'bg-danger/30' },
  warning:  { icon: 'bg-warning-muted border-wire text-warning',          bar: 'bg-warning/30' },
  success:  { icon: 'bg-success-muted border-wire text-success',          bar: 'bg-success/30' },
}

export function StatsCard({ label, value, icon: Icon, trend, variant = 'default' }: StatsCardProps) {
  const v = variantConfig[variant]

  return (
    <div className="card group cursor-default animate-slide-up">
      <div className="card-inner">
        {/* top row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${v.icon}`}>
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          </div>
          {/* subtle corner glow on hover */}
          <div className="w-1.5 h-1.5 rounded-full bg-ink-ghost group-hover:bg-accent/40 transition-colors duration-300" />
        </div>

        {/* value */}
        <div className="stat-value mb-1">{value}</div>

        {/* label */}
        <p className="text-[11px] text-ink-secondary font-medium uppercase tracking-[0.1em] mb-3">{label}</p>

        {/* trend */}
        {trend && (
          <>
            <div className="divider mb-3" />
            <p className="text-[11px] text-ink-muted font-mono">{trend}</p>
          </>
        )}
      </div>
    </div>
  )
}
