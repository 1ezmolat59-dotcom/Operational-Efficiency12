import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertSeverity } from '@/types';
import { AlertBadge } from '@/components/common/AlertBadge';

interface AlertsFeedProps {
  alerts: Alert[];
  onResolve: (id: string) => void;
  isLoading?: boolean;
}

const severityIcons: Record<AlertSeverity, React.FC<{ className?: string }>> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const severityBarColors: Record<AlertSeverity, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

const severityTextColors: Record<AlertSeverity, string> = {
  critical: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
};

export function AlertsFeed({ alerts, onResolve, isLoading = false }: AlertsFeedProps) {
  const unresolvedAlerts = alerts.filter((a) => !a.resolved);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="divide-y divide-gray-50 p-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3">
              <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Active Alerts</h3>
          {unresolvedAlerts.length > 0 && (
            <AlertBadge severity="critical" count={unresolvedAlerts.length} />
          )}
        </div>
      </div>

      {unresolvedAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CheckCircle className="h-10 w-10 text-teal-400" />
          <p className="mt-2 text-sm font-medium text-gray-500">No active alerts</p>
          <p className="text-xs text-gray-400">All clear — operations running smoothly</p>
        </div>
      ) : (
        <ul className="max-h-80 divide-y divide-gray-50 overflow-y-auto">
          {unresolvedAlerts.map((alert) => {
            const SeverityIcon = severityIcons[alert.severity];
            const barColor = severityBarColors[alert.severity];
            const iconColor = severityTextColors[alert.severity];

            return (
              <li key={alert.id} className="flex gap-0 hover:bg-gray-50 transition-colors">
                {/* Severity bar */}
                <div className={`w-1 flex-shrink-0 rounded-l ${barColor}`} />
                <div className="flex flex-1 items-start gap-3 p-3">
                  <SeverityIcon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconColor}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 leading-snug">{alert.message}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    onClick={() => onResolve(alert.id)}
                    aria-label={`Resolve alert: ${alert.message}`}
                    className="flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
