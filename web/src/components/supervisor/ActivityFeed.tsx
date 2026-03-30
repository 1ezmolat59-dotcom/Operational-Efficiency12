import { useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ActivityEntry } from '@/types';
import {
  Bed,
  Truck,
  CheckSquare,
  User,
  Activity,
  AlertCircle,
} from 'lucide-react';

interface ActivityFeedProps {
  activities: ActivityEntry[];
  isLoading?: boolean;
}

function getActivityIcon(type: string) {
  if (type.includes('room') || type.includes('clean') || type.includes('bed')) {
    return <Bed className="h-3.5 w-3.5" />;
  }
  if (type.includes('transport') || type.includes('job')) {
    return <Truck className="h-3.5 w-3.5" />;
  }
  if (type.includes('complete') || type.includes('done')) {
    return <CheckSquare className="h-3.5 w-3.5" />;
  }
  if (type.includes('staff') || type.includes('assign')) {
    return <User className="h-3.5 w-3.5" />;
  }
  if (type.includes('alert')) {
    return <AlertCircle className="h-3.5 w-3.5" />;
  }
  return <Activity className="h-3.5 w-3.5" />;
}

function getActivityColor(type: string): string {
  if (type.includes('complete') || type.includes('clean_ready')) return 'bg-teal-100 text-teal-600';
  if (type.includes('dirty') || type.includes('alert') || type.includes('stat')) return 'bg-red-100 text-red-600';
  if (type.includes('in_progress') || type.includes('accept')) return 'bg-blue-100 text-blue-600';
  if (type.includes('transport') || type.includes('job')) return 'bg-purple-100 text-purple-600';
  return 'bg-gray-100 text-gray-500';
}

export function ActivityFeed({ activities, isLoading = false }: ActivityFeedProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Auto-scroll to top when new items arrive
  useEffect(() => {
    if (listRef.current && activities.length > 0) {
      listRef.current.scrollTop = 0;
    }
  }, [activities.length]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 p-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        <h3 className="text-sm font-semibold text-gray-900">Live Activity</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-2">
              <div className="h-6 w-6 flex-shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity className="h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">No recent activity</p>
        </div>
      ) : (
        <ul
          ref={listRef}
          className="max-h-64 divide-y divide-gray-50 overflow-y-auto scroll-smooth"
        >
          {activities.slice(0, 50).map((entry, index) => {
            const colorClass = getActivityColor(entry.type);
            const Icon = () => getActivityIcon(entry.type);

            return (
              <li
                key={`${entry.createdAt}-${index}`}
                className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors"
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${colorClass}`}
                >
                  <Icon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-700 leading-snug">{entry.message}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
