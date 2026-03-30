import { AlertSeverity } from '@/types';

interface AlertBadgeProps {
  severity: AlertSeverity;
  count?: number;
}

const severityConfig = {
  critical: {
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    label: 'Critical',
  },
  warning: {
    bar: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    label: 'Warning',
  },
  info: {
    bar: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    label: 'Info',
  },
};

export function AlertBadge({ severity, count }: AlertBadgeProps) {
  const config = severityConfig[severity];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.bar}`} />
      {count !== undefined ? count : config.label}
    </span>
  );
}
