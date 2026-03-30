import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface MetricTileProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: LucideIcon;
  color?: 'default' | 'red' | 'teal' | 'blue' | 'amber';
  isLoading?: boolean;
}

const colorMap = {
  default: {
    bg: 'bg-white',
    icon: 'bg-gray-100 text-gray-600',
    value: 'text-gray-900',
  },
  red: {
    bg: 'bg-white',
    icon: 'bg-red-100 text-red-600',
    value: 'text-red-700',
  },
  teal: {
    bg: 'bg-white',
    icon: 'bg-teal-100 text-teal-600',
    value: 'text-teal-700',
  },
  blue: {
    bg: 'bg-white',
    icon: 'bg-blue-100 text-blue-600',
    value: 'text-blue-700',
  },
  amber: {
    bg: 'bg-white',
    icon: 'bg-amber-100 text-amber-600',
    value: 'text-amber-700',
  },
};

export function MetricTile({
  label,
  value,
  unit,
  trend,
  trendValue,
  icon: Icon,
  color = 'default',
  isLoading = false,
}: MetricTileProps) {
  const colors = colorMap[color];

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const trendColor =
    trend === 'up'
      ? 'text-teal-600'
      : trend === 'down'
      ? 'text-red-500'
      : 'text-gray-400';

  return (
    <div className={`${colors.bg} rounded-xl border border-gray-100 p-5 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{label}</p>
          {isLoading ? (
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-gray-200" />
          ) : (
            <div className="mt-1 flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${colors.value}`}>
                {value}
              </span>
              {unit && (
                <span className="text-sm text-gray-500">{unit}</span>
              )}
            </div>
          )}
          {trend && trendValue && !isLoading && (
            <div className={`mt-1 flex items-center gap-1 ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{trendValue}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`flex-shrink-0 rounded-lg p-2 ${colors.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
