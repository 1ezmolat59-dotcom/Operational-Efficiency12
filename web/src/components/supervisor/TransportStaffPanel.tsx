import { Staff } from '@/types';
import { StatusDot } from '@/components/common/StatusDot';
import { ArrowRight } from 'lucide-react';

interface TransportStaffPanelProps {
  staff: Staff[];
  onToggleAvailability: (staffId: string, available: boolean) => void;
  isLoading?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getTransportStatus(s: Staff): 'active' | 'overdue' | 'break' | 'offline' {
  if (!s.availabilityStatus) return 'offline';
  if (s.currentJob) return 'active';
  return 'break';
}

function parseJobRoute(job: string | undefined): { from: string; to: string } | null {
  if (!job) return null;
  const parts = job.split('→').map((p) => p.trim());
  if (parts.length === 2) return { from: parts[0], to: parts[1] };
  return null;
}

export function TransportStaffPanel({ staff, onToggleAvailability, isLoading = false }: TransportStaffPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="divide-y divide-gray-50 p-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Transport Staff</h3>
        <p className="text-xs text-gray-400 mt-0.5">{staff.length} staff members</p>
      </div>

      {staff.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400">No transport staff found</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {staff.map((s) => {
            const status = getTransportStatus(s);
            const route = parseJobRoute(s.currentJob);

            return (
              <li key={s.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">
                    {getInitials(s.name)}
                  </div>
                  <StatusDot status={status} />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                  {route ? (
                    <p className="flex items-center gap-1 text-xs text-gray-400">
                      <span className="truncate max-w-[5rem]">{route.from}</span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0 text-gray-300" />
                      <span className="truncate max-w-[5rem]">{route.to}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">
                      {s.availabilityStatus ? 'Available' : 'Off shift'}
                    </p>
                  )}
                </div>

                {/* Availability toggle */}
                <button
                  onClick={() => onToggleAvailability(s.id, !s.availabilityStatus)}
                  aria-label={`Toggle availability for ${s.name}`}
                  className={`relative flex-shrink-0 h-5 w-9 rounded-full transition-colors ${
                    s.availabilityStatus ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      s.availabilityStatus ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
