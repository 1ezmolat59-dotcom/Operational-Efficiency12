import { CheckCircle, XCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface KPICardProps {
  kpi: string;
  value: number;
  target: number;
  unit: string;
  trend?: number[];
  higherIsBetter: boolean;
  isLoading?: boolean;
}

function formatValue(value: number, unit: string): string {
  if (unit === '$') return `$${value.toFixed(2)}`;
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === 'min') return `${value.toFixed(0)} min`;
  return `${value}${unit ? ' ' + unit : ''}`;
}

export function KPICard({
  kpi,
  value,
  target,
  unit,
  trend,
  higherIsBetter,
  isLoading = false,
}: KPICardProps) {
  const isMeetingTarget = higherIsBetter ? value >= target : value <= target;

  const trendData = trend?.map((v, i) => ({ index: i, value: v })) ?? [];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-gray-100" />
        <div className="mt-3 h-12 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-600 leading-tight">{kpi}</h3>
        {isMeetingTarget ? (
          <CheckCircle className="h-5 w-5 flex-shrink-0 text-teal-500" aria-label="Meeting target" />
        ) : (
          <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" aria-label="Not meeting target" />
        )}
      </div>

      {/* Value */}
      <div className="mt-2">
        <span className={`text-3xl font-bold ${isMeetingTarget ? 'text-teal-700' : 'text-red-600'}`}>
          {formatValue(value, unit)}
        </span>
      </div>

      {/* Target */}
      <p className="mt-1 text-xs text-gray-400">
        Target: {higherIsBetter ? '≥' : '≤'} {formatValue(target, unit)}
      </p>

      {/* Sparkline */}
      {trendData.length > 1 && (
        <div className="mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={isMeetingTarget ? '#0d9488' : '#ef4444'}
                strokeWidth={2}
                dot={false}
              />
              <Tooltip
                contentStyle={{ fontSize: '11px', padding: '4px 8px' }}
                formatter={(v: number) => [formatValue(v, unit), '']}
                labelFormatter={() => ''}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Status bar */}
      <div className="mt-3">
        <div className="h-1.5 rounded-full bg-gray-100">
          <div
            className={`h-1.5 rounded-full transition-all ${isMeetingTarget ? 'bg-teal-500' : 'bg-red-400'}`}
            style={{
              width: `${Math.min(100, higherIsBetter ? (value / target) * 100 : (target / value) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
