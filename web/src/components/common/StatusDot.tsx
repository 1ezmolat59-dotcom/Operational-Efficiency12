interface StatusDotProps {
  status: 'active' | 'overdue' | 'break' | 'offline';
  showLabel?: boolean;
}

const statusConfig = {
  active: { color: 'bg-green-500', label: 'Active' },
  overdue: { color: 'bg-amber-500', label: 'Overdue' },
  break: { color: 'bg-gray-400', label: 'On Break' },
  offline: { color: 'bg-red-500', label: 'Offline' },
};

export function StatusDot({ status, showLabel = false }: StatusDotProps) {
  const config = statusConfig[status];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${config.color} ${status === 'active' ? 'animate-pulse' : ''}`}
        aria-label={config.label}
        title={config.label}
      />
      {showLabel && (
        <span className="text-xs text-gray-500">{config.label}</span>
      )}
    </span>
  );
}
