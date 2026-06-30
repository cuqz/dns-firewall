import { DivideIcon as LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface StatsCardProps {
  label: string
  value: string
  icon: LucideIcon
  variant?: 'default' | 'danger' | 'blue' | 'warning'
  trend?: string
}

export function StatsCard({ label, value, icon: Icon, variant = 'default', trend }: StatsCardProps) {
  const variantStyles = {
    default: 'bg-accent/10 text-accent border-accent/15',
    danger: 'bg-danger/10 text-danger border-danger/20',
    blue: 'bg-accent/10 text-accent border-accent/15',
    warning: 'bg-warning/10 text-warning border-warning/20',
  }

  return (
    <div className="card hover:border-border/80 transition-colors duration-200">
      <div className="flex items-start justify-between mb-3">
        <span className="stat-label">{label}</span>
        <div className={clsx('w-8 h-8 rounded-lg border flex items-center justify-center', variantStyles[variant])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      {trend && <p className="text-[10px] text-muted mt-1.5">{trend}</p>}
    </div>
  )
}
